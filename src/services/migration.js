import { collection, writeBatch, doc, getDocs } from "firebase/firestore";
import { db, getUserCols } from "./firebase";

const LEGACY_KEY = "vidvault_v2";

export async function migrateGlobalToUser(uid) {
  const userGlobalFlag = `vidvault_global_migrated_${uid}`;
  if (localStorage.getItem(userGlobalFlag)) return;

  const { videosCol, catsCol } = getUserCols(uid);

  try {
    const existing = await getDocs(videosCol);
    if (!existing.empty) {
      localStorage.setItem(userGlobalFlag, "1");
      return;
    }

    console.log("[migration] starting global\u2192user migration for user:", uid);
    const [oldVideos, oldCats] = await Promise.all([
      getDocs(collection(db, "videos")),
      getDocs(collection(db, "categories")),
    ]);

    if (oldVideos.empty && oldCats.empty) {
      console.log("[migration] no global documents found");
      localStorage.setItem(userGlobalFlag, "1");
      return;
    }

    const allDocs = [
      ...oldVideos.docs.map(d => ({ col: videosCol, data: { ...d.data(), id: d.id } })),
      ...oldCats.docs.map(d => ({ col: catsCol,   data: { ...d.data(), id: d.id } })),
    ];
    for (let i = 0; i < allDocs.length; i += 400) {
      const batch = writeBatch(db);
      allDocs.slice(i, i + 400).forEach(({ col, data }) => batch.set(doc(col, data.id), data));
      await batch.commit();
    }
    console.log("[migration] global migration complete!");
    localStorage.setItem(userGlobalFlag, "1");
  } catch (err) {
    console.warn("[migration] global migration error:", err);
  }
}

export async function migrateFromLocalStorage(uid) {
  const userLocalFlag = `vidvault_local_migrated_${uid}`;
  if (localStorage.getItem(userLocalFlag)) return;

  const { videosCol, catsCol } = getUserCols(uid);

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    localStorage.setItem(userLocalFlag, "1");
    return;
  }

  let legacy;
  try {
    legacy = JSON.parse(raw);
  } catch {
    localStorage.setItem(userLocalFlag, "1");
    return;
  }

  const { videos = [], categories = [] } = legacy;
  if (!videos.length && !categories.length) {
    localStorage.setItem(userLocalFlag, "1");
    return;
  }

  try {
    const existing = await getDocs(videosCol);
    if (!existing.empty) {
      localStorage.setItem(userLocalFlag, "1");
      return;
    }

    const allDocs = [
      ...videos.map(v => ({ col: videosCol, data: { ...v, type: v.type || "youtube" } })),
      ...categories.map(c => ({ col: catsCol, data: c })),
    ];
    for (let i = 0; i < allDocs.length; i += 400) {
      const batch = writeBatch(db);
      allDocs.slice(i, i + 400).forEach(({ col, data }) => batch.set(doc(col, data.id), data));
      await batch.commit();
    }
    localStorage.setItem(userLocalFlag, "1");
  } catch (err) {
    console.warn("[migration] localStorage migration error:", err);
  }
}
