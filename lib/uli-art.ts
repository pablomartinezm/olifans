// Arte del juego que no viene en PNG: iconos, manos, camisas, gafas, fondos y objetos de la barra.
export const S = 96;
export const COUNTER_Y = 80;

export type Px = (x: number, y: number, w: number, h: number, c: string) => void;

export function layer(paint: (px: Px) => void, w = S, h = S) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  paint((x, y, pw, ph, col) => { g.fillStyle = col; g.fillRect(x, y, pw, ph); });
  return c;
}

// ---------------------------------------------------------------- iconos (pixel art en texto)
// Se usan en la interfaz como SVG (ICON_SVG) y la mano del bofetón sale del icono "hostia".
type Icon = { rows: string[]; pal: Record<string, string> };
const ICONS = {
  chicle: { rows: [ // rollo de chicle en espiral, como el de la portada
    ".....ooo.....",
    "...oopppoo...",
    "..opwddddpo..",
    ".opwddppddpo.",
    ".opdddddpddo.",
    "oppdpdpddpdpo",
    "oppdpddpdpdpo",
    "oppdpddpdpdpo",
    ".opddppddpdo.",
    ".oppddddppdo.",
    "..opppppppo..",
    "...oopppoo...",
    ".....ooo.....",
  ], pal: { o: "#5a1030", p: "#ff6fb4", d: "#c93a7d", w: "#ffd6ea" } },
  agua: { rows: [
    "oooooooooo",
    "oLLLLLLLLo",
    "owbbbbbbBo",
    "owbbbbbbBo",
    ".owbbbbBo.",
    ".owbbbbBo.",
    ".obbbbbBo.",
    ".oBBBBBBo.",
    "..oooooo..",
  ], pal: { o: "#1d3550", L: "#bfe6ff", b: "#4fb3ff", B: "#2f86d6", w: "#e6f6ff" } },
  hostia: { rows: [
    ".......oo..........",
    "....ooohsooo.......",
    "...ohsohsohso....w.",
    "...ohsohsohsooo....",
    "...ohsohsohsohso.ww",
    "...ohsohsohsohso...",
    "...ohsohsohsohso.w.",
    "oo.ohsohsohsohso...",
    "ohsohssssssssssoww.",
    ".ohsssssssssssdo...",
    "..ohsssssssssdo..w.",
    "..odssssssssddo....",
    "...oddsssssddo.....",
    "....ooDDDDDoo......",
  ], pal: { o: "#2a1812", s: "#e7ad86", h: "#fbe1cf", d: "#c98b6a", D: "#a8705a", w: "#f6ead2" } },
  cana: { rows: [
    ".WWWWWW...",
    "WwwwwwwW..",
    "oyyyyyyooo",
    "oyYyyyyo.o",
    "oyYyyyyo.o",
    "oyYyyyyooo",
    "oyYyyyyo..",
    "oyyyyyyo..",
    ".oooooo...",
  ], pal: { o: "#5a3a1a", y: "#f0b43a", Y: "#f8d56a", w: "#fffaf0", W: "#e9dfc9" } },
  record: { rows: [
    "..oooooooo..",
    "oooyYyyyyooo",
    "o.oyYyyyyo.o",
    "o.oyYyyyyo.o",
    ".ooyYyyyyoo.",
    "...oyyyyo...",
    "....oyyo....",
    ".....oo.....",
    "....oyyo....",
    "...oyyyyo...",
    "...oooooo...",
  ], pal: { o: "#5a3a10", y: "#f5c542", Y: "#fff0a0" } },
  sonido: { rows: [
    "....o.....",
    "...oo...o.",
    "ooooo.o..o",
    "oooo...o.o",
    "oooo...o.o",
    "ooooo.o..o",
    "...oo...o.",
    "....o.....",
  ], pal: { o: "#f6ead2" } },
  mute: { rows: [
    "....o.....",
    "...oo.....",
    "ooooo.x..x",
    "oooo...xx.",
    "oooo...xx.",
    "ooooo.x..x",
    "...oo.....",
    "....o.....",
  ], pal: { o: "#f6ead2", x: "#e4574a" } },
  raya: { rows: [
    "..........oo....",
    ".........oGgo...",
    "........oGgo....",
    ".......oGgo.....",
    "......oGgo......",
    ".....ooo........",
    "mmmmmmmmmmmmmmmm",
    "mMMMMMMMMMMMMMMm",
    "mMwwwwwwwwwwwMMm",
    "mMMMMMMMMMMMMMMm",
    "mmmmmmmmmmmmmmmm",
  ], pal: { o: "#1f3a1a", g: "#5f9e4f", G: "#a6d68f", m: "#9aa4b2", M: "#1c1f2a", w: "#ffffff" } },
} satisfies Record<string, Icon>;
export type IconName = keyof typeof ICONS;
function iconRows(name: IconName) { return ICONS[name].rows; }
// Un <path> por color con los tramos de cada fila: nítido a cualquier tamaño y sin canvas (sirve en el servidor).
export const ICON_SVG = Object.fromEntries(Object.entries(ICONS).map(([name, ic]: [string, Icon]) => {
  const paths: Record<string, string> = {};
  ic.rows.forEach((r, y) => {
    for (let x = 0; x < r.length;) {
      const ch = r[x];
      let e = x + 1;
      while (e < r.length && r[e] === ch) e++;
      if (ic.pal[ch]) paths[ic.pal[ch]] = (paths[ic.pal[ch]] ?? "") + `M${x} ${y}h${e - x}v1h${x - e}z`;
      x = e;
    }
  });
  return [name, { w: Math.max(...ic.rows.map((r) => r.length)), h: ic.rows.length, paths: Object.entries(paths) }];
})) as Record<IconName, { w: number; h: number; paths: [string, string][] }>;

