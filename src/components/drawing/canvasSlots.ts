// 그리기 화면 틀(DrawingShell)이 그림판 오른쪽 위 바깥에 만들어 두는 버튼 자리.
// 그림판(TracingCanvas)은 확대·축소 버튼을, 도움말(DrawingCoach)은 접힌 도움말 버튼을 이 자리에 놓아 그림을 가리지 않는다.
// 그림판 옆 빈자리 폭에 따라 모양을 바꾼다:
//   wide   - 빈자리가 넉넉하다: 가로 버튼 ("− 100% +", "NATY 도움말")
//   narrow - 빈자리가 좁다 (스토리 장면처럼 가로로 긴 그림): 세로로 좁은 버튼 ("+ / 100% / −", 얼굴 아이콘만)
//   inside - 빈자리가 거의 없다: 그림판 안 오른쪽 위에 좁은 버튼으로
import { createContext } from "react";

export type SlotLayout = "wide" | "narrow" | "inside";

export const CanvasControlsSlot = createContext<{ slot: HTMLElement | null; layout: SlotLayout } | null>(null);

/** 가로 버튼이 들어가는 빈자리 폭 (px, 버튼 폭 + 여백) */
export const WIDE_SLOT = 150;
/** 세로로 좁은 버튼이 들어가는 빈자리 폭 (px) */
export const NARROW_SLOT = 58;
