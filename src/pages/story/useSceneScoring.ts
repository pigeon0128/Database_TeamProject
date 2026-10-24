// 스토리 그리기의 장면 준비와 채점.
// 손질한 밑그림·완성 예시·채점 마스크를 불러오고, 그림이 바뀔 때(획을 다 그었을 때, 되돌리기·지우기) 채점한다.
// 획을 긋는 동안에도 그리는 중인 획까지 넣어 LIVE_INTERVAL_MS 마다 채점해서 점수가 실시간으로 바뀐다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene } from "../../data/scenes";
import { loadSceneAssets } from "../../lib/drawing/sceneAssets";
import { visibleStrokes, type DrawAction, type Stroke } from "../../lib/drawing/strokes";
import { emptyScore, scoreCanvas, type GuideMasks, type TraceScore } from "../../lib/drawing/traceScore";

/** 그리는 중 채점 간격 (ms). 채점 한 번이 약 20~30ms 걸려서, 너무 자주 하면 펜 움직임이 느려진다 */
const LIVE_INTERVAL_MS = 120;

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
  // 그리는 중 채점: 마지막으로 채점한 시각과 기다리는 채점
  const liveAt = useRef(0);
  const liveTimer = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      if (liveTimer.current !== null) clearTimeout(liveTimer.current);
    },
    [],
  );

  /** 그림판의 onChange 에 연결한다 (그림판이 다시 그려진 뒤 불린다) */
  const handleCanvasChange = useCallback((canvas: HTMLCanvasElement) => {
    drawCanvasRef.current = canvas;
    if (liveTimer.current !== null) {
      clearTimeout(liveTimer.current);
      liveTimer.current = null;
    }
    if (masksRef.current) setResult(scoreCanvas(canvas, masksRef.current, strokesRef.current));
  }, []);

  /** 그림판의 onDrawing 에 연결한다 (획을 긋는 동안 불린다). 그리는 중인 획까지 넣어 채점한다 */
  const handleDrawing = useCallback((canvas: HTMLCanvasElement, stroke: Stroke) => {
    drawCanvasRef.current = canvas;
    if (liveTimer.current !== null) return;
    const run = () => {
      liveTimer.current = null;
      liveAt.current = performance.now();
      if (!masksRef.current) return;
      // 획을 다 그은 뒤에 불리면 그 획은 이미 목록에 있으므로 그리는 중인 획으로 다시 넣지 않는다
      const done = strokesRef.current.includes(stroke);
      setResult(scoreCanvas(canvas, masksRef.current, strokesRef.current, done ? undefined : stroke));
    };
    const wait = LIVE_INTERVAL_MS - (performance.now() - liveAt.current);
    if (wait <= 0) run();
    else liveTimer.current = window.setTimeout(run, wait);
  }, []);

  /** 마지막 획까지 반영된 점수를 지금 다시 계산한다 (완료할 때) */
  const scoreNow = () => {
    const latest = masksRef.current && drawCanvasRef.current ? scoreCanvas(drawCanvasRef.current, masksRef.current, strokesRef.current) : result;
    setResult(latest);
    return latest;
  };

  return { result, scoreReady, guideUrl, exampleUrl, handleCanvasChange, handleDrawing, scoreNow };
}
