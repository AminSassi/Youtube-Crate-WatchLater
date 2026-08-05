import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  onSnapshot
} from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyBYfPbOJsIJBLNVAMiLqHQ4vU0dWxLcRJQ",
  authDomain:        "vidvault-7a0ee.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "vidvault-7a0ee",
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID          || "470180407124",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:470180407124:web:5f96f1d3a5f0f728c1cac1",
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let firebaseApp, db, auth, provider;

if (isConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  db          = getFirestore(firebaseApp);
  auth        = getAuth(firebaseApp);
  provider    = new GoogleAuthProvider();
}

export { db, auth, provider, isConfigured };

export function getUserCols(uid) {
  const base = `users/${uid}`;
  return {
    videosCol: collection(db, base, "videos"),
    catsCol:   collection(db, base, "categories"),
  };
}

export function subscribeToUserData(uid, callbacks) {
  const { videosCol, catsCol } = getUserCols(uid);

  let userVids = [];
  let userCats = [];

  const notify = () => {
    const sortedVids = [...userVids].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    callbacks.onChange(sortedVids, [...userCats]);
  };

  const unsubUserVideos = onSnapshot(videosCol,
    snap => {
      userVids = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      notify();
    },
    err => {
      console.warn("user videos error:", err);
      callbacks.onError?.();
    }
  );

  const unsubUserCats = onSnapshot(catsCol,
    snap => {
      userCats = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      notify();
    },
    err => {
      console.warn("user cats error:", err);
      callbacks.onError?.();
    }
  );

  return () => {
    unsubUserVideos();
    unsubUserCats();
  };
}

function cleanData(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

export async function saveVideo(videosCol, video) {
  const safeVideo = cleanData({
    ...video,
    watched: Boolean(video.watched),
    priority: video.priority || "none",
    categories: Array.isArray(video.categories) ? video.categories : [],
    tags: Array.isArray(video.tags) ? video.tags : [],
    note: video.note || "",
    addedAt: video.addedAt || Date.now(),
  });
  await setDoc(doc(videosCol, video.id), safeVideo);
}

export async function removeVideo(videosCol, id) {
  await deleteDoc(doc(videosCol, id));
}

export async function saveCategory(catsCol, cat) {
  const safeCat = cleanData({
    ...cat,
    name: cat.name || "Untitled",
    color: cat.color || "#7c6af7",
  });
  await setDoc(doc(catsCol, cat.id), safeCat);
}

export async function removeCategory(catsCol, id) {
  await deleteDoc(doc(catsCol, id));
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, provider);
}

export async function signOutUser() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
