import { useState, useEffect, useRef, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  onSnapshot, writeBatch, getDocs
} from "firebase/firestore";

// ── Firebase config (env variables) ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        "vidvault-7a0ee.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     "vidvault-7a0ee.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
const videosCol   = collection(db, "videos");
const catsCol     = collection(db, "categories");

// ── localStorage migration key ────────────────────────────────────────────────
const LEGACY_KEY    = "vidvault_v2";
const MIGRATED_FLAG = "vidvault_migrated_v1";

// ── IndexedDB (local file blobs only) ────────────────────────────────────────
const DB_NAME    = "vidvault_files_v1";
const STORE_NAME = "blobs";

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = () => reject(req.error);
  });
}
async function storeBlob(id, blob) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
async function getBlob(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}
async function deleteBlob(id) {
  const db = await openIDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
  });
}

// ── Migration: localStorage → Firestore (runs once) ──────────────────────────
async function migrateFromLocalStorage() {
  if (localStorage.getItem(MIGRATED_FLAG)) return;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }
  let legacy;
  try { legacy = JSON.parse(raw); } catch { localStorage.setItem(MIGRATED_FLAG, "1"); return; }
  const { videos = [], categories = [] } = legacy;
  if (!videos.length && !categories.length) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }
  const existing = await getDocs(videosCol);
  if (!existing.empty) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }
  const allDocs = [
    ...videos.map(v => ({ col: videosCol, data: { ...v, type: v.type || "youtube" } })),
    ...categories.map(c => ({ col: catsCol, data: c })),
  ];
  for (let i = 0; i < allDocs.length; i += 400) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + 400).forEach(({ col, data }) => batch.set(doc(col, data.id), data));
    await batch.commit();
  }
  localStorage.setItem(MIGRATED_FLAG, "1");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
