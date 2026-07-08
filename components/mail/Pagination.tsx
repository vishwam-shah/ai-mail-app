"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";

export interface PaginationProps {
  page: number;
  knownCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrev: () => void;
  loading?: boolean;
  /** "compact" = arrows only (for the top bar); "full" = arrows + page numbers. */
  variant?: "compact" | "full";
}

export function Pagination({
  page,
  knownCount,
  hasNext,
  hasPrev,
  onPageChange,
  onNext,
  onPrev,
  loading,
  variant = "full",
}: PaginationProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!hasPrev || loading}
        onClick={onPrev}
        aria-label="Previous page"
      >
        <RiArrowLeftSLine className="size-4" />
      </Button>

      {variant === "full" && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: knownCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              onClick={() => onPageChange(i)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/40 dark:hover:bg-white/5"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={!hasNext || loading}
        onClick={onNext}
        aria-label="Next page"
      >
        <RiArrowRightSLine className="size-4" />
      </Button>
    </div>
  );
}
