import { create } from "zustand";
import { z } from "zod";

export const readStatusSchema = z.enum(["all", "unread", "read"]);
export type ReadStatus = z.infer<typeof readStatusSchema>;

export const filterStateSchema = z.object({
  dateFrom: z.string().nullable(), // ISO date (yyyy-mm-dd)
  dateTo: z.string().nullable(),
  sender: z.string().nullable(),
  keyword: z.string().nullable(),
  readStatus: readStatusSchema,
});
export type FilterState = z.infer<typeof filterStateSchema>;

export const defaultFilterState: FilterState = {
  dateFrom: null,
  dateTo: null,
  sender: null,
  keyword: null,
  readStatus: "all",
};

interface FilterStore {
  filters: FilterState;
  setFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
}

// Single source of truth for Inbox/Sent filtering. Both the plain-UI FilterBar
// and the assistant's searchEmails action write here via setFilters — whichever
// path sets it, the mail list's subscription re-fetches and re-renders the same way.
export const useFilterStore = create<FilterStore>((set) => ({
  filters: defaultFilterState,
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set({ filters: defaultFilterState }),
}));

// Converts a "last N days" instruction into a concrete dateFrom (yyyy-mm-dd).
export function relativeDaysToDateFrom(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
