/** Designs saved by the visitor, kept in localStorage as encodeState strings. */
export const SAVED_KEY = "acme-presets";
export const SAVED_NAME_MAX = 40;

export type SavedPreset = { name: string; query: string; savedAt: number };

type Store = Pick<Storage, "getItem" | "setItem">;

export function readSaved(store: Store): SavedPreset[] {
  try {
    const raw = JSON.parse(store.getItem(SAVED_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is SavedPreset =>
        item != null && typeof item.name === "string" && typeof item.query === "string",
    );
  } catch {
    return [];
  }
}

/** Save under a name. Saving an existing name replaces it and moves it to the top. */
export function savePreset(store: Store, name: string, query: string, now = Date.now()): SavedPreset[] {
  const clean = name.trim().slice(0, SAVED_NAME_MAX);
  if (!clean) return readSaved(store);
  const next = [{ name: clean, query, savedAt: now }, ...readSaved(store).filter((item) => item.name !== clean)];
  store.setItem(SAVED_KEY, JSON.stringify(next));
  return next;
}

export function deletePreset(store: Store, name: string): SavedPreset[] {
  const next = readSaved(store).filter((item) => item.name !== name);
  store.setItem(SAVED_KEY, JSON.stringify(next));
  return next;
}
