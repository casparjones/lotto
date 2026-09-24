// Deterministische Mathematik für die Physik.
// Math.sin/cos dürfen je nach Browser im letzten Bit abweichen; das würde die Ziehung zwischen
// Chrome, Firefox und Safari verändern. Deshalb eigene Reihen, die nur + − × ÷ und Math.round nutzen.

export const PI = 3.141592653589793;
const HALB_PI_A = 1.5707963267948966;
const HALB_PI_B = 6.123233995736766e-17;
export const GRAD = PI / 180;

const s3 = -1 / 6, s5 = 1 / 120, s7 = -1 / 5040, s9 = 1 / 362880, s11 = -1 / 39916800, s13 = 1 / 6227020800;
const c2 = -1 / 2, c4 = 1 / 24, c6 = -1 / 720, c8 = 1 / 40320, c10 = -1 / 3628800, c12 = 1 / 479001600;

/** Liefert [sin x, cos x] deterministisch (Fehler < 1e-15 für |x| < 1e6). */
export function sinCos(x, out = [0, 0]) {
  const k = Math.round(x / HALB_PI_A);
  const r = x - k * HALB_PI_A - k * HALB_PI_B;
  const r2 = r * r;
  const s = r * (1 + r2 * (s3 + r2 * (s5 + r2 * (s7 + r2 * (s9 + r2 * (s11 + r2 * s13))))));
  const c = 1 + r2 * (c2 + r2 * (c4 + r2 * (c6 + r2 * (c8 + r2 * (c10 + r2 * c12)))));
  const q = ((k % 4) + 4) % 4;
  if (q === 0) { out[0] = s; out[1] = c; }
  else if (q === 1) { out[0] = c; out[1] = -s; }
  else if (q === 2) { out[0] = -s; out[1] = -c; }
  else { out[0] = -c; out[1] = s; }
  return out;
}

/** Arcustangens deterministisch (für Geometrie-Aufbau). */
export function atan2(y, x) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y);
  const inv = ay > ax;
  let t = inv ? ax / ay : ay / ax; // 0..1
  // Reduktion: atan(t) = 2·atan(t / (1 + sqrt(1 + t²)))
  const t1 = t / (1 + Math.sqrt(1 + t * t));
  const t2 = t1 / (1 + Math.sqrt(1 + t1 * t1));
  const z = t2 * t2;
  let a = t2 * (1 + z * (-1 / 3 + z * (1 / 5 + z * (-1 / 7 + z * (1 / 9 + z * (-1 / 11 + z * (1 / 13)))))));
  a *= 4;
  if (inv) a = PI / 2 - a;
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

export function normiere(v) {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
export function kreuz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function punkt(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function plus(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function minus(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function mal(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
export function laenge(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

/** Seed-Text → 128-Bit-Zustand (cyrb128). */
function hash(text) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** Zufallsgenerator sfc32 – wird nur beim Aufbau der Anfangsstörungen benutzt. */
export function zufall(seedText) {
  let [a, b, c, d] = hash(String(seedText));
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return {
    zahl: next,
    bereich: (min, max) => min + (max - min) * next(),
  };
}

export const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);
export const glatt = (t) => {
  const x = klemme(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const easeInOut = (t) => {
  const x = klemme(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
