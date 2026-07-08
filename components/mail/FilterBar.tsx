"use client";

import { useFilterStore } from "@/lib/filter-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiSearchLine, RiUserLine, RiCalendarLine, RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";

export function FilterBar({ children }: { children?: ReactNode }) {
  const { filters, setFilters, resetFilters } = useFilterStore();
  const hasActiveFilters =
    filters.dateFrom || filters.dateTo || filters.sender || filters.keyword || filters.readStatus !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/40 bg-white/20 px-4 py-2.5 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.02]">
      <div className="relative">
        <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search keyword..."
          className="h-8 w-48 rounded-full bg-white/50 pl-8 dark:bg-white/5"
          value={filters.keyword ?? ""}
          onChange={(e) => setFilters({ keyword: e.target.value || null })}
        />
      </div>
      <div className="relative">
        <RiUserLine className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="From..."
          className="h-8 w-40 rounded-full bg-white/50 pl-8 dark:bg-white/5"
          value={filters.sender ?? ""}
          onChange={(e) => setFilters({ sender: e.target.value || null })}
        />
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 dark:bg-white/5">
        <RiCalendarLine className="size-3.5 shrink-0 text-muted-foreground" />
        <Input
          type="date"
          aria-label="From date"
          className="h-8 w-32 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          value={filters.dateFrom ?? ""}
          onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label="To date"
          className="h-8 w-32 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          value={filters.dateTo ?? ""}
          onChange={(e) => setFilters({ dateTo: e.target.value || null })}
        />
      </div>
      <Select
        value={filters.readStatus}
        onValueChange={(v) => setFilters({ readStatus: v as typeof filters.readStatus })}
      >
        <SelectTrigger className="h-8 w-28 rounded-full bg-white/50 dark:bg-white/5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="unread">Unread</SelectItem>
          <SelectItem value="read">Read</SelectItem>
        </SelectContent>
      </Select>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-muted-foreground"
          onClick={() => resetFilters()}
        >
          <RiCloseLine className="size-3.5" />
          Clear
        </Button>
      )}
      {children && <div className="ml-auto flex items-center">{children}</div>}
    </div>
  );
}
