import { useState, useEffect, useRef, useCallback } from "react";
import { getUserCols, subscribeToUserData, saveVideo, removeVideo, saveCategory, removeCategory, isConfigured } from "../services/firebase";
import { saveLocalFileBlob, deleteLocalFileBlob } from "../services/indexedDB";
import { migrateGlobalToUser, migrateFromLocalStorage } from "../services/migration";
import { extractYouTubeId, fetchYouTubeMeta, generateThumbnail, uid } from "../utils/helpers";
import { MAX_FILE_SIZE, ALLOWED_VIDEO_TYPES } from "../utils/constants";

export function useVideos(user) {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [error, setError] = useState("");
  const colsRef = useRef(null);

  useEffect(() => {
    if (!user || !isConfigured) {
      setVideos([]);
      setCategories([]);
      colsRef.current = null;
      setSyncStatus(isConfigured ? "sign-in" : "error");
      if (!isConfigured) setError("Firebase is not configured. Create a .env file with your Firebase credentials.");
      return;
    }

    const { videosCol, catsCol } = getUserCols(user.uid);
    colsRef.current = { videosCol, catsCol };

    setSyncStatus("connecting");
    setError("");

    migrateGlobalToUser(user.uid).catch(() => {});
    migrateFromLocalStorage(user.uid).catch(() => {});

    const unsub = subscribeToUserData(user.uid, {
      onChange: (allVids, allCats) => {
        setVideos(allVids);
        setCategories(allCats);
        setSyncStatus("synced");
      },
      onError: () => setSyncStatus("error"),
    });

    return unsub;
  }, [user]);

  const withSaving = useCallback(async (fn) => {
    if (!colsRef.current) { setError("Not signed in."); return; }
    setSyncStatus("saving");
    try {
      await fn(colsRef.current);
      setSyncStatus("synced");
    } catch (err) {
      console.warn("Save error:", err);
      setSyncStatus("error");
      if (err.code === "permission-denied") {
        setError("Permission denied. Check your Firebase security rules.");
      } else if (err.code === "unavailable") {
        setError("Service unavailable. Check your internet connection.");
      } else {
        setError("Couldn't save your changes. Check your connection and try again.");
      }
    }
  }, []);

  const addYouTube = useCallback(async (url) => {
    setError("");
    const trimmed = url.trim();
    if (!trimmed) return;
    const videoId = extractYouTubeId(trimmed);
    if (!videoId) { setError("That doesn't look like a YouTube URL. Try pasting a link from youtube.com or youtu.be."); return; }
    if (videos.find(v => v.id === videoId)) { setError("This video is already in your vault."); return; }

    try {
      const meta = await fetchYouTubeMeta(videoId);
      await withSaving(({ videosCol }) => saveVideo(videosCol, {
        id: videoId, type: "youtube", title: meta.title, channel: meta.channel,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        url: `https://youtube.com/watch?v=${videoId}`,
        watched: false, priority: "none", categories: [], tags: [], note: "", addedAt: Date.now(),
      }));
    } catch {
      setError("Couldn't fetch video info. Check your connection and try again.");
    }
  }, [videos, withSaving]);

  const addSocial = useCallback(async (platform, url, title) => {
    setError("");
    if (videos.find(v => v.url === url)) { setError("This link is already in your vault."); return; }
    await withSaving(({ videosCol }) => saveVideo(videosCol, {
      id: uid(), type: platform, title, url,
      channel: platform === "instagram" ? "Instagram" : "Facebook",
      thumbnail: null, thumbColor: platform === "instagram" ? "#833ab4" : "#1877f2",
      watched: false, priority: "none", categories: [], tags: [], note: "", addedAt: Date.now(),
    }));
  }, [videos, withSaving]);

  const addLocalFiles = useCallback(async (files) => {
    setError("");
    for (const file of files) {
      if (file.size === 0) { setError(`${file.name} is empty. Please select a valid video file.`); continue; }
      if (file.size > MAX_FILE_SIZE) { setError(`${file.name} is too large. Maximum file size is 500MB.`); continue; }
      if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type) && !file.type.startsWith("video/")) {
        setError(`${file.name} is not a supported video format. Use MP4, WebM, or MOV.`);
        continue;
      }
      const id = uid();
      try {
        await saveLocalFileBlob(id, file);
        const thumb = await generateThumbnail(file);
        await withSaving(({ videosCol }) => saveVideo(videosCol, {
          id, type: "local",
          title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
          channel: "Local File", thumbnail: thumb, thumbColor: null,
          fileSize: file.size, fileMime: file.type || "video/mp4",
          watched: false, priority: "none", categories: [], tags: [], note: "", addedAt: Date.now(),
        }));
      } catch (err) {
        console.warn("Local save failed:", err);
        if (err.name === "QuotaExceededError") {
          setError("Your browser storage is full. Delete some files and try again.");
        } else {
          setError(`Couldn't save ${file.name}. Check your connection and try again.`);
        }
      }
    }
  }, [withSaving]);

  const deleteVideo = useCallback(async (video) => {
    if (video.type === "local") {
      try { await deleteLocalFileBlob(video.id); } catch { /* local blob already gone */ }
    }
    await withSaving(({ videosCol }) => removeVideo(videosCol, video.id));
  }, [withSaving]);

  const updateVideo = useCallback(async (id, fields) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;

    // Optimistic update: apply change immediately
    const optimistic = { ...video, ...fields };
    setVideos(prev => prev.map(v => v.id === id ? optimistic : v));

    try {
      if (!colsRef.current) throw new Error("Not signed in");
      setSyncStatus("saving");
      await saveVideo(colsRef.current.videosCol, optimistic);
      setSyncStatus("synced");
    } catch (err) {
      console.warn("Save error:", err);
      // Revert optimistic update
      setVideos(prev => prev.map(v => v.id === id ? video : v));
      setSyncStatus("error");
      if (err.code === "permission-denied") {
        setError("Permission denied. Check your Firebase security rules.");
      } else {
        setError("Couldn't save your changes. Check your connection and try again.");
      }
    }
  }, [videos]);

  const addCategory = useCallback(async (name) => {
    if (!name || categories.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
    const cat = { id: Date.now().toString(), name, color: categories.length % 8 === 0 ? "#7c6af7" : ["#7c6af7","#f97316","#06b6d4","#ec4899","#84cc16","#f59e0b","#8b5cf6","#10b981"][categories.length % 8] };
    await withSaving(({ catsCol }) => saveCategory(catsCol, cat));
  }, [categories, withSaving]);

  const deleteCategory = useCallback(async (id) => {
    const affected = videos.filter(v => v.categories.includes(id));
    await withSaving(async ({ videosCol, catsCol }) => {
      await removeCategory(catsCol, id);
      for (const v of affected) await saveVideo(videosCol, { ...v, categories: v.categories.filter(c => c !== id) });
    });
  }, [videos, withSaving]);

  const toggleVideoCategory = useCallback(async (vid, catId) => {
    const video = videos.find(v => v.id === vid);
    if (!video) return;
    const cats = video.categories.includes(catId)
      ? video.categories.filter(c => c !== catId)
      : [...video.categories, catId];
    await withSaving(({ videosCol }) => saveVideo(videosCol, { ...video, categories: cats }));
  }, [videos, withSaving]);

  const addTag = useCallback(async (vid, tag) => {
    const clean = tag.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    const video = videos.find(v => v.id === vid);
    if (!video || video.tags.includes(clean)) return;
    await withSaving(({ videosCol }) => saveVideo(videosCol, { ...video, tags: [...video.tags, clean] }));
  }, [videos, withSaving]);

  const removeTag = useCallback(async (vid, tag) => {
    const video = videos.find(v => v.id === vid);
    if (!video) return;
    await withSaving(({ videosCol }) => saveVideo(videosCol, { ...video, tags: video.tags.filter(t => t !== tag) }));
  }, [videos, withSaving]);

  return {
    videos, categories, syncStatus, error, setError,
    addYouTube, addSocial, addLocalFiles, deleteVideo, updateVideo,
    addCategory, deleteCategory, toggleVideoCategory, addTag, removeTag,
  };
}
