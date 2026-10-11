// 사용자 그리기 설정 보존 (TODO2).
// 그림(장면)을 새로 고르거나 다시 들어와도 사용자가 마지막으로 바꾼 설정을 이어서 쓴다.
// 필드는 DB의 user_settings 테이블(database/migrations/003_user_settings.sql)과 1:1로 맞춘다.
//   brushSize ↔ brush_size, guideVisible ↔ guide_visible, guideOpacity ↔ guide_opacity,
//   smoothing ↔ smoothing, fade ↔ fade
// 아직 서버(REST API)가 없어서 브라우저(localStorage)에 저장한다.
// API가 생기면 loadSettings / saveSettings 안쪽만 user_settings 조회·UPSERT 요청으로 바꾸면 된다.
import { useCallback, useState } from "react";

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
};

/** user_settings 테이블의 DEFAULT와 같은 값 */
export const DEFAULT_SETTINGS: DrawingSettings = { brushSize: 6, guideVisible: true, guideOpacity: 80, smoothing: 50, fade: 0 };

const STORAGE_KEY = "doroland.drawingSettings";

/** 저장된 값이 깨졌거나 범위를 벗어나면 기본값을 쓴다 (DB의 CHECK 제약조건과 같은 범위). */
const inRange = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export function loadSettings(): DrawingSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Record<keyof DrawingSettings, unknown>>;
    return {
      brushSize: inRange(saved.brushSize, 2, 48) ? saved.brushSize : DEFAULT_SETTINGS.brushSize,
      guideVisible: typeof saved.guideVisible === "boolean" ? saved.guideVisible : DEFAULT_SETTINGS.guideVisible,
      guideOpacity: inRange(saved.guideOpacity, 10, 100) ? saved.guideOpacity : DEFAULT_SETTINGS.guideOpacity,
      smoothing: inRange(saved.smoothing, 0, 100) ? saved.smoothing : DEFAULT_SETTINGS.smoothing,
      fade: inRange(saved.fade, 0, 100) ? saved.fade : DEFAULT_SETTINGS.fade,
    };
  } catch {
    // 저장소를 쓸 수 없거나(사생활 보호 모드 등) 값이 깨졌으면 기본값
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<DrawingSettings>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...patch }));
  } catch {
    // 저장하지 못해도 그리기는 계속할 수 있다.
  }
}

/** 설정 하나를 useState처럼 쓰되, 처음에는 저장된 값으로 시작하고 바꿀 때마다 저장한다. */
export function useSavedSetting<K extends keyof DrawingSettings>(key: K) {
  const [value, setValue] = useState<DrawingSettings[K]>(() => loadSettings()[key]);
  const update = useCallback(
    (next: DrawingSettings[K]) => {
      setValue(next);
      saveSettings({ [key]: next } as Partial<DrawingSettings>);
    },
    [key],
  );
  return [value, update] as const;
}
