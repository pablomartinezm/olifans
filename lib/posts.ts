import { list, type ListBlobResultBlob } from "@vercel/blob";
import { cache } from "react";
import { fmtPrice, site } from "./site";

export type Media = { url: string; kind: "image" | "video" };
export type Post = { id: string; date: string; text: string; media: Media[] };
export type Comment = { id: string; name: string; text: string; date: string };
export type FeedPost = Post & { likes: number; mine: boolean; comments: Comment[]; price?: string };

// Store layout:
//   posts/<chat_id>.<media_group_id or message_id>/<message_id>.<jpg|mp4>        (every blob knows its Telegram message)
//   posts/<post id>/<message_id>-<random>.txt   captions; an edit writes a new one and deletes the old
//   likes/<post id>/<client id>            comments/<post id>/<timestamp>-<rand>.json
//   fans/<client id>                        ppv/<post id>/<price>  (the post shows blurred until "paid")
//   profile/<avatar|cover|bio|bizum>-<random>.<jpg|txt>                          (newest wins, see getProfile)
// Every blob whose content we read is written once and never overwritten (edits create a new random URL), so
// contents can be cached per instance forever. Fluid compute reuses instances, so the cache pays off.
const contents = new Map<string, Promise<string>>();
const content = (b: ListBlobResultBlob) => {
  if (!contents.has(b.url)) contents.set(b.url, fetch(b.url, { cache: "no-store" }).then((r) => r.text()));
  return contents.get(b.url)!;
};
const parts = (b: ListBlobResultBlob) => b.pathname.split("/"); // [folder, id, file]
const msgId = (b: ListBlobResultBlob) => parseInt(parts(b)[2]); // "999-AbC.txt" → 999

export async function listAll(prefix: string) {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function getPosts(): Promise<Post[]> {
  const groups = new Map<string, ListBlobResultBlob[]>();
  for (const b of await listAll("posts/")) {
    const id = parts(b)[1];
    groups.set(id, [...(groups.get(id) ?? []), b]);
  }
  const posts = await Promise.all(
    [...groups].map(async ([id, blobs]) => {
      blobs.sort((a, b) => msgId(a) - msgId(b) || +a.uploadedAt - +b.uploadedAt);
      const txtAll = blobs.filter((b) => b.pathname.endsWith(".txt"));
      const txt = [...new Map(txtAll.map((b) => [msgId(b), b])).values()]; // newest caption per message wins
      return {
        id,
        date: blobs.reduce((d, b) => (b.uploadedAt < d ? b.uploadedAt : d), blobs[0].uploadedAt).toISOString(),
        text: (await Promise.all(txt.map(content))).join("\n"),
        media: blobs
          .filter((b) => !txtAll.includes(b))
          .map((b) => ({ url: b.url, kind: b.pathname.endsWith(".mp4") ? ("video" as const) : ("image" as const) })),
      };
    }),
  );
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

// Likes, comments, fan count and paywalls. `cid` is the viewer's anonymous cookie, to mark which likes are theirs.
export async function getSocial(cid?: string) {
  const [likes, comments, fans, ppvBlobs] = await Promise.all([listAll("likes/"), listAll("comments/"), listAll("fans/"), listAll("ppv/")]);
  const ppv = new Map<string, string>();
  for (const b of ppvBlobs) ppv.set(parts(b)[1], fmtPrice(parseFloat(parts(b)[2]) || site.ppvPrice));
  const likesBy = new Map<string, { count: number; mine: boolean }>();
  for (const b of likes) {
    const [, post, who] = parts(b);
    const cur = likesBy.get(post) ?? { count: 0, mine: false };
    likesBy.set(post, { count: cur.count + 1, mine: cur.mine || who === cid });
  }
  const all = await Promise.all(
    comments.map(async (b) => {
      const c = await content(b).then(JSON.parse).catch(() => null);
      return c && { post: parts(b)[1], id: b.pathname, name: String(c.name), text: String(c.text), date: b.uploadedAt.toISOString() };
    }),
  );
  const commentsBy = new Map<string, Comment[]>();
  for (const c of all.filter(Boolean).sort((a, b) => a!.date.localeCompare(b!.date))) {
    const { post, ...rest } = c!;
    commentsBy.set(post, [...(commentsBy.get(post) ?? []), rest]);
  }
  return { likesBy, commentsBy, fans: fans.length, ppv };
}

// Profile images and texts are written with a random suffix and the old one deleted, so the URL changes on
// every update and the CDN cache never serves a stale version. Newest wins.
export const getProfile = cache(async () => {
  const blobs = await listAll("profile/");
  const newest = (p: string) =>
    blobs.filter((b) => b.pathname.startsWith(p)).sort((a, b) => +b.uploadedAt - +a.uploadedAt)[0];
  const text = (p: string) => { const b = newest(p); return b ? content(b) : undefined; };
  return { avatar: newest("profile/avatar")?.url, cover: newest("profile/cover")?.url, bio: await text("profile/bio"), bizum: await text("profile/bizum") };
});
