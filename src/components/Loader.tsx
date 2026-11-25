/**
 * Loading state: a line-drawn ballot box with a slip dropping into the slot.
 * Pure SVG + CSS. It fades in after a short delay so fast loads never flash it.
 */
export default function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden>
        {/* The slip: drawn first so the box body covers it as it drops in */}
        <g className="loader-slip">
          <rect x="22" y="4" width="20" height="24" rx="2.5" />
          <path className="loader-tick" d="M27 16.5l3.6 3.6L37 13.5" pathLength={1} />
        </g>
        {/* Box body, filled with the page colour so it hides the slip */}
        <rect className="loader-box" x="8" y="30" width="48" height="28" rx="5" />
        {/* Slot */}
        <path className="loader-slot" d="M18 30h28" />
        {/* Tally marks on the box front */}
        <path className="loader-tally" d="M22 41v8M27 41v8M32 41v8M37 41v8M19 48l22-6" pathLength={1} />
      </svg>
      <span className="loader-label">{label}</span>
    </div>
  );
}
