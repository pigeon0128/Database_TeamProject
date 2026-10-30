// 색칠한 캐릭터를 마이룸(Babylon.js)이 다시 만들 수 있는 모양 정보로 바꾼다.
// 모양은 프리미티브(구·상자·원뿔·원기둥·고리·지붕)와 변환 행렬, 칠해진 꼭짓점의 위치+색(샘플)만 보낸다.
// 마이룸은 같은 프리미티브를 MeshBuilder로 만들고, 정점마다 가장 가까운 샘플의 색을 입힌다.
import * as THREE from "three";

/** 샘플 좌표를 int16으로 담는 배율 (마이룸 shared/colored.js 의 SAMPLE_SCALE 과 같아야 한다) */
const SAMPLE_SCALE = 4096;
/** 흰색(칠하지 않음)과 이만큼 이상 다르면 칠한 것으로 본다 */
const PAINT_EPSILON = 0.004;

export const MAX_SAMPLES = 400000;

type Shape =
  | { kind: "sphere"; radius: number }
  | { kind: "box"; size: number[] }
  | { kind: "cone"; radius: number; height: number; segments: number }
  | { kind: "cylinder"; rTop: number; rBottom: number; height: number; segments: number }
  | { kind: "torus"; radius: number; tube: number; arc: number }
  | { kind: "pyramid"; radius: number; height: number }
  | { kind: "roof" };

export type RoomPart = { shape: Shape; matrix: number[]; color?: string; spacing?: number; samples?: string };
export type RoomSpec = {
  v: 1;
  bounds: { min: number[]; max: number[] };
  group: number[];
  parts: RoomPart[];
};

function shapeOf(geometry: THREE.BufferGeometry): Shape {
  const p = (geometry as unknown as { parameters: Record<string, number> }).parameters;
  switch (geometry.type) {
    case "SphereGeometry":
      return { kind: "sphere", radius: p.radius };
    case "BoxGeometry":
      return { kind: "box", size: [p.width, p.height, p.depth] };
    case "ConeGeometry":
      return { kind: "cone", radius: p.radius, height: p.height, segments: p.radialSegments };
    case "CylinderGeometry":
      return { kind: "cylinder", rTop: p.radiusTop, rBottom: p.radiusBottom, height: p.height, segments: p.radialSegments };
    case "TorusGeometry":
      return { kind: "torus", radius: p.radius, tube: p.tube, arc: p.arc };
    default:
      if (geometry.userData.kind === "roof") return { kind: "roof" };
      if (geometry.userData.kind === "pyramid") return { kind: "pyramid", radius: geometry.userData.radius, height: geometry.userData.height };
      throw new Error(`마이룸으로 보낼 수 없는 모양이에요: ${geometry.type}`);
  }
}

/** 삼각형 변의 평균 길이: 정점 간격. 마이룸이 샘플을 이웃 정점에 옮길 때 허용 거리로 쓴다. */
function vertexSpacing(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let sum = 0, edges = 0;
  for (let i = 0; i + 2 < count; i += 3) {
    const [x, y, z] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(pos, x); b.fromBufferAttribute(pos, y); c.fromBufferAttribute(pos, z);
    sum += a.distanceTo(b) + b.distanceTo(c) + c.distanceTo(a);
    edges += 3;
  }
  return edges ? sum / edges : 0.05;
}

const toSrgb = (linear: number) => {
  const v = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

function toBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** 칠해진 꼭짓점만 (x,y,z int16 + r,g,b) 9바이트씩 모아 base64 로 */
function paintedSamples(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  const colors = geometry.getAttribute("color").array as Float32Array;
  const kept: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const least = Math.min(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
    if (1 - least > PAINT_EPSILON) kept.push(i);
  }
  const bytes = new Uint8Array(kept.length * 9);
  const view = new DataView(bytes.buffer);
  const clamp = (n: number) => Math.max(-32768, Math.min(32767, Math.round(n * SAMPLE_SCALE)));
  kept.forEach((v, n) => {
    view.setInt16(n * 9, clamp(pos.getX(v)), true);
    view.setInt16(n * 9 + 2, clamp(pos.getY(v)), true);
    view.setInt16(n * 9 + 4, clamp(pos.getZ(v)), true);
    for (let k = 0; k < 3; k++) bytes[n * 9 + 6 + k] = toSrgb(colors[v * 3 + k]);
  });
  return { count: kept.length, samples: toBase64(bytes) };
}

/**
 * 시안 화면에서는 보기 좋게 모델마다 살짝 비틀어 놓았지만(group.rotation), 방에 놓을 오브젝트는 똑바로 정면을 보게 한다.
 * 그래서 크기(배율)만 남기고 회전·위치는 버린다. 방에서 바닥 중앙에 맞추는 건 아래 bounds로 마이룸이 한다.
 */
export function serializeForRoom(group: THREE.Group): RoomSpec {
  group.updateMatrix();
  const upright = new THREE.Matrix4().makeScale(group.scale.x, group.scale.y, group.scale.z);
  const bounds = new THREE.Box3();
  const parts: RoomPart[] = [];
  let total = 0;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.updateMatrix();
    const geometry = child.geometry as THREE.BufferGeometry;
    const part: RoomPart = { shape: shapeOf(geometry), matrix: child.matrix.toArray() };
    if (geometry.getAttribute("color")) {
      const { count, samples } = paintedSamples(geometry);
      total += count;
      if (count) Object.assign(part, { spacing: vertexSpacing(geometry), samples });
    } else {
      part.color = `#${(child.material as THREE.MeshStandardMaterial).color.getHexString()}`;
    }
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    bounds.union(geometry.boundingBox!.clone().applyMatrix4(upright.clone().multiply(child.matrix)));
    parts.push(part);
  }
  if (total > MAX_SAMPLES) throw new Error("칠한 부분이 너무 많아서 수납할 수 없어요.");
  return { v: 1, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, group: upright.toArray(), parts };
}

/** 지금 보이는 화면을 작은 정사각형 미리보기(JPEG data URL)로 줄인다. */
export function makeThumbnail(pngDataUrl: string, size = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f4f7fb";
      ctx.fillRect(0, 0, size, size);
      const ratio = Math.min(size / image.width, size / image.height);
      ctx.drawImage(image, (size - image.width * ratio) / 2, (size - image.height * ratio) / 2, image.width * ratio, image.height * ratio);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => reject(new Error("미리보기를 만들지 못했어요."));
    image.src = pngDataUrl;
  });
}
