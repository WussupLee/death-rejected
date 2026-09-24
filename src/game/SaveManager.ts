export interface SaveData {
  version: 2;
  attempts: number;
  bestMoon: number;
}
const STORAGE_KEY = "death-rejected-save-v2";
const LEGACY_KEY = "death-rejected-save-v1";
const integer = (value: unknown, minimum: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(999999, Math.floor(value)))
    : minimum;
export function migrateSave(raw: unknown): SaveData {
  const input =
    raw && typeof raw === "object" ? (raw as Partial<SaveData>) : {};
  return {
    version: 2,
    attempts: integer(input.attempts, 0),
    bestMoon: integer(input.bestMoon, 1),
  };
}
export class SaveManager {
  data: SaveData = migrateSave(null);
  constructor(
    private readonly storage: Pick<
      Storage,
      "getItem" | "setItem"
    > = localStorage,
  ) {
    for (const key of [STORAGE_KEY, LEGACY_KEY]) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          this.data = migrateSave(JSON.parse(raw));
          this.persist();
          break;
        }
      } catch {
        /* Try legacy data if new data is corrupt. */
      }
    }
  }
  recordDeath(moon: number): SaveData {
    this.data.attempts++;
    this.recordMoon(moon);
    this.persist();
    return this.data;
  }
  recordMoon(moon: number): void {
    this.data.bestMoon = Math.max(this.data.bestMoon, integer(moon, 1));
    this.persist();
  }
  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* Private browsing still supports the full run. */
    }
  }
}
