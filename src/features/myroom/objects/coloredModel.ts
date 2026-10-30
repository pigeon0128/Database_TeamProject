// 3D 색칠하기에서 수납한 오브젝트를 Babylon MeshBuilder로 다시 만든다.
// 색칠 앱(three.js)과 좌표를 그대로 쓰고, 부위마다 칠해진 꼭짓점 샘플(위치+색)을 가장 가까운 정점에 옮겨 입힌다.
// three.js는 오른손 좌표계, Babylon은 왼손 좌표계라서 맨 바깥에서 z를 뒤집어 같은 모습이 되게 한다.
import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Scene } from "@babylonjs/core/scene"
import { SAMPLE_SCALE } from "../../../../shared/colored.js"
import { pyramidData } from "../../../../shared/solids.js"
import type { ColoredPart, ColoredSpec } from "../types"

/** 방 안에서 색칠 오브젝트가 차지하는 크기 (shared/myroom.js CATALOG.colored 와 같다) */
const FIT = { horizontal: 0.6, height: 0.9 }

type Vec = [number, number, number]

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const normalize = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** 면 하나를 n×n 칸으로 나눠 꼭짓점·법선·삼각형을 더한다 (원점 a, 방향 u·v) */
function gridFace(
  out: { p: number[]; n: number[]; i: number[] },
  a: Vec,
  u: Vec,
  v: Vec,
  normal: Vec,
  n: number,
) {
  const base = out.p.length / 3
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      out.p.push(
        a[0] + (u[0] * i) / n + (v[0] * j) / n,
        a[1] + (u[1] * i) / n + (v[1] * j) / n,
        a[2] + (u[2] * i) / n + (v[2] * j) / n,
      )
      out.n.push(...normal)
    }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = base + j * (n + 1) + i
      out.i.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1)
    }
}

function boxData(size: Vec) {
  const out = { p: [] as number[], n: [] as number[], i: [] as number[] }
  const [w, h, d] = size.map((s) => s / 2)
  const N = 32
  gridFace(out, [-w, -h, d], [2 * w, 0, 0], [0, 2 * h, 0], [0, 0, 1], N)
  gridFace(out, [w, -h, -d], [-2 * w, 0, 0], [0, 2 * h, 0], [0, 0, -1], N)
  gridFace(out, [w, -h, d], [0, 0, -2 * d], [0, 2 * h, 0], [1, 0, 0], N)
  gridFace(out, [-w, -h, -d], [0, 0, 2 * d], [0, 2 * h, 0], [-1, 0, 0], N)
  gridFace(out, [-w, h, d], [2 * w, 0, 0], [0, 0, -2 * d], [0, 1, 0], N)
  gridFace(out, [-w, -h, -d], [2 * w, 0, 0], [0, 0, 2 * d], [0, -1, 0], N)
  return out
}

/** 집 지붕: 삼각기둥. 색칠 앱(createRoofGeometry)과 같은 크기이고 모든 면을 40칸으로 나눈다. */
function roofData() {
  const A = (z: number): Vec => [-0.91, -0.35, z],
    B = (z: number): Vec => [0.91, -0.35, z],
    C = (z: number): Vec => [0, 0.7, z]
  const z0 = -0.775,
    z1 = 0.775
  const faces: [Vec, Vec, Vec][] = [
    [A(z0), B(z0), C(z0)],
    [A(z1), B(z1), C(z1)],
    [A(z0), B(z0), B(z1)],
    [A(z0), B(z1), A(z1)],
    [B(z0), C(z0), C(z1)],
    [B(z0), C(z1), B(z1)],
    [C(z0), A(z0), A(z1)],
    [C(z0), A(z1), C(z1)],
  ]
  const center: Vec = [0, 0, 0]
  const out = { p: [] as number[], n: [] as number[], i: [] as number[] }
  const D = 40
  for (const [a, b0, c0] of faces) {
    let b = b0,
      c = c0
    let nrm = normalize(cross(sub(b, a), sub(c, a)))
    if (nrm[0] * (a[0] - center[0]) + nrm[1] * (a[1] - center[1]) + nrm[2] * (a[2] - center[2]) < 0) {
      ;[b, c] = [c, b]
      nrm = [-nrm[0], -nrm[1], -nrm[2]]
    }
    const base = out.p.length / 3
    for (let i = 0; i <= D; i++)
      for (let j = 0; j <= D - i; j++) {
        out.p.push(
          a[0] + ((b[0] - a[0]) * i) / D + ((c[0] - a[0]) * j) / D,
          a[1] + ((b[1] - a[1]) * i) / D + ((c[1] - a[1]) * j) / D,
          a[2] + ((b[2] - a[2]) * i) / D + ((c[2] - a[2]) * j) / D,
        )
        out.n.push(...nrm)
      }
    // i번째 줄에는 D+1-i 개의 꼭짓점이 있다.
    let offset = base
    const start: number[] = []
    for (let i = 0; i <= D; i++) {
      start.push(offset)
      offset += D + 1 - i
    }
    for (let i = 0; i < D; i++)
      for (let j = 0; j < D - i; j++) {
        out.i.push(start[i] + j, start[i + 1] + j, start[i] + j + 1)
        if (j < D - i - 1)
          out.i.push(start[i + 1] + j, start[i + 1] + j + 1, start[i] + j + 1)
      }
  }
  return out
}

