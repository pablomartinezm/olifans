// «Flappy Chicle»: el personaje elegido flota con una pompa de chicle y cada toque es un soplido.
// Entre columnas de rollos de papel gigantes salen los colegas de la despedida, cada uno con su gracia.
import { createAudio } from "./audio.ts";
import { ICON_SVG, layer } from "./uli-art.ts";
import { CEIL, FLOOR, PJS, SPR, WALL_W, paint, paintRolls, paintWall, type Pj, type SprName } from "./chicle-art.ts";

export type Run = { score: number; gums: number; bills: number };
export type Friend = "javi" | "arro" | "hugo" | "marcos" | "moreno" | "sanlle" | "ricky" | "sergio";
const STANDS: Friend[] = ["javi", "arro", "hugo", "marcos", "sergio"]; // de pie sobre los rollos
const FREES: Friend[] = ["sanlle", "ricky"];                  // en el hueco entre columnas; Moreno cuelga en lugar de los rollos de arriba

// ---------------------------------------------------------------- piezas puras (con test)
const CYR: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", i: "и", k: "к", l: "л", m: "м", n: "н", ñ: "нь", o: "о", p: "п", r: "р",
  s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", z: "с", á: "а", é: "е", í: "и", ó: "о", ú: "у", ü: "у",
};
const LETTER = /[a-záéíóúüñ]/;
// Gon escribe en español con letras cirílicas: «¡Ojo!» → «¡Охо!». Se lee con un poco de esfuerzo.
export function cyrillic(text: string) {
  let out = "", up = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], lo = ch.toLowerCase(), nx = text[i + 1]?.toLowerCase() ?? "", prev = text[i - 1]?.toLowerCase() ?? "";
    up ||= ch !== lo;
    let c: string;
    if (lo === "c" && nx === "h") { c = "ч"; i++; }
    else if (lo === "l" && nx === "l") { c = "й"; i++; }
    else if (lo === "q" && nx === "u") { c = "к"; i++; }
    else if (lo === "g" && nx === "u" && /[eéií]/.test(text[i + 2] ?? "")) { c = "г"; i++; }
    else if (lo === "c") c = /[eéií]/.test(nx) ? "с" : "к";
    else if (lo === "g") c = /[eéií]/.test(nx) ? "х" : "г";
    else if (lo === "j") c = "х";
    else if (lo === "h") c = ""; // muda: la mayúscula pasa a la letra siguiente
    else if (lo === "y") c = LETTER.test(nx) ? "й" : "и";
    else if (lo === "e" && !LETTER.test(prev)) c = "э";
    else c = CYR[lo] ?? ch;
    if (up && c) { c = c[0].toUpperCase() + c.slice(1); up = false; }
    out += c;
  }
  return out;
}

// Cuanto más avanza la noche (k de 0 a 1), más letras se le lían a Gon. Misma semilla, mismo texto.
const JUNK = "жщъыьэюяфцшчбдзлпгийк";
export function garble(text: string, k: number, seed: number) {
  if (k <= 0) return text;
  let s = seed | 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let out = "";
  for (const ch of text) {
    const lo = ch.toLowerCase();
    if (!/[а-яё]/.test(lo) || rnd() >= k) { out += ch; continue; }
    const r = JUNK[Math.floor(rnd() * JUNK.length)];
    out += (ch !== lo ? r.toUpperCase() : r) + (rnd() < k / 3 ? r : "");
  }
  return out;
}

// Chicles para la tienda compartida con «Las gafas de Uli». Una partida normal (10-20 barriles) da 40-80.
export function reward(r: Run, nuevo: boolean) {
  return r.score * 2 + r.gums + r.bills * 5 + (nuevo ? 25 : 0);
}

export function circleRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}
export function segDist(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const dx = bx - ax, dy = by - ay;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + k * dx - px, ay + k * dy - py);
}

// ---------------------------------------------------------------- reglas
const MIN_W = 144, MAX_W = 176, MIN_H = 230, MAX_H = 340; // columnas y filas visibles según la pantalla
const HUD = 30;                    // marcador arriba, fuera del campo de juego
const PX0 = 42;                    // Uli no se mueve en horizontal: se mueve el bar
const OW = 28;                     // ancho de una columna de rollos
const SPACING = 106;               // de columna a columna
const G = 860, FLAP = -250, VMAX = 340;
const BUB = { rest: 6, max: 14, puff: 3.4 };
const STEP = 80;                   // cuánto puede cambiar de altura el hueco de una columna a la siguiente
// ponytail: curva de dificultad a ojo, sin tabla configurable
const speed = (score: number) => 60 + Math.min(score, 40) * 0.35;
const gapH = (score: number) => Math.max(82, 102 - score * 0.5); // con piernas, Uli ocupa más
// Sanlle y Marcos solo cambian lo rápido que pasa el bar; a Uli se le controla siempre igual.
const HIGH = { t: 4, k: 1.3 };      // la farlopa de Sanlle: el bar va más rápido y cada rollo vale doble
const SLOW = { t: 4, k: 0.6 };      // el arpa de Marcos: el bar va más despacio, un respiro
const JAVI = { a0: (170 * Math.PI) / 180, a1: (248 * Math.PI) / 180, len: 33 }; // de brazo al frente a brazo en alto

