export type DrawingSceneDecorMode = "free" | "story" | "creature";

type SceneAsset = {
  src: string;
  className: string;
  glow: string;
};

const scenes: Record<DrawingSceneDecorMode, SceneAsset[]> = {
  free: [
    { src: "/assets/dorobus/drawing/codex-pose.png", className: "-bottom-14 -right-8 w-64 opacity-[0.30] xl:w-80 xl:opacity-[0.38]", glow: "bg-lime-200/45" },
    { src: "/assets/dorobus/drawing/jero-pose.png", className: "bottom-3 left-16 w-36 opacity-[0.15] xl:left-20 xl:w-52 xl:opacity-[0.22]", glow: "bg-cyan-200/40" },
  ],
  story: [
    { src: "/assets/dorobus/drawing/rico-pose.png", className: "-bottom-14 -left-8 w-64 opacity-[0.28] xl:w-[22rem] xl:opacity-[0.38]", glow: "bg-violet-200/45" },
    { src: "/assets/dorobus/drawing/xylo-pose.png", className: "-bottom-16 -right-8 w-52 opacity-[0.14] xl:w-64 xl:opacity-[0.22]", glow: "bg-amber-200/40" },
  ],
  creature: [
    { src: "/assets/dorobus/drawing/naty-pose.png", className: "bottom-10 left-10 w-48 opacity-[0.30] xl:left-14 xl:w-64 xl:opacity-[0.42]", glow: "bg-sky-200/55" },
    { src: "/assets/dorobus/drawing/codex-pose.png", className: "-bottom-16 right-64 w-40 opacity-[0.08] xl:w-52 xl:opacity-[0.14]", glow: "bg-emerald-200/40" },
  ],
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
