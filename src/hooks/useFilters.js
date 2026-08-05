import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "./useDebounce";

export function useFilters(videos) {
  const [tab, setTab] = useState("youtube");
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [prevTab, setPrevTab] = useState(tab);

  const debouncedSearch = useDebounce(search, 300);

  if (tab !== prevTab) {
    setPrevTab(tab);
    setFilter("all");
    setCatFilter("all");
    setPrioFilter("all");
    setSearch("");
  }

  const filtered = useMemo(() => {
    let list = videos.filter(v => tab === "youtube" ? (v.type === "youtube" || !v.type) : v.type === tab);
    if (filter === "watched")   list = list.filter(v => Boolean(v.watched));
    if (filter === "unwatched") list = list.filter(v => !v.watched);
    if (catFilter !== "all")    list = list.filter(v => Array.isArray(v.categories) && v.categories.includes(catFilter));
    if (prioFilter !== "all")   list = list.filter(v => (v.priority || "none") === prioFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(v =>
        (v.title || "").toLowerCase().includes(q) ||
        (v.channel || "").toLowerCase().includes(q) ||
        (Array.isArray(v.tags) && v.tags.some(t => (t || "").toLowerCase().includes(q)))
      );
    }
    const ORD = { urgent: 0, soon: 1, someday: 2, none: 3 };
    if (sortBy === "newest")   list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (sortBy === "oldest")   list.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    if (sortBy === "priority") list.sort((a, b) => (ORD[a.priority || "none"] ?? 3) - (ORD[b.priority || "none"] ?? 3));
    if (sortBy === "title")    list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return list;
  }, [videos, tab, filter, catFilter, prioFilter, debouncedSearch, sortBy]);

  const allCurList = useMemo(() =>
    videos.filter(v => tab === "youtube" ? (v.type === "youtube" || !v.type) : v.type === tab),
    [videos, tab]
  );

  const curWatched = useMemo(() =>
    allCurList.filter(v => v.watched).length,
    [allCurList]
  );

  const countFor = useCallback((k) =>
    videos.filter(v => k === "youtube" ? (v.type === "youtube" || !v.type) : v.type === k).length,
    [videos]
  );

  return {
    tab, setTab,
    filter, setFilter,
    catFilter, setCatFilter,
    prioFilter, setPrioFilter,
    search, setSearch,
    sortBy, setSortBy,
    filtered, allCurList, curWatched, countFor,
  };
}
