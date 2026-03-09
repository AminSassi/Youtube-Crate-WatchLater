import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "vidvault_videos";

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

async function fetchVideoMeta(videoId) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `For YouTube video ID "${videoId}", provide plausible title and channel name based on the ID pattern. 
          Respond ONLY with valid JSON like: {"title": "...", "channel": "..."}
          If you cannot determine from the ID, use {"title": "YouTube Video", "channel": "YouTube Channel"}.
          No extra text, no markdown, just JSON.`,
        },
      ],
    }),
  });
  const data = await response.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { title: "YouTube Video", channel: "YouTube Channel" };
  }
}

async function fetchOEmbed(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { title: data.title, channel: data.author_name };
    }
  } catch {}
  return null;
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const VaultIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7"/><path d="M12 17v-2"/><path d="M9 12H7"/><path d="M17 12h-2"/>
  </svg>
);

export default function VideoVault() {
  const [videos, setVideos] = useState(() => {
    try {
      const stored = localStorage?.getItem?.(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [url, setUrl] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addingNote, setAddingNote] = useState(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const saveVideos = (vids) => {
    setVideos(vids);
    try { localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(vids)); } catch {}
  };

  const handleAdd = async () => {
    setError("");
    const trimmed = url.trim();
    if (!trimmed) return;
    const videoId = extractVideoId(trimmed);
    if (!videoId) { setError("Paste a valid YouTube URL"); return; }
    if (videos.find(v => v.id === videoId)) { setError("Already in your vault"); return; }

    setLoading(true);
    try {
      let meta = await fetchOEmbed(videoId);
      if (!meta) meta = await fetchVideoMeta(videoId);
      const newVideo = {
        id: videoId,
        title: meta.title || "YouTube Video",
        channel: meta.channel || "YouTube",
        thumbnail: getThumbnail(videoId),
        watched: false,
        note: "",
        addedAt: Date.now(),
      };
      saveVideos([newVideo, ...videos]);
      setUrl("");
    } catch (e) {
      setError("Couldn't fetch video info. Try again.");
    }
    setLoading(false);
  };

  const toggleWatched = (id) => {
    saveVideos(videos.map(v => v.id === id ? { ...v, watched: !v.watched } : v));
  };

  const deleteVideo = (id) => {
    saveVideos(videos.filter(v => v.id !== id));
  };

  const updateNote = (id, note) => {
    saveVideos(videos.map(v => v.id === id ? { ...v, note } : v));
  };

  const filtered = videos.filter(v => {
    const matchFilter = filter === "all" || (filter === "watched" ? v.watched : !v.watched);
    const matchSearch = v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.channel.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const watchedCount = videos.filter(v => v.watched).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif",
      padding: "0 0 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Sora:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }

        .vault-card {
          background: #111118;
          border: 1px solid #1e1e2e;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(.4,0,.2,1);
          position: relative;
        }
        .vault-card:hover {
          border-color: #2e2e44;
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px #2e2e44;
        }
        .vault-card.watched {
          opacity: 0.45;
          filter: saturate(0.3);
        }
        .vault-card.watched:hover {
          opacity: 0.65;
          filter: saturate(0.5);
        }
        .thumb-wrap {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
          background: #0d0d15;
          cursor: pointer;
        }
        .thumb-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .thumb-wrap:hover img { transform: scale(1.04); }
        .play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
          color: white;
        }
        .thumb-wrap:hover .play-overlay { opacity: 1; }
        .card-body { padding: 14px 16px 16px; }
        .card-title {
          font-family: 'DM Sans', system-ui;
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1.45;
          color: #d8d8e8;
          margin-bottom: 5px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-channel {
          font-size: 11.5px;
          color: #5a5a7a;
          font-weight: 400;
          margin-bottom: 12px;
        }
        .card-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .watched-check {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          user-select: none;
          font-size: 12px;
          color: #6a6a8a;
          transition: color 0.2s;
        }
        .watched-check:hover { color: #9a9ab8; }
        .watched-check.active { color: #7c6af7; }
        .custom-checkbox {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          border: 1.5px solid #2e2e48;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.18s;
          flex-shrink: 0;
        }
        .watched-check.active .custom-checkbox {
          background: #7c6af7;
          border-color: #7c6af7;
        }
        .custom-checkbox svg { opacity: 0; transition: opacity 0.15s; }
        .watched-check.active .custom-checkbox svg { opacity: 1; }

        .note-btn {
          background: none;
          border: 1px solid #1e1e2e;
          color: #4a4a6a;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .note-btn:hover { border-color: #3e3e5e; color: #7a7a9a; }

        .del-btn {
          background: none;
          border: none;
          color: #3a3a5a;
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }
        .del-btn:hover { color: #ff5a7a; background: rgba(255,90,122,0.08); }

        .note-area {
          margin-top: 12px;
          border-top: 1px solid #1a1a28;
          padding-top: 12px;
        }
        .note-textarea {
          width: 100%;
          background: #0d0d15;
          border: 1px solid #1e1e2e;
          border-radius: 8px;
          padding: 8px 10px;
          color: #9090b0;
          font-size: 12px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          transition: border-color 0.2s;
        }
        .note-textarea:focus { border-color: #3e3e5e; }
        .note-textarea::placeholder { color: #3a3a55; }

        .add-btn {
          background: #7c6af7;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 0 20px;
          height: 44px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.18s;
          font-family: inherit;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .add-btn:hover:not(:disabled) { background: #9080ff; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(124,106,247,0.4); }
        .add-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .url-input {
          flex: 1;
          background: #111118;
          border: 1px solid #1e1e2e;
          border-radius: 10px;
          padding: 0 16px;
          height: 44px;
          color: #d0d0e8;
          font-size: 13.5px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .url-input::placeholder { color: #3a3a55; }
        .url-input:focus { border-color: #3e3e5e; }

        .filter-btn {
          background: none;
          border: 1px solid #1e1e2e;
          color: #5a5a7a;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 12.5px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          font-weight: 500;
        }
        .filter-btn:hover { border-color: #3e3e5e; color: #9090b0; }
        .filter-btn.active { background: #1e1e30; border-color: #3e3e5e; color: #d0d0f0; }

        .search-wrap {
          position: relative;
          flex: 1;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #3a3a55;
          pointer-events: none;
        }
        .search-input {
          width: 100%;
          background: #111118;
          border: 1px solid #1e1e2e;
          border-radius: 8px;
          padding: 0 12px 0 36px;
          height: 36px;
          color: #d0d0e8;
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .search-input::placeholder { color: #3a3a55; }
        .search-input:focus { border-color: #3e3e5e; }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .stat-pill {
          background: #111118;
          border: 1px solid #1e1e2e;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          color: #5a5a7a;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .stat-pill span { color: #8080a0; font-weight: 500; }

        .empty-state {
          grid-column: 1/-1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          color: #3a3a55;
          gap: 12px;
        }
        .empty-state h3 { font-size: 16px; color: #5a5a7a; font-weight: 500; }
        .empty-state p { font-size: 13px; text-align: center; max-width: 280px; line-height: 1.6; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-enter { animation: fadeIn 0.3s ease forwards; }

        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .progress-bar-track {
          height: 3px;
          background: #1a1a28;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 16px;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #7c6af7, #a78bfa);
          border-radius: 2px;
          transition: width 0.6s cubic-bezier(.4,0,.2,1);
        }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #7c6af7, #5a4ad1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(124,106,247,0.3)"
            }}>
              <VaultIcon />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora', system-ui", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>
                Video Vault
              </div>
              <div style={{ fontSize: 11, color: "#3a3a55", marginTop: 1 }}>Your private learning library</div>
            </div>
          </div>

          {videos.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="stat-pill">
                <span>{watchedCount}</span> / {videos.length} watched
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {videos.length > 0 && (
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${(watchedCount / videos.length) * 100}%` }} />
          </div>
        )}

        {/* Add URL */}
        <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            className="url-input"
            placeholder="Paste a YouTube URL..."
            value={url}
            onChange={e => { setUrl(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
          />
          <button className="add-btn" onClick={handleAdd} disabled={loading || !url.trim()}>
            {loading ? <div className="spinner" /> : <PlusIcon />}
            {loading ? "Fetching..." : "Add"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#ff6b8a", paddingLeft: 4 }}>{error}</div>
        )}

        {/* Filters + Search */}
        {videos.length > 0 && (
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {["all", "unwatched", "watched"].map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? `All ${videos.length}` : f === "unwatched" ? `Unwatched ${videos.length - watchedCount}` : `Watched ${watchedCount}`}
              </button>
            ))}
            <div className="search-wrap" style={{ maxWidth: 240 }}>
              <span className="search-icon"><SearchIcon /></span>
              <input
                className="search-input"
                placeholder="Search videos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1100, margin: "24px auto 0", padding: "0 24px" }}>
        <div className="grid">
          {filtered.length === 0 && (
            <div className="empty-state">
              <div style={{ fontSize: 36, marginBottom: 4 }}>📼</div>
              <h3>{videos.length === 0 ? "Your vault is empty" : "No videos found"}</h3>
              <p>{videos.length === 0
                ? "Paste a YouTube URL above to start building your learning library."
                : "Try a different search or filter."}</p>
            </div>
          )}

          {filtered.map((video, i) => (
            <div
              key={video.id}
              className={`vault-card card-enter ${video.watched ? "watched" : ""}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Thumbnail */}
              <div
                className="thumb-wrap"
                onClick={() => window.open(`https://youtube.com/watch?v=${video.id}`, "_blank")}
              >
                <img src={video.thumbnail} alt={video.title} loading="lazy" />
                <div className="play-overlay"><PlayIcon /></div>
                {video.watched && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(124,106,247,0.9)", borderRadius: 5,
                    padding: "2px 7px", fontSize: 10, fontWeight: 600, color: "white"
                  }}>WATCHED</div>
                )}
              </div>

              {/* Body */}
              <div className="card-body">
                <div className="card-title">{video.title}</div>
                <div className="card-channel">{video.channel}</div>

                <div className="card-actions">
                  <div
                    className={`watched-check ${video.watched ? "active" : ""}`}
                    onClick={() => toggleWatched(video.id)}
                  >
                    <div className="custom-checkbox">
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    Watched
                  </div>

                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="note-btn" onClick={() => setAddingNote(addingNote === video.id ? null : video.id)}>
                      {addingNote === video.id ? "close" : video.note ? "📝 note" : "+ note"}
                    </button>
                    <button className="del-btn" onClick={() => deleteVideo(video.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {addingNote === video.id && (
                  <div className="note-area">
                    <textarea
                      className="note-textarea"
                      rows={3}
                      placeholder="Add notes, timestamps, key ideas..."
                      value={video.note}
                      onChange={e => updateNote(video.id, e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {addingNote !== video.id && video.note && (
                  <div style={{
                    marginTop: 10, padding: "8px 10px",
                    background: "#0d0d15", borderRadius: 8,
                    borderLeft: "2px solid #3a3a5a",
                    fontSize: 11.5, color: "#6a6a8a", lineHeight: 1.6,
                    cursor: "pointer"
                  }} onClick={() => setAddingNote(video.id)}>
                    {video.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
