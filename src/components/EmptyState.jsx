import { TABS } from "../utils/constants";

export function EmptyState({ tab, syncStatus, hasFilters }) {
  const t = TABS[tab];

  if (syncStatus === "connecting") {
    return (
      <div className="empty">
        <div className="spinner" style={{
          width: 28, height: 28, borderWidth: 3,
          borderTopColor: "#7c6af7", borderColor: "#1c1c2e",
        }}/>
        <h3>Connecting to cloud\u2026</h3>
        <p>Restoring your saved videos.</p>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="empty">
        <div style={{ fontSize: 38 }}>{t.emoji}</div>
        <h3>No items match</h3>
        <p>Try adjusting your filters or search.</p>
      </div>
    );
  }

  let message;
  if (tab === "youtube") message = "Paste a YouTube URL above to start.";
  else if (tab === "local") message = "Click above to add video files from your device.";
  else message = `Paste a ${t.label} URL and give it a title to save it.`;

  return (
    <div className="empty">
      <div style={{ fontSize: 38 }}>{t.emoji}</div>
      <h3>No {t.label} saves yet</h3>
      <p>{message}</p>
    </div>
  );
}
