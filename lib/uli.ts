// «Las gafas de Uli»: motor del juego. Canvas de 96x96 "píxeles" escalado por entero.
// Uli bebe cañas y las gafas se le resbalan; el jugador toca para subírselas cuando pasan por el centro.
import { COUNTER_Y, HAND, HANDPRINT, S, SCENES, SLAP, glassesSprite, layer, paintObject, paintShirtExtension, shirtSprite, sprite, type Scene } from "./uli-art.ts";
import type { Look, PowerId, Result } from "./tienda.ts";

const OX = 24, OY = 33;                  // dónde va el sprite de Uli (48x48)
const PIVOT = { x: 24, y: 64 };          // tambaleo desde la cadera, detrás de la barra
const GAFAS = { x: 8, y: 16, w: 32, h: 8 };
const MAX_DY = 6.6;                      // a partir de aquí se caen
const GLASS_HOME = { x: 77, y: 74 };
const GLASS_OFF = { x: 104, y: 74 };
const GLASS_AT_MOUTH = { x: 33, y: 32 };
const WATER_AT_MOUTH = { x: 15, y: 32 }; // el agua entra por el otro lado de la boca
const WATER_OFF = { x: -10, y: 70 };
const CENTER_X = S / 2;                  // el dedo siempre sube por aquí
const BRIDGE = { x: 24, y: 18 };         // puente de las gafas en el sprite
const FINGER_IDLE = 84; // en la escena clásica; con frente de barra debajo, baja lo mismo que el frente
const HAND_X = CENTER_X - 8;             // el centro del índice del sprite HAND cae en CENTER_X
const STRIKE = { up: 0.07, hold: 0.1, down: 0.14 };
const DRINK = { in: 0.45, wait: 0.9, lift: 0.45, sip: 0.8, down: 0.4, out: 0.3 } as const;
const WATER = { in: 0.25, sip: 0.6, out: 0.25 };
const SLAP_T = { in: 0.12, out: 0.2 };     // el golpe es al final de "in"
const COKE_T = 0.8;                      // lo que dura esnifar la raya
const HIGH_T = 12;                       // segundos de subidón (tiempo real)
const HIGH_SPEED = 1.8;                  // ponytail: todo va 1,8 veces más rápido; ajustar si se hace injugable
const MAX_SH = 200;                      // alto máximo de la escena en vertical
const PORTRAIT_MIN_W = 76;               // en vertical se ven entre 76 y 84 de las 96 columnas: Uli sale más grande

const SPRITES = ["base", "rubor_1", "rubor_2", "rubor_3", "ojos_abiertos", "ojos_feliz", "ojos_borracho", "ojos_cegato", "boca_borracho", "boca_ups", "gafas"] as const;

// Acierto según la distancia del puente al centro. El «casi» quita frustración.
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

export type Hud = { canas: number; nivel: string; frac: number; gafas: string; playing: boolean };

type Els = { canvas: HTMLCanvasElement; stage: HTMLElement };
// onRescue: el juego pregunta si queda una raya justo antes de que se caigan las gafas (true = gastada).
type Opts = { font: string; onHud: (h: Hud) => void; onOver: (r: Result) => void; onRescue?: () => boolean };

type Pt = { x: number; y: number };
type Glass = Pt & { r: number; fill: number; hand: boolean };
type Drink = { phase: "in" | "wait" | "lift" | "sip" | "down" | "idle" | "out"; t: number; fill: number; gap: number };
type Fall = { x: number; y: number; vx: number; vy: number; r: number; vr: number; bounces: number; t: number };
type Pop = { text: string; x: number; y: number; age: number; color: string };

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

