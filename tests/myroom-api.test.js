// Runs only against an explicitly supplied, disposable local test server. Never targets a default production URL.
import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { ROOM } from "../shared/myroom.js"

test(
  "PostgreSQL/API isolation, ownership, persistence, optimistic concurrency and existing drawing APIs",
  { skip: !process.env.MYROOM_TEST_URL },
  async (t) => {
    const base = new URL(process.env.MYROOM_TEST_URL)
    assert.ok(
      ["127.0.0.1", "localhost"].includes(base.hostname),
      "Use a disposable local server",
    )
    async function call(path, method = "GET", body, cookie) {
      const response = await fetch(new URL(path, base), {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      return {
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      }
    }
    const password = randomUUID()
    const a = await call("/api/auth/register", "POST", {
      loginId: `mr_${Date.now()}`,
      password,
    })
    const b = await call("/api/auth/register", "POST", {
      loginId: `mr_b${Date.now()}`,
      password,
    })
    assert.equal(a.status, 201)
    assert.equal(b.status, 201)
    const cookie = a.cookie
    await t.test("authentication and existing login", async () => {
      assert.equal((await call("/api/myroom")).status, 401)
      assert.equal((await call("/api/myroom", "PUT", {})).status, 401)
      assert.equal(
        (
          await call("/api/auth/login", "POST", {
            loginId: a.body.user.loginId,
            password,
          })
        ).status,
        200,
      )
      assert.equal(
        (await call("/api/auth/me", "GET", undefined, cookie)).body.user.id,
        a.body.user.id,
      )
    })
    // A valid transparent 1px PNG is sufficient for API/storage fixtures. Browser tests also submit a real canvas drawing.
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="
    const submit = (drawingId, score, session = cookie) =>
      call(
        "/api/play-records",
        "POST",
        { drawingId, similarityScore: score, durationMs: 5000, image },
        session,
      )
    assert.equal((await submit(2, 70)).status, 201)
    assert.equal((await submit(3, 70)).status, 201)
    assert.equal((await submit(4, 70, b.cookie)).status, 201)
    const initial = (await call("/api/myroom", "GET", undefined, cookie)).body
    assert.equal(initial.revision, 0)
    assert.deepEqual(initial.layout.objects, [])
    const frame = {
      id: "one",
      type: "frame",
      wall: "back",
      position: { x: -2, y: 2.5, z: ROOM.halfDepth - 0.12 },
      rotation: 0,
      scale: 1,
      artworkDrawingId: 2,
    }
    const save = (
      objects,
      expectedRevision = 0,
      session = cookie,
      extras = {},
    ) =>
      call(
        "/api/myroom",
        "PUT",
        { schemaVersion: 1, expectedRevision, layout: { objects }, ...extras },
        session,
      )
    await t.test(
      "valid save and durable read; user_id body spoofing is ignored",
      async () => {
        const saved = await save([frame], 0, cookie, {
          user_id: b.body.user.id,
        })
        assert.equal(saved.status, 200)
        assert.equal(saved.body.revision, 1)
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, cookie)).body.layout
            .objects,
          [frame],
        )
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, b.cookie)).body.layout
            .objects,
          [],
        )
      },
    )
    await t.test(
      "foreign artwork, missing artwork and invalid geometry rejected without changing revision",
      async () => {
        for (const bad of [
          { ...frame, artworkDrawingId: 4 },
          { ...frame, artworkDrawingId: 99999 },
          { ...frame, position: { x: 99, y: 2, z: 0 } },
          { ...frame, rotation: Math.PI },
        ]) {
          assert.equal((await save([bad], 1)).status, 400)
        }
        assert.equal(
          (await save([frame, { ...frame, id: "overlap" }], 1)).status,
          400,
        )
        assert.equal(
          (await call("/api/myroom", "GET", undefined, cookie)).body.revision,
          1,
        )
      },
    )
    await t.test(
      "stale and simultaneous updates do not silently overwrite",
      async () => {
        assert.equal((await save([], 0)).status, 409)
        const results = await Promise.all([save([frame], 1), save([], 1)])
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
      },
    )
    await t.test(
      "drawingId binding follows new representative image without changing records policy",
      async () => {
        const before = (
          await call("/api/collection", "GET", undefined, cookie)
        ).body.creatures.find((c) => c.drawingId === 2).imageKey
        assert.equal((await submit(2, 99)).body.isBest, true)
        const after = (
          await call("/api/collection", "GET", undefined, cookie)
        ).body.creatures.find((c) => c.drawingId === 2).imageKey
        assert.notEqual(after, before)
        const current = (await call("/api/myroom", "GET", undefined, cookie))
          .body
        assert.equal((await save([frame], current.revision)).status, 200)
        const layout = (await call("/api/myroom", "GET", undefined, cookie))
          .body.layout
        assert.equal(layout.objects[0].artworkDrawingId, 2)
        assert.ok(!JSON.stringify(layout).includes("imageKey"))
        assert.equal(
          (await fetch(new URL(`/uploads/${after}`, base))).status,
          200,
        )
      },
    )
    await t.test(
      "existing collection, drawings, leaderboard, drafts and brushes still work",
      async () => {
        assert.ok((await call("/api/drawings")).body.drawings.length > 0)
        assert.ok(
          (await call("/api/leaderboard?drawingId=2", "GET", undefined, cookie))
            .body.top.length > 0,
        )
        assert.equal(
          (
            await call(
              "/api/drafts/character",
              "PUT",
              {
                strokes: [
                  {
                    type: "line",
                    points: [
                      [1, 1],
                      [2, 2],
                    ],
                  },
                ],
                name: "test",
              },
              cookie,
            )
          ).status,
          200,
        )
        assert.equal(
          (await call("/api/drafts/character", "GET", undefined, cookie)).body
            .draft.strokes.length,
          1,
        )
        const brushes = await call("/api/brushes", "GET", undefined, cookie)
        assert.equal(brushes.status, 200)
        assert.ok(brushes.body.brushes.length)
        const brush = brushes.body.brushes.find(
          (b) => !b.owned && b.price <= brushes.body.cells,
        )
        if (brush) {
          const bought = await call(
            `/api/brushes/${brush.slug}/purchase`,
            "POST",
            {},
            cookie,
          )
          assert.equal(bought.status, 201)
          assert.ok(
            bought.body.brushes.find((b) => b.slug === brush.slug).owned,
          )
        }
      },
    )
  },
)
