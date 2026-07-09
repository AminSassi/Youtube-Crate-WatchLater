import { memo } from "react";
import { Icons } from "../utils/icons";
import { SyncBadge } from "./SyncBadge";

export const Header = memo(function Header({ syncStatus, user, videoCount, watchedCount, onSignOut }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: "linear-gradient(135deg,#7c6af7,#5a4ad1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,106,247,.4)",
        }}>
          <Icons.vault />
        </div>
        <div>
          <div style={{
            fontFamily: "'Cabinet Grotesk',system-ui", fontWeight: 800, fontSize: 20,
            letterSpacing: "-0.4px",
          }}>Video Vault</div>
          <div style={{ fontSize: 10.5, color: "#30304a", marginTop: 1 }}>
            Synced across all your devices
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <SyncBadge status={syncStatus} />
        {user && (
          <button className="ghost-btn" onClick={onSignOut} style={{ whiteSpace: "nowrap" }}>
            Sign out
          </button>
        )}
        {videoCount > 0 && (
          <div style={{
            fontSize: 12, color: "#50507a", background: "#0f0f1a",
            border: "1px solid #1c1c2e", borderRadius: 9, padding: "5px 14px",
          }}>
            <span style={{ color: "#9090b8", fontWeight: 700 }}>{watchedCount}</span>
            <span style={{ color: "#30304a" }}> / {videoCount} saved</span>
          </div>
        )}
      </div>
    </div>
  );
});
