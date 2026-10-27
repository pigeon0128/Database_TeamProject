import test from "node:test"
import assert from "node:assert/strict"
import {
  advancePlayer,
  cameraRelativeInput,
  cameraRoomLimit,
  isWalkable,
  moveWithCollisions,
  nearestOpenPosition,
  PLAYER_RADIUS,
} from "../src/features/myroom/player/movement.ts"

const table = (rotation = 0) => ({
  id: "obstacle",
  type: "table",
  position: { x: 0, y: 0, z: 0 },
  rotation,
  scale: 1,
})
test("movement is camera-relative, diagonal-normalized, and opposite keys cancel", () => {
  const forward = cameraRelativeInput(0, 1, -Math.PI / 2)
  assert.ok(Math.abs(forward.x) < 1e-10 && Math.abs(forward.z - 1) < 1e-10)
  const turned = cameraRelativeInput(0, 1, 0)
  assert.deepEqual(turned, { x: -1, z: 0 })
  const diagonal = cameraRelativeInput(1, 1, 0)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-10)
  assert.deepEqual(cameraRelativeInput(0, 0, 4), { x: 0, z: 0 })
})

test("frame-time movement accelerates/stops smoothly and agrees at 30/144 FPS", () => {
  function simulate(fps) {
    let state = { position: { x: 0, z: -6 }, velocity: { x: 0, z: 0 } }
    for (let i = 0; i < fps; i++)
      state = advancePlayer(
        state.position,
        state.velocity,
        { x: 0, z: 1 },
        1 / fps,
        [],
      )
    return state
  }
  const a = simulate(30),
    b = simulate(144)
  assert.ok(Math.abs(a.position.z - b.position.z) < 0.06)
  const first = advancePlayer(
    { x: 0, z: 0 },
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    1 / 60,
    [],
  )
  assert.ok(first.velocity.z > 0 && first.velocity.z < 1)
  const stop = advancePlayer(a.position, a.velocity, { x: 0, z: 0 }, 1 / 60, [])
  assert.ok(stop.velocity.z > 0 && stop.velocity.z < a.velocity.z)
  const paused = advancePlayer(a.position, a.velocity, { x: 0, z: 1 }, 100, [])
  assert.ok(paused.position.z - a.position.z < 0.17)
})

test("swept small steps block walls and furniture, allow sliding, respect rotated footprints", () => {
  const wall = moveWithCollisions({ x: 0, z: 0 }, { x: 100, z: 2 }, [])
  assert.ok(wall.x < 12 - PLAYER_RADIUS && wall.z > 1.9)
  for (const rotation of [0, Math.PI / 2]) {
    const obstacle = table(rotation)
    const stopped = moveWithCollisions({ x: 0, z: -5 }, { x: 0, z: 20 }, [
      obstacle,
    ])
    assert.ok(stopped.z < -(rotation ? 0.9 : 0.5) - PLAYER_RADIUS)
    assert.ok(isWalkable(stopped, [obstacle]))
  }
  assert.equal(isWalkable({ x: 1.1, z: 0 }, [table()]), false)
  assert.equal(isWalkable({ x: 1.1, z: 0 }, [table(Math.PI / 2)]), true)
  const sliding = moveWithCollisions({ x: -2, z: -0.1 }, { x: 2, z: 3 }, [
    table(),
  ])
  assert.ok(sliding.z > 2 && isWalkable(sliding, [table()]))
})

test("restored or newly placed furniture cannot trap the avatar inside it", () => {
  const free = nearestOpenPosition({ x: 0, z: 0 }, [table()])
  assert.ok(isWalkable(free, [table()]))
  assert.notDeepEqual(free, { x: 0, z: 0 })
  assert.deepEqual(nearestOpenPosition({ x: 5, z: 2 }, [table()]), {
    x: 5,
    z: 2,
  })
})

test("third-person orbit stays within all room walls/height near edges and corners", () => {
  for (const target of [
    { x: 0, y: 0.95, z: 0 },
    { x: 11.5, y: 0.95, z: -11.5 },
    { x: -11.5, y: 0.95, z: 11.5 },
  ]) {
    for (let alpha = -Math.PI; alpha < Math.PI; alpha += 0.1)
      for (const beta of [0.65, 1.13, 1.42]) {
        const radius = cameraRoomLimit(target, alpha, beta, 9)
        assert.ok(
          Math.abs(target.x + radius * Math.cos(alpha) * Math.sin(beta)) <=
            11.781,
        )
        assert.ok(
          Math.abs(target.z + radius * Math.sin(alpha) * Math.sin(beta)) <=
            11.781,
        )
        assert.ok(target.y + radius * Math.cos(beta) <= 4.801)
      }
  }
})
