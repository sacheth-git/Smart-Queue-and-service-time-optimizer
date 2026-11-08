const HEARTBEAT =
  "M0 45 H110 L124 45 L132 34 L140 45 L150 45 L158 56 L170 6 L184 82 L194 45 L210 45 L224 30 L240 45 " +
  "H330 L344 45 L352 34 L360 45 L370 45 L378 56 L390 6 L404 82 L414 45 L430 45 L444 30 L460 45 H560";

/** Decorative heartbeat line for the home page hero. It shows no data. */
export function PulseLine() {
  return (
    <div
      aria-hidden="true"
      className="relative mt-6 h-24 max-w-[34em] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-white to-mint shadow-sm"
    >
      <svg viewBox="0 0 560 90" preserveAspectRatio="none" className="absolute inset-x-0 top-1.5 h-[calc(100%-12px)] w-full">
        <defs>
          <linearGradient id="pq-pulse-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.12" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.88" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="pq-pulse-edges">
            <rect width="560" height="90" fill="url(#pq-pulse-fade)" />
          </mask>
          <filter id="pq-pulse-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g mask="url(#pq-pulse-edges)" fill="none" strokeLinejoin="round">
          <path d="M0 45 H560" className="stroke-line" strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
          <path d={HEARTBEAT} stroke="rgb(21 158 154 / 0.22)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <path d={HEARTBEAT} className="pq-pulse-trace stroke-brand" strokeWidth={3} strokeLinecap="round" filter="url(#pq-pulse-glow)" />
        </g>
      </svg>
    </div>
  );
}
