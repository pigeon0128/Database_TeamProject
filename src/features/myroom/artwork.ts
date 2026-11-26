import { artworkUrl } from "../../lib/api"
import { creatureGuide } from "../../data/creatures"

export type RoomArtwork = {
  drawingId: number
  name: string
  /** ai: AI 그림 연습실에서 마이룸에 추가한 그림 (drawingId = AI_ARTWORK_BASE + 번호) */
  kind: "creature" | "story" | "ai"
  slug: string | null
  imageKey: string | null
  previewImageUrl?: string
}

export function roomArtworkGuide(artwork: RoomArtwork): string | undefined {
  return artwork.kind === "creature" && artwork.slug
    ? (creatureGuide(artwork.slug) ?? undefined)
    : undefined
}

export function roomArtworkImage(artwork: RoomArtwork): string {
  if (import.meta.env.DEV && artwork.previewImageUrl)
    return artwork.previewImageUrl
  return artworkUrl(artwork.imageKey!)
}
