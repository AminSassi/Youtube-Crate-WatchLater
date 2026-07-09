import { useState, memo, useCallback } from "react";
import { PRIORITIES } from "../utils/constants";
import { Icons } from "../utils/icons";
import { MESSAGE_TIMEOUT_MS } from "../utils/constants";

export const EditPanel = memo(function EditPanel({
  video, categories, onPriority, onToggleCat, onAddTag, onNote, onThumbnail,
}) {
  const [tagInput, setTagInput] = useState("");
  const [thumbMsg, setThumbMsg] = useState("");
  const isSocial = video.type === "instagram" || video.type === "facebook";

  const commitTag = useCallback(() => {
    if (tagInput.trim()) { onAddTag(tagInput); setTagInput(""); }
  }, [tagInput, onAddTag]);

  const handlePasteThumb = useCallback(async () => {
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
            setThumbMsg("\u2713 Thumbnail saved!");
            setTimeout(() => setThumbMsg(""), MESSAGE_TIMEOUT_MS);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      setThumbMsg("No image in clipboard \u2014 copy a screenshot first.");
    } catch {
      setThumbMsg("Clipboard access denied \u2014 allow it in browser settings.");
    }
  }, [onThumbnail]);

  return (
    <div style={{ marginTop: 12 }}>
      <hr className="divider" />

      {isSocial && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10.5, color: "#40405a", marginBottom: 6, display: "flex",
            alignItems: "center", gap: 5,
          }}>
            <Icons.image /> Thumbnail
          </div>
          <button className="paste-thumb-btn" onClick={handlePasteThumb}>
            \ud83d\udccb Paste screenshot from clipboard
          </button>
          {thumbMsg && (
            <div style={{
              marginTop: 5, fontSize: 11,
              color: thumbMsg.startsWith("\u2713") ? "#4ade80" : "#ff6b8a",
            }}>
              {thumbMsg}
            </div>
          )}
          {video.thumbnail && (
            <div style={{ marginTop: 8, position: "relative" }}>
              <img
                src={video.thumbnail}
                alt="thumb"
                style={{
                  width: "100%", borderRadius: 8, aspectRatio: "16/9",
                  objectFit: "cover", display: "block",
                }}
              />
              <button
                onClick={() => { onThumbnail(null); setThumbMsg(""); }}
                style={{
                  position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.75)",
                  border: "none", borderRadius: 6, color: "white", cursor: "pointer",
                  fontSize: 10.5, padding: "3px 8px", fontFamily: "inherit",
                }}
              >remove</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, color: "#40405a", marginBottom: 6 }}>Priority</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(PRIORITIES).map(([k, p]) => (
            <button
              key={k}
              className="prio-badge"
              style={{
                background: video.priority === k ? p.bg : "#0f0f1a",
                border: `1px solid ${video.priority === k ? p.color + "66" : "#1c1c2e"}`,
                color: video.priority === k ? p.color : "#50507a",
              }}
              onClick={() => onPriority(k)}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.dot }} />{p.label}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, color: "#40405a", marginBottom: 6 }}>Categories</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {categories.map(cat => {
              const active = video.categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  className="cat-pill"
                  style={{
                    background: active ? cat.color + "22" : "#0f0f1a",
                    border: `1px solid ${active ? cat.color + "66" : "#1c1c2e"}`,
                    color: active ? cat.color : "#50507a",
                  }}
                  onClick={() => onToggleCat(cat.id)}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color }} />{cat.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, color: "#40405a", marginBottom: 6 }}>Tags</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11, color: "#40405a" }}>#</span>
          <input
            className="tag-inp"
            placeholder="add tag, enter\u2026"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitTag(); } }}
            aria-label="Add tag"
          />
          <button className="ghost-btn" onClick={commitTag} style={{ fontSize: 10.5 }}>Add</button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: "#40405a", marginBottom: 6 }}>Notes</div>
        <textarea
          className="note-ta"
          rows={3}
          placeholder="Key ideas, timestamps\u2026"
          value={video.note}
          onChange={e => onNote(e.target.value)}
          aria-label="Video notes"
        />
      </div>
    </div>
  );
});
