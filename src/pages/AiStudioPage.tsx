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
import { api, artworkUrl, type AiCharacterParts, type AiGender, type AiImageInput } from "../lib/api";
import { downloadImage } from "../lib/download";

const MAX_FIELD = 150;
const MAX_AVOID = 120;
/** 프롬프트 직접 쓰기 글자 수 (서버 MAX_FREE_PROMPT 와 같다) */
const MAX_FREE_PROMPT = 1000;
/** 쓰는 방식: 칸별로 나눠 쓰기 / 프롬프트 한 덩어리로 직접 쓰기(복사·붙여넣기) */
type WriteMode = "fields" | "free";
const MODES: { value: WriteMode; label: string }[] = [
  { value: "fields", label: "칸별로 쓰기" },
  { value: "free", label: "프롬프트 직접 쓰기" },
];
/** 그림 오른쪽 기록 막대에 남기는 그림 수 */
const HISTORY = 6;
/**
 * 기록 칸 한 개의 크기: 막대 안쪽 폭과 (막대 안쪽 높이 - "기록 n/6" 줄 16 - 칸 사이 간격 8씩) / 칸 수 중 작은 쪽.
 * 막대가 크기 기준(container)이라 cqw·cqh 는 막대 안쪽(여백 뺀) 폭·높이다.
 */
const SLOT_SIZE = `min(100cqw, (100cqh - ${16 + HISTORY * 8}px) / ${HISTORY})`;

/** 캐릭터 칸: 위에서 아래로 (서버 CHARACTER_PARTS 와 같은 순서) */
const PARTS: { key: keyof AiCharacterParts; label: string; icon: string; placeholder: string }[] = [
  { key: "head", label: "머리", icon: "💇", placeholder: "빨간 곱슬머리" },
  { key: "face", label: "얼굴", icon: "🙂", placeholder: "동그란 눈, 웃는 입" },
  { key: "upper", label: "상반신", icon: "👕", placeholder: "초록 후드티" },
  { key: "lower", label: "하반신", icon: "👖", placeholder: "청바지, 운동화" },
];

const EMPTY_PARTS: AiCharacterParts = { head: "", face: "", upper: "", lower: "" };

/** 화풍 (서버 ART_STYLES 의 이름과 같다. "" = 기본) */
const STYLES: { value: string; label: string }[] = [
  { value: "", label: "그림책 (기본)" },
  { value: "watercolor", label: "수채화" },
  { value: "crayon", label: "크레파스" },
  { value: "pencil", label: "색연필" },
  { value: "cartoon", label: "만화" },
  { value: "clay", label: "점토 인형" },
  { value: "pixel", label: "픽셀 아트" },
  { value: "anime", label: "애니메이션" },
  { value: "realistic", label: "실사" },
];
const GENDERS: { value: AiGender; label: string }[] = [
  { value: "any", label: "상관없음" },
  { value: "female", label: "여자" },
  { value: "male", label: "남자" },
];
const COUNTS = [1, 2, 3];
const styleLabel = (value: string) => STYLES.find((s) => s.value === value)?.label ?? STYLES[0].label;
const genderLabel = (value: AiGender) => GENDERS.find((g) => g.value === value)?.label ?? "상관없음";

/** 이번에 만든 그림. imageId: 마이룸에 추가할 때 쓰는 서버 보관 번호, inRoom: 마이룸에 추가했는지 */
type Made = { id: number; image: string; imageId: string; input: AiImageInput; inRoom: boolean };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-sky-deep focus:ring-2 focus:ring-sky-deep/20";
/** 캐릭터 칸·화풍처럼 줄이 많은 곳은 조금 낮게 (한 화면에 들어오게) */
const rowInputClass = inputClass.replace("py-2", "py-1.5");

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

