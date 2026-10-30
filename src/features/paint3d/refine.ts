// 스프레이는 칠할 점 둘레의 "꼭짓점"에 색을 묻히므로, 꼭짓점이 듬성듬성한 큰 삼각형(원기둥 뚜껑, 길쭉한 면 등)은 가운데가 안 칠해진다.
// 화면 크기로 따져 변이 maxEdge보다 긴 삼각형만 1→4로 잘게 나눠 꼭짓점을 늘린다. 이미 촘촘한 모양은 그대로 둔다.
import * as THREE from "three";

export function refineLongEdges(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, maxEdge: number): THREE.BufferGeometry {
  const index = geometry.getIndex();
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  if (!index || !nor) return geometry; // 색인이 없는 모양(지붕, 삼각뿔)은 처음부터 촘촘하게 만든다

  const uv = geometry.getAttribute("uv");
  const P = Array.from(pos.array as ArrayLike<number>);
  const N = Array.from(nor.array as ArrayLike<number>);
  const U = uv ? Array.from(uv.array as ArrayLike<number>) : null;
  let I = Array.from(index.array as ArrayLike<number>);
  // 길이는 화면(월드) 기준으로 잰다
  const W: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < P.length; i += 3) W.push(...v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(matrix).toArray());
  const dist2 = (a: number, b: number) => (W[a * 3] - W[b * 3]) ** 2 + (W[a * 3 + 1] - W[b * 3 + 1]) ** 2 + (W[a * 3 + 2] - W[b * 3 + 2]) ** 2;
  const limit2 = maxEdge * maxEdge;
  const tooLong = (a: number, b: number, c: number) => Math.max(dist2(a, b), dist2(b, c), dist2(c, a)) > limit2;

  let any = false;
  for (let t = 0; t < I.length && !any; t += 3) any = tooLong(I[t], I[t + 1], I[t + 2]);
  if (!any) return geometry;

  const mids = new Map<number, number>();
  const midpoint = (a: number, b: number) => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    const known = mids.get(key);
    if (known !== undefined) return known;
    const id = P.length / 3;
    for (let k = 0; k < 3; k++) {
      P.push((P[a * 3 + k] + P[b * 3 + k]) / 2);
      W.push((W[a * 3 + k] + W[b * 3 + k]) / 2);
    }
    const nx = N[a * 3] + N[b * 3], ny = N[a * 3 + 1] + N[b * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    N.push(nx / l, ny / l, nz / l);
    if (U) U.push((U[a * 2] + U[b * 2]) / 2, (U[a * 2 + 1] + U[b * 2 + 1]) / 2);
    mids.set(key, id);
    return id;
  };

  // 너무 긴 삼각형이 없어질 때까지 (무한히 늘지 않게 최대 6번)
  for (let round = 0; round < 6; round++) {
    const next: number[] = [];
    let split = false;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      if (!tooLong(a, b, c)) {
        next.push(a, b, c);
        continue;
      }
      split = true;
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    I = next;
    if (!split) break;
  }

  const refined = new THREE.BufferGeometry();
  refined.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  refined.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  if (U) refined.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  refined.setIndex(I);
  // 마이룸으로 수납할 때 어떤 모양이었는지 알 수 있게 원래 정보를 이어 둔다
  (refined as { type: string }).type = geometry.type;
  (refined as unknown as { parameters: unknown }).parameters = (geometry as unknown as { parameters: unknown }).parameters;
  Object.assign(refined.userData, geometry.userData);
  geometry.dispose();
  return refined;
}
