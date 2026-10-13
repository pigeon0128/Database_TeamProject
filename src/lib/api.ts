// API 서버(server/, 경로별 코드는 server/routes/) 호출. 개발 중에는 Vite가 /api 요청을 API 서버로 넘긴다.
import type { Stroke } from "./drawing/strokes";

export type User = { id: number; loginId: string };

export type Drawing = {
  id: number;
  title: string;
  referenceImageKey: string;
  order: number;
  chapter: { id: number; title: string; order: number };
};

/** 그리기 설정 (DB user_settings 한 행과 같은 모양. 값 범위는 서버 readSettings, DB CHECK 와 같다) */
export type DrawingSettings = {
  /** 브러쉬(지우개) 굵기. 2~48 */
  brushSize: number;
  /** 밑그림 보이기 */
  guideVisible: boolean;
  /** 밑그림 진하기 (%). 10~100 */
  guideOpacity: number;
  /** 손떨림 보정 세기 (%). 0~100 */
  smoothing: number;
  /** 선 끝 얇게(시작·끝 흐리기) 단계. 0~100, 0이면 끔 */
  fade: number;
  /** 사용자가 바꾼 단축키만 {동작: 키 조합}. 나머지는 기본 키 (lib/drawing/shortcuts.ts) */
  shortcuts: Partial<Record<string, string>>;
};


export type LeaderboardEntry = {
  ranking: number;
  /** 이 순위에 쓰인 기록 (그 사람의 최고 기록) */
  recordId: number;
  /** 그 기록에 완성 그림이 저장되어 있는지 */
  hasArtwork: boolean;
  userId: number;
  nickname: string;
  score: number;
  durationMs: number;
  playedAt: string;
};

/** 기록에 저장된 완성 그림 주소 (<img src> 에 그대로 쓴다) */
export const artworkUrl = (recordId: number) => `/api/artworks/${recordId}`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const SERVER_DOWN = "API 서버에 연결할 수 없어요. 터미널에서 pnpm dev:server 가 실행 중인지 확인해 주세요.";

/** keepalive: 페이지를 닫는 중에도 요청을 끝까지 보낸다 (설정 저장) */
async function request<T>(method: string, path: string, body?: unknown, { keepalive = false } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      keepalive,
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
  /** 로그인 화면에서 비밀번호 바꾸기. 아이디와 지금 비밀번호가 맞아야 바뀐다 (틀리면 401). 로그인은 하지 않는다 */
  changePassword: (loginId: string, currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("POST", "/auth/password", { loginId, currentPassword, newPassword }),
  drawings: () => request<{ drawings: Drawing[] }>("GET", "/drawings"),
  /** image: 완성 그림 (PNG data URL). 기록과 함께 한 번에 저장된다 */
  savePlayRecord: (drawingId: number, similarityScore: number, durationMs: number, image: string | null) =>
    request<{ recordId: number; playedAt: string; hasArtwork: boolean }>("POST", "/play-records", { drawingId, similarityScore, durationMs, image }),
  leaderboard: (drawingId: number, limit = 10) =>
    request<{ top: LeaderboardEntry[]; me: LeaderboardEntry | null }>("GET", `/leaderboard?drawingId=${drawingId}&limit=${limit}`),
  /** 저장된 설정이 없으면 settings: null */
  getSettings: () => request<{ settings: DrawingSettings | null }>("GET", "/settings"),
  saveSettings: (settings: DrawingSettings, opts?: { keepalive?: boolean }) =>
    request<{ settings: DrawingSettings }>("PUT", "/settings", settings, opts),
  /** 그리던 그림 목록 (그림 이름, 저장 시각, 획 수) */
  drafts: () => request<{ drafts: { key: string; savedAt: string; strokeCount: number }[] }>("GET", "/drafts"),
  /** 없으면 draft: null */
  getDraft: (key: string) =>
    request<{ draft: { strokes: Stroke[]; name: string | null; savedAt: string } | null }>("GET", `/drafts/${encodeURIComponent(key)}`),
  saveDraft: (key: string, strokes: Stroke[], name: string | undefined, opts?: { keepalive?: boolean }) =>
    request<{ savedAt: string }>("PUT", `/drafts/${encodeURIComponent(key)}`, { strokes, name: name ?? null }, opts),
  deleteDraft: (key: string) => request<{ ok: true }>("DELETE", `/drafts/${encodeURIComponent(key)}`),
};