const GON: Record<Friend | "arriba" | "abajo" | "inicio" | "muerte", string[]> = {
  javi: ["¡Ojo, que Javi levanta el brazo!", "¡Javi, baja ese brazo!"],
  arro: ["¡Que viene Arro a darte la chapa!", "¡Arro pega en el hombro!"],
  hugo: ["¡Coge los billetes de Hugo!", "¡Hugo invita a todo!"],
  marcos: ["Marcos toca el arpa. Relax.", "¡Que suene el arpa!"],
  moreno: ["¡Cuidado, que Moreno muerde!", "¡Moreno cuelga del techo!"],
  sanlle: ["¡El gorila va hasta arriba!", "¡Sanlle invita a una!"],
  ricky: ["¡Rebota en la calva de Ricky!", "¡Ricky está abajo!"],
  sergio: ["¡Quítale el chicle a Sergio!", "¡Sergio se lo come todo!"],
  arriba: ["¡Arriba!", "¡Sube, sube!"],
  abajo: ["¡Abajo!", "¡Baja!"],
  inicio: ["¡Vamos, {n}!", "¡Asquerosa!", "¡Sopla, {n}!"], // {n}: el personaje elegido
  muerte: ["¡{n}, no!", "¡Otra ronda!", "¡Pobre pompa!"],
};
const BLA = ["BLA BLA BLA", "HE DEJADO DE FUMAR", "Y ESCUCHA...", "PUES NADA", "QUE TE DIGO", "OTRA COSA", "¿ME SIGUES?"];

type Opts = { font: string; textFont: string; onOver: (r: Run) => void };
type Ob = {
  x: number; n: number; top: number; bot: number; passed: boolean; gum: 0 | 1 | 2;
  f: null | { id: Friend; pos: "stand" | "top"; h: number; t: number; ph: number; done: boolean; thrown: number; wait: number; punch: number };
};
type En = { id: Friend; x: number; t: number; ph: number; done: boolean; squash: number };
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string };
type Pop = { text: string; x: number; y: number; age: number; color: string };
const hash = (i: number) => Math.imul(i ^ 0x2c1b3c6d, 2654435761) >>> 0;

