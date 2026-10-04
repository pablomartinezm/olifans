// Mide la dificultad del Tapper: monta lib/tapper.ts con un DOM de mentira y lo juegan bots con reflejos humanos.
//   node tools/tapper-sim.mjs [partidas]
// Por cada bot imprime en qué ronda cierra (percentiles 10-50-90), lo que dura la partida y, ronda a ronda,
// el % de partidas que pierden alguna vida y los segundos que dura. Una curva bien medida sube poco a poco.
process.env.NODE_ENV = "development"; // para que el motor publique window.__tapper

const noop = () => {};
const ctx = new Proxy({}, {
  get: (_, k) => (k === "measureText" ? () => ({ width: 40 }) : k === "createRadialGradient" ? () => ({ addColorStop: noop }) : noop),
  set: () => true,
});
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx });
let frame = null;
Object.assign(globalThis, {
  window: globalThis, devicePixelRatio: 3, addEventListener: noop, removeEventListener: noop,
  matchMedia: () => ({ matches: false }),
  ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: (cb) => { frame = cb; return 1; }, cancelAnimationFrame: noop,
  document: { createElement: canvas, fonts: { load: () => Promise.resolve() } },
});
const { mountTapper } = await import("../lib/tapper.ts");

const rng = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const PASO = 0.8 / 1.3; // los clientes andan a tirones: 0,8 s de cada 1,3

// El bot ve las cosas `look` s después de que aparezcan, toca como mucho cada `tap` s y en un `err` de los toques
// se despista y toca una barra cualquiera (si es la suya, sale una caña de más). Atiende lo más urgente: primero
// estar en la barra a la que llega una jarra vacía, luego servir al cliente al que le queda menos para el grifo.
function bot({ tap, look, err }, seed) {
  const seen = new WeakMap(), rnd = rng(seed * 7919 + 1);
  let next = 0;
  return (T, now) => {
    if (now < next) return null;
    const st = T.st, end = T.TAP();
    const vis = (o) => { if (!seen.has(o)) seen.set(o, now); return now - seen.get(o) >= look; };
    const custs = st.custs.filter((c) => c.st !== "out" && vis(c));
    const E = st.mugs.filter((m) => !m.full && vis(m)).map((m) => ({ bar: m.bar, t: (end - m.x) / 55 })).sort((a, b) => a.t - b.t);
    const U = [];
    for (let b = 0; b < 4; b++) {
      const walking = custs.filter((c) => c.bar === b && c.st === "walk").sort((p, q) => q.x - p.x);
      const flying = st.mugs.filter((m) => m.full && m.bar === b).length; // cada caña en camino ya tiene dueño
      for (const c of walking.slice(flying)) U.push({ bar: b, t: (end - 10 - c.x) / (T.speedOf(c) * PASO) });
    }
    U.sort((a, b) => a.t - b.t);
    const here = st.bar, e = E[0], u = U[0];
    let pick = null;
    if (e && e.t <= tap + 0.15) pick = here !== e.bar ? e.bar : U.some((x) => x.bar === here) ? here : null;
    else if (u) pick = e && e.bar !== u.bar && e.t < (u.bar === here ? 2 : 3) * tap + 0.15 ? (here === e.bar ? null : e.bar) : u.bar;
    else if (e && here !== e.bar) pick = e.bar;
    if (pick === null || (pick === here && st.pour > 0)) return null;
    if (rnd() < err) pick = Math.floor(rnd() * 4);
    next = now + tap;
    return pick;
  };
}

async function play(skill, seed) {
  const r = rng(seed);
  Math.random = r;
  let over = false;
  const stage = { clientWidth: 390, clientHeight: 696, addEventListener: noop, removeEventListener: noop }; // un iPhone
  const api = mountTapper({ canvas: canvas(), stage }, { font: "x", textFont: "y", onOver: () => { over = true; } });
  await new Promise((ok) => setTimeout(ok, 0));
  const T = globalThis.__tapper, b = bot(skill, seed), per = {};
  api.start();
  T.act(0); // el toque de empezar
  let now = 0, lives = T.st.lives;
  while (!over && now < 1800) {
    now += 1 / 60;
    frame(now * 1000);
    const w = (per[T.st.wave] ??= { lost: 0, t: 0 });
    w.t += 1 / 60;
    if (T.st.lives < lives) { w.lost += lives - T.st.lives; lives = T.st.lives; }
    if (T.st.mode === "play") { const p = b(T, now); if (p !== null) T.act(p); }
  }
  api.destroy();
  return { per, wave: T.st.wave, t: now };
}

const runs = +(process.argv[2] || 60);
const BOTS = {
  torpe: { tap: 0.45, look: 0.5, err: 0.12 },
  normal: { tap: 0.33, look: 0.4, err: 0.08 },
  bueno: { tap: 0.25, look: 0.3, err: 0.04 },
};
for (const [name, skill] of Object.entries(BOTS)) {
  const agg = {}, fin = [];
  let time = 0;
  for (let i = 0; i < runs; i++) {
    const g = await play(skill, 1000 + i);
    fin.push(g.wave);
    time += g.t;
    for (const [w, p] of Object.entries(g.per)) {
      const a = (agg[w] ??= { n: 0, hit: 0, t: 0 });
      a.n++; a.hit += p.lost > 0; a.t += p.t;
    }
  }
  fin.sort((a, b) => a - b);
  const rows = Object.values(agg).filter((a) => a.n >= 5);
  const col = (f) => rows.map((a) => String(f(a)).padStart(3)).join(" ");
  console.log(`${name.padEnd(6)} cierra en la ronda ${fin[Math.floor(runs * 0.1)]}-${fin[Math.floor(runs / 2)]}-${fin[Math.floor(runs * 0.9)]}, partida de ${(time / runs / 60).toFixed(1)} min`);
  console.log(`       % pierde vida ${col((a) => Math.round((100 * a.hit) / a.n))}`);
  console.log(`       segundos      ${col((a) => Math.round(a.t / a.n))}`);
}
