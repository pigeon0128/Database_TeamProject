import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { ROOM } from "../../../../shared/myroom.js"
import type { Scene } from "@babylonjs/core/scene"
import type { RoomObject } from "../types"
import { createAvatar } from "./avatar"
import { configureRoomPointerInput } from "./cameraInput"
import {
  advanceJump,
  advancePlayer,
  cameraRelativeInput,
  cameraRoomLimit,
  nearestOpenPosition,
  type JumpState,
} from "./movement"

export function createPlayerController(
  scene: Scene,
  camera: ArcRotateCamera,
  canvas: HTMLCanvasElement,
  nickname: string,
) {
  const avatar = createAvatar(scene, nickname)
  let position = { x: 0, z: 0 },
    velocity = { x: 0, z: 0 }
  let jump: JumpState = { height: 0, verticalSpeed: 0, grounded: true }
  let jumpQueued = false,
    blocked = true,
    placing = false,
    zoom = 8.5
  let objects: RoomObject[] = []
  const keys = new Set<string>()
  const movementKeys = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]
  configureRoomPointerInput(camera)
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput")
  camera.lowerBetaLimit = 0.65
  camera.upperBetaLimit = 1.48
  camera.lowerRadiusLimit = 0.25
  camera.upperRadiusLimit = 18
  const clearKeys = () => {
    keys.clear()
    jumpQueued = false
    velocity = { x: 0, z: 0 }
  }
  const isUI = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest(
      'input,textarea,select,button,[contenteditable="true"],[role="dialog"]',
    )
  const uiFocus = (e: FocusEvent) => {
    if (isUI(e.target)) clearKeys()
  }
  const keydown = (e: KeyboardEvent) => {
    if (
      (!movementKeys.includes(e.code) && e.code !== "Space") ||
      blocked ||
      placing ||
      document.hidden ||
      isUI(e.target)
    )
      return
    e.preventDefault()
    if (e.code === "Space") {
      if (!e.repeat && jump.grounded) jumpQueued = true
    } else keys.add(e.code)
  }
  const keyup = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    if (blocked) return
    const delta =
      e.deltaY *
      (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1)
    zoom = Math.max(
      4,
      Math.min(
        18,
        zoom * Math.exp(Math.max(-0.3, Math.min(0.3, delta * 0.001))),
      ),
    )
  }
  window.addEventListener("keydown", keydown)
  window.addEventListener("keyup", keyup)
  window.addEventListener("blur", clearKeys)
  document.addEventListener("visibilitychange", clearKeys)
  document.addEventListener("focusin", uiFocus)
  canvas.addEventListener("wheel", wheel, { passive: false })
  function followTarget() {
    const margin = 0.5
    const clamp = (n: number, half: number) =>
      Math.max(-half + margin, Math.min(half - margin, n))
    // Modest look-ahead keeps the small avatar below centre while showing the room.
    return new Vector3(
      clamp(position.x - Math.cos(camera.alpha) * 1.7, ROOM.halfWidth),
      0.4 + jump.height * 0.3,
      clamp(position.z - Math.sin(camera.alpha) * 1.7, ROOM.halfDepth),
    )
  }
  function resetCamera() {
    clearKeys()
    camera.inertialAlphaOffset =
      camera.inertialBetaOffset =
      camera.inertialRadiusOffset =
        0
    camera.alpha = -Math.PI / 2
    camera.beta = 1.25
    zoom = 8.5
    camera.setTarget(followTarget(), false, true, true)
    camera.radius = cameraRoomLimit(
      camera.target,
      camera.alpha,
      camera.beta,
      zoom,
    )
  }
  resetCamera()
  return {
    pieces: avatar.pieces,
    syncObjects(next: RoomObject[]) {
      objects = next
      position = nearestOpenPosition(position, objects)
      avatar.root.position.set(position.x, jump.height, position.z)
    },
    setInteraction(nextBlocked: boolean, nextPlacing: boolean) {
      if (blocked !== nextBlocked || placing !== nextPlacing) clearKeys()
      blocked = nextBlocked
      placing = nextPlacing
      camera.detachControl()
      // Placement blocks locomotion but preserves right-drag/zoom for all walls.
      // ArcRotate defaults button 2 to panning; reserve it for orbit and move pan to middle.
      if (!blocked) camera.attachControl(true, false, 1)
      configureRoomPointerInput(camera)
    },
    update(dt: number) {
      const seconds = Math.max(0, Math.min(dt, 0.05))
      const before = { ...position }
      if (!blocked && !placing && !document.hidden) {
        const input = cameraRelativeInput(
          Number(keys.has("KeyD") || keys.has("ArrowRight")) -
            Number(keys.has("KeyA") || keys.has("ArrowLeft")),
          Number(keys.has("KeyW") || keys.has("ArrowUp")) -
            Number(keys.has("KeyS") || keys.has("ArrowDown")),
          camera.alpha,
        )
        const next = advancePlayer(position, velocity, input, seconds, objects)
        position = next.position
        velocity = next.velocity
      } else velocity = { x: 0, z: 0 }
      jump = advanceJump(jump, jumpQueued && !blocked && !placing, seconds)
      jumpQueued = false
      const speed = seconds
        ? Math.hypot(position.x - before.x, position.z - before.z) / seconds
        : 0
      avatar.root.position.set(position.x, jump.height, position.z)
      if (speed > 0.02) {
        const desired = Math.atan2(position.x - before.x, position.z - before.z)
        const difference = Math.atan2(
          Math.sin(desired - avatar.root.rotation.y),
          Math.cos(desired - avatar.root.rotation.y),
        )
        avatar.root.rotation.y += difference * (1 - Math.exp(-14 * seconds))
      }
      avatar.animate(seconds, speed, !jump.grounded, jump.verticalSpeed)
      // Freeze the projection while placing so a left click retains its exact target.
      if (!placing)
        camera.setTarget(
          Vector3.Lerp(
            camera.target,
            followTarget(),
            1 - Math.exp(-10 * seconds),
          ),
          false,
          true,
          true,
        )
      const limit = cameraRoomLimit(
        camera.target,
        camera.alpha,
        camera.beta,
        zoom,
      )
      camera.radius =
        limit < camera.radius
          ? limit
          : camera.radius +
            (limit - camera.radius) * (1 - Math.exp(-7 * seconds))
    },
    resetCamera,
    dispose() {
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("keyup", keyup)
      window.removeEventListener("blur", clearKeys)
      document.removeEventListener("visibilitychange", clearKeys)
      document.removeEventListener("focusin", uiFocus)
      canvas.removeEventListener("wheel", wheel)
      avatar.dispose()
    },
  }
}