function customMesh(name: string, data: ReturnType<typeof boxData>, scene: Scene) {
  const mesh = new Mesh(name, scene)
  const vertexData = new VertexData()
  vertexData.positions = data.p
  vertexData.normals = data.n
  vertexData.indices = data.i
  vertexData.applyToMesh(mesh, true)
  return mesh
}

function createShape(name: string, part: ColoredPart, scene: Scene): Mesh {
  const s = part.shape
  switch (s.kind) {
    case "sphere":
      return MeshBuilder.CreateSphere(name, { diameter: s.radius * 2, segments: 48, updatable: true }, scene)
    case "box":
      return customMesh(name, boxData(s.size as Vec), scene)
    case "roof":
      return customMesh(name, roofData(), scene)
    case "pyramid": {
      const d = pyramidData(s.radius, s.height)
      return customMesh(name, { p: d.positions, n: d.normals, i: d.indices }, scene)
    }
    case "cone":
      return MeshBuilder.CreateCylinder(
        name,
        {
          height: s.height,
          diameterTop: 0,
          diameterBottom: s.radius * 2,
          tessellation: s.segments,
          subdivisions: 40,
          updatable: true,
        },
        scene,
      )
    case "cylinder":
      return MeshBuilder.CreateCylinder(
        name,
        {
          height: s.height,
          diameterTop: s.rTop * 2,
          diameterBottom: s.rBottom * 2,
          tessellation: s.segments,
          subdivisions: 24,
          updatable: true,
        },
        scene,
      )
    case "torus": {
      // three.js TorusGeometry는 XY 평면에서 0 → arc 로 돈다.
      const count = Math.max(24, Math.ceil((s.arc / (Math.PI * 2)) * 64))
      const path: Vector3[] = []
      for (let i = 0; i <= count; i++) {
        const a = (s.arc * i) / count
        path.push(new Vector3(Math.cos(a) * s.radius, Math.sin(a) * s.radius, 0))
      }
      return MeshBuilder.CreateTube(
        name,
        { path, radius: s.tube, tessellation: 16, cap: Mesh.CAP_ALL, updatable: true },
        scene,
      )
    }
  }
}

type Samples = { count: number; data: Int16Array; rgb: Uint8Array }

function decodeSamples(base64: string): Samples {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const count = bytes.length / 9
  const data = new Int16Array(count * 3)
  const rgb = new Uint8Array(count * 3)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) data[i * 3 + k] = view.getInt16(i * 9 + k * 2, true)
    rgb.set(bytes.subarray(i * 9 + 6, i * 9 + 9), i * 3)
  }
  return { count, data, rgb }
}

