"use client";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { mountChicle, reward, type Run } from "@/lib/chicle";
import { PJS, SPR, svgPaths, type Pj } from "@/lib/chicle-art";
import { fresh, loadSave, storeSave, type Save } from "@/lib/tienda";
import { Chicles, Px } from "./game";

const RECORD = "chicle-record";
const PJ_KEY = "chicle-pj";
const n = (v: number, uno: string, varios: string) => `${v} ${v === 1 ? uno : varios}`;
type Screen = "menu" | "play" | "over";
type Over = Run & { coins: number; nuevo: boolean };

// Cara del personaje, sacada del sprite: nítida a cualquier tamaño. Sanlle, con los brazos abajo.
export function Face({ id }: { id: Pj }) {
  const def = SPR[id === "sanlle" ? "sanlle_kick" : id];
  const cx = def.rows[0].length / 2;
  return (
    <svg viewBox="0 0 20 20" shapeRendering="crispEdges" aria-hidden="true">
      {svgPaths(def, cx - 10, 0, 20, 20).map(([fill, d]) => <path key={fill} fill={fill} d={d} />)}
    </svg>
  );
}

// Selector de personaje: las nueve caras y el nombre del elegido. Lo usan Flappy Chicle y el Tapper.
export function Picker({ pj, onPick, label = "Personaje" }: { pj: Pj; onPick: (id: Pj) => void; label?: string }) {
  return (
    <>
      <div className="pj-pick" role="radiogroup" aria-label={label}>
        {PJS.map((p) => (
          <button key={p.id} role="radio" aria-checked={pj === p.id} aria-label={p.name} title={p.name} className={pj === p.id ? "on" : ""} onClick={() => onPick(p.id)}>
            <Face id={p.id} />
          </button>
        ))}
      </div>
      <div className="pj-name">{PJS.find((p) => p.id === pj)!.name}</div>
    </>
  );
}

// «Flappy Chicle». Los chicles van a la misma hucha que «Las gafas de Uli»; el récord es aparte.
export function Flappy({ font, textFont, className = "" }: { font: string; textFont: string; className?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof mountChicle>>(null);
  const pjRef = useRef<Pj>("uli"); // el motor se monta antes de leer la elección guardada
  const [save, setSave] = useState<Save>(fresh);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>("menu");
  const [over, setOver] = useState<Over | null>(null);
  const [sound, setSound] = useState(true);
  const [pj, setPj] = useState<Pj>("uli");
  const name = PJS.find((p) => p.id === pj)!.name;

  // Partida guardada y récord solo existen en el navegador: se leen después de hidratar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave(loadSave());
    try {
      setBest(parseInt(localStorage.getItem(RECORD) || "0", 10) || 0);
      const saved = localStorage.getItem(PJ_KEY);
      if (PJS.some((p) => p.id === saved)) setPj(saved as Pj);
    } catch {}
  }, []);
  useEffect(() => game.current?.setBest(best), [best]);
  useEffect(() => { pjRef.current = pj; game.current?.setPlayer(pj); }, [pj]);
  const choose = (id: Pj) => {
    setPj(id);
    try { localStorage.setItem(PJ_KEY, id); } catch {}
  };

  const onOver = useEffectEvent((r: Run) => {
    const s = loadSave(); // releída: el otro juego puede haber gastado chicles en otra pestaña
    const nuevo = r.score > best;
    const coins = reward(r, nuevo);
    const next = { ...s, coins: s.coins + coins };
    storeSave(next);
    setSave(next);
    if (nuevo) {
      setBest(r.score);
      try { localStorage.setItem(RECORD, String(r.score)); } catch {}
    }
    setOver({ ...r, coins, nuevo });
    setScreen("over");
  });
  useEffect(() => {
    const g = mountChicle({ canvas: canvas.current!, stage: stage.current! }, { font, textFont, onOver: (r) => onOver(r) });
    game.current = g;
    g.setPlayer(pjRef.current);
    return () => g.destroy();
  }, [font, textFont]);

  const start = () => { game.current?.start(); setScreen("play"); };
  const toggleSound = () => { game.current?.sound(!sound); setSound(!sound); };
  const share = async () => {
    const text = over?.score
      ? `He pasado ${n(over.score, "rollo", "rollos")} soplando chicle con ${name} 🫧 ¿Me superas?`
      : "Sopla chicle con la cuadrilla entre rollos de papel gigantes 🫧";
    const data = { text, url: location.href };
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(`${text} ${data.url}`);
    alert("Enlace copiado");
  };

  return (
    <div className={`game ${className}`}>
      <div className="game-frame">
        <div className="stage" ref={stage}>
          <canvas ref={canvas} aria-label="Uli flota con una pompa de chicle. Toca para soplar." />

          {screen === "menu" && (
            <div className="game-menu flappy-menu">
              <h2 className="px-title"><span>Flappy</span><span>Chicle</span></h2>
              <div className="flappy-actions">
                <Picker pj={pj} onPick={choose} />
                <div className="game-stats">
                  <span title="Récord"><Px name="record" size={16} />{best}</span>
                  <span title="Chicles"><Chicles v={save.coins} size={16} /></span>
                  <button className="px-btn ghost small sound" onClick={toggleSound} aria-pressed={sound} aria-label="Sonido">
                    <Px name={sound ? "sonido" : "mute"} size={14} />
                  </button>
                </div>
                <button className="px-btn big" onClick={start} autoFocus>Jugar</button>
                <Link className="px-link" href="/juego">Gasta los chicles en Las gafas de Uli</Link>
              </div>
            </div>
          )}

          {screen === "over" && over && (
            <div className="game-over">
              <div className="px-panel">
                <h2>¡Plof!</h2>
                <p>
                  {name} pasó {n(over.score, "rollo", "rollos")}.
                  {over.gums > 0 && ` Chicles: ${over.gums}.`}
                  {over.bills > 0 && ` Billetes de Hugo: ${over.bills}.`}
                </p>
                <div className="game-won">
                  +<Chicles v={over.coins} size={20} />
                  {over.nuevo && <span className="game-rec"><Px name="record" size={14} />Récord</span>}
                </div>
                <div className="game-over-actions">
                  <button className="px-btn" onClick={start} autoFocus>Otra</button>
                  <button className="px-btn ghost" onClick={share}>Compartir</button>
                </div>
                <Link className="px-link" href="/juego">Gastar chicles en la tienda</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
