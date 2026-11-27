import { useState } from "react";
import { createPortal } from "react-dom";

export type CoachMode = "trace" | "free" | "paint3d";
export type CoachCharacter = "codex" | "rico" | "naty";

/**
 * face: 접힌 도움말 버튼의 동그란 얼굴 아이콘을 포즈 그림에서 잘라 내는 위치.
 *   x, y: 얼굴 가운데 (그림 너비·높이에 대한 비율), zoom: 아이콘 너비의 몇 배로 그림을 키울지, ratio: 그림 높이/너비
 * 포즈 그림은 이젤·공책까지 들어 있는 넓은 그림이라 통째로 작게 줄이면 알아볼 수 없어서 얼굴만 보여 준다.
 */
const coaches: Record<CoachCharacter, { name: string; image: string; alt: string; face: { x: number; y: number; zoom: number; ratio: number } }> = {
  codex: { name: "CODEX", image: "/assets/dorobus/drawing/codex-pose.png", alt: "캐릭터 그리기를 안내하는 코덱스", face: { x: 0.53, y: 0.32, zoom: 3.4, ratio: 1159 / 1357 } },
  rico: { name: "RICO", image: "/assets/dorobus/drawing/rico-pose.png", alt: "스토리 장면 그리기를 안내하는 리코", face: { x: 0.53, y: 0.36, zoom: 3, ratio: 1145 / 1374 } },
  naty: { name: "NATY", image: "/assets/dorobus/drawing/naty-pose.png", alt: "도감 생물 그리기를 안내하는 나티", face: { x: 0.66, y: 0.5, zoom: 2.8, ratio: 1024 / 1536 } },
};

/** 포즈 그림에서 얼굴만 동그랗게 보여 주는 배경 스타일 (배경 위치 % 는 "그림의 p% 지점을 상자의 p% 지점에 맞춘다"는 뜻) */
function faceStyle({ image, face }: (typeof coaches)[CoachCharacter]) {
  const height = face.zoom * face.ratio;
  const pos = (center: number, scale: number) => `${(((center * scale - 0.5) / (scale - 1)) * 100).toFixed(1)}%`;
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: `${face.zoom * 100}% auto`,
    backgroundPosition: `${pos(face.x, face.zoom)} ${pos(face.y, height)}`,
    backgroundRepeat: "no-repeat",
  };
}

const messages: Record<CoachMode, Array<{ title: string; body: string }>> = {
  trace: [
    { title: "먼저 도구를 골라요", body: "브러시 굵기와 밑그림 진하기를 편한 정도로 맞춰 보세요." },
    { title: "흰 선을 따라가요", body: "흰 선을 많이 채울수록 점수가 올라가요. 한 획은 길고 부드럽게 그려요!" },
    { title: "회색 영역은 조심!", body: "회색 부분과 같은 곳을 여러 번 칠하면 감점돼요. 완성 후 ✅ 버튼을 눌러요." },
  ],
  paint3d: [
    { title: "오브젝트를 돌려 봐요", body: "오른쪽 버튼으로 끌면 360도로 돌아가요. 휠로 가까이 볼 수 있고, 🎯 방향으로 정면이나 위에서도 볼 수 있어요." },
    { title: "스프레이로 칠해요", body: "색을 고르고 문지르면 알갱이처럼 칠해져요. 오래 누를수록 진해지고, 부위마다 따로 칠해져요!" },
    { title: "수납해서 마이룸으로 보내요", body: "완성하면 📦 수납하기를 눌러요. 마이룸에서 꺼내 방을 꾸밀 수 있어요. 💾 저장은 그림 파일로 내려받고 싶을 때 써요." },
  ],
  free: [
    { title: "이름부터 지어 볼까요?", body: "위쪽 이름 칸에 내가 만들 캐릭터의 이름을 적어 보세요." },
    { title: "큰 모양부터 시작해요", body: "얼굴과 몸처럼 큰 모양을 먼저 그리고, 확대해서 표정을 더해요." },
    { title: "자유 그림은 점수가 없어요", body: "정답 없이 나만의 아이디어가 중요해요. 완성하면 저장 버튼을 눌러요!" },
  ],
};

/**
 * 도움말을 접었거나(closed) 완전히 닫았는지(dismissed) 그리기 종류마다 브라우저에 기억한다.
 * 기억하지 않으면 상점에 다녀오거나 화면을 다시 열 때마다 도움말이 처음부터 다시 펼쳐진다.
 * 처음 쓰는 사람에게만 펼쳐서 보여 주고, 접은 뒤에는 아래 "도움말" 버튼으로 언제든 다시 볼 수 있다.
 */
type CoachState = "open" | "closed" | "dismissed";
/** 잠겨 있을 때 도움말 버튼에 보이는 설명 */
const LOCKED_TITLE = "AI 조언을 보는 동안은 도움말을 열 수 없어요";
const storageKey = (mode: CoachMode) => `drawingCoach:${mode}`;

function readCoachState(mode: CoachMode): CoachState {
  try {
    const saved = localStorage.getItem(storageKey(mode));
    return saved === "closed" || saved === "dismissed" ? saved : "open";
  } catch {
    return "open";
  }
}