export function mountUli({ canvas: cv, stage }: Els, opts: Opts) {
  const ctx = cv.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let U = 4;
  const imgs: Partial<Record<(typeof SPRITES)[number], HTMLImageElement>> = {};
  const HAND_C = sprite(HAND);
  const SLAP_C = sprite(SLAP);
  const MARK_C = layer((px) => HANDPRINT.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "x") px(x, y, 1, 1, "#e0413a"); })), 7, 5);

  // ---------------------------------------------------------------- aspecto (camisa, gafas, fondo)
  let look: Look = { camisa: "hawaiana", gafas: "clasicas", fondo: "bar", objeto: "olivas" };
  let SH = S; // alto de la escena en píxeles del juego
  let SB = 0; // frente de barra por debajo de la escena clásica
  let VW = S, CX = 0; // columnas visibles y cuántas se recortan por la izquierda
  let scene: Scene = SCENES.bar(SH, SB);
  let base: CanvasImageSource | null = null;
  let gafas: CanvasImageSource | null = null;
  let shirt: HTMLCanvasElement | null = null;
  let objeto: HTMLCanvasElement | null = null;
  function applyLook() {
    scene = (Object.hasOwn(SCENES, look.fondo) ? SCENES[look.fondo] : SCENES.bar)(SH, SB);
    shirt = layer((px) => paintShirtExtension(px, look.camisa));
    objeto = layer((px) => paintObject(px, look.objeto));
    if (imgs.base) base = shirtSprite(imgs.base, look.camisa);
    if (imgs.gafas) gafas = glassesSprite(imgs.gafas, look.gafas);
  }
  applyLook();

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
  function noise(dur: number, vol: number, delay = 0) {
    if (!ac || !soundOn) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    src.connect(g).connect(ac.destination);
    src.start(ac.currentTime + delay);
  }
  function sniff() {
    if (!ac || !soundOn) return;
    const len = Math.floor(ac.sampleRate * 0.45);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    src.buffer = buf;
    f.type = "bandpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(700, ac.currentTime);
    f.frequency.exponentialRampToValueAtTime(4000, ac.currentTime + 0.4);
    g.gain.value = 0.5;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  }
  const sfx = {
    push() { tone(520, 900, 0.07, "square", 0.04); },
    casi() { tone(420, 520, 0.06, "square", 0.03); },
    ouch() { tone(320, 110, 0.2, "sawtooth", 0.05); },
    hic() { tone(700, 1500, 0.09, "sine", 0.09); },
    glug() { [0, 0.11, 0.22].forEach((d) => tone(210, 120, 0.09, "sine", 0.1, d)); },
    agua() { [0, 0.09, 0.18, 0.27].forEach((d) => tone(620, 980, 0.07, "sine", 0.06, d)); },
    whoosh() { tone(180, 700, 0.11, "triangle", 0.03); },
    plas() { noise(0.14, 0.4); tone(160, 70, 0.12, "square", 0.05); },
    fall() { tone(900, 160, 0.45, "triangle", 0.07); tone(95, 60, 0.18, "square", 0.07, 0.5); },
    sniff() { sniff(); tone(300, 1200, 0.5, "sawtooth", 0.02, 0.35); },
  };

  // ---------------------------------------------------------------- estado
  // level = cañas que lleva (la puntuación). drunk = lo borracho que va (la dificultad): agua y hostias lo bajan.
  const st = {
    mode: "intro" as "intro" | "play" | "falling" | "over",
    t: 0, level: 0, drunk: 0, dy: 0,
    push: null as { t: number; from: number; to: number } | null,
    strike: null as { phase: "up" | "hold" | "down"; t: number } | null,
    ouch: 0, hicY: 0, hicWait: 0,
    amp: 0, phase: 0,
    pushes: 0, pokes: 0, perfect: 0,
    drink: { phase: "wait", t: 0, fill: 1, gap: 1.6 } as Drink,
    water: null as { t: number } | null,
    slap: null as { t: number; hit: boolean } | null,
    shake: 0, jolt: 0, mark: 0,
    coke: null as { t: number } | null, high: 0,
    fall: null as Fall | null,
    pops: [] as Pop[],
  };
  function reset() {
    Object.assign(st, {
      mode: "play", t: 0, level: 0, drunk: 0, dy: 0, push: null, strike: null, ouch: 0, hicY: 0, hicWait: 1,
      amp: 0, phase: 0, pushes: 0, pokes: 0, perfect: 0, water: null, slap: null, shake: 0, jolt: 0, mark: 0, coke: null, high: 0, fall: null, pops: [],
      drink: { phase: "wait", t: 0, fill: 1, gap: 1.6 },
    });
  }

  // ---------------------------------------------------------------- tambaleo
  const swayAmp = (L: number) => (L === 0 ? 0 : Math.min(2 + 1.6 * L, 14));
  const swayOmega = (L: number) => (2 * Math.PI) / Math.max(2.6 - 0.12 * L, 1.4);
  function pose() {
    let off = st.amp * Math.sin(st.phase);
    if (st.drunk >= 5) off += 0.25 * st.amp * Math.sin(st.phase * 2.3 + 1);
    const arm = PIVOT.y - BRIDGE.y;
    const angle = Math.asin(Math.max(-0.9, Math.min(0.9, off / arm)));
    const bob = st.mode === "intro" ? Math.sin(st.t * 2) * 0.3 : 0;
    return { angle: angle + st.jolt, y: st.hicY + bob }; // jolt: la cara girada por el bofetón
  }
  type Pose = ReturnType<typeof pose>;
  function spriteToScene(p: Pose, sx: number, sy: number): Pt {
    const dx = sx - PIVOT.x, dy = sy - PIVOT.y;
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    return { x: OX + PIVOT.x + dx * c - dy * s, y: OY + PIVOT.y + p.y + dx * s + dy * c };
  }
  const glassesTilt = () => (st.mode === "intro" ? 0 : Math.min(0.012 * st.drunk, 0.1) * Math.sin(st.t * 1.3));
  const bridgeScene = () => spriteToScene(pose(), BRIDGE.x, BRIDGE.y + st.dy);
  function face() {
    const d = st.drunk;
    const rub = d === 0 ? 0 : d <= 2 ? 1 : d <= 5 ? 2 : 3;
    if (st.mode === "falling" || st.mode === "over" || st.ouch > 0) return { ojos: "cegato", boca: "ups", rubor: rub } as const;
    if (st.high > 0) return { ojos: "abiertos", boca: null, rubor: 0 } as const; // subidón: ojos como platos
    if (st.drink.phase === "sip" || st.water) return { ojos: "feliz", boca: null, rubor: rub } as const;
    if (st.mode === "intro" || d === 0) return { ojos: "abiertos", boca: null, rubor: rub } as const;
    if (d <= 2) return { ojos: "feliz", boca: null, rubor: rub } as const;
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
    if (!s) return FINGER_IDLE + SB;
    const target = bridgeScene().y + 1;
    const e = (k: number) => 1 - Math.pow(1 - Math.min(1, k), 3);
    const idle = FINGER_IDLE + SB;
    if (s.phase === "up") return idle + (target - idle) * e(s.t / STRIKE.up);
    if (s.phase === "hold") return target;
    return target + (idle - target) * e(s.t / STRIKE.down);
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
    st.high = 0; // si se cayeron en pleno subidón, se acaba con la partida
    opts.onOver({ level: st.level, pushes: st.pushes, pokes: st.pokes, perfect: st.perfect });
  }

  // ---------------------------------------------------------------- power-ups
  function power(id: PowerId) {
    if (st.mode !== "play") return false;
    if (id === "agua") {
      if (st.water) return false;
      st.water = { t: 0 };
      st.drunk = Math.max(0, st.drunk - 2);
      pop("¡AGUA!", 22, 40, "#6fc3ff");
      sfx.agua();
      return true;
    }
    if (st.slap) return false;
    st.slap = { t: 0, hit: false };
    sfx.whoosh();
    return true;
  }
  // La raya: salta sola justo cuando se iban a caer las gafas. Sobrio de golpe y el juego acelera un rato.
  function snort() {
    st.coke = { t: 0 };
    st.drunk = 0;
    st.high = HIGH_T;
    st.push = { t: 0, from: st.dy, to: 0 };
    st.hicY = 3;
    st.shake = 0.2;
    pop("¡SNIFF!", 48, 40, "#ffffff");
    sfx.sniff();
  }
  function slapHit() {
    st.push = { t: 0, from: st.dy, to: 0 };
    st.drunk = Math.max(0, st.drunk - 1);
    st.amp *= 0.25;   // se le quita el tambaleo un rato; vuelve solo según lo borracho que vaya
    st.ouch = 0.6;
    st.shake = 0.25;
    st.jolt = -0.35;
    st.mark = 2.2;
    st.hicY = -2;
    pop("¡PLAS!", 66, 44, "#e4574a");
    sfx.plas();
  }
  function updatePowers(dt: number) {
    if (st.water) {
      st.water.t += dt;
      if (st.water.t >= WATER.in + WATER.sip + WATER.out) st.water = null;
    }
    if (st.slap) {
      st.slap.t += dt;
      if (!st.slap.hit && st.slap.t >= SLAP_T.in) { st.slap.hit = true; if (st.mode === "play") slapHit(); }
      if (st.slap.t >= SLAP_T.in + SLAP_T.out) st.slap = null;
    }
    st.shake = Math.max(0, st.shake - dt);
    st.mark = Math.max(0, st.mark - dt);
    if (st.coke && (st.coke.t += dt) >= COKE_T) st.coke = null;
    st.jolt += (0 - st.jolt) * Math.min(1, dt * 7);
  }

  // ---------------------------------------------------------------- cañas
  function nextPhase(d: Drink) {
    const order = { in: "wait", wait: "lift", lift: "sip", sip: "down", down: "idle", out: "in", idle: "out" } as const;
    d.phase = order[d.phase];
    d.t = 0;
    if (d.phase === "in") d.fill = 1;
    if (d.phase === "idle") d.gap = Math.max(1.4, 3.6 - 0.2 * st.level); // ponytail: ritmo fijo por caña, sin curva de dificultad configurable
    if (d.phase === "down") {
      st.level++;
      st.drunk++;
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
  function glassState(): Glass {
    const d = st.drink;
    if (st.mode === "intro" || d.phase === "idle") return { ...GLASS_HOME, r: 0, fill: st.mode === "intro" ? 1 : 0, hand: false };
    const k = Math.min(1, d.t / DRINK[d.phase]);
    const p = pose();
    const MOUTH = spriteToScene(p, GLASS_AT_MOUTH.x, GLASS_AT_MOUTH.y);
    const tilt = -0.95 + p.angle;
    switch (d.phase) {
      case "in": return { ...lerp(GLASS_OFF, GLASS_HOME, ease(k)), r: 0, fill: 1, hand: false };
      case "wait": return { ...GLASS_HOME, r: 0, fill: 1, hand: false };
      case "lift": return { ...lerp(GLASS_HOME, MOUTH, ease(k)), r: tilt * ease(k), fill: 1, hand: true };
      case "sip": return { ...MOUTH, r: tilt - 0.08 * Math.sin(d.t * 18), fill: d.fill, hand: true };
      case "down": return { ...lerp(MOUTH, GLASS_HOME, ease(k)), r: tilt * (1 - ease(k)), fill: 0, hand: true };
      default: return { ...lerp(GLASS_HOME, GLASS_OFF, ease(k)), r: 0, fill: 0, hand: false };
    }
  }
  function waterState(): Glass | null {
    const w = st.water;
    if (!w) return null;
    const p = pose();
    const M = spriteToScene(p, WATER_AT_MOUTH.x, WATER_AT_MOUTH.y);
    const tilt = 0.95 + p.angle;
    if (w.t < WATER.in) { const k = ease(w.t / WATER.in); return { ...lerp(WATER_OFF, M, k), r: tilt * k, fill: 1, hand: true }; }
    if (w.t < WATER.in + WATER.sip) {
      const k = (w.t - WATER.in) / WATER.sip;
      return { ...M, r: tilt + 0.08 * Math.sin(w.t * 18), fill: 1 - k, hand: true };
    }
    const k = ease(Math.min(1, (w.t - WATER.in - WATER.sip) / WATER.out));
    return { ...lerp(M, WATER_OFF, k), r: tilt * (1 - k), fill: 0, hand: true };
  }

  // ---------------------------------------------------------------- update
  function update(dt: number) {
    st.t += dt;
    st.pops.forEach((p) => { p.age += dt; });
    st.pops = st.pops.filter((p) => p.age < 0.9);
    st.ouch = Math.max(0, st.ouch - dt);
    const L = st.mode === "intro" ? 0 : st.drunk;
    st.amp += (swayAmp(L) - st.amp) * Math.min(1, dt * 1.5);
    st.phase += swayOmega(L) * dt;
    updateStrike(dt);
    updatePowers(dt);
    st.hicY += (0 - st.hicY) * Math.min(1, dt * 10);
    if (st.mode === "play") {
      updateDrink(dt);
      if (st.push) {
        st.push.t += dt;
        const k = Math.min(1, st.push.t / 0.12);
        st.dy = st.push.from + (st.push.to - st.push.from) * (1 - Math.pow(1 - k, 3));
        if (k >= 1) st.push = null;
      } else {
        const r = 0.28 + 0.15 * st.drunk;
        st.dy += r * (1 + st.dy / 5) * dt;
      }
      st.hicWait -= dt;
      if (st.drunk >= 3 && st.hicWait <= 0) {
        const rate = Math.min(0.08 + 0.04 * (st.drunk - 3), 0.5);
        if (Math.random() < rate * dt) {
          st.dy += 1 + Math.random() * 0.5;
          st.hicY = -2;
          st.hicWait = 1.2;
          pop("¡hic!", 26, 40);
          sfx.hic();
        }
      }
      // si la hostia ya va de camino, se le perdona la caída: llega antes de que toquen la barra
      if (st.dy >= MAX_DY && !(st.slap && !st.slap.hit)) {
        if (opts.onRescue?.()) snort();
        else startFall();
      }
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
  function drawHand(tip: number) {
    const y = Math.round(tip);
    const end = y + HAND.length;
    px(HAND_X + 3, end, 14, S + SB - end, "#2a1812"); // la manga sigue hasta abajo
    px(HAND_X + 4, end, 12, S + SB - end, "#2e4577");
    ctx.drawImage(HAND_C, HAND_X, y);
  }
  // Bofetón: la mano abierta baja en arco desde arriba a la derecha, acelerando, y se retira tras el golpe.
  function drawSlap() {
    const s = st.slap;
    if (!s) return;
    const hit = spriteToScene(pose(), 34, 26); // el moflete derecho
    const from = { x: 124, y: hit.y - 28 }, back = { x: 124, y: hit.y + 16 };
    const going = s.t < SLAP_T.in;
    const k = going ? (s.t / SLAP_T.in) ** 2 : ease(Math.min(1, (s.t - SLAP_T.in) / SLAP_T.out));
    const c = going ? lerp(from, hit, k) : lerp(hit, back, k);
    const r = going ? -0.9 + 0.65 * k : -0.25 + 0.55 * k;
    if (going) [-5, 0, 5].forEach((dy, i) => px(Math.round(c.x + 9), Math.round(c.y + dy), i === 1 ? 14 : 9, 1, "rgba(246,234,210,0.7)"));
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y));
    ctx.rotate(r);
    const ox = -8, oy = -10; // el centro de la palma queda en el origen
    px(ox + 4, oy + SLAP.length, 9, 40, "#2a1812"); // la manga sigue hacia abajo
    px(ox + 5, oy + SLAP.length, 7, 40, "#2e4577");
    ctx.drawImage(SLAP_C, ox, oy);
    ctx.restore();
  }
  function drawGlass(g: Glass, water = false) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.r);
    if (water) ctx.scale(-1, 1); // vaso de agua en espejo: la mano va por la izquierda
    ctx.translate(-4, -6);
    px(1, 0, 6, 11, "rgba(225,240,242,0.22)");
    const rows = Math.round(g.fill * 8);
    if (rows > 0) {
      px(1, 11 - rows, 6, rows, water ? "#7cc8ff" : "#f0b43a");
      px(2, 11 - rows, 1, rows, water ? "#c9ecff" : "#f8d56a");
      if (water) px(1, 11 - rows, 6, 1, "#e6f6ff");
      else {
        const foam = 11 - rows - 2;
        px(1, foam, 6, 2, "#fffaf0");
        px(1, foam + 1, 6, 1, "#e9dfc9");
      }
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
  // La raya sobre un espejito en la barra, delante de Uli: desaparece de izquierda a derecha mientras la esnifa.
  function drawCoke() {
    if (!st.coke) return;
    px(33, COUNTER_Y - 4, 30, 5, "#9aa4b2");
    px(34, COUNTER_Y - 3, 28, 3, "#1c1f2a");
    const gone = Math.round(Math.min(1, Math.max(0, (st.coke.t - 0.1) / 0.5)) * 24);
    if (gone < 24) px(36 + gone, COUNTER_Y - 2, 24 - gone, 1, "#ffffff");
  }
  // Subidón: el marco late en blanco mientras dura.
  function drawHigh() {
    if (st.high <= 0) return;
    const a = (reduced ? 0.5 : 0.35 + 0.35 * Math.sin(st.t * 14)) * Math.min(1, st.high);
    ctx.setTransform(U, 0, 0, U, 0, 0);
    px(0, 0, VW, 2, `rgba(255,255,255,${a})`); px(0, SH - 2, VW, 2, `rgba(255,255,255,${a})`);
    px(0, 0, 2, SH, `rgba(255,255,255,${a})`); px(VW - 2, 0, 2, SH, `rgba(255,255,255,${a})`);
    px(0, 0, VW, SH, `rgba(255,255,255,${a * 0.08})`);
  }
  // Haz de luz por el centro: marca dónde hay que acertar y se enciende cuando el puente pasa por ahí.
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const shake = st.shake > 0 && !reduced;
    const sx = shake ? Math.round(Math.random() * 2 - 1) : 0, sy = shake ? Math.round(Math.random() * 2 - 1) : 0;
    ctx.setTransform(U, 0, 0, U, (sx - CX) * U, sy * U);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene.bg, 0, 0);
    ctx.translate(0, SH - S - SB); // de aquí en adelante, coordenadas de la escena clásica
    if (!base || !gafas || !shirt || !objeto) return;
    const p = pose();
    const f = face();
    drawBeam();
    ctx.save();
    ctx.translate(OX + PIVOT.x, OY + PIVOT.y + p.y);
    ctx.rotate(p.angle);
    ctx.translate(-PIVOT.x, -PIVOT.y);
    ctx.drawImage(shirt, 0, 0);
    ctx.drawImage(base, 0, 0);
    if (f.rubor) ctx.drawImage(imgs[`rubor_${f.rubor}`]!, 0, 0);
    ctx.drawImage(imgs[`ojos_${f.ojos}`]!, 0, 0);
    if (f.boca) ctx.drawImage(imgs[`boca_${f.boca}`]!, 0, 0);
    if (st.mark > 0) {
      ctx.globalAlpha = Math.min(1, st.mark / 0.8) * 0.85;
      ctx.drawImage(MARK_C, HANDPRINT.x, HANDPRINT.y);
      ctx.globalAlpha = 1;
    }
    if (!st.fall) {
      const gy = GAFAS.y + st.dy;
      ctx.save();
      ctx.translate(24, gy + 4);
      ctx.rotate(glassesTilt());
      ctx.translate(-24, -(gy + 4));
      ctx.drawImage(gafas, GAFAS.x, gy);
      ctx.restore();
    }
    ctx.restore();
    scene.light(ctx, st.t, reduced);
    ctx.drawImage(scene.fg, 0, 0);
    ctx.drawImage(objeto, 0, 0);
    drawCoke();
    drawGlass(glassState());
    const w = waterState();
    if (w) drawGlass(w, true);
    if (st.fall) {
      ctx.save();
      ctx.translate(st.fall.x, st.fall.y);
      ctx.rotate(st.fall.r);
      ctx.drawImage(gafas, -GAFAS.w / 2, -GAFAS.h / 2);
      ctx.restore();
    }
    drawHand(fingerTip());
    drawSlap();
    drawPops();
    drawHigh();
  }

  // ---------------------------------------------------------------- HUD (solo avisa cuando cambia algo visible)
  let lastHud = "";
  function hud() {
    const frac = Math.min(1, st.fall ? 1 : st.dy / MAX_DY);
    const h: Hud = {
      canas: st.level, nivel: st.high > 0 ? "¡A tope!" : nivelNombre(st.mode === "intro" ? 0 : st.drunk), frac: Math.round(frac * 50) / 50, playing: st.mode === "play",
      gafas: st.fall ? "En la barra" : frac < 0.2 ? "En su sitio" : frac < 0.55 ? "Bajando" : frac < 0.8 ? "Mitad de la nariz" : "En la punta",
    };
    const key = JSON.stringify(h);
    if (key !== lastHud) { lastHud = key; opts.onHud(h); }
  }

  // ---------------------------------------------------------------- tamaño, entrada, bucle
  // Escala por entero. En vertical se recortan los lados (las columnas justas para llenar el ancho, 76 como mínimo)
  // y el alto se estira con la pantalla; lo que sobra se reparte entre pared arriba y frente de barra abajo.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth * dpr, h = stage.clientHeight * dpr;
    const portrait = w / h < 0.8;
    const unit = Math.max(1, Math.floor(portrait ? w / PORTRAIT_MIN_W : Math.min(w, h) / S));
    VW = portrait ? Math.min(S, Math.floor(w / unit)) : S;
    CX = Math.floor((S - VW) / 2);
    const rows = Math.max(S, Math.min(MAX_SH, Math.floor(h / unit)));
    cv.width = unit * VW;
    cv.height = unit * rows;
    cv.style.width = (unit * VW) / dpr + "px";
    cv.style.height = (unit * rows) / dpr + "px";
    U = unit;
    if (rows !== SH) {
      SH = rows;
      SB = Math.min(36, Math.round((rows - S) * 0.42));
      applyLook();
    }
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
    st.high = Math.max(0, st.high - dt); // el subidón se mide en tiempo real
    update(st.high > 0 ? dt * HIGH_SPEED : dt);
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
  Promise.all([...loads, document.fonts.load(`700 10px ${opts.font}`).catch(() => {})]).then(() => {
    if (dead) return;
    applyLook();
    raf = requestAnimationFrame(frame);
  });

  return {
    start() { initAudio(); reset(); },
    menu() { reset(); st.mode = "intro"; },
    sound(on: boolean) { soundOn = on; if (on) initAudio(); },
    setLook(l: Look) { look = l; applyLook(); },
    power,
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
