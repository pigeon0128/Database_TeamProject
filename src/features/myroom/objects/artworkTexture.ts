import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import type { Scene } from "@babylonjs/core/scene"
import {
  roomArtworkGuide,
  roomArtworkImage,
  type RoomArtwork,
} from "../artwork"

const image = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image unavailable"))
    img.src = url
  })

// Shared by wall frames and floor easels; late image loads cannot update a disposed object.
export function createArtworkTexture(
  scene: Scene,
  root: TransformNode,
  artwork: RoomArtwork | undefined,
  drawingId: number | undefined,
  preview: boolean,
) {
  const texture = new DynamicTexture(
    `${root.name}-artwork`,
    { width: 768, height: 864 },
    scene,
    true,
  )
  const ctx = texture.getContext() as CanvasRenderingContext2D
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
      : drawingId
        ? "작품을 불러올 수 없어요"
        : "그림을 골라 주세요",
  )
  if (artwork && (artwork.imageKey || artwork.previewImageUrl) && !preview) {
    const guide = roomArtworkGuide(artwork)
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
  return texture
}
