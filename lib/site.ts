// ponytail: edita aquí los textos del perfil. Avatar y portada se cambian desde el bot (/avatar, /portada).
export const site = {
  name: "Chicle Oliver",
  handle: "chicle",
  bio: "Contenido exclusivo de mi despedida de soltero 🔥 Suscríbete gratis, que esto se acaba en la boda.",
  location: "Zaragoza",
  website: "olifans.vercel.app",
  price: "GRATIS",
  ppvPrice: 9.99, // precio por defecto de /ppv
  suggestions: [
    { name: "El Padrino", handle: "padrino", price: "GRATIS" },
    { name: "El Cuñado", handle: "cunado", price: "4,99 €" },
    { name: "El Colega del Gym", handle: "gymbro", price: "9,99 €" },
  ],
};


export const fmtPrice = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
