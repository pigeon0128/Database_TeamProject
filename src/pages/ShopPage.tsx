// 기프트샵 (#/shop). 메인 화면 오른쪽 아래 상점 그림을 누르면 온다.
// 화면 가운데 선을 기준으로 위에는 점원 캐릭터와 말풍선(뒤에 선물 가게 벽장 그림), 아래 나무 카운터 위에는 물건을 사는 칸이 있다.
//   첫 화면: 왼쪽 인사말 칸 + 오른쪽 메뉴 "1. 특수 브러쉬"
//   특수 브러쉬를 누르면 아래 칸이 왼쪽으로 밀려 나가고, 브러쉬 상자가 오른쪽에서 들어온다.
//   붓을 누르면 말풍선이 가격을 알려 주고 거기서 산다 (lib/specialBrushes.ts → POST /api/brushes/<slug>/purchase).
//   말풍선의 "체험해보기"를 누르면 말풍선이 캐릭터 왼쪽으로 옮겨 가고, 이젤 캔버스가 오른쪽에서 말풍선 자리로 들어와 그 붓으로 그려 볼 수 있다.
//   캔버스는 카운터 뒤 이젤에 얹혀 있어 아랫부분이 카운터에 가린다.
//   캔버스의 "뒤로"나 다른 붓을 누르면 캔버스는 오른쪽 화면 밖으로 돌아가고, 말풍선은 다시 오른쪽으로 돌아온다.
import { useState } from "react";
import type { SpecialBrush } from "../lib/api";
import { useSpecialBrushes } from "../lib/specialBrushes";
import { navigate } from "../router";
import { BrushBox, CounterBackdrop } from "../components/shop/ShopArt";
import { ShopWall } from "../components/shop/ShopWall";
import EaselCanvas from "../components/shop/EaselCanvas";

const GREETING = "무슨 상품을 찾고 있어요?";

/** 말풍선. brush 가 있으면 "체험해보기" 버튼을, buy 면 사기·그만두기 버튼도 붙인다 */
type Bubble = { text: string; brush?: SpecialBrush; buy?: boolean };

/** 고른 붓에 대해 점원이 하는 말 */
const brushBubble = (b: SpecialBrush): Bubble =>
  b.owned ? { text: `${b.name} 브러쉬는 이미 가지고 있어요. 그리기에서 써 보세요!`, brush: b } : { text: `${b.name} 브러쉬는 ${b.price}셀이에요. 살까요?`, brush: b, buy: true };

/** 말풍선 바탕에 두르는 4px 테두리(상하좌우로 밀어 겹친 그림자)와 은은한 그림자 */
const BUBBLE_OUTLINE = [
  "drop-shadow(4px 0 0 #2B1A1A)",
  "drop-shadow(-4px 0 0 #2B1A1A)",
  "drop-shadow(0 4px 0 #2B1A1A)",
  "drop-shadow(0 -4px 0 #2B1A1A)",
  "drop-shadow(0 10px 14px rgba(30, 130, 220, 0.14))",
].join(" ");

