import { artworkUrl } from "../../lib/api"
import { creatureGuide } from "../../data/creatures"

export type RoomArtwork = {
  drawingId: number
  name: string
  kind: "creature" | "story"
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
