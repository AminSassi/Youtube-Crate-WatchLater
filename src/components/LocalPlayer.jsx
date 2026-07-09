import { useState, useEffect, memo } from "react";
import { getLocalFileURL } from "../services/indexedDB";
import { fmtSize } from "../utils/helpers";
import { Icons } from "../utils/icons";

export const LocalPlayer = memo(function LocalPlayer({ video, onClose }) {
  const [localUrl, setLocalUrl] = useState(video.type === "local" ? null : video.url);
  const [err, setErr] = useState(video.type === "local" ? false : !video.url);

  useEffect(() => {
    if (video.type !== "local") return;
    let active = true;
    let objectUrl = null;
    getLocalFileURL(video.id).then(url => {
      if (!active) return;
      if (!url) { setErr(true); setLocalUrl(null); return; }
      objectUrl = url;
      setLocalUrl(url);
    }).catch(() => {
      if (active) { setErr(true); setLocalUrl(null); }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [video.id, video.type]);

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${video.title}`}
    >
      <div style={{
        width: "100%", maxWidth: 920, background: "#0f0f1a", borderRadius: 22,
        border: "1px solid #2a2a42", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,.9)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #141424",
        }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#d0d0e8" }}>{video.title}</div>
            <div style={{ fontSize: 11, color: "#50507a", marginTop: 2 }}>
              {video.fileSize ? fmtSize(video.fileSize) : ""} \u00b7 {video.fileMime || "video"} \u00b7 {video.type === "local" ? "local file" : "cloud storage"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#141424", border: "1px solid #1c1c2e",
              borderRadius: 8, padding: "6px 10px", color: "#8080a8", cursor: "pointer",
              display: "flex", alignItems: "center",
            }}
            aria-label="Close player"
          ><Icons.x /></button>
        </div>
        <div style={{
          background: "#000", aspectRatio: "16/9", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          {err
            ? <div style={{ color: "#ff6b8a", fontSize: 13, textAlign: "center", padding: 30 }}>
                File not available.<br />
                <span style={{ color: "#50507a", fontSize: 11.5 }}>
                  {video.type === "local"
                    ? "This local file is only stored on your device."
                    : "This video is not stored in cloud storage."}
                </span>
              </div>
            : <video
                src={localUrl}
                controls
                autoPlay
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
          }
        </div>
      </div>
    </div>
  );
});
