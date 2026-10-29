import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { Scene } from "@babylonjs/core/scene"
import { roomArtworkImage, type RoomArtwork } from "../artwork"
import { creatureGuide } from "../../../data/creatures"
import type { RoomObject } from "../types"
import { material } from "../engine/room"

const image = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image unavailable"))
    img.src = url
  })

export function createObject(
  scene: Scene,
  object: RoomObject,
  artwork?: RoomArtwork,
  preview = false,
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
    pictureTexture = new DynamicTexture(
      `${object.id}-artwork`,
      { width: 768, height: 864 },
      scene,
      true,
    )
    paper.diffuseTexture = pictureTexture
    const texture = pictureTexture,
      ctx = texture.getContext() as CanvasRenderingContext2D
    const placeholder = (text: string) => {
      if (root.isDisposed()) return
      ctx.fillStyle = "#faf9f5"
      ctx.fillRect(0, 0, 768, 864)
      ctx.fillStyle = "#77776d"
      ctx.font = "26px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(text, 384, 445)
      texture.update()
    }
    placeholder(
      artwork && (artwork.imageKey || artwork.previewImageUrl)
        ? "그림을 불러오는 중…"
        : object.artworkDrawingId
          ? "작품을 불러올 수 없어요"
          : "그림을 골라 주세요",
    )
    if (artwork && (artwork.imageKey || artwork.previewImageUrl) && !preview) {
      const guide = creatureGuide(artwork.slug)
      Promise.all([
        guide ? image(guide).catch(() => null) : null,
        image(roomArtworkImage(artwork)),
      ])
        .then(([base, ink]) => {
          if (root.isDisposed()) return
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, 768, 864)
          const draw = (img: HTMLImageElement) => {
            const ratio = Math.min(
              728 / img.naturalWidth,
              824 / img.naturalHeight,
            )
            const w = img.naturalWidth * ratio,
              h = img.naturalHeight * ratio
            ctx.drawImage(img, (768 - w) / 2, (864 - h) / 2, w, h)
          }
          if (base) {
            ctx.globalAlpha = 0.3
            draw(base)
            ctx.globalAlpha = 1
          }
          draw(ink)
          texture.update()
        })
        .catch(() => {
          if (!root.isDisposed()) placeholder("그림을 불러오지 못했어요")
        })
    }
  } else if (object.type === "chair") {
    box("seat", [0.58, 0.1, 0.57], [0, 0.5, 0], dark)
    box("back", [0.58, 0.42, 0.07], [0, 0.84, 0.26], dark)
    for (const x of [-0.24, 0.24])
      for (const z of [-0.23, 0.23])
        box("leg", [0.045, 0.5, 0.045], [x, 0.25, z], dark)
  } else if (object.type === "table") {
    box("top", [1.8, 0.12, 1], [0, 0.89, 0], wood)
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
  pieces.forEach((m) => {
    m.metadata = { objectId: object.id }
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
