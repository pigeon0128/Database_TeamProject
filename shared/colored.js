// 색칠 오브젝트 spec 검증. 임의 모델/URL 없이 허용된 프리미티브와 숫자만 저장한다.
// spec = { v:1, bounds:{min:[x,y,z],max:[x,y,z]}, group:[16], parts:[{ shape, matrix:[16], color? | spacing+samples }] }
// samples: 칠해진 꼭짓점마다 9바이트(x,y,z int16 LE ×SAMPLE_SCALE, r,g,b uint8)를 base64로 이은 문자열.
export const SAMPLE_SCALE = 4096
export const MAX_PARTS = 80
export const MAX_SAMPLES = 400000
export const SHAPES = ["sphere", "box", "cone", "cylinder", "torus", "pyramid", "roof"]

const finite = (n) => typeof n === "number" && Number.isFinite(n)
const inRange = (n, lo, hi) => finite(n) && n >= lo && n <= hi
const BASE64 = /^[A-Za-z0-9+/]*$/

function fail(message) {
  throw new Error(message)
}

function vec3(value, limit, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((n) => inRange(n, -limit, limit)))
    fail(`${label} 값이 올바르지 않아요.`)
  return value.slice()
}

function matrix(value, label) {
  if (!Array.isArray(value) || value.length !== 16 || !value.every((n) => inRange(n, -100, 100)))
    fail(`${label} 행렬이 올바르지 않아요.`)
  return value.slice()
}

function shape(value) {
  if (!value || !SHAPES.includes(value.kind)) fail("지원하지 않는 모양이에요.")
  const k = value.kind
  const size = (n, lo = 0.001, hi = 10) => (inRange(n, lo, hi) ? n : fail("모양 크기가 올바르지 않아요."))
  const seg = (n) => (Number.isInteger(n) && n >= 3 && n <= 128 ? n : fail("모양 분할 수가 올바르지 않아요."))
  if (k === "sphere") return { kind: k, radius: size(value.radius) }
  if (k === "box") return { kind: k, size: vec3(value.size, 10, "상자 크기").map((n) => size(n)) }
  if (k === "pyramid") return { kind: k, radius: size(value.radius), height: size(value.height) }
  if (k === "cone")
    return { kind: k, radius: size(value.radius), height: size(value.height), segments: seg(value.segments) }
  if (k === "cylinder")
    return {
      kind: k,
      rTop: size(value.rTop, 0, 10),
      rBottom: size(value.rBottom, 0, 10),
      height: size(value.height),
      segments: seg(value.segments),
    }
  if (k === "torus")
    return {
      kind: k,
      radius: size(value.radius),
      tube: size(value.tube),
      arc: size(value.arc, 0.01, Math.PI * 2 + 0.001),
    }
  return { kind: k }
}

/** 검증된 spec의 복사본을 돌려주고, 잘못되면 한국어 메시지의 Error를 던진다. */
export function validateColoredSpec(value) {
  if (!value || value.v !== 1 || !Array.isArray(value.parts)) fail("색칠 오브젝트 형식이 올바르지 않아요.")
  if (value.parts.length < 1 || value.parts.length > MAX_PARTS) fail("부위 수가 올바르지 않아요.")
  const b = value.bounds
  const min = vec3(b?.min, 100, "범위"),
    max = vec3(b?.max, 100, "범위")
  if (min.some((n, i) => n >= max[i])) fail("범위가 올바르지 않아요.")
  let total = 0
  const parts = value.parts.map((p) => {
    if (!p) fail("부위가 올바르지 않아요.")
    const out = { shape: shape(p.shape), matrix: matrix(p.matrix, "부위") }
    if (typeof p.color === "string") {
      if (!/^#[0-9a-fA-F]{6}$/.test(p.color)) fail("색 형식이 올바르지 않아요.")
      out.color = p.color.toLowerCase()
    }
    if (p.samples !== undefined) {
      if (
        typeof p.samples !== "string" ||
        p.samples.length % 12 !== 0 ||
        !BASE64.test(p.samples) ||
        !inRange(p.spacing, 0.0005, 2)
      )
        fail("색 정보가 올바르지 않아요.")
      total += p.samples.length / 12
      if (total > MAX_SAMPLES) fail("색 정보가 너무 커요.")
      out.spacing = p.spacing
      out.samples = p.samples
    }
    return out
  })
  return { v: 1, bounds: { min, max }, group: matrix(value.group, "그룹"), parts }
}

export function validateStoredName(value) {
  const name = typeof value === "string" ? value.trim() : ""
  if (!name || [...name].length > 20) fail("이름은 1~20자로 입력해 주세요.")
  return name
}

export function validateSourceModel(value) {
  if (typeof value !== "string" || !/^[a-z0-9_-]{1,32}$/.test(value)) fail("모델 종류가 올바르지 않아요.")
  return value
}

export function validateThumbnail(value) {
  if (typeof value !== "string" || value.length > 80000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
    fail("미리보기 이미지가 올바르지 않아요.")
  return value
}
