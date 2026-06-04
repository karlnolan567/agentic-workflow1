"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Moon,
  Send,
  Sun,
  UserPlus,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageBubble, ChatMessage } from "@/components/chat/message-bubble";
import { RouteBadge } from "@/components/chat/route-badge";
import { SuggestedStarters } from "@/components/chat/suggested-starters";
import { CsatDialog } from "@/components/chat/csat-dialog";
import { DemoContextPanel } from "@/components/chat/demo-context-panel";
import { ErrorBanner } from "@/components/chat/error-banner";
import { useTheme } from "@/components/theme-provider";
import {
  createSession,
  escalateSession,
  endSession,
  streamMessage,
  MessageResponse,
} from "@/lib/api";

function uid() {
  return Math.random().toString(36).slice(2);
}

export function ChatView() {
  const router = useRouter();
  const { resolved, setTheme } = useTheme();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [route, setRoute] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);
  const [showCsat, setShowCsat] = useState(false);
  const [ended, setEnded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastFailedMessageRef = useRef<string | null>(null);

  const connectSession = useCallback(async () => {
    setError(null);
    try {
      const id = await createSession();
      setSessionId(id);
      return true;
    } catch {
      setError(
        "Could not connect to the API at http://127.0.0.1:8000. Start uvicorn in agentic_workflow1, then click Reconnect."
      );
      return false;
    }
  }, []);

  useEffect(() => {
    void connectSession();
  }, [connectSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const applyResponse = useCallback((resp: MessageResponse) => {
    if (resp.assigned_route) setRoute(resp.assigned_route);
    if (resp.is_escalated) setEscalated(true);
    if (resp.ticket_id) setTicketId(resp.ticket_id);
    if (resp.outcome === "session_ended") {
      setEnded(true);
      setShowCsat(true);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim() || loading || ended) return;
      setError(null);
      setLoading(true);
      lastFailedMessageRef.current = text.trim();

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text.trim(),
        createdAt: new Date(),
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");

      if (escalated) {
        try {
          const resp = await streamMessage(sessionId, text.trim(), {
            onToken: () => {},
            onDone: (r) => {
              applyResponse(r);
              if (r.message) {
                setMessages((m) => [
                  ...m,
                  {
                    id: uid(),
                    role: "system",
                    content: r.message ?? "",
                  },
                ]);
              }
            },
            onError: (msg) => setError(msg),
          });
          void resp;
        } catch {
          setError("Failed to send note");
        } finally {
          setLoading(false);
        }
        return;
      }

      const assistantId = uid();
      setTyping(true);
      let streamed = "";

      try {
        await streamMessage(sessionId, text.trim(), {
          onToken: (token) => {
            streamed += token;
            setMessages((m) => {
              const rest = m.filter((x) => x.id !== assistantId);
              return [
                ...rest,
                {
                  id: assistantId,
                  role: "assistant",
                  content: streamed,
                  createdAt: new Date(),
                },
              ];
            });
          },
          onDone: (resp) => {
            lastFailedMessageRef.current = null;
            applyResponse(resp);
            if (resp.outcome === "triage_failed" && resp.message) {
              setMessages((m) => [
                ...m.filter((x) => x.id !== assistantId),
                {
                  id: uid(),
                  role: "system",
                  content: resp.message ?? "",
                },
              ]);
            } else if (resp.outcome === "responded" && resp.message) {
              setMessages((m) => {
                const rest = m.filter((x) => x.id !== assistantId);
                return [
                  ...rest,
                  {
                    id: assistantId,
                    role: "assistant",
                    content: resp.message ?? "",
                    createdAt: new Date(),
                  },
                ];
              });
            } else if (resp.message) {
              setMessages((m) => [
                ...m,
                {
                  id: uid(),
                  role: "system",
                  content: resp.message ?? "",
                },
              ]);
            }
          },
          onError: (msg) => {
            setError(msg);
            setMessages((m) => {
              let next = m.filter((x) => x.id !== assistantId);
              const last = next[next.length - 1];
              if (last?.role === "user" && last.content === text.trim()) {
                next = next.slice(0, -1);
              }
              return next;
            });
          },
        });
      } catch {
        setError(
          "Network error — could not reach the API at http://localhost:8000."
        );
        setMessages((m) => m.filter((x) => x.id !== assistantId));
      } finally {
        setTyping(false);
        setLoading(false);
      }
    },
    [sessionId, loading, ended, escalated, applyResponse]
  );

  async function handleEscalate() {
    if (!sessionId) return;
    setShowEscalateConfirm(false);
    setLoading(true);
    try {
      const resp = await escalateSession(sessionId);
      applyResponse(resp);
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "system",
          content:
            resp.message ??
            "You have been escalated to a human specialist.",
        } as ChatMessage,
      ]);
    } catch {
      setError("Escalation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndChat() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const resp = await endSession(sessionId);
      applyResponse(resp);
      setEnded(true);
      setShowCsat(true);
    } catch {
      setError("Could not end session");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--background)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">Support</h1>
            {route && !escalated && <RouteBadge route={route} />}
            {escalated && ticketId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                Ticket {ticketId}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() =>
              setTheme(resolved === "dark" ? "light" : "dark")
            }
            aria-label="Toggle theme"
          >
            {resolved === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          {!ended && !escalated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEscalateConfirm(true)}
              disabled={loading}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Escalate
            </Button>
          )}
          {!ended && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndChat}
              disabled={loading}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              End
            </Button>
          )}
        </div>
      </header>

      <DemoContextPanel />

      {escalated && !ended && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
          Queued for human support — your messages are notes for the team.
          {ticketId && ` Reference: ${ticketId}`}
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 && !loading && (
          <SuggestedStarters
            onSelect={(t) => {
              if (sessionId && !loading) void sendMessage(t);
            }}
            disabled={!sessionId || loading}
          />
        )}
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m) => {
            const isLatestAssistant =
              m.role === "assistant" &&
              !loading &&
              !ended &&
              m.id ===
                [...messages]
                  .reverse()
                  .find((x) => x.role === "assistant")?.id;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                isLatestAssistant={isLatestAssistant}
                onSubmitAnswers={(text) => void sendMessage(text)}
                disabled={loading || ended}
              />
            );
          })}
          {typing && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Assistant is typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {error && (
        <ErrorBanner
          error={error}
          onDismiss={() => setError(null)}
          onRetry={
            !sessionId
              ? () => void connectSession()
              : lastFailedMessageRef.current
                ? () => {
                    setError(null);
                    void sendMessage(lastFailedMessageRef.current!);
                  }
                : undefined
          }
          retryLabel={!sessionId ? "Reconnect to API" : "Try again"}
        />
      )}

      {!ended && (
        <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!escalated && messages.some((m) => m.role === "assistant") && (
            <p className="mb-2 text-center text-[10px] text-[var(--muted)]">
              Still need a person?{" "}
              <button
                type="button"
                className="text-brand underline"
                onClick={() => setShowEscalateConfirm(true)}
              >
                Escalate
              </button>
            </p>
          )}
          <div className="mx-auto flex max-w-3xl gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                escalated
                  ? "Add a note for the support team…"
                  : "Describe your issue…"
              }
              rows={1}
              disabled={!sessionId || loading}
              className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand min-h-[44px] max-h-32"
            />
            <Button
              onClick={() => void sendMessage(input)}
              disabled={!sessionId || loading || !input.trim()}
              aria-label="Send"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </footer>
      )}

      {showEscalateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-xl">
            <h3 className="font-semibold">Escalate to a human?</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              A support specialist will review this chat. The AI will stop
              replying; you can still add notes.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEscalateConfirm(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleEscalate()}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {showCsat && sessionId && (
        <CsatDialog
          sessionId={sessionId}
          onClose={() => {
            setShowCsat(false);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