function SpeechBubble({ bubble, side, cells, busy, onBuy, onTry, onCancel }: { bubble: Bubble; side: "left" | "right"; cells: number | null; busy: boolean; onBuy: () => void; onTry: () => void; onCancel: () => void }) {
  const short = bubble.buy && bubble.brush && cells !== null && cells < bubble.brush.price;
  return (
    <div className="relative w-max max-w-[min(34rem,42vw)] px-7 py-5 text-[clamp(0.95rem,2.2vh,1.15rem)] font-extrabold leading-snug">
      {/* 바탕: 흰 몸통과 꼬리(캐릭터 쪽)를 한 덩어리로 그리고, 그 덩어리 바깥에 테두리를 한 번에 두른다. 그래서 꼬리 이음새가 끊기지 않는다 */}
      <div className="absolute inset-1" style={{ filter: BUBBLE_OUTLINE }} aria-hidden="true">
        <div className="absolute inset-0 rounded-[1.75rem] bg-white" />
        <svg viewBox="0 0 22 30" className={`absolute bottom-4 h-[30px] w-[22px] ${side === "right" ? "-left-[18px]" : "-right-[18px] -scale-x-100"}`}>
          <path d="M22 0L0 15L22 30Z" fill="#FFFFFF" />
        </svg>
      </div>
      <p className="relative" aria-live="polite">{bubble.text}</p>
      {bubble.brush && (
        <div className="relative mt-3 flex gap-2 whitespace-nowrap">
          {bubble.buy && (
            <button
              type="button"
              onClick={onBuy}
              disabled={busy || short}
              className="rounded-full bg-[#E23B3B] px-4 py-1.5 text-sm font-black text-white transition hover:bg-[#B8262B] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {short ? "셀이 부족해요" : busy ? "사는 중…" : `${bubble.brush.price}셀에 사기`}
            </button>
          )}
          <button type="button" onClick={onTry} className="rounded-full border-2 border-[#2B1A1A] bg-[#FFF6C2] px-4 py-1 text-sm font-black text-[#2B1A1A] transition hover:bg-[#FFE98A]">
            체험해보기
          </button>
          {bubble.buy && (
            <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-sm font-bold text-ink-muted transition hover:bg-slate-100">
              그만두기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** 중앙선 아래 칸 하나의 틀 (어두운 바탕에 크림색 테두리) */
const panel = "rounded-2xl border-4 border-[#F3E2C4] bg-[#2A1C17]/75 text-[#FFF8EC] shadow-lg backdrop-blur-[1px]";

/** 첫 화면: 왼쪽 인사말, 오른쪽 메뉴 */
function MenuPanel({ cells, onBrushes }: { cells: number | null; onBrushes: () => void }) {
  return (
    <div className="grid h-full grid-cols-[1.4fr_1fr] gap-4">
      <div className={`${panel} space-y-3 p-[clamp(1rem,3vh,2rem)] text-[clamp(1rem,2.6vh,1.4rem)] font-bold leading-relaxed`}>
        <p>* 어서 오세요! 도로 기프트샵이에요.</p>
        <p>* 그림을 더 반짝이게 해 줄 물건을 팔고 있어요.</p>
      </div>
      <div className={`${panel} flex flex-col p-[clamp(1rem,3vh,2rem)]`}>
        <button
          type="button"
          onClick={onBrushes}
          className="group flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10"
        >
          <span className="text-[clamp(1.1rem,2.8vh,1.5rem)] text-[#E8473F] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">♥</span>
          <span className="text-[clamp(1.1rem,2.8vh,1.5rem)] font-black">1. 특수 브러쉬</span>
        </button>
        <p className="mt-auto text-right text-[clamp(0.9rem,2.2vh,1.15rem)] font-black text-[#FFD23F]">보유 셀 {cells === null ? "…" : cells.toLocaleString()}</p>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { cells, brushes, error, buy } = useSpecialBrushes(true);
  const [view, setView] = useState<"menu" | "brushes">("menu");
  const [bubble, setBubble] = useState<Bubble>({ text: GREETING });
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 이젤에 올라간 붓과 이젤이 들어와 있는지. tryCount 는 체험할 때마다 캔버스를 새로 만들기 위한 key
  const [easelBrush, setEaselBrush] = useState<SpecialBrush | null>(null);
  const [trying, setTrying] = useState(false);
  // 체험을 끝내고 돌아가는 중인지: 오른쪽 말풍선을 이젤이 다 나간 뒤에 띄우려고 쓴다
  const [returning, setReturning] = useState(false);
  const [tryCount, setTryCount] = useState(0);

  const openBrushes = () => {
    setView("brushes");
    setBubble({ text: "마음에 드는 브러쉬를 골라 보세요!" });
  };
  /** 이젤을 오른쪽 화면 밖 대기 자리로 돌려보낸다 */
  const closeEasel = () => {
    if (trying) setReturning(true);
    setTrying(false);
  };
  const startTry = () => {
    const b = bubble.brush;
    if (!b) return;
    setEaselBrush(b);
    setTryCount((n) => n + 1);
    setBubble({ text: "마음껏 그려보세요!" });
    // 이젤 틀은 늘 오른쪽 화면 밖에 대기하고 있어서, 자리만 바꾸면 미끄러져 들어온다
    setTrying(true);
  };
  const stopTry = () => {
    closeEasel();
    if (easelBrush) setBubble(brushBubble(brushes?.find((b) => b.slug === easelBrush.slug) ?? easelBrush));
  };

  const backToMenu = () => {
    closeEasel();
    setView("menu");
    setSelected(null);
    setBubble({ text: GREETING });
  };
  const pick = (b: SpecialBrush) => {
    closeEasel();
    setSelected(b.slug);
    setBubble(brushBubble(b));
  };
  const purchase = () => {
    const b = bubble.brush;
    if (!b) return;
    setBusy(true);
    buy(b.slug)
      .then(
        () => setBubble({ text: `고마워요! 이제 ${b.name} 브러쉬를 쓸 수 있어요.`, brush: { ...b, owned: true } }),
        (err: Error) => setBubble({ text: err.message, brush: b, buy: true }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#2A1C17] text-ink">
      {/* 중앙선 위: 매대 배경, 점원, 말풍선 */}
      <section className="relative h-1/2 shrink-0 overflow-hidden bg-[#3A1F12]">
        <ShopWall className="absolute inset-0 h-full w-full" />
        {/* 화면 폭 전체에 걸친 줄이라 빈 곳은 클릭을 막지 않게 하고, 버튼과 셀 표시만 마우스를 받는다 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 *:pointer-events-auto sm:px-8">
          <button type="button" onClick={() => navigate("/")} className="rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-bold text-[#7A3E1F] shadow-sm transition hover:bg-white">
            ← 메인으로
          </button>
          <span className="rounded-full border-2 border-[#F2A91D] bg-[#FFF6C2] px-4 py-1.5 text-sm font-black text-[#7A4A00] shadow-sm">
            보유 셀 {cells === null ? "…" : cells.toLocaleString()}
          </span>
        </div>
        {/* 이젤 캔버스: 말풍선 자리, 카운터 뒤에 선다. 다리 윗부분만 카운터 너머로 보이도록 내려 둔다 */}
        <div
          inert={!trying}
          className={`absolute bottom-[-22%] left-[calc(50%+min(22vh,16rem))] z-20 h-[125%] transition-transform duration-700 ease-in-out ${trying ? "translate-x-0" : "translate-x-[100vw]"}`}
        >
          {easelBrush && <EaselCanvas key={tryCount} slug={easelBrush.slug} name={easelBrush.name} onBack={stopTry} className="h-full" />}
        </div>
        {/* 몸만 오려 낸 그림이라 아래쪽이 중앙선에 딱 붙는다. 크기를 비율로 정해 반올림으로 틈이 생길 수 있어 1px 내려 둔다 (넘친 부분은 이 칸이 잘라 낸다) */}
        <img src="/assets/shop/clerk.png" alt="기프트샵 점원" className="absolute -bottom-px left-1/2 h-[84%] w-auto -translate-x-1/2 object-contain drop-shadow-xl" />
        {/* 말풍선: 평소에는 캐릭터 오른쪽, 체험하는 동안에는 캐릭터 왼쪽.
            옆으로 미끄러지지 않고, 자리가 바뀌면 key 로 새로 만들어 원래 자리에서 사라졌다가 새 자리에 톡 나타난다 */}
        <div
          key={trying ? "left" : "right"}
          className={`bubble-pop absolute bottom-[42%] left-1/2 z-10 ${trying ? "-translate-x-[calc(100%+min(22vh,16rem)+3rem)]" : "translate-x-[min(22vh,16rem)]"}`}
          // 왼쪽으로 갈 때는 잠깐 뒤에, 오른쪽으로 돌아올 때는 이젤이 나가기 시작하고 0.15초 뒤 나타난다
          style={{ animationDelay: trying ? "0.2s" : returning ? "0.15s" : "0s" }}
        >
          <SpeechBubble bubble={bubble} side={trying ? "left" : "right"} cells={cells} busy={busy} onBuy={purchase} onTry={startTry} onCancel={() => setBubble({ text: "천천히 둘러보세요!" })} />
        </div>
      </section>

      {/* 중앙선 */}
      <div className="h-2 shrink-0 bg-[#F3E2C4]" aria-hidden="true" />

      {/* 중앙선 아래: 첫 화면 칸과 브러쉬 상자가 옆으로 나란히 있고, 고른 쪽으로 밀어 보여 준다 */}
      <section aria-label="상품" className="relative min-h-0 flex-1 overflow-hidden">
        <CounterBackdrop className="absolute inset-0 h-full w-full" />
        <div className={`relative flex h-full w-[200%] transition-transform duration-500 ease-out ${view === "brushes" ? "-translate-x-1/2" : "translate-x-0"}`}>
          <div className="h-full w-1/2 p-[clamp(0.75rem,3vh,2rem)]" inert={view !== "menu"}>
            <div className="mx-auto h-full max-w-6xl">
              <MenuPanel cells={cells} onBrushes={openBrushes} />
            </div>
          </div>
          <div className="relative flex h-full w-1/2 flex-col items-center p-[clamp(0.5rem,2vh,1.5rem)]" inert={view !== "brushes"}>
            <button type="button" onClick={backToMenu} className="absolute left-5 top-3 z-10 rounded-full border-2 border-[#F3E2C4] bg-[#2A1C17]/85 px-4 py-1.5 text-sm font-bold text-[#FFF8EC] transition hover:bg-[#2A1C17] sm:left-8">
              ← 메뉴로
            </button>
            {error ? (
              <p className="m-auto font-bold text-red-300">{error}</p>
            ) : brushes ? (
              <BrushBox brushes={brushes} selected={selected} onPick={pick} className="h-full w-full max-w-6xl" />
            ) : (
              <p className="m-auto font-bold text-[#FFF8EC]">브러쉬를 꺼내는 중…</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
