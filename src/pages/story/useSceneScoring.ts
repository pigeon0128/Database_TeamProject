// 스토리 그리기의 장면 준비와 채점.
// 손질한 밑그림·완성 예시·채점 마스크를 불러오고, 그림이 바뀔 때(획을 다 그었을 때, 되돌리기·지우기) 한 번씩 채점한다.
// 그리는 중에는 채점하지 않아서 펜 움직임이 느려지지 않는다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene } from "../../data/scenes";
import { loadSceneAssets } from "../../lib/drawing/sceneAssets";
import { visibleStrokes, type DrawAction } from "../../lib/drawing/strokes";
import { emptyScore, scoreCanvas, type GuideMasks, type TraceScore } from "../../lib/drawing/traceScore";

export function useSceneScoring(scene: Scene, actions: DrawAction[]) {
  const [result, setResult] = useState<TraceScore>(emptyScore);
  const [scoreReady, setScoreReady] = useState(false);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [exampleUrl, setExampleUrl] = useState<string | null>(null);

  const masksRef = useRef<GuideMasks | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // 겹침 채점에 쓰는 지금 보이는 획 (캔버스가 다시 그려지기 전에 갱신된다)
  const strokesRef = useRef(visibleStrokes(actions));
  strokesRef.current = visibleStrokes(actions);

  // 손질한 밑그림, 채점용 위치, 완성 예시 (선택 화면에서 이미 만들었다면 그대로 재사용)
  useEffect(() => {
    let cancelled = false;
    loadSceneAssets(scene).then(
      (assets) => {
        if (cancelled) return;
        masksRef.current = assets.masks;
        setScoreReady(true);
        if (drawCanvasRef.current) setResult(scoreCanvas(drawCanvasRef.current, assets.masks, strokesRef.current));
        setGuideUrl(assets.guideUrl);
        setExampleUrl(assets.exampleUrl);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [scene]);

  /** 그림판의 onChange 에 연결한다 (그림판이 다시 그려진 뒤 불린다) */
  const handleCanvasChange = useCallback((canvas: HTMLCanvasElement) => {
    drawCanvasRef.current = canvas;
    if (masksRef.current) setResult(scoreCanvas(canvas, masksRef.current, strokesRef.current));
  }, []);

  /** 마지막 획까지 반영된 점수를 지금 다시 계산한다 (완료할 때) */
  const scoreNow = () => {
    const latest = masksRef.current && drawCanvasRef.current ? scoreCanvas(drawCanvasRef.current, masksRef.current, strokesRef.current) : result;
    setResult(latest);
    return latest;
  };

  return { result, scoreReady, guideUrl, exampleUrl, handleCanvasChange, scoreNow };
}
