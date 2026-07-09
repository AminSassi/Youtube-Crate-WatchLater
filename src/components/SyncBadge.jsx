import { memo } from "react";

const SYNC_CONFIG = {
  connecting: { color: "#50507a", label: "Connecting\u2026",           dot: "#50507a" },
  migrating:  { color: "#ffb830", label: "Restoring your videos\u2026", dot: "#ffb830" },
  synced:     { color: "#4ade80", label: "Synced",                 dot: "#4ade80" },
  saving:     { color: "#ffb830", label: "Saving\u2026",                dot: "#ffb830" },
  error:      { color: "#ff6b8a", label: "Sync error",             dot: "#ff6b8a" },
  "sign-in":  { color: "#50507a", label: "Not signed in",          dot: "#50507a" },
};

export const SyncBadge = memo(function SyncBadge({ status }) {
  const cfg = SYNC_CONFIG[status] || SYNC_CONFIG.connecting;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 11.5,
      color: cfg.color, background: "#0f0f1a", border: "1px solid #1c1c2e",
      borderRadius: 8, padding: "5px 11px",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: cfg.dot,
        boxShadow: status === "synced" ? `0 0 6px ${cfg.dot}` : "none",
        display: "inline-block", flexShrink: 0,
      }}/>
      {cfg.label}
    </div>
  );
});
