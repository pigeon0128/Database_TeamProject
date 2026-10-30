import { ApiError } from "../../lib/api"
import type { ColoredSpec, RoomLayout, RoomState, StoredSummary } from "./types"

async function request<T = RoomState>(
  method: string,
  body?: unknown,
  path = "/api/myroom",
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(
      "방 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
      0,
    )
  }
  const data = await res.json().catch(() => null)
  if (!res.ok)
    throw new ApiError(data?.error ?? "방을 불러오지 못했어요.", res.status)
  return data
}
export const myroomApi = {
  load: () => request("GET"),
  save: (layout: RoomLayout, expectedRevision: number) =>
    request("PUT", { schemaVersion: 1, expectedRevision, layout }),
  storage: () =>
    request<{ objects: StoredSummary[] }>("GET", undefined, "/api/myroom/storage").then(
      (r) => r.objects,
    ),
  removeStored: (id: number) =>
    request<{ ok: true }>("DELETE", undefined, `/api/myroom/storage/${id}`),
  stored: (id: number) =>
    request<StoredSummary & { spec: ColoredSpec }>(
      "GET",
      undefined,
      `/api/myroom/storage/${id}`,
    ),
}
