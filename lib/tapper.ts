// «Tapper de la despe»: el camarero (Uli o quien elijas) sirve cañas en cuatro barras. Los colegas entran por la
// puerta de la izquierda y van hacia los grifos; cada caña que pillan los empuja hacia la puerta. Si salen, servidos;
// si no, se la beben y devuelven la jarra vacía, que hay que recoger. Jarra rota, caña al suelo o colega que llega al
// grifo: una vida menos. Toca una barra para ir a ella; toca la barra en la que estás para servir.
import { createAudio } from "./audio.ts";
import { PJS, SPR, paint, type Pj, type SprName } from "./chicle-art.ts";
import { cyrillic, garble } from "./chicle.ts";
import { layer } from "./uli-art.ts";

export type TapRun = { score: number; served: number; tips: number; wave: number };

// ---------------------------------------------------------------- piezas puras (con test)
// Chicles para la tienda compartida. Una partida normal (1.000-2.000 puntos) da 40-80.
export function tapReward(r: TapRun, nuevo: boolean) {
  return Math.floor(r.score / 25) + r.tips * 5 + (nuevo ? 25 : 0);
}
// Cada ronda, un poco más de todo en línea recta y con tope: clientes, llegadas por segundo, parejas y prisa.
// Medida con tools/tapper-sim.mjs: un jugador normal pierde vida en el 10-20 % de las primeras rondas, la cosa
// se pone seria hacia la 7 y cierra hacia la 9; uno torpe, hacia la 7; uno bueno, hacia la 14.
export function ronda(n: number) {
  const pares = Math.min(0.5, 0.07 * (n - 1));
  const ritmo = Math.min(2.2, 0.55 + 0.12 * (n - 1)); // clientes por segundo
  return { clientes: 4 + n, cada: (1 + pares) / ritmo, pares, prisa: Math.min(1.8, 1 + 0.07 * (n - 1)) };
}
// Barra tocada según la altura del toque dentro del campo de juego.
export function barAt(y: number, top: number, rowH: number, bars = 4) {
  return Math.max(0, Math.min(bars - 1, Math.floor((y - top) / rowH)));
}

// ---------------------------------------------------------------- reglas
// Más ancho que Flappy: con muñecos de 20 píxeles, las barras tienen que ser largas para que dé tiempo a servir.
const MIN_W = 210, MAX_W = 260, MIN_H = 300, MAX_H = 460;
const HUD = 34, BARS = 4, TOP = 8;
const DOOR = 12;                         // la puerta de cada barra, a la izquierda
const WALK = 15;                         // px/s de un cliente normal en la primera ronda
const V = { full: 100, empty: 55, push: 85 };
const PUSH = 50;                         // lo que retrocede un cliente al pillar la caña: lejos de la puerta, hacen falta varias
const DRINK = 1.1, LIVES = 3;
const HARTO = 3; // a la tercera caña se van al baño, estén donde estén: si no, los que apenas retroceden no se iban nunca
// La manía de cada uno: prisa (velocidad) y empuje (cuánto retrocede con cada caña).
const MANIAS: Record<Pj, { prisa: number; empuje: number }> = {
  uli: { prisa: 0.9, empuje: 0.5 },     // el novio: le cuesta irse
  gon: { prisa: 1, empuje: 1 },         // pide en cirílico
  marcos: { prisa: 0.75, empuje: 1.1 }, // tranquilo, con su arpa
  hugo: { prisa: 1, empuje: 1 },        // deja propina en la barra
  arro: { prisa: 1, empuje: 0.55 },     // se queda hablando: apenas retrocede
  javi: { prisa: 1.05, empuje: 1 },     // pide con el brazo en alto
  moreno: { prisa: 1.1, empuje: 1 },    // su novia tira de la correa de vez en cuando (solo de broma: no le mueve)
  sanlle: { prisa: 1.5, empuje: 0.7 },  // el gorila va a toda leche
  ricky: { prisa: 1, empuje: 1.2 },     // no se le ve detrás de la barra
  sergio: { prisa: 0.85, empuje: 1 },   // pide de comer: va despacio porque no suelta el bocata
};
const GON = {
  ronda: ["¡Ronda {r}!", "¡Ronda {r}, que no pare!", "¡Ronda {r}! ¡Asquerosa!"],
  vida: ["¡Se ha roto una jarra!", "¡{n}, espabila!", "¡Ojo con la barra!"],
  pide: ["¡Una caña!", "¡Otra!", "¡Vodka no, caña!", "¡Ponme una!"],
  fin: ["¡Cerramos!", "¡{n}, a la calle!", "¡Mañana más!"],
};
const BLA = ["BLA BLA BLA", "HE DEJADO DE FUMAR", "Y ESCUCHA...", "PUES NADA", "OTRA COSA", "¿ME SIGUES?"];
const HAMBRE = ["¡UN BOCATA!", "¿HAY PINTXOS?", "¿Y DE COMER?", "¡CAÑA Y BOCATA!"];

