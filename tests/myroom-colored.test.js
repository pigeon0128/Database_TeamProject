import test from "node:test"
import assert from "node:assert/strict"
import {
  CATALOG,
  TABLE_TOP,
  placementError,
  validateLayout,
} from "../shared/myroom.js"
import {
  MAX_SAMPLES,
  validateColoredSpec,
  validateThumbnail,
} from "../shared/colored.js"

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const table = {
  id: "t1",
  type: "table",
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  scale: 1,
}
const colored = (id, x, y, z, extra = {}) => ({
  id,
  type: "colored",
  position: { x, y, z },
  rotation: 0,
  scale: 1,
  storedObjectId: 1,
  ...extra,
})

test("easel artwork and resized colored objects coexist without mixing their saved contracts", () => {
  const easel = {
    id: "easel",
    type: "easel",
    position: { x: 3, y: 0, z: 3 },
    rotation: Math.PI / 2,
    scale: 1,
    artworkDrawingId: 2,
  }

  const painted = colored("painted", -3, 0, 3, { scale: 2.5 })

  const layout = {
    objects: [
      easel,
      painted,
      table,
      colored("raised", 0, TABLE_TOP, 0, { scale: 0.8 }),
    ],
  }

  assert.deepEqual(validateLayout(JSON.parse(JSON.stringify(layout))), layout)

  for (const bad of [
    { ...easel, scale: 1.5 },

    { ...easel, storedObjectId: 1 },

    { ...painted, artworkDrawingId: 2 },
  ])
    assert.throws(() => validateLayout({ objects: [bad] }))
})

test("easel and colored objects block each other using scaled, rotated floor footprints", () => {
  const easel = {
    id: "easel",
    type: "easel",
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    scale: 1,
  }

  const near = colored("painted", 1.2, 0, 0)

  assert.equal(placementError(near, [easel]), null)

  assert.match(placementError({ ...near, scale: 2 }, [easel]), /겹쳐/)

  assert.match(placementError(easel, [{ ...near, scale: 2 }]), /겹쳐/)

  assert.throws(
    () => validateLayout({ objects: [easel, { ...near, scale: 2 }] }),
    /겹쳐/,
  )

  assert.equal(
    placementError({ ...near, scale: 2 }, [
      { ...easel, rotation: Math.PI / 2 },
    ]),
    null,
  )
})

test("colored objects stand on the floor and keep clear of furniture", () => {
  assert.equal(CATALOG.colored.category, "수납함")
  assert.equal(placementError(colored("c", 4, 0, 4), [table]), null)
  assert.match(placementError(colored("c", 0.5, 0, 0), [table]), /겹쳐요/)
})

test("colored objects can sit on a table top but never float", () => {
  assert.equal(placementError(colored("c", 0.4, TABLE_TOP, 0), [table]), null)
  // 상판 가장자리 밖으로 튀어나옴
  assert.match(placementError(colored("c", 0.8, TABLE_TOP, 0), [table]), /테이블 위/)
  // 테이블이 없는 허공
  assert.match(placementError(colored("c", 5, TABLE_TOP, 5), [table]), /테이블 위/)
  // 다른 높이는 허용하지 않음
  assert.ok(placementError(colored("c", 0, 0.5, 0), [table]))
})

test("two colored objects share a table only when they do not overlap", () => {
  const a = colored("a", -0.45, TABLE_TOP, 0)
  assert.equal(placementError(colored("b", 0.45, TABLE_TOP, 0), [table, a]), null)
  assert.match(
    placementError(colored("b", -0.2, TABLE_TOP, 0), [table, a]),
    /겹쳐요/,
  )
  // 상판 위 물건은 바닥 배치를 막지 않는다
  assert.equal(placementError(colored("c", 0.45, 0, 0), [a]), null)
})

test("layout validation requires a stored object id exactly for colored objects", () => {
  const ok = validateLayout({ objects: [table, colored("a", -0.45, TABLE_TOP, 0)] })
  assert.equal(ok.objects[1].storedObjectId, 1)
  assert.throws(() =>
    validateLayout({ objects: [colored("a", 4, 0, 4, { storedObjectId: undefined })] }),
  )
  assert.throws(() =>
    validateLayout({ objects: [{ ...table, storedObjectId: 1 }] }),
  )
  assert.throws(() =>
    validateLayout({ objects: [colored("a", 4, 0, 4, { storedObjectId: -3 })] }),
  )
  assert.throws(() => validateLayout({ objects: [colored("a", 5, TABLE_TOP, 5)] }))
})

const spec = (part = {}) => ({
  v: 1,
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  group: identity,
  parts: [
    {
      shape: { kind: "sphere", radius: 1 },
      matrix: identity,
      spacing: 0.05,
      samples: "A".repeat(12),
      ...part,
    },
  ],
})

