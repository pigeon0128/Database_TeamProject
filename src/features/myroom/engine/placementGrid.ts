import { Color3 } from "@babylonjs/core/Maths/math.color.js"
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js"
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js"
import type { Scene } from "@babylonjs/core/scene.js"
import { ROOM } from "../../../../shared/myroom.js"
import type { ObjectType } from "../types"

/** One-time 1m line meshes, independent from layout, snapping and surface picking. */
export function createPlacementGrid(scene: Scene, walls: Mesh[]) {
  const floorLines: Vector3[][] = []
  for (let x = -ROOM.halfWidth; x <= ROOM.halfWidth; x++)
    floorLines.push([
      new Vector3(x, 0.018, -ROOM.halfDepth),
      new Vector3(x, 0.018, ROOM.halfDepth),
    ])
  for (let z = -ROOM.halfDepth; z <= ROOM.halfDepth; z++)
    floorLines.push([
      new Vector3(-ROOM.halfWidth, 0.018, z),
      new Vector3(ROOM.halfWidth, 0.018, z),
    ])
  const make = (name: string, lines: Vector3[][]) => {
    const mesh = MeshBuilder.CreateLineSystem(name, { lines, useVertexAlpha: true }, scene)
    mesh.color = Color3.FromHexString("#ecf4ff")
    mesh.alpha = 0.28
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }
  const floor = make("placement-grid-floor", floorLines)
  const wallGrids = walls.map((wall) => {
    const half = ["front", "back"].includes(wall.metadata.wall)
      ? ROOM.halfWidth
      : ROOM.halfDepth
    const lines: Vector3[][] = []
    for (let x = -half; x <= half; x++)
      lines.push([
        new Vector3(x, -ROOM.height / 2, -0.025),
        new Vector3(x, ROOM.height / 2, -0.025),
      ])
    for (let y = 0; y <= ROOM.height; y++)
      lines.push([
        new Vector3(-half, y - ROOM.height / 2, -0.025),
        new Vector3(half, y - ROOM.height / 2, -0.025),
      ])
    const mesh = make(`placement-grid-${wall.metadata.wall}`, lines)
    mesh.parent = wall // Follow existing outside-wall visibility/culling.
    return mesh
  })
  return {
    floor,
    walls: wallGrids,
    setPlacement(type: ObjectType | null) {
      floor.setEnabled(type !== null && type !== "frame")
      wallGrids.forEach((mesh) => mesh.setEnabled(type === "frame"))
    },
  }
}
