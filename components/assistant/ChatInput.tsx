"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { InputProps } from "@copilotkit/react-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RiSendPlaneLine } from "@remixicon/react";
import {
  cancelPendingInteractions,
  hasPendingInteraction,
  hasPendingInteractionServerSnapshot,
  subscribePendingInteraction,
} from "@/lib/assistant-interrupt";

const HISTORY_KEY = "ai-mail-chat-history";
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
}

// A drop-in replacement for CopilotChat's default Input, adding shell-style
// history recall: Up/Down cycle through previously sent messages (persisted
// in localStorage), like a terminal, instead of the default plain textarea.
export function ChatInput({ inProgress, onSend }: InputProps) {
  const [value, setValue] = useState("");
  const historyRef = useRef<string[]>(loadHistory());
  // Read the length fresh rather than from historyRef.current — reading one
  // ref's value to seed another ref during render is flagged as unsafe.
  const historyPosRef = useRef(loadHistory().length);
  const draftRef = useRef("");

  // While a confirm/picker card is waiting for a click, `inProgress` is true
  // but the user should still be able to type a NEW instruction — the new
  // task cancels the pending one instead of being silently dropped.
  const hasPending = useSyncExternalStore(
    subscribePendingInteraction,
    hasPendingInteraction,
    hasPendingInteractionServerSnapshot
  );
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const canSend = !inProgress || hasPending;

  // Once the interrupted run settles (the cancelled tool call resolves and
  // the agent finishes its turn), fire the message the user typed over it.
  // Deferred to a timeout so the send happens outside the effect body and a
  // last-moment inProgress flip cancels cleanly instead of double-firing.
  useEffect(() => {
    if (inProgress || !queuedMessage) return;
    const timer = setTimeout(() => {
      setQueuedMessage(null);
      onSend(queuedMessage);
    }, 0);
    return () => clearTimeout(timer);
  }, [inProgress, queuedMessage, onSend]);

  async function handleSend() {
    const text = value.trim();
    if (!text || !canSend || queuedMessage) return;
    setValue("");
    const history = historyRef.current;
    if (history[history.length - 1] !== text) {
      history.push(text);
      saveHistory(history);
    }
    historyPosRef.current = history.length;
    draftRef.current = "";
    if (inProgress) {
      // A card is pending: close it out and queue this message behind it.
      cancelPendingInteractions();
      setQueuedMessage(text);
      return;
    }
    await onSend(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    const history = historyRef.current;
    const textarea = e.currentTarget;

    if (e.key === "ArrowUp" && history.length > 0) {
      // Don't hijack the key while editing multi-line text that isn't at
      // the very start of the field — only recall from a fresh/empty line.
      if (textarea.selectionStart !== 0 || textarea.selectionEnd !== 0) {
        if (!(historyPosRef.current === history.length && value === "")) return;
      }
      if (historyPosRef.current === 0) return;
      e.preventDefault();
      if (historyPosRef.current === history.length) draftRef.current = value;
      historyPosRef.current -= 1;
      setValue(history[historyPosRef.current]);
    } else if (e.key === "ArrowDown" && historyPosRef.current < history.length) {
      e.preventDefault();
      historyPosRef.current += 1;
      setValue(historyPosRef.current === history.length ? draftRef.current : history[historyPosRef.current]);
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-white/40 p-3 dark:border-white/10">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          queuedMessage ? "Wrapping up the previous task..." : "Ask the assistant... (↑/↓ for history)"
        }
        className="max-h-40 min-h-10 flex-1 resize-none border-primary/20 bg-primary/[0.06] focus-visible:border-primary/40 dark:bg-primary/10"
        disabled={!canSend || queuedMessage !== null}
        rows={1}
      />
      <Button
        type="button"
        size="icon"
        className="shrink-0 rounded-full"
        disabled={!canSend || queuedMessage !== null || !value.trim()}
        onClick={handleSend}
        aria-label="Send message"
      >
        <RiSendPlaneLine className="size-4" />
      </Button>
    </div>
  );
}
