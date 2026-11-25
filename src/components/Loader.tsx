/**
 * Loading state: a thin ring with an arc that continuously draws, extends and
 * retracts while rotating. Pure SVG + CSS. Fades in after a short delay so
 * fast loads never flash it.
 */
export default function Loader() {
  return (
    <div className="loader" role="status" aria-label="Loading">
      <svg className="loader-svg" viewBox="0 0 50 50" width="44" height="44" aria-hidden>
        {/* Backing disc so the background lines don't run through the ring */}
        <circle cx="25" cy="25" r="25" fill="var(--bg)" />
        <circle className="loader-track" cx="25" cy="25" r="20" />
        <circle className="loader-arc" cx="25" cy="25" r="20" />
      </svg>
    </div>
  );
}