export function mountChicle({ canvas: cv, stage }: { canvas: HTMLCanvasElement; stage: HTMLElement }, opts: Opts) {
  const ctx = cv.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let U = 4, VW = 160, H = 280, PH = H - HUD;

  // ---------------------------------------------------------------- sprites
  const IMG = Object.fromEntries(Object.entries(SPR).map(([k, d]) => [k, paint(d)])) as Record<keyof typeof SPR, HTMLCanvasElement>;
  const GON_FACE = paint({ rows: SPR.gon.rows.slice(0, 20), pal: SPR.gon.pal });
  const GUM = (() => {
    const ic = ICON_SVG.chicle;
    const c = layer(() => {}, ic.w, ic.h);
    const g = c.getContext("2d")!;
    for (const [fill, d] of ic.paths) { g.fillStyle = fill; g.fill(new Path2D(d)); }
    return c;
  })();
  // El personaje elegido: sprites y cuerpo para los choques (cabeza, tronco y piernas desde el centro de la cabeza).
  const PL = Object.fromEntries(PJS.map(({ id, name }) => {
    const img = IMG[id];
    return [id, { name, img, kick: IMG[`${id}_kick` as SprName], ko: IMG[`${id}_ko` as SprName], cx: img.width / 2, feet: img.height - 11, wide: id === "sanlle" }];
  })) as Record<Pj, { name: string; img: HTMLCanvasElement; kick: HTMLCanvasElement; ko: HTMLCanvasElement; cx: number; feet: number; wide: boolean }>;
  let wall = paintWall(PH), rolls = paintRolls(PH), hanging = paintRolls(PH, true);
  let best = 0;

  // ---------------------------------------------------------------- sonido
  const au = createAudio();
  const { tone, noise } = au;
  const sfx = {
    flap() { tone(300, 520, 0.08, "triangle", 0.04); },
    point() { tone(880, 1320, 0.06, "square", 0.022); },
    gum() { tone(1200, 1800, 0.05, "sine", 0.06); tone(1500, 2300, 0.05, "sine", 0.05, 0.05); },
    cash() { tone(1500, 2400, 0.07, "square", 0.025); tone(2000, 3000, 0.08, "square", 0.025, 0.07); },
    toss() { tone(500, 900, 0.05, "sine", 0.02); },
    pop() { noise(0.12, 0.35); tone(520, 120, 0.16, "square", 0.05); },
    thud() { tone(120, 50, 0.15, "sine", 0.12); noise(0.08, 0.15); },
    boing() { tone(160, 620, 0.16, "sine", 0.12); tone(620, 300, 0.12, "sine", 0.06, 0.15); },
    punch() { noise(0.1, 0.4); tone(170, 70, 0.12, "square", 0.05); },
    sniff() { noise(0.45, 0.5, 700, 4000); tone(300, 1200, 0.5, "sawtooth", 0.02, 0.35); },
    harp() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.003, 0.6, "sine", 0.05, i * 0.08)); },
    gon() { [0, 0.07, 0.14].forEach((d) => { const f = 260 + Math.random() * 420; tone(f, f * 1.4, 0.05, "square", 0.018, d); }); },
    arm() { tone(220, 760, 0.1, "triangle", 0.03); },
    nam() { [0, 0.13].forEach((d) => { noise(0.06, 0.25); tone(190, 110, 0.08, "square", 0.05, d); }); },
  };

  // ---------------------------------------------------------------- estado
  const st = {
    mode: "intro" as "intro" | "ready" | "play" | "dying" | "over",
    t: 0, dist: 0, y: 0, vy: 0, br: BUB.rest, land: 0, kick: 0,
    score: 0, gums: 0, bills: 0,
    obs: [] as Ob[], ents: [] as En[], cash: [] as Bit[], bits: [] as Bit[], notes: [] as Bit[], pops: [] as Pop[],
    high: 0, slow: 0, shake: 0,
    glasses: null as null | { x: number; y: number; vx: number; vy: number; r: number; vr: number },
    gon: null as null | { text: string; t: number },
    deck: [] as Friend[], seed: 1, pj: "uli" as Pj, smoke: [] as Bit[],
  };
  function reset(mode: "intro" | "ready") {
    Object.assign(st, {
      mode, t: 0, y: PH * 0.42, vy: 0, br: BUB.rest, land: 0, kick: 0, score: 0, gums: 0, bills: 0,
      obs: [], ents: [], cash: [], bits: [], notes: [], smoke: [], pops: [], high: 0, slow: 0, shake: 0, glasses: null, gon: null, deck: [],
    });
  }
  reset("intro");
  const pop = (text: string, x: number, y: number, color = "#f6ead2") => st.pops.push({ text, x, y, age: 0, color });
  function say(key: keyof typeof GON) {
    const lines = GON[key];
    const drunk = Math.min(1, Math.max(0, (st.score - 4) / 22)); // a partir de 26 barriles no hay quien le entienda
    const line = lines[Math.floor(Math.random() * lines.length)].replaceAll("{n}", PL[st.pj].name);
    st.gon = { text: garble(cyrillic(line), drunk, st.seed++), t: 0 };
    sfx.gon();
  }
  function nextFriend() {
    if (!st.deck.length) st.deck = [...STANDS, "moreno" as Friend, ...FREES].filter((id) => id !== st.pj).sort(() => Math.random() - 0.5);
    return st.deck.pop()!;
  }

  // ---------------------------------------------------------------- columnas y colegas
  function spawn() {
    const last = st.obs[st.obs.length - 1];
    const n = last ? last.n + 1 : 1;
    const x = last ? last.x + SPACING : VW + 30;
    const gh = Math.round(gapH(st.score));
    const id = n >= 4 && n % 2 === 0 ? nextFriend() : null; // las tres primeras, sin sorpresas
    const pos = !id ? null : STANDS.includes(id) ? "stand" : id === "moreno" ? "top" : null;
    const fh = id && pos ? IMG[id].height : 0;
    const lo = CEIL + 14 + (pos === "top" ? fh + 6 : 0) + gh / 2;
    const hi = Math.max(lo, PH - FLOOR - 16 - (pos === "stand" ? fh : 0) - gh / 2);
    const prev = last ? (last.top + last.bot) / 2 : PH * 0.45;
    const cy = Math.min(hi, Math.max(lo, prev + (Math.random() * 2 - 1) * STEP));
    st.obs.push({
      x, n, top: Math.round(cy - gh / 2), bot: Math.round(cy + gh / 2), passed: false, gum: id === "sergio" || Math.random() < 0.5 ? 1 : 0,
      f: id && pos ? { id, pos, h: fh, t: 0, ph: Math.random() * 2.4, done: false, thrown: 0, wait: 0, punch: 0 } : null,
    });
    if (id && !pos) st.ents.push({ id, x: x + OW + (SPACING - OW) / 2, t: 0, ph: Math.random() * 6, done: false, squash: 0 });
    if (id) say(id);
    else if (last && n % 3 === 1) {
      if (cy < prev - 26) say("arriba");
      else if (cy > prev + 26) say("abajo");
    }
  }
  const javiK = (t: number) => {
    const p = t % 2.4;
    return p < 1.1 ? 0 : p < 1.22 ? (p - 1.1) / 0.12 : p < 2 ? 1 : p < 2.2 ? 1 - (p - 2) / 0.2 : 0;
  };
  function javiArm(o: Ob) { // brazo tieso: sale al frente y sube de golpe
    const k = javiK(o.f!.t + o.f!.ph);
    const a = JAVI.a0 + (JAVI.a1 - JAVI.a0) * k;
    const x0 = o.x + 4 + 3, y0 = o.bot + 21;
    return { k, a, x0, y0, x1: x0 + Math.cos(a) * JAVI.len, y1: y0 + Math.sin(a) * JAVI.len };
  }
  // Sergio se va llevando a la boca el chicle de su hueco según se acerca la columna: o bajas a quitárselo, o se lo come.
  const MOUTH = 12; // la boca de Sergio, desde lo alto de su cabeza
  const slurp = (o: Ob) => (o.f?.id === "sergio" ? Math.min(1, Math.max(0, (100 - (o.x + OW / 2 - PX0)) / 112)) ** 3 : 0);
  function gumY(o: Ob) {
    const mid = (o.top + o.bot) / 2 + Math.sin(st.t * 4 + o.n) * 1.5;
    return mid + (o.bot + MOUTH - mid) * slurp(o);
  }
  function sanlle(e: En) { // el gorila salta de suelo a techo; en el suelo, con los nudillos apoyados
    const j = Math.abs(Math.sin(e.t * 1.6 + e.ph));
    const img = j < 0.15 ? IMG.sanlle_kick : IMG.sanlle;
    const feet = PH - FLOOR + 1 - j * (PH - FLOOR - CEIL - img.height - 16) * 0.6;
    return { x: e.x, img, top: feet - img.height };
  }

  // ---------------------------------------------------------------- partida
  function flap() {
    if (st.mode === "ready") { st.mode = "play"; say("inicio"); }
    if (st.mode !== "play") return;
    st.vy = FLAP;
    st.br = Math.min(BUB.max, st.br + BUB.puff);
    st.kick = 0.16; // patalea al soplar
    sfx.flap();
  }
  function die() {
    if (st.mode !== "play") return;
    st.mode = "dying";
    st.land = 0;
    st.vy = -140;
    st.shake = 0.3;
    st.glasses = st.pj === "uli" ? { x: PX0, y: st.y - 1, vx: -60 + Math.random() * 40, vy: -220, r: 0, vr: (Math.random() < 0.5 ? -1 : 1) * 9 } : null;
    const cx = PX0 + 1 + st.br, cy = st.y + 4;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90;
      st.bits.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, life: 0.7 + Math.random() * 0.4, c: Math.random() < 0.7 ? "#ff6fb4" : "#ffd6ea" });
    }
    st.br = 0;
    pop("¡PLOF!", PX0 + 8, st.y - 16, "#ff6fb4");
    sfx.pop();
    say("muerte");
  }
  const tilt = () => (st.mode === "play" ? Math.max(-0.35, Math.min(0.6, st.vy / 480)) : 0);
  function shape() { // círculos de choque, girados como el dibujo
    const a = tilt(), c = Math.cos(a), s = Math.sin(a);
    const at = (dx: number, dy: number, r: number) => [PX0 + dx * c - dy * s, st.y + dx * s + dy * c, r] as const;
    const p = PL[st.pj];
    const out = [at(0, 0, 8), at(0, p.feet * 0.55, p.wide ? 10 : 7), at(0, p.feet - 3, p.wide ? 6 : 5)]; // el gorila, más ancho
    if (st.br > 1) out.push(at(1 + st.br, 4, st.br * 0.85));
    return out;
  }
  function collide() {
    const body = shape();
    const hit = (f: (cx: number, cy: number, r: number) => boolean) => body.some(([cx, cy, r]) => f(cx, cy, r));
    const mx = PX0, my = st.y + 10; // centro del cuerpo: para recoger chicles y billetes
    for (const o of st.obs) {
      if (o.x > PX0 + 40 || o.x + OW < PX0 - 40) continue;
      const f = o.f;
      const top = f?.pos === "top" // Moreno: su cuerpo y la correa hasta el techo; si no, la columna de chorizos y jamón
        ? (cx: number, cy: number, r: number) => circleRect(cx, cy, r, o.x + 6, o.top - f.h + 2, 16, f.h - 2) || segDist(o.x + 14, -10, o.x + 14, o.top - f.h + 18, cx, cy) < r + 1
        : (cx: number, cy: number, r: number) => circleRect(cx, cy, r, o.x + 3, -60, OW - 6, o.top + 60);
      if (hit((cx, cy, r) => top(cx, cy, r) || circleRect(cx, cy, r, o.x + 3, o.bot + 2, OW - 6, PH))) return die();
      if (f?.id === "javi") {
        const a = javiArm(o);
        if (a.k > 0.3 && hit((cx, cy, r) => segDist(a.x0, a.y0, a.x1, a.y1, cx, cy) < r + 2.5)) return die();
      }
      // Arro: si pasas pegado a él, te mete un golpe en el hombro que te manda para arriba
      if (f?.id === "arro" && !f.done && Math.abs(o.x + OW / 2 - PX0) < 16 && st.y + PL[st.pj].feet > o.bot - 4) {
        f.done = true; f.punch = 0.35;
        st.vy = -330; st.shake = 0.25;
        pop("¡PUM!", PX0 + 10, st.y - 14, "#e4574a");
        sfx.punch();
      }
      if (o.gum === 1 && Math.hypot(o.x + OW / 2 - mx, gumY(o) - my) < 16) {
        o.gum = 2; st.gums++;
        pop("+1", PX0 + 4, st.y - 16, "#ff9fd0");
        sfx.gum();
      }
    }
    for (const e of st.ents) {
      if (Math.abs(e.x - PX0) > 50) continue;
      if (e.id === "sanlle" && !e.done) {
        const s = sanlle(e);
        if (hit((cx, cy, r) => circleRect(cx, cy, r, s.x - 13, s.top + 3, 26, s.img.height - 4))) {
          e.done = true;
          st.high = HIGH.t;
          for (let i = 0; i < 16; i++) st.bits.push({ x: PX0 + 2, y: st.y + 2, vx: 30 + Math.random() * 80, vy: -60 + Math.random() * 80, t: 0, life: 0.6, c: "#ffffff" });
          pop("¡SNIFF!", PX0 + 10, st.y - 16, "#ffffff");
          sfx.sniff();
        }
      } else if (e.id === "ricky" && st.vy > -60) {
        const top = PH - FLOOR - IMG.ricky.height + 1;
        if (hit((cx, cy, r) => Math.hypot(e.x - cx, top + 9 - cy) < r + 8)) {
          st.vy = -360; e.squash = 0.2;
          pop("¡BOING!", e.x, top - 10);
          sfx.boing();
        }
      }
    }
    st.cash = st.cash.filter((b) => {
      if (Math.hypot(b.x - mx, b.y - my) >= 16) return true;
      st.bills++;
      pop("+5", b.x, b.y - 8, "#9ad7a8");
      sfx.cash();
      return false;
    });
  }
  function world(dt: number, v: number) {
    for (const o of st.obs) o.x -= v * dt;
    for (const e of st.ents) { e.x -= v * dt; e.t += dt; }
    st.obs = st.obs.filter((o) => o.x > -OW - 40);
    st.ents = st.ents.filter((e) => e.x > -40);
    const last = st.obs[st.obs.length - 1];
    if (!last || last.x < VW + 20 - SPACING) spawn();
    for (const o of st.obs) {
      if (!o.passed && o.x + OW < PX0 - 6) {
        o.passed = true;
        st.score += st.high > 0 ? 2 : 1;
        sfx.point();
      }
      const f = o.f;
      if (!f) continue;
      f.t += dt;
      f.punch = Math.max(0, f.punch - dt);
      if (f.id === "hugo" && o.x < VW - 8 && f.thrown < 6 && (f.wait -= dt) <= 0) {
        f.wait = 0.3; f.thrown++;
        st.cash.push({ x: o.x + 14, y: o.bot + 18, vx: -30 + Math.random() * 60, vy: -140 + Math.random() * 50, t: 0, life: 99, c: "" });
        sfx.toss();
      }
      if (f.id === "marcos" && o.x < VW - 10) {
        if (!f.done && o.x < VW * 0.7) {
          f.done = true;
          st.slow = SLOW.t;
          pop("¡RELAX!", VW / 2, PH * 0.3, "#c9b6ff");
          sfx.harp();
        }
        if ((f.wait -= dt) <= 0) {
          f.wait = 0.35;
          st.notes.push({ x: o.x + 22, y: o.bot + 6, vx: -6 + Math.random() * 12, vy: -24 - Math.random() * 10, t: 0, life: 1.6, c: "" });
        }
      }
      if (f.id === "arro" && o.x < VW && (f.wait -= dt) <= 0) {
        f.wait = 0.22;
        st.smoke.push({ x: o.x + 4 + 18, y: o.bot + 12, vx: -4 + Math.random() * 8, vy: -14 - Math.random() * 8, t: 0, life: 1.4, c: "" });
      }
      if (f.id === "sergio") {
        f.wait = Math.max(0, f.wait - dt); // masticando
        if (o.gum === 1 && slurp(o) >= 1) {
          o.gum = 2; f.wait = 0.7;
          pop("¡ÑAM!", o.x + OW / 2, o.bot - 10, "#f2b35e");
          sfx.nam();
        }
      }
      if (f.id === "javi") {
        const up = javiK(f.t + f.ph) > 0.5;
        if (up && !f.done && o.x < VW) sfx.arm();
        f.done = up;
      }
    }
    for (const e of st.ents) if (e.id === "ricky") e.squash = Math.max(0, e.squash - dt);
  }
  function particles(dt: number, v: number) {
    for (const p of st.bits) { p.t += dt; p.x += (p.vx - v) * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
    st.bits = st.bits.filter((p) => p.t < p.life);
    for (const n of st.notes) { n.t += dt; n.x += (n.vx - v) * dt + Math.sin(n.t * 6) * 0.3; n.y += n.vy * dt; }
    st.notes = st.notes.filter((n) => n.t < n.life);
    for (const m of st.smoke) { m.t += dt; m.x += (m.vx - v) * dt + Math.sin(m.t * 4 + m.y) * 0.2; m.y += m.vy * dt; }
    st.smoke = st.smoke.filter((m) => m.t < m.life);
    for (const b of st.cash) {
      b.t += dt;
      b.vy = Math.min(28, b.vy + 80 * dt);
      b.vx *= 1 - Math.min(1, dt * 1.5);
      b.x += (b.vx - v) * dt + Math.sin(b.t * 5) * 0.4;
      b.y += b.vy * dt;
    }
    st.cash = st.cash.filter((b) => b.y < PH && b.x > -14);
  }
  function update(dtReal: number) {
    st.high = Math.max(0, st.high - dtReal);
    st.slow = Math.max(0, st.slow - dtReal);
    st.shake = Math.max(0, st.shake - dtReal);
    const dt = dtReal;
    const pace = (st.high > 0 ? HIGH.k : 1) * (st.slow > 0 ? SLOW.k : 1);
    st.t += dt;
    for (const p of st.pops) p.age += dtReal;
    st.pops = st.pops.filter((p) => p.age < 0.9);
    if (st.gon && (st.gon.t += dtReal) > 3.2) st.gon = null;
    const v = st.mode === "dying" || st.mode === "over" ? 0 : speed(st.score) * pace;
    st.dist += v * dt;
    st.br += (BUB.rest - st.br) * Math.min(1, dt * 2.2);
    st.kick = Math.max(0, st.kick - dt);
    particles(dt, v);
    if (st.mode === "intro" || st.mode === "ready") { // en el menú, más arriba para que no lo tape el selector
      st.y = PH * (st.mode === "intro" ? 0.27 : 0.42) + Math.sin(st.t * 3) * 3;
      return;
    }
    if (st.mode === "play") {
      st.vy = Math.min(VMAX, st.vy + G * dt);
      st.y += st.vy * dt;
      if (st.y < CEIL + 11) { st.y = CEIL + 11; st.vy = Math.max(0, st.vy); }
      world(dt, v);
      collide();
      if (st.mode === "play" && shape().some(([, cy, r]) => cy + r >= PH - FLOOR)) die();
    } else if (st.mode === "dying") {
      const stand = PH - FLOOR - PL[st.pj].feet; // cae de pie y luego se desploma
      if (st.land === 0) {
        st.vy = Math.min(VMAX * 1.2, st.vy + G * dt);
        st.y = Math.min(stand, st.y + st.vy * dt);
        if (st.y >= stand) { st.land = 0.001; sfx.thud(); }
      } else st.land += dtReal;
      const g = st.glasses;
      if (g) {
        g.vy += G * 0.8 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.r += g.vr * dt;
        if (g.y > PH - FLOOR - 2) { g.y = PH - FLOOR - 2; g.vy *= -0.3; g.vx *= 0.6; g.vr *= 0.5; }
      }
      if (st.land > 1.1) {
        st.mode = "over";
        opts.onOver({ score: st.score, gums: st.gums, bills: st.bills });
      }
    }
  }

  // ---------------------------------------------------------------- dibujo
  const px = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function drawText(text: string, x: number, y: number, color: string, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e1d19";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }
  // Brazo dibujado en horizontal (hombro a la izquierda), girado sobre el hombro.
  function limb(img: HTMLCanvasElement, x: number, y: number, a: number) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(a);
    ctx.drawImage(img, -1, -4);
    ctx.restore();
  }
  function bubble(cx: number, cy: number, r: number) {
    const R = Math.round(r);
    if (R < 2) return;
    const disc = (rr: number, c: string) => {
      for (let dy = -rr; dy <= rr; dy++) {
        const w = Math.round(Math.sqrt(rr * rr - dy * dy));
        px(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1, c);
      }
    };
    disc(R, "#c93a7d");
    disc(R - 1, "#ff6fb4");
    const hx = Math.round(cx - R * 0.45), hy = Math.round(cy - R * 0.5);
    px(hx, hy, 2, 2, "#ffd6ea");
    px(hx + 2, hy - 1, 1, 1, "#ffffff");
  }
  function speech(x: number, y: number, w: number, h: number, tailX: number, tailY: number) {
    const x0 = x + 8, y0 = y + h, len = Math.hypot(tailX - x0, tailY - y0);
    for (let d = 0; d <= len; d += 0.5) px(Math.round(x0 + ((tailX - x0) * d) / len) - 1, Math.round(y0 + ((tailY - y0) * d) / len) - 1, 3, 3, "#06121a");
    px(x - 1, y, w + 2, h, "#06121a"); px(x, y - 1, w, h + 2, "#06121a");
    px(x, y, w, h, "#f6ead2");
    for (let d = 0; d <= len - 1; d += 0.5) px(Math.round(x0 + ((tailX - x0) * d) / len), Math.round(y0 + ((tailY - y0) * d) / len), 1, 1, "#f6ead2");
  }
  function drawFloor() {
    const y0 = PH - FLOOR;
    px(0, y0, VW, 4, "#6e4428"); px(0, y0, VW, 1, "#8a5a36"); px(0, y0 + 4, VW, 1, "#2c1a11");
    const base = Math.floor(st.dist / 10), frac = st.dist - base * 10;
    for (let i = -1; i <= VW / 10 + 1; i++) {
      const x = Math.round(i * 10 - frac), idx = base + i;
      for (let r = 0; r < 2; r++) px(x, y0 + 5 + r * 8, 10, 8, (idx + r) % 2 ? "#cfc6b0" : "#a99f8a");
      const h = hash(idx);
      if (h % 4 === 0) { // servilleta arrugada
        const nx = x + ((h >> 3) % 5), ny = y0 + 6 + ((h >> 6) % 8);
        px(nx, ny, 5, 3, "#f4f1ea"); px(nx + 1, ny + 1, 2, 1, "#d6d1c4"); px(nx, ny + 3, 4, 1, "#bdb6a6");
      } else if (h % 7 === 0) px(x + ((h >> 4) % 8), y0 + 8 + ((h >> 7) % 8), 2, 1, "#4a5a20"); // hueso de aceituna
    }
  }
  function drawHud() {
    px(0, 0, VW, HUD, "#06121a");
    px(0, HUD - 2, VW, 2, "#2e5549");
    ctx.drawImage(GON_FACE, 3, 6);
    const bx = 27, bw = VW - bx - 46;
    ctx.textBaseline = "top";
    if (st.gon) {
      px(bx - 3, 15, 3, 3, "#f6ead2"); px(bx - 4, 16, 1, 1, "#f6ead2");
      px(bx, 3, bw, HUD - 8, "#f6ead2");
      ctx.font = `600 7px ${opts.textFont}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#1d1b20";
      const words = st.gon.text.split(" "), lines: string[] = [];
      for (const w of words) {
        const cur = lines[lines.length - 1];
        if (cur !== undefined && ctx.measureText(`${cur} ${w}`).width <= bw - 6) lines[lines.length - 1] = `${cur} ${w}`;
        else lines.push(w);
      }
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, bx + 3, 4 + i * 7));
    } else {
      ctx.font = `400 7px ${opts.font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#6f8a80";
      ctx.fillText(`RÉCORD ${best}`, bx, 11);
    }
    ctx.textAlign = "right";
    ctx.font = `700 16px ${opts.font}`;
    drawText(String(st.score), VW - 5, 2, "#f6ead2");
    const sw = ctx.measureText(String(st.score)).width;
    ctx.font = `700 7px ${opts.font}`;
    const coins = st.gums + st.bills * 5;
    drawText(String(coins), VW - 5, 20, "#ff9fd0");
    bubble(VW - 10 - ctx.measureText(String(coins)).width, 23, 2.4);
    if (st.high > 0) drawText("x2", VW - 9 - sw, 6, "#ffffff", reduced ? 1 : 0.6 + 0.4 * Math.sin(st.t * 14));
  }
  function drawWorld() {
    const off = Math.floor(st.dist * 0.3) % WALL_W;
    ctx.drawImage(wall, -off, 0);
    if (WALL_W - off < VW) ctx.drawImage(wall, WALL_W - off, 0);
    for (const o of st.obs) {
      const x = Math.round(o.x);
      const f = o.f;
      if (f?.pos === "top") { // Moreno, loco perdido, colgado de la correa que sujeta su novia desde el techo
        const my = o.top - f.h, wob = Math.round(Math.sin(st.t * 9 + o.n) * 1.2);
        px(x + 14, CEIL - 1, 1, my + 18 - CEIL, "#c0302a");
        ctx.drawImage(Math.floor(st.t * 5) % 2 ? IMG.moreno_kick : IMG.moreno, x + 4 + wob, my);
      } else ctx.drawImage(hanging, x, o.top - PH);
      ctx.drawImage(rolls, x, o.bot + (f?.pos === "stand" ? f.h : 0));
      if (!f || f.pos !== "stand") continue;
      if (f.id === "javi") {
        const a = javiArm(o);
        if (a.k < 0.02) ctx.drawImage(IMG.javi, x + 4, o.bot);
        else { ctx.drawImage(IMG.javi_sinbrazo, x + 4, o.bot); limb(IMG.brazo, a.x0 - o.x + x, a.y0, a.a); }
      } else if (f.id === "arro") {
        ctx.drawImage(f.punch > 0 ? IMG.arro_sinbrazo : IMG.arro, x + 4, o.bot);
        if (f.punch > 0) limb(IMG.puno, x + 7, o.bot + 21, (215 * Math.PI) / 180);
      } else if (f.id === "hugo") ctx.drawImage(IMG.hugo, x + 4, o.bot);
      else if (f.id === "sergio") ctx.drawImage(IMG.sergio, x + 4, o.bot + (f.wait > 0 && Math.floor(st.t * 12) % 2 ? 1 : 0));
      else if (f.id === "marcos") {
        ctx.drawImage(IMG.marcos, x - 1, o.bot);
        ctx.drawImage(IMG.arpa, x + 15, o.bot + f.h - IMG.arpa.height);
        const k = Math.floor(st.t * 10) % 5; // la cuerda que suena
        px(x + 19 + k * 2, o.bot + f.h - 20, 1, 4, "#ffffff");
      }
    }
    // la viga del techo, por delante de los rollos colgados; la novia de Moreno sujeta la correa desde ahí
    px(0, 0, VW, CEIL - 2, "#2c1a11"); px(0, CEIL - 2, VW, 1, "#6e4428"); px(0, CEIL - 1, VW, 1, "#1a0f0a");
    for (const o of st.obs) if (o.f?.pos === "top") ctx.drawImage(IMG.novia, Math.round(o.x) + 8, 0);
    for (const e of st.ents) {
      if (e.id !== "sanlle") continue;
      const s = sanlle(e);
      ctx.drawImage(s.img, Math.round(s.x - s.img.width / 2), Math.round(s.top));
    }
    for (const m of st.smoke) px(Math.round(m.x), Math.round(m.y), 2, 2, `rgba(220,220,220,${(0.7 * (1 - m.t / m.life)).toFixed(2)})`);
    for (const o of st.obs) if (o.gum === 1) ctx.drawImage(GUM, Math.round(o.x + OW / 2 - 6), Math.round(gumY(o) - 6));
    for (const b of st.cash) {
      const w = Math.max(1, Math.round(Math.abs(Math.cos(b.t * 6)) * IMG.billete.width)); // gira al caer
      ctx.drawImage(IMG.billete, Math.round(b.x - w / 2), Math.round(b.y - 4), w, IMG.billete.height);
    }
    for (const n of st.notes) { ctx.globalAlpha = Math.min(1, (n.life - n.t) * 2); ctx.drawImage(IMG.nota, Math.round(n.x), Math.round(n.y)); ctx.globalAlpha = 1; }
    for (const e of st.ents) if (e.id === "ricky") ctx.drawImage(IMG.ricky, Math.round(e.x - 10), PH - FLOOR - IMG.ricky.height + 1 + (e.squash > 0 ? 2 : 0));
    drawFloor();
    // Arro no calla: su bocadillo tapa lo que viene detrás
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `700 7px ${opts.font}`;
    for (const o of st.obs) {
      if (o.f?.id !== "arro" || o.x > VW + 10) continue;
      const text = BLA[Math.floor(o.f.t / 0.8) % BLA.length];
      const cut = text.lastIndexOf(" ", Math.ceil(text.length / 2) + 1);
      const lines = ctx.measureText(text).width > 64 && cut > 0 ? [text.slice(0, cut), text.slice(cut + 1)] : [text];
      const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 10, h = 8 + lines.length * 8;
      const x = Math.round(o.x) + 16, y = Math.max(CEIL + 3, o.bot - 18 - h);
      speech(x, y, w, h, Math.round(o.x) + 13, o.bot - 1);
      ctx.fillStyle = "#1d1b20";
      lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 8.5 + i * 8));
    }
  }
  function drawUli() {
    const down = st.mode === "dying" || st.mode === "over";
    const p = PL[st.pj];
    const splat = () => { px(-2, 1, 5, 3, "#ff6fb4"); px(3, 3, 3, 2, "#ff6fb4"); px(-5, 4, 3, 2, "#ff9fd0"); }; // chicle por la cara
    ctx.save();
    if (down && st.land > 0) { // se desploma como un árbol, girando sobre los pies
      ctx.translate(PX0, PH - FLOOR);
      ctx.rotate(Math.min(1.45, (st.land * 3) ** 2));
      ctx.drawImage(p.ko, -p.cx, -p.ko.height + 1);
      ctx.translate(0, -(p.ko.height - 10));
      splat();
    } else {
      ctx.translate(PX0, Math.round(st.y));
      ctx.rotate(down ? 0.25 : tilt());
      ctx.drawImage(down ? p.ko : st.kick > 0 ? p.kick : p.img, -p.cx, -9);
      if (down) splat();
      else bubble(1 + st.br, 4, st.br);
    }
    ctx.restore();
    const g = st.glasses;
    if (g) {
      ctx.save();
      ctx.translate(Math.round(g.x), Math.round(g.y));
      ctx.rotate(g.r);
      ctx.drawImage(IMG.gafas, -8, -3);
      ctx.restore();
    }
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(U, 0, 0, U, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawHud();
    const shake = st.shake > 0 && !reduced;
    const sx = shake ? Math.round(Math.random() * 4 - 2) : 0, sy = shake ? Math.round(Math.random() * 4 - 2) : 0;
    ctx.setTransform(U, 0, 0, U, sx * U, (HUD + sy) * U);
    ctx.save();
    ctx.beginPath(); ctx.rect(-4, 0, VW + 8, PH + 4); ctx.clip();
    drawWorld();
    drawUli();
    for (const p of st.bits) px(Math.round(p.x), Math.round(p.y), 2, 2, p.c);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 8px ${opts.font}`;
    for (const p of st.pops) drawText(p.text, p.x, p.y - p.age * 16, p.color, 1 - p.age / 0.9);
    if (st.mode === "ready") {
      ctx.font = `700 9px ${opts.font}`;
      drawText("TOCA PARA SOPLAR", VW / 2, PH * 0.64, "#f6ead2", reduced ? 1 : 0.55 + 0.45 * Math.sin(st.t * 6));
    }
    if (st.slow > 0) px(0, 0, VW, PH, "rgba(130,110,255,0.10)");
    if (st.high > 0) { // subidón: el marco late en blanco
      const a = (reduced ? 0.5 : 0.35 + 0.35 * Math.sin(st.t * 14)) * Math.min(1, st.high);
      px(0, 0, VW, 3, `rgba(255,255,255,${a})`); px(0, PH - 3, VW, 3, `rgba(255,255,255,${a})`);
      px(0, 0, 3, PH, `rgba(255,255,255,${a})`); px(VW - 3, 0, 3, PH, `rgba(255,255,255,${a})`);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- tamaño, entrada, bucle
  // Escala por entero: entre 144 y 176 columnas a lo ancho y el alto que pida la pantalla.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth * dpr, h = stage.clientHeight * dpr;
    const unit = Math.max(1, Math.floor(Math.min(w / MIN_W, h / MIN_H)));
    VW = Math.min(MAX_W, Math.floor(w / unit));
    const rows = Math.max(MIN_H, Math.min(MAX_H, Math.floor(h / unit)));
    cv.width = unit * VW;
    cv.height = unit * rows;
    cv.style.width = (unit * VW) / dpr + "px";
    cv.style.height = (unit * rows) / dpr + "px";
    U = unit;
    if (rows !== H) { // ponytail: si cambia el alto en mitad de partida, las columnas ya puestas no se recolocan
      H = rows; PH = H - HUD;
      wall = paintWall(PH); rolls = paintRolls(PH); hanging = paintRolls(PH, true);
    }
  }
  const onPointer = (ev: PointerEvent) => {
    if (st.mode !== "ready" && st.mode !== "play") return;
    ev.preventDefault();
    flap();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== " " && ev.key !== "ArrowUp" && ev.key !== "w") return;
    if (st.mode !== "ready" && st.mode !== "play") return;
    ev.preventDefault();
    if (!ev.repeat) flap();
  };
  stage.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKey);
  // ponytail: solo en desarrollo, para mirar y forzar estados desde la consola del navegador
  if (process.env.NODE_ENV === "development") Object.assign(window, { __chicle: { st, flap, PX0, OW, PL } });
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  let raf = 0, last = 0, dead = false;
  function frame(now: number) {
    if (dead) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }
  Promise.all([
    document.fonts.load(`700 16px ${opts.font}`).catch(() => {}),
    document.fonts.load(`600 7px ${opts.textFont}`, "Гон").catch(() => {}),
  ]).then(() => { if (!dead) raf = requestAnimationFrame(frame); });

  return {
    start() { au.init(); reset("ready"); },
    menu() { reset("intro"); },
    sound(on: boolean) { au.set(on); },
    setBest(n: number) { best = n; },
    setPlayer(pj: Pj) { st.pj = pj; },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      au.close();
    },
  };
}
