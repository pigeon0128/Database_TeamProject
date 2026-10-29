function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 220 100" aria-hidden="true" className={className}>
      <path d="M22 88C10 88 2 79 2 68s9-20 22-20h4c5-19 21-32 42-32 8 0 16 2 22 6C103 8 119 1 137 1c29 0 52 21 55 49 16 2 27 12 27 25 0 8-6 13-15 13H22Z" fill="currentColor" />
    </svg>
  );
}

export default function DorobusBackdrop({ dense = false }: { dense?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-[42%] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_58%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(180deg,rgba(227,243,255,.18),rgba(211,234,253,.78))]" />
      <Cloud className="cloud-float absolute -left-14 top-[8%] w-64 text-white/95 sm:left-[3%]" />
      <Cloud className="cloud-float-delayed absolute -right-20 top-[16%] w-72 text-white/90 sm:right-[2%] sm:w-80" />
      <span className="absolute left-[8%] top-[44%] size-3 rounded-full bg-white/85" />
      <span className="absolute right-[9%] top-[55%] size-2 rounded-full bg-white/80" />
      {dense && (
        <>
          <span className="absolute bottom-[12%] left-[15%] size-20 rounded-full border border-white/50" />
          <span className="absolute bottom-[8%] right-[18%] size-36 rounded-full bg-white/15" />
        </>
      )}
    </div>
  );
}
