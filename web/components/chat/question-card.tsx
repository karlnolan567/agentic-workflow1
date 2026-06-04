"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ParsedQuestion } from "@/lib/parse-assistant-message";

const BINARY = ["Yes", "No", "Not sure"];

type QuestionCardProps = {
  question: ParsedQuestion;
  index: number;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function QuestionCard({
  question,
  index,
  value,
  onChange,
  disabled,
}: QuestionCardProps) {
  const hasOptions = question.options.length > 0;
  const showBinary = question.allowBinary && !hasOptions;
  const showTextInput = !hasOptions && !showBinary;

  const [customMode, setCustomMode] = useState(
    () => !!value && hasOptions && !question.options.includes(value)
  );

  const choices = hasOptions
    ? [...question.options, "Other…"]
    : showBinary
      ? BINARY
      : [];

  const isOtherSelected =
    customMode ||
    (!!value && hasOptions && !question.options.includes(value));

  function selectOption(choice: string) {
    if (choice === "Other…") {
      setCustomMode(true);
      onChange("");
      return;
    }
    setCustomMode(false);
    onChange(choice);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-slate-50/80 dark:bg-slate-900/40 p-4 space-y-3">
      <div className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{question.label}</p>
          {question.hints.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              {question.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {choices.length > 0 && (
        <div
          className="grid gap-2 pl-9 sm:grid-cols-2"
          role="radiogroup"
          aria-label={question.label}
        >
          {choices.map((choice) => {
            const selected =
              choice === "Other…" ? isOtherSelected : value === choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={disabled}
                role="radio"
                aria-checked={selected}
                onClick={() => selectOption(choice)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                  selected
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-brand/50"
                )}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}

      {(showTextInput || customMode) && (
        <div className="pl-9">
          <input
            type="text"
            disabled={disabled}
            placeholder={
              showTextInput
                ? "Type your answer here…"
                : "Type a custom answer…"
            }
            value={
              showTextInput || customMode
                ? (value ?? "")
                : ""
            }
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      )}
    </div>
  );
}
