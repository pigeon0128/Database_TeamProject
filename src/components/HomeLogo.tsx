// 하위 화면 왼쪽 위의 "🏠 DOROBUS" 버튼. 누르면 메인(AI 화실, #/)으로 돌아간다.
import { navigate } from "../router";

type Props = {
  /** 좁은 화면에서도 DOROBUS 글자를 보일지 (그리기 화면처럼 도구가 많은 헤더는 넓은 화면에서만 보인다) */
  textClassName?: string;
};

export default function HomeLogo({ textClassName = "hidden sm:inline" }: Props) {
  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      title="메인으로"
      aria-label="DOROBUS 메인으로"
      className="mr-1 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-lg font-black tracking-[-0.04em] text-[#64a5ff] transition hover:bg-blue-50"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.2 12 4l9 7.2" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M10 20v-5.5h4V20" />
      </svg>
      <span className={textClassName}>DOROBUS</span>
    </button>
  );
}
