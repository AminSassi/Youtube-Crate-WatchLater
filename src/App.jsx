import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const STORAGE_KEY = "vidvault_v3";
const DB_NAME = "vidvault_files_v1";
const STORE_NAME = "blobs";

// ── IndexedDB helpers ──────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}
async function storeBlob(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function getBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteBlob(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
  });
}

// ── Video helpers ─────────────────────────────────────────────────────────
function extractVideoId(url) {
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
  return new Promise((resolve) => {
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
    setTimeout(() => resolve(null), 5000); // safety timeout
  });
}
function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Priority / colors ─────────────────────────────────────────────────────
const PRIORITIES = {
  urgent:  { label: "Urgent",  color: "#ff4d6d", bg: "rgba(255,77,109,0.12)",  dot: "#ff4d6d" },
  soon:    { label: "Soon",    color: "#ffb830", bg: "rgba(255,184,48,0.12)",   dot: "#ffb830" },
  someday: { label: "Someday", color: "#4ade80", bg: "rgba(74,222,128,0.12)",   dot: "#4ade80" },
  none:    { label: "None",    color: "#3a3a55", bg: "transparent",             dot: "#3a3a55" },
};
const CATEGORY_COLORS = [
  "#7c6af7","#f97316","#06b6d4","#ec4899","#84cc16","#f59e0b","#8b5cf6","#10b981"
];

// ── Icons ─────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 14, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const TrashIcon  = () => <Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />;
const SearchIcon = () => <Icon d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" size={15} />;
const PlusIcon   = () => <Icon d="M12 5v14M5 12h14" size={15} stroke={2.5} />;
const TagIcon    = () => <Icon d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" size={13} />;
const FolderIcon = () => <Icon d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" size={13} />;
const SortIcon   = () => <Icon d="M3 6h18M7 12h10M11 18h2" size={14} />;
const XIcon      = () => <Icon d="M18 6L6 18M6 6l12 12" size={11} stroke={2.5} />;
const FilmIcon   = () => <Icon d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.914L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" size={15}/>;
const CheckIcon  = () => (
  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PlayIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" opacity="0.9"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);
const VaultIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="12" cy="12" r="3"/>
    <path d="M12 9V7M12 17v-2M9 12H7M17 12h-2"/>
  </svg>
);

