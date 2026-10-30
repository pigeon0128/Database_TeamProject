import test from "node:test"
import assert from "node:assert/strict"
import {
  ROOM,
  validateLayout,
  placementError,
  wallRotation,
  footprint,
  supportsArtwork,
} from "../shared/myroom.js"

const frame = (id = "frame-a", wall = "back") => ({
  id,
  type: "frame",
  position: {
    x:
      wall === "left"
        ? -ROOM.halfWidth + 0.12
        : wall === "right"
          ? ROOM.halfWidth - 0.12
          : 0,
    y: 2.5,
    z:
      wall === "back"
        ? ROOM.halfDepth - 0.12
        : wall === "front"
          ? -ROOM.halfDepth + 0.12
          : 0,
  },
  rotation: wallRotation(wall),
  scale: 1,
  wall,
})
const chair = (id = "chair-a") => ({
  id,
  type: "chair",
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  scale: 1,
})

test("easels accept artwork on the floor and preserve existing v1 layouts", () => {
  const old = {
    objects: [frame(), { ...chair(), position: { x: 3, y: 0, z: 0 } }],
  }
  assert.deepEqual(validateLayout(old), old)
  const easel = { ...chair("easel-a"), type: "easel", artworkDrawingId: 2 }
  assert.deepEqual(
    validateLayout({ objects: [...old.objects, easel] }).objects.at(-1),
    easel,
  )
  assert.equal(supportsArtwork("frame"), true)
  assert.equal(supportsArtwork("easel"), true)
  for (const type of ["chair", "table", "plant"])
    assert.throws(
      () => validateLayout({ objects: [{ ...easel, type }] }),
      /작품/,
    )
  for (const artworkDrawingId of [0, -1, "2", 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () => validateLayout({ objects: [{ ...easel, artworkDrawingId }] }),
      /작품/,
    )
  for (const invalid of [
    { ...easel, wall: "back" },
    { ...easel, position: { x: 0, y: 1, z: 0 } },
    { ...easel, rotation: Math.PI / 4 },
  ])
    assert.throws(() => validateLayout({ objects: [invalid] }))
})

test("easel footprint rotates, bounds placement, and blocks every floor furniture type", () => {
  const easel = { ...chair("easel-a"), type: "easel" }
  assert.deepEqual(footprint(easel), { x: 0.65, z: 0.5 })
  assert.deepEqual(footprint({ ...easel, rotation: Math.PI / 2 }), {
    x: 0.5,
    z: 0.65,
  })
  const edge = { ...easel, position: { x: 11.25, y: 0, z: 0 } }
  assert.ok(placementError(edge))
  assert.equal(placementError({ ...edge, rotation: Math.PI / 2 }), null)
  for (const type of ["chair", "table", "plant", "easel"])
    assert.throws(
      () => validateLayout({ objects: [easel, { ...chair("other"), type }] }),
      /겹쳐/,
    )
})

test("all four wall bases face into the room and round-trip through the contract", () => {
  for (const wall of ["back", "left", "right", "front"])
    assert.deepEqual(validateLayout({ objects: [frame("a", wall)] }).objects, [
      frame("a", wall),
    ])
})
test("rejects floating/reversed/over-edge frames and intersecting frames", () => {
  for (const mutate of [
    (o) => o.position.z--,
    (o) => (o.position.y = 0),
    (o) => (o.rotation = Math.PI),
    (o) => (o.position.x = ROOM.halfWidth),
  ]) {
    const o = frame()
    mutate(o)
    assert.throws(() => validateLayout({ objects: [o] }))
  }
  assert.throws(
    () => validateLayout({ objects: [frame("a"), frame("b")] }),
    /겹쳐/,
  )
})
test("floor footprint rotates with furniture and cannot overlap or leave the room", () => {
  const table = {
    ...chair(),
    type: "table",
    rotation: Math.PI / 2,
    position: { x: ROOM.halfWidth - 0.8, y: 0, z: 0 },
  }
  assert.equal(placementError(table), null)
  assert.ok(placementError({ ...table, rotation: 0 }))
  assert.throws(
    () => validateLayout({ objects: [chair("a"), chair("b")] }),
    /겹쳐/,
  )
  assert.throws(() =>
    validateLayout({
      objects: [{ ...chair(), position: { x: 0, y: 1, z: 0 } }],
    }),
  )
})
test("rejects invalid numbers, duplicate IDs, unbounded collections and executable/URL fields", () => {
  for (const object of [
    { ...chair(), type: "__proto__" },
    { ...chair(), scale: 20 },
    { ...frame(), artworkDrawingId: "2" },
    { ...chair(), position: { x: NaN, y: 0, z: 0 } },
    { ...chair(), modelUrl: "https://example.com/model.glb" },
  ]) {
    assert.throws(() => validateLayout({ objects: [object] }))
  }
  assert.throws(() =>
    validateLayout({
      objects: [chair("a"), { ...chair("a"), position: { x: 3, y: 0, z: 0 } }],
    }),
  )
  assert.throws(() =>
    validateLayout({
      objects: Array.from({ length: 41 }, (_, i) => chair(String(i))),
    }),
  )
})
