import { THUMB_WIDTH, THUMB_HEIGHT, THUMB_QUALITY, THUMB_SEEK_SECONDS, THUMB_SEEK_RATIO, THUMB_TIMEOUT_MS } from "./constants";

export function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

export async function fetchYouTubeMeta(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) { const d = await res.json(); return { title: d.title, channel: d.author_name }; }
  } catch {
    // oEmbed failed, return defaults
  }
  return { title: "YouTube Video", channel: "YouTube Channel" };
}

export function generateThumbnail(file) {
  return new Promise(resolve => {
    const vid = document.createElement("video");
    const url = URL.createObjectURL(file);
    vid.src = url;
    vid.muted = true;
    vid.onloadedmetadata = () => { vid.currentTime = Math.min(THUMB_SEEK_SECONDS, vid.duration * THUMB_SEEK_RATIO); };
    vid.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = THUMB_WIDTH;
      c.height = THUMB_HEIGHT;
      c.getContext("2d").drawImage(vid, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      resolve(c.toDataURL("image/jpeg", THUMB_QUALITY));
      URL.revokeObjectURL(url);
    };
    vid.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    setTimeout(() => resolve(null), THUMB_TIMEOUT_MS);
  });
}

export function fmtSize(b) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isInstagramUrl(url) {
  return /instagram\.com\/(p|reel|tv|stories)\/[\w-]+/.test(url);
}

export function isFacebookUrl(url) {
  return /(?:facebook\.com\/.*\/videos|fb\.watch|facebook\.com\/reel\/)/.test(url);
}
