import { memo } from "react";
import { TABS } from "../utils/constants";
import { Icons } from "../utils/icons";

const TAB_ICONS = {
  youtube: Icons.yt,
  instagram: Icons.ig,
  facebook: Icons.fb,
  local: Icons.film,
};

export const TabBar = memo(function TabBar({ activeTab, onTabChange, countFor }) {
  return (
    <div className="tab-wrap" style={{ marginBottom: 26 }}>
      {Object.entries(TABS).map(([key, cfg]) => {
        const active = activeTab === key;
        const count = countFor(key);
        const TabIcon = TAB_ICONS[key];
        return (
          <button
            key={key}
            className="tab-btn"
            onClick={() => onTabChange(key)}
            aria-selected={active}
            role="tab"
            style={{
              background: active ? cfg.darkBg : "transparent",
              color: active ? cfg.accent : "#3a3a58",
              boxShadow: active ? `0 0 0 1px ${cfg.border}, 0 4px 18px ${cfg.accent}18` : "none",
            }}
          >
            <span style={{ opacity: active ? 1 : 0.45 }}><TabIcon /></span>
            <span style={{ fontSize: 12.5 }}>{cfg.label}</span>
            <span className="tab-count" style={{
              background: active ? cfg.accentBg : "#141424",
              color: active ? cfg.accent : "#30304a",
            }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
});
