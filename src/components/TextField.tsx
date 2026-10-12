// 글자 입력 칸 (이름 + 입력 + 안내 문구). 로그인 화면(로그인·회원가입·비밀번호 변경)에서 쓴다.

export default function TextField({
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
