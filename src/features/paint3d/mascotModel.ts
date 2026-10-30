import * as THREE from "three";
import { PYRAMID_DIVISIONS, pyramidData } from "../../../shared/solids.js";
import { refineLongEdges } from "./refine";

/** 스프레이가 어디에 닿아도 정점이 몇 개는 걸리도록, 화면 기준 삼각형 변의 최대 길이 */
const MAX_EDGE = 0.07;

/** 삼각뿔 (로켓 날개 등). 면마다 촘촘히 나눠 둔다 */
function createPyramidGeometry(radius: number, height: number) {
  const data = pyramidData(radius, height, PYRAMID_DIVISIONS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setIndex(data.indices);
  geometry.userData.kind = "pyramid"; // 마이룸으로 수납할 때 모양 구분용
  geometry.userData.radius = radius;
  geometry.userData.height = height;
  return geometry;
}

export const BASE_COLOR = "#ffffff";
import type { ModelId } from "./models";
export { MODELS, type ModelId } from "./models";
export type MascotModel = { group: THREE.Group; paintables: THREE.Mesh[] };
type XYZ = [number, number, number];

/** 지붕 앞뒤 삼각면과 두 경사면, 밑면까지 균일하게 세분화한다. */
function createRoofGeometry() {
  const outline = new THREE.Shape();
  outline.moveTo(-0.91, -0.35);
  outline.lineTo(0.91, -0.35);
  outline.lineTo(0, 0.7);
  outline.closePath();
  const prism = new THREE.ExtrudeGeometry(outline, { depth: 1.55, bevelEnabled: false, steps: 1 });
  prism.translate(0, 0, -0.775);
  const source = prism.getAttribute("position");
  const vertices: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const point = new THREE.Vector3();
  const divisions = 40;
  const emit = (i: number, j: number) => {
    point.copy(a).addScaledVector(b, i / divisions).addScaledVector(c, j / divisions);
    vertices.push(point.x, point.y, point.z);
  };
  for (let face = 0; face < source.count; face += 3) {
    a.fromBufferAttribute(source, face);
    b.fromBufferAttribute(source, face + 1).sub(a);
    c.fromBufferAttribute(source, face + 2).sub(a);
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions - i; j++) {
        emit(i, j); emit(i + 1, j); emit(i, j + 1);
        if (i + j < divisions - 1) {
          emit(i + 1, j); emit(i + 1, j + 1); emit(i, j + 1);
        }
      }
    }
  }
  prism.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.userData.kind = "roof"; // 마이룸으로 수납할 때 모양 구분용
  return geometry;
}

