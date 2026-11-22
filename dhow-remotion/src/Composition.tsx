import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/* ===================================================================
   KONSTANTA, PALET, HELPER
   Semua gerakan dihitung dari frame (tanpa CSS animation / Math.random),
   jadi hasil render selalu deterministik.
   =================================================================== */
const W = 1920;
const H = 1080;
const HORIZON = 575;
const FOCUS_X = 1300; // titik tujuan push-in kamera (antara kapal & pulau)
const FOCUS_Y = 620;
const TAU = Math.PI * 2;

const C = {
  night0: "#050E22",
  night1: "#0A1A38",
  cream: "#F3E6C8",
  creamDeep: "#E3D0A3",
  gold: "#C9A24B",
  goldSoft: "#D8B866",
  terracotta: "#B5573A",
  terracottaDark: "#8A3C27",
  terracottaDeep: "#5E2819",
  leafDark: "#1F4B3C",
  leafMid: "#2E6A4C",
  leafLight: "#3F8460",
  mound: "#13342C",
  trunk: "#0E2521",
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// pseudo-random deterministik (aman untuk render paralel)
const rand = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
const f1 = (n: number): string => n.toFixed(1);

/* ===================================================================
   LANGIT: bintang, bulan, awan, burung
   =================================================================== */
const STARS = Array.from({ length: 95 }, (_, i) => ({
  x: rand(i * 3.1 + 1) * W,
  y: rand(i * 5.7 + 2) * (HORIZON - 110) + 20,
  r: 0.9 + rand(i * 7.3 + 3) * 1.7,
  p: rand(i * 11.9 + 4) * TAU,
  s: 0.03 + rand(i * 13.3 + 5) * 0.05,
}));

const Stars: React.FC<{ frame: number }> = ({ frame }) => (
  <g fill={C.cream}>
    {STARS.map((s, i) => {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * s.s + s.p));
      if (s.r > 2.35) {
        const k = s.r * 2.8;
        const d =
          `M ${f1(s.x - k)} ${f1(s.y)} Q ${f1(s.x)} ${f1(s.y)} ${f1(s.x)} ${f1(s.y - k)} ` +
          `Q ${f1(s.x)} ${f1(s.y)} ${f1(s.x + k)} ${f1(s.y)} ` +
          `Q ${f1(s.x)} ${f1(s.y)} ${f1(s.x)} ${f1(s.y + k)} ` +
          `Q ${f1(s.x)} ${f1(s.y)} ${f1(s.x - k)} ${f1(s.y)} Z`;
        return <path key={i} d={d} opacity={tw} />;
      }
      return <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={tw} />;
    })}
  </g>
);

const Moon: React.FC<{ frame: number }> = ({ frame }) => {
  const pulse = 1 + 0.035 * Math.sin(frame * 0.045);
  return (
    <g transform="translate(1400 250)">
      <circle r={260 * pulse} fill="url(#moonGlow)" />
      <circle r={142} fill="none" stroke={C.gold} strokeWidth={2} opacity={0.22} />
      <circle r={116} fill="none" stroke={C.gold} strokeWidth={2.5} opacity={0.38} />
      <circle r={88} fill={C.cream} />
      <circle cx={-26} cy={-18} r={17} fill={C.creamDeep} opacity={0.6} />
      <circle cx={24} cy={22} r={12} fill={C.creamDeep} opacity={0.55} />
      <circle cx={30} cy={-34} r={7} fill={C.creamDeep} opacity={0.5} />
    </g>
  );
};

const CLOUDS = [
  { x: 240, y: 160, s: 1.25, v: 0.2 },
  { x: 880, y: 335, s: 0.95, v: 0.14 },
  { x: 1580, y: 130, s: 0.85, v: 0.17 },
  { x: 560, y: 455, s: 0.7, v: 0.1 },
];

const Clouds: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    {CLOUDS.map((c, i) => (
      <g key={i} transform={`translate(${f1(c.x + frame * c.v)} ${c.y}) scale(${c.s})`}>
        <path
          d="M -120 0 Q -120 -18 -96 -18 Q -86 -44 -52 -40 Q -30 -62 4 -46 Q 36 -58 56 -34 Q 90 -40 100 -14 Q 124 -12 124 0 Z"
          fill="#1B3A6A"
          opacity={0.62}
        />
        <path
          d="M -90 12 L 70 12"
          stroke={C.cream}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.12}
        />
      </g>
    ))}
  </g>
);

