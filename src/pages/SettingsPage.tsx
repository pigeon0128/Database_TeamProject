// 설정 및 방법 화면 (#/settings): 그리기 단축키 바꾸기. (비밀번호 변경은 로그인 화면에 있다)
// 단축키는 그리기 설정과 함께 DB에 저장된다 (lib/userSettings → user_settings.shortcuts).
import { useEffect, useState, type ReactNode } from "react";
import PageLayout from "../components/PageLayout";
import { Kbd } from "../components/toolbar";
import {
  changedShortcuts,
  comboFromEvent,
  comboKeys,
  comboProblem,
  DEFAULT_SHORTCUTS,
  resolveShortcuts,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  type ShortcutAction,
} from "../lib/shortcuts";
import { useSavedSetting } from "../lib/userSettings";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-4xl border border-white/90 bg-white/80 p-6 shadow-card backdrop-blur sm:p-8">
      <h2 className="text-xl font-black tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 text-sm font-medium text-ink-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Notice({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm font-bold ${tone === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
      {children}
    </p>
  );
}

/** 단축키 바꾸기: "바꾸기"를 누르고 새 키를 누르면 바로 저장된다. Esc 는 취소 */
function ShortcutEditor() {
  const [saved, setSaved] = useSavedSetting("shortcuts");
  const keys = resolveShortcuts(saved);
  const [editing, setEditing] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (action: ShortcutAction, combo: string) => setSaved(changedShortcuts({ ...keys, [action]: combo }));

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setEditing(null);
        setError(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return; // Ctrl·Shift 같은 수정 키만 누른 상태: 나머지 키를 기다린다
      const problem = comboProblem(combo);
      const owner = SHORTCUT_ACTIONS.find((a) => a !== editing && keys[a] === combo);
      if (problem) setError(problem);
      else if (owner) setError(`이미 '${SHORTCUT_LABELS[owner]}'에 쓰는 키예요. 그 단축키를 먼저 다른 키로 바꿔 주세요.`);
      else {
        save(editing, combo);
        setEditing(null);
        setError(null);
      }
    };
    // 다른 화면 부품보다 먼저 키를 받는다
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const changedCount = Object.keys(changedShortcuts(keys)).length;

  return (
    <>
      <ul className="grid gap-x-8 md:grid-cols-2">
        {SHORTCUT_ACTIONS.map((action) => {
          const isEditing = editing === action;
          const isDefault = keys[action] === DEFAULT_SHORTCUTS[action];
          return (
            <li key={action} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-sky-haze py-2">
              <span className="w-24 shrink-0 text-sm font-bold">{SHORTCUT_LABELS[action]}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1">
                {isEditing ? (
                  <span className="animate-pulse text-sm font-bold text-sky-deep">새 키를 누르세요… (취소: Esc)</span>
                ) : (
                  comboKeys(keys[action]).map((k) => <Kbd key={k}>{k}</Kbd>)
                )}
              </span>
              <span className="flex gap-1.5">
                {!isDefault && !isEditing && (
                  <button
                    type="button"
                    onClick={() => save(action, DEFAULT_SHORTCUTS[action])}
                    disabled={SHORTCUT_ACTIONS.some((a) => a !== action && keys[a] === DEFAULT_SHORTCUTS[action])}
                    title="기본 키로 되돌리기"
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-sky-soft hover:text-ink disabled:opacity-40"
                  >
                    기본값
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(isEditing ? null : action);
                    setError(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${isEditing ? "bg-sky-soft text-ink-muted" : "bg-sky-deep text-white hover:brightness-110"}`}
                >
                  {isEditing ? "취소" : "바꾸기"}
                </button>
              </span>
            </li>
          );
        })}
        {/* 마우스 동작은 바꿀 수 없다 (components/TracingCanvas.tsx) */}
        {[
          ["확대·축소", "휠", ""],
          ["화면 이동", "우클릭", "+ 드래그"],
        ].map(([label, key, rest]) => (
          <li key={label} className="flex items-center gap-3 border-b border-sky-haze py-2 text-ink-muted">
            <span className="w-24 shrink-0 text-sm font-bold">{label}</span>
            <span className="flex flex-1 items-center gap-1 text-xs font-semibold">
              <Kbd>{key}</Kbd> {rest} (바꿀 수 없어요)
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">바꾼 키는 바로 저장되고, 다른 기기에서 로그인해도 그대로 쓸 수 있어요.</p>
        <button
          type="button"
          onClick={() => {
            setSaved({});
            setEditing(null);
            setError(null);
          }}
          disabled={changedCount === 0}
          className="rounded-full px-4 py-2 text-sm font-bold text-sky-deep transition hover:bg-sky-soft disabled:opacity-40"
        >
          모두 기본값으로
        </button>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <PageLayout title="설정 및 방법">
      <Section title="⌨️ 단축키" description="그리기 화면(스토리, 캐릭터)에서 쓰는 키를 바꿀 수 있어요. 바꾸기를 누르고 새 키를 누르세요.">
        <ShortcutEditor />
      </Section>
    </PageLayout>
  );
}
