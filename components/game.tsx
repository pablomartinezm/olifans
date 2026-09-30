"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./client";
import { Verified } from "./icons";
import { mountUli, type Hud, type Result } from "@/lib/uli";
import { site } from "@/lib/site";

const n = (v: number, uno: string, varios: string) => `${v} ${v === 1 ? uno : varios}`;

export function Game({ font, avatar }: { font: string; avatar?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof mountUli>>(null);
  const [hud, setHud] = useState<Hud>({ canas: 0, best: 0, nivel: "Sobrio", frac: 0, gafas: "En su sitio" });
  const [screen, setScreen] = useState<"intro" | "play" | "over">("intro");
  const [result, setResult] = useState<Result | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    game.current = mountUli({ canvas: canvas.current!, stage: stage.current! }, {
      font,
      onHud: setHud,
      onOver: (r) => { setResult(r); setScreen("over"); },
    });
    return () => game.current?.destroy();
  }, [font]);

  const start = () => { game.current?.start(); setScreen("play"); };
  const toggleSound = () => { game.current?.sound(!sound); setSound(!sound); };
  const share = async () => {
    const text = result?.level
      ? `Le he aguantado ${n(result.level, "caña", "cañas")} a Uli sin que se le caigan las gafas 🕶️🍺 ¿Me superas?`
      : `Súbele las gafas a Uli 🕶️🍺`;
    const data = { text, url: location.href };
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(`${text} ${data.url}`);
    alert("Enlace copiado");
  };
  const barColor = hud.frac < 0.4 ? "var(--blue)" : hud.frac < 0.75 ? "#f2b35e" : "#e4574a";

  return (
    <div className="game">
      <div className="game-hud">
        <div><span className="game-label">Cañas</span><b className="game-big">{hud.canas}</b></div>
        <div><span className="game-label">Récord</span><b className="game-big">{hud.best}</b></div>
        <div><span className="game-label">Uli va</span><b>{hud.nivel}</b></div>
        <div className="game-gafas">
          <span className="game-label">Gafas <small>{hud.gafas}</small></span>
          <span className="game-bar"><i style={{ width: `${hud.frac * 100}%`, backgroundColor: barColor }} /></span>
        </div>
      </div>

      <div className="stage" ref={stage}>
        <canvas ref={canvas} aria-label="Uli en la barra del bar. Toca para subirle las gafas." />
        {screen !== "play" && (
          <div className="game-overlay">
            <div className="game-card">
              <Avatar src={avatar} size={64} />
              <div className="name">{site.name} <Verified size={14} /></div>
              {screen === "intro" ? (
                <>
                  <h2>Las gafas de Uli</h2>
                  {hud.best > 0 && <p>Tu récord: {n(hud.best, "caña", "cañas")}</p>}
                  <button className="btn" onClick={start} autoFocus>Jugar</button>
                </>
              ) : (
                <>
                  <h2>Se le han caído las gafas</h2>
                  <p>
                    Aguantó {n(result!.level, "caña", "cañas")}.
                    {result!.pokes === 0 ? " Ni un dedo en el ojo." : ` Dedo en el ojo: ${result!.pokes}.`}
                    {result!.perfect > 0 && ` Toques perfectos: ${result!.perfect}.`}
                  </p>
                  <p className="game-record">{result!.nuevo ? "🏆 Nuevo récord" : `Récord: ${n(result!.best, "caña", "cañas")}`}</p>
                  <button className="btn" onClick={start} autoFocus>Otra ronda</button>
                  <button className="btn btn-outline" onClick={share}>Compartir</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="game-foot">
        <button className="game-sound" onClick={toggleSound} aria-pressed={sound}>{sound ? "🔊 Sonido" : "🔇 Silencio"}</button>
      </div>
    </div>
  );
}