// ── Local Video Player Modal ───────────────────────────────────────────────
function LocalPlayer({ video, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let url;
    getBlob(video.id).then(blob => {
      if (!blob) { setErr(true); return; }
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    }).catch(() => setErr(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [video.id]);

  // close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={handleBackdrop} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}>
      <div style={{ width:"100%", maxWidth:900, background:"#0f0f1a", borderRadius:20,
        border:"1px solid #2a2a42", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,.8)" }}>
        {/* modal header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 18px", borderBottom:"1px solid #141424" }}>
          <div>
            <div style={{ fontSize:13.5, fontWeight:600, color:"#d0d0e8" }}>{video.title}</div>
            <div style={{ fontSize:11, color:"#50507a", marginTop:2 }}>{video.fileSize ? fmtSize(video.fileSize) : ""} · {video.fileMime || "video"}</div>
          </div>
          <button onClick={onClose} style={{ background:"#141424", border:"1px solid #1c1c2e",
            borderRadius:8, padding:"6px 10px", color:"#8080a8", cursor:"pointer", display:"flex", alignItems:"center" }}>
            <XIcon />
          </button>
        </div>
        {/* player */}
        <div style={{ background:"#000", aspectRatio:"16/9", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {err ? (
            <div style={{ color:"#ff6b8a", fontSize:13, textAlign:"center", padding:30 }}>
              File not found in storage.<br/>
              <span style={{ color:"#50507a", fontSize:11.5 }}>The original file may have been removed from this browser.</span>
            </div>
          ) : blobUrl ? (
            <video src={blobUrl} controls autoPlay style={{ width:"100%", height:"100%", objectFit:"contain" }} />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:"#30304a" }}>
              <div className="spinner" style={{ width:28, height:28, borderWidth:3 }} />
              <span style={{ fontSize:12 }}>Loading…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function VideoVault() {
  const load = () => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : { videos: [], categories: [] }; }
    catch { return { videos: [], categories: [] }; }
  };

  const [data, setData]           = useState(load);
  const [url, setUrl]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError]         = useState("");
  const [filter, setFilter]       = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // all | youtube | local
  const [catFilter, setCatFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");
  const [search, setSearch]       = useState("");
  const [sortBy, setSortBy]       = useState("newest");
  const [showSort, setShowSort]   = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [newCatName, setNewCatName]   = useState("");
  const [showCatInput, setShowCatInput] = useState(false);
  const [playerVideo, setPlayerVideo] = useState(null); // local video being played
  const inputRef   = useRef(null);
  const sortRef    = useRef(null);
  const fileRef    = useRef(null);

  const videos     = data.videos;
  const categories = data.categories;

  const save       = (newData) => { setData(newData); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newData)); } catch {} };
  const saveVideos = (vids) => save({ ...data, videos: vids });
  const saveCats   = (cats) => save({ ...data, categories: cats });
  const saveAll    = (vids, cats) => save({ videos: vids, categories: cats });

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);
  useEffect(() => {
    const close = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // ── Add YouTube ───────────────────────────────────────────────────────────
  const handleAddYT = async () => {
    setError("");
    const trimmed = url.trim();
    if (!trimmed) return;
    const videoId = extractVideoId(trimmed);
    if (!videoId) { setError("Paste a valid YouTube URL"); return; }
    if (videos.find(v => v.id === videoId)) { setError("Already in your vault"); return; }
    setLoading(true);
    try {
      const meta = await fetchOEmbed(videoId);
      const newVideo = {
        id: videoId, type: "youtube",
        title: meta.title, channel: meta.channel,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        watched: false, priority: "none", categories: [], tags: [], note: "",
        addedAt: Date.now(),
      };
      saveVideos([newVideo, ...videos]);
      setUrl("");
    } catch { setError("Couldn't fetch video info."); }
    setLoading(false);
  };

  // ── Add Local File ────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(""); setFileLoading(true);

    const toAdd = [];
    for (const file of files) {
      const id = uid();
      try {
        await storeBlob(id, file);
        const thumb = await generateThumbnail(file);
        const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        toAdd.push({
          id, type: "local",
          title: cleanName, channel: "Local File",
          thumbnail: thumb,
          fileSize: file.size,
          fileMime: file.type || "video/mp4",
          watched: false, priority: "none", categories: [], tags: [], note: "",
          addedAt: Date.now(),
        });
      } catch { /* skip failed files */ }
    }
    if (toAdd.length) saveVideos([...toAdd.reverse(), ...videos]);
    else setError("Couldn't read the selected file(s).");
    setFileLoading(false);
    e.target.value = "";
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (video) => {
    if (video.type === "local") deleteBlob(video.id).catch(() => {});
    saveVideos(videos.filter(v => v.id !== video.id));
  };

  // ── Category helpers ──────────────────────────────────────────────────────
  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || categories.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    saveCats([...categories, { id: Date.now().toString(), name, color }]);
    setNewCatName(""); setShowCatInput(false);
  };
  const deleteCategory = (catId) => {
    const newVids = videos.map(v => ({ ...v, categories: v.categories.filter(c => c !== catId) }));
    saveAll(newVids, categories.filter(c => c.id !== catId));
    if (catFilter === catId) setCatFilter("all");
  };
  const toggleVideoCategory = (videoId, catId) => {
    saveVideos(videos.map(v => {
      if (v.id !== videoId) return v;
      const has = v.categories.includes(catId);
      return { ...v, categories: has ? v.categories.filter(c => c !== catId) : [...v.categories, catId] };
    }));
  };

  // ── Tag helpers ───────────────────────────────────────────────────────────
  const addTag = (videoId, tag) => {
    const clean = tag.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    saveVideos(videos.map(v => {
      if (v.id !== videoId || v.tags.includes(clean)) return v;
      return { ...v, tags: [...v.tags, clean] };
    }));
  };
  const removeTag = (videoId, tag) => {
    saveVideos(videos.map(v => v.id === videoId ? { ...v, tags: v.tags.filter(t => t !== tag) } : v));
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...videos];
    if (filter === "watched")   list = list.filter(v => v.watched);
    if (filter === "unwatched") list = list.filter(v => !v.watched);
    if (typeFilter === "youtube") list = list.filter(v => v.type === "youtube");
    if (typeFilter === "local")   list = list.filter(v => v.type === "local");
    if (catFilter !== "all")    list = list.filter(v => v.categories.includes(catFilter));
    if (prioFilter !== "all")   list = list.filter(v => v.priority === prioFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.channel.toLowerCase().includes(q) ||
        v.tags.some(t => t.includes(q))
      );
    }
    const ORDER = { urgent: 0, soon: 1, someday: 2, none: 3 };
    if (sortBy === "newest")   list.sort((a, b) => b.addedAt - a.addedAt);
    if (sortBy === "oldest")   list.sort((a, b) => a.addedAt - b.addedAt);
    if (sortBy === "priority") list.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
    if (sortBy === "title")    list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [videos, filter, typeFilter, catFilter, prioFilter, search, sortBy]);

  const watchedCount  = videos.filter(v => v.watched).length;
  const localCount    = videos.filter(v => v.type === "local").length;
  const youtubeCount  = videos.filter(v => v.type === "youtube").length;

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#e2e2f0",
      fontFamily:"'DM Sans', system-ui, sans-serif", paddingBottom:80 }}>
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
        .play-ov{position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;}
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
        .tag{display:inline-flex;align-items:center;gap:3px;background:#141424;border:1px solid #22223a;border-radius:5px;padding:2px 7px;font-size:10.5px;color:#70709a;cursor:default;}
        .tag-x{background:none;border:none;color:#50506a;cursor:pointer;padding:0;display:flex;align-items:center;transition:color .15s;}
        .tag-x:hover{color:#ff6b8a;}
        .icon-btn{background:none;border:none;cursor:pointer;display:flex;align-items:center;padding:5px;border-radius:7px;transition:all .15s;font-family:inherit;}
        .del-btn{color:#2a2a44;}.del-btn:hover{color:#ff5a7a;background:rgba(255,90,122,.08);}
        .ghost-btn{color:#50507a;border:1px solid #1c1c2e;font-size:11px;padding:4px 9px;border-radius:7px;background:none;cursor:pointer;font-family:inherit;transition:all .15s;}
        .ghost-btn:hover{border-color:#3a3a58;color:#9090b8;}
        .filter-btn{background:none;border:1px solid #1c1c2e;color:#50507a;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit;font-weight:500;white-space:nowrap;}
        .filter-btn:hover{border-color:#3a3a58;color:#9090b8;}
        .filter-btn.on{background:#1a1a2e;border-color:#3a3a58;color:#d0d0f0;}
        .url-input{flex:1;background:#0f0f1a;border:1px solid #1c1c2e;border-radius:11px;padding:0 16px;height:46px;color:#d0d0e8;font-size:13.5px;font-family:inherit;outline:none;transition:border-color .2s;}
        .url-input::placeholder{color:#30304a;}.url-input:focus{border-color:#3a3a58;}
        .add-btn{background:#7c6af7;color:white;border:none;border-radius:11px;padding:0 20px;height:46px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .18s;font-family:inherit;white-space:nowrap;flex-shrink:0;}
        .add-btn:hover:not(:disabled){background:#9080ff;transform:translateY(-1px);box-shadow:0 4px 20px rgba(124,106,247,.4);}
        .add-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .file-btn{background:#141424;color:#8080a8;border:1px solid #1c1c2e;border-radius:11px;padding:0 16px;height:46px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .18s;font-family:inherit;white-space:nowrap;flex-shrink:0;}
        .file-btn:hover:not(:disabled){border-color:#3a3a58;color:#c0c0d8;background:#1a1a2e;}
        .file-btn:disabled{opacity:.5;cursor:not-allowed;}
        .search-wrap{position:relative;flex:1;}
        .search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#30304a;pointer-events:none;}
        .search-inp{width:100%;background:#0f0f1a;border:1px solid #1c1c2e;border-radius:9px;padding:0 12px 0 34px;height:36px;color:#d0d0e8;font-size:12.5px;font-family:inherit;outline:none;transition:border-color .2s;}
        .search-inp::placeholder{color:#30304a;}.search-inp:focus{border-color:#3a3a58;}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(275px,1fr));gap:16px;}
        .note-ta{width:100%;background:#0a0a14;border:1px solid #1c1c2e;border-radius:8px;padding:8px 10px;color:#8080a8;font-size:11.5px;font-family:inherit;resize:none;outline:none;line-height:1.55;transition:border-color .2s;}
        .note-ta:focus{border-color:#3a3a58;}.note-ta::placeholder{color:#2a2a40;}
        .divider{border:none;border-top:1px solid #141424;margin:10px 0;}
        .cat-pill{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 8px;font-size:10.5px;font-weight:500;cursor:pointer;border:none;font-family:inherit;transition:all .15s;}
        .sort-menu{position:absolute;top:calc(100% + 6px);right:0;background:#0f0f1a;border:1px solid #1c1c2e;border-radius:12px;padding:6px;z-index:50;min-width:150px;box-shadow:0 12px 40px rgba(0,0,0,.6);}
        .sort-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;color:#8080a8;transition:all .15s;white-space:nowrap;}
        .sort-item:hover{background:#141424;color:#d0d0e8;}.sort-item.on{color:#7c6af7;background:#14142a;}
        .spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
        .prog-track{height:2px;background:#141424;border-radius:2px;overflow:hidden;margin-top:14px;}
        .prog-fill{height:100%;background:linear-gradient(90deg,#7c6af7,#a78bfa);border-radius:2px;transition:width .6s cubic-bezier(.4,0,.2,1);}
        .empty{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;color:#30304a;gap:10px;text-align:center;}
        .empty h3{font-size:15px;color:#50507a;font-weight:500;}.empty p{font-size:12.5px;color:#30304a;max-width:280px;line-height:1.6;}
        .tag-inp{background:none;border:none;outline:none;color:#9090b8;font-size:11px;font-family:inherit;width:80px;padding:2px 4px;}
        .tag-inp::placeholder{color:#2a2a40;}
        .local-badge{display:inline-flex;align-items:center;gap:3px;background:#06b6d418;border:1px solid #06b6d433;border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:600;color:#06b6d4;letter-spacing:.3px;text-transform:uppercase;}
        .yt-badge{display:inline-flex;align-items:center;gap:3px;background:#ff4d6d18;border:1px solid #ff4d6d33;border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:600;color:#ff6b8a;letter-spacing:.3px;text-transform:uppercase;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cin{animation:fadeUp .3s ease forwards;}
        .drop-zone-active{border-color:#7c6af7 !important;background:#14142a !important;}
      `}</style>

      {/* Local video player modal */}
      {playerVideo && <LocalPlayer video={playerVideo} onClose={() => setPlayerVideo(null)} />}

      <div style={{ maxWidth:1120, margin:"0 auto", padding:"30px 22px 0" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:11,
              background:"linear-gradient(135deg,#7c6af7,#5a4ad1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 18px rgba(124,106,247,.35)" }}>
              <VaultIcon />
            </div>
            <div>
              <div style={{ fontFamily:"'Cabinet Grotesk',system-ui", fontWeight:800, fontSize:19, letterSpacing:"-0.4px" }}>Video Vault</div>
              <div style={{ fontSize:10.5, color:"#30304a", marginTop:1 }}>YouTube & local videos</div>
            </div>
          </div>
          {videos.length > 0 && (
            <div style={{ fontSize:12, color:"#50507a", background:"#0f0f1a", border:"1px solid #1c1c2e",
              borderRadius:8, padding:"5px 12px", display:"flex", gap:10, alignItems:"center" }}>
              <span><span style={{ color:"#8080a8", fontWeight:600 }}>{watchedCount}</span> / {videos.length} watched</span>
              {localCount > 0 && <span style={{ color:"#30304a" }}>·</span>}
              {localCount > 0 && <span><span style={{ color:"#06b6d4", fontWeight:600 }}>{localCount}</span> local</span>}
            </div>
          )}
        </div>

        {videos.length > 0 && (
          <div className="prog-track">
            <div className="prog-fill" style={{ width:`${(watchedCount/videos.length)*100}%` }} />
          </div>
        )}

        {/* ── Add row ── */}
        <div style={{ marginTop:22, display:"flex", gap:8, flexWrap:"wrap" }}>
          <input ref={inputRef} className="url-input" placeholder="Paste a YouTube URL…"
            value={url} onChange={e => { setUrl(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && !loading && handleAddYT()} />
          <button className="add-btn" onClick={handleAddYT} disabled={loading || !url.trim()}>
            {loading ? <div className="spinner"/> : <PlusIcon />}
            {loading ? "Fetching…" : "Add"}
          </button>

          {/* File button */}
          <input ref={fileRef} type="file" accept="video/*" multiple style={{ display:"none" }} onChange={handleFileChange} />
          <button className="file-btn" onClick={() => fileRef.current?.click()} disabled={fileLoading}>
            {fileLoading ? <div className="spinner" style={{ borderTopColor:"#8080a8" }}/> : <FilmIcon />}
            {fileLoading ? "Processing…" : "Local file"}
          </button>
        </div>
        {error && <div style={{ marginTop:7, fontSize:11.5, color:"#ff6b8a", paddingLeft:4 }}>{error}</div>}
        <div style={{ marginTop:8, fontSize:11, color:"#2a2a40", paddingLeft:2 }}>
          Local files are stored in your browser — they stay private and work offline.
        </div>

        {/* ── Categories row ── */}
        <div style={{ marginTop:18, display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"#40405a", display:"flex", alignItems:"center", gap:4 }}><FolderIcon /> Categories</span>
          {categories.map(cat => (
            <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:0 }}>
              <button className="cat-pill"
                style={{ background: catFilter===cat.id ? cat.color+"22" : "#0f0f1a",
                  border:`1px solid ${catFilter===cat.id ? cat.color+"66" : "#1c1c2e"}`,
                  color: catFilter===cat.id ? cat.color : "#70709a" }}
                onClick={() => setCatFilter(catFilter===cat.id ? "all" : cat.id)}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:cat.color, display:"inline-block" }}/>
                {cat.name}
              </button>
              <button className="icon-btn" style={{ color:"#30304a", padding:"3px 3px" }}
                onClick={() => deleteCategory(cat.id)}><XIcon /></button>
            </div>
          ))}
          {showCatInput ? (
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") addCategory(); if (e.key==="Escape") { setShowCatInput(false); setNewCatName(""); }}}
                placeholder="Category name…" autoFocus
                style={{ background:"#0f0f1a", border:"1px solid #2a2a44", borderRadius:7, padding:"4px 10px",
                  color:"#d0d0e8", fontSize:12, outline:"none", fontFamily:"inherit", width:130 }} />
              <button className="ghost-btn" onClick={addCategory}>Add</button>
              <button className="icon-btn del-btn" onClick={() => { setShowCatInput(false); setNewCatName(""); }}><XIcon /></button>
            </div>
          ) : (
            <button className="ghost-btn" onClick={() => setShowCatInput(true)} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <PlusIcon /> New
            </button>
          )}
        </div>

        {/* ── Filters + type toggle + search + sort ── */}
        {videos.length > 0 && (
          <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
            {[["all","All"], ["unwatched","Unwatched"], ["watched","Watched"]].map(([v, l]) => (
              <button key={v} className={`filter-btn ${filter===v?"on":""}`} onClick={() => setFilter(v)}>
                {l} {v==="all"?videos.length:v==="watched"?watchedCount:videos.length-watchedCount}
              </button>
            ))}

            {/* Type filter — only show if both types present */}
            {localCount > 0 && youtubeCount > 0 && (
              <>
                <button className={`filter-btn ${typeFilter==="youtube"?"on":""}`}
                  style={typeFilter==="youtube"?{borderColor:"#ff4d6d66",color:"#ff6b8a",background:"#ff4d6d12"}:{}}
                  onClick={() => setTypeFilter(typeFilter==="youtube"?"all":"youtube")}>
                  YouTube
                </button>
                <button className={`filter-btn ${typeFilter==="local"?"on":""}`}
                  style={typeFilter==="local"?{borderColor:"#06b6d466",color:"#06b6d4",background:"#06b6d412"}:{}}
                  onClick={() => setTypeFilter(typeFilter==="local"?"all":"local")}>
                  Local
                </button>
              </>
            )}

            {/* Priority filters */}
            {Object.entries(PRIORITIES).filter(([k])=>k!=="none").map(([k, p]) => (
              <button key={k} className={`filter-btn ${prioFilter===k?"on":""}`}
                style={prioFilter===k?{borderColor:p.color+"66", color:p.color, background:p.bg}:{}}
                onClick={() => setPrioFilter(prioFilter===k?"all":k)}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:p.dot, display:"inline-block", marginRight:4 }}/>
                {p.label}
              </button>
            ))}

            <div className="search-wrap" style={{ maxWidth:200 }}>
              <span className="search-icon"><SearchIcon /></span>
              <input className="search-inp" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div ref={sortRef} style={{ position:"relative", marginLeft:"auto" }}>
              <button className="ghost-btn" style={{ display:"flex", alignItems:"center", gap:5 }}
                onClick={() => setShowSort(s => !s)}>
                <SortIcon /> Sort
              </button>
              {showSort && (
                <div className="sort-menu">
                  {[["newest","Newest first"],["oldest","Oldest first"],["priority","By priority"],["title","Title A–Z"]].map(([v,l]) => (
                    <div key={v} className={`sort-item ${sortBy===v?"on":""}`} onClick={() => { setSortBy(v); setShowSort(false); }}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{ maxWidth:1120, margin:"22px auto 0", padding:"0 22px" }}>
        <div className="grid">
          {filtered.length === 0 && (
            <div className="empty">
              <div style={{ fontSize:34 }}>📼</div>
              <h3>{videos.length === 0 ? "Your vault is empty" : "No videos match"}</h3>
              <p>{videos.length === 0 ? "Paste a YouTube URL or add a local video file to get started." : "Try adjusting your filters or search."}</p>
            </div>
          )}
          {filtered.map((video, i) => (
            <VideoCard key={video.id} video={video} categories={categories}
              animDelay={i * 35}
              isEditing={editingCard === video.id}
              onToggleEdit={() => setEditingCard(editingCard === video.id ? null : video.id)}
              onWatch={() => saveVideos(videos.map(v => v.id===video.id ? {...v, watched:!v.watched} : v))}
              onDelete={() => handleDelete(video)}
              onPriority={(p) => saveVideos(videos.map(v => v.id===video.id ? {...v, priority:p} : v))}
              onToggleCat={(catId) => toggleVideoCategory(video.id, catId)}
              onAddTag={(tag) => addTag(video.id, tag)}
              onRemoveTag={(tag) => removeTag(video.id, tag)}
              onNote={(note) => saveVideos(videos.map(v => v.id===video.id ? {...v, note} : v))}
              onPlay={() => setPlayerVideo(video)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── VideoCard ─────────────────────────────────────────────────────────────
function VideoCard({ video, categories, animDelay, isEditing, onToggleEdit, onWatch, onDelete, onPriority, onToggleCat, onAddTag, onRemoveTag, onNote, onPlay }) {
  const [tagInput, setTagInput] = useState("");
  const prio = PRIORITIES[video.priority] || PRIORITIES.none;
  const isLocal = video.type === "local";

  const commitTag = () => {
    if (tagInput.trim()) { onAddTag(tagInput); setTagInput(""); }
  };

  const videoCats = categories.filter(c => video.categories.includes(c.id));

  const handleThumbClick = () => {
    if (isLocal) onPlay();
    else window.open(`https://youtube.com/watch?v=${video.id}`, "_blank");
  };

  return (
    <div className={`card cin ${video.watched ? "watched" : ""}`} style={{ animationDelay:`${animDelay}ms` }}>
      {/* Thumbnail */}
      <div className="thumb" onClick={handleThumbClick}>
        {video.thumbnail
          ? <img src={video.thumbnail} alt={video.title} loading="lazy" />
          : <div style={{ width:"100%", height:"100%", background:"#0a0a14", display:"flex", alignItems:"center", justifyContent:"center", color:"#30304a" }}><FilmIcon /></div>
        }
        <div className="play-ov">
          <div style={{ background:"rgba(0,0,0,.5)", borderRadius:"50%", width:50, height:50,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <PlayIcon size={22} />
          </div>
          {isLocal && <span style={{ position:"absolute", bottom:8, right:8, fontSize:10,
            background:"rgba(6,182,212,.9)", color:"white", borderRadius:5, padding:"2px 7px", fontWeight:700 }}>LOCAL</span>}
        </div>

        {/* priority badge */}
        {video.priority !== "none" && (
          <div style={{ position:"absolute", top:8, left:8, background:PRIORITIES[video.priority].color,
            borderRadius:5, padding:"2px 7px", fontSize:9.5, fontWeight:700, color:"white", textTransform:"uppercase", letterSpacing:"0.5px" }}>
            {PRIORITIES[video.priority].label}
          </div>
        )}
        {video.watched && (
          <div style={{ position:"absolute", top:8, right:8, background:"rgba(124,106,247,.9)",
            borderRadius:5, padding:"2px 7px", fontSize:9.5, fontWeight:700, color:"white", letterSpacing:"0.5px" }}>WATCHED</div>
        )}
      </div>

      {/* Body */}
      <div className="cbody">
        <div className="ctitle">{video.title}</div>
        <div className="cchan">
          {isLocal
            ? <><span className="local-badge">Local</span> {video.fileSize ? fmtSize(video.fileSize) : ""}</>
            : <><span className="yt-badge">YouTube</span> {video.channel}</>
          }
        </div>

        {videoCats.length > 0 && (
          <div className="row" style={{ marginBottom:9 }}>
            {videoCats.map(cat => (
              <span key={cat.id} style={{ display:"inline-flex", alignItems:"center", gap:3,
                background:cat.color+"18", border:`1px solid ${cat.color}44`,
                borderRadius:5, padding:"2px 7px", fontSize:10, color:cat.color, fontWeight:500 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:cat.color }}/>
                {cat.name}
              </span>
            ))}
          </div>
        )}

        {video.tags.length > 0 && (
          <div className="row" style={{ marginBottom:9 }}>
            {video.tags.map(tag => (
              <span key={tag} className="tag">
                <TagIcon />#{tag}
                {isEditing && <button className="tag-x" onClick={() => onRemoveTag(tag)}><XIcon /></button>}
              </span>
            ))}
          </div>
        )}

        <div className="row" style={{ justifyContent:"space-between" }}>
          <div className={`wcheck ${video.watched?"on":""}`} onClick={onWatch}>
            <div className="cbox"><CheckIcon /></div>
            Watched
          </div>
          <div style={{ display:"flex", gap:3 }}>
            <button className="ghost-btn" onClick={onToggleEdit} style={{ fontSize:10.5 }}>
              {isEditing ? "done" : "edit"}
            </button>
            <button className="icon-btn del-btn" onClick={onDelete}><TrashIcon /></button>
          </div>
        </div>

        {isEditing && (
          <div style={{ marginTop:12 }}>
            <hr className="divider" />

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5, color:"#40405a", marginBottom:6 }}>Priority</div>
              <div className="row">
                {Object.entries(PRIORITIES).map(([k, p]) => (
                  <button key={k} className="prio-badge"
                    style={{ background: video.priority===k ? p.bg : "#0f0f1a",
                      border:`1px solid ${video.priority===k ? p.color+"66" : "#1c1c2e"}`,
                      color: video.priority===k ? p.color : "#50507a" }}
                    onClick={() => onPriority(k)}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:p.dot }}/>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {categories.length > 0 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10.5, color:"#40405a", marginBottom:6 }}>Categories</div>
                <div className="row">
                  {categories.map(cat => {
                    const active = video.categories.includes(cat.id);
                    return (
                      <button key={cat.id} className="cat-pill"
                        style={{ background: active ? cat.color+"22" : "#0f0f1a",
                          border:`1px solid ${active ? cat.color+"66" : "#1c1c2e"}`,
                          color: active ? cat.color : "#50507a" }}
                        onClick={() => onToggleCat(cat.id)}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:cat.color }}/>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5, color:"#40405a", marginBottom:6 }}>Tags</div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:11, color:"#40405a" }}>#</span>
                <input className="tag-inp" placeholder="add tag, enter…" value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key==="Enter"||e.key===",") { e.preventDefault(); commitTag(); }}} />
                <button className="ghost-btn" onClick={commitTag} style={{ fontSize:10.5 }}>Add</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize:10.5, color:"#40405a", marginBottom:6 }}>Notes</div>
              <textarea className="note-ta" rows={3} placeholder="Timestamps, key ideas…"
                value={video.note} onChange={e => onNote(e.target.value)} />
            </div>
          </div>
        )}

        {!isEditing && video.note && (
          <div onClick={onToggleEdit} style={{ marginTop:9, padding:"7px 9px",
            background:"#0a0a14", borderRadius:7, borderLeft:"2px solid #2a2a44",
            fontSize:11, color:"#60609a", lineHeight:1.55, cursor:"pointer" }}>
            {video.note}
          </div>
        )}
      </div>
    </div>
  );
}