export declare const PYRAMID_DIVISIONS: number
export type SoupData = { positions: number[]; normals: number[]; indices: number[] }
export declare function triangleSoup(
  faces: [number[], number[], number[]][],
  divisions: number,
  center?: number[],
): SoupData
export declare function pyramidData(radius: number, height: number, divisions?: number): SoupData
