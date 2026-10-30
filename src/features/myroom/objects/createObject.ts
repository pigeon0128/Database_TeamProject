import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { Scene } from "@babylonjs/core/scene"
import type { RoomArtwork } from "../artwork"
import { createArtworkTexture } from "./artworkTexture"
import type { ColoredSpec, RoomObject } from "../types"
import { buildColoredObject } from "./coloredModel"
import { material } from "../engine/room"

export function createObject(
  scene: Scene,
  object: RoomObject,
  artwork?: RoomArtwork,
  preview = false,
  stored?: ColoredSpec,
) {
  const root = new TransformNode(`object-${object.id}`, scene)
  const ownMaterials: StandardMaterial[] = []
  const mat = (name: string, color: string) => {
    const m = material(scene, `${object.id}-${name}`, color)
    ownMaterials.push(m)
    return m
  }
  const dark = mat("dark", "#34383b"),
    wood = mat("wood", "#84613b"),
    gold = mat("frame", "#8a7752")
  const pieces: Mesh[] = []
  function box(name: string, size: number[], p: number[], m: StandardMaterial) {
    const b = MeshBuilder.CreateBox(
      `${object.id}-${name}`,
      { width: size[0], height: size[1], depth: size[2] },
      scene,
    )
    b.parent = root
    b.position.set(p[0], p[1], p[2])
    b.material = m
    pieces.push(b)
    return b
  }
  let pictureTexture: DynamicTexture | undefined
  if (object.type === "frame") {
    box("backing", [1.7, 1.9, 0.1], [0, 0, 0], wood)
    box("top", [1.7, 0.11, 0.14], [0, 0.895, -0.06], gold)
    box("bottom", [1.7, 0.11, 0.14], [0, -0.895, -0.06], gold)
    box("left", [0.11, 1.7, 0.14], [-0.795, 0, -0.06], gold)
    box("right", [0.11, 1.7, 0.14], [0.795, 0, -0.06], gold)
    const trim = mat("inner-trim", "#c7b990")
    box("trim-top", [1.5, 0.025, 0.03], [0, 0.82, -0.14], trim)
    box("trim-bottom", [1.5, 0.025, 0.03], [0, -0.82, -0.14], trim)
    box("trim-left", [0.025, 1.64, 0.03], [-0.74, 0, -0.14], trim)
    box("trim-right", [0.025, 1.64, 0.03], [0.74, 0, -0.14], trim)
    const surface = MeshBuilder.CreatePlane(
      `${object.id}-picture`,
      { width: 1.45, height: 1.61 },
      scene,
    )
    surface.parent = root
    surface.position.z = -0.145
    pieces.push(surface)
    const paper = mat("paper", "#ffffff")
    paper.disableLighting = true
    paper.emissiveColor = Color3.White()
    surface.material = paper
    pictureTexture = createArtworkTexture(
      scene,
      root,
      artwork,
      object.artworkDrawingId,
      preview,
    )
    paper.diffuseTexture = pictureTexture
  } else if (object.type === "easel") {
    // Three timber legs form an A-frame; all geometry stays inside the shared footprint.
    const beam = (name: string, from: number[], to: number[]) => {
      const a = Vector3.FromArray(from),
        b = Vector3.FromArray(to)
      const piece = box(
        name,
        [0.09, Vector3.Distance(a, b), 0.09],
        a.add(b).scale(0.5).asArray(),
        wood,
      )
      piece.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
        Vector3.Up(),
        b.subtract(a).normalize(),
        new Quaternion(),
      )
    }
    beam("front-left", [-0.56, 0.05, -0.34], [-0.045, 2.15, 0.12])
    beam("front-right", [0.56, 0.05, -0.34], [0.045, 2.15, 0.12])
    beam("rear-leg", [0, 0.05, 0.42], [0, 2.02, 0.1])
    box("cross-brace", [0.86, 0.085, 0.1], [0, 0.55, -0.22], wood)
    box("canvas-ledge", [1.22, 0.1, 0.24], [0, 0.76, -0.25], wood)
    // Tilt the backing and painting together along the front legs, resting on the ledge.
    const canvasMount = new TransformNode(`${object.id}-canvas-mount`, scene)
    canvasMount.parent = root
    canvasMount.position.set(0, 1.44, -0.12)
    canvasMount.rotation.x = 0.21
    const backing = box(
      "canvas-backing",
      [1.08, 1.28, 0.065],
      [0, 0, 0],
      mat("canvas-edge", "#dcc9a5"),
    )
    backing.parent = canvasMount
    const surface = MeshBuilder.CreatePlane(
      `${object.id}-picture`,
      { width: 1.02, height: 1.2 },
      scene,
    )
    surface.parent = canvasMount
    surface.position.z = -0.037
    pieces.push(surface)
    const paper = mat("paper", "#ffffff")
    paper.disableLighting = true
    paper.emissiveColor = Color3.White()
    surface.material = paper
    pictureTexture = createArtworkTexture(
      scene,
      root,
      artwork,
      object.artworkDrawingId,
      preview,
    )
    paper.diffuseTexture = pictureTexture
  } else if (object.type === "colored") {
    if (stored) {
      const built = buildColoredObject(scene, root, object.id, stored)
      pieces.push(...built.pieces)
      ownMaterials.push(...built.materials)
    } else {
      // 모양을 불러오는 동안 보이는 자리표시
      const holder = MeshBuilder.CreateBox(
        `${object.id}-loading`,
        { width: 0.5, height: 0.5, depth: 0.5 },
        scene,
      )
      holder.parent = root
      holder.position.y = 0.25
      holder.material = mat("loading", "#b9c4cc")
      pieces.push(holder)
    }
  } else if (object.type === "chair") {
    box("seat", [0.58, 0.1, 0.57], [0, 0.5, 0], dark)
    box("back", [0.58, 0.42, 0.07], [0, 0.84, 0.26], dark)
    for (const x of [-0.24, 0.24])
      for (const z of [-0.23, 0.23])
        box("leg", [0.045, 0.5, 0.045], [x, 0.25, z], dark)
  } else if (object.type === "table") {
    const top = box("top", [1.8, 0.12, 1], [0, 0.89, 0], wood)
    top.metadata = { surface: "tabletop" }
    for (const x of [-0.76, 0.76])
      for (const z of [-0.36, 0.36])
        box("leg", [0.1, 0.85, 0.1], [x, 0.425, z], wood)
  } else {
    const pot = MeshBuilder.CreateCylinder(
      `${object.id}-pot`,
      { diameterTop: 0.58, diameterBottom: 0.4, height: 0.5, tessellation: 12 },
      scene,
    )
    pot.parent = root
    pot.position.y = 0.25
    pot.material = mat("pot", "#a98759")
    pieces.push(pot)
    box("trunk", [0.1, 0.75, 0.1], [0, 0.8, 0], wood)
    const leaves = MeshBuilder.CreateSphere(
      `${object.id}-leaves`,
      { diameter: 0.9, segments: 6 },
      scene,
    )
    leaves.parent = root
    leaves.position.y = 1.17
    leaves.scaling.y = 0.95
    leaves.material = mat("leaf", "#64853c")
    pieces.push(leaves)
  }
  root.position = new Vector3(
    object.position.x,
    object.position.y,
    object.position.z,
  )
  root.rotation.y = object.rotation
  root.scaling.setAll(object.scale ?? 1)
  pieces.forEach((m) => {
    m.metadata = { ...m.metadata, objectId: object.id }
    m.isPickable = !preview
    m.receiveShadows = true
  })
  if (preview)
    ownMaterials.forEach((m) => {
      m.alpha = 0.6
    })
  root.onDisposeObservable.addOnce(() => {
    pictureTexture?.dispose()
    ownMaterials.forEach((m) => m.dispose())
  })
  return {
    root,
    pieces,
    tint: (valid: boolean) =>
      ownMaterials.forEach((m) => {
        m.emissiveColor = valid
          ? new Color3(0, 0.12, 0.06)
          : new Color3(0.45, 0, 0)
      }),
  }
}