// 각 부품은 독립된 색 버퍼를 가진다. 귀 안쪽, 배, 코도 별도 부위다.
export function createMascot(id: ModelId = "monster"): MascotModel {
  const group = new THREE.Group();
  const paintables: THREE.Mesh[] = [];
  const part = (name: string, geometry: THREE.BufferGeometry, position: XYZ, scale: XYZ = [1, 1, 1], rotation: XYZ = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    mesh.name = name;
    mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
    group.add(mesh); paintables.push(mesh);
    return mesh;
  };
  const ball = (name: string, p: XYZ, s: XYZ) => part(name, new THREE.SphereGeometry(1, 80, 60), p, s);
  const cone = (name: string, p: XYZ, s: XYZ, r: XYZ = [0, 0, 0]) => part(name, new THREE.ConeGeometry(1, 1, 64, 40), p, s, r);
  const box = (name: string, p: XYZ, s: XYZ) => part(name, new THREE.BoxGeometry(1, 1, 1, 32, 32, 32), p, s);
  const ink = new THREE.MeshStandardMaterial({ color: "#303645", roughness: 0.5 });
  const dark = (geometry: THREE.BufferGeometry, p: XYZ, s: XYZ = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(geometry, ink); mesh.position.set(...p); mesh.scale.set(...s); group.add(mesh); return mesh;
  };
  const face = (y: number, z: number, spacing = 0.23) => {
    for (const side of [-1, 1]) dark(new THREE.SphereGeometry(0.065, 20, 16), [side * spacing, y, z], [1, 1.25, 0.55]);
    const smile = dark(new THREE.TorusGeometry(0.105, 0.018, 10, 32, Math.PI), [0, y - 0.16, z + 0.025]);
    smile.rotation.z = Math.PI;
  };
  const limbs = (robot = false) => {
    for (const side of [-1, 1]) {
      const label = side < 0 ? "왼" : "오른";
      if (robot) {
        ball(`${label} 어깨`, [side * 0.72, -0.2, 0], [0.16, 0.16, 0.16]);
        box(`${label}팔`, [side * 0.87, -0.48, 0], [0.3, 0.55, 0.36]);
        box(`${label}발`, [side * 0.34, -1.12, 0.12], [0.42, 0.34, 0.64]);
      } else {
        ball(`${label}팔`, [side * 0.68, -0.45, 0.02], [0.23, 0.38, 0.25]);
        ball(`${label}발`, [side * 0.35, -1.06, 0.18], [0.29, 0.22, 0.4]);
      }
    }
  };

  const wheel = (name: string, p: XYZ) => part(name, new THREE.CylinderGeometry(0.27, 0.27, 0.18, 64, 16), p, [1, 1, 1], [0, 0, Math.PI / 2]);
  if (id === "car") {
    box("차체", [0, -0.25, 0], [1.15, 0.5, 1.95]);
    box("운전석", [0, 0.21, -0.12], [1, 0.55, 1]);
    box("앞 유리", [0, 0.23, 0.395], [0.85, 0.36, 0.035]);
    box("뒷 유리", [0, 0.23, -0.635], [0.85, 0.36, 0.035]);
    for (const side of [-1, 1]) {
      const label = side < 0 ? "왼쪽" : "오른쪽";
      box(`${label} 창문`, [side * 0.515, 0.23, -0.12], [0.035, 0.35, 0.78]);
      ball(`${label} 전조등`, [side * 0.37, -0.2, 0.98], [0.16, 0.12, 0.04]);
      for (const z of [-0.62, 0.62]) wheel(`${label} ${z > 0 ? "앞" : "뒤"}바퀴`, [side * 0.61, -0.48, z]);
    }
    box("앞 범퍼", [0, -0.42, 1], [0.9, 0.13, 0.1]);
    group.rotation.y = -0.5;
  } else if (id === "rocket") {
    part("동체", new THREE.CylinderGeometry(0.43, 0.43, 1.4, 80, 60), [0, 0.05, 0]);
    cone("로켓 머리", [0, 1.04, 0], [0.44, 0.6, 0.44]);
    ball("창문 테두리", [0, 0.25, 0.415], [0.25, 0.25, 0.08]);
    ball("둥근 창문", [0, 0.25, 0.48], [0.18, 0.18, 0.035]);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      part(`날개 ${i + 1}`, createPyramidGeometry(1, 1), [Math.cos(angle) * 0.43, -0.48, Math.sin(angle) * 0.43], [0.42, 0.75, 0.22], [0, -angle, 0]);
    }
    part("분사구", new THREE.CylinderGeometry(0.25, 0.33, 0.25, 64, 16), [0, -0.76, 0]);
    cone("불꽃", [0, -1.12, 0], [0.24, 0.55, 0.24], [Math.PI, 0, 0]);
  } else if (id === "plane") {
    ball("비행기 동체", [0, 0, 0], [0.28, 0.3, 1.1]);
    ball("조종석 창문", [0, 0.22, 0.55], [0.23, 0.17, 0.3]);
    for (const side of [-1, 1]) {
      const label = side < 0 ? "왼쪽" : "오른쪽";
      ball(`${label} 날개`, [side * 0.7, -0.04, 0.05], [0.83, 0.075, 0.38]);
      ball(`${label} 꼬리날개`, [side * 0.35, 0.08, -0.81], [0.43, 0.06, 0.23]);
      ball(`${label} 엔진`, [side * 0.6, -0.2, 0.16], [0.16, 0.17, 0.38]);
    }
    ball("수직 꼬리날개", [0, 0.29, -0.78], [0.065, 0.37, 0.27]);
    group.rotation.set(0.18, -0.45, 0);
  } else if (id === "train") {
    box("기차 바닥", [0, -0.5, 0], [1.1, 0.24, 2]);
    part("보일러", new THREE.CylinderGeometry(0.39, 0.39, 1.1, 64, 40), [0, -0.02, 0.35], [1, 1, 1], [Math.PI / 2, 0, 0]);
    box("운전실", [0, 0.16, -0.55], [0.95, 1.05, 0.7]);
    box("운전실 지붕", [0, 0.73, -0.55], [1.12, 0.16, 0.9]);
    part("굴뚝", new THREE.CylinderGeometry(0.2, 0.13, 0.48, 48, 24), [0, 0.48, 0.6]);
    ball("앞 전조등", [0, 0, 0.92], [0.19, 0.19, 0.06]);
    for (const side of [-1, 1]) {
      const label = side < 0 ? "왼쪽" : "오른쪽";
      box(`${label} 창문`, [side * 0.485, 0.34, -0.55], [0.035, 0.36, 0.42]);
      for (let i = 0; i < 3; i++) wheel(`${label} 바퀴 ${i + 1}`, [side * 0.56, -0.62, -0.65 + i * 0.65]);
    }
    group.rotation.y = -0.55;
  } else if (id === "house") {
    box("집 벽", [0, -0.25, 0], [1.45, 1.25, 1.25]);
    // 삼각 단면의 모든 면을 촘촘하게 분할해야 꼭짓점 색칠이 면 중앙에도 닿는다.
    part("지붕", createRoofGeometry(), [0, 0.68, 0]);
    box("굴뚝", [0.43, 1.03, -0.22], [0.25, 0.52, 0.25]);
    box("문", [0, -0.48, 0.64], [0.4, 0.75, 0.055]);
    ball("문손잡이", [0.12, -0.48, 0.68], [0.04, 0.04, 0.035]);
    for (const side of [-1, 1]) {
      box(`${side < 0 ? "왼쪽" : "오른쪽"} 창틀`, [side * 0.49, -0.12, 0.65], [0.36, 0.4, 0.065]);
      box(`${side < 0 ? "왼쪽" : "오른쪽"} 유리`, [side * 0.49, -0.12, 0.69], [0.25, 0.29, 0.03]);
      box(`${side < 0 ? "왼쪽" : "오른쪽"} 옆 창문`, [side * 0.74, -0.12, 0], [0.04, 0.4, 0.4]);
    }
    box("집 받침", [0, -0.94, 0.07], [1.7, 0.12, 1.6]);
    group.rotation.y = -0.25;
  } else if (id === "gift") {
    box("선물상자", [0, -0.25, 0], [1.4, 1.2, 1.25]);
    box("뚜껑", [0, 0.43, 0], [1.53, 0.2, 1.38]);
    for (const side of [-1, 1]) {
      box(`${side > 0 ? "앞" : "뒤"} 리본`, [0, -0.25, side * 0.636], [0.24, 1.19, 0.025]);
      box(`${side > 0 ? "오른쪽" : "왼쪽"} 리본`, [side * 0.711, -0.25, 0], [0.025, 1.19, 0.24]);
      part(`${side < 0 ? "왼쪽" : "오른쪽"} 리본 고리`, new THREE.TorusGeometry(0.26, 0.075, 24, 80), [side * 0.25, 0.78, 0], [1, 0.72, 1], [0, side * 0.25, side * -0.35]);
    }
    box("뚜껑 세로 리본", [0, 0.54, 0], [0.24, 0.025, 1.38]);
    box("뚜껑 가로 리본", [0, 0.56, 0], [1.53, 0.025, 0.24]);
    ball("리본 매듭", [0, 0.68, 0.03], [0.15, 0.13, 0.13]);
    group.rotation.y = -0.35;
  } else if (id === "monster") {
    ball("몸통", [0, 0, 0], [1.05, 1.15, 0.95]);
    for (const side of [-1, 1]) {
      cone(side < 0 ? "왼쪽 뿔" : "오른쪽 뿔", [side * 0.58, 1.02, 0], [0.32, 0.6, 0.32], [0, 0, -side * 0.45]);
      ball(side < 0 ? "왼팔" : "오른팔", [side * 1.02, -0.15, 0.1], [0.23, 0.33, 0.23]);
      ball(side < 0 ? "왼다리" : "오른다리", [side * 0.45, -1.08, 0.12], [0.3, 0.18, 0.375]);
    }
    face(0.25, 0.93, 0.3);
  } else if (id === "robot") {
    box("몸통", [0, -0.4, 0], [1.12, 0.95, 0.65]);
    box("머리", [0, 0.55, 0], [1.35, 0.9, 0.75]);
    box("얼굴 화면", [0, 0.55, 0.39], [1.1, 0.64, 0.08]);
    ball("안테나", [0, 1.28, 0], [0.14, 0.14, 0.14]);
    part("안테나 기둥", new THREE.CylinderGeometry(0.045, 0.045, 0.25, 32, 16), [0, 1.08, 0]);
    ball("가슴 버튼", [0, -0.35, 0.35], [0.19, 0.19, 0.07]);
    limbs(true); face(0.62, 0.45, 0.28);
  } else if (id === "dino") {
    ball("몸통", [0, -0.4, 0], [0.68, 0.79, 0.54]);
    ball("머리", [0, 0.62, 0.06], [0.67, 0.62, 0.55]);
    ball("주둥이", [0, 0.4, 0.48], [0.58, 0.3, 0.34]);
    ball("배", [0, -0.46, 0.48], [0.43, 0.53, 0.1]);
    cone("꼬리", [0, -0.65, -0.85], [0.35, 1.3, 0.35], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) cone(`등 가시 ${i + 1}`, [0, 0.75 - i * 0.4, -0.47], [0.19, 0.35, 0.2], [-0.9, 0, 0]);
    limbs(); face(0.76, 0.56, 0.28);
  } else {
    ball("몸통", [0, -0.43, 0], [0.64, 0.72, 0.47]);
    ball("머리", [0, 0.57, 0], [0.76, 0.65, 0.56]);
    ball("배", [0, -0.46, 0.435], [0.4, 0.47, 0.075]);
    limbs();
    for (const side of [-1, 1]) {
      const label = side < 0 ? "왼쪽" : "오른쪽";
      if (id === "rabbit") {
        ball(`${label} 귀`, [side * 0.35, 1.37, -0.03], [0.2, 0.59, 0.19]);
        ball(`${label} 귀 안쪽`, [side * 0.35, 1.4, 0.14], [0.105, 0.4, 0.035]);
      } else if (id === "bear") {
        ball(`${label} 귀`, [side * 0.61, 1.02, -0.02], [0.29, 0.29, 0.2]);
        ball(`${label} 귀 안쪽`, [side * 0.61, 1.03, 0.16], [0.17, 0.17, 0.045]);
      } else {
        cone(`${label} 귀`, [side * 0.5, 1.1, 0], [0.29, 0.58, 0.24], [0, 0, -side * 0.2]);
        cone(`${label} 귀 안쪽`, [side * 0.5, 1.12, 0.15], [0.15, 0.32, 0.065], [0, 0, -side * 0.2]);
      }
    }
    if (id === "unicorn") {
      cone("마법 뿔", [0, 1.33, 0.28], [0.17, 0.65, 0.17]);
      ball("주둥이", [0, 0.35, 0.52], [0.41, 0.24, 0.18]);
      for (let i = 0; i < 4; i++) ball(`갈기 ${i + 1}`, [0, 0.9 - i * 0.3, -0.48], [0.27, 0.25, 0.22]);
      ball("꼬리", [0.35, -0.65, -0.5], [0.23, 0.42, 0.25]);
    } else {
      ball("입 주변", [0, 0.35, 0.51], [0.31, 0.22, 0.11]);
      dark(new THREE.SphereGeometry(0.075, 20, 16), [0, 0.44, 0.64], [1.2, 0.7, 0.6]);
      ball("꼬리", [id === "cat" ? 0.57 : 0, -0.64, -0.47], id === "cat" ? [0.18, 0.55, 0.2] : [0.24, 0.24, 0.24]);
    }
    face(0.65, 0.55);
  }
  // 긴 귀까지 화면 안에 들어오도록 모든 모델의 크기와 중심을 맞춘다.
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2.75 / Math.max(bounds.max.y - bounds.min.y, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
  group.position.copy(center).multiplyScalar(-scale); group.scale.setScalar(scale);
  group.updateMatrixWorld(true);
  // 화면 기준으로 너무 큰 삼각형은 잘게 나누고, 부위마다 독립된 색 버퍼(흰색)를 붙인다.
  for (const mesh of paintables) {
    mesh.geometry = refineLongEdges(mesh.geometry, mesh.matrixWorld, MAX_EDGE);
    mesh.geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(mesh.geometry.getAttribute("position").count * 3).fill(1), 3));
  }
  return { group, paintables };
}
