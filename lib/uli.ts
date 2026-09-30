// «Las gafas de Uli»: motor del juego. Canvas de 96x96 "píxeles" escalado por entero.
// Uli bebe cañas y las gafas se le resbalan; el jugador toca para subírselas cuando pasan por el centro.

const S = 96;
const OX = 24, OY = 33;                  // dónde va el sprite de Uli (48x48)
const PIVOT = { x: 24, y: 64 };          // tambaleo desde la cadera, detrás de la barra
const GAFAS = { x: 8, y: 16, w: 32, h: 8 };
const MAX_DY = 6.6;                      // a partir de aquí se caen
const COUNTER_Y = 80;
const GLASS_HOME = { x: 77, y: 74 };
const GLASS_OFF = { x: 104, y: 74 };
const GLASS_AT_MOUTH = { x: 33, y: 32 };
const CENTER_X = S / 2;                  // el dedo siempre sube por aquí
const BRIDGE = { x: 24, y: 18 };         // puente de las gafas en el sprite
const FINGER_IDLE = 85;
const STRIKE = { up: 0.07, hold: 0.1, down: 0.14 };
const DRINK = { in: 0.45, wait: 0.9, lift: 0.45, sip: 0.8, down: 0.4, out: 0.3 } as const;

const SPRITES = ["base", "rubor_1", "rubor_2", "rubor_3", "ojos_abiertos", "ojos_feliz", "ojos_borracho", "ojos_cegato", "boca_borracho", "boca_ups", "gafas"] as const;

// Acierto según la distancia del puente al centro. Antes era acierto o dedo en el ojo; el «casi» quita frustración.
export type Tier = "justo" | "bien" | "casi" | "ojo";
export function tier(off: number): Tier {
  const a = Math.abs(off);
  return a <= 1 ? "justo" : a <= 3 ? "bien" : a <= 4.5 ? "casi" : "ojo";
}
const LIFT: Record<Tier, number> = { justo: 3.2, bien: 2.4, casi: 0.9, ojo: -1 };

export function nivelNombre(L: number) {
  if (L === 0) return "Sobrio";
  if (L <= 2) return "Contentillo";
  if (L <= 5) return "Piripi";
  if (L <= 8) return "Muy piripi";
  return "Como una cuba";
}

export type Result = { level: number; pushes: number; pokes: number; perfect: number; best: number; nuevo: boolean };
export type Hud = { canas: number; best: number; nivel: string; frac: number; gafas: string };

type Els = { canvas: HTMLCanvasElement; stage: HTMLElement };
type Opts = { font: string; onHud: (h: Hud) => void; onOver: (r: Result) => void };

type Pt = { x: number; y: number };
type Drink = { phase: "in" | "wait" | "lift" | "sip" | "down" | "idle" | "out"; t: number; fill: number; gap: number };
type Fall = { x: number; y: number; vx: number; vy: number; r: number; vr: number; bounces: number; t: number };
type Pop = { text: string; x: number; y: number; age: number; color: string };

const BEST_KEY = "uli-gafas-record";
const readBest = () => { try { return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch { return 0; } };
const saveBest = (v: number) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch {} };

