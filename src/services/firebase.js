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
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        "vidvault-7a0ee.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
export const db     = getFirestore(firebaseApp);
export const auth   = getAuth(firebaseApp);
const provider     = new GoogleAuthProvider();

export function getUserCols(uid) {
  const base = `users/${uid}`;
  return {
    videosCol: collection(db, base, "videos"),
    catsCol:   collection(db, base, "categories"),
  };
}

export function subscribeToUserData(uid, callbacks) {
  const { videosCol, catsCol } = getUserCols(uid);
  const globalVideosCol = collection(db, "videos");
  const globalCatsCol   = collection(db, "categories");

  let userVids = [], globalVids = [], userCats = [], globalCats = [];

  const merge = () => {
    const allVids = [...globalVids];
    userVids.forEach(v => { if (!allVids.find(x => x.id === v.id)) allVids.push(v); });
    allVids.sort((a, b) => b.addedAt - a.addedAt);
    const allCats = [...globalCats];
    userCats.forEach(c => { if (!allCats.find(x => x.id === c.id)) allCats.push(c); });
    callbacks.onChange(allVids, allCats);
  };

  const unsubUserVideos = onSnapshot(videosCol,
    snap => { userVids = snap.docs.map(d => d.data()); merge(); },
    err => { console.warn("user videos:", err); callbacks.onError(); }
  );
  const unsubGlobalVideos = onSnapshot(globalVideosCol,
    snap => { globalVids = snap.docs.map(d => d.data()); merge(); },
    err => { console.warn("global videos:", err); }
  );
  const unsubUserCats = onSnapshot(catsCol,
    snap => { userCats = snap.docs.map(d => d.data()); merge(); },
    err => { console.warn("user cats:", err); callbacks.onError(); }
  );
  const unsubGlobalCats = onSnapshot(globalCatsCol,
    snap => { globalCats = snap.docs.map(d => d.data()); merge(); },
    err => { console.warn("global cats:", err); }
  );

  return () => {
    unsubUserVideos();
    unsubGlobalVideos();
    unsubUserCats();
    unsubGlobalCats();
  };
}

export async function saveVideo(videosCol, video) {
  await setDoc(doc(videosCol, video.id), video);
}

export async function removeVideo(videosCol, id) {
  await deleteDoc(doc(videosCol, id));
}

export async function saveCategory(catsCol, cat) {
  await setDoc(doc(catsCol, cat.id), cat);
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
