import type { Metadata } from "next";
import Link from "next/link";
import { Silkscreen } from "next/font/google";
import { Subscribe } from "@/components/client";
import { Game } from "@/components/game";
import { Icon, Verified } from "@/components/icons";
import { BottomBar, Nav } from "@/components/nav";
import { getProfile } from "@/lib/posts";
import { site } from "@/lib/site";

const pixel = Silkscreen({ weight: "700", subsets: ["latin"] }); // fuente pixel de los textos del canvas

export const dynamic = "force-dynamic";

const title = `Las gafas de Uli · ${site.name}`;
const description = "Cada caña se las baja un poco más. Súbeselas antes de que se le caigan. ¿Cuántas aguantas?";
export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: "Olifans", type: "website" },
  twitter: { card: "summary", title, description },
};

export default async function Page() {
  const profile = await getProfile().catch(() => ({ avatar: undefined }));
  return (
    <div className="app">
      <Nav active="" />
      <main className="main">
        <header className="topbar">
          <Link href="/" aria-label="Volver al perfil"><Icon name="back" /></Link>
          <div>
            <div className="name">Las gafas de Uli <Verified size={14} /></div>
            <div className="handle">@{site.handle} · Juego exclusivo</div>
          </div>
        </header>
        <Game font={pixel.style.fontFamily} avatar={profile.avatar} />
      </main>
      <aside className="aside">
        <div className="card">
          <div className="card-title">Suscripción</div>
          <Subscribe />
        </div>
        <p className="foot">Privacidad · Cookies · Términos de uso · © 2026 Olifans</p>
      </aside>
      <BottomBar avatar={profile.avatar} />
    </div>
  );
}
