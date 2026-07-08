"use client";

import { useSyncExternalStore } from "react";
import { NavLink } from "@/components/mail/NavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { sidebarCollapsedStore } from "@/lib/sidebar-collapsed-store";
import {
  RiInboxLine,
  RiSendPlaneLine,
  RiAddLine,
  RiMailFill,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiLogoutBoxRLine,
  RiArrowUpSLine,
} from "@remixicon/react";

interface MailSidebarUser {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
}

export function MailSidebar({
  user,
  signOutAction,
}: {
  user: MailSidebarUser;
  signOutAction: () => Promise<void>;
}) {
  const collapsed = useSyncExternalStore(
    sidebarCollapsedStore.subscribe,
    sidebarCollapsedStore.get,
    sidebarCollapsedStore.getServerSnapshot
  );

  function toggle() {
    sidebarCollapsedStore.set(!collapsed);
  }

  const initial = user.name?.[0] ?? user.email?.[0] ?? "?";

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-18" : "w-64"
      )}
    >
      <div className="flex items-center gap-2 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <RiMailFill className="size-4" />
        </div>
        <Collapsible open={!collapsed} className="flex min-w-0 flex-1 items-center gap-2">
          <CollapsibleContent className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden data-[state=closed]:animate-none">
            <span className="truncate text-lg font-semibold tracking-tight">AI Mail</span>
            <div className="ml-auto shrink-0">
              <ThemeToggle />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Compose, Inbox, and Sent are all the same SidebarNavItem — one
          component, one active/inactive rule, so they can never drift out of
          sync in shape, alignment, or color the way separate components did. */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-1">
        <SidebarNavItem collapsed={collapsed} href="/compose" icon={<RiAddLine className="size-4" />}>
          Compose
        </SidebarNavItem>
        <SidebarNavItem collapsed={collapsed} href="/inbox" icon={<RiInboxLine className="size-4" />}>
          Inbox
        </SidebarNavItem>
        <SidebarNavItem collapsed={collapsed} href="/sent" icon={<RiSendPlaneLine className="size-4" />}>
          Sent
        </SidebarNavItem>
      </nav>

      <div className="flex shrink-0 flex-col gap-1 border-t border-white/40 p-3 dark:border-white/10">
        {/* Collapse toggle lives in the bottom section, always visible
            regardless of collapsed state, instead of floating on the edge. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={toggle}
                aria-label="Toggle sidebar"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/40 dark:hover:bg-white/5",
                  collapsed && "justify-center"
                )}
              />
            }
          >
            {collapsed ? <RiMenuUnfoldLine className="size-4" /> : <RiMenuFoldLine className="size-4" />}
            {!collapsed && "Collapse"}
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" aria-label="Account menu" />}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/40 dark:hover:bg-white/5",
              collapsed && "justify-center"
            )}
          >
            <Avatar className="size-9 shrink-0 ring-2 ring-white/60 dark:ring-white/10">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">{initial}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <RiArrowUpSLine className="size-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? "center" : "start"} sideOffset={8} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
              <RiLogoutBoxRLine className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function SidebarNavItem({
  collapsed,
  href,
  icon,
  children,
}: {
  collapsed: boolean;
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const link = (
    <NavLink href={href} collapsed={collapsed}>
      {icon}
      {!collapsed && children}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{children}</TooltipContent>
    </Tooltip>
  );
}
