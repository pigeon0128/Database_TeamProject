// Rendering and API share the same geometry/validation contract. No arbitrary models or URLs in saved layouts.
export const ROOM = Object.freeze({ halfWidth: 12, halfDepth: 12, height: 5 })
export const MAX_OBJECTS = 40
export const CATALOG = Object.freeze({
  frame: {
    name: "그림 액자",
    category: "벽 가구",
    width: 1.7,
    height: 1.9,
    depth: 0.16,
  },
  easel: {
    name: "목재 이젤",
    category: "장식",
    width: 1.3,
    height: 2.2,
    depth: 1,
  },
  chair: {
    name: "접이식 의자",
    category: "의자",
    width: 0.65,
    height: 1.05,
    depth: 0.7,
  },
  table: {
    name: "목재 책상",
    category: "테이블",
    width: 1.8,
    height: 0.95,
    depth: 1,
  },
  plant: {
    name: "작은 나무",
    category: "장식",
    width: 0.9,
    height: 1.6,
    depth: 0.9,
  },
})
export const WALLS = ["back", "left", "right", "front"]
export function supportsArtwork(type) {
  return type === "frame" || type === "easel"
}
export function wallRotation(wall) {
  return { back: 0, left: -Math.PI / 2, right: Math.PI / 2, front: Math.PI }[
    wall
  ]
}
export function footprint(object) {
  const spec = CATALOG[object.type]
  return object.rotation % Math.PI > Math.PI / 4 &&
    object.rotation % Math.PI < (Math.PI * 3) / 4
    ? { x: spec.depth / 2, z: spec.width / 2 }
    : { x: spec.width / 2, z: spec.depth / 2 }
}
export function placementError(object, others = []) {
  const spec = CATALOG[object.type]
  if (!spec) return "지원하지 않는 오브젝트예요."
  const p = object.position
  if (!p || ![p.x, p.y, p.z, object.rotation].every(Number.isFinite))
    return "좌표가 올바르지 않아요."
  if (object.type === "frame") {
    if (!WALLS.includes(object.wall)) return "액자는 벽면에 배치해 주세요."
    const along = ["back", "front"].includes(object.wall) ? p.x : p.z
    const edge = ["back", "front"].includes(object.wall)
      ? ROOM.halfWidth
      : ROOM.halfDepth
    const fixed = {
      back: p.z - ROOM.halfDepth + 0.12,
      front: p.z + ROOM.halfDepth - 0.12,
      left: p.x + ROOM.halfWidth - 0.12,
      right: p.x - ROOM.halfWidth + 0.12,
    }[object.wall]
    if (
      Math.abs(fixed) > 0.005 ||
      Math.abs(object.rotation - wallRotation(object.wall)) > 0.005 ||
      Math.abs(along) > edge - spec.width / 2 - 0.15 ||
      p.y < spec.height / 2 + 0.15 ||
      p.y > ROOM.height - spec.height / 2 - 0.15
    )
      return "액자가 벽면의 배치 범위를 벗어났어요."
    for (const other of others) {
      if (
        other.id === object.id ||
        other.type !== "frame" ||
        other.wall !== object.wall
      )
        continue
      const q = other.position
      if (
        Math.abs(
          along - (["back", "front"].includes(object.wall) ? q.x : q.z),
        ) <
          spec.width + 0.12 &&
        Math.abs(p.y - q.y) < spec.height + 0.12
      )
        return "다른 액자와 겹쳐요."
    }
  } else {
    if (
      p.y !== 0 ||
      object.wall !== undefined ||
      object.rotation < 0 ||
      object.rotation >= Math.PI * 2 ||
      Math.abs(
        object.rotation / (Math.PI / 2) -
          Math.round(object.rotation / (Math.PI / 2)),
      ) > 0.005
    )
      return "가구의 높이 또는 회전이 올바르지 않아요."
    const a = footprint(object)
    if (
      Math.abs(p.x) + a.x > ROOM.halfWidth - 0.2 ||
      Math.abs(p.z) + a.z > ROOM.halfDepth - 0.2
    )
      return "방 안쪽 바닥에 배치해 주세요."
    for (const other of others) {
      if (other.id === object.id || other.type === "frame") continue
      const b = footprint(other)
      if (
        Math.abs(p.x - other.position.x) < a.x + b.x + 0.08 &&
        Math.abs(p.z - other.position.z) < a.z + b.z + 0.08
      )
        return "다른 가구와 겹쳐요."
    }
  }
  return null
}
export function validateLayout(value) {
  if (
    !value ||
    !Array.isArray(value.objects) ||
    value.objects.length > MAX_OBJECTS
  )
    throw new Error("오브젝트는 최대 40개까지 저장할 수 있어요.")
  const ids = new Set()
  const objects = value.objects.map((o) => {
    if (
      !o ||
      typeof o.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(o.id) ||
      ids.has(o.id)
    )
      throw new Error("오브젝트 ID가 올바르지 않거나 중복돼요.")
    ids.add(o.id)
    if (!Object.hasOwn(CATALOG, o.type) || o.scale !== 1)
      throw new Error("오브젝트 종류 또는 크기가 올바르지 않아요.")
    if (
      Object.keys(o).some(
        (k) =>
          ![
            "id",
            "type",
            "position",
            "rotation",
            "scale",
            "wall",
            "artworkDrawingId",
          ].includes(k),
      )
    )
      throw new Error("지원하지 않는 오브젝트 속성이에요.")
    if (
      o.artworkDrawingId !== undefined &&
      (!supportsArtwork(o.type) ||
        !Number.isSafeInteger(o.artworkDrawingId) ||
        o.artworkDrawingId <= 0)
    )
      throw new Error("전시할 작품 번호가 올바르지 않아요.")
    const error = placementError(o)
    if (error) throw new Error(error)
    return {
      id: o.id,
      type: o.type,
      position: { x: o.position.x, y: o.position.y, z: o.position.z },
      rotation: o.rotation,
      scale: 1,
      ...(o.wall ? { wall: o.wall } : {}),
      ...(o.artworkDrawingId ? { artworkDrawingId: o.artworkDrawingId } : {}),
    }
  })
  for (const o of objects) {
    const error = placementError(o, objects)
    if (error) throw new Error(error)
  }
  return { objects }
}
