"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { mountUli, type Hud } from "@/lib/uli";
import { ICON_SVG, SCENES, glassesSprite, layer, paintObject, paintShirtExtension, type IconName } from "@/lib/uli-art";
import { CATALOG, buy, equip, finish, fresh, loadSave, spend, storeSave, type Item, type Kind, type PowerId, type Result, type Save } from "@/lib/tienda";

const n = (v: number, uno: string, varios: string) => `${v} ${v === 1 ? uno : varios}`;
const POWERS = CATALOG.filter((i) => i.kind === "power" && i.id !== "raya"); // la raya no tiene botón: salta sola
const TABS: [Kind, string][] = [["power", "Power-ups"], ["camisa", "Camisas"], ["gafas", "Gafas"], ["fondo", "Fondos"], ["objeto", "Objetos"]];
const KEYS: Record<string, PowerId> = { "1": "agua", a: "agua", "2": "hostia", h: "hostia" };
const SEGMENTS = 12;

type Screen = "menu" | "shop" | "play" | "over";
type Over = Result & { coins: number; nuevo: boolean };

// Icono pixel art como SVG: nítido a cualquier tamaño.
export function Px({ name, size = 16 }: { name: IconName; size?: number }) {
  const ic = ICON_SVG[name];
  return (
    <svg className="px-icon" width={Math.round((size * ic.w) / ic.h)} height={size} viewBox={`0 0 ${ic.w} ${ic.h}`} shapeRendering="crispEdges" aria-hidden="true">
      {ic.paths.map(([fill, d]) => <path key={fill} fill={fill} d={d} />)}
    </svg>
  );
}
export const Chicles = ({ v, size = 14 }: { v: number; size?: number }) => (
  <span className="px-chicles" aria-label={n(v, "chicle", "chicles")}><Px name="chicle" size={size} />{v}</span>
);