const BIRDS = [
  { x: 1040, y: 300, v: 0.34, size: 1.0, ph: 0 },
  { x: 1110, y: 330, v: 0.32, size: 0.8, ph: 1.3 },
  { x: 985, y: 345, v: 0.3, size: 0.7, ph: 2.2 },
];

const Birds: React.FC<{ frame: number }> = ({ frame }) => (
  <g fill="none" stroke={C.goldSoft} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
    {BIRDS.map((b, i) => {
      const flap = Math.sin(frame * 0.22 + b.ph);
      const x = b.x + frame * b.v;
      const y = b.y + Math.sin(frame * 0.03 + b.ph) * 10 - frame * 0.05;
      const w = 16 * b.size;
      const up = 10 * flap * b.size;
      const d =
        `M ${f1(x - w)} ${f1(y - up * 0.2)} ` +
        `Q ${f1(x - w * 0.5)} ${f1(y - 8 * b.size - up)} ${f1(x)} ${f1(y)} ` +
        `Q ${f1(x + w * 0.5)} ${f1(y - 8 * b.size - up)} ${f1(x + w)} ${f1(y - up * 0.2)}`;
      return <path key={i} d={d} strokeWidth={3.2 * b.size} />;
    })}
  </g>
);

/* ===================================================================
   PULAU MISTERIUS: bukit, pohon palem / bulat / cemara bergoyang
   =================================================================== */
const MOUND =
  "M -205 8 C -180 -8 -150 -22 -120 -34 C -90 -50 -60 -62 -20 -66 C 20 -70 60 -66 95 -56 C 125 -46 150 -28 175 -16 C 195 -8 210 0 218 8 Z";

type TreeKind = "palm" | "round" | "cypress";
type TreeSpec = {
  kind: TreeKind;
  x: number;
  y: number;
  h: number;
  lean: number;
  phase: number;
  tone: number;
  delay: number;
};

const TREES: TreeSpec[] = [
  { kind: "cypress", x: -150, y: -15, h: 62, lean: 0, phase: 0.3, tone: 0, delay: 0 },
  { kind: "round", x: -118, y: -28, h: 44, lean: -4, phase: 1.1, tone: 1, delay: 3 },
  { kind: "palm", x: -78, y: -47, h: 104, lean: -10, phase: 2.0, tone: 0, delay: 6 },
  { kind: "round", x: -36, y: -57, h: 50, lean: 3, phase: 0.7, tone: 2, delay: 9 },
  { kind: "palm", x: 10, y: -61, h: 128, lean: 6, phase: 3.2, tone: 1, delay: 12 },
  { kind: "cypress", x: 46, y: -59, h: 72, lean: 0, phase: 4.0, tone: 2, delay: 15 },
  { kind: "palm", x: 88, y: -52, h: 98, lean: 12, phase: 5.1, tone: 0, delay: 18 },
  { kind: "round", x: 128, y: -35, h: 42, lean: 2, phase: 2.6, tone: 1, delay: 21 },
  { kind: "palm", x: 160, y: -18, h: 76, lean: 14, phase: 0.9, tone: 2, delay: 24 },
];

const TONES = [
  { a: C.leafDark, b: C.leafMid },
  { a: C.leafMid, b: C.leafLight },
  { a: C.leafLight, b: C.leafMid },
];

const FRONDS = [
  { e: 84, l: 0.55 },
  { e: 58, l: 0.85 },
  { e: 28, l: 1.0 },
  { e: 0, l: 0.95 },
  { e: -28, l: 0.8 },
];

const leafPath = (L: number): string =>
  `M 0 0 C ${f1(L * 0.25)} ${f1(-L * 0.3)} ${f1(L * 0.7)} ${f1(-L * 0.24)} ${f1(L)} ${f1(L * 0.32)} ` +
  `C ${f1(L * 0.72)} ${f1(L * 0.04)} ${f1(L * 0.32)} ${f1(-L * 0.02)} 0 0 Z`;

