import { EMPTY, stateSchema, type State } from "./model";
export const STORAGE_KEY = "pd-demo-v1";
export function loadState(): { state: State; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: EMPTY, warning: "" };
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { state: parsed.data, warning: "" };
    return {
      state: EMPTY,
      warning: "Saved demo data could not be read. A fresh sample is shown.",
    };
  } catch {
    return {
      state: EMPTY,
      warning:
        "Browser storage is unavailable or unreadable. Changes may not survive refresh.",
    };
  }
}
export function saveState(state: State) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("pd-demo-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("assets");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Media storage is unavailable."));
  });
}
export async function putAsset(id: string, file: File) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("assets", "readwrite");
      tx.objectStore("assets").put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error("Could not save the file. Browser storage may be full."),
        );
      tx.onabort = () => reject(new Error("File storage was canceled."));
    });
  } finally {
    db.close();
  }
}
export async function getAsset(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("assets").objectStore("assets").get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(new Error("Could not read the attachment."));
    });
  } finally {
    db.close();
  }
}
export async function deleteAsset(id: string) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("assets", "readwrite");
      tx.objectStore("assets").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Could not remove attachment."));
    });
  } finally {
    db.close();
  }
}
export const FILE_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
];
export function validateFile(file: { type: string; size: number }) {
  if (!FILE_TYPES.includes(file.type))
    return "Choose MP4, MOV, WebM, PNG, JPEG, WebP, PDF, or plain text.";
  if (file.size === 0) return "That file is empty. Choose a file with content.";
  if (file.size > 40 * 1024 * 1024)
    return "Choose a file no larger than 40 MB. Prepare or shorten a large video first.";
  return "";
}
