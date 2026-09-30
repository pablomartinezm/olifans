// Tienda y partida guardada de «Las gafas de Uli». Todo vive en localStorage: sin backend, cada móvil tiene lo suyo.

export type Kind = "power" | "camisa" | "gafas" | "fondo" | "objeto";
export type Item = { id: string; kind: Kind; name: string; price: number; desc?: string };
export type PowerId = "agua" | "hostia" | "raya";
export type Look = { camisa: string; gafas: string; fondo: string; objeto: string };
export type Save = { coins: number; best: number; owned: string[]; equip: Look; inv: Record<PowerId, number> };
export type Result = { level: number; pushes: number; pokes: number; perfect: number };

// ponytail: precios a ojo, en chicles. Una partida normal (5-8 cañas) da 60-120.
export const CATALOG: Item[] = [
  { id: "agua", kind: "power", name: "Agua", price: 40, desc: "Le baja 2 cañas de pedo" },
  { id: "hostia", kind: "power", name: "Hostia", price: 70, desc: "Gafas a su sitio y se le pasa un poco" },
  { id: "raya", kind: "power", name: "Raya de farlopa", price: 150, desc: "Salta sola cuando se le van a caer las gafas: sobrio de golpe, pero todo va a toda leche" },
  { id: "hawaiana", kind: "camisa", name: "Hawaiana", price: 0 },
  { id: "flamencos", kind: "camisa", name: "Flamencos", price: 150 },
  { id: "lenador", kind: "camisa", name: "Leñador", price: 200 },
  { id: "tigre", kind: "camisa", name: "Tigre", price: 250 },
  { id: "leopardo", kind: "camisa", name: "Leopardo", price: 300 },
  { id: "lentejuelas", kind: "camisa", name: "Lentejuelas", price: 450 },
  { id: "clasicas", kind: "gafas", name: "Las de siempre", price: 0 },
  { id: "rosas", kind: "gafas", name: "Rosas", price: 120 },
  { id: "fosforito", kind: "gafas", name: "Fosforito", price: 150 },
  { id: "culo", kind: "gafas", name: "Culo de vaso", price: 200 },
  { id: "sol", kind: "gafas", name: "De sol", price: 250 },
  { id: "doradas", kind: "gafas", name: "De rapero", price: 400 },
  { id: "bar", kind: "fondo", name: "Bar", price: 0 },
  { id: "casa", kind: "fondo", name: "Casa", price: 300 },
  { id: "furgo", kind: "fondo", name: "Furgoneta", price: 450 },
  { id: "disco", kind: "fondo", name: "Gotham City", price: 600 },
  { id: "olivas", kind: "objeto", name: "Olivas", price: 0 },
  { id: "patatas", kind: "objeto", name: "Patatas", price: 100 },
  { id: "lata", kind: "objeto", name: "Lata y llaves", price: 150 },
  { id: "coctel", kind: "objeto", name: "Cóctel", price: 250 },
  { id: "dedo", kind: "objeto", name: "Dedo del pie de Moreno", price: 500 },
];
const byId = new Map(CATALOG.map((i) => [i.id, i]));
const FREE = CATALOG.filter((i) => i.price === 0).map((i) => i.id);
const LOOK_KEY: Record<Exclude<Kind, "power">, keyof Look> = { camisa: "camisa", gafas: "gafas", fondo: "fondo", objeto: "objeto" };

export const fresh = (): Save => ({ coins: 0, best: 0, owned: [...FREE], equip: { camisa: "hawaiana", gafas: "clasicas", fondo: "bar", objeto: "olivas" }, inv: { agua: 0, hostia: 0, raya: 0 } });

// El JSON lo puede haber tocado cualquiera (o estar a medias): se valida campo a campo y lo raro se descarta.
export function parseSave(raw: string | null, legacyBest = 0): Save {
  const s = fresh();
  s.best = legacyBest;
  let d: unknown;
  try { d = JSON.parse(raw ?? "null"); } catch { return s; }
  if (!d || typeof d !== "object") return s;
  const o = d as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  s.coins = num(o.coins);
  s.best = Math.max(legacyBest, num(o.best));
  if (Array.isArray(o.owned)) s.owned = [...new Set([...FREE, ...o.owned.filter((id): id is string => typeof id === "string" && byId.has(id))])];
  const eq = (o.equip ?? {}) as Record<string, unknown>;
  for (const k of ["camisa", "gafas", "fondo", "objeto"] as const) {
    const id = eq[k];
    if (typeof id === "string" && s.owned.includes(id) && byId.get(id)?.kind === k) s.equip[k] = id;
  }
  const inv = (o.inv ?? {}) as Record<string, unknown>;
  s.inv = { agua: num(inv.agua), hostia: num(inv.hostia), raya: num(inv.raya) };
  return s;
}

export function reward(r: Result, nuevo: boolean) {
  return r.level * 10 + r.perfect * 5 + (nuevo ? 25 : 0);
}

export function finish(s: Save, r: Result) {
  const nuevo = r.level > s.best;
  const coins = reward(r, nuevo);
  return { save: { ...s, coins: s.coins + coins, best: Math.max(s.best, r.level) }, coins, nuevo };
}

// Devuelve null si no se puede (sin dinero, ya lo tienes, no existe).
export function buy(s: Save, id: string): Save | null {
  const it = byId.get(id);
  if (!it || s.coins < it.price) return null;
  if (it.kind === "power") return { ...s, coins: s.coins - it.price, inv: { ...s.inv, [id]: s.inv[id as PowerId] + 1 } };
  if (s.owned.includes(id)) return null;
  const k = LOOK_KEY[it.kind];
  return { ...s, coins: s.coins - it.price, owned: [...s.owned, id], equip: { ...s.equip, [k]: id } };
}

export function equip(s: Save, id: string): Save | null {
  const it = byId.get(id);
  if (!it || it.kind === "power" || !s.owned.includes(id)) return null;
  return { ...s, equip: { ...s.equip, [LOOK_KEY[it.kind]]: id } };
}

export function spend(s: Save, id: PowerId): Save | null {
  return s.inv[id] > 0 ? { ...s, inv: { ...s.inv, [id]: s.inv[id] - 1 } } : null;
}

const KEY = "uli-save-v1";
const LEGACY_BEST = "uli-gafas-record";
export function loadSave(): Save {
  try { return parseSave(localStorage.getItem(KEY), parseInt(localStorage.getItem(LEGACY_BEST) || "0", 10) || 0); } catch { return fresh(); }
}
export function storeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
