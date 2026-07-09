import { useState, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useVideos } from "./hooks/useVideos";
import { useFilters } from "./hooks/useFilters";
import { TABS, CARD_ANIMATION_STAGGER_MS } from "./utils/constants";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SignInScreen } from "./components/SignInScreen";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { AddVideoForm } from "./components/AddVideoForm";
import { FilterBar } from "./components/FilterBar";
import { CategoryManager } from "./components/CategoryManager";
import { VideoCard } from "./components/VideoCard";
import { LocalPlayer } from "./components/LocalPlayer";
import { EmptyState } from "./components/EmptyState";

function VideoVault() {
  const { user, authError, signIn, signOut } = useAuth();
  const {
    videos, categories, syncStatus, error,
    addYouTube, addSocial, addLocalFiles, deleteVideo, updateVideo,
    addCategory, deleteCategory, toggleVideoCategory, addTag, removeTag,
  } = useVideos(user);
  const {
    tab, setTab,
    filter, setFilter,
    catFilter, setCatFilter,
    prioFilter, setPrioFilter,
    search, setSearch,
    sortBy, setSortBy,
    filtered, allCurList, curWatched, countFor,
  } = useFilters(videos);

  const [editingCard, setEditingCard] = useState(null);
  const [playerVideo, setPlayerVideo] = useState(null);

  const [ytLoading, setYtLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  const handleAddYT = useCallback(async (url) => {
    setYtLoading(true);
    try { await addYouTube(url); } catch (e) { console.warn("YT add error:", e); }
    setYtLoading(false);
  }, [addYouTube]);

  const handleAddSocial = useCallback(async (platform, url, title) => {
    setSocialLoading(true);
    try { await addSocial(platform, url, title); } catch (e) { console.warn("Social add error:", e); }
    setSocialLoading(false);
  }, [addSocial]);

  const handleAddLocal = useCallback(async (files) => {
    await addLocalFiles(files);
  }, [addLocalFiles]);

  const handlePlay = useCallback((video) => {
    if (video.type === "local") {
      setPlayerVideo(video);
    } else {
      window.open(video.url || `https://youtube.com/watch?v=${video.id}`, "_blank");
    }
  }, []);

  if (!user) {
    return <SignInScreen onSignIn={signIn} authError={authError} />;
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#080810", color: "#e2e2f0",
      fontFamily: "'DM Sans',system-ui,sans-serif", paddingBottom: 80,
    }}>
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

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "30px 22px 0" }}>
        <Header
          syncStatus={syncStatus}
          user={user}
          videoCount={videos.length}
          watchedCount={videos.filter(v => v.watched).length}
          onSignOut={signOut}
        />

        <TabBar activeTab={tab} onTabChange={setTab} countFor={countFor} />

        {allCurList.length > 0 && (
          <div className="prog-track" style={{ marginBottom: 22 }}>
            <div className="prog-fill" style={{
              width: `${(curWatched / allCurList.length) * 100}%`,
              background: `linear-gradient(90deg, ${TABS[tab].accent}, ${TABS[tab].accent}99)`,
            }}/>
          </div>
        )}

        <AddVideoForm
          tab={tab}
          onAddYouTube={handleAddYT}
          onAddSocial={handleAddSocial}
          onAddLocal={handleAddLocal}
          loading={ytLoading || socialLoading}
          error={error}
        />

        <CategoryManager
          categories={categories}
          onAdd={addCategory}
          onDelete={deleteCategory}
        />

        <FilterBar
          filter={filter}
          setFilter={setFilter}
          prioFilter={prioFilter}
          setPrioFilter={setPrioFilter}
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          setSortBy={setSortBy}
          allCurList={allCurList}
          curWatched={curWatched}
          categories={categories}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
        />
      </div>

      <div style={{ maxWidth: 1140, margin: "22px auto 0", padding: "0 22px" }}>
        <div className="grid">
          {filtered.length === 0 && (
            <EmptyState
              tab={tab}
              syncStatus={syncStatus}
              hasFilters={allCurList.length > 0 && filtered.length === 0}
            />
          )}
          {filtered.map((video, i) => (
            <VideoCard
              key={video.id}
              video={video}
              categories={categories}
              animDelay={i * CARD_ANIMATION_STAGGER_MS}
              isEditing={editingCard === video.id}
              onToggleEdit={() => setEditingCard(editingCard === video.id ? null : video.id)}
              onWatch={() => updateVideo(video.id, { watched: !video.watched })}
              onDelete={() => deleteVideo(video)}
              onPriority={p => updateVideo(video.id, { priority: p })}
              onToggleCat={catId => toggleVideoCategory(video.id, catId)}
              onAddTag={tag => addTag(video.id, tag)}
              onRemoveTag={tag => removeTag(video.id, tag)}
              onNote={note => updateVideo(video.id, { note })}
              onThumbnail={thumb => updateVideo(video.id, { thumbnail: thumb })}
              onPlay={() => handlePlay(video)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <VideoVault />
    </ErrorBoundary>
  );
}
