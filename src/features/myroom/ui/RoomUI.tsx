import { useEffect, useRef, type ReactNode } from "react"
import type { ObjectType } from "../types"

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z" />
      </>
    ),
    inventory: (
      <>
        <rect x="3" y="6" width="18" height="15" rx="2" />
        <path d="M8 6V3h8v3M3 12h18M12 10v4" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5M12 17v1" />
      </>
    ),
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 2 8M3 3v7h7" />
      </>
    ),
    save: (
      <>
        <path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-8h10v8" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    move: (
      <>
        <path d="M12 2v20M2 12h20m-7-7-3-3-3 3m6 14-3 3-3-3M5 9l-3 3 3 3m14-6 3 3-3 3" />
      </>
    ),
    frame: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="m5 17 5-6 4 4 3-3 3 5M8 7h.01" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
  }
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.frame}
    </svg>
  )
}

export function ObjectThumbnail({ type }: { type: ObjectType }) {
  return (
    <svg viewBox="0 0 100 100" className="mr-thumbnail" aria-hidden="true">
      <ellipse cx="50" cy="88" rx="28" ry="5" fill="#dfe2e5" opacity=".5" />
      {type === "frame" ? (
        <>
          <rect
            x="19"
            y="10"
            width="62"
            height="76"
            rx="3"
            fill="#877554"
            stroke="#66573e"
            strokeWidth="2"
          />
          <rect x="25" y="16" width="50" height="64" fill="#e1d8bb" />
          <rect x="29" y="20" width="42" height="56" fill="#f8f8f4" />
        </>
      ) : type === "easel" ? (
        <>
          <path
            d="M22 88 48 9h5l26 79M50 22l4 66M23 70h55"
            stroke="#84613b"
            strokeWidth="5"
            fill="none"
          />
          <rect
            x="29"
            y="24"
            width="43"
            height="49"
            fill="#f8f8f4"
            stroke="#b38b58"
            strokeWidth="3"
          />
          <path d="M24 75h53" stroke="#84613b" strokeWidth="6" />
        </>
      ) : type === "chair" ? (
        <>
          <path
            d="m31 55-7 32m42-32 9 32M38 30l-5 33m31-35 4 34"
            stroke="#4e565b"
            strokeWidth="4"
          />
          <path d="m31 20 33 2 2 32-35-3z" fill="#555d61" />
          <path d="m29 52 38 3 7 11-45-4z" fill="#373e42" />
        </>
      ) : type === "table" ? (
        <>
          <path
            d="M24 42v43m52-43v43M36 47v32m29-32v32"
            stroke="#765232"
            strokeWidth="5"
          />
          <path d="m13 34 52-6 24 15-55 9-21-9z" fill="#a47a4b" />
          <path d="m13 43 21 9 55-9v-6l-55 9-21-9z" fill="#694a2c" />
        </>
      ) : (
        <>
          <path d="m34 66 5 21h23l5-21z" fill="#b08c5f" />
          <path d="M51 37v33" stroke="#72532c" strokeWidth="6" />
          <path
            d="M22 44q-4-22 18-23 14-20 31 1 22 2 11 24-1 20-25 14-25 14-35-16"
            fill="#739340"
          />
          <circle cx="38" cy="35" r="10" fill="#89a84c" />
        </>
      )}
    </svg>
  )
}

export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}) {
  const panel = useRef<HTMLDivElement>(null),
    close = useRef<HTMLButtonElement>(null)
  const handler = useRef(onClose)
  handler.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    close.current?.focus()
    return () => previous?.focus()
  }, [])
  return (
    <div
      className="mr-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handler.current()
      }}
    >
      <div
        className={`mr-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            handler.current()
          }
          if (e.key === "Tab") {
            const buttons = panel.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input, [tabindex="0"]',
            )
            if (!buttons?.length) return
            const first = buttons[0],
              last = buttons[buttons.length - 1]
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first.focus()
            }
          }
        }}
      >
        <header>
          <h2>
            <Icon name="inventory" />
            {title}
          </h2>
          <button
            ref={close}
            className="mr-icon-button"
            aria-label={`${title} 닫기`}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
