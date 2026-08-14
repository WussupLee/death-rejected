export interface SaveData {
  attempts: number;
  bestMoon: number;
}

const STORAGE_KEY = "death-rejected-save-v1";

export class SaveManager {
  data: SaveData = { attempts: 0, bestMoon: 1 };

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = {
          attempts: Math.max(0, Number(parsed.attempts) || 0),
          bestMoon: Math.max(1, Number(parsed.bestMoon) || 1),
        };
      }
    } catch {
      this.data = { attempts: 0, bestMoon: 1 };
    }
  }

  recordDeath(reachedMoon: number): SaveData {
    this.data.attempts += 1;
    this.data.bestMoon = Math.max(this.data.bestMoon, reachedMoon);
    this.persist();
    return this.data;
  }

  recordMoon(moon: number): void {
    if (moon <= this.data.bestMoon) return;
    this.data.bestMoon = moon;
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // The game remains playable when storage is unavailable.
    }
  }
}
