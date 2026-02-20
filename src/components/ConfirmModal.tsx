"use client";

import { useAccentColor } from "@/context/AppContext";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const accent = useAccentColor();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 animate-slide-up border border-stone-200 dark:border-stone-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center mb-4",
            variant === "danger" ? "bg-red-100 dark:bg-red-900/30" : accent.bgSubtle
          )}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={variant === "danger" ? "text-red-600 dark:text-red-400" : accent.text}
            >
              {variant === "danger" ? (
                <>
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              )}
            </svg>
          </div>

          <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-1">
            {title}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : `${accent.bg} ${accent.bgHover}`
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
