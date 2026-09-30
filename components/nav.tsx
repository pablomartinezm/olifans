import Link from "next/link";
import { Avatar } from "./client";
import { Icon, type IconName } from "./icons";

const NAV: [IconName, string][] = [
  ["home", "Inicio"], ["bell", "Notificaciones"], ["message", "Mensajes"], ["bookmark", "Colecciones"],
  ["users", "Suscripciones"], ["card", "Añadir tarjeta"], ["user", "Mi perfil"], ["more", "Más"],
];

export function Nav({ active = "Mi perfil" }: { active?: string }) {
  return (
    <nav className="nav">
      <Link className="logo" href="/"><img src="/logo.svg" alt="OliFans" className="logo-img" /></Link>
      {NAV.map(([icon, label]) => (
        <Link key={label} href="/" className={label === active ? "active" : ""}><Icon name={icon} /><span>{label}</span></Link>
      ))}
      <button className="btn newpost"><Icon name="plus" width="18" height="18" /> Nueva publicación</button>
    </nav>
  );
}

export function BottomBar({ avatar }: { avatar?: string }) {
  return (
    <nav className="bottom">
      <Link href="/"><Icon name="home" /></Link><Icon name="bell" /><Icon name="plus" className="bottom-plus" /><Icon name="message" /><Avatar src={avatar} size={26} />
    </nav>
  );
}
