# Olifans

Parodia de OnlyFans para una despedida de soltero. Next.js + Vercel Blob + bot de Telegram. Todo vive en Vercel: cuando acabe la fiesta se borra el proyecto y listo.

## Puesta en marcha (una sola vez)

1. **Crea el bot**: en Telegram habla con `@BotFather` → `/newbot` → copia el token.
2. **Guarda el token en Vercel**. Espera a que pregunte `Value?` y entonces pega el token (si tecleas antes, guarda lo que estés escribiendo):
   ```bash
   vercel env add TELEGRAM_BOT_TOKEN production
   ```
   Si ya existe con un valor equivocado, primero `vercel env rm TELEGRAM_BOT_TOKEN production --yes`.
3. **Despliega** (cada cambio de variables necesita un despliegue):
   ```bash
   vercel --prod
   ```
4. **Conecta el webhook**: abre https://olifans.vercel.app/api/telegram en el navegador. Debe responder `{"ok":true,"bot":"@tu_bot",...}`. Si dice `Unauthorized`, el token está mal.
5. **Autoriza el chat**. Escribe al bot (o mételo en un grupo **como administrador**, si no, no ve los mensajes). Te contestará con el id del chat. Guárdalo (varios ids van separados por comas) y redespliega:
   ```bash
   vercel env add TELEGRAM_CHAT_IDS production
   vercel --prod
   ```

## Uso del bot

- Foto, vídeo o texto → se publica. Un álbum de fotos → un solo post.
- Si **editas** el mensaje en Telegram, el texto del post se actualiza. Si lo **borras**, el post desaparece de la web.
- `/ppv` respondiendo a un mensaje → el post sale borroso con "Desbloquear por 9,99 €" (pago falso, un toque lo revela). `/ppv 4,99` cambia el precio. Otro `/ppv` lo desbloquea para todos.
- `/borrar` respondiendo a un mensaje → borra ese post al instante. Sin responder a nada → borra el último.
- `/bio texto` → cambia la descripción del perfil.
- `/bizum 612345678` → número que muestra el botón "Enviar propina" de la web.
- `/avatar` o `/portada` como pie de una foto → cambia el avatar o el banner.
- `/ayuda` → lista los comandos. También salen en el menú al escribir `/`.

Sobre los borrados: Telegram no avisa a los bots cuando se borra un mensaje, así que la web lo comprueba ella misma cada vez que alguien la abre (como mucho una vez cada 2 minutos): vuelve a poner el 🔥 del bot en cada mensaje y, si Telegram responde que ya no existe, borra el post. Por eso un post borrado puede tardar una recarga más en desaparecer, y el grupo tiene que tener las reacciones activadas (vienen activadas por defecto).

## La web

- Los likes son reales y compartidos: uno por dispositivo (cookie anónima). Los comentarios piden el nombre la primera vez y lo recuerdan en ese navegador.
- Likes y comentarios viven en el mismo almacén Blob (`likes/` y `comments/`), sin base de datos ni cuentas.
- Los comentarios de la web llegan al grupo de Telegram como respuesta a la foto original.
- El contador de suscriptores de la cabecera cuenta dispositivos distintos que han abierto la web.
- El enlace lleva vista previa (nombre, bio y portada) al compartirlo en WhatsApp o Telegram.
- El feed se refresca solo cada 30 segundos mientras la pestaña está visible.
- La lupa junto a las pestañas (y la caja lateral en escritorio) filtra los posts por texto. El botón de compartir usa el menú nativo del móvil.

## Textos del perfil

Nombre, @usuario, ubicación y "creadores sugeridos": [lib/site.ts](lib/site.ts). Cambia y `vercel --prod`. La bio de ahí es solo el valor inicial: `/bio` la sobrescribe.

## Límites conocidos

- Telegram no deja a los bots descargar archivos de más de 20 MB (vídeos largos fallan con aviso en el chat).
- No hay login: la URL es pública. Si hace falta, activa "Deployment Protection → Password" en el proyecto de Vercel.

## Borrar todo al acabar

```bash
vercel blob delete-store --yes && vercel project rm olifans
```
