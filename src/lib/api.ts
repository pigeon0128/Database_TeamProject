// API 서버(server/index.js) 호출. 개발 중에는 Vite가 /api 요청을 API 서버로 넘긴다.

export type User = { id: number; loginId: string };

export type Drawing = {
  id: number;
  title: string;
  referenceImageKey: string;
  order: number;
  chapter: { id: number; title: string; order: number };
};

export type LeaderboardEntry = {
  ranking: number;
  userId: number;
  nickname: string;
  score: number;
  durationMs: number;
  playedAt: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const SERVER_DOWN = "API 서버에 연결할 수 없어요. 터미널에서 pnpm dev:server 가 실행 중인지 확인해 주세요.";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(SERVER_DOWN, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // API 서버가 꺼져 있으면 Vite 프록시가 JSON 이 아닌 오류를 돌려준다.
    throw new ApiError(data?.error ?? SERVER_DOWN, res.status);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>("GET", "/auth/me"),
  login: (loginId: string, password: string) => request<{ user: User }>("POST", "/auth/login", { loginId, password }),
  register: (loginId: string, password: string) => request<{ user: User }>("POST", "/auth/register", { loginId, password }),
  logout: () => request<{ ok: true }>("POST", "/auth/logout"),
  drawings: () => request<{ drawings: Drawing[] }>("GET", "/drawings"),
  savePlayRecord: (drawingId: number, similarityScore: number, durationMs: number) =>
    request<{ recordId: number; playedAt: string }>("POST", "/play-records", { drawingId, similarityScore, durationMs }),
  leaderboard: (drawingId: number, limit = 10) =>
    request<{ top: LeaderboardEntry[]; me: LeaderboardEntry | null }>("GET", `/leaderboard?drawingId=${drawingId}&limit=${limit}`),
};
