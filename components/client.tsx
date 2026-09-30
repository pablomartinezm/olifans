"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Verified } from "./icons";
import type { Comment, FeedPost } from "@/lib/posts";
import { site } from "@/lib/site";

type Media = FeedPost["media"][number];
type LB = { items: Media[]; i: number };

const fmt = (iso: string) => {
  const ms = Date.now() - +new Date(iso);
  const h = ms / 36e5;
  if (h < 1) return `hace ${Math.max(1, Math.round(ms / 6e4))} min`;
  if (h < 24) return `hace ${Math.round(h)} h`;
  if (h < 48) return "ayer";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

// Anonymous per-device id: likes count once per phone and the server can tell which ones are yours.
function ensureClientId() {
  if (!/(^|; )cid=/.test(document.cookie)) document.cookie = `cid=${crypto.randomUUID()}; max-age=31536000; path=/; samesite=lax`;
}

const post = (body: unknown) => fetch("/api/social", { method: "POST", body: JSON.stringify(body) });

export function Avatar({ src, size, className = "" }: { src?: string; size: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  return src ? (
    <img src={src} alt="" className={`avatar ${className}`} style={style} />
  ) : (
    <div className={`avatar avatar-fallback ${className}`} style={style}>{site.name[0]}</div>
  );
}

export function Subscribe({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);
  return (
    <button className={`btn sub ${className}`} onClick={() => setOn(!on)}>
      <span>{on ? "Suscrito ✓" : "Suscribirse"}</span>
      <span>{on ? "" : `por ${site.price}`}</span>
    </button>
  );
}

// Re-fetches the server-rendered feed every 30 s while the tab is visible. Client state (drafts, viewer) survives.
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && router.refresh();
    const t = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
  return null;
}

export function ShareButton() {
  const share = async () => {
    const data = { title: `${site.name} en Olifans`, url: location.origin };
    if (navigator.share) return navigator.share(data).catch(() => {});
    await navigator.clipboard.writeText(data.url);
    alert("Enlace copiado");
  };
  return <button className="icon-btn" aria-label="Compartir" onClick={share}><Icon name="share" width="20" height="20" /></button>;
}

// The query lives in the URL (?q=), so the desktop sidebar box and the one under the tabs share one state.
export function Search({ className = "search" }: { className?: string }) {
  const q = useSearchParams().get("q") ?? "";
  const set = (v: string) => {
    const u = new URL(location.href);
    if (v) u.searchParams.set("q", v);
    else u.searchParams.delete("q");
    history.replaceState(null, "", u); // Next keeps useSearchParams in sync with native history calls
  };
  return (
    <label className={className}>
      <Icon name="search" width="20" height="20" />
      <input value={q} onChange={(e) => set(e.target.value)} placeholder="Buscar publicaciones" />
    </label>
  );
}

export function TipButton({ bizum, className, children }: { bizum?: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(bizum!.replace(/\s/g, "")).then(() => setCopied(true));
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} aria-label="Enviar propina">{children}</button>
      {open &&
        createPortal(
          <div className="modal-bg" onClick={() => setOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Enviar propina</h3>
              {bizum ? (
                <>
                  <p>Bizum a <b>{site.name}</b></p>
                  <div className="bizum">{bizum}</div>
                  <button className="btn" onClick={copy}>{copied ? "Copiado ✓" : "Copiar número"}</button>
                  <p className="hint">Abre tu app del banco → Bizum → Enviar dinero. El novio lo agradecerá 🍻</p>
                </>
              ) : (
                <p className="hint">El novio aún no ha puesto su Bizum. Que mande <code>/bizum 612345678</code> al bot.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// Full-screen viewer. Click outside, Esc or × closes; arrows, buttons or a swipe move within an album.
function Lightbox({ lb, setLb }: { lb: LB; setLb: (v: LB | null) => void }) {
  const n = lb.items.length;
  const x0 = useRef(0);
  const move = (d: number) => setLb({ ...lb, i: (lb.i + d + n) % n });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  });
  const m = lb.items[lb.i];
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="lb"
      onClick={() => setLb(null)}
      onTouchStart={(e) => (x0.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - x0.current;
        if (n > 1 && Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
      }}
    >
      <button className="lb-x" aria-label="Cerrar">×</button>
      {n > 1 && <button className="lb-nav lb-prev" aria-label="Anterior" onClick={(e) => { stop(e); move(-1); }}>‹</button>}
      {m.kind === "video" ? (
        <video key={m.url} src={m.url} controls autoPlay playsInline onClick={stop} />
      ) : (
        <img key={m.url} src={m.url} alt="" onClick={stop} />
      )}
      {n > 1 && <button className="lb-nav lb-next" aria-label="Siguiente" onClick={(e) => { stop(e); move(1); }}>›</button>}
      {n > 1 && <div className="lb-count">{lb.i + 1} / {n}</div>}
    </div>
  );
}

function MediaGrid({ media, onOpen }: { media: Media[]; onOpen: (i: number) => void }) {
  return (
    <div className="post-media" data-n={Math.min(media.length, 4)}>
      {media.map((m, i) =>
        m.kind === "video" ? (
          <video key={m.url} src={m.url} controls playsInline preload="metadata" />
        ) : (
          <img key={m.url} src={m.url} alt="" loading="lazy" onClick={() => onOpen(i)} />
        ),
      )}
    </div>
  );
}

export function Feed({ posts, avatar, bizum }: { posts: FeedPost[]; avatar?: string; bizum?: string }) {
  const [tab, setTab] = useState<"posts" | "media">("posts");
  const [search, setSearch] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({}); // my like intent per post until the server lists it
  const [added, setAdded] = useState<Record<string, Comment[]>>({}); // my comments until the server lists them
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [lb, setLb] = useState<LB | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]); // paywalls this device has "paid"
  const [paying, setPaying] = useState<string | null>(null);
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  useEffect(() => {
    ensureClientId();
    // Count this device as a fan once. Bots and link previews never run this.
    if (!localStorage.getItem("fan")) post({ kind: "fan" }).then((r) => r.ok && localStorage.setItem("fan", "1")).catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setUnlocked(JSON.parse(localStorage.getItem("unlocked") ?? "[]")); } catch {}
  }, []);
  const unlock = (id: string) => {
    setPaying(id);
    setTimeout(() => {
      setPaying(null);
      const next = [...unlocked, id];
      setUnlocked(next);
      try { localStorage.setItem("unlocked", JSON.stringify(next)); } catch {}
    }, 1200);
  };

  const shown = q ? posts.filter((p) => p.text.toLowerCase().includes(q)) : posts;
  const isLocked = (p: FeedPost) => !!p.price && !unlocked.includes(p.id);
  const media = shown.flatMap((p) => p.media);
  const lockedUrls = new Set(shown.filter(isLocked).flatMap((p) => p.media.map((m) => m.url)));

  const like = (p: FeedPost) => {
    const on = !(pending[p.id] ?? p.mine);
    setPending({ ...pending, [p.id]: on });
    post({ kind: "like", post: p.id, on }).catch(() => {});
  };
  const comment = async (p: FeedPost) => {
    const text = (draft[p.id] ?? "").trim();
    if (!text) return;
    let name = localStorage.getItem("name") ?? "";
    if (!name) {
      name = (prompt("¿Cómo te llamas?") ?? "").trim().slice(0, 30);
      if (!name) return;
      localStorage.setItem("name", name);
    }
    setDraft({ ...draft, [p.id]: "" });
    const r = await post({ kind: "comment", post: p.id, name, text });
    if (r.ok) {
      const c: Comment = await r.json();
      setAdded((a) => ({ ...a, [p.id]: [...(a[p.id] ?? []), c] }));
    }
  };

  return (
    <>
      <div className="tabs">
        <button className={`tab ${tab === "posts" ? "active" : ""}`} onClick={() => setTab("posts")}>{shown.length} publicaciones</button>
        <button className={`tab ${tab === "media" ? "active" : ""}`} onClick={() => setTab("media")}>{media.length} media</button>
        <button className={`tab-filter ${search || q ? "on" : ""}`} aria-label="Buscar" onClick={() => setSearch(!search)}><Icon name="search" width="20" height="20" /></button>
      </div>
      {(search || q) && <div className="search-row"><Search /></div>}

      {tab === "media" ? (
        <div className="grid">
          {media.map((m, i) =>
            lockedUrls.has(m.url) ? (
              <div key={m.url} className="grid-locked">
                {m.kind === "video" ? <video src={m.url} muted playsInline preload="metadata" /> : <img src={m.url} alt="" loading="lazy" />}
                <Icon name="lock" width="32" height="32" />
              </div>
            ) : m.kind === "video" ? (
              <video key={m.url} src={m.url} muted playsInline preload="metadata" onClick={() => setLb({ items: media, i })} />
            ) : (
              <img key={m.url} src={m.url} alt="" loading="lazy" onClick={() => setLb({ items: media, i })} />
            ),
          )}
          {!media.length && <p className="empty">{q ? "Nada con ese texto." : "Todavía no hay fotos ni vídeos."}</p>}
        </div>
      ) : (
        <>
          {shown.map((p) => {
            const mine = pending[p.id] ?? p.mine;
            const likes = p.likes + (mine === p.mine ? 0 : mine ? 1 : -1);
            const comments = [...p.comments, ...(added[p.id] ?? []).filter((c) => !p.comments.some((s) => s.id === c.id))];
            const locked = isLocked(p);
            return (
              <article key={p.id} className="post">
                <div className="post-head">
                  <Avatar src={avatar} size={40} />
                  <div className="who">
                    <div className="name">{site.name} <Verified size={15} /></div>
                    <div className="handle">@{site.handle}</div>
                  </div>
                  <div className="time">
                    <span suppressHydrationWarning>{fmt(p.date)}</span>
                    <Icon name="dots" width="20" height="20" />
                  </div>
                </div>
                <div className={locked ? "locked" : undefined}>
                  {p.text && <p className="post-text">{p.text}</p>}
                  {p.media.length > 0 && <MediaGrid media={p.media} onOpen={(i) => !locked && setLb({ items: p.media, i })} />}
                  {locked && (
                    <div className="paywall">
                      <Icon name="lock" width="44" height="44" />
                      <button className="btn" onClick={() => unlock(p.id)} disabled={paying === p.id}>
                        {paying === p.id ? "Procesando pago…" : `Desbloquear por ${p.price}`}
                      </button>
                      <span>Contenido exclusivo para fans de verdad</span>
                    </div>
                  )}
                </div>
                <div className="post-actions">
                  <button className={mine ? "liked" : ""} onClick={() => like(p)} aria-label="Me gusta"><Icon name="heart" filled={mine} /></button>
                  <button aria-label="Comentar" onClick={() => document.getElementById(`c-${p.id}`)?.focus()}><Icon name="comment" /></button>
                  <TipButton bizum={bizum} className="tipbtn"><Icon name="tip" /> <span>ENVIAR PROPINA</span></TipButton>
                  <button className="right" aria-label="Guardar"><Icon name="bookmark" /></button>
                </div>
                <div className="post-likes">{likes} Me gusta{comments.length > 0 && ` · ${comments.length} comentarios`}</div>
                <div className="comments">
                  {comments.map((c) => (
                    <div key={c.id} className="comment">
                      <div className="avatar avatar-fallback" style={{ width: 28, height: 28, fontSize: 12 }}>{c.name[0]}</div>
                      <div><b>{c.name}</b> {c.text} <span className="c-time" suppressHydrationWarning>{fmt(c.date)}</span></div>
                    </div>
                  ))}
                  <form className="comment-form" onSubmit={(e) => { e.preventDefault(); comment(p); }}>
                    <input id={`c-${p.id}`} value={draft[p.id] ?? ""} onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value })} placeholder="Escribe un comentario…" maxLength={500} />
                    <button type="submit" disabled={!(draft[p.id] ?? "").trim()}>Publicar</button>
                  </form>
                </div>
              </article>
            );
          })}
          {!shown.length && <p className="empty">{q ? "Nada con ese texto." : "Todavía no hay publicaciones. Manda algo al bot de Telegram 📲"}</p>}
        </>
      )}
      {lb && <Lightbox lb={lb} setLb={setLb} />}
    </>
  );
}
