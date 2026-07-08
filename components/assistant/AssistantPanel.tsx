"use client";

import { useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotChat } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { RiSparkling2Line, RiAddLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { assistantWidthStore, MIN_WIDTH, MAX_WIDTH } from "@/lib/assistant-width-store";
import { ChatInput } from "./ChatInput";

// A fully self-contained sidebar we lay out ourselves (CopilotChat is the
// headless chat body with no wrapping/overlay behavior), so it sits as a
// normal flex sibling next to the mail content instead of floating on top
// of it the way <CopilotSidebar> does when it isn't given the app as children.
export function AssistantPanel() {
  const { reset } = useCopilotChat();
  const storedWidth = useSyncExternalStore(
    assistantWidthStore.subscribe,
    assistantWidthStore.get,
    assistantWidthStore.getServerSnapshot
  );
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const width = dragWidth ?? storedWidth;

  function handleResizeStart(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = storedWidth;
    setIsDragging(true);

    function handleMove(ev: globalThis.PointerEvent) {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - ev.clientX)));
      setDragWidth(next);
    }
    function handleUp(ev: globalThis.PointerEvent) {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - ev.clientX)));
      assistantWidthStore.set(next);
      setDragWidth(null);
      setIsDragging(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <aside
      className="ai-assistant-panel relative flex h-full shrink-0 flex-col overflow-hidden border-l bg-sidebar text-sidebar-foreground"
      style={{ width, transition: isDragging ? "none" : "width 150ms ease-out" }}
    >
      {/* Drag handle on the left edge — grab and drag to resize the panel. */}
      <div
        onPointerDown={handleResizeStart}
        className={cn(
          "group absolute top-0 -left-1.5 z-20 h-full w-3 cursor-col-resize touch-none",
          "flex items-center justify-center"
        )}
      >
        <div
          className={cn(
            "h-10 w-1 rounded-full bg-foreground/15 transition-colors group-hover:bg-primary/60",
            isDragging && "bg-primary/60"
          )}
        />
      </div>

      <div className="flex items-center gap-2 border-b border-white/40 p-4 dark:border-white/10">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RiSparkling2Line className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Mail Assistant</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => reset()} aria-label="New chat" />
            }
            className="ml-auto"
          >
            <RiAddLine className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1">
        <CopilotChat
          className="h-full"
          Input={ChatInput}
          labels={{
            initial:
              'Hi! I can compose emails, search or filter your inbox, and open specific messages.\n\nTry: "Send an email to john@example.com with subject Meeting Tomorrow".',
            placeholder: "Ask the assistant...",
          }}
        />
      </div>
    </aside>
  );
}
