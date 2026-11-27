// AI 그림 연습실 (#/ai-studio). 원하는 그림을 칸마다 글로 직접 설명해 AI가 그리게 하며 프롬프트 쓰는 법을 연습한다.
// 넓은 화면에서는 스크롤 없이 한 화면에 들어온다 (그리기 화면처럼 화면 높이를 꽉 채운다).
// - 왼쪽: 배경 설명 / 캐릭터 켜기·끄기 → 켜면 머리·얼굴·상반신·하반신 / 빼고 싶은 것(선택) / 만들기
//   칸을 나눠 쓰면 "무엇을 어떻게" 설명해야 하는지 스스로 생각하게 된다. 칸 내용은 서버가 그대로 이어 붙여 프롬프트로 보낸다.
// - 오른쪽: 만든 그림 (남은 높이에 맞춘 정사각형), 위에 고쳐 보기·💾 저장·🏠 마이룸에 추가, 아래에 쓴 설명과 이번에 만든 그림들
// 그림은 서버 POST /api/ai/image 가 만들고, 한 장에 셀을 낸다 (요청 글이 막히거나 못 만들면 셀을 내지 않는다).
// 마이룸에 추가하면 서버가 보관해 둔 그 그림을 마이룸 작품(user_ai_artworks)으로 저장해, 마이룸 액자에 걸 수 있다.
import { useCallback, useEffect, useState } from "react";
import CellIcon from "../components/CellIcon";
import DorobusBackdrop from "../components/DorobusBackdrop";
import HomeLogo from "../components/HomeLogo";
import { api, type AiCharacterParts, type AiImageInput } from "../lib/api";
import { downloadImage } from "../lib/download";
import { navigate } from "../router";

const MAX_FIELD = 150;
const MAX_AVOID = 120;
/** 그림 오른쪽 기록 막대에 남기는 그림 수 */
const HISTORY = 5;

/** 캐릭터 칸: 위에서 아래로 (서버 CHARACTER_PARTS 와 같은 순서) */
const PARTS: { key: keyof AiCharacterParts; label: string; icon: string; placeholder: string }[] = [
  { key: "head", label: "머리", icon: "💇", placeholder: "빨간 곱슬머리" },
  { key: "face", label: "얼굴", icon: "🙂", placeholder: "동그란 눈, 웃는 입" },
  { key: "upper", label: "상반신", icon: "👕", placeholder: "초록 후드티" },
  { key: "lower", label: "하반신", icon: "👖", placeholder: "청바지, 운동화" },
];

const EMPTY_PARTS: AiCharacterParts = { head: "", face: "", upper: "", lower: "" };

/** 이번에 만든 그림. imageId: 마이룸에 추가할 때 쓰는 서버 보관 번호, inRoom: 마이룸에 추가했는지 */
type Made = { id: number; image: string; imageId: string; input: AiImageInput; inRoom: boolean };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-sky-deep focus:ring-2 focus:ring-sky-deep/20";

/** 켜기·끄기 스위치 */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? "bg-sky-deep" : "bg-slate-300"}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-1"}`} />
    </button>
  );
}

