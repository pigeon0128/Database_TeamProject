import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import type { ArcRotateCameraPointersInput } from "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import type { Scene } from "@babylonjs/core/scene"
import type { RoomMode, RoomObject } from "../types"
import { createAvatar } from "./avatar"
import {
  advancePlayer,
  cameraRelativeInput,
  cameraRoomLimit,
  nearestOpenPosition,
} from "./movement"

export function createPlayerController(
  scene: Scene,
  camera: ArcRotateCamera,
  canvas: HTMLCanvasElement,
) {
  const avatar = createAvatar(scene)
  let position = { x: 0, z: 0 },
    velocity = { x: 0, z: 0 }
  let objects: RoomObject[] = [],
    mode: RoomMode = "explore",
    blocked = true
  let zoom = 6.8
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
  const pointer = camera.inputs.attached
    .pointers as ArcRotateCameraPointersInput
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput")
  let decorateCamera = {
    alpha: -Math.PI / 2,
    beta: Math.PI / 3,
    radius: 13,
    target: Vector3.Zero(),
  }
  let exploreAngles = { alpha: -Math.PI / 2, beta: 1.13 }
  const clearKeys = () => {
    keys.clear()
    velocity = { x: 0, z: 0 }
  }
  const uiFocus = (e: FocusEvent) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest(
        'input,textarea,select,button,[contenteditable="true"],[role="dialog"]',
      )
    )
      clearKeys()
  }
  const keydown = (e: KeyboardEvent) => {
    if (
      !movementKeys.includes(e.code) ||
      mode !== "explore" ||
      blocked ||
      document.hidden
    )
      return
    if (
      e.target instanceof HTMLElement &&
      e.target.closest(
        'input,textarea,select,button,[contenteditable="true"],[role="dialog"]',
      )
    )
      return
    e.preventDefault()
    keys.add(e.code)
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
    if (mode === "explore")
      zoom = Math.max(
        2,
        Math.min(
          9,
          zoom * Math.exp(Math.max(-0.3, Math.min(0.3, delta * 0.001))),
        ),
      )
    else
      camera.radius = Math.max(
        5,
        Math.min(
          18,
          camera.radius *
            Math.exp(Math.max(-0.3, Math.min(0.3, delta * 0.001))),
        ),
      )
  }
  window.addEventListener("keydown", keydown)
  window.addEventListener("keyup", keyup)
  window.addEventListener("blur", clearKeys)
  document.addEventListener("visibilitychange", clearKeys)
  document.addEventListener("focusin", uiFocus)
  canvas.addEventListener("wheel", wheel, { passive: false })
  function resetCamera() {
    clearKeys()
    camera.inertialAlphaOffset =
      camera.inertialBetaOffset =
      camera.inertialRadiusOffset =
        0
    camera.alpha = -Math.PI / 2
    camera.beta = mode === "explore" ? 1.13 : Math.PI / 3
    zoom = 6.8
    camera.setTarget(
      mode === "explore"
        ? new Vector3(position.x, 0.95, position.z)
        : Vector3.Zero(),
      false,
      true,
      true,
    )
    camera.radius =
      mode === "explore"
        ? cameraRoomLimit(camera.target, camera.alpha, camera.beta, zoom)
        : 13
  }
  function controls() {
    camera.detachControl()
    pointer.buttons = mode === "explore" ? [2] : [0, 2]
    camera.lowerBetaLimit = mode === "explore" ? 0.65 : 0.25
    camera.upperBetaLimit = mode === "explore" ? 1.42 : Math.PI / 2.15
    camera.lowerRadiusLimit = mode === "explore" ? 0.25 : 5
    camera.upperRadiusLimit = mode === "explore" ? 9 : 18
    if (!blocked) camera.attachControl(canvas, true)
  }
  resetCamera()
  controls()
  return {
    pieces: avatar.pieces,
    syncObjects(next: RoomObject[]) {
      objects = next
      position = nearestOpenPosition(position, objects)
      avatar.root.position.set(position.x, 0, position.z)
    },
    setInteraction(nextMode: RoomMode, nextBlocked: boolean) {
      if (mode !== nextMode) {
        if (mode === "decorate")
          decorateCamera = {
            alpha: camera.alpha,
            beta: camera.beta,
            radius: camera.radius,
            target: camera.target.clone(),
          }
        else exploreAngles = { alpha: camera.alpha, beta: camera.beta }
        mode = nextMode
        camera.inertialAlphaOffset =
          camera.inertialBetaOffset =
          camera.inertialRadiusOffset =
            0
        if (mode === "decorate") {
          camera.alpha = decorateCamera.alpha
          camera.beta = decorateCamera.beta
          camera.radius = decorateCamera.radius
          camera.setTarget(decorateCamera.target.clone(), false, true, true)
        } else {
          camera.alpha = exploreAngles.alpha
          camera.beta = exploreAngles.beta
          camera.setTarget(
            new Vector3(position.x, 0.95, position.z),
            false,
            true,
            true,
          )
          camera.radius = cameraRoomLimit(
            camera.target,
            camera.alpha,
            camera.beta,
            zoom,
          )
        }
        clearKeys()
      }
      if (blocked !== nextBlocked) clearKeys()
      blocked = nextBlocked
      controls()
    },
    update(dt: number) {
      const seconds = Math.max(0, Math.min(dt, 0.05))
      const before = { ...position }
      if (mode === "explore" && !blocked && !document.hidden) {
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
      const speed = seconds
        ? Math.hypot(position.x - before.x, position.z - before.z) / seconds
        : 0
      avatar.root.position.set(position.x, 0, position.z)
      if (speed > 0.02) {
        const desired = Math.atan2(position.x - before.x, position.z - before.z)
        const difference = Math.atan2(
          Math.sin(desired - avatar.root.rotation.y),
          Math.cos(desired - avatar.root.rotation.y),
        )
        avatar.root.rotation.y += difference * (1 - Math.exp(-14 * seconds))
      }
      avatar.animate(seconds, speed)
      if (mode === "explore") {
        const target = new Vector3(position.x, 0.95, position.z)
        camera.setTarget(
          Vector3.Lerp(camera.target, target, 1 - Math.exp(-10 * seconds)),
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
      }
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
