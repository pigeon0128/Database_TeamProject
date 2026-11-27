export type DrawingSceneDecorMode = "free" | "story" | "creature" | "paint3d";

type SceneAsset = {
  src: string;
  className: string;
  glow: string;
};

const scenes: Record<DrawingSceneDecorMode, SceneAsset[]> = {
  free: [
    { src: "/assets/dorobus/drawing/jero-pose.png", className: "bottom-3 left-16 w-36 opacity-[0.15] xl:left-20 xl:w-52 xl:opacity-[0.22]", glow: "bg-cyan-200/40" },
  ],
  story: [
    { src: "/assets/dorobus/drawing/rico-pose.png", className: "bottom-16 -left-8 w-64 opacity-[0.28] xl:w-[22rem] xl:opacity-[0.38]", glow: "bg-violet-200/45" },
  ],
  paint3d: [
    { src: "/assets/dorobus/drawing/codex-pose.png", className: "bottom-14 -left-6 w-64 opacity-[0.30] xl:w-80 xl:opacity-[0.40]", glow: "bg-lime-200/45" },
  ],
  creature: [
    { src: "/assets/dorobus/drawing/naty-pose.png", className: "bottom-20 left-10 w-48 opacity-[0.30] xl:left-14 xl:w-64 xl:opacity-[0.42]", glow: "bg-sky-200/55" },
    { src: "/assets/dorobus/drawing/codex-pose.png", className: "bottom-16 right-64 w-40 opacity-[0.08] xl:w-52 xl:opacity-[0.14]", glow: "bg-emerald-200/40" },
  ],
};

/**
 * 그림판 오른쪽 빈자리 아래쪽에 연하게 세워 두는 안내 캐릭터 (도감 그리기의 NATY 와 같은 진하기, DrawingShell).
 * 화면 오른쪽 구석에 두면 화면 끝에 잘리거나 오른쪽 도구 패널(특수 브러쉬 목록 등)에 가려져서 이 자리에 둔다.
 */
/** size: 원래 배경 캐릭터 크기 그대로. faceX: 그림 너비에 대한 얼굴 가운데 위치 (얼굴을 빈자리 가운데에 맞춘다) */
export const sideCharacters: Partial<Record<DrawingSceneDecorMode, { src: string; glow: string; size: string; faceX: number }>> = {
  free: { src: "/assets/dorobus/drawing/codex-pose.png", glow: "bg-lime-200/45", size: "w-64 xl:w-80", faceX: 0.53 },
  story: { src: "/assets/dorobus/drawing/xylo-pose.png", glow: "bg-amber-200/40", size: "w-52 xl:w-64", faceX: 0.6 },
  // 3D 색칠하기는 DrawingShell 을 쓰지 않아 Paint3DPage 가 직접 그린다
  paint3d: { src: "/assets/dorobus/drawing/jero-pose.png", glow: "bg-cyan-200/40", size: "w-44 xl:w-56", faceX: 0.5 },
};

/** 기존 도구 동작을 건드리지 않고 도화지 주변의 빈 공간에만 표시되는 장식 레이어. */
export default function DrawingSceneDecor({ mode }: { mode: DrawingSceneDecorMode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden md:block" aria-hidden="true">
      {scenes[mode].map((asset) => (
        <div key={asset.src} className={`absolute ${asset.className}`}>
          <span className={`absolute inset-[18%] rounded-full blur-3xl ${asset.glow}`} />
          <img src={asset.src} alt="" className="relative h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(52,95,145,0.16)]" />
        </div>
      ))}
    </div>
  );
}
