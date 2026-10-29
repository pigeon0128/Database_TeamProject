import { useState } from "react";

export type CoachMode = "trace" | "free";
export type CoachCharacter = "codex" | "rico" | "naty";

const coaches: Record<CoachCharacter, { name: string; image: string; alt: string }> = {
  codex: { name: "CODEX", image: "/assets/dorobus/drawing/codex-pose.png", alt: "캐릭터 그리기를 안내하는 코덱스" },
  rico: { name: "RICO", image: "/assets/dorobus/drawing/rico-pose.png", alt: "스토리 장면 그리기를 안내하는 리코" },
  naty: { name: "NATY", image: "/assets/dorobus/drawing/naty-pose.png", alt: "도감 생물 그리기를 안내하는 나티" },
};

const messages: Record<CoachMode, Array<{ title: string; body: string }>> = {
  trace: [
    { title: "먼저 도구를 골라요", body: "브러시 굵기와 밑그림 진하기를 편한 정도로 맞춰 보세요." },
    { title: "흰 선을 따라가요", body: "흰 선을 많이 채울수록 점수가 올라가요. 한 획은 길고 부드럽게 그려요!" },
    { title: "회색 영역은 조심!", body: "회색 부분과 같은 곳을 여러 번 칠하면 감점돼요. 완성 후 ✅ 버튼을 눌러요." },
  ],
  free: [
    { title: "이름부터 지어 볼까요?", body: "위쪽 이름 칸에 내가 만들 캐릭터의 이름을 적어 보세요." },
    { title: "큰 모양부터 시작해요", body: "얼굴과 몸처럼 큰 모양을 먼저 그리고, 확대해서 표정을 더해요." },
    { title: "자유 그림은 점수가 없어요", body: "정답 없이 나만의 아이디어가 중요해요. 완성하면 저장 버튼을 눌러요!" },
  ],
};

export function DrawingCoach({ mode, character }: { mode: CoachMode; character: CoachCharacter }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const item = messages[mode][step];
  const coach = coaches[character];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-black text-blue-600 shadow-lg"
      >
        <img src={coach.image} alt="" className="h-10 w-10 object-contain" />
        {coach.name} 도움말
      </button>
    );
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