/** 만든 그림에 쓴 설명을 칸 이름과 함께 한 줄씩 (짧게) */
function InputSummary({ input }: { input: AiImageInput }) {
  const rows: [string, string][] = [];
  if (input.background) rows.push(["🏞️", input.background]);
  if (input.character) {
    for (const p of PARTS) if (input.character[p.key]) rows.push([p.icon, input.character[p.key]]);
  } else rows.push(["🧑", "캐릭터 없음"]);
  if (input.avoid) rows.push(["🚫", input.avoid]);
  return (
    <ul className="min-w-0 space-y-0.5">
      {rows.map(([icon, text]) => (
        <li key={icon + text} className="flex gap-1.5 text-xs font-bold leading-snug" title={text}>
          <span aria-hidden="true">{icon}</span>
          <span className="truncate">{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AiStudioPage() {
  const [background, setBackground] = useState("");
  const [characterOn, setCharacterOn] = useState(true);
  const [parts, setParts] = useState<AiCharacterParts>(EMPTY_PARTS);
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** 이번에 만든 그림들 (최신이 앞) */
  const [made, setMade] = useState<Made[]>([]);
  const [shownId, setShownId] = useState<number | null>(null);
  const shown = made.find((m) => m.id === shownId) ?? made[0] ?? null;
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  /** 한 장의 가격과 내 셀 (GET /api/ai/image) */
  const [wallet, setWallet] = useState<{ cost: number; cells: number } | null>(null);
  const loadWallet = useCallback(() => {
    api.aiImageInfo().then(setWallet, () => {});
  }, []);
  useEffect(loadWallet, [loadWallet]);
  const short = wallet !== null && wallet.cells < wallet.cost;

  const hasCharacter = characterOn && PARTS.some((p) => parts[p.key].trim());
  /** 만들 수 있는지: 배경을 적었거나, 캐릭터를 켜고 한 칸 이상 적었으면 */
  const ready = !!background.trim() || hasCharacter;
  const missing = !ready ? (characterOn ? "배경이나 캐릭터 칸을 하나 이상 적어 주세요." : "배경 설명을 적어 주세요.") : "";

  const generate = async () => {
    if (!ready || loading || short) return;
    const input: AiImageInput = {
      background: background.trim(),
      character: characterOn ? { head: parts.head.trim(), face: parts.face.trim(), upper: parts.upper.trim(), lower: parts.lower.trim() } : null,
      avoid: avoid.trim(),
    };
    // 캐릭터를 켰지만 한 칸도 안 적었으면 캐릭터 없이 보낸다 (배경만 있는 경우)
    if (input.character && !hasCharacter) input.character = null;
    setLoading(true);
    setError("");
    setNotice(null);
    try {
      const { image, imageId, cells, cost } = await api.aiImage(input);
      setWallet({ cost, cells });
      const item = { id: Date.now(), image, imageId, input, inRoom: false };
      setMade((list) => [item, ...list].slice(0, HISTORY));
      setShownId(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "그림을 만들지 못했어요.");
      // 못 만들면 서버가 셀을 돌려주므로 남은 셀을 다시 받는다
      loadWallet();
    } finally {
      setLoading(false);
    }
  };

  /** 만든 그림의 설명을 다시 칸에 넣는다 (조금 바꿔서 다시 만들어 비교) */
  const reuse = (m: Made) => {
    setBackground(m.input.background);
    setCharacterOn(!!m.input.character);
    setParts(m.input.character ?? EMPTY_PARTS);
    setAvoid(m.input.avoid);
  };

  /** 지금 보이는 그림을 마이룸 작품으로 추가한다 (마이룸에서 액자를 골라 "이 그림 전시하기") */
  const addToRoom = async (m: Made) => {
    if (adding || m.inRoom) return;
    setAdding(true);
    setNotice(null);
    try {
      await api.aiImageToMyRoom(m.imageId);
      setMade((list) => list.map((x) => (x.id === m.id ? { ...x, inRoom: true } : x)));
      setNotice({ ok: true, text: "마이룸에 추가했어요. 마이룸에서 액자를 골라 걸 수 있어요." });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "마이룸에 추가하지 못했어요." });
    } finally {
      setAdding(false);
    }
  };

  /** 칸 이름: 굵은 이름 한 단어 + (있으면) 옅은 덧말 */
  const label = (text: string, sub?: string) => (
    <span className="flex items-baseline gap-1.5 text-sm font-extrabold">
      {text}
      {sub && <span className="text-xs font-semibold text-slate-400">{sub}</span>}
    </span>
  );

  const card = "rounded-3xl border border-white/90 bg-white/90 shadow-card backdrop-blur-sm";

  return (
    <main className="relative flex min-h-dvh flex-col gap-3 overflow-hidden bg-[#eef7ff] p-3 text-ink lg:h-dvh">
      <DorobusBackdrop dense />

      {/* 위: 로고 · 제목 · 한 줄 안내 · 내 셀 */}
      <header className={`relative z-20 flex flex-wrap items-center gap-3 px-3 py-2 ${card}`}>
        <HomeLogo />
        <span className="h-7 w-px bg-slate-200" />
        <h1 className="text-lg font-black tracking-[-0.03em]">🪄 AI 그림 연습실</h1>
        <p className="hidden text-sm font-semibold text-ink-muted md:block">칸마다 직접 설명해 보세요. 자세히 적을수록 원하는 그림에 가까워져요.</p>
        {wallet && <span className="ml-auto rounded-full bg-sky-soft px-3 py-1 text-sm font-black"><CellIcon /> 내 셀 {wallet.cells.toLocaleString()}</span>}
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        {/* 왼쪽: 설명 쓰기 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
          className={`flex min-h-0 flex-col gap-5 overflow-y-auto p-5 ${card}`}
        >
          <label className="block">
            {label("배경")}
            <input
              type="text"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              maxLength={MAX_FIELD}
              placeholder="노을 지는 바닷가, 모래성"
              className={`${inputClass} mt-1.5`}
            />
          </label>

          {/* 캐릭터: 스위치 하나 + 켜면 부위별 칸이 한 줄씩 (이름 | 칸) */}
          <div>
            <div className="flex items-center justify-between">
              {label("캐릭터", characterOn ? undefined : "끄면 배경만 그려요")}
              <Switch on={characterOn} onChange={setCharacterOn} label="캐릭터 넣기" />
            </div>
            {characterOn && (
              <div className="mt-1.5 space-y-1.5">
                {PARTS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs font-bold text-ink-muted">{p.label}</span>
                    <input
                      type="text"
                      value={parts[p.key]}
                      onChange={(e) => setParts((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      maxLength={MAX_FIELD}
                      placeholder={p.placeholder}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            {label("빼고 싶은 것", "선택")}
            <input
              type="text"
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              maxLength={MAX_AVOID}
              placeholder="어두운 색"
              className={`${inputClass} mt-1.5`}
            />
          </label>

          <div className="mt-auto pt-1">
            <button
              type="submit"
              disabled={loading || !ready || short}
              className="w-full rounded-2xl bg-blue-500 px-5 py-3.5 text-base font-black text-white shadow-lg shadow-blue-200 transition enabled:hover:-translate-y-0.5 enabled:hover:bg-blue-600 disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? (
                "AI가 그리고 있어요…"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  🪄 그림 만들기 <CellIcon /> {wallet ? `${wallet.cost}셀` : ""}
                </span>
              )}
            </button>
            {/* 안내 한 줄: 적을 칸이 비었으면 그 안내, 아니면 셀 */}
            <p className={`mt-1.5 text-center text-xs font-bold ${short ? "text-rose-600" : "text-ink-muted"}`}>
              {missing
                ? `✏️ ${missing}`
                : !wallet
                  ? " "
                  : short
                    ? `셀이 부족해요 · 내 셀 ${wallet.cells.toLocaleString()} / 필요 ${wallet.cost}`
                    : `한 장에 ${wallet.cost}셀이 들어요`}
            </p>
          </div>
        </form>

        {/* 오른쪽: 결과 */}
        <section className={`flex min-h-0 flex-col gap-2 p-3 ${card}`}>
          {/* 제목은 화면에 띄우지 않고(그림이 더 크게) 읽기 도구에만 남긴다. 버튼 줄은 그림이 있을 때만 */}
          <h2 className="sr-only">AI가 그린 그림</h2>
          <div className={shown ? "flex flex-wrap items-center justify-end gap-2" : "hidden"}>
            {shown && (
              <>
                <button type="button" onClick={() => reuse(shown)} className="rounded-full bg-sky-soft px-3 py-1.5 text-sm font-black text-sky-deep hover:bg-sky-haze">
                  ✏️ 이 설명 고쳐 보기
                </button>
                <button type="button" onClick={() => downloadImage(shown.image, `AI그림-${shown.id}.png`)} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black hover:bg-slate-200">
                  💾 PNG 저장
                </button>
                <button
                  type="button"
                  onClick={() => void addToRoom(shown)}
                  disabled={adding || shown.inRoom}
                  className="rounded-full bg-ink px-3 py-1.5 text-sm font-black text-white enabled:hover:brightness-110 disabled:bg-emerald-600"
                >
                  {shown.inRoom ? "✅ 마이룸에 있어요" : adding ? "추가하는 중…" : "🏠 마이룸에 추가"}
                </button>
              </>
            )}
          </div>
          {notice && (
            <p className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold ${notice.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
              {notice.text}
              {notice.ok && (
                <button type="button" onClick={() => navigate("/myroom")} className="ml-auto underline">
                  마이룸 열기 →
                </button>
              )}
            </p>
          )}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">{error}</p>}

          {/* 남은 높이에 맞춘 정사각형 그림 + 오른쪽 기록 막대 */}
          <div className="flex min-h-[18rem] flex-1 gap-3">
            <div className="flex min-w-0 flex-1 items-center justify-center [container-type:size]">
              <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-sky-soft" style={{ width: "min(100cqw, 100cqh)", height: "min(100cqw, 100cqh)" }}>
                {shown ? (
                  <img src={shown.image} alt="AI가 그린 그림" className="h-full w-full object-contain" />
                ) : (
                  <p className="px-6 text-center text-sm font-bold text-ink-muted">왼쪽 칸에 원하는 그림을 적고 🪄 그림 만들기를 눌러 보세요.</p>
                )}
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 text-sm font-black text-sky-deep backdrop-blur-sm">
                    <span className="animate-pulse text-4xl" aria-hidden="true">🪄</span>
                    AI가 그리고 있어요. 20초~1분쯤 걸려요.
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽 기록 막대: 이번에 만든 그림 최근 HISTORY 장 (최신이 위, 화면을 나가면 사라진다) */}
            <div className="flex w-20 shrink-0 flex-col gap-2 rounded-2xl bg-slate-50 p-2" aria-label="이번에 만든 그림">
              <span className="text-center text-[11px] font-bold text-ink-muted">기록 {made.length}/{HISTORY}</span>
              {Array.from({ length: HISTORY }, (_, i) => made[i] ?? null).map((m, i) =>
                m ? (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setShownId(m.id)}
                    title="이 그림 보기"
                    className={`relative aspect-square w-full shrink-0 overflow-hidden rounded-xl border-2 bg-white ${m.id === shown?.id ? "border-sky-deep" : "border-transparent hover:border-sky-haze"}`}
                  >
                    <img src={m.image} alt="" className="h-full w-full object-cover" />
                    {m.inRoom && <span className="absolute bottom-0 right-0 rounded-tl-lg bg-white/90 px-1 text-[10px]">🏠</span>}
                  </button>
                ) : (
                  <div key={`empty-${i}`} className="aspect-square w-full shrink-0 rounded-xl border-2 border-dashed border-slate-200" />
                ),
              )}
            </div>
          </div>

          {/* 아래: 지금 보는 그림에 쓴 설명 */}
          {shown && (
            <div className="h-20 shrink-0 overflow-hidden rounded-2xl bg-slate-50 p-2">
              <InputSummary input={shown.input} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
