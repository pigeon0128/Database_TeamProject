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
      "floor easels share ownership checks, revision and durable JSONB storage with frames",
      async () => {
        const current = (await call("/api/myroom", "GET", undefined, cookie))
          .body
        const easel = {
          id: "floor-art",
          type: "easel",
          position: { x: 2, y: 0, z: 1 },
          rotation: Math.PI / 2,
          scale: 1,
          artworkDrawingId: 3,
        }
        for (const artworkDrawingId of [4, 99999, 900001])
          assert.equal(
            (
              await save(
                [easel].map((o) => ({ ...o, artworkDrawingId })),
                current.revision,
              )
            ).status,
            400,
          )
        assert.equal((await save([frame, easel], current.revision)).status, 200)
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, cookie)).body.layout
            .objects,
          [frame, easel],
        )
        assert.equal((await save([], current.revision)).status, 409)
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, b.cookie)).body.layout
            .objects,
          [],
        )
        const moved = {
          ...easel,
          position: { x: -3, y: 0, z: 2 },
          rotation: Math.PI,
          artworkDrawingId: 2,
        }
        assert.equal(
          (await save([frame, moved], current.revision + 1)).status,
          200,
        )
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, cookie)).body.layout
            .objects,
          [frame, moved],
        )
        assert.equal((await save([frame], current.revision + 2)).status, 200)
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, cookie)).body.layout
            .objects,
          [frame],
        )
      },
    )
    await t.test(
      "easel artwork and colored storage ownership/resize/revisions round-trip together",
      async () => {
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        const spec = {
          v: 1,
          bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
          group: identity,
          parts: [
            {
              shape: { kind: "sphere", radius: 1 },
              matrix: identity,
              color: "#f25c54",
            },
          ],
        }
        const body = {
          name: "integration-colored",
          sourceModel: "sphere",
          thumbnail: image,
          spec,
        }
        assert.equal(
          (await call("/api/myroom/storage", "POST", body)).status,
          401,
        )
        const own = await call("/api/myroom/storage", "POST", body, cookie)
        const foreign = await call(
          "/api/myroom/storage",
          "POST",
          body,
          b.cookie,
        )
        assert.equal(own.status, 201)
        assert.equal(foreign.status, 201)
        assert.deepEqual(
          (
            await call(
              `/api/myroom/storage/${own.body.id}`,
              "GET",
              undefined,
              cookie,
            )
          ).body.spec,
          spec,
        )
        assert.equal(
          (
            await call(
              `/api/myroom/storage/${foreign.body.id}`,
              "GET",
              undefined,
              cookie,
            )
          ).status,
          404,
        )
        const easel = {
          id: "paired-easel",
          type: "easel",
          position: { x: 3, y: 0, z: 3 },
          rotation: Math.PI / 2,
          scale: 1,
          artworkDrawingId: 2,
        }
        const painted = {
          id: "paired-colored",
          type: "colored",
          position: { x: -3, y: 0, z: 3 },
          rotation: 0,
          scale: 1.4,
          storedObjectId: own.body.id,
        }
        const current = (await call("/api/myroom", "GET", undefined, cookie))
          .body
        for (const bad of [
          { ...painted, storedObjectId: foreign.body.id },
          { ...painted, storedObjectId: 999999999 },
          { ...painted, position: { ...easel.position } },
          { ...painted, scale: 3 },
          { ...painted, artworkDrawingId: 2 },
          { ...easel, artworkDrawingId: 4 },
        ])
          assert.equal(
            (
              await save(
                bad.id === easel.id
                  ? [frame, bad, painted]
                  : [frame, easel, bad],
                current.revision,
              )
            ).status,
            400,
          )
        assert.equal(
          (await save([frame, easel, painted], current.revision)).status,
          200,
        )
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, cookie)).body.layout
            .objects,
          [frame, easel, painted],
        )
        assert.equal(
          (
            await call(
              `/api/myroom/storage/${own.body.id}`,
              "DELETE",
              undefined,
              cookie,
            )
          ).status,
          409,
        )
        const changed = [
          { ...easel, artworkDrawingId: 3 },
          { ...painted, scale: 2.5, rotation: Math.PI / 2 },
        ]
        assert.equal(
          (await save([frame, ...changed], current.revision + 1)).status,
          200,
        )
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, cookie)).body.layout
            .objects,
          [frame, ...changed],
        )
        assert.equal((await save([], current.revision + 1)).status, 409)
        assert.equal(
          (await save([frame, changed[0]], current.revision + 2)).status,
          200,
        )
        assert.equal(
          (
            await call(
              `/api/myroom/storage/${own.body.id}`,
              "DELETE",
              undefined,
              cookie,
            )
          ).status,
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
