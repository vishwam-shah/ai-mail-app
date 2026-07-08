import { create } from "zustand";

export interface ComposeDraft {
  to: string;
  subject: string;
  body: string;
}

export const emptyDraft: ComposeDraft = { to: "", subject: "", body: "" };

interface ComposeStore {
  draft: ComposeDraft;
  setDraft: (patch: Partial<ComposeDraft>) => void;
  resetDraft: () => void;
}

// Single source of truth for the compose form. The assistant's openCompose/
// fillComposeField actions write here directly (Day 3), so the form fills
// visibly regardless of whether the user or the assistant is driving it.
export const useComposeStore = create<ComposeStore>((set) => ({
  draft: emptyDraft,
  setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set({ draft: emptyDraft }),
}));
