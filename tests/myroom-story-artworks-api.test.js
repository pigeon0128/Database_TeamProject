// Use only a disposable local API/DB, just like the existing myroom API regression suite.
import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

test(
  "story and creature artwork exhibition uses owned, saved representative images",
  { skip: !process.env.MYROOM_TEST_URL },
  async (t) => {
    const base = new URL(process.env.MYROOM_TEST_URL)
    assert.ok(["127.0.0.1", "localhost"].includes(base.hostname))
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
    const register = (prefix) =>
      call("/api/auth/register", "POST", {
        loginId: `${prefix}_${Date.now().toString(36)}`,
        password: randomUUID(),
      })
    const a = await register("story_a"),
      b = await register("story_b")
    assert.equal(a.status, 201)
    assert.equal(b.status, 201)
    const drawings = (await call("/api/drawings")).body.drawings
    const storyId = drawings.find((d) => d.category === null).id
    const creatureId = drawings.find((d) => d.category !== null).id
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="
    const submit = (
      drawingId,
      score,
      cookie = a.cookie,
      artwork = image,
      durationMs = 5000,
    ) =>
      call(
        "/api/play-records",
        "POST",
        { drawingId, similarityScore: score, durationMs, image: artwork },
        cookie,
      )
    const list = (cookie = a.cookie) =>
      call("/api/myroom/artworks", "GET", undefined, cookie)
    const frame = {
      id: "story-frame",
      type: "frame",
      wall: "back",
      position: { x: -2, y: 2.5, z: 11.88 },
      rotation: 0,
      scale: 1,
      artworkDrawingId: storyId,
    }
    const easel = {
      id: "story-easel",
      type: "easel",
      position: { x: 3, y: 0, z: 2 },
      rotation: Math.PI / 2,
      scale: 1,
      artworkDrawingId: storyId,
    }
    const save = (objects, expectedRevision) =>
      call(
        "/api/myroom",
        "PUT",
        { schemaVersion: 1, expectedRevision, layout: { objects } },
        a.cookie,
      )
    let initialStory
    await t.test(
      "auth, foreign-only completion, image-less record and nonexistent ID are rejected",
      async () => {
        assert.equal((await call("/api/myroom/artworks")).status, 401)
        assert.deepEqual((await list()).body.artworks, [])
        assert.equal((await submit(storyId, 75, b.cookie)).status, 201)
        assert.equal((await save([frame], 0)).status, 400)
        assert.equal((await submit(storyId, 1, a.cookie, null)).status, 201)
        assert.deepEqual((await list()).body.artworks, [])
        assert.equal((await save([easel], 0)).status, 400)
        assert.equal(
          (await save([{ ...frame, artworkDrawingId: 999999999 }], 0)).status,
          400,
        )
        assert.equal(
          (await call("/api/myroom", "GET", undefined, a.cookie)).body.revision,
          0,
        )
      },
    )
    await t.test(
      "the list classifies both kinds and matches the existing creature representative",
      async () => {
        initialStory = await submit(storyId, 90)
        assert.equal(initialStory.status, 201)
        assert.equal((await submit(creatureId, 70)).status, 201)
        const artworks = (await list()).body.artworks
        assert.equal(artworks.length, 2)
        const story = artworks.find((a) => a.drawingId === storyId)
        assert.equal(story.kind, "story")
        assert.equal(story.slug, null)
        assert.equal(story.imageKey, initialStory.body.imageKey)
        assert.equal(
          (await fetch(new URL(`/uploads/${story.imageKey}`, base))).status,
          200,
        )
        const creature = artworks.find((a) => a.drawingId === creatureId)
        assert.equal(creature.kind, "creature")
        assert.ok(creature.slug)
        const old = (
          await call("/api/collection", "GET", undefined, a.cookie)
        ).body.creatures.find((a) => a.drawingId === creatureId)
        assert.equal(creature.imageKey, old.imageKey)
        assert.equal((await list(b.cookie)).body.artworks.length, 1)
      },
    )
    await t.test(
      "story frames/easels and creature frames persist alongside colored storage",
      async () => {
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        const stored = await call(
          "/api/myroom/storage",
          "POST",
          {
            name: "story-suite",
            sourceModel: "sphere",
            thumbnail: image,
            spec: {
              v: 1,
              bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
              group: identity,
              parts: [
                {
                  shape: { kind: "sphere", radius: 1 },
                  matrix: identity,
                  color: "#6b947b",
                },
              ],
            },
          },
          a.cookie,
        )
        assert.equal(stored.status, 201)
        const creature = {
          ...frame,
          id: "creature-frame",
          position: { ...frame.position, x: 2 },
          artworkDrawingId: creatureId,
        }
        const colored = {
          id: "colored",
          type: "colored",
          position: { x: -3, y: 0, z: 2 },
          rotation: 0,
          scale: 1.5,
          storedObjectId: stored.body.id,
        }
        const objects = [frame, easel, creature, colored]
        const result = await save(objects, 0)
        assert.equal(result.status, 200)
        assert.equal(result.body.revision, 1)
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, a.cookie)).body.layout
            .objects,
          objects,
        )
        assert.equal((await save([], 0)).status, 409)
        assert.deepEqual(
          (await call("/api/myroom", "GET", undefined, b.cookie)).body.layout
            .objects,
          [],
        )
      },
    )
    await t.test(
      "score, duration and earlier completion ties follow the representative policy",
      async () => {
        assert.equal((await submit(storyId, 50)).body.isBest, false)
        assert.equal(
          (await submit(storyId, 90, a.cookie, image, 6000)).body.isBest,
          false,
        )
        const faster = await submit(storyId, 90, a.cookie, image, 4000)
        assert.equal(faster.body.isBest, true)
        assert.equal(
          (await submit(storyId, 90, a.cookie, image, 4000)).body.isBest,
          false,
        )
        const selected = (await list()).body.artworks.find(
          (a) => a.drawingId === storyId,
        )
        assert.equal(selected.imageKey, faster.body.imageKey)
        assert.notEqual(selected.imageKey, initialStory.body.imageKey)
        const leaderboard = await call(
          `/api/leaderboard?drawingId=${storyId}`,
          "GET",
          undefined,
          a.cookie,
        )
        assert.equal(selected.imageKey, leaderboard.body.me.imageKey)
        const room = (await call("/api/myroom", "GET", undefined, a.cookie))
          .body
        assert.equal(room.layout.objects[0].artworkDrawingId, storyId)
        assert.equal(room.layout.objects[1].artworkDrawingId, storyId)
        assert.equal(room.revision, 1)
      },
    )
  },
)