export function mountUli({ canvas: cv, stage }: Els, opts: Opts) {
  const ctx = cv.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let U = 4;
  const imgs: Partial<Record<(typeof SPRITES)[number], HTMLImageElement>> = {};

  // ---------------------------------------------------------------- sonido
  let ac: AudioContext | null = null;
  let soundOn = true;
  function initAudio() {
    if (!ac) { try { ac = new AudioContext(); } catch { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }
  function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (!ac || !soundOn) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const sfx = {
    push() { tone(520, 900, 0.07, "square", 0.04); },
    casi() { tone(420, 520, 0.06, "square", 0.03); },
    ouch() { tone(320, 110, 0.2, "sawtooth", 0.05); },
    hic() { tone(700, 1500, 0.09, "sine", 0.09); },
    glug() { [0, 0.11, 0.22].forEach((d) => tone(210, 120, 0.09, "sine", 0.1, d)); },
    fall() { tone(900, 160, 0.45, "triangle", 0.07); tone(95, 60, 0.18, "square", 0.07, 0.5); },
  };

  // ---------------------------------------------------------------- fondo
  function layer(paint: (px: (x: number, y: number, w: number, h: number, col: string) => void) => void) {
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const g = c.getContext("2d")!;
    paint((x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
    return c;
  }
  const BG = layer((px) => {
    for (let ty = 0; ty < 64; ty += 8) {
      for (let tx = 0; tx < S; tx += 8) {
        const alt = ((tx + ty) / 8) % 2 === 0;
        px(tx, ty, 8, 8, alt ? "#1d3b33" : "#19342d");
        px(tx, ty, 8, 1, "#12271f");
        px(tx, ty, 1, 8, "#12271f");
        px(tx + 2, ty + 2, 2, 1, alt ? "#27493f" : "#214238");
      }
    }
    px(0, 62, S, 2, "#6e4428");
    px(0, 64, S, 16, "#3a2317");
    for (let x = 6; x < S; x += 12) px(x, 64, 1, 16, "#2c1a11");
    const shelf = (x: number, w: number) => { px(x, 20, w, 2, "#6b4228"); px(x, 20, w, 1, "#8a5a36"); px(x, 22, w, 1, "#2c1a11"); };
    shelf(1, 30); shelf(65, 30);
    const bottle = (x: number, h: number, col: string, hi: string) => {
      const top = 20 - h;
      px(x + 1, top, 2, 1, "#1a1a1a");
      px(x + 1, top + 1, 2, 4, col);
      px(x, top + 5, 4, h - 5, col);
      px(x + 1, top + 6, 1, h - 8, hi);
      px(x, top + 8, 4, 2, "rgba(246,234,210,0.55)");
    };
    ([[3, 13, "#2f6b3a", "#4f9a5c"], [8, 15, "#7a2430", "#a8404c"], [13, 11, "#c98a2b", "#e8b457"], [18, 14, "#3d5f7a", "#6187a6"], [24, 12, "#8f6a2a", "#b88f47"],
      [67, 12, "#c98a2b", "#e8b457"], [72, 15, "#2f6b3a", "#4f9a5c"], [77, 13, "#cfc8b5", "#f1ecdf"], [82, 11, "#7a2430", "#a8404c"], [87, 14, "#3d5f7a", "#6187a6"]] as const)
      .forEach(([x, h, c, hi]) => bottle(x, h, c, hi));
    px(47, 0, 2, 5, "#0c0c0c");
    px(44, 5, 8, 1, "#b67a2c"); px(43, 6, 10, 1, "#d69339"); px(42, 7, 12, 1, "#e8a746"); px(41, 8, 14, 1, "#f2b35e");
    px(42, 9, 12, 1, "#fff3c4");
  });
  const FG = layer((px) => {
    px(0, COUNTER_Y, S, 1, "#dfe6e2");
    px(0, COUNTER_Y + 1, S, 2, "#9fa9a5");
    px(0, COUNTER_Y + 3, S, 1, "#6e4428");
    px(0, COUNTER_Y + 4, S, 12, "#5a3620");
    for (let x = 4; x < S; x += 11) px(x, COUNTER_Y + 4, 1, 12, "#482a18");
    px(10, 81, 15, 1, "rgba(0,0,0,0.25)");
    px(10, 78, 14, 1, "#f3eee2");
    px(8, 79, 18, 1, "#f3eee2");
    px(8, 79, 1, 1, "#cfc6b3"); px(25, 79, 1, 1, "#cfc6b3");
    px(9, 80, 16, 1, "#d6cdb9");
    const oliva = (x: number, y: number) => { px(x, y, 3, 2, "#6f8a2e"); px(x, y + 1, 3, 1, "#4c6020"); px(x, y, 1, 1, "#a7c05a"); };
    [[11, 76], [14, 76], [17, 76], [20, 76], [12, 74], [16, 74]].forEach(([x, y]) => oliva(x, y));
    px(18, 70, 1, 2, "#e3c48d"); px(17, 72, 1, 2, "#e3c48d");
  });

  // ---------------------------------------------------------------- estado
  const st = {
    mode: "intro" as "intro" | "play" | "falling" | "over",
    t: 0, level: 0, dy: 0,
    push: null as { t: number; from: number; to: number } | null,
    strike: null as { phase: "up" | "hold" | "down"; t: number } | null,
    ouch: 0, hicY: 0, hicWait: 0,
    amp: 0, phase: 0,
    pushes: 0, pokes: 0, perfect: 0,
    drink: { phase: "wait", t: 0, fill: 1, gap: 1.6 } as Drink,
    fall: null as Fall | null,
    pops: [] as Pop[],
    best: readBest(),
  };
  function reset() {
    Object.assign(st, {
      mode: "play", t: 0, level: 0, dy: 0, push: null, strike: null, ouch: 0, hicY: 0, hicWait: 1,
      amp: 0, phase: 0, pushes: 0, pokes: 0, perfect: 0, fall: null, pops: [],
      drink: { phase: "wait", t: 0, fill: 1, gap: 1.6 },
    });
  }

  // ---------------------------------------------------------------- tambaleo
  const swayAmp = (L: number) => (L === 0 ? 0 : Math.min(2 + 1.6 * L, 14));
  const swayOmega = (L: number) => (2 * Math.PI) / Math.max(2.6 - 0.12 * L, 1.4);
  function pose() {
    let off = st.amp * Math.sin(st.phase);
    if (st.level >= 5) off += 0.25 * st.amp * Math.sin(st.phase * 2.3 + 1);
    const arm = PIVOT.y - BRIDGE.y;
    const angle = Math.asin(Math.max(-0.9, Math.min(0.9, off / arm)));
    const bob = st.mode === "intro" ? Math.sin(st.t * 2) * 0.3 : 0;
    return { angle, y: st.hicY + bob };
  }
  type Pose = ReturnType<typeof pose>;
  function spriteToScene(p: Pose, sx: number, sy: number): Pt {
    const dx = sx - PIVOT.x, dy = sy - PIVOT.y;
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    return { x: OX + PIVOT.x + dx * c - dy * s, y: OY + PIVOT.y + p.y + dx * s + dy * c };
  }
  const glassesTilt = () => (st.mode === "intro" ? 0 : Math.min(0.012 * st.level, 0.1) * Math.sin(st.t * 1.3));
  const bridgeScene = () => spriteToScene(pose(), BRIDGE.x, BRIDGE.y + st.dy);
  function face() {
    const rub = st.level === 0 ? 0 : st.level <= 2 ? 1 : st.level <= 5 ? 2 : 3;
    if (st.mode === "falling" || st.mode === "over" || st.ouch > 0) return { ojos: "cegato", boca: "ups", rubor: rub } as const;
    if (st.drink.phase === "sip") return { ojos: "feliz", boca: null, rubor: rub } as const;
    if (st.mode === "intro" || st.level === 0) return { ojos: "abiertos", boca: null, rubor: 0 } as const;
    if (st.level <= 2) return { ojos: "feliz", boca: null, rubor: rub } as const;
    return { ojos: "borracho", boca: "borracho", rubor: rub } as const;
  }
  const pop = (text: string, x: number, y: number, color = "#f6ead2") => st.pops.push({ text, x, y, age: 0, color });

  // ---------------------------------------------------------------- el dedo
  function tap() {
    if (st.mode !== "play" || st.strike) return;
    st.strike = { phase: "up", t: 0 };
  }
  function resolveStrike() {
    const off = bridgeScene().x - CENTER_X;
    const k = tier(off);
    if (k === "ojo") {
      st.pokes++;
      st.ouch = 0.7;
      st.dy += 1;
      st.hicY = -1;
      pop("¡Au!", CENTER_X + (off > 0 ? -12 : 12), 42, "#e4574a");
      sfx.ouch();
      return;
    }
    st.pushes++;
    st.push = { t: 0, from: st.dy, to: Math.max(0, st.dy - LIFT[k]) };
    if (k === "casi") { pop("casi", CENTER_X, 44, "#f2b35e"); sfx.casi(); return; }
    if (k === "justo" && st.amp > 3) { st.perfect++; pop("¡Justo!", CENTER_X, 44, "#7cc59a"); }
    sfx.push();
  }
  function updateStrike(dt: number) {
    const s = st.strike;
    if (!s) return;
    s.t += dt;
    if (s.phase === "up" && s.t >= STRIKE.up) {
      if (st.mode === "play") resolveStrike();
      s.phase = "hold"; s.t = 0;
    } else if (s.phase === "hold" && s.t >= STRIKE.hold) {
      s.phase = "down"; s.t = 0;
    } else if (s.phase === "down" && s.t >= STRIKE.down) {
      st.strike = null;
    }
  }
  function fingerTip() {
    const s = st.strike;
    if (!s) return FINGER_IDLE;
    const target = bridgeScene().y + 1;
    const e = (k: number) => 1 - Math.pow(1 - Math.min(1, k), 3);
    if (s.phase === "up") return FINGER_IDLE + (target - FINGER_IDLE) * e(s.t / STRIKE.up);
    if (s.phase === "hold") return target;
    return target + (FINGER_IDLE - target) * e(s.t / STRIKE.down);
  }
  function startFall() {
    const p = pose();
    const c = spriteToScene(p, 24, GAFAS.y + st.dy + 4);
    st.fall = { x: c.x, y: c.y, vx: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6), vy: 6, r: p.angle + glassesTilt(), vr: (Math.random() * 2 - 1) * 5, bounces: 0, t: 0 };
    st.mode = "falling";
    sfx.fall();
  }
  function gameOver() {
    st.mode = "over";
    const nuevo = st.level > st.best && st.level > 0;
    if (nuevo) { st.best = st.level; saveBest(st.best); }
    opts.onOver({ level: st.level, pushes: st.pushes, pokes: st.pokes, perfect: st.perfect, best: st.best, nuevo });
  }

  // ---------------------------------------------------------------- cañas
  function nextPhase(d: Drink) {
    const order = { in: "wait", wait: "lift", lift: "sip", sip: "down", down: "idle", out: "in", idle: "out" } as const;
    d.phase = order[d.phase];
    d.t = 0;
    if (d.phase === "in") d.fill = 1;
    if (d.phase === "idle") d.gap = Math.max(1.4, 3.6 - 0.2 * st.level); // ponytail: ritmo fijo por nivel, sin curva de dificultad configurable
    if (d.phase === "down") {
      st.level++;
      st.dy += 0.8;
      pop("+1 caña", 70, 58, "#f0b43a");
      sfx.glug();
    }
  }
  function updateDrink(dt: number) {
    const d = st.drink;
    d.t += dt;
    if (d.phase === "idle") {
      if (d.t >= d.gap) { d.phase = "out"; d.t = 0; }
      return;
    }
    if (d.phase === "sip") d.fill = Math.max(0, 1 - d.t / DRINK.sip);
    if (d.t >= DRINK[d.phase]) nextPhase(d);
  }
  function glassState() {
    const d = st.drink;
    const e = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    if (st.mode === "intro" || d.phase === "idle") return { ...GLASS_HOME, r: 0, fill: st.mode === "intro" ? 1 : 0, hand: false };
    const k = Math.min(1, d.t / DRINK[d.phase]);
    const p = pose();
    const MOUTH = spriteToScene(p, GLASS_AT_MOUTH.x, GLASS_AT_MOUTH.y);
    const tilt = -0.95 + p.angle;
    switch (d.phase) {
      case "in": return { ...lerp(GLASS_OFF, GLASS_HOME, e(k)), r: 0, fill: 1, hand: false };
      case "wait": return { ...GLASS_HOME, r: 0, fill: 1, hand: false };
      case "lift": return { ...lerp(GLASS_HOME, MOUTH, e(k)), r: tilt * e(k), fill: 1, hand: true };
      case "sip": return { ...MOUTH, r: tilt - 0.08 * Math.sin(d.t * 18), fill: d.fill, hand: true };
      case "down": return { ...lerp(MOUTH, GLASS_HOME, e(k)), r: tilt * (1 - e(k)), fill: 0, hand: true };
      default: return { ...lerp(GLASS_HOME, GLASS_OFF, e(k)), r: 0, fill: 0, hand: false };
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt: number) {
    st.t += dt;
    st.pops.forEach((p) => { p.age += dt; });
    st.pops = st.pops.filter((p) => p.age < 0.9);
    st.ouch = Math.max(0, st.ouch - dt);
    const L = st.mode === "intro" ? 0 : st.level;
    st.amp += (swayAmp(L) - st.amp) * Math.min(1, dt * 1.5);
    st.phase += swayOmega(L) * dt;
    updateStrike(dt);
    st.hicY += (0 - st.hicY) * Math.min(1, dt * 10);
    if (st.mode === "play") {
      updateDrink(dt);
      if (st.push) {
        st.push.t += dt;
        const k = Math.min(1, st.push.t / 0.12);
        st.dy = st.push.from + (st.push.to - st.push.from) * (1 - Math.pow(1 - k, 3));
        if (k >= 1) st.push = null;
      } else {
        const r = 0.28 + 0.15 * st.level;
        st.dy += r * (1 + st.dy / 5) * dt;
      }
      st.hicWait -= dt;
      if (st.level >= 3 && st.hicWait <= 0) {
        const rate = Math.min(0.08 + 0.04 * (st.level - 3), 0.5);
        if (Math.random() < rate * dt) {
          st.dy += 1 + Math.random() * 0.5;
          st.hicY = -2;
          st.hicWait = 1.2;
          pop("¡hic!", 26, 40);
          sfx.hic();
        }
      }
      if (st.dy >= MAX_DY) startFall();
    } else if (st.mode === "falling" && st.fall) {
      const f = st.fall;
      f.t += dt;
      f.vy += 140 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.r += f.vr * dt;
      const floor = COUNTER_Y - 2;
      if (f.y >= floor) {
        f.y = floor;
        if (f.bounces < 2 && Math.abs(f.vy) > 12) {
          f.vy = -f.vy * 0.35; f.vr *= -0.5; f.vx *= 0.6; f.bounces++;
        } else {
          f.vy = 0; f.vx *= 0.85; f.vr = 0;
          f.r += (Math.round(f.r / Math.PI) * Math.PI - f.r) * Math.min(1, dt * 12);
        }
      }
      if (f.t > 1.5) gameOver();
    }
  }

  // ---------------------------------------------------------------- dibujo
  const px = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function drawShirtExtension() {
    px(2, 47, 44, 26, "#2a1812");
    px(3, 47, 42, 26, "#cbe8c0");
    px(23, 47, 2, 26, "#a0cea0");
    px(23, 50, 1, 1, "#f6ead2"); px(23, 56, 1, 1, "#f6ead2");
    const leaf = (x: number, y: number) => { px(x, y, 2, 1, "#43ab8e"); px(x + 1, y + 1, 2, 1, "#1f7a68"); };
    leaf(6, 49); leaf(13, 52); leaf(31, 50); leaf(39, 53);
    px(18, 49, 1, 1, "#f3a84f"); px(35, 48, 1, 1, "#f3a84f");
  }
  function drawHand(tip: number) {
    const x = CENTER_X - 3;
    const y = Math.round(tip);
    px(x - 4, y + 16, 14, S - y, "#15213b");
    px(x - 3, y + 17, 12, S - y, "#2e4577");
    px(x - 3, y + 17, 12, 1, "#dfe6f0");
    px(x - 4, y + 8, 14, 9, "#2a1812");
    px(x - 3, y + 9, 12, 7, "#e7ad86");
    px(x - 3, y + 12, 12, 1, "#c98b6a");
    px(x + 2, y + 9, 1, 3, "#c98b6a"); px(x + 5, y + 9, 1, 3, "#c98b6a");
    px(x - 6, y + 9, 3, 5, "#2a1812"); px(x - 5, y + 10, 2, 3, "#e7ad86");
    px(x + 1, y, 4, 1, "#2a1812");
    px(x, y + 1, 6, 8, "#2a1812");
    px(x + 1, y + 1, 4, 9, "#e7ad86");
    px(x + 1, y + 1, 3, 2, "#fbe1cf");
    px(x + 4, y + 3, 1, 6, "#c98b6a");
  }
  function drawGlass(g: ReturnType<typeof glassState>) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.r);
    ctx.translate(-4, -6);
    px(1, 0, 6, 11, "rgba(225,240,242,0.22)");
    const rows = Math.round(g.fill * 8);
    if (rows > 0) {
      px(1, 11 - rows, 6, rows, "#f0b43a");
      px(2, 11 - rows, 1, rows, "#f8d56a");
      const foam = 11 - rows - 2;
      px(1, foam, 6, 2, "#fffaf0");
      px(1, foam + 1, 6, 1, "#e9dfc9");
    } else {
      px(1, 9, 6, 1, "rgba(255,250,240,0.5)");
    }
    px(0, 0, 1, 12, "rgba(220,238,240,0.9)"); px(7, 0, 1, 12, "rgba(220,238,240,0.9)"); px(0, 11, 8, 1, "rgba(220,238,240,0.9)");
    px(5, 3, 1, 5, "rgba(255,255,255,0.55)");
    if (g.hand) {
      px(6, 3, 5, 6, "#2a1812");
      px(7, 4, 3, 4, "#efb896");
      px(7, 6, 3, 1, "#d9967a");
    }
    ctx.restore();
  }
  function drawLight() {
    const grd = ctx.createRadialGradient(48, 10, 2, 48, 30, 60);
    const flick = reduced ? 1 : 0.92 + 0.08 * Math.sin(st.t * 7.3) * Math.sin(st.t * 3.1);
    grd.addColorStop(0, `rgba(255,214,140,${0.22 * flick})`);
    grd.addColorStop(1, "rgba(255,214,140,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, S, COUNTER_Y);
  }
  // Haz de luz de la lámpara por el centro: marca dónde hay que acertar y se enciende cuando el puente pasa por ahí.
  function drawBeam() {
    if (st.mode !== "play") return;
    const off = Math.abs(bridgeScene().x - CENTER_X);
    const hot = tier(off) !== "ojo" && st.amp > 3;
    px(CENTER_X - 1, 10, 2, COUNTER_Y - 10, hot ? "rgba(124,197,154,0.55)" : "rgba(255,214,140,0.16)");
    if (hot) px(CENTER_X - 3, 10, 6, COUNTER_Y - 10, "rgba(124,197,154,0.14)");
  }
  function drawText(text: string, x: number, y: number, color: string, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#0e1d19";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }
  function drawPops() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 5px ${opts.font}`;
    ctx.lineJoin = "round";
    st.pops.forEach((p) => drawText(p.text, p.x, p.y - p.age * 8, p.color, 1 - p.age / 0.9));
    // pista hasta el primer toque, en lugar de instrucciones
    if (st.mode === "play" && st.pushes + st.pokes === 0 && st.t > 0.8) {
      const a = reduced ? 1 : 0.55 + 0.45 * Math.sin(st.t * 6);
      drawText("¡TOCA!", CENTER_X, 64 + (reduced ? 0 : Math.sin(st.t * 6)), "#f6ead2", a);
    }
  }
  function draw() {
    ctx.setTransform(U, 0, 0, U, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(BG, 0, 0);
    if (!imgs.base) return;
    const p = pose();
    const f = face();
    drawBeam();
    ctx.save();
    ctx.translate(OX + PIVOT.x, OY + PIVOT.y + p.y);
    ctx.rotate(p.angle);
    ctx.translate(-PIVOT.x, -PIVOT.y);
    drawShirtExtension();
    ctx.drawImage(imgs.base, 0, 0);
    if (f.rubor) ctx.drawImage(imgs[`rubor_${f.rubor}`]!, 0, 0);
    ctx.drawImage(imgs[`ojos_${f.ojos}`]!, 0, 0);
    if (f.boca) ctx.drawImage(imgs[`boca_${f.boca}`]!, 0, 0);
    if (!st.fall) {
      const gy = GAFAS.y + st.dy;
      ctx.save();
      ctx.translate(24, gy + 4);
      ctx.rotate(glassesTilt());
      ctx.translate(-24, -(gy + 4));
      ctx.drawImage(imgs.gafas!, GAFAS.x, gy);
      ctx.restore();
    }
    ctx.restore();
    drawLight();
    ctx.drawImage(FG, 0, 0);
    drawGlass(glassState());
    if (st.fall) {
      ctx.save();
      ctx.translate(st.fall.x, st.fall.y);
      ctx.rotate(st.fall.r);
      ctx.drawImage(imgs.gafas!, -GAFAS.w / 2, -GAFAS.h / 2);
      ctx.restore();
    }
    drawHand(fingerTip());
    drawPops();
  }

  // ---------------------------------------------------------------- HUD (solo avisa cuando cambia algo visible)
  let lastHud = "";
  function hud() {
    const frac = Math.min(1, st.fall ? 1 : st.dy / MAX_DY);
    const h: Hud = {
      canas: st.level, best: st.best, nivel: nivelNombre(st.mode === "intro" ? 0 : st.level), frac: Math.round(frac * 50) / 50,
      gafas: st.fall ? "En la barra" : frac < 0.2 ? "En su sitio" : frac < 0.55 ? "Bajando" : frac < 0.8 ? "Mitad de la nariz" : "En la punta",
    };
    const key = JSON.stringify(h);
    if (key !== lastHud) { lastHud = key; opts.onHud(h); }
  }

  // ---------------------------------------------------------------- tamaño, entrada, bucle
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const avail = Math.min(stage.clientWidth, stage.clientHeight);
    const unit = Math.max(1, Math.floor((avail * dpr) / S));
    cv.width = cv.height = unit * S;
    cv.style.width = cv.style.height = (unit * S) / dpr + "px";
    U = unit;
  }
  const onPointer = (ev: PointerEvent) => { if (st.mode === "play") { ev.preventDefault(); tap(); } };
  const onKey = (ev: KeyboardEvent) => {
    if ((ev.key === " " || ev.key === "ArrowUp") && st.mode === "play") { ev.preventDefault(); if (!ev.repeat) tap(); }
  };
  cv.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKey);
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
    hud();
    raf = requestAnimationFrame(frame);
  }
  const loads = SPRITES.map((k) => new Promise<void>((res) => {
    const im = new Image();
    im.onload = () => { imgs[k] = im; res(); };
    im.onerror = () => res();
    im.src = `/game/${k}.png`;
  }));
  Promise.all([...loads, document.fonts.load(`700 10px ${opts.font}`).catch(() => {})]).then(() => { if (!dead) raf = requestAnimationFrame(frame); });

  return {
    start() { initAudio(); reset(); },
    sound(on: boolean) { soundOn = on; if (on) initAudio(); },
    destroy() {
      dead = true; // la carga de sprites puede terminar después del destroy (StrictMode monta dos veces)
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      ac?.close().catch(() => {});
    },
  };
}