export function DrawingCoach({
  mode,
  character,
  foldedSlot,
  compact = false,
  locked = false,
}: {
  mode: CoachMode;
  character: CoachCharacter;
  /** 접힌 도움말 버튼을 놓을 자리 (DrawingShell 이 그림판 오른쪽 위 바깥에 만든다). 없으면 화면 아래 가운데 */
  foldedSlot?: HTMLElement | null;
  /** 자리가 좁으면 얼굴 아이콘만 보여 준다 */
  compact?: boolean;
  /** 잠시 쓸 수 없게 한다 (AI 조언 말풍선이 같은 자리에 떠 있는 동안). 펼쳐 둔 안내도 그동안 접어 둔다 (기억한 상태는 바꾸지 않는다) */
  locked?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<CoachState>(() => readCoachState(mode));
  const open = state === "open";
  const dismissed = state === "dismissed";
  const remember = (next: CoachState) => {
    setState(next);
    try {
      localStorage.setItem(storageKey(mode), next);
    } catch {
      // 기억할 수 없으면 이 화면에서만 적용된다
    }
  };
  const setOpen = (value: boolean) => remember(value ? "open" : "closed");
  const setDismissed = (value: boolean) => remember(value ? "dismissed" : "closed");
  const item = messages[mode][step];
  const coach = coaches[character];

  // 접어 둔 도움말 버튼이 확대·축소 버튼을 가릴 수 있어서, ✕로 완전히 없앨 수 있다.
  if (dismissed) return null;

  if (!open || locked) {
    const reopen = () => {
      if (locked) return;
      setStep(0);
      setOpen(true);
    };
    const face = <span className="h-8 w-8 shrink-0 rounded-full bg-sky-100 ring-1 ring-blue-100" style={faceStyle(coach)} aria-hidden="true" />;
    const folded = compact ? (
      // 그림판 옆 빈자리가 좁을 때: 얼굴 아이콘만 (✕ 는 오른쪽 위 작은 배지)
      <div className="relative z-20">
        <button
          type="button"
          onClick={reopen}
          disabled={locked}
          title={locked ? LOCKED_TITLE : `${coach.name} 도움말`}
          aria-label={locked ? LOCKED_TITLE : `${coach.name} 도움말`}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-100 bg-white shadow-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {face}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-blue-100 bg-white text-[9px] leading-none text-blue-400 shadow hover:text-blue-600"
          aria-label={`${coach.name} 도움말 완전히 닫기`}
          title="완전히 닫기"
        >
          ✕
        </button>
      </div>
    ) : (
      <div
        className={`z-20 flex items-center whitespace-nowrap rounded-full border border-blue-100 bg-white text-xs font-black text-blue-600 shadow-lg ${
          foldedSlot ? "" : "absolute bottom-3 left-1/2 -translate-x-1/2"
        }`}
      >
        <button
          type="button"
          onClick={reopen}
          disabled={locked}
          title={locked ? LOCKED_TITLE : undefined}
          className="flex h-10 items-center gap-1.5 rounded-full pl-1 pr-1.5 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {face}
          {coach.name} 도움말
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mr-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none text-blue-400 hover:bg-blue-50 hover:text-blue-600"
          aria-label={`${coach.name} 도움말 완전히 닫기`}
          title="완전히 닫기"
        >
          ✕
        </button>
      </div>
    );
    // 그리기 화면에서는 그림판 오른쪽 위 바깥(확대·축소 버튼 아래)에 붙여 그림도 특수 브러쉬 패널도 가리지 않는다
    return foldedSlot ? createPortal(folded, foldedSlot) : folded;
  }

  return (
    <section
      aria-label="도로버스 캐릭터의 그리기 안내"
      className="absolute bottom-4 left-1/2 z-20 h-48 w-[min(820px,calc(100%-1.5rem))] -translate-x-1/2 drop-shadow-2xl sm:h-56"
    >
      <div className="absolute inset-x-0 bottom-0 ml-24 flex min-h-36 flex-col justify-center overflow-hidden rounded-[1.75rem] border-2 border-white/20 bg-[linear-gradient(125deg,rgba(20,38,64,.96),rgba(32,78,125,.94))] py-4 pl-20 pr-5 text-white backdrop-blur-md sm:ml-36 sm:min-h-44 sm:pl-28 sm:pr-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#66b5ff,#8ce2d0,#fee36e)]" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Art guide · {coach.name}</p>
            <h2 className="mt-1 text-base font-black text-white sm:text-lg">{item.title}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full px-1.5 text-xl font-bold text-white/55 hover:text-white" aria-label="안내 접기">×</button>
        </div>
        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-white/80 sm:text-sm">{item.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">{messages[mode].map((_, index) => <span key={index} className={`h-1.5 rounded-full ${index === step ? "w-6 bg-sky-300" : "w-1.5 bg-white/25"}`} />)}</div>
          <button
            type="button"
            onClick={() => (step === messages[mode].length - 1 ? setOpen(false) : setStep((current) => current + 1))}
            className="rounded-full bg-white px-4 py-2 text-[11px] font-black text-blue-700 transition hover:-translate-y-0.5"
          >
            {step === messages[mode].length - 1 ? "대화 종료" : "다음 설명 →"}
          </button>
        </div>
      </div>
      <img
        src={coach.image}
        alt={coach.alt}
        className="pointer-events-none absolute bottom-0 left-0 z-10 h-full w-40 object-contain drop-shadow-xl sm:w-60"
      />
    </section>
  );
}
