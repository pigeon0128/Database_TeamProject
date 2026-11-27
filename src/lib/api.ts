// API 서버(server/, 경로별 코드는 server/routes/) 호출. 개발 중에는 Vite가 /api 요청을 API 서버로 넘긴다.
import type { PaintStroke, Stroke } from "./drawing/strokes";

export type User = { id: number; loginId: string };

/** AI 그림 연습실에 쓰는 칸 (서버 server/routes/ai.js 의 POST /api/ai/image) */
export type AiCharacterParts = { head: string; face: string; upper: string; lower: string };
/** 성별: 상관없음 / 여자 / 남자 */
export type AiGender = "any" | "female" | "male";
/** 캐릭터 칸: 부위별 설명 + 성별·인원(1~3)·자세 */
export type AiCharacter = AiCharacterParts & { gender: AiGender; count: number; pose: string };
/** style: 화풍 이름 ("" = 기본 그림책, 서버 ART_STYLES) */
/** prompt: "프롬프트 직접 쓰기"로 쓴 글 (있으면 서버가 다른 칸은 쓰지 않는다) */
export type AiImageInput = { background: string; style: string; character: AiCharacter | null; avoid: string; prompt?: string };

export type Drawing = {
  id: number;
  title: string;
  referenceImageKey: string;
  order: number;
  chapter: { id: number; title: string; order: number };
  /** 도감 생물이면 분류(DB creature_profiles.category), 스토리 장면이면 null */
  category: "animal" | "plant" | "dinosaur" | "object" | null;
};

/** 특수 브러쉬 종류: 무늬 / 반짝이 / 사이버틱 / 삼색반짝이 */
export type BrushCategory = "pattern" | "glitter" | "cyber" | "tricolor";

/** 상점에 보이는 순서와 이름 */
export const BRUSH_CATEGORIES: { id: BrushCategory; label: string }[] = [
  { id: "pattern", label: "무늬" },
  { id: "glitter", label: "반짝이" },
  { id: "cyber", label: "사이버틱" },
  { id: "tricolor", label: "삼색반짝이" },
];

/** 색칠하기 특수 브러쉬 (DB special_brushes). 무늬는 앱이 slug 로 그린다 (lib/drawing/brushPatterns.ts) */
export type SpecialBrush = {
  id: number;
  slug: string;
  name: string;
  /** 가격 (셀) */
  price: number;
  /** 기프트샵에서 나눠 파는 종류 (DB special_brushes.category, migrations/022) */
  category: BrushCategory;
  /** 내가 산 브러쉬인지 (DB user_brushes 에 행이 있음). 산 브러쉬만 쓸 수 있다 */
  owned: boolean;
};

/** 내 셀(DB users.cells)과 특수 브러쉬 목록 */
export type BrushState = { cells: number; brushes: SpecialBrush[] };

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


/** 생물 도감 한 항목: 도감 정보(DB creature_*)와 내 수집 현황 (GET /api/collection) */
export type CreatureEntry = {
  drawingId: number;
  name: string;
  /** 앱 주소·밑그림 파일 이름 (src/data/creatures.ts) */
  slug: string;
  category: "animal" | "plant" | "dinosaur" | "object";
  summary: string;
  facts: { label: string; content: string }[];
  tips: string[];
  /** 도감 정보의 출처 (DB creature_sources) */
  sources: { citation: string; url: string }[];
  /** 완성 그림이 저장된 대표 작품의 일치율이 80% 이상이면 수집 완료 (server/completion.js) */
  collected: boolean;
  /** 대표 작품의 기록 ID */
  recordId: number | null;
  /** 대표 작품 그림의 경로 (DB user_artworks.image_key, 그림은 artworkUrl 로) */
  imageKey: string | null;
  bestScore: number | null;
  bestDurationMs: number | null;
};

export type LeaderboardEntry = {
  ranking: number;
  /** 이 순위에 쓰인 기록 (그 사람의 최고 기록) */
  recordId: number;
  /** 그 기록의 완성 그림 경로 (DB user_artworks.image_key). 그림이 없으면 null */
  imageKey: string | null;
  userId: number;
  nickname: string;
  score: number;
  durationMs: number;
  playedAt: string;
};

/** 메인 화면의 내 그림 요약 (GET /api/summary) */
export type UserSummary = {
  /** 가진 셀 (기프트샵 화폐) */
  cells: number;
  /** 모든 기록 중 가장 높은 일치율 (0~100). 기록이 없으면 null */
  bestScore: number | null;
  /** 완성 작품으로 치는 최소 일치율 (%) */
  completeScore: number;
  /** 일치율 completeScore 이상으로 완성 그림이 저장된 그림 수 (스토리 + 도감) */
  completedArtworks: number;
  /** 그중 스토리 장면 수 */
  storyCompleted: number;
  /** 그중 도감 생물 수 (도감 화면의 "수집 완료"와 같은 기준) */
  creatureCollected: number;
  creatureTotal: number;
  /** 3D 색칠하기에서 수납한 오브젝트 수 */
  storedObjects: number;
};

