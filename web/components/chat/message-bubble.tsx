"use client";

import { cn } from "@/lib/utils";
import { AssistantMessage } from "@/components/chat/assistant-message";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
};

type MessageBubbleProps = {
  message: ChatMessage;
  isLatestAssistant?: boolean;
  onSubmitAnswers?: (text: string) => void;
  disabled?: boolean;
};

export function MessageBubble({
  message,
  isLatestAssistant,
  onSubmitAnswers,
  disabled,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div className="flex w-full justify-start">
        <AssistantMessage
          content={message.content}
          createdAt={message.createdAt}
          interactive={isLatestAssistant}
          onSubmitAnswers={onSubmitAnswers}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        isSystem && "justify-center"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]",
          isUser && "bg-brand text-white rounded-br-md",
          isSystem &&
            "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800 text-xs max-w-full"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.createdAt && !isSystem && (
          <p
            className={cn(
              "mt-1 text-[10px] opacity-60",
              isUser ? "text-right" : "text-left"
            )}
          >
            {message.createdAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
