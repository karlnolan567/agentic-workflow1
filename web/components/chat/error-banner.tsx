"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChatError = {
  title: string;
  message: string;
  hint?: string;
};

export function parseChatError(raw: string): ChatError {
  const lower = raw.toLowerCase();

  if (lower.includes("quota") || lower.includes("rate-limited")) {
    return {
      title: "Gemini API quota exceeded",
      message: raw,
      hint: 'To keep demoing without Gemini, add USE_DEMO_LLM=true to .env and restart the API (uvicorn api.main:app --reload).',
    };
  }

  if (lower.includes("gemini_api_key") || lower.includes("api key")) {
    return {
      title: "Missing or invalid API key",
      message: raw,
      hint: "Set GEMINI_API_KEY in agentic_workflow1/.env, then restart the API server.",
    };
  }

  if (
    lower.includes("could not reach") ||
    lower.includes("port 8000") ||
    lower.includes("could not connect")
  ) {
    return {
      title: "API server not reachable",
      message: raw,
      hint: "Start the API from agentic_workflow1: source .venv/bin/activate && uvicorn api.main:app --reload --port 8000",
    };
  }

  if (lower.includes("503") || lower.includes("temporarily unavailable")) {
    return {
      title: "Assistant temporarily unavailable",
      message: raw,
      hint: "Check the API terminal for errors, or enable USE_DEMO_LLM=true for offline demo mode.",
    };
  }

  return {
    title: "Something went wrong",
    message: raw,
    hint: "Check that both the API (port 8000) and web app (port 3000) are running.",
  };
}

type ErrorBannerProps = {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorBanner({
  error,
  onDismiss,
  onRetry,
  retryLabel = "Try again",
}: ErrorBannerProps) {
  const parsed = parseChatError(error);

  return (
    <div
      role="alert"
      className="mx-3 mb-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-sm dark:border-red-900 dark:bg-red-950/40 sm:mx-4"
    >
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-red-900 dark:text-red-100">
              {parsed.title}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-0.5 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200/90 leading-relaxed">
            {parsed.message}
          </p>
          {parsed.hint && (
            <p className="mt-2 text-xs text-red-700/90 dark:text-red-300/80 leading-relaxed border-t border-red-200 dark:border-red-800 pt-2">
              <span className="font-medium">What to do: </span>
              {parsed.hint}
            </p>
          )}
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-red-300 dark:border-red-800"
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