const Palm: React.FC<{ spec: TreeSpec; frame: number }> = ({ spec, frame }) => {
  const { h, lean, phase, tone } = spec;
  const cx = lean;
  const cy = -h;
  const crownRot = 2.5 * Math.sin(frame * 0.045 + phase - 0.9);
  const L = h * 0.52;
  const colors = TONES[tone];
  return (
    <g>
      <path
        d={`M 0 0 Q ${f1(lean * 0.2 - 6)} ${f1(-h * 0.55)} ${f1(cx)} ${f1(cy)}`}
        stroke={C.trunk}
        strokeWidth={Math.max(4, h * 0.06)}
        strokeLinecap="round"
        fill="none"
      />
      <g transform={`translate(${f1(cx)} ${f1(cy)}) rotate(${crownRot.toFixed(2)})`}>
        {[1, -1].map((side) =>
          FRONDS.map((fr, i) => {
            const flutter = Math.sin(frame * 0.1 + phase + i * 0.8 + (side > 0 ? 0 : 1.7)) * 3.5;
            return (
              <path
                key={`${side}-${i}`}
                d={leafPath(L * fr.l)}
                fill={i % 2 === 0 ? colors.a : colors.b}
                transform={`scale(${side} 1) rotate(${(-(fr.e + flutter)).toFixed(2)})`}
              />
            );
          })
        )}
        <circle cx={-3} cy={4} r={3.2} fill={C.terracotta} />
        <circle cx={3.5} cy={5} r={3.2} fill={C.terracottaDark} />
      </g>
    </g>
  );
};

const RoundTree: React.FC<{ spec: TreeSpec; frame: number }> = ({ spec, frame }) => {
  const { h, phase, tone } = spec;
  const breathe = 1 + 0.025 * Math.sin(frame * 0.07 + phase);
  const colors = TONES[tone];
  return (
    <g>
      <rect x={-2.5} y={-h * 0.5} width={5} height={h * 0.5} rx={2} fill={C.trunk} />
      <g transform={`translate(0 ${f1(-h * 0.62)}) scale(${breathe.toFixed(3)}) translate(0 ${f1(h * 0.62)})`}>
        <circle cx={0} cy={-h * 0.66} r={h * 0.34} fill={colors.a} />
        <circle cx={-h * 0.22} cy={-h * 0.5} r={h * 0.24} fill={colors.a} />
        <circle cx={h * 0.24} cy={-h * 0.52} r={h * 0.26} fill={colors.b} />
        <circle cx={-h * 0.1} cy={-h * 0.78} r={h * 0.13} fill={C.leafLight} opacity={0.45} />
      </g>
    </g>
  );
};

const Cypress: React.FC<{ spec: TreeSpec }> = ({ spec }) => {
  const { h, tone } = spec;
  const color = TONES[tone].a;
  const body =
    `M 0 0 C ${f1(h * 0.22)} ${f1(-h * 0.2)} ${f1(h * 0.2)} ${f1(-h * 0.7)} 0 ${f1(-h)} ` +
    `C ${f1(-h * 0.2)} ${f1(-h * 0.7)} ${f1(-h * 0.22)} ${f1(-h * 0.2)} 0 0 Z`;
  const shade = `M 0 0 C ${f1(h * 0.22)} ${f1(-h * 0.2)} ${f1(h * 0.2)} ${f1(-h * 0.7)} 0 ${f1(-h)} Z`;
  return (
    <g>
      <path d={body} fill={color} />
      <path d={shade} fill={C.night0} opacity={0.22} />
    </g>
  );
};

