import { createLocalStorageStore } from "./createLocalStorageStore";

// Backs the mail sidebar's collapsed flag. Avoids the classic "setState
// inside an effect just to read localStorage after mount" pattern entirely.
export const sidebarCollapsedStore = createLocalStorageStore<boolean>({
  key: "ai-mail-sidebar-collapsed",
  defaultValue: false,
  serialize: String,
  deserialize: (raw) => raw === "true",
});
