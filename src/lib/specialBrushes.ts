// 특수 브러쉬 목록과 구매 (DB special_brushes·user_brushes·users.cells, API /api/brushes).
// 그리기 화면의 브러쉬 패널(components/drawing/BrushPanel.tsx)이 쓴다.
import { useCallback, useEffect, useState } from "react";
import { api, type BrushState } from "./api";
import { hasPattern } from "./drawing/brushPatterns";

/** 앱이 무늬를 그릴 줄 아는 브러쉬만 남긴다 (DB에 앱이 모르는 slug 가 있어도 깨지지 않게) */
const known = (r: BrushState): BrushState => ({ ...r, brushes: r.brushes.filter((b) => hasPattern(b.slug)) });

/** enabled 일 때 내 셀과 특수 브러쉬 목록을 불러온다. buy 는 산 뒤의 목록으로 바꾸고, 실패하면 오류 메시지를 담아 예외를 던진다 */
export function useSpecialBrushes(enabled: boolean) {
  const [state, setState] = useState<BrushState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api.specialBrushes().then(
      (r) => setState(known(r)),
      (err: Error) => setError(err.message),
    );
  }, [enabled]);

  const buy = useCallback(async (slug: string) => {
    setState(known(await api.buyBrush(slug)));
  }, []);

  return { cells: state?.cells ?? null, brushes: state?.brushes ?? null, error, buy };
}