// ---------------------------------------------------------------- manos (pixel art en texto)
const SKIN: Record<string, string> = {
  o: "#2a1812", s: "#e7ad86", h: "#fbe1cf", d: "#c98b6a", D: "#a8705a", n: "#f9e3d8", N: "#e2b9a8",
  c: "#dfe6f0", b: "#2e4577", B: "#15213b",
};
// Índice estirado, pulgar a la izquierda y nudillos doblados. El centro del dedo cae en x = 7.5.
export const HAND = [
  "......oooo.........",
  ".....ohnnNo........",
  ".....ohnnNo........",
  ".....ohNNdo........",
  ".....ohssdo........",
  ".....ohssdo........",
  ".....oDssDo........",
  ".....ohssdo........",
  ".....ohssdoooo.....",
  ".....ohssdohhdoooo.",
  ".....ohssdohsdohhdo",
  "..oooohssdohsdohsdo",
  ".ohhoohssdoDsdoDsdo",
  ".ohsssdhsssssssssdo",
  ".ohssssdsssssssssdo",
  "..ossssssssssssssdo",
  "..odssssssssssssdo.",
  "...odsssssssssdddo.",
  "...oddssssssddDDo..",
  "....ooDDDDDDDDoo...",
  "...occcccccccccco..",
  "...obbbbbbbbbbbbo..",
];
// Mano abierta del bofetón: dedos separados hacia arriba. Sale del icono "hostia" sin las líneas de movimiento.
export const SLAP = [
  ...iconRows("hostia").map((r) => r.slice(0, 17).replaceAll("w", ".")),
  "....occccccco....",
  "....obbbbbbbo....",
];
// Marca roja que deja en el moflete (coordenadas del sprite de Uli).
export const HANDPRINT = { x: 30, y: 24, rows: ["x.x.x.x", "x.x.x.x", "xxxxxxx", ".xxxxx.", "..xxx.."] };
export function sprite(rows: string[]) {
  const w = Math.max(...rows.map((r) => r.length));
  return layer((px) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (SKIN[ch]) px(x, y, 1, 1, SKIN[ch]); })), w, rows.length);
}

