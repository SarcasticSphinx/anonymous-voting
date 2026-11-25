// Decorative background: thin SVG lines that draw in once, with a few faint
// highlights travelling along them. Pure SVG + CSS, no JavaScript.
const WAVES = [
  { y: 110, a: 70 },
  { y: 170, a: -60 },
  { y: 230, a: 90 },
  { y: 290, a: -80 },
  { y: 350, a: 60 },
  { y: 410, a: -50 },
  { y: 470, a: 75 },
];

const wave = (y: number, a: number) =>
  `M -60 ${y} C 380 ${y - a * 2}, 1060 ${y + a * 2}, 1500 ${y}`;

export default function Lines() {
  return (
    <svg className="lines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g className="grid">
        {[240, 480, 720, 960, 1200].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="900" />
        ))}
      </g>
      {WAVES.map((w, i) => (
        <path
          key={i}
          className="wave"
          pathLength={1}
          d={wave(w.y, w.a)}
          style={{ "--d": i } as React.CSSProperties}
        />
      ))}
      {[1, 3, 5].map((i, k) => (
        <path
          key={`r${i}`}
          className="runner"
          pathLength={1}
          d={wave(WAVES[i].y, WAVES[i].a)}
          style={{ "--d": k, "--t": `${12 + k * 3}s` } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}
