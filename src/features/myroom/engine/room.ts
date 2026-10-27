import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { Scene } from "@babylonjs/core/scene"
import { ROOM, wallRotation, type Wall } from "../../../../shared/myroom.js"

export function material(scene: Scene, name: string, color: string) {
  const m = new StandardMaterial(name, scene)
  m.diffuseColor = Color3.FromHexString(color)
  m.specularColor = Color3.Black()
  return m
}

export function createRoom(scene: Scene) {
  const floor = MeshBuilder.CreateGround(
    "room-floor",
    { width: ROOM.halfWidth * 2, height: ROOM.halfDepth * 2 },
    scene,
  )
  floor.material = material(scene, "ochre-floor", "#da9952")
  floor.receiveShadows = true
  floor.metadata = { surface: "floor" }

  // Original procedural grain, drawn deterministically. No DOROBUS bitmap or external asset is used.
  const grain = new DynamicTexture(
    "independent-wood-grain",
    { width: 512, height: 1024 },
    scene,
    false,
  )
  const ctx = grain.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = "#302013"
  ctx.fillRect(0, 0, 512, 1024)
  let seed = 72
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < 1100; i++) {
    const x = random() * 512,
      y = random() * 1024
    ctx.strokeStyle =
      i % 3 === 0
        ? `rgba(142,99,46,${0.08 + random() * 0.22})`
        : `rgba(5,3,1,${random() * 0.4})`
    ctx.lineWidth = 0.4 + random() * 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + 3, y + 100, x - 4, y + 250, x + 1, y + 500)
    ctx.stroke()
  }
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = "#140e08"
    ctx.fillRect(x, 0, 2, 1024)
  }
  grain.update()
  grain.uScale = 3
  grain.wrapU = Texture.WRAP_ADDRESSMODE
  const wood = material(scene, "dark-vertical-wood", "#ffffff")
  wood.diffuseTexture = grain
  const walls = (["back", "left", "right", "front"] as Wall[]).map((wall) => {
    const horizontal = wall === "back" || wall === "front"
    const mesh = MeshBuilder.CreatePlane(
      `wall-${wall}`,
      {
        width: (horizontal ? ROOM.halfWidth : ROOM.halfDepth) * 2,
        height: ROOM.height,
      },
      scene,
    )
    mesh.position = new Vector3(
      wall === "left" ? -ROOM.halfWidth : wall === "right" ? ROOM.halfWidth : 0,
      ROOM.height / 2,
      wall === "back" ? ROOM.halfDepth : wall === "front" ? -ROOM.halfDepth : 0,
    )
    mesh.rotation.y = wallRotation(wall)
    mesh.material = wood
    mesh.receiveShadows = true
    mesh.metadata = { surface: "wall", wall }
    return mesh
  })
  return { walls, floor }
}