/** 완성 그림 주소: DB의 경로(image_key)를 API 서버의 /uploads 폴더 주소로 (<img src> 에 그대로 쓴다) */
export const artworkUrl = (imageKey: string) => `/uploads/${imageKey}`;

export class ApiError extends Error {
  status: number;
  /** 서버가 붙인 오류 종류 (예: "blocked" = 내용 검사에 걸림) */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
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
    throw new ApiError(data?.error ?? SERVER_DOWN, res.status, data?.code);
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
  /** 내 셀과 색칠하기 특수 브러쉬 목록 (순서대로, 산 것인지 함께) */
  specialBrushes: () => request<BrushState>("GET", "/brushes"),
  /** 특수 브러쉬를 셀로 산다. 셀이 부족하거나 이미 샀으면 400. 산 뒤의 셀과 목록을 돌려준다 */
  buyBrush: (slug: string) => request<BrushState>("POST", `/brushes/${encodeURIComponent(slug)}/purchase`),
  /** image: 완성 그림 (PNG data URL). 이번 기록이 내 최고 기록일 때만 저장되고(isBest), 이전 최고 기록의 그림은 지워진다 */
  savePlayRecord: (drawingId: number, similarityScore: number, durationMs: number, image: string | null) =>
    request<{ recordId: number; playedAt: string; isBest: boolean; imageKey: string | null }>("POST", "/play-records", { drawingId, similarityScore, durationMs, image }),
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
    request<{ draft: { strokes: (Stroke | PaintStroke)[]; name: string | null; savedAt: string } | null }>("GET", `/drafts/${encodeURIComponent(key)}`),
  saveDraft: (key: string, strokes: (Stroke | PaintStroke)[], name: string | undefined, opts?: { keepalive?: boolean }) =>
    request<{ savedAt: string }>("PUT", `/drafts/${encodeURIComponent(key)}`, { strokes, name: name ?? null }, opts),
  /** 생물 도감 목록과 내 수집 현황 */
  collection: () => request<{ creatures: CreatureEntry[] }>("GET", "/collection"),
  summary: () => request<UserSummary>("GET", "/summary"),
  deleteDraft: (key: string) => request<{ ok: true }>("DELETE", `/drafts/${encodeURIComponent(key)}`),
  /** 글로 AI 밑그림(선화) 만들기. image 는 PNG data URL, cells 는 셀을 내고 남은 셀 */
  aiSketch: (prompt: string) => request<{ image: string; cells: number; cost: number }>("POST", "/ai/sketch", { prompt }),
  /** AI 밑그림 한 장의 가격(셀)과 내 셀 */
  aiSketchInfo: () => request<{ cost: number; cells: number }>("GET", "/ai/sketch"),
  /** AI 그림 연습실: 칸마다 쓴 설명으로 그림 만들기 (character 가 null 이면 캐릭터 없이, avoid 는 문장으로 붙는다) */
  aiImage: (input: AiImageInput) => request<{ image: string; imageId: string; cells: number; cost: number }>("POST", "/ai/image", input),
  /** 연습실에서 만든 그림을 마이룸 작품으로 추가 (imageId: 만들 때 받은 번호, 서버가 2시간 보관) */
  aiImageToMyRoom: (imageId: string) =>
    request<{ artwork: { drawingId: number; name: string; imageKey: string } }>("POST", `/ai/image/${encodeURIComponent(imageId)}/myroom`),
  /** 마이룸에 넣은 AI 그림 목록 (최신이 앞) */
  aiArtworks: () => request<{ artworks: { drawingId: number; title: string; imageKey: string; createdAt: string }[] }>("GET", "/ai/artworks"),
  /** AI 그림 연습실 한 장의 가격(셀)과 내 셀 */
  aiImageInfo: () => request<{ cost: number; cells: number }>("GET", "/ai/image"),
  /** AI 조언: 아이가 그린 그림(작게 줄인 data URL)을 보고 잘한 점·해 볼 것·색 팁. 부적절한 그림이면 code "blocked" 오류 */
  aiAdvice: (image: string, title: string) => request<{ advice: AiAdvice; cells: number; cost: number }>("POST", "/ai/advice", { image, title }),
  /** AI 조언 한 번의 가격(셀)과 내 셀 */
  aiAdviceInfo: () => request<{ cost: number; cells: number }>("GET", "/ai/advice"),
};

export type AiAdvice = { praise: string; tip: string; color: string };
