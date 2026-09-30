import { del } from "@vercel/blob";
import { listAll } from "./posts";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const FIRE = [{ type: "emoji", emoji: "🔥" }];

export async function tg(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  if (!r.ok) throw new Error(r.description);
  return r.result;
}

// Telegram never tells bots about deleted messages, so we probe instead: re-setting our own 🔥 reaction
// on a message that no longer exists fails with "message to react not found", and then its blobs go too.
// ponytail: runs after page views, throttled per instance. A cron would be exact but needs a Pro plan.
let lastSync = 0;
export function syncDeletedSoon() {
  if (!TOKEN || Date.now() - lastSync < 2 * 60_000) return;
  lastSync = Date.now();
  return syncDeleted().catch(console.error);
}

export async function syncDeleted() {
  const byMessage = new Map<string, string[]>(); // "chat:message_id" -> blob urls of that message
  for (const b of await listAll("posts/")) {
    const [, folder, file] = b.pathname.split("/");
    const key = `${folder.split(".")[0]}:${parseInt(file)}`;
    byMessage.set(key, [...(byMessage.get(key) ?? []), b.url]);
  }
  for (const [key, urls] of byMessage) {
    const [chat_id, message_id] = key.split(":");
    try {
      await tg("setMessageReaction", { chat_id, message_id: +message_id, reaction: FIRE });
    } catch (e) {
      // Only a missing message deletes. Rate limits, disabled reactions or a kicked bot leave everything alone.
      if (/message.*not found/i.test(String(e))) await del(urls);
    }
  }
}
