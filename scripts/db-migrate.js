// 데이터베이스 준비: pnpm db:migrate  (예시 데이터까지: pnpm db:migrate --seed)
//  1. .env 가 없으면 .env.example 로 만들고 로그인 비밀 값을 채운다 (DB 비밀번호만 직접 넣으면 된다)
//  2. DB(doroland_drawing 등)가 없으면 만든다
//  3. database/migrations 의 SQL 중 아직 실행하지 않은 것만 번호 순서대로 실행하고 schema_migrations 표에 기록한다
//  4. 앱의 장면 목록(database/seeds/content.sql)을 넣는다 (이미 있으면 건너뜀)
// psql 을 설치하거나 경로를 잡을 필요가 없다 (API 서버와 같은 pg 라이브러리로 접속한다).
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// 오류는 긴 스택 대신 한 줄로 보여 준다.
for (const event of ["uncaughtException", "unhandledRejection"]) {
  process.on(event, (err) => {
    console.error(`오류: ${err?.message ?? err}`);
    process.exit(1);
  });
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbDir = join(root, "database");
const withSeed = process.argv.includes("--seed");

// ── 1. .env ───────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    copyFileSync(join(root, ".env.example"), envPath);
    const text = readFileSync(envPath, "utf8").replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(32).toString("hex")}`);
    writeFileSync(envPath, text);
    console.log(".env 파일을 만들었어요. 메모장으로 열어 DATABASE_URL 의 '비밀번호' 자리에 PostgreSQL 비밀번호를 넣고 다시 실행하세요.");
    console.log("  notepad .env");
  } else {
    console.log(".env 에 DATABASE_URL 이 없어요. .env.example 을 참고해 채워 주세요.");
  }
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
const dbName = decodeURIComponent(url.pathname.slice(1));

async function connect(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  return client;
}

// ── 2. DB 만들기 ─────────────────────────────────────────
let client;
try {
  client = await connect(url.toString());
} catch (err) {
  if (err.code !== "3D000") throw explain(err); // 3D000: DB가 없음
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const adminClient = await connect(admin.toString()).catch((e) => {
    throw explain(e);
  });
  await adminClient.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
  await adminClient.end();
  console.log(`DB "${dbName}" 를 만들었어요.`);
  client = await connect(url.toString());
}

function explain(err) {
  if (err.code === "28P01") return new Error("PostgreSQL 비밀번호가 맞지 않아요. .env 의 DATABASE_URL 을 확인하세요.");
  if (err.code === "ECONNREFUSED") return new Error("PostgreSQL 에 연결할 수 없어요. PostgreSQL 이 설치·실행 중인지 확인하세요.");
  return err;
}

// ── 3. 마이그레이션 ──────────────────────────────────────
await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
const applied = new Set((await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename));

// 이 스크립트가 생기기 전에 psql 로 직접 만든 DB: 이미 만들어진 것은 실행한 것으로 기록한다.
const ALREADY_THERE = {
  "001_initial.sql": "SELECT to_regclass('public.users') IS NOT NULL AS ok",
  "002_auth.sql": "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') AS ok",
  "003_user_settings.sql": "SELECT to_regclass('public.user_settings') IS NOT NULL AS ok",
  "004_drawing_drafts.sql": "SELECT to_regclass('public.drawing_drafts') IS NOT NULL AS ok",
};

const files = readdirSync(join(dbDir, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const check = ALREADY_THERE[file];
  if (applied.size === 0 && check && (await client.query(check)).rows[0].ok) {
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    console.log(`  이미 있음  ${file}`);
    continue;
  }
  try {
    await client.query(readFileSync(join(dbDir, "migrations", file), "utf8"));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`  실패      ${file}: ${err.message}`);
    process.exit(1);
  }
  await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
  console.log(`  실행함    ${file}`);
  ran++;
}
if (!ran) console.log("  새로 실행할 마이그레이션이 없어요.");

// ── 4. 예시 데이터(선택)와 장면 목록 ─────────────────────
if (withSeed) {
  const seeded = (await client.query("SELECT 1 FROM users WHERE nickname = 'user_A'")).rows.length > 0;
  const hasChapters = (await client.query("SELECT 1 FROM chapters LIMIT 1")).rows.length > 0;
  if (seeded) console.log("  예시 데이터는 이미 있어요.");
  else if (hasChapters) console.log("  예시 데이터는 빈 DB에서만 넣을 수 있어요 (이미 장면 목록이 있어 건너뜀).");
  else {
    await client.query(readFileSync(join(dbDir, "seeds", "dev_seed.sql"), "utf8"));
    console.log("  예시 데이터(dev_seed.sql)를 넣었어요.");
  }
}
await client.query(readFileSync(join(dbDir, "seeds", "content.sql"), "utf8"));
console.log("  장면 목록(content.sql) 확인 완료");

const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")).rows;
console.log(`완료: 표 ${tables.length}개 (${tables.map((t) => t.table_name).join(", ")})`);
await client.end();
