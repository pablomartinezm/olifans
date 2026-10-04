"use client";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { PJS, type Pj } from "@/lib/chicle-art";
import { mountTapper, tapReward, type TapRun } from "@/lib/tapper";
import { fresh, loadSave, storeSave, type Save } from "@/lib/tienda";
import { Picker } from "./chicle";
import { Chicles, Px } from "./game";

const RECORD = "tapper-record";
const PJ_KEY = "tapper-pj";
const n = (v: number, uno: string, varios: string) => `${v} ${v === 1 ? uno : varios}`;
type Screen = "menu" | "play" | "over";
type Over = TapRun & { coins: number; nuevo: boolean };

// «Tapper de la despe». Eliges quién pone las cañas; los chicles van a la hucha común de los juegos.
export function Tapper({ font, textFont, className = "" }: { font: string; textFont: string; className?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof mountTapper>>(null);
  const pjRef = useRef<Pj>("uli"); // el motor se monta antes de leer la elección guardada
  const [save, setSave] = useState<Save>(fresh);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>("menu");
  const [over, setOver] = useState<Over | null>(null);
  const [sound, setSound] = useState(true);
  const [pj, setPj] = useState<Pj>("uli");
  const name = PJS.find((p) => p.id === pj)!.name;

  // Partida guardada, récord y camarero elegido solo existen en el navegador: se leen después de hidratar.
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

  const onOver = useEffectEvent((r: TapRun) => {
    const s = loadSave(); // releída: otro juego puede haber gastado chicles en otra pestaña
    const nuevo = r.score > best;
    const coins = tapReward(r, nuevo);
    const next = { ...s, coins: s.coins + coins };
    storeSave(next);
    setSave(next);
    if (nuevo) {
      setBest(r.score);
      try { localStorage.setItem(RECORD, String(r.score)); } catch {}
    }
    setTimeout(() => { setOver({ ...r, coins, nuevo }); setScreen("over"); }, 900); // que se vea el cierre
  });
  useEffect(() => {
    const g = mountTapper({ canvas: canvas.current!, stage: stage.current! }, { font, textFont, onOver: (r) => onOver(r) });
    game.current = g;
    g.setPlayer(pjRef.current);
    return () => g.destroy();
  }, [font, textFont]);

  const start = () => { game.current?.start(); setScreen("play"); };
  const toggleSound = () => { game.current?.sound(!sound); setSound(!sound); };
  const share = async () => {
    const text = over?.served
      ? `He servido a ${n(over.served, "colega", "colegas")} en la despedida, ${n(over.score, "punto", "puntos")} 🍺 ¿Me superas?`
      : "Pon cañas a la cuadrilla antes de que lleguen al grifo 🍺";
    const data = { text, url: location.href };
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(`${text} ${data.url}`);
    alert("Enlace copiado");
  };

  return (
    <div className={`game ${className}`}>
      <div className="game-frame">
        <div className="stage" ref={stage}>
          <canvas ref={canvas} aria-label="Cuatro barras de bar. Toca una barra para ir a ella y la barra en la que estás para servir una caña." />

          {screen === "menu" && (
            <div className="game-menu flappy-menu">
              <h2 className="px-title"><span>Tapper</span><span>de la despe</span></h2>
              <div className="flappy-actions">
                <Picker pj={pj} onPick={choose} label="Quién pone las cañas" />
                <div className="game-stats">
                  <span title="Récord"><Px name="record" size={16} />{best}</span>
                  <span title="Chicles"><Chicles v={save.coins} size={16} /></span>
                  <button className="px-btn ghost small sound" onClick={toggleSound} aria-pressed={sound} aria-label="Sonido">
                    <Px name={sound ? "sonido" : "mute"} size={14} />
                  </button>
                </div>
                <button className="px-btn big" onClick={start} autoFocus>Abrir la barra</button>
                <Link className="px-link" href="/juego">Gasta los chicles en Las gafas de Uli</Link>
              </div>
            </div>
          )}

          {screen === "over" && over && (
            <div className="game-over">
              <div className="px-panel">
                <h2>¡Cerramos!</h2>
                <p>
                  {name} sirvió a {n(over.served, "colega", "colegas")} y llegó a la ronda {over.wave}.
                  {over.tips > 0 && ` Propinas de Hugo: ${over.tips}.`}
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
