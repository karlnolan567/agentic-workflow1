"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { DemoContext, fetchDemoContext } from "@/lib/api";
import { cn } from "@/lib/utils";

export function DemoContextPanel() {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<DemoContext | null>(null);

  useEffect(() => {
    fetchDemoContext().then(setCtx).catch(() => {});
  }, []);

  if (!ctx) return null;

  return (
    <div className="border-b border-[var(--border)] bg-slate-50/80 dark:bg-slate-900/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <span className="flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          Demo account context
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all px-4",
          open ? "pb-3 max-h-32" : "max-h-0"
        )}
      >
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">
          {ctx.demo_label}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div>
            <dt className="text-[var(--muted)]">Account</dt>
            <dd className="font-medium">{ctx.account_name}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Plan</dt>
            <dd className="font-medium">{ctx.plan}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Member since</dt>
            <dd>{ctx.member_since}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Email</dt>
            <dd className="truncate">{ctx.email}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