/** 부위의 칠한 흔적을 정점마다 색(RGBA)으로 바꾼다. 칠하지 않은 곳은 흰색. */
function paintColors(positions: ArrayLike<number>, part: ColoredPart): Float32Array {
  const vertexCount = positions.length / 3
  const colors = new Float32Array(vertexCount * 4).fill(1)
  if (!part.samples || !part.spacing) return colors
  const { count, data, rgb } = decodeSamples(part.samples)
  const cell = Math.max(part.spacing, 0.004)
  const reach = part.spacing * part.spacing
  const key = (x: number, y: number, z: number) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024)
  const grid = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    const k = key(
      Math.floor(data[i * 3] / SAMPLE_SCALE / cell),
      Math.floor(data[i * 3 + 1] / SAMPLE_SCALE / cell),
      Math.floor(data[i * 3 + 2] / SAMPLE_SCALE / cell),
    )
    const list = grid.get(k)
    if (list) list.push(i)
    else grid.set(k, [i])
  }
  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3],
      y = positions[v * 3 + 1],
      z = positions[v * 3 + 2]
    const cx = Math.floor(x / cell),
      cy = Math.floor(y / cell),
      cz = Math.floor(z / cell)
    let best = -1,
      bestDistance = reach
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(key(cx + dx, cy + dy, cz + dz))
          if (!list) continue
          for (const i of list) {
            const ex = data[i * 3] / SAMPLE_SCALE - x,
              ey = data[i * 3 + 1] / SAMPLE_SCALE - y,
              ez = data[i * 3 + 2] / SAMPLE_SCALE - z
            const d = ex * ex + ey * ey + ez * ez
            if (d <= bestDistance) {
              bestDistance = d
              best = i
            }
          }
        }
    if (best >= 0)
      for (let k = 0; k < 3; k++) colors[v * 4 + k] = rgb[best * 3 + k] / 255
  }
  return colors
}

// 정점 색은 스펙마다 한 번만 계산하고, 방이 다시 그려져도(선택 등) 재사용한다.
const colorCache = new WeakMap<ColoredSpec, Float32Array[]>()

function setMatrix(node: TransformNode, elements: number[]) {
  const scale = new Vector3(),
    rotation = new Quaternion(),
    position = new Vector3()
  Matrix.FromArray(elements).decompose(scale, rotation, position)
  node.scaling = scale
  node.rotationQuaternion = rotation
  node.position = position
}

/** 색칠 오브젝트 하나를 root 아래에 만든다. 만든 메쉬와 재질을 돌려준다. */
export function buildColoredObject(
  scene: Scene,
  root: TransformNode,
  id: string,
  spec: ColoredSpec,
): { pieces: Mesh[]; materials: StandardMaterial[] } {
  const materials: StandardMaterial[] = []
  const makeMaterial = (name: string, color: Color3) => {
    const m = new StandardMaterial(`${id}-${name}`, scene)
    m.diffuseColor = color
    m.specularColor = Color3.Black()
    m.backFaceCulling = false
    m.twoSidedLighting = true
    materials.push(m)
    return m
  }
  // 방 조명이 색칠 화면보다 어두워서 칠한 색이 가라앉지 않게 조금 밝힌다.
  const painted = makeMaterial("painted", new Color3(1.3, 1.3, 1.3))
  const solid = new Map<string, StandardMaterial>()

  const { min, max } = spec.bounds
  const ex = max[0] - min[0],
    ey = max[1] - min[1],
    ez = max[2] - min[2]
  const scale = Math.min(FIT.horizontal / Math.max(ex, ez), FIT.height / ey)
  const fit = new TransformNode(`${id}-fit`, scene)
  fit.parent = root
  fit.scaling.setAll(scale)
  fit.position.set(-((min[0] + max[0]) / 2) * scale, -min[1] * scale, ((min[2] + max[2]) / 2) * scale)
  const flip = new TransformNode(`${id}-flip`, scene)
  flip.parent = fit
  flip.scaling.z = -1
  const group = new TransformNode(`${id}-group`, scene)
  group.parent = flip
  setMatrix(group, spec.group)

  let cached = colorCache.get(spec)
  const fresh: Float32Array[] = []
  const pieces: Mesh[] = []
  spec.parts.forEach((part, index) => {
    const mesh = createShape(`${id}-part-${index}`, part, scene)
    mesh.parent = group
    setMatrix(mesh, part.matrix)
    if (part.color) {
      let m = solid.get(part.color)
      if (!m) {
        m = makeMaterial(`solid-${part.color}`, Color3.FromHexString(part.color))
        solid.set(part.color, m)
      }
      mesh.material = m
    } else {
      const colors =
        cached?.[index] ?? paintColors(mesh.getVerticesData(VertexBuffer.PositionKind)!, part)
      fresh[index] = colors
      mesh.setVerticesData(VertexBuffer.ColorKind, colors, false)
      mesh.material = painted
    }
    pieces.push(mesh)
  })
  if (!cached) colorCache.set(spec, fresh)
  return { pieces, materials }
}
