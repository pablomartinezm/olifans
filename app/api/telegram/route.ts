import { del, put } from "@vercel/blob";
import { getPosts, listAll } from "@/lib/posts";
import { FIRE, tg } from "@/lib/telegram";
import { fmtPrice, site } from "@/lib/site";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED = (process.env.TELEGRAM_CHAT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

type File = { file_id: string; mime_type?: string };
type Msg = {
  message_id: number;
  date: number;
  chat: { id: number };
  media_group_id?: string;
  text?: string;
  caption?: string;
  photo?: File[];
  video?: File;
  animation?: File;
  video_note?: File;
  document?: File;
  reply_to_message?: Msg;
};

// Albums share media_group_id, so every photo of an album lands in the same post folder.
const postId = (m: Msg) => `${m.chat.id}.${m.media_group_id ?? m.message_id}`;
const pub = { access: "public" as const, allowOverwrite: true };
const TXT = { ...pub, contentType: "text/plain; charset=utf-8" };

function pickMedia(m: Msg) {
  const v = m.video ?? m.animation ?? m.video_note;
  if (m.photo?.length) return { file_id: m.photo[m.photo.length - 1].file_id, type: "image/jpeg", ext: "jpg" }; // last = largest
  if (v) return { file_id: v.file_id, type: v.mime_type ?? "video/mp4", ext: "mp4" };
  const d = m.document;
  if (d?.mime_type && /^(image|video)\//.test(d.mime_type)) {
    return { file_id: d.file_id, type: d.mime_type, ext: d.mime_type.startsWith("video/") ? "mp4" : "jpg" };
  }
  return null;
}

async function download(file_id: string) {
  const { file_path } = await tg("getFile", { file_id }); // ponytail: Telegram caps bot downloads at 20 MB; bigger videos fail with a clear error
  return fetch(`https://api.telegram.org/file/bot${TOKEN}/${file_path}`).then((r) => r.arrayBuffer());
}

const COMMANDS = [
  { command: "bio", description: "Cambiar la descripción del perfil: /bio texto" },
  { command: "avatar", description: "Como pie de una foto: la pone de avatar" },
  { command: "portada", description: "Como pie de una foto: la pone de banner" },
  { command: "bizum", description: "Número para las propinas: /bizum 612345678" },
  { command: "ppv", description: "Respondiendo a un post: lo pone de pago (falso). /ppv 4,99 cambia el precio" },
  { command: "borrar", description: "Respondiendo a un post: lo borra" },
  { command: "ayuda", description: "Ver esta ayuda" },
];
const HELP = [
  "Mándame una foto, vídeo o texto y lo publico en Olifans.",
  "Los álbumes salen como un solo post. Si editas o borras el mensaje, la web se actualiza sola.",
  "",
  ...COMMANDS.map((c) => `/${c.command} — ${c.description}`),
].join("\n");

// Replaces the current profile/<kind>* blob with a new one under a fresh random URL (see getProfile).
async function setProfile(kind: string, body: string | ArrayBuffer, contentType: string) {
  const old = await listAll(`profile/${kind}`);
  await put(`profile/${kind}.${contentType.startsWith("text/") ? "txt" : "jpg"}`, body, { ...pub, addRandomSuffix: true, contentType });
  if (old.length) await del(old.map((b) => b.url));
}

async function handle(m: Msg, edited: boolean) {
  const text = (m.text ?? m.caption ?? "").trim().replace(/^(\/\w+)@\w+/, "$1"); // "/bio@OlifansBot" → "/bio"
  const reply = (t: string) => tg("sendMessage", { chat_id: m.chat.id, text: t, reply_to_message_id: m.message_id });
  const media = pickMedia(m);

  if (edited) {
    // Only the caption can change in Telegram. New random URL, old one deleted: no stale cache anywhere.
    if (text.startsWith("/")) return;
    const old = (await listAll(`posts/${postId(m)}/`)).filter((b) => b.pathname.endsWith(".txt") && parseInt(b.pathname.split("/")[2]) === m.message_id);
    if (text) await put(`posts/${postId(m)}/${m.message_id}.txt`, text, { ...TXT, addRandomSuffix: true });
    if (old.length) await del(old.map((b) => b.url));
    return;
  }
  if (/^\/(avatar|portada|banner)\b/.test(text)) {
    if (!media?.type.startsWith("image/")) return reply("Manda una foto con /avatar o /portada como pie de foto");
    const kind = text.startsWith("/avatar") ? "avatar" : "cover";
    await setProfile(kind, await download(media.file_id), media.type);
    return reply(kind === "avatar" ? "🖼 Avatar actualizado" : "🖼 Banner actualizado");
  }
  if (/^\/bio\b/.test(text)) {
    const bio = text.replace(/^\/bio\s*/, "");
    if (!bio) return reply("Escribe la descripción después del comando: /bio Contenido exclusivo de…");
    await setProfile("bio", bio, "text/plain; charset=utf-8");
    return reply("✏️ Descripción actualizada");
  }
  if (/^\/bizum\b/.test(text)) {
    const n = text.replace(/^\/bizum\s*/, "");
    if (!/^\+?[\d\s]{9,20}$/.test(n)) return reply("Escribe el número después del comando: /bizum 612345678");
    await setProfile("bizum", n, "text/plain; charset=utf-8");
    return reply("💸 Bizum actualizado: el botón de propina de la web ya lo muestra");
  }
  if (/^\/ppv\b/.test(text)) {
    if (!m.reply_to_message) return reply("Responde con /ppv al post que quieras poner de pago");
    const dir = `ppv/${postId(m.reply_to_message)}/`;
    const current = await listAll(dir);
    if (current.length) {
      await del(current.map((b) => b.url));
      return reply("🔓 Post desbloqueado para todos");
    }
    const n = parseFloat(text.replace(/^\/ppv\s*/, "").replace(",", "."));
    const price = Number.isFinite(n) && n > 0 ? n : site.ppvPrice;
    await put(`${dir}${price}`, "1", { ...pub, contentType: "text/plain" }); // price lives in the pathname: no content fetch, no cache
    return reply(`🔒 Post de pago: ${fmtPrice(price)}. Otro /ppv lo desbloquea`);
  }
  if (text.startsWith("/borrar")) {
    const id = m.reply_to_message ? postId(m.reply_to_message) : (await getPosts())[0]?.id;
    const blobs = id ? await listAll(`posts/${id}/`) : [];
    if (!blobs.length) return reply("No encuentro ese post");
    await del(blobs.map((b) => b.url));
    return reply("🗑 Post borrado");
  }
  if (text.startsWith("/")) return reply(HELP);
  if (!media && !text) return; // stickers, audio, service messages…

  const dir = `posts/${postId(m)}/${m.message_id}`;
  if (media) await put(`${dir}.${media.ext}`, await download(media.file_id), { ...pub, contentType: media.type });
  if (text) await put(`${dir}.txt`, text, { ...TXT, addRandomSuffix: true });
  await tg("setMessageReaction", { chat_id: m.chat.id, message_id: m.message_id, reaction: FIRE }).catch(() => {});
}

// GET: opening this URL in a browser registers the webhook with Telegram. It only ever points the bot at this
// same site with this same secret, so it is idempotent and needs no auth.
export async function GET() {
  if (!TOKEN || !process.env.TELEGRAM_SECRET) {
    return Response.json({ ok: false, error: "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_SECRET en Vercel" }, { status: 500 });
  }
  const url = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "localhost:3000"}/api/telegram`;
  try {
    const me = await tg("getMe", {});
    await tg("setWebhook", {
      url,
      secret_token: process.env.TELEGRAM_SECRET,
      allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"],
    });
    await tg("setMyCommands", { commands: COMMANDS }); // the "/" menu in Telegram
    return Response.json({
      ok: true,
      bot: `@${me.username}`,
      webhook: url,
      siguiente: "Escribe al bot o mételo en el grupo como administrador: te dirá el chat id para TELEGRAM_CHAT_IDS",
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message, pista: "Si dice Unauthorized, el TELEGRAM_BOT_TOKEN de Vercel está mal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!TOKEN || !process.env.TELEGRAM_SECRET || req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const u = await req.json();
  const edited: Msg | undefined = u.edited_message ?? u.edited_channel_post;
  const m: Msg | undefined = u.message ?? u.channel_post ?? edited;
  if (!m) return Response.json({ ok: true });
  if (!ALLOWED.includes(String(m.chat.id))) {
    await tg("sendMessage", { chat_id: m.chat.id, text: `Chat no autorizado. Añade este id a TELEGRAM_CHAT_IDS: ${m.chat.id}` }).catch(() => {});
    return Response.json({ ok: true });
  }
  try {
    await handle(m, !!edited);
  } catch (e) {
    await tg("sendMessage", { chat_id: m.chat.id, text: `❌ ${(e as Error).message}`, reply_to_message_id: m.message_id }).catch(() => {});
  }
  return Response.json({ ok: true }); // always 200: Telegram would otherwise retry the same update forever
}
