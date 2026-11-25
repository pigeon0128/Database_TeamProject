import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const run = promisify(execFile);
const read = (path) => readFile(join(root, path), "utf8");
const legacyMigration = "023_brush_price_100.sql";
const gradeMigrations = ["024_user_grade.sql", "025_grade_leaderboard_view.sql"];
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

function localAdminUrl() {
  const configured = process.env.DOROLAND_TEST_ADMIN_URL;
  assert.ok(configured, "Set DOROLAND_TEST_ADMIN_URL to a disposable local PostgreSQL instance");
  const url = new URL(configured);
  assert.ok(["postgresql:", "postgres:"].includes(url.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  assert.equal(url.pathname, "/postgres", "Connect to the test cluster's maintenance database");
  // pg connection-string options can override the host or database in the URL.
  assert.equal(url.search, "", "Use an explicit loopback URL without query options");
  return url;
}

async function applyBaseline(db) {
  const files = (await readdir(join(root, "database/migrations")))
    .filter((name) => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 23)
    .sort();
  assert.equal(files.at(-1), legacyMigration);
  await db.query(
    "CREATE TABLE schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of files) {
    // The baseline database starts empty, so the runner's legacy file-copy hooks have no fixtures to move.
    await db.query(await read("database/migrations/" + name));
    await db.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [name]);
  }
  await db.query(await read("database/seeds/content.sql"));
}

async function unusedPort() {
  const listener = createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await promisify(listener.close.bind(listener))();
  return String(port);
}

async function waitForApi(base, api, port) {
  let output = "";
  api.stdout.setEncoding("utf8");
  api.stdout.on("data", (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.equal(api.exitCode, null, "The API exited during startup");
    // Identify the child listener before sending requests to the released port.
    if (output.includes("[api] http://localhost:" + port + " ")) {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) });
      assert.ok(response.ok, "The child API did not connect to the test database");
      return;
    }
    await delay(50);
  }
  assert.fail("The test API did not become ready");
}

