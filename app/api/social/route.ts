import { del, list, put } from "@vercel/blob";
import { cookies } from "next/headers";
import { after } from "next/server";
import { tg } from "@/lib/telegram";

const POST_ID = /^-?\d+\.\d+$/;
const CID = /^[0-9a-f-]{20,40}$/;
const pub = { access: "public" as const, allowOverwrite: true };

// Likes, comments and fan registration from the web. Anonymous by design: one like per device (cookie), any name on comments.
// ponytail: no rate limit; it's a party site with a private URL. Add one if the store fills with junk.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cid = (await cookies()).get("cid")?.value ?? "";

  if (body.kind === "fan") {
    if (!CID.test(cid)) return new Response("Sin id de cliente", { status: 400 });
    await put(`fans/${cid}`, "1", { ...pub, contentType: "text/plain" });
    return Response.json({ ok: true });
  }

  const post = String(body.post ?? "");
  const files = POST_ID.test(post) ? (await list({ prefix: `posts/${post}/`, limit: 1 })).blobs : [];
  if (!files.length) return new Response("Ese post no existe", { status: 400 });

  if (body.kind === "like") {
    if (!CID.test(cid)) return new Response("Sin id de cliente", { status: 400 });
    const path = `likes/${post}/${cid}`;
    if (body.on) await put(path, "1", { ...pub, contentType: "text/plain" });
    else await del(path);
    return Response.json({ ok: true });
  }
  if (body.kind === "comment") {
    const name = String(body.name ?? "").trim().slice(0, 30);
    const text = String(body.text ?? "").trim().slice(0, 500);
    if (!name || !text) return new Response("Faltan nombre o texto", { status: 400 });
    const id = `comments/${post}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
    await put(id, JSON.stringify({ name, text }), { ...pub, contentType: "application/json" });
    // Echo the comment into the Telegram group, threaded under the original photo.
    const message_id = +files[0].pathname.split("/")[2].split(".")[0];
    after(() =>
      tg("sendMessage", {
        chat_id: post.split(".")[0],
        text: `💬 ${name}: ${text}`,
        reply_parameters: { message_id, allow_sending_without_reply: true },
      }).catch(() => {}),
    );
    return Response.json({ id, name, text, date: new Date().toISOString() });
  }
  return new Response("kind desconocido", { status: 400 });
}
