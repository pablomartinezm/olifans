// Sonido sintetizado para los juegos: osciladores y ruido, sin ficheros de audio.
// El AudioContext se crea con el primer toque del jugador (los navegadores no dejan antes).
export function createAudio() {
  let ac: AudioContext | null = null;
  let on = true;
  function init() {
    if (!ac) { try { ac = new AudioContext(); } catch { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }
  function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    if (!ac || !on) return;
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
  // Ruido que se apaga; con from/to, un barrido filtrado (la esnifada).
  function noise(dur: number, vol: number, from = 0, to = 0) {
    if (!ac || !on) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (from ? Math.sin((Math.PI * i) / len) : Math.pow(1 - i / len, 3));
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    if (from) {
      const f = ac.createBiquadFilter();
      f.type = "bandpass"; f.Q.value = 2;
      f.frequency.setValueAtTime(from, ac.currentTime);
      f.frequency.exponentialRampToValueAtTime(to, ac.currentTime + dur);
      src.connect(f).connect(g).connect(ac.destination);
    } else src.connect(g).connect(ac.destination);
    src.start();
  }
  return {
    init, tone, noise,
    set(v: boolean) { on = v; if (v) init(); },
    close() { ac?.close().catch(() => {}); },
  };
}
