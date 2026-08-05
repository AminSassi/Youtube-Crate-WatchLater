import { memo } from "react";
import { TABS, PRIORITIES } from "../utils/constants";
import { Icons } from "../utils/icons";
import { fmtSize } from "../utils/helpers";
import { SocialThumb } from "./SocialThumb";
import { EditPanel } from "./EditPanel";

export const VideoCard = memo(function VideoCard({
  video, categories, animDelay, isEditing,
  onToggleEdit, onWatch, onDelete, onPriority, onToggleCat,
  onAddTag, onRemoveTag, onNote, onThumbnail, onPlay,
}) {
  const isSocial = video.type === "instagram" || video.type === "facebook";
  const isLocal = video.type === "local";
  const videoCats = categories.filter(c => Array.isArray(video.categories) && video.categories.includes(c.id));
  const tabCfg = TABS[video.type] || TABS.youtube;
  const tagsList = Array.isArray(video.tags) ? video.tags : [];

  return (
    <div
      className={`card cin ${video.watched ? "watched" : ""}`}
      style={{ animationDelay: `${animDelay}ms` }}
      role="article"
      aria-label={video.title}
    >
      <div className="thumb" onClick={onPlay} role="button" tabIndex={0} aria-label={`Play ${video.title}`}>
        {isSocial
          ? <SocialThumb video={video} />
          : video.thumbnail
            ? <img src={video.thumbnail} alt={video.title} loading="lazy" />
            : <div style={{
              width: "100%", height: "100%", background: "#0a0a14",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#30304a",
            }}><Icons.film /></div>
        }
        <div className="play-ov">
          <div style={{
            background: "rgba(0,0,0,.55)", borderRadius: "50%", width: 50, height: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {isSocial ? <Icons.extLink /> : <Icons.play size={20} />}
          </div>
        </div>
        {video.priority && video.priority !== "none" && PRIORITIES[video.priority] && (
          <div style={{
            position: "absolute", top: 8, left: 8, background: PRIORITIES[video.priority].color,
            borderRadius: 5, padding: "2px 7px", fontSize: 9.5, fontWeight: 700, color: "white",
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {PRIORITIES[video.priority].label}
          </div>
        )}
        {video.watched && (
          <div style={{
            position: "absolute", top: 8, right: 8, background: "rgba(124,106,247,.9)",
            borderRadius: 5, padding: "2px 7px", fontSize: 9.5, fontWeight: 700, color: "white",
            letterSpacing: "0.5px",
          }}>SEEN</div>
        )}
      </div>

      <div className="cbody">
        <div className="ctitle">{video.title}</div>
        <div className="cchan">
          <span style={{ color: tabCfg.accent, display: "flex", alignItems: "center" }}>
            {video.type === "youtube" || !video.type ? <Icons.yt />
              : video.type === "instagram" ? <Icons.ig />
              : video.type === "facebook" ? <Icons.fb />
              : null}
          </span>
          {isLocal ? (video.fileSize ? fmtSize(video.fileSize) : "Local file") : video.channel}
        </div>

        {videoCats.length > 0 && (
          <div className="row" style={{ marginBottom: 9 }}>
            {videoCats.map(cat => (
              <span key={cat.id} style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: cat.color + "18", border: `1px solid ${cat.color}44`,
                borderRadius: 5, padding: "2px 7px", fontSize: 10, color: cat.color, fontWeight: 500,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: cat.color }} />{cat.name}
              </span>
            ))}
          </div>
        )}

        {tagsList.length > 0 && (
          <div className="row" style={{ marginBottom: 9 }}>
            {tagsList.map(tag => (
              <span key={tag} className="tag">
                <Icons.tag />#{tag}
                {isEditing && (
                  <button className="tag-x" onClick={() => onRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>
                    <Icons.x />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div
            className={`wcheck ${video.watched ? "on" : ""}`}
            onClick={onWatch}
            role="checkbox"
            aria-checked={video.watched}
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch(); } }}
          >
            <div className="cbox"><Icons.check /></div>
            {isSocial ? "Seen" : "Watched"}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            <button
              className="ghost-btn"
              onClick={onToggleEdit}
              style={{ fontSize: 10.5 }}
              aria-expanded={isEditing}
            >
              {isEditing ? "done" : "edit"}
            </button>
            <button className="icon-btn del-btn" onClick={onDelete} aria-label={`Delete ${video.title}`}>
              <Icons.trash />
            </button>
          </div>
        </div>

        {isEditing && (
          <EditPanel
            video={video}
            categories={categories}
            onPriority={onPriority}
            onToggleCat={onToggleCat}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onNote={onNote}
            onThumbnail={onThumbnail}
          />
        )}

        {!isEditing && video.note && (
          <div
            onClick={onToggleEdit}
            style={{
              marginTop: 9, padding: "7px 9px", background: "#0a0a14",
              borderRadius: 7, borderLeft: "2px solid #2a2a44", fontSize: 11,
              color: "#60609a", lineHeight: 1.55, cursor: "pointer",
            }}
          >
            {video.note}
          </div>
        )}
      </div>
    </div>
  );
});
