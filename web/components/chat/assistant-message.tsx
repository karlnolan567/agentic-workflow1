"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatAnswersSubmission,
  parseAssistantContent,
} from "@/lib/parse-assistant-message";
import { QuestionCard } from "@/components/chat/question-card";
import { Button } from "@/components/ui/button";

type AssistantMessageProps = {
  content: string;
  createdAt?: Date;
  interactive?: boolean;
  onSubmitAnswers?: (text: string) => void;
  disabled?: boolean;
};

const markdownClass =
  "prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-base prose-headings:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-[var(--foreground)]";

export function AssistantMessage({
  content,
  createdAt,
  interactive = false,
  onSubmitAnswers,
  disabled,
}: AssistantMessageProps) {
  const parsed = useMemo(() => parseAssistantContent(content), [content]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = parsed.questions.filter((q) => answers[q.id]?.trim())
    .length;
  const showInteractive =
    interactive && parsed.questions.length >= 1 && onSubmitAnswers;

  function handleSubmit() {
    if (!onSubmitAnswers || answeredCount === 0) return;
    onSubmitAnswers(formatAnswersSubmission(parsed.questions, answers));
    setAnswers({});
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      {parsed.preamble && (
        <div
          className={cn(
            markdownClass,
            "rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm"
          )}
        >
          <ReactMarkdown>{parsed.preamble}</ReactMarkdown>
        </div>
      )}

      {parsed.questions.length > 0 && (
        <div className="space-y-3">
          {showInteractive && (
            <p className="text-xs font-medium text-[var(--muted)] px-1">
              Select one option per question, then send your answers to the
              assistant.
            </p>
          )}
          {parsed.questions.map((q, i) =>
            showInteractive ? (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                value={answers[q.id]}
                onChange={(v) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: v }))
                }
                disabled={disabled}
              />
            ) : (
              <div
                key={q.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
              >
                <p className="text-sm font-medium">
                  {i + 1}. {q.label}
                </p>
                {q.options.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Options: {q.options.join(" · ")}
                  </p>
                )}
              </div>
            )
          )}

          {showInteractive && (
            <Button
              onClick={handleSubmit}
              disabled={disabled || answeredCount === 0}
              className="w-full sm:w-auto"
            >
              <Send className="h-4 w-4 mr-2" />
              Send answers to assistant
              {answeredCount > 0 &&
                ` (${answeredCount}/${parsed.questions.length})`}
            </Button>
          )}
        </div>
      )}

      {parsed.steps && (
        <div
          className={cn(
            markdownClass,
            "rounded-2xl border border-dashed border-brand/30 bg-brand/5 px-4 py-3"
          )}
        >
          <ReactMarkdown>{parsed.steps}</ReactMarkdown>
        </div>
      )}

      {parsed.footer && (
        <div
          className={cn(
            markdownClass,
            "rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-4 py-2 text-[var(--muted)]"
          )}
        >
          <ReactMarkdown>{parsed.footer}</ReactMarkdown>
        </div>
      )}

      {!parsed.preamble &&
        parsed.questions.length === 0 &&
        !parsed.steps &&
        !parsed.footer && (
          <div
            className={cn(
              markdownClass,
              "rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm"
            )}
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

      {createdAt && (
        <p className="text-[10px] opacity-60 pl-1">
          {createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
