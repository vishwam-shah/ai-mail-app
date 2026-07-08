import { useState } from "react";

export interface CursorPage {
  /** 0-indexed page currently displayed. */
  index: number;
  /** Token to send to the API for the current page (undefined = first page). */
  token: string | undefined;
  /** How many pages have been discovered so far (>= 1). */
  knownCount: number;
  /** Whether there's a page beyond the last known one. */
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UseCursorPaginationResult extends CursorPage {
  goToPage: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** Call with the token from the latest response once it arrives. */
  reportNextToken: (nextToken: string | null | undefined) => void;
}

/**
 * Gmail's API is cursor-paginated (a token, not an offset) — there's no way
 * to jump straight to "page 7". This tracks tokens for pages already visited
 * so revisiting or numbering them is instant, while still only being able to
 * move one page past the last known one at a time.
 *
 * Reset `resetKey` (e.g. the active query string) to start over from page 0
 * whenever the underlying query changes.
 */
export function useCursorPagination(resetKey: string): UseCursorPaginationResult {
  const [index, setIndex] = useState(0);
  const [tokens, setTokens] = useState<string[]>([]); // tokens[i] = token to fetch page i+1
  const [hasNext, setHasNext] = useState(false);

  // "Adjust state during render" instead of useEffect+setState: React
  // explicitly supports conditionally calling setState mid-render to reset
  // state when a prop changes, folding the reset into the same render pass
  // rather than committing once and immediately re-rendering via an effect.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setIndex(0);
    setTokens([]);
    setHasNext(false);
  }

  function reportNextToken(nextToken: string | null | undefined) {
    setHasNext(Boolean(nextToken));
    if (nextToken && tokens.length === index) {
      setTokens((prev) => [...prev, nextToken]);
    }
  }

  return {
    index,
    token: index === 0 ? undefined : tokens[index - 1],
    knownCount: tokens.length + 1,
    hasNext: index < tokens.length || hasNext,
    hasPrev: index > 0,
    goToPage: (target) => setIndex(Math.max(0, Math.min(target, tokens.length))),
    next: () => setIndex((i) => Math.min(i + 1, tokens.length)),
    prev: () => setIndex((i) => Math.max(0, i - 1)),
    reportNextToken,
  };
}