const Island: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const gust = 1 + 0.3 * Math.sin(frame * 0.013);
  const flicker = 0.78 + 0.22 * Math.sin(frame * 0.21) * Math.sin(frame * 0.07 + 1);
  return (
    <g transform={`translate(1370 ${HORIZON + 3}) scale(1.25)`}>
      {/* pohon (digambar sebelum bukit agar pangkalnya tersembunyi) */}
      {TREES.map((t, i) => {
        const grow = Math.max(
          0.001,
          spring({
            frame: frame - t.delay,
            fps,
            config: { damping: 16, stiffness: 100, mass: 0.9 },
          })
        );
        const swayAmp = t.kind === "palm" ? 2.4 : t.kind === "round" ? 1.5 : 1.0;
        const sway = swayAmp * gust * Math.sin(frame * 0.04 + t.phase);
        return (
          <g
            key={i}
            transform={`translate(${t.x} ${t.y}) rotate(${sway.toFixed(2)}) scale(${grow.toFixed(3)})`}
          >
            {t.kind === "palm" && <Palm spec={t} frame={frame} />}
            {t.kind === "round" && <RoundTree spec={t} frame={frame} />}
            {t.kind === "cypress" && <Cypress spec={t} />}
          </g>
        );
      })}

      {/* bukit */}
      <path d={MOUND} fill={C.mound} />
      <path
        d="M -150 -22 C -120 -36 -90 -52 -60 -60"
        stroke={C.leafLight}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.22}
      />
      {/* tebing terakota */}
      <path d="M -205 8 L -172 -8 L -142 -2 L -120 8 Z" fill={C.terracottaDark} />
      <path d="M 150 8 L 170 -14 L 195 -4 L 218 8 Z" fill={C.terracotta} />
      {/* reruntuhan lengkung dengan cahaya emas */}
      <circle cx={-6} cy={-44} r={34} fill="url(#lanternGlow)" opacity={flicker} />
      <path d="M -15 -26 L -15 -44 A 9 9 0 0 1 3 -44 L 3 -26 Z" fill={C.terracottaDeep} />
      <path d="M -11 -26 L -11 -43 A 5 5 0 0 1 -1 -43 L -1 -26 Z" fill={C.goldSoft} opacity={0.55 + 0.45 * flicker} />
      {/* pantai */}
      <path d="M -210 8 Q 6 -14 222 8 L 222 16 L -210 16 Z" fill={C.creamDeep} opacity={0.92} />

      {/* kabut tipis */}
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          cx={-60 + i * 90 + 34 * Math.sin(frame * 0.012 + i * 2)}
          cy={-8 - i * 5}
          rx={150 - i * 18}
          ry={20 + i * 3}
          fill="url(#mistGrad)"
          opacity={0.7 - i * 0.15}
        />
      ))}
    </g>
  );
};

/* Bayangan pulau di air */
const IslandReflection: React.FC<{ frame: number }> = ({ frame }) => {
  const flicker = 0.3 + 0.2 * Math.sin(frame * 0.21);
  return (
    <g>
      <g
        transform={`translate(1370 ${HORIZON + 4}) scale(${(1.25 + 0.012 * Math.sin(frame * 0.05)).toFixed(3)} -1.25)`}
        opacity={0.3}
      >
        <path d={MOUND} fill={C.mound} />
      </g>
      <rect x={1362} y={HORIZON + 36} width={5} height={34} rx={2.5} fill={C.goldSoft} opacity={flicker} />
    </g>
  );
};

/* ===================================================================
   LAUT: lapisan ombak, riak, pantulan bulan
   =================================================================== */
type WaveSpec = {
  base: number;
  amp: number;
  len: number;
  speed: number;
  phase: number;
  fill: string;
  line: string;
  lineOpacity: number;
};

const WAVES: WaveSpec[] = [
  { base: 575, amp: 3, len: 300, speed: 0.03, phase: 0.0, fill: "#17396A", line: C.cream, lineOpacity: 0.16 },
  { base: 614, amp: 5, len: 380, speed: 0.036, phase: 1.3, fill: "#122F5A", line: C.cream, lineOpacity: 0.16 },
  { base: 662, amp: 8, len: 470, speed: 0.042, phase: 2.1, fill: "#0F2650", line: C.cream, lineOpacity: 0.15 },
  { base: 714, amp: 11, len: 560, speed: 0.048, phase: 0.7, fill: "#0B1D40", line: C.goldSoft, lineOpacity: 0.16 },
  { base: 806, amp: 15, len: 680, speed: 0.054, phase: 3.4, fill: "#08162F", line: C.goldSoft, lineOpacity: 0.13 },
  { base: 925, amp: 20, len: 820, speed: 0.06, phase: 4.6, fill: "#050E22", line: C.goldSoft, lineOpacity: 0.1 },
];