export function Game({ font, className = "" }: { font: string; className?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof mountUli>>(null);
  const [save, setSave] = useState<Save>(fresh);
  const [hud, setHud] = useState<Hud>({ canas: 0, nivel: "Sobrio", frac: 0, gafas: "En su sitio", playing: false });
  const [screen, setScreen] = useState<Screen>("menu");
  const [over, setOver] = useState<Over | null>(null);
  const [sound, setSound] = useState(true);
  const [tab, setTab] = useState<Kind>("power");

  const commit = (s: Save) => { setSave(s); storeSave(s); };

  // La partida guardada solo existe en el navegador: se lee después de hidratar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSave(loadSave()), []);

  const onOver = useEffectEvent((r: Result) => {
    const f = finish(save, r);
    commit(f.save);
    setOver({ ...r, coins: f.coins, nuevo: f.nuevo });
    setScreen("over");
  });
  // Justo antes de que se caigan las gafas: si queda una raya, se gasta sola y salva la partida.
  const onRescue = useEffectEvent(() => {
    const s = spend(save, "raya");
    if (s) commit(s);
    return !!s;
  });
  useEffect(() => {
    const g = mountUli({ canvas: canvas.current!, stage: stage.current! }, { font, onHud: setHud, onOver: (r) => onOver(r), onRescue: () => onRescue() });
    game.current = g;
    return () => g.destroy();
  }, [font]);
  useEffect(() => game.current?.setLook(save.equip), [save.equip]);

  const start = () => { game.current?.start(); setScreen("play"); };
  const toMenu = () => { game.current?.menu(); setScreen("menu"); };
  const openShop = (kind?: Kind) => { if (kind) setTab(kind); setScreen("shop"); };
  const toggleSound = () => { game.current?.sound(!sound); setSound(!sound); };

  // Sin power-up en el bolsillo, el botón lo compra y lo usa en el mismo toque.
  const firePower = (id: PowerId) => {
    const s = save.inv[id] > 0 ? save : buy(save, id);
    if (!s || !game.current?.power(id)) return;
    commit(spend(s, id)!);
  };
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape" && screen === "shop") toMenu();
    else if (KEYS[e.key] && !e.repeat) firePower(KEYS[e.key]);
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const act = (it: Item) => {
    const s = it.kind !== "power" && save.owned.includes(it.id) ? equip(save, it.id) : buy(save, it.id);
    if (s) commit(s);
  };
  const share = async () => {
    const text = over?.level
      ? `Le he aguantado ${n(over.level, "caña", "cañas")} a Uli sin que se le caigan las gafas 🕶️🍺 ¿Me superas?`
      : `Súbele las gafas a Uli 🕶️🍺`;
    const data = { text, url: location.href };
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(`${text} ${data.url}`);
    alert("Enlace copiado");
  };

  const cosmetics = CATALOG.filter((i) => i.kind !== "power" && !save.owned.includes(i.id)).sort((a, b) => a.price - b.price);
  const affordable = cosmetics.find((i) => i.price <= save.coins);
  const next = cosmetics.find((i) => i.price > save.coins);
  const lit = Math.round(hud.frac * SEGMENTS);
  const tone = hud.frac < 0.4 ? "ok" : hud.frac < 0.75 ? "warn" : "bad";

  return (
    <div className={`game ${className}`}>
      <div className="game-frame">
        <div className="stage" ref={stage}>
          <canvas ref={canvas} aria-label="Uli en la barra. Toca para subirle las gafas." />

          <div className="game-hud">
            <div className="game-stats">
              <span title="Cañas"><Px name="cana" size={16} />{hud.canas}</span>
              <span title="Récord"><Px name="record" size={16} />{save.best}</span>
              <span title="Chicles"><Chicles v={save.coins} size={16} /></span>
              {save.inv.raya > 0 && <span title="Rayas: saltan solas cuando se le van a caer las gafas"><Px name="raya" size={12} />{save.inv.raya}</span>}
              <button className="px-btn ghost small sound" onClick={toggleSound} aria-pressed={sound} aria-label="Sonido">
                <Px name={sound ? "sonido" : "mute"} size={14} />
              </button>
            </div>
            <div className="game-meter" role="meter" aria-label="Gafas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.frac * 100)} aria-valuetext={hud.gafas}>
              <span>Gafas</span>
              <i>{Array.from({ length: SEGMENTS }, (_, i) => <b key={i} className={i < lit ? tone : ""} />)}</i>
              <b className="game-nivel">{hud.nivel}</b>
            </div>
          </div>

          {screen === "menu" && (
            <div className="game-menu">
              <h2 className="px-title"><span>Las gafas</span><span>de Uli</span></h2>
              <div className="game-menu-actions">
                <button className="px-btn big" onClick={start} autoFocus>Jugar</button>
                <button className="px-btn pink" onClick={() => openShop()}>Tienda</button>
              </div>
            </div>
          )}

          {screen === "play" && (
            <div className="game-powers">
              {POWERS.map((p) => {
                const id = p.id as PowerId;
                const have = save.inv[id];
                return (
                  <button
                    key={id}
                    className="px-btn power"
                    disabled={!hud.playing || (have === 0 && save.coins < p.price)}
                    aria-label={`${p.name}: ${p.desc}`}
                    aria-keyshortcuts={id === "agua" ? "1" : "2"}
                    onClick={(e) => { e.currentTarget.blur(); firePower(id); }}
                  >
                    <Px name={id} size={26} />
                    <span>{have > 0 ? `×${have}` : <Chicles v={p.price} size={10} />}</span>
                  </button>
                );
              })}
            </div>
          )}

          {screen === "over" && over && (
            <div className="game-over">
              <div className="px-panel">
                <h2>¡Se le han caído!</h2>
                <p>
                  Aguantó {n(over.level, "caña", "cañas")}.
                  {over.pokes === 0 ? " Ni un dedo en el ojo." : ` Dedo en el ojo: ${over.pokes}.`}
                  {over.perfect > 0 && ` Perfectos: ${over.perfect}.`}
                </p>
                <div className="game-won">
                  +<Chicles v={over.coins} size={20} />
                  {over.nuevo && <span className="game-rec"><Px name="record" size={14} />Récord</span>}
                </div>
                {affordable ? (
                  <button className="px-link" onClick={() => openShop(affordable.kind)}>Ya puedes comprar: {affordable.name}</button>
                ) : next && <p>Te faltan <Chicles v={next.price - save.coins} /> para {next.name}</p>}
                <div className="game-over-actions">
                  <button className="px-btn" onClick={start} autoFocus>Otra ronda</button>
                  <button className="px-btn pink" onClick={() => openShop()}>Tienda</button>
                  <button className="px-btn ghost" onClick={share}>Compartir</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {screen === "shop" && (
          <div className="shop" role="dialog" aria-label="Tienda">
            <div className="shop-head">
              <button className="px-btn ghost small" onClick={toMenu}>Volver</button>
              <h2>Tienda</h2>
              <Chicles v={save.coins} size={16} />
            </div>
            <div className="shop-tabs" role="tablist">
              {TABS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
            <div className="shop-grid">
              {CATALOG.filter((i) => i.kind === tab).map((it) => {
                const power = it.kind === "power";
                const owned = !power && save.owned.includes(it.id);
                const on = owned && Object.values(save.equip).includes(it.id);
                return (
                  <div key={it.id} className={`shop-item ${on ? "on" : ""}`}>
                    <Thumb item={it} />
                    <div className="shop-name">{it.name}</div>
                    {power && <div className="shop-desc">{it.desc}. Tienes {save.inv[it.id as PowerId]}.</div>}
                    {on ? <span className="shop-on">Puesto</span> : (
                      <button className={`px-btn small ${owned ? "ghost" : ""}`} disabled={!owned && save.coins < it.price} onClick={() => act(it)}>
                        {owned ? "Ponérselo" : <Chicles v={it.price} size={12} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

let gafasPng: Promise<HTMLImageElement> | null = null;
const loadGafas = () => (gafasPng ??= new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im);
  im.src = "/game/gafas.png";
}));

// Miniatura pintada con el mismo arte que el juego.
function Thumb({ item }: { item: Item }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    let live = true;
    if (item.kind === "fondo") {
      const s = SCENES[item.id](96, 0);
      c.width = c.height = 96;
      g.drawImage(s.bg, 0, 0);
      g.drawImage(s.fg, 0, 0);
    } else if (item.kind === "camisa") {
      c.width = 42; c.height = 26;
      g.drawImage(layer((px) => paintShirtExtension(px, item.id)), 3, 47, 42, 26, 0, 0, 42, 26);
    } else if (item.kind === "objeto") {
      c.width = 36; c.height = 22;
      g.drawImage(SCENES.bar(96, 0).fg, 2, 62, 36, 22, 0, 0, 36, 22);
      g.drawImage(layer((px) => paintObject(px, item.id)), 2, 62, 36, 22, 0, 0, 36, 22);
    } else if (item.kind === "gafas") {
      loadGafas().then((im) => {
        if (!live) return;
        c.width = 32; c.height = 8;
        g.drawImage(glassesSprite(im, item.id), 0, 0);
      });
    }
    return () => { live = false; };
  }, [item]);
  if (item.kind === "power") return <div className="shop-thumb"><Px name={item.id as IconName} size={48} /></div>;
  return <div className={`shop-thumb shop-${item.kind}`}><canvas ref={ref} aria-hidden="true" /></div>;
}
