import { validateLayout } from "../../../../shared/myroom.js"
import { ApiError } from "../../../lib/api.ts"
import type { RoomArtwork } from "../artwork"
import type { RoomLayout, RoomState } from "../types"

export const PREVIEW_STORAGE_KEY = "doroland:myroom-preview:v1"

// Handwritten geometric SVG samples; no user works, remote assets or generated images.
const svg = (shapes: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700" viewBox="0 0 600 700"><rect width="600" height="700" fill="#fff"/>${shapes}<text x="300" y="640" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#576275">PREVIEW SAMPLE</text></svg>`,
  )}`
export const previewArtworks: RoomArtwork[] = [
  {
    drawingId: 900001,
    name: "Preview 샘플 · 산",
    slug: "preview-mountain",
    imageKey: null,
    previewImageUrl: svg(
      '<circle cx="420" cy="190" r="65" fill="#efb54e"/><path d="M70 500 250 200 430 500Z" fill="#6b947b"/><path d="M290 500 410 320 530 500Z" fill="#9db6a1"/>',
    ),
  },
  {
    drawingId: 900002,
    name: "Preview 샘플 · 꽃",
    slug: "preview-flower",
    imageKey: null,
    previewImageUrl: svg(
      '<path d="M300 510V300M300 450Q200 350 210 440Q230 500 300 470" fill="#7ca182" stroke="#547c5d" stroke-width="12"/><g fill="#e6a09b"><circle cx="300" cy="210" r="65"/><circle cx="230" cy="275" r="65"/><circle cx="370" cy="275" r="65"/><circle cx="260" cy="350" r="65"/><circle cx="340" cy="350" r="65"/></g><circle cx="300" cy="285" r="55" fill="#eac76c"/>',
    ),
  },
]

function checkedLayout(value: unknown): RoomLayout {
  const layout = validateLayout(value)
  if (
    layout.objects.some(
      (o) =>
        o.artworkDrawingId &&
        !previewArtworks.some((a) => a.drawingId === o.artworkDrawingId),
    )
  )
    throw new Error("Preview 샘플 작품만 로컬에 저장할 수 있어요.")
  return layout
}

export function createPreviewSource(
  storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage,
) {
  function load(): RoomState {
    const raw = storage.getItem(PREVIEW_STORAGE_KEY)
    if (!raw)
      return {
        schemaVersion: 1,
        revision: 0,
        layout: { objects: [] },
        updatedAt: null,
      }
    try {
      const data = JSON.parse(raw)
      if (
        data.schemaVersion !== 1 ||
        !Number.isSafeInteger(data.revision) ||
        data.revision < 0 ||
        typeof data.updatedAt !== "string"
      )
        throw new Error("invalid state")
      return {
        schemaVersion: 1,
        revision: data.revision,
        layout: checkedLayout(data.layout),
        updatedAt: data.updatedAt,
      }
    } catch {
      throw new Error(
        "Preview 로컬 저장본을 읽지 못했어요. 개발자 도구에서 doroland:myroom-preview:v1 항목을 확인해 주세요. 저장본은 덮어쓰지 않았어요.",
      )
    }
  }
  return {
    load,
    save(layout: RoomLayout, expectedRevision: number): RoomState {
      if (load().revision !== expectedRevision)
        throw new ApiError(
          "다른 Preview 화면에서 저장했어요. 로컬 저장본을 확인해 주세요.",
          409,
        )
      const result: RoomState = {
        schemaVersion: 1,
        revision: expectedRevision + 1,
        layout: checkedLayout(layout),
        updatedAt: new Date().toISOString(),
      }
      try {
        storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(result))
      } catch {
        throw new Error(
          "Preview를 로컬에 저장하지 못했어요. 브라우저 저장 공간과 권한을 확인해 주세요.",
        )
      }
      return result
    },
    artworks: previewArtworks,
  }
}
