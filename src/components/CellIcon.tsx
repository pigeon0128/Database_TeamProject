// 셀(앱 안 재화) 아이콘: 이 아이콘이 붙은 버튼은 누르면 셀이 든다 (AI 밑그림, AI 그림 생성 등).
// 글자 크기(1em)에 맞춰 커지므로 버튼 글자 옆에 그대로 넣으면 된다.
import { useId } from "react";

export default function CellIcon({ className = "", title }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* 육각형 보석 */}
      <path d="M10 1.5 17.4 5.75v8.5L10 18.5 2.6 14.25v-8.5Z" fill={`url(#${id})`} stroke="#047857" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10 5.2 13.9 7.45v4.5L10 14.2 6.1 11.95v-4.5Z" fill="#ffffff" fillOpacity=".45" />
      <path d="M6.6 6.3 9 4.9" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
