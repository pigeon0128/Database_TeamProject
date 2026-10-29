import test from "node:test"
import assert from "node:assert/strict"
import {
  ROOM,
  validateLayout,
  placementError,
  wallRotation,
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
