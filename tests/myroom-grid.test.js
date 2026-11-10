import test from "node:test"
import assert from "node:assert/strict"
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js"
import { Scene } from "@babylonjs/core/scene.js"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js"
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js"
import { Ray } from "@babylonjs/core/Culling/ray.js"
import { createPlacementGrid } from "../src/features/myroom/engine/placementGrid.ts"
import { placementError } from "../shared/myroom.js"

test("prebuilt grids toggle by placement type without adding meshes or affecting picking/validation", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine)
  try {
    const walls = ["back", "front", "left", "right"].map((wall) => {
      const mesh = MeshBuilder.CreatePlane(wall, { size: 24 }, scene)
      mesh.metadata = { wall }
      mesh.isPickable = false
      return mesh
    })
    const ground = MeshBuilder.CreateGround(
      "floor",
      { width: 24, height: 24 },
      scene,
    )
    ground.metadata = { surface: "floor" }
    const grid = createPlacementGrid(scene, walls)
    const meshes = [...scene.meshes]
    const floorPositions = grid.floor.getVerticesData("position")
    assert.deepEqual(
      floorPositions.slice(0, 6).map((n) => Math.round(n * 1000) / 1000),
      [-12, 0.018, -12, -12, 0.018, 12],
    )
    assert.equal(floorPositions[6] - floorPositions[0], 1)
    const candidate = {
      id: "test",
      type: "easel",
      position: { x: 2.3, y: 0, z: 3.2 },
      rotation: 0,
      scale: 1,
    }
    const validation = placementError(candidate, [])
    for (const type of [
      null,
      "easel",
      "chair",
      "table",
      "colored",
      "frame",
      null,
    ]) {
      grid.setPlacement(type)
      assert.equal(grid.floor.isEnabled(), !!type && type !== "frame")
      grid.walls.forEach((mesh) =>
        assert.equal(mesh.isEnabled(), type === "frame"),
      )
      for (const mesh of [grid.floor, ...grid.walls]) {
        assert.equal(mesh.isPickable, false)
        assert.ok(mesh.alpha > 0 && mesh.alpha < 0.5)
        assert.equal(mesh.material.needAlphaBlending(), true)
        assert.equal(mesh.metadata, null)
      }
      scene.meshes.forEach((mesh) => mesh.computeWorldMatrix(true))
      assert.equal(
        scene.pickWithRay(new Ray(new Vector3(2, 10, 3), Vector3.Down()))
          .pickedMesh,
        ground,
      )
      assert.equal(placementError(candidate, []), validation)
      assert.deepEqual(scene.meshes, meshes)
    }
    grid.setPlacement("frame")
    walls[0].setEnabled(false)
    assert.equal(grid.walls[0].isEnabled(), false)
  } finally {
    scene.dispose()
    engine.dispose()
  }
})
