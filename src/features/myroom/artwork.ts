import { artworkUrl, type CreatureEntry } from "../../lib/api"

export type RoomArtwork = Pick<CreatureEntry, "drawingId" | "name" | "slug" | "imageKey"> & {
  previewImageUrl?: string
}

export function roomArtworkImage(artwork: RoomArtwork): string {
  if (import.meta.env.DEV && artwork.previewImageUrl)
    return artwork.previewImageUrl
  return artworkUrl(artwork.imageKey!)
}