test("colored spec validation accepts the exported shape and rejects anything else", () => {
  assert.equal(validateColoredSpec(spec()).parts.length, 1)
  assert.equal(
    validateColoredSpec(
      spec({ samples: undefined, spacing: undefined, color: "#303645" }),
    ).parts[0].color,
    "#303645",
  )
  for (const bad of [
    spec({ shape: { kind: "script" } }),
    spec({ shape: { kind: "sphere", radius: -1 } }),
    spec({ matrix: [1, 2, 3] }),
    spec({ samples: "AAAA" }),
    spec({ samples: "<script>>>>" }),
    spec({ spacing: 0 }),
    spec({ color: "red" }),
    { ...spec(), v: 2 },
    { ...spec(), parts: [] },
    { ...spec(), bounds: { min: [0, 0, 0], max: [0, 1, 1] } },
  ])
    assert.throws(() => validateColoredSpec(bad))
  const many = spec({ samples: "A".repeat(12 * (MAX_SAMPLES + 1)) })
  assert.throws(() => validateColoredSpec(many), /너무 커요/)
})

test("thumbnail must be a small image data URL", () => {
  assert.ok(validateThumbnail("data:image/jpeg;base64,/9j/4AAQ"))
  assert.throws(() => validateThumbnail("https://example.com/a.png"))
  assert.throws(() => validateThumbnail("data:text/html;base64,PGgxPg=="))
})

test("only colored objects can be resized, within the allowed range", () => {
  const sized = (scale, extra = {}) => colored("c", 4, 0, 4, { scale, ...extra })
  assert.equal(placementError(sized(0.5), []), null)
  assert.equal(placementError(sized(1.5), []), null)
  assert.equal(placementError(sized(2.5), []), null)
  for (const bad of [0.4, 2.6, 3, 1.25, NaN, "1"])
    assert.ok(placementError(sized(bad), []), String(bad))
  assert.equal(validateLayout({ objects: [sized(1.3)] }).objects[0].scale, 1.3)
  assert.throws(() => validateLayout({ objects: [{ ...table, scale: 1.2 }] }))
})

test("a larger colored object needs more room on a table and on the floor", () => {
  const big = (x, y, z) => colored("c", x, y, z, { scale: 1.5 })
  // 0.9 폭 → 상판(깊이 1.0) 안쪽 한가운데만 가능
  assert.equal(placementError(big(0, TABLE_TOP, 0), [table]), null)
  assert.match(placementError(big(0, TABLE_TOP, 0.2), [table]), /테이블 위/)
  // 크기 1.5배는 바닥 가구와 더 멀리 떨어져야 한다
  assert.match(placementError(big(1.4, 0, 0), [table]), /겹쳐요/)
  assert.equal(placementError(colored("c", 1.4, 0, 0), [table]), null)
})

test("pyramid solids are dense enough to spray and validate as a shape", async () => {
  const { pyramidData, PYRAMID_DIVISIONS } = await import("../shared/solids.js")
  const d = pyramidData(1, 1)
  const faces = 4
  assert.equal(d.positions.length / 3, faces * ((PYRAMID_DIVISIONS + 1) * (PYRAMID_DIVISIONS + 2)) / 2)
  assert.equal(d.indices.length / 3, faces * PYRAMID_DIVISIONS * PYRAMID_DIVISIONS)
  // 모든 삼각형 변이 짧다 (큰 삼각형에는 스프레이가 닿지 않는다)
  let longest = 0
  for (let t = 0; t < d.indices.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = d.indices[t + k] * 3, b = d.indices[t + ((k + 1) % 3)] * 3
      longest = Math.max(longest, Math.hypot(d.positions[a] - d.positions[b], d.positions[a + 1] - d.positions[b + 1], d.positions[a + 2] - d.positions[b + 2]))
    }
  assert.ok(longest < 0.1, `longest edge ${longest}`)
  // 법선은 바깥쪽을 향한다
  for (let i = 0; i < d.positions.length; i += 3) {
    const out = d.normals[i] * d.positions[i] + d.normals[i + 1] * d.positions[i + 1] + d.normals[i + 2] * d.positions[i + 2]
    assert.ok(out >= -1e-9)
  }
  const spec = { v: 1, bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, group: identity, parts: [{ shape: { kind: "pyramid", radius: 1, height: 1 }, matrix: identity }] }
  assert.equal(validateColoredSpec(spec).parts[0].shape.kind, "pyramid")
  assert.throws(() => validateColoredSpec({ ...spec, parts: [{ shape: { kind: "pyramid", radius: 0, height: 1 }, matrix: identity }] }))
})

test("colored objects can be enlarged up to 2.5x and then no longer fit on a table", () => {
  const table = { id: "t", type: "table", position: { x: 0, y: 0, z: 0 }, rotation: 0, scale: 1 }
  const at = (scale, y, x = 0) => ({ id: "c", type: "colored", position: { x, y, z: 0 }, rotation: 0, scale, storedObjectId: 1 })
  assert.equal(placementError(at(2.5, 0, 6), []), null)
  assert.match(placementError(at(2.6, 0, 6), []), /크기/)
  // 2.5배(폭 1.5)는 테이블(깊이 1.0) 위에 올라갈 수 없고, 바닥에는 놓을 수 있다
  assert.match(placementError(at(2.5, TABLE_TOP), [table]), /테이블 위/)
  assert.equal(placementError(at(2.5, 0, 4), [table]), null)
  // 커진 만큼 방 가장자리에서도 더 떨어져야 한다
  assert.ok(placementError(at(2.5, 0, 11.5), []))
})