const waveY = (w: WaveSpec, x: number, frame: number): number =>
  w.base +
  w.amp * Math.sin((x / w.len) * TAU + frame * w.speed + w.phase) +
  w.amp * 0.35 * Math.sin((x / (w.len * 0.46)) * TAU - frame * w.speed * 1.4 + w.phase * 2);

const WaveLayer: React.FC<{ frame: number; spec: WaveSpec }> = ({ frame, spec }) => {
  let top = "";
  for (let x = -64; x <= W + 64; x += 16) {
    top += `${top === "" ? "M" : "L"}${f1(x)} ${waveY(spec, x, frame).toFixed(2)} `;
  }
  return (
    <g>
      <path d={`${top}L${W + 64} ${H + 64} L-64 ${H + 64} Z`} fill={spec.fill} />
      <path
        d={top}
        fill="none"
        stroke={spec.line}
        strokeWidth={2}
        opacity={spec.lineOpacity}
        strokeLinejoin="round"
      />
    </g>
  );
};

/* riak: lengkung kecil yang mekar lalu memudar, posisi baru di setiap siklus */
const Ripples: React.FC<{ frame: number; zone: "far" | "near" }> = ({ frame, zone }) => {
  const count = zone === "far" ? 16 : 22;
  const yMin = zone === "far" ? 590 : 730;
  const yMax = zone === "far" ? 700 : 1050;
  return (
    <g fill="none" stroke={C.cream} strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: count }, (_, i) => {
        const id = i + (zone === "far" ? 0 : 100);
        const period = 100 + rand(id * 1.7) * 80;
        const life = frame / period + rand(id * 2.2);
        const cycle = Math.floor(life);
        const ph = life - cycle;
        const seed = id * 31 + cycle * 7.7;
        const x = rand(seed) * (W + 120) - 60;
        const y = yMin + rand(seed + 1) * (yMax - yMin);
        const depth = (y - HORIZON) / (H - HORIZON);
        const w = (30 + 110 * depth) * (0.4 + 0.6 * ph);
        const hh = 3 + 7 * depth;
        const op = Math.sin(Math.PI * ph) * (0.18 + 0.3 * depth);
        const d = `M ${f1(x - w / 2)} ${f1(y)} q ${f1(w / 4)} ${f1(-hh)} ${f1(w / 2)} 0 t ${f1(w / 2)} 0`;
        return <path key={id} d={d} strokeWidth={2 + 3 * depth} opacity={op} />;
      })}
    </g>
  );
};

const MoonReflection: React.FC<{ frame: number }> = ({ frame }) => (
  <g fill={C.creamDeep}>
    {Array.from({ length: 14 }, (_, i) => {
      const y = 592 + i * 34 + i * i * 0.8;
      const w = 42 + i * 9;
      const th = 5 + i * 0.7;
      const x = 1400 + Math.sin(frame * 0.08 + i * 0.9) * (6 + i * 1.2);
      const op = Math.max(0.1, 0.55 - i * 0.032);
      return <rect key={i} x={x - w / 2} y={y} width={w} height={th} rx={th / 2} opacity={op} />;
    })}
  </g>
);

/* ===================================================================
   KAPAL DHOW (koordinat lokal: lunas di y≈0, haluan ke kanan)
   =================================================================== */
const HULL =
  "M -215 -70 C -205 -25 -175 25 -110 32 L 130 32 C 190 26 235 -15 262 -62 C 235 -45 190 -30 120 -26 C 20 -20 -100 -20 -170 -34 C -190 -40 -205 -55 -215 -70 Z";
const SHEER =
  "M 262 -62 C 235 -45 190 -30 120 -26 C 20 -20 -100 -20 -170 -34 C -190 -40 -205 -55 -215 -70";

const JARS = [
  { x: 40, k: 0 },
  { x: 72, k: 1 },
  { x: 104, k: 0 },
];