async function fetchOEmbed(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) { const d = await res.json(); return { title: d.title, channel: d.author_name }; }
  } catch {}
  return { title: "YouTube Video", channel: "YouTube Channel" };
}
function generateThumbnail(file) {
  return new Promise(resolve => {
    const vid = document.createElement("video");
    const url = URL.createObjectURL(file);
    vid.src = url; vid.muted = true;
    vid.onloadedmetadata = () => { vid.currentTime = Math.min(1.5, vid.duration * 0.08); };
    vid.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = 320; c.height = 180;
      c.getContext("2d").drawImage(vid, 0, 0, 320, 180);
      resolve(c.toDataURL("image/jpeg", 0.75));
      URL.revokeObjectURL(url);
    };
    vid.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    setTimeout(() => resolve(null), 5000);
  });
}
function fmtSize(b) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function saveVideo(video)   { await setDoc(doc(videosCol, video.id), video); }
async function removeVideo(id)    { await deleteDoc(doc(videosCol, id)); }
async function saveCategory(cat)  { await setDoc(doc(catsCol, cat.id), cat); }
async function removeCategory(id) { await deleteDoc(doc(catsCol, id)); }

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = {
  youtube:   { label:"YouTube",   accent:"#ff4d6d", accentBg:"rgba(255,77,109,0.1)",  darkBg:"#150608", border:"#ff4d6d33", emoji:"📺" },
  instagram: { label:"Instagram", accent:"#e1306c", accentBg:"rgba(225,48,108,0.1)",  darkBg:"#150610", border:"#e1306c33", emoji:"📸" },
  facebook:  { label:"Facebook",  accent:"#4a90d9", accentBg:"rgba(74,144,217,0.1)",  darkBg:"#050d18", border:"#4a90d933", emoji:"👍" },
  local:     { label:"Local",     accent:"#06b6d4", accentBg:"rgba(6,182,212,0.1)",   darkBg:"#020e10", border:"#06b6d433", emoji:"🎬" },
};
const PRIORITIES = {
  urgent:  { label:"Urgent",  color:"#ff4d6d", bg:"rgba(255,77,109,0.12)", dot:"#ff4d6d" },
  soon:    { label:"Soon",    color:"#ffb830", bg:"rgba(255,184,48,0.12)",  dot:"#ffb830" },
  someday: { label:"Someday", color:"#4ade80", bg:"rgba(74,222,128,0.12)",  dot:"#4ade80" },
  none:    { label:"None",    color:"#3a3a55", bg:"transparent",            dot:"#3a3a55" },
};
const CAT_COLORS = ["#7c6af7","#f97316","#06b6d4","#ec4899","#84cc16","#f59e0b","#8b5cf6","#10b981"];

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic = ({ d, size=14, sw=2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const Icons = {
  trash:   () => <Ic d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>,
  search:  () => <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" size={15}/>,
  plus:    () => <Ic d="M12 5v14M5 12h14" size={15} sw={2.5}/>,
  tag:     () => <Ic d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" size={13}/>,
  folder:  () => <Ic d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" size={13}/>,
  sort:    () => <Ic d="M3 6h18M7 12h10M11 18h2" size={14}/>,
  x:       () => <Ic d="M18 6L6 18M6 6l12 12" size={11} sw={2.5}/>,
  film:    () => <Ic d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.914L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" size={15}/>,
  upload:  () => <Ic d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" size={16}/>,
  link:    () => <Ic d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" size={15}/>,
  check:   () => <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  play:    ({ size=22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="white" opacity="0.9"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  extLink: () => <Ic d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={13}/>,
  image:   () => <Ic d="M21 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2zM8.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 15l-5-5L5 19" size={14}/>,
  vault:   () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="12" cy="12" r="3"/>
      <path d="M12 9V7M12 17v-2M9 12H7M17 12h-2"/>
    </svg>
  ),
  yt: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.6 2.8 12 2.8 12 2.8s-4.6 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2c0 2.1.3 4.3.3 4.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.3 21.9 12 22 12 22s4.6 0 6.8-.4c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.3v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/>
    </svg>
  ),
  ig: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  ),
  fb: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
};

// ── Local Player Modal ────────────────────────────────────────────────────────
function LocalPlayer({ video, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [err, setErr]         = useState(false);
  useEffect(() => {
    let url;
    getBlob(video.id).then(blob => {
      if (!blob) { setErr(true); return; }
      url = URL.createObjectURL(blob); setBlobUrl(url);
    }).catch(() => setErr(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [video.id]);
  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}>
      <div style={{ width:"100%", maxWidth:920, background:"#0f0f1a", borderRadius:22,
        border:"1px solid #2a2a42", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,.9)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 18px", borderBottom:"1px solid #141424" }}>
          <div>
            <div style={{ fontSize:13.5, fontWeight:600, color:"#d0d0e8" }}>{video.title}</div>
            <div style={{ fontSize:11, color:"#50507a", marginTop:2 }}>
              {video.fileSize ? fmtSize(video.fileSize) : ""} · {video.fileMime || "video"} · device only
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#141424", border:"1px solid #1c1c2e",
            borderRadius:8, padding:"6px 10px", color:"#8080a8", cursor:"pointer",
            display:"flex", alignItems:"center" }}><Icons.x /></button>
        </div>
        <div style={{ background:"#000", aspectRatio:"16/9", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {err
            ? <div style={{ color:"#ff6b8a", fontSize:13, textAlign:"center", padding:30 }}>
                File not found on this device.<br/>
                <span style={{ color:"#50507a", fontSize:11.5 }}>Local files are stored per-device and can't sync to the cloud.</span>
              </div>
            : blobUrl
              ? <video src={blobUrl} controls autoPlay style={{ width:"100%", height:"100%", objectFit:"contain" }}/>
              : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:"#30304a" }}>
                  <div className="spinner" style={{ width:28, height:28, borderWidth:3 }}/>
                  <span style={{ fontSize:12 }}>Loading…</span>
                </div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Social Add Form ───────────────────────────────────────────────────────────
function SocialAddForm({ platform, onAdd, loading, error }) {
  const [formUrl,   setFormUrl]   = useState("");
  const [formTitle, setFormTitle] = useState("");
  const t      = TABS[platform];
  const urlRef = useRef(null);
  useEffect(() => { setTimeout(() => urlRef.current?.focus(), 80); }, [platform]);
  const canSubmit = formUrl.trim() && formTitle.trim() && !loading;
  const handleSubmit = () => {
    if (!canSubmit) return;
    onAdd(formUrl.trim(), formTitle.trim());
    setFormUrl(""); setFormTitle("");
  };
  return (
    <div style={{ background:"#0a0a12", border:`1px solid ${t.border}`, borderRadius:16, padding:20 }}>
      <div style={{ fontSize:12, color:"#50507a", marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ color:t.accent }}>{platform==="instagram" ? <Icons.ig /> : <Icons.fb />}</span>
        Save a {t.label} post or reel — syncs across all your devices
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"#30304a", pointerEvents:"none" }}><Icons.link /></span>
          <input ref={urlRef} value={formUrl} onChange={e => setFormUrl(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handleSubmit()}
            placeholder={`Paste ${t.label} URL…`}
            style={{ width:"100%", background:"#0f0f1a", border:"1px solid #1c1c2e", borderRadius:11,
              padding:"0 14px 0 38px", height:46, color:"#d0d0e8", fontSize:13,
              fontFamily:"inherit", outline:"none" }}
            onFocus={e=>e.target.style.borderColor="#3a3a58"} onBlur={e=>e.target.style.borderColor="#1c1c2e"}/>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handleSubmit()}
            placeholder="Give it a title…"
            style={{ flex:1, background:"#0f0f1a", border:"1px solid #1c1c2e", borderRadius:11,
              padding:"0 14px", height:46, color:"#d0d0e8", fontSize:13,
              fontFamily:"inherit", outline:"none" }}
            onFocus={e=>e.target.style.borderColor="#3a3a58"} onBlur={e=>e.target.style.borderColor="#1c1c2e"}/>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ background:canSubmit?t.accent:"#141424", color:canSubmit?"white":"#30304a",
              border:"none", borderRadius:11, padding:"0 22px", height:46, fontSize:13,
              fontWeight:700, cursor:canSubmit?"pointer":"not-allowed",
              display:"flex", alignItems:"center", gap:7, transition:"all .18s",
              fontFamily:"inherit", flexShrink:0,
              boxShadow:canSubmit?`0 4px 18px ${t.accent}44`:"none" }}>
            {loading ? <div className="spinner"/> : <Icons.plus />}
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && <div style={{ marginTop:8, fontSize:11.5, color:"#ff6b8a" }}>{error}</div>}
    </div>
  );
}

// ── Sync status badge ─────────────────────────────────────────────────────────
function SyncBadge({ status }) {
  const cfg = {
    connecting: { color:"#50507a", label:"Connecting…",           dot:"#50507a" },
    migrating:  { color:"#ffb830", label:"Restoring your videos…", dot:"#ffb830" },
    synced:     { color:"#4ade80", label:"Synced",                 dot:"#4ade80" },
    saving:     { color:"#ffb830", label:"Saving…",                dot:"#ffb830" },
    error:      { color:"#ff6b8a", label:"Sync error",             dot:"#ff6b8a" },
  }[status] || { color:"#50507a", label:"…", dot:"#50507a" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5,
      color:cfg.color, background:"#0f0f1a", border:"1px solid #1c1c2e",
      borderRadius:8, padding:"5px 11px" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot,
        boxShadow: status==="synced" ? `0 0 6px ${cfg.dot}` : "none",
        display:"inline-block", flexShrink:0 }}/>
      {cfg.label}
    </div>
  );
}

