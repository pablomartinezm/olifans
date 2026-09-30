import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { cookies } from "next/headers";
import { AutoRefresh, Avatar, Feed, Search, ShareButton, Subscribe, TipButton } from "@/components/client";
import { Icon, Verified } from "@/components/icons";
import { BottomBar, Nav } from "@/components/nav";
import { getPosts, getProfile, getSocial, type FeedPost, type Post } from "@/lib/posts";
import { site } from "@/lib/site";
import { syncDeletedSoon } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const compact = (n: number) => new Intl.NumberFormat("es", { notation: "compact" }).format(n);

// Link previews in WhatsApp / Telegram: name, bio and the cover as the card image.
export async function generateMetadata(): Promise<Metadata> {
  const p = await getProfile().catch(() => ({ bio: undefined, cover: undefined, avatar: undefined }));
  const title = `${site.name} (@${site.handle}) · Olifans`;
  const description = p.bio ?? site.bio;
  const images = [p.cover ?? p.avatar].filter((u): u is string => !!u);
  return {
    title,
    description,
    openGraph: { title, description, images, type: "profile", siteName: "Olifans" },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images },
  };
}

export default async function Page() {
  after(syncDeletedSoon); // mirror Telegram deletions once the page has been served
  const cid = (await cookies()).get("cid")?.value;
  const [posts, profile, social] = await Promise.all([
    getPosts().catch((): Post[] => []), // no Blob token yet → empty feed instead of a crash
    getProfile().catch(() => ({ avatar: undefined, cover: undefined, bio: undefined, bizum: undefined })),
    getSocial(cid).catch(() => ({ likesBy: new Map(), commentsBy: new Map(), fans: 0, ppv: new Map<string, string>() })),
  ]);
  const feed: FeedPost[] = posts.map((p) => ({
    ...p,
    likes: social.likesBy.get(p.id)?.count ?? 0,
    mine: social.likesBy.get(p.id)?.mine ?? false,
    comments: social.commentsBy.get(p.id) ?? [],
    price: social.ppv.get(p.id),
  }));
  const media = posts.flatMap((p) => p.media);
  const images = media.filter((m) => m.kind === "image").length;
  const likes = feed.reduce((n, p) => n + p.likes, 0);

  return (
    <div className="app">
      <AutoRefresh />
      <Nav />

      <main className="main">
        <header className="cover">
          {profile.cover && <img src={profile.cover} alt="" />}
          <div className="cover-bar">
            <Icon name="back" />
            <div>
              <div className="cover-name">{site.name} <Verified size={15} /></div>
              <div className="cover-stats">
                <span><Icon name="image" width="15" height="15" /> {images}</span>
                <span><Icon name="video" width="15" height="15" /> {media.length - images}</span>
                <span><Icon name="heart" width="15" height="15" /> {compact(likes)}</span>
                <span title="Suscriptores"><Icon name="users" width="15" height="15" /> {compact(social.fans)}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="head">
          <div className="avatar-row">
            <div className="avatar-wrap"><Avatar src={profile.avatar} size={100} className="avatar-main" /><span className="online" /></div>
            <div className="head-actions">
              <TipButton bizum={profile.bizum} className="icon-btn"><Icon name="tip" width="20" height="20" /></TipButton>
              <ShareButton />
              <button className="icon-btn" aria-label="Más"><Icon name="dots" width="20" height="20" /></button>
            </div>
          </div>
          <h1>{site.name} <Verified size={18} /></h1>
          <div className="handle">@{site.handle} · <span className="status">Disponible ahora</span></div>
          <p className="bio">
            {profile.bio ?? site.bio}
            {"\n\n"}🕶️🍺 Mi juego 👉 <Link href="/juego">{site.website}/juego</Link>
          </p>
          <div className="meta">
            <span><Icon name="pin" width="16" height="16" /> {site.location}</span>
            <span><Icon name="link" width="16" height="16" /> <a href={`https://${site.website}`}>{site.website}</a></span>
          </div>
          <div className="sub-inline">
            <div className="card-title">Suscripción</div>
            <Subscribe />
          </div>
        </section>

        <Feed posts={feed} avatar={profile.avatar} bizum={profile.bizum} />
      </main>

      <aside className="aside">
        <Search />
        <div className="card">
          <div className="card-title">Suscripción</div>
          <Subscribe />
        </div>
        <div className="card">
          <div className="card-title">Sugerencias</div>
          {site.suggestions.map((s, i) => (
            <div key={s.handle} className="sug" style={{ "--i": i } as React.CSSProperties}>
              <span className="sug-price">{s.price}</span>
              <div className="avatar avatar-fallback" style={{ width: 56, height: 56, fontSize: 24 }}>{s.name[0]}</div>
              <div><div className="name">{s.name} <Verified size={14} /></div><div className="handle">@{s.handle}</div></div>
            </div>
          ))}
        </div>
        <p className="foot">Privacidad · Cookies · Términos de uso · © 2026 Olifans</p>
      </aside>

      <BottomBar avatar={profile.avatar} />
    </div>
  );
}