const Dhow: React.FC<{ frame: number; x: number; y: number; tilt: number }> = ({
  frame,
  x,
  y,
  tilt,
}) => {
  const sag = 12 + 5 * Math.sin(frame * 0.06);
  const leech = 4 * Math.sin(frame * 0.06 + 0.5);
  const sailPath =
    `M 165 -58 L -140 -325 Q ${f1(-168 + leech)} -215 -172 -108 ` +
    `Q -3 ${f1(-83 + 2 * sag)} 165 -58 Z`;

  // bendera kecil di puncak, berkibar searah haluan
  const N = 8;
  const FLAG_LEN = 58;
  let flagTop = "";
  let flagBottom = "";
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const cy = -342 + Math.sin(frame * 0.32 - u * 5) * 7 * u;
    const half = (16 * (1 - u * 0.92)) / 2;
    const px = -140 + u * FLAG_LEN;
    flagTop += `${k === 0 ? "M" : "L"}${f1(px)} ${f1(cy - half)} `;
    flagBottom = `L${f1(px)} ${f1(cy + half)} ` + flagBottom;
  }
  const flagPath = `${flagTop}${flagBottom}Z`;

  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${tilt.toFixed(2)} 0 30)`}>
      <defs>
        <clipPath id="hullClip">
          <path d={HULL} />
        </clipPath>
        <clipPath id="sailClip">
          <path d={sailPath} />
        </clipPath>
      </defs>

      {/* layar lateen */}
      <path d={sailPath} fill={C.cream} />
      <g clipPath="url(#sailClip)">
        <path d="M -140 -325 L -172 -108 L 0 -80 Q -90 -190 -140 -325 Z" fill={C.creamDeep} opacity={0.75} />
        <path
          d={`M -230 -132 Q 0 ${f1(-132 + sag * 1.2)} 230 -132`}
          stroke={C.terracotta}
          strokeWidth={14}
          fill="none"
        />
        <path
          d={`M -230 -150 Q 0 ${f1(-150 + sag * 1.1)} 230 -150`}
          stroke={C.gold}
          strokeWidth={4}
          fill="none"
        />
        <path
          d={`M -230 -262 Q 0 ${f1(-262 + sag * 0.6)} 230 -262`}
          stroke={C.terracotta}
          strokeWidth={10}
          fill="none"
        />
        <path
          d={`M -230 -277 Q 0 ${f1(-277 + sag * 0.5)} 230 -277`}
          stroke={C.gold}
          strokeWidth={3}
          fill="none"
        />
      </g>
      {/* motif bintang bersudut delapan */}
      <g
        transform="translate(-75 -195)"
        fill="none"
        stroke={C.terracotta}
        strokeWidth={4}
        strokeLinejoin="round"
      >
        <rect x={-18} y={-18} width={36} height={36} />
        <rect x={-18} y={-18} width={36} height={36} transform="rotate(45)" />
        <circle r={5} fill={C.gold} stroke="none" />
      </g>

      {/* tali stay */}
      <g stroke={C.cream} strokeWidth={2} opacity={0.4} fill="none">
        <path d="M -10 -218 L 262 -62" />
        <path d="M -140 -325 L -215 -72" />
      </g>

      {/* tiang & yard */}
      <path d="M -10 -24 L -10 -218" stroke={C.terracottaDeep} strokeWidth={7} strokeLinecap="round" />
      <path d="M 170 -56 L -146 -332" stroke={C.terracottaDeep} strokeWidth={8} strokeLinecap="round" />
      <circle cx={170} cy={-56} r={5} fill={C.gold} />
      <circle cx={-146} cy={-332} r={5} fill={C.gold} />
      <circle cx={-10} cy={-211} r={6} fill={C.gold} />
      <path d="M -140 -325 L -140 -350" stroke={C.terracottaDeep} strokeWidth={3} strokeLinecap="round" />
      <path d={flagPath} fill={C.terracotta} />

      {/* kabin buritan */}
      <path d="M -192 -30 L -192 -80 Q -148 -94 -102 -80 L -102 -26 Z" fill={C.terracottaDark} />
      <path
        d="M -196 -80 Q -148 -97 -98 -80"
        stroke={C.gold}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      {[-172, -148, -124].map((wx, i) => (
        <path
          key={wx}
          d={`M ${wx - 7} -44 v -14 a 7 7 0 0 1 14 0 v 14 z`}
          fill={C.goldSoft}
          opacity={0.8 + 0.2 * Math.sin(frame * 0.15 + i)}
        />
      ))}

      {/* juru mudi */}
      <path d="M -99 -24 Q -98 -50 -90 -52 Q -82 -50 -81 -24 Z" fill={C.cream} />
      <circle cx={-90} cy={-58} r={6} fill={C.terracottaDark} />
      <ellipse cx={-90} cy={-62} rx={7.5} ry={4} fill={C.cream} />

      {/* guci muatan */}
      {JARS.map((j) => {
        const top = j.k === 1 ? -54 : -46;
        return (
          <g key={j.x}>
            <path
              d={`M ${j.x - 8} -22 Q ${j.x - 14} ${top + 12} ${j.x - 5} ${top + 4} L ${j.x - 4} ${top - 4} L ${j.x + 4} ${top - 4} L ${j.x + 5} ${top + 4} Q ${j.x + 14} ${top + 12} ${j.x + 8} -22 Z`}
              fill={C.terracotta}
            />
            <rect x={j.x - 5} y={top - 7} width={10} height={4} rx={1.5} fill={C.gold} />
          </g>
        );
      })}

      {/* lambung */}
      <path d={HULL} fill={C.terracotta} />
      <g clipPath="url(#hullClip)">
        <path d="M -215 8 C -100 14 100 14 260 -10 L 260 60 L -215 60 Z" fill={C.terracottaDark} />
        <path d="M -215 -36 C -120 -6 110 -4 252 -44" stroke={C.gold} strokeWidth={7} fill="none" />
        <path d="M -190 -4 C -100 8 100 8 225 -22" stroke={C.cream} strokeWidth={2} opacity={0.4} fill="none" />
      </g>
      <path d={SHEER} stroke={C.terracottaDeep} strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx={262} cy={-62} r={6} fill={C.gold} />
      <circle cx={-215} cy={-70} r={6} fill={C.gold} />
    </g>
  );
};

/* buih di haluan & jejak ombak di belakang buritan (digambar di atas air) */
const Wake: React.FC<{ frame: number; x: number; y: number }> = ({ frame, x, y }) => (
  <g fill="none" stroke={C.cream} strokeLinecap="round" strokeLinejoin="round">
    {Array.from({ length: 7 }, (_, i) => {
      const wx = x - (215 + i * 62);
      const wy = y + 27 + i * 1.6 + Math.sin(frame * 0.07 + i * 1.3) * 1.5;
      const len = 46 + i * 16;
      const op = 0.62 * (1 - i / 7.5);
      const d = `M ${f1(wx - len / 2)} ${f1(wy)} q ${f1(len / 4)} -5 ${f1(len / 2)} 0 t ${f1(len / 2)} 0`;
      return <path key={i} d={d} strokeWidth={3.2 - i * 0.28} opacity={op} />;
    })}
    {Array.from({ length: 5 }, (_, i) => {
      const wx = x - (260 + i * 70);
      const wy = y + 38 + i * 2 + Math.sin(frame * 0.06 + i * 2.1) * 1.5;
      const len = 36 + i * 14;
      const d = `M ${f1(wx - len / 2)} ${f1(wy)} q ${f1(len / 4)} -4 ${f1(len / 2)} 0 t ${f1(len / 2)} 0`;
      return <path key={`b${i}`} d={d} strokeWidth={2.4} opacity={0.4 * (1 - i / 5.5)} />;
    })}
    <g opacity={0.55 + 0.25 * Math.sin(frame * 0.12)} strokeWidth={3}>
      <path d={`M ${f1(x + 222)} ${f1(y + 28)} q 16 -12 36 -4`} />
      <path d={`M ${f1(x + 232)} ${f1(y + 35)} q 14 -8 30 -2`} />
    </g>
  </g>
);

/* ===================================================================
   KOMPOSISI UTAMA
   =================================================================== */
export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const last = durationInFrames - 1;

  // kamera: push-in pelan menuju titik antara kapal dan pulau
  const zoom = interpolate(frame, [0, last], [1, 1.22], {
    ...clamp,
    easing: Easing.inOut(Easing.sin),
  });

  // kapal meluncur ke kanan, menyembul dari air dengan spring tanpa pantulan
  const shipX = interpolate(frame, [0, last], [430, 905], {
    ...clamp,
    easing: Easing.inOut(Easing.sin),
  });
  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 70 });
  const shipY =
    684 + (1 - rise) * 46 + 5 * Math.sin(frame * 0.075) + 2 * Math.sin(frame * 0.13 + 1);
  const tilt = 2 * Math.sin(frame * 0.075 + 0.9) + 0.8 * Math.sin(frame * 0.13);

  // fade masuk & keluar
  const fade =
    interpolate(frame, [0, 24], [1, 0], clamp) + interpolate(frame, [270, last], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: C.night0 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id="skyGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={HORIZON}>
            <stop offset="0" stopColor="#040B1D" />
            <stop offset="0.5" stopColor="#0A1A3A" />
            <stop offset="1" stopColor="#1D416F" />
          </linearGradient>
          <linearGradient id="horizonGlow" gradientUnits="userSpaceOnUse" x1="0" y1={HORIZON - 140} x2="0" y2={HORIZON + 10}>
            <stop offset="0" stopColor={C.gold} stopOpacity="0" />
            <stop offset="1" stopColor={C.gold} stopOpacity="0.2" />
          </linearGradient>
          <radialGradient id="moonGlow">
            <stop offset="0" stopColor={C.cream} stopOpacity="0.3" />
            <stop offset="0.4" stopColor={C.gold} stopOpacity="0.12" />
            <stop offset="1" stopColor={C.gold} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mistGrad">
            <stop offset="0" stopColor={C.cream} stopOpacity="0.22" />
            <stop offset="1" stopColor={C.cream} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lanternGlow">
            <stop offset="0" stopColor={C.goldSoft} stopOpacity="0.85" />
            <stop offset="1" stopColor={C.goldSoft} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <stop offset="0.55" stopColor={C.night0} stopOpacity="0" />
            <stop offset="1" stopColor={C.night0} stopOpacity="0.62" />
          </radialGradient>
          <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id="fibers" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.6" numOctaves="3" seed="4" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* ---------- dunia (dengan kamera push-in) ---------- */}
        <g
          transform={`translate(${FOCUS_X} ${FOCUS_Y}) scale(${zoom.toFixed(4)}) translate(${-FOCUS_X} ${-FOCUS_Y})`}
        >
          {/* langit */}
          <rect x={-700} y={-500} width={W + 1400} height={HORIZON + 510} fill="url(#skyGrad)" />
          <rect x={-700} y={HORIZON - 140} width={W + 1400} height={150} fill="url(#horizonGlow)" />
          <Stars frame={frame} />
          <Moon frame={frame} />
          <Clouds frame={frame} />
          <Birds frame={frame} />

          {/* pulau (di belakang garis air) */}
          <Island frame={frame} fps={fps} />

          {/* laut belakang */}
          <WaveLayer frame={frame} spec={WAVES[0]} />
          <WaveLayer frame={frame} spec={WAVES[1]} />
          <WaveLayer frame={frame} spec={WAVES[2]} />
          <IslandReflection frame={frame} />
          <Ripples frame={frame} zone="far" />

          {/* kapal duduk di antara ombak 2 dan 3 */}
          <Dhow frame={frame} x={shipX} y={shipY} tilt={tilt} />
          <WaveLayer frame={frame} spec={WAVES[3]} />
          <Wake frame={frame} x={shipX} y={shipY} />

          {/* laut depan */}
          <WaveLayer frame={frame} spec={WAVES[4]} />
          <WaveLayer frame={frame} spec={WAVES[5]} />
          <MoonReflection frame={frame} />
          <Ripples frame={frame} zone="near" />
        </g>

        {/* ---------- lapisan layar (tidak ikut kamera) ---------- */}
        <rect width={W} height={H} filter="url(#grain)" opacity={0.2} style={{ mixBlendMode: "overlay" }} />
        <rect width={W} height={H} filter="url(#fibers)" opacity={0.1} style={{ mixBlendMode: "soft-light" }} />
        <rect width={W} height={H} fill="url(#vignette)" />
        <rect width={W} height={H} fill={C.night0} opacity={fade} />
      </svg>
    </AbsoluteFill>
  );
};
