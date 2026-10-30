// 마이룸 수납함 API (같은 서버, 로그인 쿠키 사용). 칠한 모양과 색을 보내면 마이룸이 Babylon.js로 다시 만든다.
export class RoomError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type StoredObject = { id: number; name: string };

export async function storeInRoom(body: { name: string; sourceModel: string; thumbnail: string; spec: unknown }): Promise<StoredObject> {
  let res: Response;
  try {
    res = await fetch("/api/myroom/storage", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RoomError("마이룸 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", 0);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new RoomError("로그인이 만료됐어요. 다시 로그인해 주세요.", 401);
  if (!res.ok) throw new RoomError(data?.error ?? "수납하지 못했어요.", res.status);
  return data;
}
