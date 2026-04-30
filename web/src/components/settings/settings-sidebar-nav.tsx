"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

export type SettingsNavItem = { href: string; label: string };

export type SettingsNavSection = {
  /** 用於 localStorage 鍵，請固定英文 slug */
  id: string;
  titleZh: string;
  titleEn: string;
  items: SettingsNavItem[];
};

function storageKey(sectionId: string) {
  return `crm-settings-sidebar-tree-expanded-${sectionId}`;
}

function isItemActive(pathname: string, search: string, item: SettingsNavItem): boolean {
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  const [pathPart, queryPart] = item.href.split("?");
  const base = pathPart ?? item.href;
  const onPath = pathname === base || pathname.startsWith(`${base}/`);
  if (!onPath) return false;

  const current = new URLSearchParams(search);

  if (queryPart) {
    const required = new URLSearchParams(queryPart);
    for (const [k, v] of required) {
      if (current.get(k) !== v) return false;
    }
    return true;
  }

  return true;
}

function SidebarTreeSection({ section }: { section: SettingsNavSection }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const panelId = useId();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey(section.id));
      if (v === "0") setExpanded(false);
      else if (v === "1") setExpanded(true);
    } catch {
      /* ignore */
    }
  }, [section.id]);

  const toggle = useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem(storageKey(section.id), next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [section.id]);

  return (
    <div className="px-2 py-2">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={expanded}
        aria-controls={`${panelId}-tree`}
        onClick={toggle}
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/90"
      >
        <span
          className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-zinc-50 text-zinc-600 transition-transform dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-400 ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {section.titleZh}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{section.titleEn}</span>
        </span>
      </button>

      {expanded ? (
        <div id={`${panelId}-tree`} role="group" className="mt-1">
          {section.items.length === 0 ? (
            <p className="ml-6 py-2 pr-2 text-xs text-zinc-400 dark:text-zinc-500">尚無項目</p>
          ) : (
            <ul
              className="relative ml-3 border-l border-dashed border-zinc-300 py-1 dark:border-zinc-600"
              aria-label={`${section.titleZh}子選單`}
            >
              {section.items.map((item) => {
                const active = isItemActive(pathname, search, item);
                return (
                  <li key={`${section.id}:${item.href}:${item.label}`}>
                    <Link
                      href={item.href}
                      className={`ml-3 block rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors ${
                        active
                          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                          : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsSidebarNav({ sections }: { sections: SettingsNavSection[] }) {
  return (
    <nav
      className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-y-contain"
      aria-label="設定區側欄"
    >
      {sections.map((section) => (
        <SidebarTreeSection key={section.id} section={section} />
      ))}
    </nav>
  );
}