type Opts = { font: string; textFont: string; onOver: (r: TapRun) => void };
type Cust = {
  id: Pj; bar: number; x: number; st: "walk" | "push" | "drink" | "out";
  t: number; to: number; tug: number; jerk: number; say: string | null; sayT: number; n: number; bebidas: number;
};
type Mug = { bar: number; x: number; full: boolean };
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string };
type Pop = { text: string; x: number; y: number; age: number; color: string };

export function mountTapper({ canvas: cv, stage }: { canvas: HTMLCanvasElement; stage: HTMLElement }, opts: Opts) {
  const ctx = cv.getContext("2d")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let U = 4, VW = 160, H = 280, PH = H - HUD, rowH = 60;
  const counterY = (bar: number) => TOP + (bar + 1) * rowH - 14; // arriba de la barra
  const TAP = () => VW - 34;                                         // donde sale y vuelve la jarra
  const BARMAN = () => VW - 14;                                      // el camarero, a la derecha del grifo

  // ---------------------------------------------------------------- sprites
  const IMG = Object.fromEntries(Object.entries(SPR).map(([k, d]) => [k, paint(d)])) as Record<SprName, HTMLCanvasElement>;
  const GON_FACE = paint({ rows: SPR.gon.rows.slice(0, 20), pal: SPR.gon.pal });
  const NAME = Object.fromEntries(PJS.map((p) => [p.id, p.name])) as Record<Pj, string>;
  // De pie detrás de la barra: el gorila en su postura de suelo.
  const standing = (id: Pj) => (id === "sanlle" ? IMG.sanlle_kick : IMG[id]);
  // Todos con los pies a la misma altura, escondidos tras la barra: según lo alto que sea cada uno, asoma más o menos.
  // Ricky, que es bajito, apenas saca la calva.
  const topOf = (id: Pj, cy: number) => (id === "ricky" ? cy - 8 : cy + 9 - standing(id).height);
  let best = 0;

  // ---------------------------------------------------------------- fondo: el bar de la despedida, barra a barra
  // Cada barra tiene su viga, su pared de azulejos, su lámpara y su decoración, siempre por encima de las cabezas.
  const ULI_FOTO = paint({ rows: SPR.uli.rows.slice(0, 20), pal: SPR.uli.pal });
  const zone = (i: number) => { // hueco libre entre la viga y las cabezas de la barra i
    const r = TOP + i * rowH, top = r + 11;
    return { r, top, h: Math.max(0, counterY(i) - 30 - top) };
  };
  const bottle = (P: (x: number, y: number, w: number, h: number, c: string) => void, x: number, base: number, bh: number, col: string, hi: string) => {
    const top = base - bh;
    P(x + 2, top, 2, 2, "#1a1a1a"); P(x + 2, top + 2, 2, 4, col); P(x + 1, top + 6, 4, 1, col);
    P(x, top + 7, 6, bh - 7, col); P(x + 1, top + 8, 1, Math.max(1, bh - 10), hi); P(x, top + 10, 6, 2, "rgba(246,234,210,0.55)");
  };
  const BOTTLES = [["#2f6b3a", "#4f9a5c"], ["#7a2430", "#a8404c"], ["#c98a2b", "#e8b457"], ["#3d5f7a", "#6187a6"], ["#cfc8b5", "#f1ecdf"], ["#8f6a2a", "#b88f47"]] as const;
  function paintBg() {
    const c = layer(() => {}, VW, PH);
    const g = c.getContext("2d")!;
    const P = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const mid = Math.round(VW / 2), L = 20, R = VW - 42; // la lámpara va en medio; la decoración, a los lados
    for (let i = 0; i < BARS; i++) {
      const { r, top, h } = zone(i);
      const bottom = i === BARS - 1 ? PH : r + rowH;
      for (let y = r, j = 0; y < bottom; y += 10, j++) for (let x = 0, k = 0; x < VW; x += 10, k++) {
        const alt = (j + k) % 2 === 0;
        P(x, y, 10, 10, alt ? "#1d3b33" : "#19342d"); P(x, y, 10, 1, "#12271f"); P(x, y, 1, 10, "#12271f");
        P(x + 2, y + 2, 3, 1, alt ? "#27493f" : "#214238");
      }
      // lámpara colgando de la viga, con su luz cálida
      const glow = g.createRadialGradient(mid, r + 9, 1, mid, r + 9, rowH * 0.75);
      glow.addColorStop(0, "rgba(255,214,140,0.26)");
      glow.addColorStop(1, "rgba(255,214,140,0)");
      g.fillStyle = glow;
      g.fillRect(0, r, VW, rowH);
      P(0, r, VW, 3, "#2c1a11"); P(0, r + 2, VW, 1, "#6e4428"); // viga: el suelo de la barra de arriba
      P(mid, r + 3, 1, 3, "#0c0c0c"); P(mid - 4, r + 6, 9, 2, "#b67a2c"); P(mid - 5, r + 8, 11, 1, "#f2b35e"); P(mid - 3, r + 9, 7, 1, "#fff3c4");
      if (h < 14) continue; // pantalla muy baja: sin decoración
      const dh = Math.min(h, 30);
      if (i === 0) { // banderines de fiesta de punta a punta (el cartel de «¡asquerosa!» se pinta encima, con letra)
        for (let x = 0; x < VW; x++) P(x, Math.round(r + 5 + 4 * Math.sin((Math.PI * x) / VW)), 1, 1, "#e9e4d8");
        ["#ff6fb4", "#00aff0", "#f2b35e", "#f6ead2"].forEach((col, n) => {
          for (let x = 4 + n * 9; x < VW - 4; x += 36) {
            const y = Math.round(r + 6 + 4 * Math.sin((Math.PI * x) / VW));
            for (let k = 0; k < 4; k++) P(x + k, y + k, 7 - 2 * k, 1, col); // banderín: triángulo hacia abajo
          }
        });
      } else if (i === 1) { // espejo con marco dorado y estante de botellas
        const mw = Math.min(54, mid - 12 - L);
        P(L, top, mw, dh, "#a8761f"); P(L + 2, top + 2, mw - 4, dh - 4, "#8fb4c0");
        for (let k = 0; k < 3; k++) P(L + 6 + k * 9, top + 3, 2, dh - 6, "rgba(255,255,255,0.35)");
        const sy = top + dh - 2;
        P(mid + 10, sy, R - mid - 10, 3, "#6b4228"); P(mid + 10, sy, R - mid - 10, 1, "#8a5a36");
        for (let x = mid + 13, n = 0; x < R - 6; x += 9, n++) {
          const [col, hi] = BOTTLES[n % BOTTLES.length];
          bottle(P, x, sy, Math.min(dh - 2, 13 + ((n * 5) % 7)), col, hi);
        }
      } else if (i === 2) { // letrero de neón (la letra se pinta encima, brillando) y la foto del novio
        P(L, top + 2, Math.min(70, mid - 12 - L), Math.min(dh, 18), "#141018");
        const fx = R - 30, fy = top;
        P(fx, fy, 26, 26, "#a8761f"); P(fx + 1, fy + 1, 24, 24, "#e0b040"); P(fx + 3, fy + 3, 20, 20, "#2a3a44");
        g.drawImage(ULI_FOTO, fx + 3, fy + 3);
        for (const [hx, hy] of [[fx - 9, fy + 4], [fx - 7, fy + 15]]) { P(hx, hy, 2, 2, "#ff6fb4"); P(hx + 3, hy, 2, 2, "#ff6fb4"); P(hx, hy + 1, 5, 2, "#ff6fb4"); P(hx + 1, hy + 3, 3, 1, "#ff6fb4"); P(hx + 2, hy + 4, 1, 1, "#ff6fb4"); }
      } else { // pizarra de la barra libre, el Pilar y una diana
        P(L, top, 56, dh, "#6b4228"); P(L + 3, top + 3, 50, dh - 6, "#24332c");
        const fx = mid + 12, fw = Math.min(44, R - 30 - fx), fh = dh;
        if (fw > 24) {
          P(fx, top, fw, fh, "#6b4228"); P(fx + 2, top + 2, fw - 4, fh - 4, "#f2b35e"); P(fx + 2, top + 2, fw - 4, Math.round(fh / 3), "#f7cf86");
          P(fx + 2, top + fh - 6, fw - 4, 4, "#3d6f8a");
          P(fx + 6, top + fh - 12, fw - 12, 6, "#c9a27a");
          P(fx + 4, top + 5, 3, fh - 11, "#b08a62"); P(fx + fw - 7, top + 5, 3, fh - 11, "#b08a62");
          for (let k = 0; k < 3; k++) P(fx + 10 + k * Math.round((fw - 22) / 2), top + fh - 15, 5, 3, "#3d8a6a");
        }
        const dx = R - 12, dy = top + Math.round(dh / 2), dr = Math.min(10, Math.round(dh / 2) - 1);
        const disc = (rr: number, col: string) => {
          for (let yy = -rr; yy <= rr; yy++) { const w = Math.round(Math.sqrt(rr * rr - yy * yy)); P(dx - w, dy + yy, w * 2 + 1, 1, col); }
        };
        ["#1a1a1a", "#e9e4d8", "#c0302a", "#e9e4d8", "#2f8a3a"].forEach((col, k) => { if (dr - 2 * k > 0) disc(dr - 2 * k, col); }); // diana: anillos
        P(dx, dy, 1, 1, "#c0302a");
        P(dx + 1, dy - 1, 6, 1, "#b8c0cc"); P(dx + 6, dy - 2, 2, 3, "#e4574a"); // un dardo clavado
      }
    }
    return c;
  }
  let bg = paintBg();
  // Las letras van aparte, a resolución de pantalla, para que se lean nítidas.
  function drawDecor() {
    const mid = Math.round(VW / 2), L = 20;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const z0 = zone(0), z2 = zone(2), z3 = zone(3);
    if (z0.h >= 14) { // cartel de «¡asquerosa!»
      ctx.font = `700 8px ${opts.font}`;
      const text = "¡ASQUEROSA!", w = Math.ceil(ctx.measureText(text).width) + 12, y = z0.top + 2;
      px(mid - w / 2 - 1, y - 1, w + 2, 15, "#5a1030"); px(mid - w / 2, y, w, 13, "#f6ead2");
      px(mid - w / 2, y + 11, w, 2, "#e2d6bc");
      ctx.fillStyle = "#c0302a";
      ctx.fillText(text, mid, y + 6.5);
    }
    if (z2.h >= 14) { // neón de OLIFANS, con su parpadeo
      const w = Math.min(70, mid - 12 - L), y = z2.top + 2 + Math.min(z2.h, 18) / 2;
      const on = reduced || Math.sin(st.t * 23) > -0.95;
      ctx.font = `700 9px ${opts.font}`;
      ctx.save();
      ctx.shadowColor = "#ff6fb4";
      ctx.shadowBlur = on ? 5 * U : 0;
      ctx.fillStyle = on ? "#ffd6ea" : "#8a4a68";
      ctx.fillText("OLIFANS", L + w / 2, y + 0.5);
      ctx.restore();
    }
    if (z3.h >= 14) { // la pizarra: barra libre
      const dh = Math.min(z3.h, 30);
      ctx.font = `400 7px ${opts.font}`;
      ctx.fillStyle = "#e9e4d8";
      ctx.fillText("BARRA", L + 28, z3.top + dh / 2 - 4);
      ctx.fillStyle = "#f2b35e";
      ctx.fillText("LIBRE", L + 28, z3.top + dh / 2 + 5);
    }
  }

  // ---------------------------------------------------------------- sonido
  const au = createAudio();
  const { tone, noise } = au;
  const sfx = {
    pour() { [0, 0.06, 0.12].forEach((d) => tone(240, 140, 0.07, "sine", 0.08, d)); },
    slide() { tone(500, 260, 0.12, "triangle", 0.025); },
    catch() { tone(1400, 1900, 0.04, "square", 0.03); },
    clink() { tone(1800, 2600, 0.05, "sine", 0.06); tone(2400, 3200, 0.05, "sine", 0.04, 0.04); },
    served() { [523, 659, 784].forEach((f, i) => tone(f, f * 1.01, 0.12, "square", 0.025, i * 0.07)); },
    cash() { tone(1500, 2400, 0.07, "square", 0.025); tone(2000, 3000, 0.08, "square", 0.025, 0.07); },
    crash() { noise(0.35, 0.45); tone(900, 200, 0.3, "sawtooth", 0.04); },
    tug() { tone(260, 120, 0.12, "sine", 0.1); },
    move() { tone(600, 700, 0.03, "square", 0.015); },
    ronda() { [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.14, "square", 0.03, i * 0.09)); },
    gon() { [0, 0.07, 0.14].forEach((d) => { const f = 260 + Math.random() * 420; tone(f, f * 1.4, 0.05, "square", 0.018, d); }); },
  };

  // ---------------------------------------------------------------- estado
  const st = {
    mode: "intro" as "intro" | "ready" | "play" | "oops" | "clear" | "over",
    t: 0, pj: "uli" as Pj, bar: 1, pour: 0, bob: 0, ko: 0, wait: 0,
    score: 0, served: 0, tips: 0, lives: LIVES, wave: 1, left: 0, next: 0,
    custs: [] as Cust[], mugs: [] as Mug[], cash: [] as Mug[], smoke: [] as Bit[], notes: [] as Bit[], pops: [] as Pop[],
    gon: null as null | { text: string; t: number }, deck: [] as Pj[], seed: 1, shake: 0, n: 0,
  };
  function reset(mode: "intro" | "ready") {
    Object.assign(st, {
      mode, t: 0, bar: 1, pour: 0, bob: 0, ko: 0, wait: 0, score: 0, served: 0, tips: 0, lives: LIVES, wave: 1,
      left: ronda(1).clientes, next: 1, custs: [], mugs: [], cash: [], smoke: [], notes: [], pops: [], gon: null, deck: [], shake: 0,
    });
  }
  reset("intro");
  const pop = (text: string, x: number, y: number, color = "#f6ead2") => st.pops.push({ text, x, y, age: 0, color });
  const fill = (s: string) => s.replaceAll("{n}", NAME[st.pj]).replaceAll("{r}", String(st.wave));
  const drunk = () => Math.min(1, Math.max(0, (st.wave - 2) / 5)); // a partir de la ronda 7 a Gon no hay quien le entienda
  const gonSays = (key: keyof typeof GON) => garble(cyrillic(fill(GON[key][Math.floor(Math.random() * GON[key].length)])), drunk(), st.seed++);
  function say(key: keyof typeof GON) {
    st.gon = { text: gonSays(key), t: 0 };
    sfx.gon();
  }

  // ---------------------------------------------------------------- clientes
  function nextWho(): Pj {
    if (!st.deck.length) st.deck = PJS.map((p) => p.id).filter((id) => id !== st.pj).sort(() => Math.random() - 0.5);
    return st.deck.pop()!;
  }
  function spawn() {
    // a la barra con menos gente, y si empatan, a cualquiera
    const load = [0, 1, 2, 3].map((b) => st.custs.filter((c) => c.bar === b && c.st !== "out").length + Math.random());
    const bar = load.indexOf(Math.min(...load));
    const id = nextWho();
    const c: Cust = { id, bar, x: DOOR + 2, st: "walk", t: Math.random(), to: 0, tug: 3 + Math.random() * 3, jerk: 0, say: null, sayT: 0, n: st.n++, bebidas: 0 };
    if (id === "gon") { c.say = gonSays("pide"); c.sayT = 2.2; }
    if (id === "sergio") { c.say = HAMBRE[Math.floor(Math.random() * HAMBRE.length)]; c.sayT = 2.2; }
    st.custs.push(c);
  }
  const speedOf = (c: Cust) => WALK * ronda(st.wave).prisa * MANIAS[c.id].prisa;
  function loseLife(why: string, x: number, bar: number) {
    if (st.mode !== "play") return;
    st.lives--;
    st.mode = "oops";
    st.wait = 1.4;
    st.ko = 1.4;
    st.shake = 0.35;
    pop(why, x, counterY(bar) - 30, "#e4574a");
    sfx.crash();
    if (st.lives > 0) say("vida");
  }
  // Tras un fallo, las barras se vacían y los clientes vuelven a la puerta.
  function regroup() {
    st.mugs = []; st.cash = [];
    for (const c of st.custs) if (c.st !== "out") { c.st = "walk"; c.x = -10 - Math.random() * 40; }
  }

  // ---------------------------------------------------------------- entrada
  function serve() {
    if (st.pour > 0) return;
    st.pour = 0.22;
    st.bob = 0.12;
    st.mugs.push({ bar: st.bar, x: TAP(), full: true });
    sfx.pour();
    sfx.slide();
  }
  function goTo(bar: number) {
    if (bar === st.bar) return serve();
    st.bar = bar;
    sfx.move();
  }
  function act(bar: number | "up" | "down" | "serve") {
    if (st.mode === "ready") { // el toque de empezar no sirve: aún no hay nadie y la caña se estrellaría
      st.mode = "play";
      say("ronda");
      if (bar === "serve" || bar === st.bar) return;
    }
    if (st.mode !== "play") return;
    if (bar === "serve") serve();
    else if (bar === "up") goTo(Math.max(0, st.bar - 1));
    else if (bar === "down") goTo(Math.min(BARS - 1, st.bar + 1));
    else goTo(bar);
  }

  // ---------------------------------------------------------------- partida
  function update(dt: number) {
    st.t += dt;
    st.shake = Math.max(0, st.shake - dt);
    st.pour = Math.max(0, st.pour - dt);
    st.bob = Math.max(0, st.bob - dt);
    st.ko = Math.max(0, st.ko - dt);
    for (const p of st.pops) p.age += dt;
    st.pops = st.pops.filter((p) => p.age < 1);
    if (st.gon && (st.gon.t += dt) > 3) st.gon = null;
    for (const m of st.smoke) { m.t += dt; m.x += m.vx * dt + Math.sin(m.t * 4 + m.y) * 0.2; m.y += m.vy * dt; }
    st.smoke = st.smoke.filter((m) => m.t < m.life);
    for (const n of st.notes) { n.t += dt; n.x += n.vx * dt + Math.sin(n.t * 6) * 0.3; n.y += n.vy * dt; }
    st.notes = st.notes.filter((n) => n.t < n.life);
    // el humo de Arro sale siempre, haya partida o no
    for (const c of st.custs) {
      if (c.id !== "arro" || c.st === "out" || Math.random() > dt * 4) continue;
      st.smoke.push({ x: c.x + 8, y: topOf("arro", counterY(c.bar)) + 12, vx: -3 + Math.random() * 6, vy: -12 - Math.random() * 8, t: 0, life: 1.3, c: "" });
    }
    if (st.mode === "oops") {
      if ((st.wait -= dt) > 0) return;
      if (st.lives <= 0) {
        st.mode = "over";
        say("fin");
        opts.onOver({ score: st.score, served: st.served, tips: st.tips, wave: st.wave });
        return;
      }
      regroup();
      st.mode = "play";
      return;
    }
    if (st.mode === "clear") {
      for (const c of st.custs) c.x -= 40 * dt; // el último sigue saliendo, aunque se fuera desde media barra
      if ((st.wait -= dt) > 0) return;
      st.wave++;
      st.left = ronda(st.wave).clientes;
      st.next = 1;
      st.mode = "play";
      say("ronda");
      sfx.ronda();
      return;
    }
    if (st.mode !== "play") return;

    // nuevos clientes
    if (st.left > 0 && (st.next -= dt) <= 0) {
      spawn();
      st.left--;
      if (st.left > 0 && Math.random() < ronda(st.wave).pares) { spawn(); st.left--; } // a veces llegan de dos en dos
      st.next = ronda(st.wave).cada * (0.7 + Math.random() * 0.6);
    }
    // clientes
    for (const c of st.custs) {
      c.t += dt;
      c.sayT = Math.max(0, c.sayT - dt);
      c.jerk = Math.max(0, c.jerk - dt);
      if (c.st === "walk") {
        const step = (c.t % 1.3) < 0.8; // andan a tirones: paso, pausa
        if (step) c.x += speedOf(c) * dt;
        if (c.id === "moreno" && (c.tug -= dt) <= 0) { // tirón de la correa: solo el gag, la partida sigue igual
          c.tug = 3 + Math.random() * 3;
          c.jerk = 0.4;
          pop("¡TIRÓN!", c.x, counterY(c.bar) - 34, "#ff6fb4");
          sfx.tug();
        }
        if (c.x >= TAP() - 10) return loseLife("¡TE HA PILLADO!", c.x, c.bar);
      } else if (c.st === "push") {
        c.x = Math.max(c.to, c.x - V.push * dt);
        if (c.x <= c.to) {
          if (c.x < DOOR + 2 || c.bebidas >= HARTO) { // fuera: servido
            const bano = c.x >= DOOR + 2; // no ha llegado a la puerta: se va él, a la tercera
            c.st = "out";
            st.served++;
            st.score += 50;
            pop(bano ? "¡AL BAÑO!" : "+50", Math.min(VW - 34, Math.max(bano ? 34 : 16, c.x + 12)), counterY(c.bar) - 26, "#7cc59a");
            sfx.served();
            if (c.id === "marcos") for (let i = 0; i < 4; i++) st.notes.push({ x: Math.max(18, c.x), y: counterY(c.bar) - 20, vx: 4 + Math.random() * 10, vy: -20 - Math.random() * 12, t: -i * 0.15, life: 1.4, c: "" });
          } else { c.st = "drink"; c.t = 0; }
        }
      } else if (c.st === "drink") {
        if (c.t >= DRINK) { // se la ha bebido: devuelve la jarra vacía y vuelve a pedir
          c.st = "walk";
          st.mugs.push({ bar: c.bar, x: c.x + 8, full: false });
          sfx.slide();
          if (c.id === "gon") { c.say = gonSays("pide"); c.sayT = 2; }
          if (c.id === "sergio") { c.say = HAMBRE[Math.floor(Math.random() * HAMBRE.length)]; c.sayT = 2; }
        }
      } else c.x -= 40 * dt; // se va por la puerta
    }
    st.custs = st.custs.filter((c) => c.st !== "out" || c.x > -30);
    // jarras
    for (const m of st.mugs) {
      if (m.full) {
        m.x -= V.full * dt;
        // la pilla el primer cliente que la está esperando en esa barra; el que aún está en la puerta, en la puerta
        const at = (k: Cust) => Math.max(k.x, DOOR + 4);
        const c = st.custs.filter((k) => k.bar === m.bar && k.st === "walk" && m.x <= at(k) + 8 && m.x >= at(k) - 6).sort((a, b) => b.x - a.x)[0];
        if (c) {
          m.x = -999;
          c.st = "push";
          c.to = c.x - PUSH * MANIAS[c.id].empuje;
          c.bebidas++;
          sfx.catch();
          if (c.id === "hugo") { st.cash.push({ bar: c.bar, x: c.x + 10, full: false }); pop("¡PROPINA!", c.x, counterY(c.bar) - 34, "#9ad7a8"); }
          if (c.id === "arro") { c.say = BLA[Math.floor(Math.random() * BLA.length)]; c.sayT = 1.6; }
        } else if (m.x <= DOOR) { m.x = -999; return loseLife("¡AL SUELO!", 20, m.bar); }
      } else {
        m.x += V.empty * dt;
        if (m.x >= TAP()) {
          if (m.bar === st.bar) { m.x = -999; st.score += 15; sfx.clink(); }
          else { m.x = -999; return loseLife("¡CRASH!", TAP(), m.bar); }
        }
      }
    }
    st.mugs = st.mugs.filter((m) => m.x > -100);
    // propinas de Hugo: se recogen si el camarero está en esa barra cuando llegan
    for (const b of st.cash) {
      b.x += V.empty * dt;
      if (b.x >= TAP()) {
        if (b.bar === st.bar) { st.tips++; st.score += 100; pop("+100", TAP() - 4, counterY(b.bar) - 26, "#9ad7a8"); sfx.cash(); }
        b.x = -999;
      }
    }
    st.cash = st.cash.filter((b) => b.x > -100);
    // ronda terminada
    if (st.left === 0 && st.custs.every((c) => c.st === "out")) {
      st.mode = "clear";
      st.wait = 2;
      st.score += 100 * st.wave;
      pop(`¡RONDA ${st.wave}!  +${100 * st.wave}`, VW / 2, PH * 0.45, "#f2b35e");
      sfx.ronda();
    }
  }

  // ---------------------------------------------------------------- dibujo
  const px = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function drawText(text: string, x: number, y: number, color: string, alpha = 1, lw = 2) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e1d19";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }
  function bubble(x: number, y: number, lines: string[], font: string) {
    ctx.font = font;
    const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 8, h = 4 + lines.length * 9;
    const bx = Math.round(Math.max(2, Math.min(VW - w - 2, x - w / 2))), by = Math.round(y - h);
    px(bx - 1, by, w + 2, h, "#06121a"); px(bx, by - 1, w, h + 2, "#06121a"); px(bx, by, w, h, "#f6ead2");
    px(Math.round(x) - 1, by + h, 3, 2, "#06121a"); px(Math.round(x), by + h, 1, 2, "#f6ead2");
    ctx.fillStyle = "#1d1b20";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 6.5 + i * 9));
  }
  // Detrás de la barra solo se ve hasta el borde de abajo del mostrador: ni pies ni piernas por debajo.
  function behindBar(img: HTMLCanvasElement, x: number, y: number, cy: number) {
    const h = Math.min(img.height, cy + 14 - y);
    if (h > 0) ctx.drawImage(img, 0, 0, img.width, h, x, y, img.width, h);
  }
  function drawCust(c: Cust) {
    const cy = counterY(c.bar);
    const img = standing(c.id);
    const yank = c.jerk > 0 ? Math.round(Math.sin(((0.4 - c.jerk) / 0.4) * Math.PI) * 8) : 0; // el tirón de Moreno
    const x = Math.round(c.x - img.width / 2) - yank, y = topOf(c.id, cy);
    if (c.id === "moreno") { // la correa sale por la puerta: la novia tira desde fuera
      const ly = y + 18;
      px(0, ly, Math.max(0, x + 9), 1, "#c0302a");
    }
    behindBar(img, x, y, cy);
    if (c.id === "javi" && c.st === "walk") { // pide con el brazo tieso en alto
      ctx.save();
      ctx.translate(x + 16, y + 21);
      ctx.rotate((-68 * Math.PI) / 180);
      ctx.drawImage(IMG.brazo, -1, -4);
      ctx.restore();
    }
    if (c.st === "drink") { // se la bebe: la jarra a la boca
      ctx.drawImage(IMG.jarra, x + img.width - 8, y + 8);
    }
  }
  function drawBar(bar: number) {
    const cy = counterY(bar);
    // puerta
    px(0, cy - 34, DOOR, 34, "#120a06");
    px(DOOR, cy - 36, 2, 36, "#6e4428"); px(0, cy - 36, DOOR + 2, 2, "#6e4428");
    px(2, cy - 22, DOOR - 4, 2, "#8a5a36"); px(2, cy - 14, DOOR - 4, 2, "#8a5a36"); // hojas de la puerta de saloon
    for (const c of st.custs) if (c.bar === bar) drawCust(c);
    // camarero
    if (st.bar === bar) {
      const img = st.ko > 0 && st.mode !== "play" ? IMG[`${st.pj}_ko` as SprName] : standing(st.pj);
      behindBar(img, Math.round(BARMAN() - img.width / 2), topOf(st.pj, cy) - (st.bob > 0 ? 1 : 0), cy);
    }
    // barra
    px(DOOR - 1, cy, VW - DOOR + 1, 2, "#c99a5e");
    px(DOOR - 1, cy + 2, VW - DOOR + 1, 1, "#8a5a36");
    px(DOOR - 1, cy + 3, VW - DOOR + 1, 11, "#5a3620");
    for (let x = DOOR + 6; x < VW; x += 12) px(x, cy + 3, 1, 11, "#482a18");
    px(DOOR - 1, cy + 11, VW - DOOR + 1, 1, "#b8913f");
    ctx.drawImage(IMG.grifo, VW - 31, cy - 17);
    // jarras y propinas sobre la barra
    for (const m of st.mugs) if (m.bar === bar) ctx.drawImage(m.full ? IMG.jarra : IMG.vacia, Math.round(m.x - 6), cy - 11);
    for (const b of st.cash) if (b.bar === bar) ctx.drawImage(IMG.billete, Math.round(b.x - 6), cy - 8);
  }
  function drawHud() {
    px(0, 0, VW, HUD, "#06121a");
    px(0, HUD - 2, VW, 2, "#2e5549");
    ctx.drawImage(GON_FACE, 3, 7);
    const bx = 27, bw = VW - bx - 52;
    ctx.textBaseline = "top";
    if (st.gon) {
      px(bx - 3, 16, 3, 3, "#f6ead2"); px(bx - 4, 17, 1, 1, "#f6ead2");
      px(bx, 3, bw, HUD - 8, "#f6ead2");
      ctx.font = `600 8px ${opts.textFont}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#1d1b20";
      const lines: string[] = [];
      for (const w of st.gon.text.split(" ")) {
        const cur = lines[lines.length - 1];
        if (cur !== undefined && ctx.measureText(`${cur} ${w}`).width <= bw - 6) lines[lines.length - 1] = `${cur} ${w}`;
        else lines.push(w);
      }
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, bx + 3, 4 + i * 8));
    } else {
      ctx.font = `400 8px ${opts.font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#6f8a80";
      ctx.fillText(`RÉCORD ${best}`, bx, 8);
      ctx.fillText(`RONDA ${st.wave}`, bx, 19);
    }
    ctx.textAlign = "right";
    ctx.font = `700 14px ${opts.font}`;
    drawText(String(st.score), VW - 5, 3, "#f6ead2");
    for (let i = 0; i < LIVES; i++) {
      ctx.globalAlpha = i < st.lives ? 1 : 0.25;
      ctx.drawImage(IMG.jarra, VW - 16 - i * 13, 20);
    }
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(U, 0, 0, U, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawHud();
    const shake = st.shake > 0 && !reduced;
    const sx = shake ? Math.round(Math.random() * 4 - 2) : 0;
    ctx.setTransform(U, 0, 0, U, sx * U, HUD * U);
    ctx.save();
    ctx.beginPath(); ctx.rect(-4, 0, VW + 8, PH + 4); ctx.clip();
    ctx.drawImage(bg, 0, 0);
    px(0, 0, VW, 6, "#2c1a11"); px(0, 6, VW, 1, "#6e4428");
    drawDecor();
    for (let b = 0; b < BARS; b++) drawBar(b);
    for (const m of st.smoke) px(Math.round(m.x), Math.round(m.y), 2, 2, `rgba(220,220,220,${(0.7 * (1 - m.t / m.life)).toFixed(2)})`);
    for (const n of st.notes) if (n.t > 0) ctx.drawImage(IMG.nota, Math.round(n.x), Math.round(n.y));
    // bocadillos: lo que pide Gon (en cirílico), la chapa de Arro y el hambre de Sergio
    for (const c of st.custs) {
      if (!c.say || c.sayT <= 0 || c.st === "out") continue;
      const y = topOf(c.id, counterY(c.bar)) - 2;
      if (c.id === "gon") bubble(c.x, y, [c.say], `600 8px ${opts.textFont}`);
      else {
        const cut = c.say.lastIndexOf(" ", Math.ceil(c.say.length / 2) + 1);
        bubble(c.x, y, c.say.length > 12 && cut > 0 ? [c.say.slice(0, cut), c.say.slice(cut + 1)] : [c.say], `700 7px ${opts.font}`);
      }
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 9px ${opts.font}`;
    for (const p of st.pops) drawText(p.text, p.x, p.y - p.age * 14, p.color, 1 - p.age);
    if (st.mode === "ready") {
      ctx.font = `700 9px ${opts.font}`;
      const a = reduced ? 1 : 0.55 + 0.45 * Math.sin(st.t * 6);
      drawText("TOCA LA BARRA DONDE ESTÁS", VW / 2, PH * 0.5 - 6, "#f6ead2", a);
      drawText("PARA SERVIR", VW / 2, PH * 0.5 + 6, "#f6ead2", a);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- tamaño, entrada, bucle
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
    if (rows !== H || cv.width !== bg.width * unit) { H = rows; PH = H - HUD; rowH = Math.floor((PH - TOP - 4) / BARS); bg = paintBg(); }
  }
  const onPointer = (ev: PointerEvent) => {
    if (st.mode === "intro" || st.mode === "over") return;
    ev.preventDefault();
    const r = cv.getBoundingClientRect();
    const y = ((ev.clientY - r.top) / r.height) * H - HUD;
    act(barAt(y, TOP, rowH));
  };
  const onKey = (ev: KeyboardEvent) => {
    if (st.mode === "intro" || st.mode === "over") return;
    const k = ev.key === "ArrowUp" || ev.key === "w" ? "up" : ev.key === "ArrowDown" || ev.key === "s" ? "down" : ev.key === " " || ev.key === "Enter" ? "serve" : null;
    if (!k) return;
    ev.preventDefault();
    if (!ev.repeat || k !== "serve") act(k);
  };
  stage.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKey);
  // ponytail: solo en desarrollo, para mirar y forzar estados desde la consola del navegador
  if (process.env.NODE_ENV === "development") Object.assign(window, { __tapper: { st, act, counterY, TAP, speedOf } });
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
    document.fonts.load(`700 14px ${opts.font}`).catch(() => {}),
    document.fonts.load(`600 8px ${opts.textFont}`, "Гон").catch(() => {}),
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

