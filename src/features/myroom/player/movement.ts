import { ROOM, footprint } from "../../../../shared/myroom.js"
import type { RoomObject } from "../types"

export const PLAYER_RADIUS = 0.27
export const PLAYER_SPEED = 3.2
export const GRAVITY = 12
export const JUMP_SPEED = 4.5
export interface JumpState {
  height: number
  verticalSpeed: number
  grounded: boolean
}

// Analytic ballistic step: independent of display frame rate, grounded one-shot jump.
export function advanceJump(
  state: JumpState,
  jumpPressed: boolean,
  dt: number,
): JumpState {
  const seconds = Math.max(0, Math.min(dt, 0.05))
  const launched = jumpPressed && state.grounded
  if (state.grounded && !launched)
    return { height: 0, verticalSpeed: 0, grounded: true }
  const speed = launched ? JUMP_SPEED : state.verticalSpeed
  const height =
    state.height + speed * seconds - 0.5 * GRAVITY * seconds * seconds
  if (height <= 0 && speed - GRAVITY * seconds <= 0)
    return { height: 0, verticalSpeed: 0, grounded: true }
  return {
    height: Math.max(0, height),
    verticalSpeed: speed - GRAVITY * seconds,
    grounded: false,
  }
}
export interface Point {
  x: number
  z: number
}

export function isWalkable(p: Point, objects: RoomObject[]): boolean {
  const radius = PLAYER_RADIUS + 0.06
  if (
    Math.abs(p.x) > ROOM.halfWidth - radius ||
    Math.abs(p.z) > ROOM.halfDepth - radius
  )
    return false
  return objects.every((o) => {
    if (o.type === "frame") return true
    const half = footprint(o)
    const dx = Math.max(Math.abs(p.x - o.position.x) - half.x, 0)
    const dz = Math.max(Math.abs(p.z - o.position.z) - half.z, 0)
    return dx * dx + dz * dz >= radius * radius
  })
}

// Small axis-separated steps prevent tunnelling and allow sliding along walls/furniture.
export function moveWithCollisions(
  position: Point,
  delta: Point,
  objects: RoomObject[],
): Point {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(delta.x, delta.z) / (PLAYER_RADIUS / 3)),
  )
  const p = { ...position }
  for (let i = 0; i < steps; i++) {
    const x = { x: p.x + delta.x / steps, z: p.z }
    if (isWalkable(x, objects)) p.x = x.x
    const z = { x: p.x, z: p.z + delta.z / steps }
    if (isWalkable(z, objects)) p.z = z.z
  }
  return p
}

export function cameraRelativeInput(
  horizontal: number,
  forward: number,
  alpha: number,
): Point {
  const length = Math.hypot(horizontal, forward)
  if (!length) return { x: 0, z: 0 }
  return {
    x: (-Math.cos(alpha) * forward - Math.sin(alpha) * horizontal) / length,
    z: (-Math.sin(alpha) * forward + Math.cos(alpha) * horizontal) / length,
  }
}

export function advancePlayer(
  position: Point,
  velocity: Point,
  input: Point,
  dt: number,
  objects: RoomObject[],
) {
  const seconds = Math.max(0, Math.min(dt, 0.05))
  const acceleration = Math.hypot(input.x, input.z) ? 12 : 16
  const blend = 1 - Math.exp(-acceleration * seconds)
  const nextVelocity = {
    x: velocity.x + (input.x * PLAYER_SPEED - velocity.x) * blend,
    z: velocity.z + (input.z * PLAYER_SPEED - velocity.z) * blend,
  }
  const next = moveWithCollisions(
    position,
    { x: nextVelocity.x * seconds, z: nextVelocity.z * seconds },
    objects,
  )
  return { position: next, velocity: nextVelocity }
}

// A newly placed/restored item may occupy the avatar's transient position.
export function nearestOpenPosition(
  position: Point,
  objects: RoomObject[],
): Point {
  if (isWalkable(position, objects)) return { ...position }
  let best: Point | null = null,
    distance = Infinity
  for (let x = -11; x <= 11; x += 0.5)
    for (let z = -11; z <= 11; z += 0.5) {
      const d = (x - position.x) ** 2 + (z - position.z) ** 2
      if (d < distance && isWalkable({ x, z }, objects)) {
        best = { x, z }
        distance = d
      }
    }
  return best ?? { x: 0, z: 0 }
}

export function cameraRoomLimit(
  target: Point & { y: number },
  alpha: number,
  beta: number,
  requested: number,
): number {
  const dx = Math.cos(alpha) * Math.sin(beta),
    dz = Math.sin(alpha) * Math.sin(beta)
  let limit = requested
  for (const [value, direction, half] of [
    [target.x, dx, ROOM.halfWidth],
    [target.z, dz, ROOM.halfDepth],
  ]) {
    if (Math.abs(direction) > 0.0001)
      limit = Math.min(
        limit,
        ((direction > 0 ? half - 0.22 : -half + 0.22) - value) / direction,
      )
  }
  if (Math.cos(beta) > 0.0001)
    limit = Math.min(limit, (ROOM.height - 0.2 - target.y) / Math.cos(beta))
  return Math.max(0.25, limit)
}