// ---------------------------------------------------------------- recolorear sprites
export function recolor(img: CanvasImageSource & { width: number; height: number }, fn: (x: number, y: number, hex: string) => string | null) {
  const c = layer(() => {}, img.width, img.height);
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    if (!d.data[i + 3]) continue;
    const hex = "#" + [0, 1, 2].map((k) => d.data[i + k].toString(16).padStart(2, "0")).join("");
    const out = fn((i / 4) % c.width, Math.floor(i / 4 / c.width), hex);
    if (!out) continue;
    const n = parseInt(out.slice(1), 16);
    d.data[i] = n >> 16; d.data[i + 1] = (n >> 8) & 255; d.data[i + 2] = n & 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, v * f)).toString(16).padStart(2, "0")).join("");
}
const own = <T,>(o: Record<string, T>, k: string): T | undefined => (Object.hasOwn(o, k) ? o[k] : undefined);
const hash = (x: number, y: number) => (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;

// ---------------------------------------------------------------- camisas
// Cada camisa es un patrón por píxel (coordenadas del sprite de Uli). null = la hawaiana original del PNG.
type Shirt = ((x: number, y: number) => string) | null;
export const SHIRTS: Record<string, Shirt> = {
  hawaiana: null,
  flamencos: (x, y) => {
    const cx = x % 8, cy = (y + (Math.floor(x / 8) % 2) * 4) % 8;
    if ((cx === 3 || cx === 4) && cy === 2) return "#e0457b";
    if (cx === 3 && cy === 3) return "#e0457b";
    if (cx === 5 && cy === 1) return "#2a1812";
    if (cx === 3 && cy === 4) return "#c2466e";
    return "#f7c1d4";
  },
  lenador: (x, y) => {
    const a = (x >> 2) & 1, b = (y >> 2) & 1;
    return a && b ? "#3a1414" : a || b ? "#b3262e" : "#d8434a";
  },
  leopardo: (x, y) => {
    const h = hash(x >> 1, y >> 1) % 9;
    if (h === 0) return (x + y) & 1 ? "#2a1812" : "#6a3a16";
    return h === 1 ? "#c98a2b" : "#e8b85a";
  },
  lentejuelas: (x, y) => (hash(x, y) % 17 === 0 ? "#fffbe6" : (x + y) & 1 ? "#f5d66a" : "#d9a93a"),
  tigre: (x, y) => ((x + (y >> 1)) % 7 < 2 ? "#1f1b18" : y % 5 === 0 ? "#e07b1f" : "#f39a38"),
};
const SHIRT_BASE = new Set(["#cbe8c0", "#43ab8e", "#1f7a68", "#f3a84f", "#f5d66a"]);
const SHIRT_DARK = "#a0ce9e";
export function shirtSprite(base: HTMLImageElement, id: string) {
  const fn = own(SHIRTS, id);
  if (!fn) return base;
  return recolor(base, (x, y, hex) => (hex === SHIRT_DARK ? shade(fn(x, y), 0.8) : SHIRT_BASE.has(hex) ? fn(x, y) : null));
}
// Faldón de la camisa por debajo del sprite (el PNG acaba en el pecho).
export function paintShirtExtension(px: Px, id: string) {
  const fn = own(SHIRTS, id);
  px(2, 47, 44, 26, "#2a1812");
  if (!fn) {
    px(3, 47, 42, 26, "#cbe8c0");
    px(23, 47, 2, 26, "#a0cea0");
    const leaf = (x: number, y: number) => { px(x, y, 2, 1, "#43ab8e"); px(x + 1, y + 1, 2, 1, "#1f7a68"); };
    leaf(6, 49); leaf(13, 52); leaf(31, 50); leaf(39, 53);
    px(18, 49, 1, 1, "#f3a84f"); px(35, 48, 1, 1, "#f3a84f");
  } else {
    for (let y = 47; y < 73; y++) for (let x = 3; x < 45; x++) px(x, y, 1, 1, x === 23 || x === 24 ? shade(fn(x, y), 0.8) : fn(x, y));
  }
  px(23, 50, 1, 1, "#f6ead2"); px(23, 56, 1, 1, "#f6ead2");
}

// ---------------------------------------------------------------- gafas (cambio de paleta del PNG)
// Colores del PNG: montura, brillo de montura, cristal, reflejo.
const GAFAS_PNG = ["#2f2f36", "#6b6b78", "#dcf0ff", "#ffffff"];
export const GLASSES: Record<string, string[] | null> = {
  clasicas: null,
  sol: ["#15151a", "#4a4a55", "#232838", "#7c8aa6"],
  rosas: ["#d6337a", "#ff8fc0", "#ffd6e8", "#ffffff"],
  doradas: ["#a8761f", "#f5d66a", "#3a2a10", "#f5d66a"],
  fosforito: ["#2fb84a", "#b6ffb0", "#e6ffe2", "#ffffff"],
  culo: ["#2f2f36", "#6b6b78", "#a8d8ff", "#ffffff"],
};
export function glassesSprite(png: HTMLImageElement, id: string) {
  const pal = own(GLASSES, id);
  if (!pal && id !== "culo") return png;
  const out = recolor(png, (_x, _y, hex) => { const i = GAFAS_PNG.indexOf(hex); return i >= 0 && pal ? pal[i] : null; });
  if (id === "culo") { // culo de vaso: aros concéntricos en los cristales
    const g = out.getContext("2d")!;
    g.fillStyle = "rgba(255,255,255,0.8)";
    for (const cx of [8, 24]) { g.fillRect(cx - 2, 3, 4, 1); g.fillRect(cx - 2, 6, 4, 1); g.fillRect(cx - 3, 4, 1, 2); g.fillRect(cx + 2, 4, 1, 2); }
  }
  return out;
}

// ---------------------------------------------------------------- fondos
// Se pintan a la altura que pida la pantalla (vertical en el móvil). La escena clásica de 96x96 va en medio:
// por arriba sigue la pared hasta el techo y por abajo (b píxeles) el frente de la barra, donde van los botones.
export type Scene = {
  bg: HTMLCanvasElement;   // 96 x h, coordenadas absolutas
  fg: HTMLCanvasElement;   // 96 x (96 + b), coordenadas de la escena clásica (la barra y lo que hay debajo)
  light: (ctx: CanvasRenderingContext2D, t: number, reduced: boolean) => void; // coordenadas de la escena clásica
};
const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) => {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
};
const lamp = (rgb: string, a: number, cy = 10) => (ctx: CanvasRenderingContext2D, t: number, reduced: boolean) => {
  const flick = reduced ? 1 : 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  const g = ctx.createRadialGradient(48, cy, 2, 48, cy + 20, 60);
  g.addColorStop(0, `rgba(${rgb},${a * flick})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, cy - 40, S, COUNTER_Y - cy + 40); // todo el radio del degradado: sin corte por arriba
};
const counter = (px: Px, top: string, edge: string, lip: string, front: string) => {
  px(0, COUNTER_Y, S, 1, top);
  px(0, COUNTER_Y + 1, S, 2, edge);
  px(0, COUNTER_Y + 3, S, 1, lip);
  px(0, COUNTER_Y + 4, S, 12, front);
};
// P pinta en absoluto; px en coordenadas de la escena clásica (y negativa = pared de arriba).
function wall(h: number, b: number, paint: (px: Px, P: Px, off: number) => void) {
  const off = h - S - b;
  return layer((P) => paint((x, y, w, hh, c) => P(x, y + off, w, hh, c), P, off), S, h);
}
const front = (b: number, paint: (px: Px) => void) => layer(paint, S, S + b);

function bar(h: number, b: number): Scene {
  const bg = wall(h, b, (px, P, off) => {
    for (let ty = -Math.ceil(off / 8) * 8; ty < 64; ty += 8) for (let tx = 0; tx < S; tx += 8) {
      const alt = ((tx + ty) / 8) % 2 === 0;
      px(tx, ty, 8, 8, alt ? "#1d3b33" : "#19342d");
      px(tx, ty, 8, 1, "#12271f");
      px(tx, ty, 1, 8, "#12271f");
      px(tx + 2, ty + 2, 2, 1, alt ? "#27493f" : "#214238");
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
    if (off >= 40) {
      // tele con el fútbol y pizarra de tapas, en la pared de arriba
      px(73, -14, 4, 4, "#2a2a2a");
      px(60, -36, 30, 22, "#111111"); px(62, -34, 26, 17, "#2f8a3a");
      for (let y = -34; y < -17; y += 4) px(62, y, 26, 2, "#37993f");
      px(75, -34, 1, 17, "#dfeee0"); px(73, -27, 5, 1, "#dfeee0"); px(73, -28, 1, 3, "#dfeee0"); px(77, -28, 1, 3, "#dfeee0");
      px(68, -30, 1, 2, "#e4574a"); px(82, -24, 1, 2, "#6fc3ff"); px(79, -29, 1, 1, "#ffffff");
      px(63, -33, 7, 2, "#111111"); px(64, -33, 2, 1, "#ffffff"); px(67, -33, 2, 1, "#e4574a");
      px(6, -36, 26, 22, "#6b4228"); px(8, -34, 22, 18, "#24332c");
      px(10, -31, 12, 1, "#e9e4d8"); px(10, -27, 16, 1, "#e9e4d8"); px(10, -23, 9, 1, "#e9e4d8"); px(10, -19, 13, 1, "#e9e4d8");
      px(24, -31, 4, 1, "#f2b35e"); px(21, -23, 5, 1, "#f2b35e");
    }
    P(0, 0, S, 3, "#2c1a11"); P(0, 3, S, 1, "#6e4428"); // techo
    P(47, 4, 2, off, "#0c0c0c"); // el cable de la lámpara llega hasta el techo
    px(47, 0, 2, 5, "#0c0c0c");
    px(44, 5, 8, 1, "#b67a2c"); px(43, 6, 10, 1, "#d69339"); px(42, 7, 12, 1, "#e8a746"); px(41, 8, 14, 1, "#f2b35e");
    px(42, 9, 12, 1, "#fff3c4");
  });
  const fg = front(b, (px) => {
    counter(px, "#dfe6e2", "#9fa9a5", "#6e4428", "#5a3620");
    px(0, S, S, b, "#5a3620");
    for (let x = 4; x < S; x += 11) px(x, COUNTER_Y + 4, 1, 12 + b, "#482a18");
    if (b >= 12) { // reposapiés de latón y suelo
      const y = S + b - 10;
      px(0, y, S, 2, "#b8913f"); px(0, y, S, 1, "#e0c070");
      for (let x = 10; x < S; x += 24) px(x, y + 2, 2, 4, "#8a6a2a");
      px(0, S + b - 3, S, 3, "#2a1a10");
    }
  });
  return { bg, fg, light: lamp("255,214,140", 0.22) };
}

function disco(h: number, b: number): Scene {
  const bg = wall(h, b, (px, P, off) => {
    P(0, 0, S, off, "#0d0617");
    ["#12081f", "#170a28", "#1c0c32", "#22103d"].forEach((c, i) => px(0, i * 16, S, 16, c));
    for (let x = 0; x < S; x += 12) P(x, 0, 1, off + 62, "#1b0d30");
    P(9, 10, 2, off + 50, "#ff4fa3"); P(8, 10, 1, off + 50, "rgba(255,79,163,0.35)"); P(11, 10, 1, off + 50, "rgba(255,79,163,0.35)");
    P(85, 10, 2, off + 50, "#3ee6ff"); P(84, 10, 1, off + 50, "rgba(62,230,255,0.35)"); P(87, 10, 1, off + 50, "rgba(62,230,255,0.35)");
    const speaker = (x: number) => {
      px(x, 34, 14, 28, "#0b0b12"); px(x, 34, 14, 1, "#2a2a3a");
      px(x + 4, 38, 6, 6, "#1f1f2e"); px(x + 5, 39, 4, 4, "#0b0b12"); px(x + 6, 40, 2, 2, "#3a3a52");
      px(x + 2, 48, 10, 10, "#1f1f2e"); px(x + 3, 49, 8, 8, "#0b0b12"); px(x + 5, 51, 4, 4, "#2a2a3e"); px(x + 6, 52, 2, 2, "#4a4a66");
    };
    speaker(9); speaker(73);
    if (off >= 36) { // neones en la pared: corazón y rayo
      [[14, -32, 3], [20, -32, 3], [12, -30, 1], [25, -30, 1], [12, -28, 1], [25, -28, 1], [13, -26, 1], [24, -26, 1], [15, -24, 1], [22, -24, 1], [17, -22, 4]]
        .forEach(([x, y, w]) => px(x, y, w, 1, "#ff4fa3"));
      px(17, -31, 1, 1, "#ff4fa3"); px(20, -31, 1, 1, "#ff4fa3"); px(18, -30, 2, 1, "#ff4fa3");
      [[76, -34], [75, -33], [74, -32], [73, -31], [72, -30], [72, -29], [73, -29], [74, -29], [75, -29], [76, -29], [75, -28], [74, -27], [73, -26], [72, -25]]
        .forEach(([x, y]) => px(x, y, 2, 1, "#3ee6ff"));
    }
    P(0, 0, S, 3, "#07030d"); // techo con focos
    [16, 30, 62, 76].forEach((x, i) => { P(x, 0, 4, 4, "#2a2a3a"); P(x + 1, 4, 2, 1, ["#ff4fa3", "#3ee6ff", "#ffd23f", "#8c5aff"][i]); });
    P(47, 0, 2, off + 3, "#0c0c0c");
    for (let y = 3; y <= 13; y++) for (let x = 43; x <= 53; x++) {
      const dx = x - 48, dy = y - 8;
      if (dx * dx + dy * dy <= 26) px(x, y, 1, 1, (x + y) & 1 ? "#d8deea" : "#8a93a8");
    }
    px(45, 5, 2, 1, "#ffffff"); px(45, 6, 1, 1, "#ffffff");
    px(0, 62, S, 1, "#ff4fa3");
    px(0, 63, S, 17, "#0c0a14");
    for (let x = 2; x < S; x += 6) px(x, 66, 1, 12, "#161222");
  });
  const fg = front(b, (px) => {
    counter(px, "#ff9ccf", "#ff4fa3", "#6a1d48", "#15121f");
    px(0, S, S, b, "#15121f");
    for (let x = 3; x < S; x += 10) px(x, COUNTER_Y + 7, 6, 1, "#3ee6ff");
    if (b >= 12) {
      for (let x = 8; x < S; x += 10) px(x, S + b - 10, 6, 1, "#ff4fa3");
      px(0, S + b - 3, S, 3, "#0a0810");
    }
  });
  const cols = ["255,79,163", "62,230,255", "255,210,63", "140,90,255"];
  return {
    bg, fg,
    light(ctx, t, reduced) {
      const tt = reduced ? 1 : t;
      for (let i = 0; i < 4; i++) {
        const a = tt * 0.8 + i * 1.6;
        glow(ctx, 48 + Math.cos(a) * 36, 36 + Math.sin(a * 1.3) * 20, 14, cols[i], 0.22);
      }
      glow(ctx, 48, 8, 12, "255,255,255", 0.25);
      if (!reduced && Math.floor(t * 8) % 3 === 0) { ctx.fillStyle = "#fff"; ctx.fillRect(44 + (Math.floor(t * 9) % 9), 4 + (Math.floor(t * 5) % 7), 1, 1); }
    },
  };
}

function casa(h: number, b: number): Scene {
  const bg = wall(h, b, (px, P, off) => {
    P(0, 0, S, off + 62, "#e8d9b8");
    for (let x = 0; x < S; x += 6) P(x, 0, 2, off + 62, "#dfcca5");
    for (let y = 5 - Math.ceil(off / 10) * 10; y < 50; y += 10) for (let x = 3; x < S; x += 12) px(x + (Math.abs(y / 10) % 2 < 1 ? 0 : 6), y, 1, 1, "#c9785a");
    px(1, 9, 30, 1, "#6b4228");
    px(4, 12, 24, 24, "#f4ecd8"); px(6, 14, 20, 20, "#1d2b4f");
    px(20, 16, 3, 3, "#f6ead2"); px(9, 18, 1, 1, "#fff"); px(13, 28, 1, 1, "#fff"); px(23, 27, 1, 1, "#fff");
    px(15, 14, 2, 20, "#f4ecd8"); px(6, 23, 20, 2, "#f4ecd8");
    px(2, 10, 4, 32, "#b0413e"); px(26, 10, 4, 32, "#b0413e"); px(3, 10, 1, 32, "#8a2f2d"); px(28, 10, 1, 32, "#8a2f2d");
    px(68, 13, 22, 17, "#6b4228"); px(70, 15, 18, 13, "#9fd0e6");
    px(70, 24, 18, 4, "#4f8a4a"); px(73, 21, 7, 3, "#6fa35f"); px(75, 19, 3, 2, "#6fa35f"); px(84, 17, 2, 2, "#f5d66a");
    if (off >= 40) { // estantería con una planta
      px(8, -24, 26, 2, "#6b4228"); px(8, -22, 26, 1, "#4a2e1a");
      px(12, -30, 6, 6, "#b0413e"); px(13, -36, 1, 6, "#4f8a4a"); px(11, -35, 2, 1, "#6fa35f"); px(14, -38, 3, 2, "#6fa35f"); px(15, -33, 3, 1, "#6fa35f");
      px(22, -32, 3, 8, "#3d5f7a"); px(26, -30, 3, 6, "#c98a2b"); px(30, -31, 2, 7, "#7a2430");
    }
    if (off >= 36) { // reloj de pared
      px(75, -30, 10, 1, "#6b4228"); px(74, -29, 12, 1, "#6b4228"); px(73, -28, 14, 9, "#6b4228"); px(74, -19, 12, 1, "#6b4228"); px(75, -18, 10, 1, "#6b4228");
      px(75, -28, 10, 9, "#f6ead2"); px(74, -27, 12, 7, "#f6ead2");
      px(79, -27, 1, 4, "#2a1812"); px(80, -24, 3, 1, "#2a1812"); px(79, -24, 1, 1, "#e4574a");
    }
    P(0, 0, S, 2, "#f4ecd8"); // moldura del techo
    P(47, 2, 2, off + 1, "#3a2a20");
    px(44, 3, 8, 1, "#d9c08a"); px(43, 4, 10, 2, "#e6cf9a"); px(42, 6, 12, 2, "#f0dcaa"); px(43, 8, 10, 1, "#fff3c4");
    px(0, 46, 6, 34, "#3b5439"); px(90, 46, 6, 34, "#3b5439"); px(0, 46, 6, 1, "#5f7f58"); px(90, 46, 6, 1, "#5f7f58");
    px(6, 50, 84, 30, "#4d6b4a"); px(6, 50, 84, 2, "#6a8a5a");
    px(34, 52, 1, 28, "#3b5439"); px(62, 52, 1, 28, "#3b5439");
    [8, 36, 64].forEach((x) => px(x, 53, 24, 1, "#5f7f58"));
  });
  const fg = front(b, (px) => {
    if (b > 0) { // debajo de la mesa: suelo de tarima, alfombra y las patas
      px(0, S - 4, S, b + 4, "#8a5a36");
      for (let y = S; y < S + b; y += 4) px(0, y, S, 1, "#74482a");
      px(4, S, 88, b - 3, "#9b3a36"); px(4, S, 88, 1, "#c9785a"); px(4, S + b - 4, 88, 1, "#c9785a");
      for (let x = 8; x < 90; x += 6) px(x, S + 3, 2, Math.max(0, b - 9), "#b0413e");
      px(6, S - 4, 4, b, "#5a3620"); px(86, S - 4, 4, b, "#5a3620");
    }
    counter(px, "#c28a58", "#9a6a3f", "#5a3620", "#6e4428");
    for (let x = 0; x < S; x += 16) px(x + ((x / 16) % 2) * 5, COUNTER_Y + 7, 9, 1, "#5e3a22");
    px(28, 78, 10, 2, "#2b2b2b"); px(30, 78, 1, 1, "#d62246"); px(33, 78, 1, 1, "#7cc59a"); px(35, 78, 1, 1, "#6fc3ff"); // el mando es de la casa
  });
  return { bg, fg, light: lamp("255,217,160", 0.2) };
}

function furgo(h: number, b: number): Scene {
  const off = h - S - b;
  const BULBS = ["#ff5f5f", "#ffd23f", "#7cf29a", "#6fc3ff"];
  const wire = (x: number) => 6 + Math.round(Math.abs(((x % 16) - 8) / 4)); // guirnalda, en absoluto
  const bg = wall(h, b, (px, P) => {
    P(0, 0, S, off + 62, "#b27a45");
    for (let x = 0; x < S; x += 8) {
      P(x, 0, 1, off + 62, "#8f5e33");
      for (let y = (x * 7) % 40 + 10; y < off + 62; y += 37) P(x + 3, y, 1, 6, "#a06c3b");
    }
    P(0, 0, S, 4, "#5a3a22"); P(0, 4, S, 1, "#7a4f2d"); // techo
    const win = (x: number, moon: boolean) => {
      px(x, 14, 24, 22, "#2a2a2a"); px(x + 2, 16, 20, 18, "#16244a");
      px(x, 14, 1, 1, "#b27a45"); px(x + 23, 14, 1, 1, "#b27a45"); px(x, 35, 1, 1, "#b27a45"); px(x + 23, 35, 1, 1, "#b27a45");
      px(x + 2, 29, 20, 5, "#0d1630"); px(x + 5, 26, 5, 3, "#0d1630"); px(x + 13, 27, 6, 2, "#0d1630"); px(x + 7, 25, 2, 1, "#0d1630");
      px(x + 5, 19, 1, 1, "#fff"); px(x + 16, 18, 1, 1, "#fff"); px(x + 11, 22, 1, 1, "#cfe"); px(x + 19, 23, 1, 1, "#fff");
      if (moon) { px(x + 14, 18, 3, 3, "#f6ead2"); px(x + 15, 18, 2, 1, "#16244a"); }
    };
    win(4, false); win(68, true);
    if (off >= 36) { // tabla de surf colgada
      px(24, -30, 48, 6, "#3ee0c8"); px(22, -29, 2, 4, "#3ee0c8"); px(72, -29, 2, 4, "#3ee0c8");
      px(24, -30, 1, 1, "#b27a45"); px(71, -30, 1, 1, "#b27a45"); px(24, -25, 1, 1, "#b27a45"); px(71, -25, 1, 1, "#b27a45");
      px(22, -28, 52, 1, "#f6ead2"); px(40, -30, 4, 6, "#ff6fb4");
      px(34, -33, 2, 12, "#5a3a22"); px(60, -33, 2, 12, "#5a3a22");
    }
    for (let x = 0; x < S; x++) P(x, wire(x), 1, 1, "#3a2a20");
    for (let x = 4, i = 0; x < S; x += 8, i++) P(x, wire(x) + 1, 2, 2, BULBS[i % 4]);
    P(43, 5, 10, 2, "#e8e4da"); P(44, 7, 8, 1, "#fff7df"); // plafón del techo
    px(0, 50, S, 3, "#a95f1f"); px(0, 53, S, 27, "#c9772b");
    for (let y = 55; y < 80; y += 6) px(0, y, S, 1, "#a95f1f");
    for (let x = 4; x < S; x += 8) px(x, 53, 1, 27, "#e39a4a");
  });
  const fg = front(b, (px) => {
    counter(px, "#f4f1ea", "#d9d4c7", "#8d8778", "#3b3f45");
    for (let x = 6; x < S; x += 12) px(x, COUNTER_Y + 8, 1, 1, "#6b7079");
    if (b > 0) { // suelo de goma de la furgo
      px(0, S, S, b, "#2e3135");
      for (let y = S + 2; y < S + b; y += 3) px(0, y, S, 1, "#3a3e44");
    }
  });
  const warm = lamp("255,233,192", 0.18, 7 - off);
  return {
    bg, fg,
    light(ctx, t, reduced) {
      warm(ctx, t, reduced);
      if (reduced) return;
      for (let x = 4, i = 0; x < S; x += 8, i++) if ((Math.floor(t * 3) + i) % 4 === 0) glow(ctx, x + 1, wire(x) + 2 - off, 4, "255,240,200", 0.5);
    },
  };
}

export const SCENES: Record<string, (h: number, b: number) => Scene> = { bar, disco, casa, furgo };

// ---------------------------------------------------------------- objetos de la barra (se compran aparte del fondo)
function stamp(px: Px, rows: string[], pal: Record<string, string>, x0: number, y0: number) {
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) px(x0 + x, y0 + y, 1, 1, pal[ch]); }));
}
const TOE = [ // el dedo gordo del pie de Moreno, de tapa y con banderita
  "...........rr.......",
  "...........rrrr.....",
  "...........rrr......",
  "...........t........",
  "...h.h.h...t........",
  "..h.h.h.ooooooooo...",
  "..ooooooosssSSSsoo..",
  ".oCssddsssssssNNNNo.",
  "oCCsdssdsssssNnnnnNo",
  "oCCsdssdsssssNnnnnNo",
  "oCCssssssssssNNNNNso",
  ".oCdddddddddddddddo.",
  "..ooooooooooooooooo.",
  "..wwwwwwwwwwwwwwwww.",
  "wwwwwwwwwwwwwwwwwwwww",
  ".WWWWWWWWWWWWWWWWWWW.",
];
const TOE_PAL = { o: "#6b3a2a", s: "#e7a987", S: "#f6c9aa", d: "#c2856a", C: "#d98276", n: "#fbeee6", N: "#c9a293", h: "#2a1812", r: "#e4574a", t: "#e3c48d", w: "#f3eee2", W: "#cfc6b3" };
const OBJECTS: Record<string, (px: Px) => void> = {
  olivas(px) {
    px(10, 81, 15, 1, "rgba(0,0,0,0.25)");
    px(10, 78, 14, 1, "#f3eee2");
    px(8, 79, 18, 1, "#f3eee2");
    px(8, 79, 1, 1, "#cfc6b3"); px(25, 79, 1, 1, "#cfc6b3");
    px(9, 80, 16, 1, "#d6cdb9");
    const oliva = (x: number, y: number) => { px(x, y, 3, 2, "#6f8a2e"); px(x, y + 1, 3, 1, "#4c6020"); px(x, y, 1, 1, "#a7c05a"); };
    [[11, 76], [14, 76], [17, 76], [20, 76], [12, 74], [16, 74]].forEach(([x, y]) => oliva(x, y));
    px(18, 70, 1, 2, "#e3c48d"); px(17, 72, 1, 2, "#e3c48d");
  },
  patatas(px) {
    px(9, 76, 16, 1, "#e9e4d8"); px(10, 77, 14, 2, "#d8d0bf"); px(11, 79, 12, 1, "#bdb3a0");
    px(10, 74, 4, 2, "#f2c14e"); px(14, 73, 4, 3, "#e8b23a"); px(18, 74, 4, 2, "#f2c14e"); px(12, 72, 3, 2, "#f7d472"); px(17, 72, 2, 1, "#f7d472");
  },
  lata(px) {
    px(12, 70, 6, 10, "#c8323a"); px(12, 70, 6, 1, "#d9d9d9"); px(13, 69, 4, 1, "#bdbdbd"); px(12, 74, 6, 2, "#f5d66a"); px(13, 71, 1, 8, "#e8606a");
    px(22, 78, 3, 2, "#c9c9c9"); px(25, 79, 4, 1, "#c9c9c9"); px(20, 77, 2, 2, "#ff5f5f");
  },
  coctel(px) {
    for (let i = 0; i < 6; i++) px(10 + i, 70 + i, 13 - 2 * i, 1, i === 0 ? "#e9f7ff" : "#ff5fa8");
    px(16, 76, 1, 3, "#cfe9f5"); px(13, 79, 7, 1, "#cfe9f5");
    px(19, 65, 1, 6, "#e3c48d"); px(18, 62, 3, 1, "#ff7a3f"); px(17, 63, 5, 1, "#ffd23f"); px(16, 64, 7, 1, "#ffd23f");
    px(11, 68, 2, 2, "#d62246");
  },
  dedo(px) { stamp(px, TOE, TOE_PAL, 8, 65); },
};
export function paintObject(px: Px, id: string) { (own(OBJECTS, id) ?? OBJECTS.olivas)(px); }
