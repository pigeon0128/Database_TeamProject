export type {
  RoomObject,
  RoomLayout,
  ObjectType,
  Wall,
} from "../../../shared/myroom.js"
import type {
  RoomLayout,
  ObjectType,
  RoomObject,
} from "../../../shared/myroom.js"
export type RoomState = {
  schemaVersion: 1
  revision: number
  layout: RoomLayout
  updatedAt: string | null
}
export type Placement = {
  type: ObjectType
  original?: RoomObject
  rotation: number
}
export type RoomMode = "explore" | "decorate"
