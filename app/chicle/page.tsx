import type { Metadata } from "next";
import Link from "next/link";
import { Pixelify_Sans, Silkscreen } from "next/font/google";
import { Flappy } from "@/components/chicle";
import { Subscribe } from "@/components/client";
import { Icon, Verified } from "@/components/icons";
import { BottomBar, Nav } from "@/components/nav";
import { getProfile } from "@/lib/posts";
import { site } from "@/lib/site";

// Silkscreen para títulos y marcador; Pixelify Sans con cirílico para lo que dice Gon.
const pixel = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-pixel" });
const texto = Pixelify_Sans({ subsets: ["latin", "cyrillic"], variable: "--font-texto" });

export const dynamic = "force-dynamic";

const title = `Flappy Chicle · ${site.name}`;
const description = "Elige a quién de la cuadrilla y sopla chicle entre columnas de rollos de papel gigantes. Cuidado con los colegas.";
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
      <main className="main main-game">
        <header className="topbar">
          <Link href="/" aria-label="Volver al perfil"><Icon name="back" /></Link>
          <div>
            <div className="name">Flappy Chicle <Verified size={14} /></div>
            <div className="handle">@{site.handle} · Juego exclusivo</div>
          </div>
        </header>
        <Flappy font={pixel.style.fontFamily} textFont={texto.style.fontFamily} className={`${pixel.variable} ${texto.variable}`} />
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
