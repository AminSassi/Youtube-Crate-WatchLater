const LOCAL_DB    = "vidvault_local_files";
const LOCAL_STORE = "files";

function openLocalDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(LOCAL_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalFileBlob(id, file) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    const store = tx.objectStore(LOCAL_STORE);
    const req = store.put({ id, blob: file, createdAt: Date.now() });
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalFileBlob(id) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readonly");
    const req = tx.objectStore(LOCAL_STORE).get(id);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalFileURL(id) {
  const blob = await getLocalFileBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function deleteLocalFileBlob(id) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    const req = tx.objectStore(LOCAL_STORE).delete(id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