// ── Social Thumbnail ──────────────────────────────────────────────────────────
function SocialThumb({ video }) {
  const isIG = video.type === "instagram";
  if (video.thumbnail) {
    return <img src={video.thumbnail} alt={video.title}
      style={{ width:"100%", height:"100%", objectFit:"cover" }}/>;
  }
  const grad = isIG
    ? "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)"
    : "linear-gradient(135deg,#1877f2,#0d5dbf)";
  return (
    <div style={{ width:"100%", height:"100%", background:grad,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
      <div style={{ width:44, height:44, borderRadius:14, background:"rgba(255,255,255,.15)",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          {isIG
            ? <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            : <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          }
        </svg>
      </div>
      <div style={{ fontSize:10.5, color:"rgba(255,255,255,.7)", fontWeight:600, letterSpacing:"0.5px" }}>
        {isIG ? "INSTAGRAM" : "FACEBOOK"}
      </div>
      <div style={{ fontSize:9.5, color:"rgba(255,255,255,.38)" }}>edit → add thumbnail</div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function VideoVault() {
  const [videos,     setVideos]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [syncStatus, setSyncStatus] = useState("connecting");

  const [tab, setTab]                     = useState("youtube");
  const [ytUrl, setYtUrl]                 = useState("");
  const [ytLoading, setYtLoading]         = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [fileLoading, setFileLoading]     = useState(false);
  const [error, setError]                 = useState("");
  const [filter, setFilter]               = useState("all");
  const [catFilter, setCatFilter]         = useState("all");
  const [prioFilter, setPrioFilter]       = useState("all");
  const [search, setSearch]               = useState("");
  const [sortBy, setSortBy]               = useState("newest");
  const [showSort, setShowSort]           = useState(false);
  const [editingCard, setEditingCard]     = useState(null);
  const [newCatName, setNewCatName]       = useState("");
  const [showCatInput, setShowCatInput]   = useState(false);
  const [playerVideo, setPlayerVideo]     = useState(null);

  const ytInputRef = useRef(null);
  const fileRef    = useRef(null);
  const sortRef    = useRef(null);

  // ── Firestore listeners + migration ──────────────────────────────────────
  useEffect(() => {
    setSyncStatus("connecting");
    migrateFromLocalStorage().catch(e => console.warn("Migration:", e));
    const unsubVideos = onSnapshot(videosCol,
      snap => { setVideos(snap.docs.map(d => d.data()).sort((a,b) => b.addedAt - a.addedAt)); setSyncStatus("synced"); },
      () => setSyncStatus("error")
    );
    const unsubCats = onSnapshot(catsCol, snap => setCategories(snap.docs.map(d => d.data())), () => {});
    return () => { unsubVideos(); unsubCats(); };
  }, []);

  useEffect(() => { setFilter("all"); setCatFilter("all"); setPrioFilter("all"); setSearch(""); setError(""); }, [tab]);
  useEffect(() => { if (tab==="youtube") setTimeout(() => ytInputRef.current?.focus(), 80); }, [tab]);
  useEffect(() => {
    const fn = e => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const withSaving = async (fn) => {
    setSyncStatus("saving");
    try { await fn(); setSyncStatus("synced"); }
    catch { setSyncStatus("error"); }
  };

  const handleAddYT = async () => {
    setError("");
    const trimmed = ytUrl.trim();
    if (!trimmed) return;
    const videoId = extractYouTubeId(trimmed);
    if (!videoId) { setError("Paste a valid YouTube URL"); return; }
    if (videos.find(v => v.id === videoId)) { setError("Already in your vault"); return; }
    setYtLoading(true);
    try {
      const meta = await fetchOEmbed(videoId);
      await withSaving(() => saveVideo({
        id:videoId, type:"youtube", title:meta.title, channel:meta.channel,
        thumbnail:`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url:`https://youtube.com/watch?v=${videoId}`,
        watched:false, priority:"none", categories:[], tags:[], note:"", addedAt:Date.now(),
      }));
      setYtUrl("");
    } catch { setError("Couldn't fetch video info."); }
    setYtLoading(false);
  };

  const handleAddSocial = async (platform, url, title) => {
    setError("");
    if (videos.find(v => v.url === url)) { setError("Already in your vault"); return; }
    setSocialLoading(true);
    await withSaving(() => saveVideo({
      id:uid(), type:platform, title, url,
      channel: platform==="instagram" ? "Instagram" : "Facebook",
      thumbnail:null, thumbColor: platform==="instagram" ? "#833ab4" : "#1877f2",
      watched:false, priority:"none", categories:[], tags:[], note:"", addedAt:Date.now(),
    }));
    setSocialLoading(false);
  };

  const handleFiles = async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(""); setFileLoading(true);
    for (const file of files) {
      const id = uid();
      try {
        await storeBlob(id, file);
        const thumb = await generateThumbnail(file);
        await withSaving(() => saveVideo({
          id, type:"local",
          title:file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," "),
          channel:"Local File", thumbnail:thumb, thumbColor:null,
          fileSize:file.size, fileMime:file.type||"video/mp4",
          watched:false, priority:"none", categories:[], tags:[], note:"", addedAt:Date.now(),
        }));
      } catch {}
    }
    setFileLoading(false);
    e.target.value = "";
  };

  const handleDelete = async video => {
    if (video.type === "local") deleteBlob(video.id).catch(() => {});
    await withSaving(() => removeVideo(video.id));
  };

  const updateVideo = async (id, fields) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;
    await withSaving(() => saveVideo({ ...video, ...fields }));
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name || categories.find(c => c.name.toLowerCase()===name.toLowerCase())) return;
    const cat = { id:Date.now().toString(), name, color:CAT_COLORS[categories.length % CAT_COLORS.length] };
    await withSaving(() => saveCategory(cat));
    setNewCatName(""); setShowCatInput(false);
  };
  const deleteCategoryFn = async id => {
    const affected = videos.filter(v => v.categories.includes(id));
    await withSaving(async () => {
      await removeCategory(id);
      for (const v of affected) await saveVideo({ ...v, categories:v.categories.filter(c=>c!==id) });
    });
    if (catFilter === id) setCatFilter("all");
  };
  const toggleVideoCat = async (vid, catId) => {
    const video = videos.find(v => v.id === vid);
    if (!video) return;
    const cats = video.categories.includes(catId)
      ? video.categories.filter(c=>c!==catId)
      : [...video.categories, catId];
    await withSaving(() => saveVideo({ ...video, categories:cats }));
  };
  const addTag = async (vid, tag) => {
    const clean = tag.replace(/^#+/,"").trim().toLowerCase().replace(/\s+/g,"-");
    if (!clean) return;
    const video = videos.find(v => v.id === vid);
    if (!video || video.tags.includes(clean)) return;
    await withSaving(() => saveVideo({ ...video, tags:[...video.tags, clean] }));
  };
  const removeTag = async (vid, tag) => {
    const video = videos.find(v => v.id === vid);
    if (!video) return;
    await withSaving(() => saveVideo({ ...video, tags:video.tags.filter(t=>t!==tag) }));
  };

  const filtered = useMemo(() => {
    let list = videos.filter(v => tab==="youtube" ? (v.type==="youtube"||!v.type) : v.type===tab);
    if (filter==="watched")   list = list.filter(v=>v.watched);
    if (filter==="unwatched") list = list.filter(v=>!v.watched);
    if (catFilter!=="all")    list = list.filter(v=>v.categories.includes(catFilter));
    if (prioFilter!=="all")   list = list.filter(v=>v.priority===prioFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v=>v.title.toLowerCase().includes(q)||v.channel.toLowerCase().includes(q)||v.tags.some(t=>t.includes(q)));
    }
    const ORD = { urgent:0,soon:1,someday:2,none:3 };
    if (sortBy==="newest")   list.sort((a,b)=>b.addedAt-a.addedAt);
    if (sortBy==="oldest")   list.sort((a,b)=>a.addedAt-b.addedAt);
    if (sortBy==="priority") list.sort((a,b)=>ORD[a.priority]-ORD[b.priority]);
    if (sortBy==="title")    list.sort((a,b)=>a.title.localeCompare(b.title));
    return list;
  }, [videos, tab, filter, catFilter, prioFilter, search, sortBy]);

  const countFor   = k => videos.filter(v => k==="youtube" ? (v.type==="youtube"||!v.type) : v.type===k).length;
  const allCurList = videos.filter(v => tab==="youtube" ? (v.type==="youtube"||!v.type) : v.type===tab);
  const curWatched = allCurList.filter(v=>v.watched).length;
  const t = TABS[tab];

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#e2e2f0",
      fontFamily:"'DM Sans',system-ui,sans-serif", paddingBottom:80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Cabinet+Grotesk:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#080810}::-webkit-scrollbar-thumb{background:#22223a;border-radius:2px}
        .card{background:#0f0f1a;border:1px solid #1c1c2e;border-radius:18px;overflow:hidden;transition:all .25s cubic-bezier(.4,0,.2,1);}
        .card:hover{border-color:#2a2a42;transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 0 1px #2a2a42;}
        .card.watched{opacity:.38;filter:saturate(.25);}
        .card.watched:hover{opacity:.6;filter:saturate(.4);}
        .thumb{position:relative;aspect-ratio:16/9;overflow:hidden;background:#0a0a14;cursor:pointer;}
        .thumb img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease;}
        .thumb:hover img{transform:scale(1.05);}
        .play-ov{position:absolute;inset:0;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;}
        .thumb:hover .play-ov{opacity:1;}
        .cbody{padding:14px 15px 15px;}
        .ctitle{font-size:13px;font-weight:500;line-height:1.45;color:#d0d0e8;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .cchan{font-size:11px;color:#50507a;margin-bottom:11px;display:flex;align-items:center;gap:5px;}
        .row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .wcheck{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:11.5px;color:#60608a;transition:color .15s;}
        .wcheck:hover{color:#9090b8;}.wcheck.on{color:#7c6af7;}
        .cbox{width:15px;height:15px;border-radius:5px;border:1.5px solid #2a2a44;background:transparent;display:flex;align-items:center;justify-content:center;transition:all .18s;flex-shrink:0;}
        .wcheck.on .cbox{background:#7c6af7;border-color:#7c6af7;}
        .cbox svg{opacity:0;transition:opacity .15s;}.wcheck.on .cbox svg{opacity:1;}
        .prio-badge{display:flex;align-items:center;gap:4px;border-radius:6px;padding:3px 8px;font-size:10.5px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s;}
        .tag{display:inline-flex;align-items:center;gap:3px;background:#141424;border:1px solid #22223a;border-radius:5px;padding:2px 7px;font-size:10.5px;color:#70709a;}
        .tag-x{background:none;border:none;color:#50506a;cursor:pointer;padding:0;display:flex;align-items:center;transition:color .15s;}
        .tag-x:hover{color:#ff6b8a;}
        .icon-btn{background:none;border:none;cursor:pointer;display:flex;align-items:center;padding:5px;border-radius:7px;transition:all .15s;font-family:inherit;}
        .del-btn{color:#2a2a44;}.del-btn:hover{color:#ff5a7a;background:rgba(255,90,122,.08);}
        .ghost-btn{color:#50507a;border:1px solid #1c1c2e;font-size:11px;padding:4px 9px;border-radius:7px;background:none;cursor:pointer;font-family:inherit;transition:all .15s;}
        .ghost-btn:hover{border-color:#3a3a58;color:#9090b8;}
        .filter-btn{background:none;border:1px solid #1c1c2e;color:#50507a;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit;font-weight:500;white-space:nowrap;}
        .filter-btn:hover{border-color:#3a3a58;color:#9090b8;}
        .filter-btn.on{background:#1a1a2e;border-color:#3a3a58;color:#d0d0f0;}
        .search-wrap{position:relative;}
        .search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#30304a;pointer-events:none;}
        .search-inp{width:100%;background:#0f0f1a;border:1px solid #1c1c2e;border-radius:9px;padding:0 12px 0 34px;height:36px;color:#d0d0e8;font-size:12.5px;font-family:inherit;outline:none;transition:border-color .2s;}
        .search-inp::placeholder{color:#30304a;}.search-inp:focus{border-color:#3a3a58;}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(275px,1fr));gap:16px;}
        .note-ta{width:100%;background:#0a0a14;border:1px solid #1c1c2e;border-radius:8px;padding:8px 10px;color:#8080a8;font-size:11.5px;font-family:inherit;resize:none;outline:none;line-height:1.55;transition:border-color .2s;}
        .note-ta:focus{border-color:#3a3a58;}.note-ta::placeholder{color:#2a2a40;}
        .divider{border:none;border-top:1px solid #141424;margin:10px 0;}
        .cat-pill{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 8px;font-size:10.5px;font-weight:500;cursor:pointer;border:none;font-family:inherit;transition:all .15s;}
        .sort-menu{position:absolute;top:calc(100% + 6px);right:0;background:#0f0f1a;border:1px solid #1c1c2e;border-radius:12px;padding:6px;z-index:50;min-width:155px;box-shadow:0 12px 40px rgba(0,0,0,.7);}
        .sort-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;color:#8080a8;transition:all .15s;white-space:nowrap;}
        .sort-item:hover{background:#141424;color:#d0d0e8;}.sort-item.on{color:#7c6af7;background:#14142a;}
        .spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.15);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
        .prog-track{height:3px;background:#141424;border-radius:3px;overflow:hidden;}
        .prog-fill{height:100%;border-radius:3px;transition:width .6s cubic-bezier(.4,0,.2,1);}
        .empty{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;color:#30304a;gap:10px;text-align:center;}
        .empty h3{font-size:15px;color:#50507a;font-weight:500;}.empty p{font-size:12.5px;color:#30304a;max-width:280px;line-height:1.6;}
        .tag-inp{background:none;border:none;outline:none;color:#9090b8;font-size:11px;font-family:inherit;width:80px;padding:2px 4px;}
        .tag-inp::placeholder{color:#2a2a40;}
        .url-input{flex:1;background:#0f0f1a;border:1px solid #1c1c2e;border-radius:12px;padding:0 16px;height:48px;color:#d0d0e8;font-size:13.5px;font-family:inherit;outline:none;transition:border-color .2s;min-width:0;}
        .url-input::placeholder{color:#30304a;}.url-input:focus{border-color:#3a3a58;}
        .drop-zone{border:1.5px dashed #1c1c2e;border-radius:16px;padding:32px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;cursor:pointer;transition:all .2s;}
        .drop-zone:hover{border-color:#06b6d444;background:#06b6d408;}
        .tab-wrap{display:grid;grid-template-columns:repeat(4,1fr);background:#0a0a14;border:1px solid #1c1c2e;border-radius:16px;padding:5px;gap:4px;}
        .tab-btn{display:flex;align-items:center;justify-content:center;gap:5px;padding:10px 6px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;transition:all .22s cubic-bezier(.4,0,.2,1);background:transparent;white-space:nowrap;}
        .tab-count{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:5px;transition:all .22s;}
        .paste-thumb-btn{display:flex;align-items:center;gap:8px;width:100%;background:#0a0a14;border:1.5px dashed #2a2a44;border-radius:10px;padding:11px 14px;color:#7070a0;font-size:12px;cursor:pointer;font-family:inherit;transition:all .2s;text-align:left;}
        .paste-thumb-btn:hover{border-color:#7c6af7;color:#a0a0d0;background:#0f0f20;}
        @media(max-width:500px){.tab-wrap{grid-template-columns:repeat(2,1fr);}.tab-btn{font-size:11px;padding:9px 6px;}.tab-btn span:first-child{display:none;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cin{animation:fadeUp .28s ease forwards;}
      `}</style>

      {playerVideo && <LocalPlayer video={playerVideo} onClose={() => setPlayerVideo(null)} />}

      <div style={{ maxWidth:1140, margin:"0 auto", padding:"30px 22px 0" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:26 }}>
          <div style={{ display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ width:40, height:40, borderRadius:12,
              background:"linear-gradient(135deg,#7c6af7,#5a4ad1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 20px rgba(124,106,247,.4)" }}>
              <Icons.vault />
            </div>
            <div>
              <div style={{ fontFamily:"'Cabinet Grotesk',system-ui", fontWeight:800, fontSize:20, letterSpacing:"-0.4px" }}>Video Vault</div>
              <div style={{ fontSize:10.5, color:"#30304a", marginTop:1 }}>Synced across all your devices</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <SyncBadge status={syncStatus} />
            {videos.length > 0 && (
              <div style={{ fontSize:12, color:"#50507a", background:"#0f0f1a",
                border:"1px solid #1c1c2e", borderRadius:9, padding:"5px 14px" }}>
                <span style={{ color:"#9090b8", fontWeight:700 }}>{videos.filter(v=>v.watched).length}</span>
                <span style={{ color:"#30304a" }}> / {videos.length} saved</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ Tabs ══ */}
        <div className="tab-wrap" style={{ marginBottom:26 }}>
          {Object.entries(TABS).map(([key, cfg]) => {
            const active  = tab === key;
            const count   = countFor(key);
            const TabIcon = key==="youtube" ? Icons.yt : key==="instagram" ? Icons.ig : key==="facebook" ? Icons.fb : Icons.film;
            return (
              <button key={key} className="tab-btn" onClick={() => setTab(key)} style={{
                background: active ? cfg.darkBg : "transparent",
                color:      active ? cfg.accent  : "#3a3a58",
                boxShadow:  active ? `0 0 0 1px ${cfg.border}, 0 4px 18px ${cfg.accent}18` : "none",
              }}>
                <span style={{ opacity: active ? 1 : 0.45 }}><TabIcon /></span>
                <span style={{ fontSize:12.5 }}>{cfg.label}</span>
                <span className="tab-count" style={{
                  background: active ? cfg.accentBg : "#141424",
                  color:      active ? cfg.accent    : "#30304a",
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Progress ── */}
        {allCurList.length > 0 && (
          <div className="prog-track" style={{ marginBottom:22 }}>
            <div className="prog-fill" style={{
              width:`${(curWatched/allCurList.length)*100}%`,
              background:`linear-gradient(90deg, ${t.accent}, ${t.accent}99)`
            }}/>
          </div>
        )}

        {/* ── Add area ── */}
        {tab === "youtube" && (
          <div style={{ display:"flex", gap:8 }}>
            <input ref={ytInputRef} className="url-input" placeholder="Paste a YouTube URL…"
              value={ytUrl} onChange={e => { setYtUrl(e.target.value); setError(""); }}
              onKeyDown={e => e.key==="Enter" && !ytLoading && handleAddYT()}/>
            <button onClick={handleAddYT} disabled={ytLoading || !ytUrl.trim()}
              style={{ background:ytLoading||!ytUrl.trim()?"#1a0a10":"linear-gradient(135deg,#ff4d6d,#d42f4e)",
                color:ytLoading||!ytUrl.trim()?"#50304a":"white",
                border:"none", borderRadius:12, padding:"0 22px", height:48, fontSize:13,
                fontWeight:700, cursor:ytLoading||!ytUrl.trim()?"not-allowed":"pointer",
                display:"flex", alignItems:"center", gap:7, transition:"all .18s",
                fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0,
                boxShadow:ytLoading||!ytUrl.trim()?"none":"0 4px 18px rgba(255,77,109,.35)" }}>
              {ytLoading ? <div className="spinner"/> : <Icons.plus />}
              {ytLoading ? "Fetching…" : "Add"}
            </button>
          </div>
        )}
        {(tab==="instagram"||tab==="facebook") && (
          <SocialAddForm platform={tab} loading={socialLoading} error={error}
            onAdd={(url,title) => handleAddSocial(tab,url,title)}/>
        )}
        {tab === "local" && (
          <>
            <input ref={fileRef} type="file" accept="video/*" multiple style={{ display:"none" }} onChange={handleFiles}/>
            <div className="drop-zone" onClick={() => fileRef.current?.click()}>
              <div style={{ width:46, height:46, borderRadius:13, background:"#0a0a14",
                border:"1px solid #06b6d422", display:"flex", alignItems:"center",
                justifyContent:"center", color:"#06b6d4" }}>
                <Icons.upload />
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:14, fontWeight:600, color:fileLoading?"#06b6d4":"#7070a0", marginBottom:4 }}>
                  {fileLoading ? "Processing…" : "Click to add local videos"}
                </div>
                <div style={{ fontSize:11.5, color:"#30304a" }}>MP4, MKV, WebM, MOV · select multiple</div>
              </div>
              {fileLoading && <div className="spinner" style={{ borderTopColor:"#06b6d4", borderColor:"rgba(6,182,212,.2)", width:18, height:18 }}/>}
            </div>
            <div style={{ marginTop:8, fontSize:11, color:"#252530", textAlign:"center" }}>
              ⚠️ Local files stay on this device only — metadata syncs, but the file itself does not
            </div>
          </>
        )}
        {tab==="youtube" && error && <div style={{ marginTop:8, fontSize:11.5, color:"#ff6b8a" }}>{error}</div>}

        {/* ── Categories ── */}
        <div style={{ marginTop:20, display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"#40405a", display:"flex", alignItems:"center", gap:4 }}>
            <Icons.folder /> Categories
          </span>
          {categories.map(cat => (
            <div key={cat.id} style={{ display:"flex", alignItems:"center" }}>
              <button className="cat-pill"
                style={{ background:catFilter===cat.id?cat.color+"22":"#0f0f1a",
                  border:`1px solid ${catFilter===cat.id?cat.color+"66":"#1c1c2e"}`,
                  color:catFilter===cat.id?cat.color:"#70709a" }}
                onClick={() => setCatFilter(catFilter===cat.id?"all":cat.id)}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block" }}/>
                {cat.name}
              </button>
              <button className="icon-btn" style={{ color:"#30304a",padding:"3px" }}
                onClick={() => deleteCategoryFn(cat.id)}><Icons.x /></button>
            </div>
          ))}
          {showCatInput ? (
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter")addCategory(); if(e.key==="Escape"){setShowCatInput(false);setNewCatName("");} }}
                placeholder="Category name…" autoFocus
                style={{ background:"#0f0f1a", border:"1px solid #2a2a44", borderRadius:7,
                  padding:"4px 10px", color:"#d0d0e8", fontSize:12, outline:"none",
                  fontFamily:"inherit", width:130 }}/>
              <button className="ghost-btn" onClick={addCategory}>Add</button>
              <button className="icon-btn del-btn" onClick={() => {setShowCatInput(false);setNewCatName("");}}><Icons.x /></button>
            </div>
          ) : (
            <button className="ghost-btn" onClick={() => setShowCatInput(true)}
              style={{ display:"flex", alignItems:"center", gap:4 }}>
              <Icons.plus /> New
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        {allCurList.length > 0 && (
          <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
            {[["all","All"],["unwatched","Unseen"],["watched","Seen"]].map(([v,l]) => (
              <button key={v} className={`filter-btn ${filter===v?"on":""}`} onClick={() => setFilter(v)}>
                {l} {v==="all"?allCurList.length:v==="watched"?curWatched:allCurList.length-curWatched}
              </button>
            ))}
            {Object.entries(PRIORITIES).filter(([k])=>k!=="none").map(([k,p]) => (
              <button key={k} className={`filter-btn ${prioFilter===k?"on":""}`}
                style={prioFilter===k?{borderColor:p.color+"66",color:p.color,background:p.bg}:{}}
                onClick={() => setPrioFilter(prioFilter===k?"all":k)}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:p.dot,display:"inline-block",marginRight:4 }}/>
                {p.label}
              </button>
            ))}
            <div className="search-wrap" style={{ maxWidth:200 }}>
              <span className="search-icon"><Icons.search /></span>
              <input className="search-inp" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div ref={sortRef} style={{ position:"relative", marginLeft:"auto" }}>
              <button className="ghost-btn" style={{ display:"flex", alignItems:"center", gap:5 }}
                onClick={() => setShowSort(s=>!s)}>
                <Icons.sort /> Sort
              </button>
              {showSort && (
                <div className="sort-menu">
                  {[["newest","Newest first"],["oldest","Oldest first"],["priority","By priority"],["title","Title A–Z"]].map(([v,l]) => (
                    <div key={v} className={`sort-item ${sortBy===v?"on":""}`}
                      onClick={() => {setSortBy(v);setShowSort(false);}}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{ maxWidth:1140, margin:"22px auto 0", padding:"0 22px" }}>
        <div className="grid">
          {syncStatus==="connecting" && videos.length===0 && (
            <div className="empty">
              <div className="spinner" style={{ width:28, height:28, borderWidth:3, borderTopColor:"#7c6af7", borderColor:"#1c1c2e" }}/>
              <h3>Connecting to cloud…</h3>
              <p>Restoring your saved videos.</p>
            </div>
          )}
          {syncStatus!=="connecting" && filtered.length===0 && (
            <div className="empty">
              <div style={{ fontSize:38 }}>{t.emoji}</div>
              <h3>{allCurList.length===0 ? `No ${t.label} saves yet` : "No items match"}</h3>
              <p>{allCurList.length===0
                ? tab==="youtube" ? "Paste a YouTube URL above to start."
                : tab==="local"   ? "Click above to add video files from your device."
                : `Paste a ${t.label} URL and give it a title to save it.`
                : "Try adjusting your filters or search."}</p>
            </div>
          )}
          {filtered.map((video,i) => (
            <VideoCard key={video.id} video={video} categories={categories}
              animDelay={i*35} isEditing={editingCard===video.id}
              onToggleEdit={() => setEditingCard(editingCard===video.id?null:video.id)}
              onWatch={() => updateVideo(video.id, { watched:!video.watched })}
              onDelete={() => handleDelete(video)}
              onPriority={p => updateVideo(video.id, { priority:p })}
              onToggleCat={catId => toggleVideoCat(video.id,catId)}
              onAddTag={tag => addTag(video.id,tag)}
              onRemoveTag={tag => removeTag(video.id,tag)}
              onNote={note => updateVideo(video.id, { note })}
              onThumbnail={thumb => updateVideo(video.id, { thumbnail: thumb })}
              onPlay={() => video.type==="local"
                ? setPlayerVideo(video)
                : window.open(video.url||`https://youtube.com/watch?v=${video.id}`,"_blank")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── VideoCard ─────────────────────────────────────────────────────────────────
function VideoCard({ video, categories, animDelay, isEditing, onToggleEdit, onWatch, onDelete, onPriority, onToggleCat, onAddTag, onRemoveTag, onNote, onThumbnail, onPlay }) {
  const [tagInput, setTagInput] = useState("");
  const [thumbMsg, setThumbMsg] = useState("");
  const isSocial  = video.type === "instagram" || video.type === "facebook";
  const isLocal   = video.type === "local";
  const videoCats = categories.filter(c => video.categories.includes(c.id));
  const commitTag = () => { if(tagInput.trim()){onAddTag(tagInput);setTagInput("");} };
  const tabCfg    = TABS[video.type] || TABS.youtube;

  const handlePasteThumb = async () => {
    setThumbMsg("");
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith("image/"));
        if (imgType) {
          const blob = await item.getType(imgType);
          const reader = new FileReader();
          reader.onload = () => {
            onThumbnail(reader.result);
            setThumbMsg("✓ Thumbnail saved!");
            setTimeout(() => setThumbMsg(""), 2500);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      setThumbMsg("No image in clipboard — copy a screenshot first.");
    } catch {
      setThumbMsg("Clipboard access denied — allow it in browser settings.");
    }
  };

  return (
    <div className={`card cin ${video.watched?"watched":""}`} style={{ animationDelay:`${animDelay}ms` }}>
      <div className="thumb" onClick={onPlay}>
        {isSocial
          ? <SocialThumb video={video} />
          : video.thumbnail
            ? <img src={video.thumbnail} alt={video.title} loading="lazy"/>
            : <div style={{ width:"100%",height:"100%",background:"#0a0a14",display:"flex",alignItems:"center",justifyContent:"center",color:"#30304a" }}><Icons.film /></div>
        }
        <div className="play-ov">
          <div style={{ background:"rgba(0,0,0,.55)",borderRadius:"50%",width:50,height:50,
            display:"flex",alignItems:"center",justifyContent:"center" }}>
            {isSocial ? <Icons.extLink /> : <Icons.play size={20}/>}
          </div>
        </div>
        {video.priority!=="none" && (
          <div style={{ position:"absolute",top:8,left:8,background:PRIORITIES[video.priority].color,
            borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:700,color:"white",
            textTransform:"uppercase",letterSpacing:"0.5px" }}>
            {PRIORITIES[video.priority].label}
          </div>
        )}
        {video.watched && (
          <div style={{ position:"absolute",top:8,right:8,background:"rgba(124,106,247,.9)",
            borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:700,color:"white",letterSpacing:"0.5px" }}>SEEN</div>
        )}
      </div>

      <div className="cbody">
        <div className="ctitle">{video.title}</div>
        <div className="cchan">
          <span style={{ color:tabCfg.accent, display:"flex", alignItems:"center" }}>
            {video.type==="youtube"||!video.type ? <Icons.yt />
              : video.type==="instagram" ? <Icons.ig />
              : video.type==="facebook"  ? <Icons.fb />
              : null}
          </span>
          {isLocal ? (video.fileSize ? fmtSize(video.fileSize) : "Local file") : video.channel}
        </div>

        {videoCats.length>0 && (
          <div className="row" style={{ marginBottom:9 }}>
            {videoCats.map(cat=>(
              <span key={cat.id} style={{ display:"inline-flex",alignItems:"center",gap:3,
                background:cat.color+"18",border:`1px solid ${cat.color}44`,
                borderRadius:5,padding:"2px 7px",fontSize:10,color:cat.color,fontWeight:500 }}>
                <span style={{ width:5,height:5,borderRadius:"50%",background:cat.color }}/>{cat.name}
              </span>
            ))}
          </div>
        )}

        {video.tags.length>0 && (
          <div className="row" style={{ marginBottom:9 }}>
            {video.tags.map(tag=>(
              <span key={tag} className="tag">
                <Icons.tag />#{tag}
                {isEditing && <button className="tag-x" onClick={()=>onRemoveTag(tag)}><Icons.x /></button>}
              </span>
            ))}
          </div>
        )}

        <div className="row" style={{ justifyContent:"space-between" }}>
          <div className={`wcheck ${video.watched?"on":""}`} onClick={onWatch}>
            <div className="cbox"><Icons.check /></div>
            {isSocial ? "Seen" : "Watched"}
          </div>
          <div style={{ display:"flex",gap:3 }}>
            <button className="ghost-btn" onClick={onToggleEdit} style={{ fontSize:10.5 }}>
              {isEditing?"done":"edit"}
            </button>
            <button className="icon-btn del-btn" onClick={onDelete}><Icons.trash /></button>
          </div>
        </div>

        {isEditing && (
          <div style={{ marginTop:12 }}>
            <hr className="divider"/>

            {/* ── Paste thumbnail (IG / FB only) ── */}
            {isSocial && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:10.5,color:"#40405a",marginBottom:6,display:"flex",alignItems:"center",gap:5 }}>
                  <Icons.image /> Thumbnail
                </div>
                <button className="paste-thumb-btn" onClick={handlePasteThumb}>
                  📋 Paste screenshot from clipboard
                </button>
                {thumbMsg && (
                  <div style={{ marginTop:5, fontSize:11,
                    color: thumbMsg.startsWith("✓") ? "#4ade80" : "#ff6b8a" }}>
                    {thumbMsg}
                  </div>
                )}
                {video.thumbnail && (
                  <div style={{ marginTop:8, position:"relative" }}>
                    <img src={video.thumbnail} alt="thumb"
                      style={{ width:"100%", borderRadius:8, aspectRatio:"16/9", objectFit:"cover", display:"block" }}/>
                    <button onClick={() => { onThumbnail(null); setThumbMsg(""); }}
                      style={{ position:"absolute",top:6,right:6,background:"rgba(0,0,0,.75)",
                        border:"none",borderRadius:6,color:"white",cursor:"pointer",
                        fontSize:10.5,padding:"3px 8px",fontFamily:"inherit" }}>
                      remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Priority ── */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5,color:"#40405a",marginBottom:6 }}>Priority</div>
              <div className="row">
                {Object.entries(PRIORITIES).map(([k,p])=>(
                  <button key={k} className="prio-badge"
                    style={{ background:video.priority===k?p.bg:"#0f0f1a",
                      border:`1px solid ${video.priority===k?p.color+"66":"#1c1c2e"}`,
                      color:video.priority===k?p.color:"#50507a" }}
                    onClick={()=>onPriority(k)}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:p.dot }}/>{p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Categories ── */}
            {categories.length>0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10.5,color:"#40405a",marginBottom:6 }}>Categories</div>
                <div className="row">
                  {categories.map(cat=>{
                    const active=video.categories.includes(cat.id);
                    return (
                      <button key={cat.id} className="cat-pill"
                        style={{ background:active?cat.color+"22":"#0f0f1a",
                          border:`1px solid ${active?cat.color+"66":"#1c1c2e"}`,
                          color:active?cat.color:"#50507a" }}
                        onClick={()=>onToggleCat(cat.id)}>
                        <span style={{ width:6,height:6,borderRadius:"50%",background:cat.color }}/>{cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Tags ── */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5,color:"#40405a",marginBottom:6 }}>Tags</div>
              <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                <span style={{ fontSize:11,color:"#40405a" }}>#</span>
                <input className="tag-inp" placeholder="add tag, enter…" value={tagInput}
                  onChange={e=>setTagInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();commitTag();}}}/>
                <button className="ghost-btn" onClick={commitTag} style={{ fontSize:10.5 }}>Add</button>
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <div style={{ fontSize:10.5,color:"#40405a",marginBottom:6 }}>Notes</div>
              <textarea className="note-ta" rows={3} placeholder="Key ideas, timestamps…"
                value={video.note} onChange={e=>onNote(e.target.value)}/>
            </div>
          </div>
        )}

        {!isEditing && video.note && (
          <div onClick={onToggleEdit} style={{ marginTop:9,padding:"7px 9px",background:"#0a0a14",
            borderRadius:7,borderLeft:"2px solid #2a2a44",fontSize:11,color:"#60609a",lineHeight:1.55,cursor:"pointer" }}>
            {video.note}
          </div>
        )}
      </div>
    </div>
  );
}