/** 여러 개 중 하나 고르기 (성별·인원). 붙어 있는 작은 버튼 묶음 */
function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs font-bold transition ${o.value === value ? "bg-sky-deep text-white" : "text-ink-muted hover:bg-sky-soft"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 만든 그림에 쓴 설명을 칸 이름과 함께 한 줄씩 (짧게) */
function InputSummary({ input }: { input: AiImageInput }) {
  const rows: [string, string][] = [];
  if (input.prompt) return <p className="line-clamp-4 text-xs font-bold leading-snug" title={input.prompt}>📝 {input.prompt}</p>;
  rows.push(["🖌️", styleLabel(input.style)]);
  if (input.background) rows.push(["🏞️", input.background]);
  if (input.character) {
    const c = input.character;
    rows.push(["🧑", `${c.count}명 · ${genderLabel(c.gender)}`]);
    for (const p of PARTS) if (c[p.key]) rows.push([p.icon, c[p.key]]);
    if (c.pose) rows.push(["🤸", c.pose]);
  } else rows.push(["🧑", "캐릭터 없음"]);
  if (input.avoid) rows.push(["🚫", input.avoid]);
  return (
    // 두 줄로 나눠 칸이 많아도(화풍·인원·자세…) 아래 상자 안에 다 보이게
    <ul className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-0.5">
      {rows.map(([icon, text]) => (
        <li key={icon + text} className="flex min-w-0 gap-1.5 text-xs font-bold leading-snug" title={text}>
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
  const [style, setStyle] = useState("");
  const [gender, setGender] = useState<AiGender>("any");
  const [count, setCount] = useState(1);
  const [pose, setPose] = useState("");
  const [mode, setMode] = useState<WriteMode>("fields");
  const [prompt, setPrompt] = useState("");
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** 이번에 만든 그림들 (최신이 앞) */
  const [made, setMade] = useState<Made[]>([]);
  const [shownId, setShownId] = useState<number | null>(null);
  const shown = made.find((m) => m.id === shownId) ?? made[0] ?? null;
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  /** 마이룸 수납함 창 (화면을 바꾸지 않아 이번에 만든 그림 기록이 그대로 남는다) */
  const [shelfOpen, setShelfOpen] = useState(false);

  /** 한 장의 가격과 내 셀 (GET /api/ai/image) */
  const [wallet, setWallet] = useState<{ cost: number; cells: number } | null>(null);
  const loadWallet = useCallback(() => {
    api.aiImageInfo().then(setWallet, () => {});
  }, []);
  useEffect(loadWallet, [loadWallet]);
  const short = wallet !== null && wallet.cells < wallet.cost;

  const hasCharacter = characterOn && (PARTS.some((p) => parts[p.key].trim()) || !!pose.trim());
  /** 만들 수 있는지: 배경을 적었거나, 캐릭터를 켜고 한 칸 이상 적었으면 */
  const free = mode === "free";
  const ready = free ? !!prompt.trim() : !!background.trim() || hasCharacter;
  const missing = ready ? "" : free ? "프롬프트를 적거나 붙여 넣어 주세요." : characterOn ? "배경이나 캐릭터 칸을 하나 이상 적어 주세요." : "배경 설명을 적어 주세요.";

  const generate = async () => {
    if (!ready || loading || short) return;
    const input: AiImageInput = free
      ? { background: "", style: "", character: null, avoid: "", prompt: prompt.trim() }
      : {
      background: background.trim(),
      style,
      character: characterOn
        ? { head: parts.head.trim(), face: parts.face.trim(), upper: parts.upper.trim(), lower: parts.lower.trim(), gender, count, pose: pose.trim() }
        : null,
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
    if (m.input.prompt) {
      setMode("free");
      setPrompt(m.input.prompt);
      return;
    }
    setMode("fields");
    setBackground(m.input.background);
    setCharacterOn(!!m.input.character);
    setStyle(m.input.style);
    const c = m.input.character;
    setParts(c ? { head: c.head, face: c.face, upper: c.upper, lower: c.lower } : EMPTY_PARTS);
    setGender(c?.gender ?? "any");
    setCount(c?.count ?? 1);
    setPose(c?.pose ?? "");
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
      setNotice({ ok: true, text: "마이룸 수납함에 넣었어요. 마이룸에서 액자를 골라 걸 수 있어요." });
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
        <button
          type="button"
          onClick={() => setShelfOpen(true)}
          className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-black text-ink transition hover:border-sky-deep hover:text-sky-deep"
        >
          🏠 마이룸 수납함
        </button>
        {wallet && <span className="rounded-full bg-sky-soft px-3 py-1 text-sm font-black"><CellIcon /> 내 셀 {wallet.cells.toLocaleString()}</span>}
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(390px,440px)_minmax(0,1fr)]">
        {/* 왼쪽: 설명 쓰기 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
          className={`flex min-h-0 flex-col gap-3 overflow-y-auto px-5 py-4 ${card}`}
        >
          {/* 쓰는 방식 전환: 칸별로 나눠 연습하기 / 프롬프트 한 덩어리로 직접 쓰기 (다른 곳에서 복사해 붙여 넣기) */}
          <div role="radiogroup" aria-label="쓰는 방식" className="grid shrink-0 grid-cols-2 rounded-xl bg-slate-100 p-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`rounded-lg py-1.5 text-xs font-black transition ${mode === m.value ? "bg-white text-sky-deep shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {free ? (
            <label className="flex min-h-0 flex-1 flex-col">
              <span className="flex items-baseline justify-between gap-2">
                {label("프롬프트")}
                <span className="text-[11px] font-semibold text-slate-400">
                  {prompt.length}/{MAX_FREE_PROMPT}
                </span>
              </span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={MAX_FREE_PROMPT}
                placeholder="원하는 그림을 자유롭게 적거나, 다른 곳에서 복사한 프롬프트를 붙여 넣어 보세요."
                className={`${inputClass} mt-1.5 min-h-40 flex-1 resize-none leading-relaxed`}
              />
            </label>
          ) : (
            <>
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

          {/* 화풍: 정해진 것 중에서 고른다 (서버가 영어 설명으로 바꾼다) */}
          <label className="flex items-center gap-2">
            <span className="shrink-0">{label("화풍")}</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className={`${rowInputClass} cursor-pointer`}>
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* 캐릭터: 스위치 하나 + 켜면 성별·인원, 부위별 칸, 자세가 한 줄씩 (이름 | 칸) */}
          <div>
            <div className="flex items-center justify-between">
              {label("캐릭터", characterOn ? undefined : "끄면 배경만 그려요")}
              <Switch on={characterOn} onChange={setCharacterOn} label="캐릭터 넣기" />
            </div>
            {characterOn && (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs font-bold text-ink-muted">성별</span>
                    <Segmented label="성별" value={gender} options={GENDERS} onChange={setGender} />
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="shrink-0 text-xs font-bold text-ink-muted">인원</span>
                    <Segmented label="인원" value={count} options={COUNTS.map((n) => ({ value: n, label: `${n}명` }))} onChange={setCount} />
                  </div>
                </div>
                {PARTS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs font-bold text-ink-muted">{p.label}</span>
                    <input
                      type="text"
                      value={parts[p.key]}
                      onChange={(e) => setParts((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      maxLength={MAX_FIELD}
                      placeholder={p.placeholder}
                      className={rowInputClass}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-bold text-ink-muted">자세</span>
                  <input
                    type="text"
                    value={pose}
                    onChange={(e) => setPose(e.target.value)}
                    maxLength={MAX_FIELD}
                    placeholder="손을 흔들며 뛰어오는"
                    className={rowInputClass}
                  />
                </label>
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

            </>
          )}

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
                <button type="button" onClick={() => setShelfOpen(true)} className="ml-auto underline">
                  넣은 그림 보기
                </button>
              )}
            </p>
          )}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">{error}</p>}

          {/* 왼쪽: 남은 높이에 맞춘 정사각형 그림 + 그 아래 쓴 설명 / 오른쪽: 기록 막대 (아래 끝까지) */}
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
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

            {/* 지금 보는 그림에 쓴 설명 */}
            {shown && (
              <div className="h-20 shrink-0 overflow-hidden rounded-2xl bg-slate-50 p-2">
                <InputSummary input={shown.input} />
              </div>
            )}
            </div>

            {/* 오른쪽 기록 막대: 이번에 만든 그림 최근 HISTORY 장 (최신이 위, 화면을 나가면 사라진다) */}
            {/* 칸 크기는 막대 높이에 맞춰 줄어든다 (창이 낮거나 위에 안내 줄이 생겨도 아래 설명 칸으로 넘치지 않게) */}
            <div className="flex min-h-0 w-20 shrink-0 flex-col items-center gap-2 overflow-hidden rounded-2xl bg-slate-50 p-2 [container-type:size]" aria-label="이번에 만든 그림">
              <span className="text-center text-[11px] font-bold text-ink-muted">기록 {made.length}/{HISTORY}</span>
              {Array.from({ length: HISTORY }, (_, i) => made[i] ?? null).map((m, i) =>
                m ? (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setShownId(m.id)}
                    title="이 그림 보기"
                    style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
                    className={`relative shrink-0 overflow-hidden rounded-xl border-2 bg-white ${m.id === shown?.id ? "border-sky-deep" : "border-transparent hover:border-sky-haze"}`}
                  >
                    <img src={m.image} alt="" className="h-full w-full object-cover" />
                    {m.inRoom && <span className="absolute bottom-0 right-0 rounded-tl-lg bg-white/90 px-1 text-[10px]">🏠</span>}
                  </button>
                ) : (
                  <div key={`empty-${i}`} style={{ width: SLOT_SIZE, height: SLOT_SIZE }} className="shrink-0 rounded-xl border-2 border-dashed border-slate-200" />
                ),
              )}
            </div>
          </div>
        </section>
      </div>
      {shelfOpen && <RoomShelf onClose={() => setShelfOpen(false)} />}
    </main>
  );
}

/**
 * 마이룸 수납함 창: 마이룸에 넣은 AI 그림을 화면을 바꾸지 않고 보여 준다 (마이룸으로 가면 이번에 만든 그림 기록이 사라지므로).
 * 열 때마다 서버에서 다시 받는다. Esc 나 바깥을 누르면 닫힌다.
 */
function RoomShelf({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<{ drawingId: number; title: string; imageKey: string; createdAt: string }[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.aiArtworks().then(
      (r) => setList(r.artworks),
      (err) => setError(err instanceof Error ? err.message : "목록을 불러오지 못했어요."),
    );
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const date = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="마이룸 수납함"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-[min(760px,100%)] flex-col gap-3 rounded-3xl border border-white/90 bg-white p-5 shadow-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">🏠 마이룸 수납함{list ? ` · ${list.length}장` : ""}</h2>
            <p className="text-xs font-semibold text-ink-muted">마이룸에 넣은 AI 그림이에요. 마이룸에서 액자를 골라 걸 수 있어요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full px-2 text-2xl font-bold leading-none text-ink-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">{error}</p>
          ) : !list ? (
            <p className="py-10 text-center text-sm font-bold text-ink-muted">불러오는 중…</p>
          ) : !list.length ? (
            <p className="py-10 text-center text-sm font-bold text-ink-muted">아직 넣은 그림이 없어요. 마음에 드는 그림에서 🏠 마이룸에 추가를 눌러 보세요.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {list.map((a) => (
                <li key={a.drawingId} className="min-w-0">
                  <img src={artworkUrl(a.imageKey)} alt={a.title} loading="lazy" className="aspect-square w-full rounded-2xl border border-slate-100 bg-sky-soft object-cover" />
                  <p className="mt-1 truncate text-xs font-bold" title={a.title}>
                    {a.title}
                  </p>
                  <p className="text-[11px] font-semibold text-ink-muted">{date(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
