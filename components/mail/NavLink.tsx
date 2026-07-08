"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  collapsed,
}: {
  href: string;
  children: ReactNode;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        // Same pill shape as Compose (rounded-full) at every state — only
        // the fill differentiates active from inactive, nothing else.
        "group flex h-9 items-center gap-2.5 rounded-full px-3 text-sm font-medium transition-colors duration-200 ease-out [&_svg]:size-4 [&_svg]:shrink-0",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-transparent text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5"
      )}
    >
      {children}
    </Link>
  );
}
