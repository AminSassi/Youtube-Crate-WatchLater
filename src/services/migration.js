import { collection, writeBatch, doc, getDocs } from "firebase/firestore";
import { db, getUserCols } from "./firebase";

const LEGACY_KEY       = "vidvault_v2";
const MIGRATED_FLAG    = "vidvault_migrated_v1";
const GLOBAL_MIG_FLAG  = "vidvault_global_migrated_v1";

export async function migrateGlobalToUser(uid) {
  if (localStorage.getItem(GLOBAL_MIG_FLAG)) return;
  const { videosCol, catsCol } = getUserCols(uid);

  console.log("[migration] starting global\u2192user migration...");
  const [oldVideos, oldCats] = await Promise.all([
    getDocs(collection(db, "videos")),
    getDocs(collection(db, "categories")),
  ]);
  console.log(`[migration] found ${oldVideos.size} videos, ${oldCats.size} categories in global collections`);
  if (oldVideos.empty && oldCats.empty) {
    console.log("[migration] nothing to migrate");
    localStorage.setItem(GLOBAL_MIG_FLAG, "1");
    return;
  }

  const allDocs = [
    ...oldVideos.docs.map(d => ({ col: videosCol, data: d.data() })),
    ...oldCats.docs.map(d => ({ col: catsCol,   data: d.data() })),
  ];
  for (let i = 0; i < allDocs.length; i += 400) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + 400).forEach(({ col, data }) => batch.set(doc(col, data.id), data));
    await batch.commit();
  }
  console.log("[migration] done!");
  localStorage.setItem(GLOBAL_MIG_FLAG, "1");
}

export async function migrateFromLocalStorage(uid) {
  if (localStorage.getItem(MIGRATED_FLAG)) return;
  const { videosCol, catsCol } = getUserCols(uid);

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }

  let legacy;
  try { legacy = JSON.parse(raw); } catch { localStorage.setItem(MIGRATED_FLAG, "1"); return; }

  const { videos = [], categories = [] } = legacy;
  if (!videos.length && !categories.length) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }

  const existing = await getDocs(videosCol);
  if (!existing.empty) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }

  const allDocs = [
    ...videos.map(v => ({ col: videosCol, data: { ...v, type: v.type || "youtube" } })),
    ...categories.map(c => ({ col: catsCol, data: c })),
  ];
  for (let i = 0; i < allDocs.length; i += 400) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + 400).forEach(({ col, data }) => batch.set(doc(col, data.id), data));
    await batch.commit();
  }
  localStorage.setItem(MIGRATED_FLAG, "1");
}
