import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { ApiError } from "../lib/api";

type Mode = "login" | "register";

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-2xl border border-sky-haze bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-sky-deep focus:ring-3 focus:ring-sky-deep/20"
      />
      {hint && <span className="mt-1 block text-xs font-medium text-ink-muted">{hint}</span>}
    </label>
  );
}

export default function LoginPage() {
  const { login, register, serverError, recheck, checking } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirm("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "register" && password !== confirm) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await (mode === "login" ? login : register)(loginId.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-soft px-5 py-10 text-ink">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            도로 AI <span className="text-sky-deep">그림</span> 그리기
          </h1>
          <p className="mt-2 text-sm font-medium text-ink-muted">아이디와 비밀번호로 입장해 주세요.</p>
        </header>

        <section className="rounded-4xl border border-white/90 bg-white/80 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-sky-soft p-1" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-xl py-2.5 text-sm font-extrabold transition ${mode === m ? "bg-white text-sky-deep shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {m === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field
              label="아이디"
              type="text"
              value={loginId}
              onChange={setLoginId}
              autoComplete="username"
              hint={mode === "register" ? "2~20자, 한글·영문·숫자·_·- 사용 가능. 리더보드에 이 아이디가 보여요." : undefined}
            />
            <Field
              label="비밀번호"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              hint={mode === "register" ? "4자 이상" : undefined}
            />
            {mode === "register" && <Field label="비밀번호 확인" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />}

            {(error ?? serverError) && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {error ?? serverError}
                {!error && serverError && (
                  <button type="button" onClick={recheck} disabled={checking} className="ml-2 underline underline-offset-2">
                    다시 확인
                  </button>
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-sky-deep py-3.5 text-base font-extrabold text-white shadow-card transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "잠시만요…" : mode === "login" ? "입장하기" : "가입하고 입장하기"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
