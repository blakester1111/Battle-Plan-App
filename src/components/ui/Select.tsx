"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  className?: string;
}

export default function Select({
  value,
  onChange,
  options,
  groups,
  placeholder = "Select...",
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Find the display label for the current value
  const selectedLabel = (() => {
    if (options) {
      const found = options.find((o) => o.value === value);
      return found?.label;
    }
    if (groups) {
      for (const g of groups) {
        const found = g.options.find((o) => o.value === value);
        if (found) return found.label;
      }
    }
    return undefined;
  })();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
  }

  const optionClasses =
    "px-3 py-1.5 text-sm cursor-pointer transition-colors text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700";
  const activeClasses = "bg-stone-200 dark:bg-stone-700 font-medium";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full rounded px-3 py-2 text-sm text-left border focus:outline-none focus:ring-2 transition-shadow flex items-center justify-between gap-2",
          "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700/50 ring-stone-400/50 dark:ring-stone-500/50",
          className
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-stone-400 dark:text-stone-500")}>
          {selectedLabel || placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("shrink-0 text-stone-400 dark:text-stone-500 transition-transform", open && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-lg py-1">
          {options &&
            options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={cn(optionClasses, value === opt.value && activeClasses)}
              >
                {opt.label}
              </div>
            ))}
          {groups &&
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 select-none">
                  {group.label}
                </div>
                {group.options.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(optionClasses, "pl-5", value === opt.value && activeClasses)}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
