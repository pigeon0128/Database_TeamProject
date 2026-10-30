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
  // 3D 색칠하기에서 수납한 오브젝트. 바닥 또는 테이블 위에 놓는다.
  colored: {
    name: "색칠 오브젝트",
    category: "수납함",
    width: 0.6,
    height: 0.9,
    depth: 0.6,
  },
})
// 목재 책상 상판의 윗면 높이 (createObject의 table: 중심 0.89 + 두께의 절반 0.06)
export const TABLE_TOP = 0.95
// 색칠 오브젝트만 크기를 바꿀 수 있다 (기본 크기의 0.5~2.5배, 0.1 단위). 너무 커져서 방을 막지 않게 상한을 둔다.
export const MIN_COLORED_SCALE = 0.5
export const MAX_COLORED_SCALE = 2.5
export const validScale = (object) => {
  const s = object.scale ?? 1
  if (object.type !== "colored") return s === 1
  return (
    Number.isFinite(s) &&
    s >= MIN_COLORED_SCALE - 1e-9 &&
    s <= MAX_COLORED_SCALE + 1e-9 &&
    Math.abs(s * 10 - Math.round(s * 10)) < 1e-6
  )
}
export const isRaised = (object) =>
  object.type === "colored" && object.position.y === TABLE_TOP
export const WALLS = ["back", "left", "right", "front"]
export function wallRotation(wall) {
  return { back: 0, left: -Math.PI / 2, right: Math.PI / 2, front: Math.PI }[
    wall
  ]
}
export function footprint(object) {
  const spec = CATALOG[object.type]
  const k = validScale(object) ? (object.scale ?? 1) : 1
  return object.rotation % Math.PI > Math.PI / 4 &&
    object.rotation % Math.PI < (Math.PI * 3) / 4
    ? { x: (spec.depth * k) / 2, z: (spec.width * k) / 2 }
    : { x: (spec.width * k) / 2, z: (spec.depth * k) / 2 }
}
export function onTable(object, table) {
  if (table.type !== "table" || table.position.y !== 0) return false
  const a = footprint(object),
    t = footprint(table)
  return (
    Math.abs(object.position.x - table.position.x) + a.x <= t.x + 1e-6 &&
    Math.abs(object.position.z - table.position.z) + a.z <= t.z + 1e-6
  )
}
export function placementError(object, others) {
  const relational = others !== undefined
  others = others ?? []
  const spec = CATALOG[object.type]
  if (!spec) return "지원하지 않는 오브젝트예요."
  if (!validScale(object)) return "오브젝트 크기가 허용 범위를 벗어났어요."
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
    const raised = isRaised(object)
    if (
      (p.y !== 0 && !raised) ||
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
    if (raised) {
      if (relational && !others.some((t) => onTable(object, t)))
        return "테이블 위 안쪽에 올려 주세요."
      for (const other of others) {
        if (other.id === object.id || !isRaised(other)) continue
        const b = footprint(other)
        if (
          Math.abs(p.x - other.position.x) < a.x + b.x + 0.04 &&
          Math.abs(p.z - other.position.z) < a.z + b.z + 0.04
        )
          return "테이블 위의 다른 오브젝트와 겹쳐요."
      }
    } else
      for (const other of others) {
        if (other.id === object.id || other.type === "frame" || isRaised(other))
          continue
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
    if (!Object.hasOwn(CATALOG, o.type) || !validScale(o))
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
            "storedObjectId",
          ].includes(k),
      )
    )
      throw new Error("지원하지 않는 오브젝트 속성이에요.")
    if (
      o.artworkDrawingId !== undefined &&
      (o.type !== "frame" ||
        !Number.isSafeInteger(o.artworkDrawingId) ||
        o.artworkDrawingId <= 0)
    )
      throw new Error("전시할 작품 번호가 올바르지 않아요.")
    if (
      (o.type === "colored") !== (o.storedObjectId !== undefined) ||
      (o.storedObjectId !== undefined &&
        (!Number.isSafeInteger(o.storedObjectId) || o.storedObjectId <= 0))
    )
      throw new Error("수납함 오브젝트 번호가 올바르지 않아요.")
    const error = placementError(o)
    if (error) throw new Error(error)
    return {
      id: o.id,
      type: o.type,
      position: { x: o.position.x, y: o.position.y, z: o.position.z },
      rotation: o.rotation,
      scale: o.scale ?? 1,
      ...(o.wall ? { wall: o.wall } : {}),
      ...(o.artworkDrawingId ? { artworkDrawingId: o.artworkDrawingId } : {}),
      ...(o.storedObjectId ? { storedObjectId: o.storedObjectId } : {}),
    }
  })
  for (const o of objects) {
    const error = placementError(o, objects)
    if (error) throw new Error(error)
  }
  return { objects }
}
