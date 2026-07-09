import { useState, useRef, useEffect, memo, useCallback } from "react";
import { PRIORITIES } from "../utils/constants";
import { Icons } from "../utils/icons";

export const FilterBar = memo(function FilterBar({
  filter, setFilter,
  prioFilter, setPrioFilter,
  search, setSearch,
  sortBy, setSortBy,
  allCurList, curWatched,
  categories, catFilter, setCatFilter,
}) {
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    const fn = e => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleSort = useCallback((v) => { setSortBy(v); setShowSort(false); }, [setSortBy]);

  if (allCurList.length === 0) return null;

  return (
    <>
      <div style={{
        marginTop: 14, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
      }}>
        {[["all", "All"], ["unwatched", "Unseen"], ["watched", "Seen"]].map(([v, l]) => (
          <button
            key={v}
            className={`filter-btn ${filter === v ? "on" : ""}`}
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
          >
            {l} {v === "all" ? allCurList.length : v === "watched" ? curWatched : allCurList.length - curWatched}
          </button>
        ))}
        {Object.entries(PRIORITIES).filter(([k]) => k !== "none").map(([k, p]) => (
          <button
            key={k}
            className={`filter-btn ${prioFilter === k ? "on" : ""}`}
            style={prioFilter === k ? { borderColor: p.color + "66", color: p.color, background: p.bg } : {}}
            onClick={() => setPrioFilter(prioFilter === k ? "all" : k)}
            aria-pressed={prioFilter === k}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: p.dot,
              display: "inline-block", marginRight: 4,
            }}/>
            {p.label}
          </button>
        ))}
        <div className="search-wrap" style={{ maxWidth: 200 }}>
          <span className="search-icon"><Icons.search /></span>
          <input
            className="search-inp"
            placeholder="Search\u2026"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search videos"
          />
        </div>
        <div ref={sortRef} style={{ position: "relative", marginLeft: "auto" }}>
          <button
            className="ghost-btn"
            style={{ display: "flex", alignItems: "center", gap: 5 }}
            onClick={() => setShowSort(s => !s)}
            aria-haspopup="true"
            aria-expanded={showSort}
          >
            <Icons.sort /> Sort
          </button>
          {showSort && (
            <div className="sort-menu" role="menu">
              {[["newest", "Newest first"], ["oldest", "Oldest first"], ["priority", "By priority"], ["title", "Title A\u2013Z"]].map(([v, l]) => (
                <div
                  key={v}
                  className={`sort-item ${sortBy === v ? "on" : ""}`}
                  onClick={() => handleSort(v)}
                  role="menuitem"
                >{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      {categories.length > 0 && (
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 11, color: "#40405a", display: "flex", alignItems: "center", gap: 4 }}>
            <Icons.folder /> Categories
          </span>
          {categories.map(cat => (
            <button
              key={cat.id}
              className="cat-pill"
              style={{
                background: catFilter === cat.id ? cat.color + "22" : "#0f0f1a",
                border: `1px solid ${catFilter === cat.id ? cat.color + "66" : "#1c1c2e"}`,
                color: catFilter === cat.id ? cat.color : "#70709a",
              }}
              onClick={() => setCatFilter(catFilter === cat.id ? "all" : cat.id)}
              aria-pressed={catFilter === cat.id}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: cat.color,
                display: "inline-block",
              }}/>
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
});
