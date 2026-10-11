// 사용자 그리기 설정 보존 (TODO2).
// 그림(장면)을 새로 고르거나 다시 들어와도, 다른 기기에서 로그인해도 사용자가 마지막으로 바꾼 설정을 이어서 쓴다.
// 필드는 DB의 user_settings 테이블(database/migrations/003_user_settings.sql)과 1:1로 맞춘다.
//   brushSize ↔ brush_size, guideVisible ↔ guide_visible, guideOpacity ↔ guide_opacity,
//   smoothing ↔ smoothing, fade ↔ fade
//
// DB(API 서버의 GET/PUT /api/settings)에만 저장한다. 바꾸고 잠깐 뒤에 저장한다.
// 로그인하면 DB의 설정을 불러와 바로 적용하고, 불러오기 전까지는 기본값을 쓴다.
// DB에 아직 설정이 없으면(처음 로그인) 지금 설정을 올린다.
import { useCallback, useSyncExternalStore } from "react";
import { api, type DrawingSettings } from "./api";

export type { DrawingSettings };

/** user_settings 테이블의 DEFAULT와 같은 값 */
export const DEFAULT_SETTINGS: DrawingSettings = { brushSize: 6, guideVisible: true, guideOpacity: 80, smoothing: 50, fade: 0 };

/** 마지막으로 바꾼 뒤 이만큼 기다렸다가 DB에 저장한다 (조절 바를 끄는 동안 요청이 몰리지 않게) */
const SAVE_DELAY_MS = 600;

/** 범위를 벗어나거나 깨진 값은 기본값으로. 범위는 서버 server/routes/settings.js, DB migrations/003_user_settings.sql 의 CHECK 와 같다 */
const inRange = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function sanitize(raw: unknown): DrawingSettings {
  const s = (raw ?? {}) as Partial<Record<keyof DrawingSettings, unknown>>;
  return {
    brushSize: inRange(s.brushSize, 2, 48) ? s.brushSize : DEFAULT_SETTINGS.brushSize,
    guideVisible: typeof s.guideVisible === "boolean" ? s.guideVisible : DEFAULT_SETTINGS.guideVisible,
    guideOpacity: inRange(s.guideOpacity, 10, 100) ? s.guideOpacity : DEFAULT_SETTINGS.guideOpacity,
    smoothing: inRange(s.smoothing, 0, 100) ? s.smoothing : DEFAULT_SETTINGS.smoothing,
    fade: inRange(s.fade, 0, 100) ? s.fade : DEFAULT_SETTINGS.fade,
  };
}

/** DB에서 불러오기에 실패하면 이만큼 기다렸다가 다시 시도한다 (ms). 마지막 값으로 계속 시도한다 */
const LOAD_RETRY_DELAYS = [1000, 3000, 7000, 15000, 30000];

// ── 설정 저장소: 화면 어디서 바꿔도 같은 값을 보고, DB에서 불러오면 열려 있는 화면에도 바로 반영된다 ──
let userId: number | null = null;
let current: DrawingSettings = { ...DEFAULT_SETTINGS };
/**
 * DB의 설정을 한 번이라도 불러왔는지. 불러오기 전에는 DB에 저장하지 않는다
 * (불러오기에 실패한 채로 기본값을 저장하면 DB에 있던 설정을 덮어써 버린다).
 */
let synced = false;
/**
 * 불러오기 전에 사용자가 바꾼 항목들. 불러온 뒤에는 DB 값에 이 항목들만 덮어써서 저장한다
 * (더 나중에 바꾼 쪽이 이기고, 바꾸지 않은 항목은 DB 값을 그대로 쓴다).
 */
const changedBeforeSync = new Set<keyof DrawingSettings>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveToServer({ keepalive = false } = {}) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (userId === null || !synced) return;
  // 실패해도 그리기는 계속된다. 다음에 바꿀 때 다시 저장한다.
  api.saveSettings(current, { keepalive }).catch(() => {});
}

// 저장을 기다리는 중에 창을 닫으면 바로 보낸다.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (saveTimer) saveToServer({ keepalive: true });
  });
}

export function updateSettings(patch: Partial<DrawingSettings>) {
  current = { ...current, ...patch };
  emit();
  if (userId === null) return;
  if (!synced) {
    for (const key of Object.keys(patch) as (keyof DrawingSettings)[]) changedBeforeSync.add(key);
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToServer, SAVE_DELAY_MS);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 로그인한 사용자가 바뀔 때 부른다 (auth.tsx). 기본값으로 바꾼 뒤 DB의 설정을 불러와 적용한다.
 * DB에 설정이 없으면 지금 설정을 DB에 올린다. 불러오기에 실패하면 로그인해 있는 동안 간격을 늘려 가며 계속 다시 시도하고,
 * 그동안 바꾼 항목은 불러오기에 성공한 뒤 DB 값 위에 덮어써서 저장한다.
 */
export async function syncSettingsForUser(uid: number | null) {
  if (saveTimer) saveToServer(); // 이전 사용자의 저장 대기분을 먼저 보낸다
  userId = uid;
  synced = false;
  changedBeforeSync.clear();
  current = { ...DEFAULT_SETTINGS };
  emit();
  if (uid === null) return;
  for (let attempt = 0; ; attempt++) {
    if (attempt) await wait(LOAD_RETRY_DELAYS[Math.min(attempt, LOAD_RETRY_DELAYS.length) - 1]);
    if (userId !== uid) return; // 그사이 로그아웃·다른 사용자 로그인
    try {
      const { settings } = await api.getSettings();
      if (userId !== uid) return;
      synced = true;
      if (settings) {
        // DB 값을 쓰되, 불러오는 동안 사용자가 바꾼 항목은 그 값을 남긴다.
        const merged = sanitize(settings);
        for (const key of changedBeforeSync) (merged as Record<keyof DrawingSettings, unknown>)[key] = current[key];
        current = merged;
        emit();
      }
      // DB에 아직 없거나(처음 로그인), 불러오는 동안 바꾼 항목이 있으면 지금 설정을 저장한다.
      if (!settings || changedBeforeSync.size) saveToServer();
      changedBeforeSync.clear();
      return;
    } catch {
      // 서버에 연결하지 못하면 지금 값으로 계속하고 잠시 뒤 다시 시도한다.
    }
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 설정 하나를 useState처럼 쓴다. 바꾸면 DB에 저장되고, 같은 설정을 쓰는 모든 화면이 함께 바뀐다. */
export function useSavedSetting<K extends keyof DrawingSettings>(key: K) {
  const value = useSyncExternalStore(subscribe, () => current[key]);
  const update = useCallback((next: DrawingSettings[K]) => updateSettings({ [key]: next } as Partial<DrawingSettings>), [key]);
  return [value, update] as const;
}
