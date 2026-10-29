export type ObjectType = "frame" | "easel" | "chair" | "table" | "plant"

export type Wall = "back" | "left" | "right" | "front"

export interface Position {
  x: number
  y: number
  z: number
}
export interface Footprint {
  x: number
  z: number
}

export type RoomObject = {
  id: string
  type: ObjectType
  position: Position
  rotation: number
  scale: 1
  wall?: Wall
  artworkDrawingId?: number
}

export type RoomLayout = { objects: RoomObject[] }

export declare const ROOM: Readonly<{
  halfWidth: number
  halfDepth: number
  height: number
}>

export declare const MAX_OBJECTS: number

export declare const WALLS: Wall[]

export declare function supportsArtwork(type: ObjectType | undefined): boolean

export declare const CATALOG: Readonly<Record<ObjectType, {
  name: string
  category: string
  width: number
  height: number
  depth: number
}>>

export declare function wallRotation(wall: Wall): number

export declare function footprint(object: RoomObject): Footprint

export declare function placementError(
  object: RoomObject,
  others?: RoomObject[],
): string | null

export declare function validateLayout(value: unknown): RoomLayout
