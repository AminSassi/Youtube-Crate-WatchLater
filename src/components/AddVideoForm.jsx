import { useState, useRef, useEffect, memo } from "react";
import { Icons } from "../utils/icons";
import { TABS } from "../utils/constants";
import { isSafeUrl } from "../utils/helpers";

export const AddVideoForm = memo(function AddVideoForm({ tab, onAddYouTube, onAddSocial, onAddLocal, loading, error }) {
  const [ytUrl, setYtUrl] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [socialTitle, setSocialTitle] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const ytInputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (tab === "youtube") setTimeout(() => ytInputRef.current?.focus(), 80);
  }, [tab]);

  const handleYouTube = async () => {
    if (!ytUrl.trim()) return;
    await onAddYouTube(ytUrl);
    setYtUrl("");
  };

  const handleSocial = async () => {
    if (!socialUrl.trim() || !socialTitle.trim()) return;
    if (!isSafeUrl(socialUrl)) return;
    await onAddSocial(tab, socialUrl.trim(), socialTitle.trim());
    setSocialUrl("");
    setSocialTitle("");
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLocalLoading(true);
    await onAddLocal(files);
    setLocalLoading(false);
    e.target.value = "";
  };

  if (tab === "youtube") {
    return (
      <>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={ytInputRef}
            className="url-input"
            placeholder="Paste a YouTube URL\u2026"
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && handleYouTube()}
            aria-label="YouTube URL"
          />
          <button
            onClick={handleYouTube}
            disabled={loading || !ytUrl.trim()}
            style={{
              background: loading || !ytUrl.trim() ? "#1a0a10" : "linear-gradient(135deg,#ff4d6d,#d42f4e)",
              color: loading || !ytUrl.trim() ? "#50304a" : "white",
              border: "none", borderRadius: 12, padding: "0 22px", height: 48, fontSize: 13,
              fontWeight: 700, cursor: loading || !ytUrl.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 7, transition: "all .18s",
              fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
              boxShadow: loading || !ytUrl.trim() ? "none" : "0 4px 18px rgba(255,77,109,.35)",
            }}
          >
            {loading ? <div className="spinner" /> : <Icons.plus />}
            {loading ? "Fetching\u2026" : "Add"}
          </button>
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 11.5, color: "#ff6b8a" }}>{error}</div>}
      </>
    );
  }

  if (tab === "instagram" || tab === "facebook") {
    const t = TABS[tab];
    return (
      <div style={{
        background: "#0a0a12", border: `1px solid ${t.border}`, borderRadius: 16, padding: 20,
      }}>
        <div style={{
          fontSize: 12, color: "#50507a", marginBottom: 14, display: "flex",
          alignItems: "center", gap: 6,
        }}>
          <span style={{ color: t.accent }}>{tab === "instagram" ? <Icons.ig /> : <Icons.fb />}</span>
          Save a {t.label} post or reel \u2014 syncs across all your devices
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
              color: "#30304a", pointerEvents: "none",
            }}><Icons.link /></span>
            <input
              value={socialUrl}
              onChange={e => setSocialUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSocial()}
              placeholder={`Paste ${t.label} URL\u2026`}
              style={{
                width: "100%", background: "#0f0f1a", border: "1px solid #1c1c2e", borderRadius: 11,
                padding: "0 14px 0 38px", height: 46, color: "#d0d0e8", fontSize: 13,
                fontFamily: "inherit", outline: "none",
              }}
              aria-label={`${t.label} URL`}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={socialTitle}
              onChange={e => setSocialTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSocial()}
              placeholder="Give it a title\u2026"
              style={{
                flex: 1, background: "#0f0f1a", border: "1px solid #1c1c2e", borderRadius: 11,
                padding: "0 14px", height: 46, color: "#d0d0e8", fontSize: 13,
                fontFamily: "inherit", outline: "none",
              }}
              aria-label="Video title"
            />
            <button
              onClick={handleSocial}
              disabled={loading || !socialUrl.trim() || !socialTitle.trim()}
              style={{
                background: loading || !socialUrl.trim() || !socialTitle.trim() ? "#141424" : t.accent,
                color: loading || !socialUrl.trim() || !socialTitle.trim() ? "#30304a" : "white",
                border: "none", borderRadius: 11, padding: "0 22px", height: 46, fontSize: 13,
                fontWeight: 700,
                cursor: loading || !socialUrl.trim() || !socialTitle.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 7, transition: "all .18s",
                fontFamily: "inherit", flexShrink: 0,
                boxShadow: loading || !socialUrl.trim() || !socialTitle.trim()
                  ? "none" : `0 4px 18px ${t.accent}44`,
              }}
            >
              {loading ? <div className="spinner" /> : <Icons.plus />}
              {loading ? "Saving\u2026" : "Save"}
            </button>
          </div>
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 11.5, color: "#ff6b8a" }}>{error}</div>}
      </div>
    );
  }

  if (tab === "local") {
    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFiles}
          aria-label="Upload local video files"
        />
        <div className="drop-zone" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, background: "#0a0a14",
            border: "1px solid #06b6d422", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#06b6d4",
          }}>
            <Icons.upload />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: localLoading ? "#06b6d4" : "#7070a0",
              marginBottom: 4,
            }}>
              {localLoading ? "Processing\u2026" : "Click to add local videos"}
            </div>
            <div style={{ fontSize: 11.5, color: "#30304a" }}>
              MP4, MKV, WebM, MOV \u00b7 select multiple
            </div>
          </div>
          {localLoading && (
            <div className="spinner" style={{
              borderTopColor: "#06b6d4", borderColor: "rgba(6,182,212,.2)", width: 18, height: 18,
            }}/>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#252530", textAlign: "center" }}>
          \u26a0\ufe0f Local files stay on this device only \u2014 metadata syncs, but the file itself does not
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 11.5, color: "#ff6b8a" }}>{error}</div>}
      </>
    );
  }

  return null;
});
