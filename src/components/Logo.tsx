"use client";

export function Logo({ className = "h-9 w-auto", monochrome = false }: { className?: string; monochrome?: boolean }) {
  return (
    <div
      aria-label="JAAD"
      className={`${className} inline-flex items-center gap-2 ${monochrome ? "grayscale" : ""}`}
    >
      <svg viewBox="0 0 40 40" className="h-full w-auto" aria-hidden="true">
        <defs>
          <linearGradient id="jc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2D9C8B" />
            <stop offset="100%" stopColor="#1B6B5E" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#jc-grad)" />
        <text
          x="20"
          y="26"
          textAnchor="middle"
          fill="#F5F5F0"
          fontSize="20"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          JC
        </text>
      </svg>
    </div>
  );
}
