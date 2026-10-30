import test from "node:test"
import assert from "node:assert/strict"
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js"
import { Scene } from "@babylonjs/core/scene.js"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js"
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js"
import { configureRoomPointerInput } from "../src/features/myroom/player/cameraInput.ts"
import {
  advanceJump,
  JUMP_SPEED,
  advancePlayer,
  cameraRelativeInput,
  cameraRoomLimit,
  isWalkable,
  moveWithCollisions,
  nearestOpenPosition,
  PLAYER_RADIUS,
} from "../src/features/myroom/player/movement.ts"

test("real Babylon right-button pointer movement drives orbit; left click stays available for objects", () => {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  try {
    const camera = new ArcRotateCamera(
      "input-regression",
      0,
      1,
      8,
      Vector3.Zero(),
      scene,
    )
    configureRoomPointerInput(camera)
    configureRoomPointerInput(camera) // repeated panel/placement transitions must not duplicate bindings
    const mapper = camera.movement.input
    assert.equal(
      mapper.resolveInteraction("pointer", { button: 2, modifiers: {} })
        ?.interaction,
      "rotate",
    )
    assert.equal(
      mapper.resolveInteraction("pointer", { button: 0, modifiers: {} }),
      null,
    )
    assert.equal(
      mapper.resolveInteraction("pointer", { button: 1, modifiers: {} }),
      null,
    )
    const pointer = camera.inputs.attached.pointers
    pointer.onButtonDown({
      button: 2,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    })
    pointer.onTouch(null, 120, 40)
    assert.notEqual(camera.movement.rotationAccumulatedPixels.x, 0)
    const before = camera.movement.rotationAccumulatedPixels.x
    pointer.onButtonUp({ button: 2 })
    pointer.onButtonDown({
      button: 0,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    })
    pointer.onTouch(null, 120, 40)
    assert.equal(camera.movement.rotationAccumulatedPixels.x, before)
    assert.equal(
      mapper.inputMap.filter((e) => e.source === "pointer").length,
      1,
    )
  } finally {
    scene.dispose()
    engine.dispose()
  }
})

test("jump rises, passes its apex, falls and lands at exactly floor height", () => {
  let state = { height: 0, verticalSpeed: 0, grounded: true }
  state = advanceJump(state, true, 1 / 60)
  assert.equal(state.grounded, false)
  assert.ok(state.height > 0 && state.verticalSpeed < JUMP_SPEED)
  let maximum = state.height,
    falling = false
  for (let i = 0; i < 90; i++) {
    state = advanceJump(state, false, 1 / 60)
    maximum = Math.max(maximum, state.height)
    if (!state.grounded && state.verticalSpeed < 0) falling = true
    assert.ok(state.height >= 0)
  }
  assert.ok(maximum > 0.8 && maximum < 0.86 && falling)
  assert.deepEqual(state, { height: 0, verticalSpeed: 0, grounded: true })
})

test("airborne jump attempts never reset upward velocity", () => {
  const airborne = { height: 0.5, verticalSpeed: -1, grounded: false }
  assert.deepEqual(
    advanceJump(airborne, true, 1 / 60),
    advanceJump(airborne, false, 1 / 60),
  )
  assert.deepEqual(
    advanceJump({ height: 0, verticalSpeed: 0, grounded: true }, false, 1 / 60),
    { height: 0, verticalSpeed: 0, grounded: true },
  )
})

test("analytic jump agrees at 30/60/144 FPS and bounds long frame pauses", () => {
  const atHalfSecond = []
  for (const fps of [30, 60, 144]) {
    let state = { height: 0, verticalSpeed: 0, grounded: true }
    for (let i = 0; i < fps; i++) {
      state = advanceJump(state, i === 0, 1 / fps)
      if (i + 1 === fps / 2) atHalfSecond.push(state.height)
    }
    assert.equal(state.grounded, true)
    assert.equal(state.height, 0)
  }
  assert.ok(Math.max(...atHalfSecond) - Math.min(...atHalfSecond) < 1e-10)
  const paused = advanceJump(
    { height: 0, verticalSpeed: 0, grounded: true },
    true,
    100,
  )
  assert.ok(paused.height > 0 && paused.height < 0.23)
})

const table = (rotation = 0) => ({
  id: "obstacle",
  type: "table",
  position: { x: 0, y: 0, z: 0 },
  rotation,
  scale: 1,
})

test("floor easel blocks the player before and after quarter-turn and relocates an overlapping spawn", () => {
  for (const rotation of [0, Math.PI / 2]) {
    const easel = { ...table(rotation), type: "easel" }
    const stopped = moveWithCollisions({ x: 0, z: -4 }, { x: 0, z: 10 }, [
      easel,
    ])
    assert.ok(stopped.z < -(rotation ? 0.65 : 0.5) - PLAYER_RADIUS)
    assert.ok(isWalkable(stopped, [easel]))
    assert.ok(isWalkable(nearestOpenPosition({ x: 0, z: 0 }, [easel]), [easel]))
  }
})

test("resized colored objects use their scaled footprint for player collision beside easels", () => {
  const painted = { ...table(), type: "colored", storedObjectId: 1, scale: 2.5 }
  const stopped = moveWithCollisions({ x: 0, z: -4 }, { x: 0, z: 10 }, [
    painted,
  ])
  assert.ok(stopped.z < -0.75 - PLAYER_RADIUS)
  assert.ok(isWalkable(stopped, [painted]))
  assert.ok(
    isWalkable(nearestOpenPosition({ x: 0, z: 0 }, [painted]), [painted]),
  )
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
