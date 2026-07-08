import { createLocalStorageStore } from "./createLocalStorageStore";

export const MIN_WIDTH = 320;
export const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 384; // matches the old fixed w-96

function clamp(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

// Backs the assistant panel's user-resized width.
export const assistantWidthStore = createLocalStorageStore<number>({
  key: "ai-mail-assistant-width",
  defaultValue: DEFAULT_WIDTH,
  serialize: (value) => String(clamp(value)),
  deserialize: (raw) => {
    const parsed = Number(raw);
    return parsed ? clamp(parsed) : DEFAULT_WIDTH;
  },
});
