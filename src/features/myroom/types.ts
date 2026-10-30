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
  /** 수납함에서 꺼내는 색칠 오브젝트 번호 */
  storedObjectId?: number
  /** 색칠 오브젝트의 크기 배율 */
  scale?: number
}

export type ColoredShape =
  | { kind: "sphere"; radius: number }
  | { kind: "box"; size: number[] }
  | { kind: "cone"; radius: number; height: number; segments: number }
  | { kind: "cylinder"; rTop: number; rBottom: number; height: number; segments: number }
  | { kind: "torus"; radius: number; tube: number; arc: number }
  | { kind: "pyramid"; radius: number; height: number }
  | { kind: "roof" }
export type ColoredPart = {
  shape: ColoredShape
  matrix: number[]
  color?: string
  spacing?: number
  samples?: string
}
export type ColoredSpec = {
  v: 1
  bounds: { min: number[]; max: number[] }
  group: number[]
  parts: ColoredPart[]
}
export type StoredSummary = {
  id: number
  name: string
  sourceModel: string
  thumbnail: string
  createdAt: string
}