test("023 to 025 upgrade and database query contracts", { timeout: 60_000 }, async (t) => {
  const adminUrl = localAdminUrl();
  const dbName = "doro_grade_test_" + randomUUID().replaceAll("-", "");
  const testUrl = new URL(adminUrl);
  testUrl.pathname = "/" + dbName;

  const uploadDirectory = await mkdtemp(join(tmpdir(), "doro-grade-test-"));
  const admin = new pg.Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 5000 });
  let db, api, apiExit;
  let created = false;
  t.after(async () => {
    try {
      if (api && api.exitCode === null && api.signalCode === null) api.kill();
      if (apiExit) await apiExit;
      await db?.end();
      if (created) await admin.query("DROP DATABASE " + dbName);
    } finally {
      await admin.end();
      await rm(uploadDirectory, { recursive: true, force: true });
    }
  });
  await admin.connect();
  await admin.query("CREATE DATABASE " + dbName);
  created = true;
  db = new pg.Client({ connectionString: testUrl.href, connectionTimeoutMillis: 5000 });
  await db.connect();
  await applyBaseline(db);

  const port = await unusedPort();
  const base = "http://127.0.0.1:" + port;
  const env = {
    ...process.env,
    DATABASE_URL: testUrl.href,
    UPLOAD_DIR: uploadDirectory,
    SESSION_SECRET: randomUUID() + randomUUID(),
    API_PORT: port,
  };
  api = spawn(process.execPath, ["server/index.js"], { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
  apiExit = once(api, "exit");
  await waitForApi(base, api, port);

  let cookie;
  async function request(path, { body, status = 200 } = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, status, path);
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    return response.json();
  }

  const credentials = { loginId: "grade_legacy", password: randomUUID() };
  const account = await request("/api/auth/register", { body: credentials, status: 201 });
  const userId = account.user.id;
  const { drawings } = await request("/api/drawings");
  const [below, exact, above, noImage, olderImage, unplayed] = drawings.filter((drawing) => drawing.category !== null);
  const story = drawings.find((drawing) => drawing.category === null);
  assert.ok(unplayed && story, "The baseline content must contain six creature drawings and a story drawing");

  const records = new Map();
  for (const [drawing, similarityScore, artwork] of [
    [below, 79.99, image],
    [exact, 80, image],
    [above, 80.01, image],
    [noImage, 96, null],
    [olderImage, 82, image],
    [olderImage, 95, null],
    [story, 91, image],
  ]) {
    const record = await request("/api/play-records", {
      body: { drawingId: drawing.id, similarityScore, durationMs: 1000, image: artwork },
      status: 201,
    });
    if (artwork) records.set(drawing.id, record);
  }

  const applied = async () =>
    (await db.query("SELECT filename, applied_at::text FROM schema_migrations ORDER BY filename")).rows;
  const beforeMigrations = await applied();
  assert.equal(beforeMigrations.at(-1).filename, legacyMigration);
  const boardPath = "/api/leaderboard?drawingId=" + exact.id;
  const beforeBoard = await request(boardPath);
  assert.equal(beforeBoard.me.recordId, records.get(exact.id).recordId);
  assert.ok(beforeBoard.me.imageKey);

  await t.test("the repository runner applies only 024 and 025 and preserves 023 account and results", async () => {
    const output = await run(process.execPath, ["scripts/db-migrate.js"], { cwd: root, env, timeout: 15_000 });
    assert.deepEqual(output.stdout.match(/\b\d{3}_[a-z_]+\.sql/g), gradeMigrations);
    const afterMigrations = await applied();
    assert.deepEqual(afterMigrations.slice(0, -2), beforeMigrations);
    assert.deepEqual(afterMigrations.slice(-2).map(({ filename }) => filename), gradeMigrations);
    assert.equal((await db.query("SELECT grade FROM users WHERE user_id = $1", [userId])).rows[0].grade, null);
    assert.equal((await db.query("SELECT 1 FROM v_grade_leaderboard WHERE user_id = $1", [userId])).rowCount, 0);
    cookie = undefined;
    assert.deepEqual(await request("/api/auth/login", { body: credentials }), account);
    assert.deepEqual(await request(boardPath), beforeBoard);
  });

  await t.test("the committed parameterized SQL filters drawing and grade and bounds NULL and large limits", async () => {
    const sql = await read("database/queries/grade_leaderboard.sql");
    const lookup = async (drawingId, grade, limit) => (await db.query(sql, [drawingId, grade, limit])).rows;
    assert.deepEqual(await lookup(exact.id, 3, 10), []);
    await db.query("UPDATE users SET grade = 3 WHERE user_id = $1", [userId]);
    const [legacy] = await lookup(exact.id, 3, null);
    assert.equal(legacy.record_id, String(beforeBoard.me.recordId));
    assert.equal(legacy.image_key, beforeBoard.me.imageKey);
    assert.deepEqual(await request(boardPath), beforeBoard);

    await db.query(
      `WITH players AS (
         INSERT INTO users (nickname, grade)
         SELECT 'grade_player_' || n, 3 FROM generate_series(1, 55) AS n
         RETURNING user_id, nickname
       )
       INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms)
       SELECT user_id, $1, 100 - substring(nickname FROM '[0-9]+$')::integer / 10.0, 2000 FROM players`,
      [exact.id],
    );
    const top = await lookup(exact.id, 3, 500);
    assert.deepEqual(top.map(({ nickname, grade_ranking }) => [nickname, Number(grade_ranking)]),
      Array.from({ length: 50 }, (_, i) => ["grade_player_" + (i + 1), i + 1]));
    assert.deepEqual(await lookup(exact.id, 3, null), top.slice(0, 10));
    assert.deepEqual(await lookup(exact.id, 3, 2), top.slice(0, 2));
    assert.deepEqual(await lookup(exact.id, 3, 0), []);
    assert.deepEqual(await lookup(exact.id, null, 10), []);
    assert.deepEqual(await lookup(null, 3, 10), []);
    assert.deepEqual(await lookup(exact.id, 0, 10), []);
    assert.deepEqual(await lookup(exact.id, 4, 10), []);
    await assert.rejects(lookup(exact.id, 3, -1), { code: "2201W" });
    const otherDrawing = await lookup(above.id, 3, 10);
    assert.equal(otherDrawing.length, 1);
    assert.equal(otherDrawing[0].record_id, String(records.get(above.id).recordId));
  });

  await t.test("three collection SQL queries agree with the APIs around 80 and with optional saved images", async () => {
    const queries = (await read("database/queries/collection.sql")).trim().split(/;\r?\n/);
    assert.equal(queries.length, 3);
    const all = (await db.query(queries[0], [userId])).rows;
    const chapters = (await db.query(queries[1], [userId])).rows;
    const creatures = (await db.query(queries[2], [userId])).rows;
    for (const [drawing, collected, score] of [
      [below, false, 79.99], [exact, true, 80], [above, true, 80.01],
      [noImage, false, null], [olderImage, true, 82], [unplayed, false, null],
      [story, true, 91],
    ]) {
      const lists = drawing === story ? [all] : [all, creatures];
      for (const list of lists) {
        const row = list.find(({ drawing_id }) => Number(drawing_id) === drawing.id);
        assert.ok(row, "Missing drawing " + drawing.id);
        const artwork = records.get(drawing.id);
        assert.equal(row.is_collected, collected);
        assert.equal(row.best_score === null ? null : Number(row.best_score), score);
        assert.equal(row.representative_record_id, artwork ? String(artwork.recordId) : null);
        assert.equal(row.representative_image_key, artwork?.imageKey ?? null);
      }
    }

    assert.deepEqual(creatures.map((row) => ({
      drawingId: Number(row.drawing_id),
      name: row.title,
      slug: row.slug,
      category: row.category,
      summary: row.summary,
      facts: row.facts,
      tips: row.tips,
      sources: row.sources,
      collected: row.is_collected,
      recordId: row.representative_record_id === null ? null : Number(row.representative_record_id),
      imageKey: row.representative_image_key,
      bestScore: row.best_score === null ? null : Number(row.best_score),
      bestDurationMs: row.best_duration_ms,
    })), (await request("/api/collection")).creatures);
    const summary = await request("/api/summary");
    assert.equal(summary.completeScore, 80);
    assert.equal(summary.creatureCollected, 3);
    assert.equal(summary.storyCompleted, 1);
    assert.equal(summary.completedArtworks, 4);
    for (const chapter of chapters) {
      const sameChapter = all.filter((row) => row.chapter_id === chapter.chapter_id);
      assert.equal(Number(chapter.total_drawings), sameChapter.length);
      assert.equal(Number(chapter.collected_drawings), sameChapter.filter((row) => row.is_collected).length);
    }
    assert.equal(chapters.reduce((total, row) => total + Number(row.collected_drawings), 0), summary.completedArtworks);
  });
});
