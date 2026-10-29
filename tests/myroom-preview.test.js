import test from "node:test"
import assert from "node:assert/strict"
import {
  createPreviewSource,
  PREVIEW_STORAGE_KEY,
  previewArtworks,
} from "../src/features/myroom/preview/data.ts"

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}
const frame = (artworkDrawingId = previewArtworks[0].drawingId) => ({
  objects: [
    {
      id: "preview-frame",
      type: "frame",
      wall: "back",
      position: { x: 0, y: 2.5, z: 11.88 },
      rotation: 0,
      scale: 1,
      artworkDrawingId,
    },
  ],
})

test("preview saves/reloads locally without network, DB or user credentials", (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Preview must never fetch")
  })
  const storage = memoryStorage()
  storage.setItem("existing-user-setting", "keep")
  const source = createPreviewSource(storage)
  assert.deepEqual(source.load().layout, { objects: [] })
  const saved = source.save(frame(), 0)
  assert.equal(saved.revision, 1)
  assert.deepEqual(createPreviewSource(storage).load(), saved)
  assert.equal(storage.getItem("existing-user-setting"), "keep")
  assert.equal(globalThis.fetch.mock.calls.length, 0)
  assert.ok(
    source.artworks.every(
      (a) =>
        a.name.startsWith("Preview") &&
        a.imageKey === null &&
        a.previewImageUrl.startsWith("data:image/svg+xml"),
    ),
  )
})

test("stale preview save preserves the newer local layout", () => {
  const storage = memoryStorage()
  const a = createPreviewSource(storage),
    b = createPreviewSource(storage)
  const saved = a.save(frame(), 0)
  assert.throws(
    () => b.save({ objects: [] }, 0),
    (e) => e.status === 409,
  )
  assert.deepEqual(b.load(), saved)
})

test("rejects real artwork IDs and invalid geometry without replacing stored data", () => {
  const storage = memoryStorage(),
    source = createPreviewSource(storage)
  source.save(frame(), 0)
  const before = storage.getItem(PREVIEW_STORAGE_KEY)
  assert.throws(() => source.save(frame(4), 1), /샘플 작품/)
  const invalid = frame()
  invalid.objects[0].position.y = 0
  assert.throws(() => source.save(invalid, 1))
  assert.equal(storage.getItem(PREVIEW_STORAGE_KEY), before)
})

test("corrupt/version-mismatched local state remains available for recovery", () => {
  for (const raw of [
    "broken JSON",
    JSON.stringify({ schemaVersion: 2 }),
    JSON.stringify({
      schemaVersion: 1,
      revision: 1,
      updatedAt: "today",
      layout: frame(4),
    }),
  ]) {
    const storage = memoryStorage()
    storage.setItem(PREVIEW_STORAGE_KEY, raw)
    const source = createPreviewSource(storage)
    assert.throws(() => source.load(), /덮어쓰지 않았어요/)
    assert.throws(() => source.save({ objects: [] }, 0))
    assert.equal(storage.getItem(PREVIEW_STORAGE_KEY), raw)
  }
})

test("storage quota/permission failure is reported instead of claiming success", () => {
  const source = createPreviewSource({
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError")
    },
  })
  assert.throws(() => source.save(frame(), 0), /저장하지 못했어요/)
  assert.equal(source.load().revision, 0)
})
