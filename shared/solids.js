// 색칠 앱(three.js)과 마이룸(Babylon.js)이 똑같이 만드는 촘촘한 입체.
// 삼각형 면을 격자로 잘게 나눠야 스프레이(정점 색)가 면 한가운데에도 닿고, 마이룸에서도 같은 자리에 색이 옮겨진다.
export const PYRAMID_DIVISIONS = 24

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const normalize = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * 볼록한 입체의 삼각형 면들을 각각 divisions×divisions 칸으로 나눈다 (면마다 평평한 법선, 바깥쪽을 향함).
 * faces: [[a, b, c], ...] 꼭짓점 좌표, center: 입체 안쪽의 한 점
 */
export function triangleSoup(faces, divisions, center = [0, 0, 0]) {
  const D = divisions
  const positions = [],
    normals = [],
    indices = []
  for (const [a, b0, c0] of faces) {
    let b = b0,
      c = c0
    let n = normalize(cross(sub(b, a), sub(c, a)))
    if (n[0] * (a[0] - center[0]) + n[1] * (a[1] - center[1]) + n[2] * (a[2] - center[2]) < 0) {
      ;[b, c] = [c, b]
      n = [-n[0], -n[1], -n[2]]
    }
    const start = []
    let count = positions.length / 3
    for (let i = 0; i <= D; i++) {
      start.push(count)
      for (let j = 0; j <= D - i; j++) {
        for (let k = 0; k < 3; k++)
          positions.push(a[k] + ((b[k] - a[k]) * i) / D + ((c[k] - a[k]) * j) / D)
        normals.push(n[0], n[1], n[2])
        count++
      }
    }
    for (let i = 0; i < D; i++)
      for (let j = 0; j < D - i; j++) {
        indices.push(start[i] + j, start[i + 1] + j, start[i] + j + 1)
        if (j < D - i - 1)
          indices.push(start[i + 1] + j, start[i + 1] + j + 1, start[i] + j + 1)
      }
  }
  return { positions, normals, indices }
}

/** 삼각뿔: three.js ConeGeometry(radius, height, 3)와 같은 자리 (꼭대기 +y, 바닥이 -y). 로켓 날개 등 */
export function pyramidData(radius, height, divisions = PYRAMID_DIVISIONS) {
  const apex = [0, height / 2, 0]
  const base = [0, 1, 2].map((i) => {
    const t = (i * Math.PI * 2) / 3
    return [radius * Math.sin(t), -height / 2, radius * Math.cos(t)]
  })
  return triangleSoup(
    [
      [apex, base[0], base[1]],
      [apex, base[1], base[2]],
      [apex, base[2], base[0]],
      [base[0], base[1], base[2]],
    ],
    divisions,
  )
}
