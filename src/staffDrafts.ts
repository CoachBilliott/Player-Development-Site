import { z } from "zod";
import { drillSchema } from "./model";
import { validateFile } from "./storage";

// Explicit staff-only device drafts. Never use the demo cache or localStorage.
const draftSchema = z.object({
  owner: z.string().uuid(),
  savedAt: z.string().datetime(),
  drill: drillSchema
    .omit({
      assetId: true,
      assetUrl: true,
      assetName: true,
      assetType: true,
      backendVersion: true,
    })
    .extend({ steps: z.array(z.string()) }),
  filename: z.string().min(1).max(180),
  modified: z.number(),
});
export type StaffDraft = z.infer<typeof draftSchema> & { file: File };
let generation = 0;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open("pd-staff-drafts", 1);
    } catch {
      reject(
        new Error(
          "Device draft storage is unavailable. Keep this screen open and check this app's storage permissions.",
        ),
      );
      return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Device draft storage is unavailable."));
    request.onblocked = () =>
      reject(
        new Error(
          "Close other open versions of this app and try saving again.",
        ),
      );
  });
}

async function change(
  action: (store: IDBObjectStore) => void,
  expected?: number,
) {
  const db = await open();
  try {
    if (expected !== undefined && expected !== generation)
      throw new Error(
        "Your sign-in changed. Sign in again before saving a draft.",
      );
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      action(transaction.objectStore("drafts"));
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () =>
        reject(
          new Error(
            "Could not save the device draft. Storage may be full or restricted; your open form is still available.",
          ),
        );
    });
  } finally {
    db.close();
  }
}

export async function saveStaffDraft(
  owner: string,
  drill: StaffDraft["drill"],
  file: File,
) {
  const expected = generation;
  const error = validateFile(file);
  if (error) throw new Error(error);
  // Whitelist fields so a signed media URL or rights acknowledgement is never persisted.
  const metadata = draftSchema.parse({
    owner,
    savedAt: new Date().toISOString(),
    drill,
    filename: file.name,
    modified: file.lastModified,
  });
  await change(
    (store) => store.put({ ...metadata, blob: file }, owner),
    expected,
  );
  return { ...metadata, file };
}

export async function loadStaffDraft(
  owner: string,
): Promise<StaffDraft | null> {
  const expected = generation;
  const db = await open();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction("drafts").objectStore("drafts").get(owner);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(
            "Could not open the saved draft. Try again before clearing browser data.",
          ),
        );
    });
    if (!value || expected !== generation) return null;
    const metadata = draftSchema.safeParse(value);
    const blob = (value as { blob?: unknown }).blob;
    if (
      !metadata.success ||
      metadata.data.owner !== owner ||
      !(blob instanceof Blob)
    )
      throw new Error(
        "This device draft could not be read. Discard it and select the original file again.",
      );
    const file = new File([blob], metadata.data.filename, {
      type: blob.type,
      lastModified: metadata.data.modified,
    });
    if (validateFile(file))
      throw new Error(
        "This saved file is no longer supported. Discard the draft and choose a supported file.",
      );
    return { ...metadata.data, file };
  } finally {
    db.close();
  }
}

export async function deleteStaffDraft(owner: string, draftId?: string) {
  await change((store) => {
    const request = store.get(owner);
    request.onsuccess = () => {
      if (!draftId || request.result?.drill?.id === draftId)
        store.delete(owner);
    };
  });
}

export async function clearStaffDrafts() {
  // Invalidates an open/save still waiting for IndexedDB when sign-out occurs.
  generation++;
  await change((store) => store.clear());
}
