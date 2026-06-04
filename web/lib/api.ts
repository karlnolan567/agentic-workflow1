const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type MessageResponse = {
  outcome: string;
  message: string | null;
  assigned_route: string | null;
  is_escalated: boolean;
  turn_count: number;
  ticket_id: string | null;
  transcript_path: string | null;
};

export type DemoContext = {
  account_name: string;
  plan: string;
  member_since: string;
  email: string;
  demo_label: string;
};

export async function createSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/sessions`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const data = await res.json();
  return data.session_id;
}

export async function fetchDemoContext(): Promise<DemoContext> {
  const res = await fetch(`${API_BASE}/api/sessions/demo-context`);
  if (!res.ok) throw new Error("Failed to load demo context");
  return res.json();
}

export async function escalateSession(sessionId: string): Promise<MessageResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/escalate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Escalation failed");
  return res.json();
}

export async function endSession(sessionId: string): Promise<MessageResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("End session failed");
  return res.json();
}

export async function submitCsat(
  sessionId: string,
  rating: "up" | "down",
  comment?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/csat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating, comment: comment ?? null }),
  });
  if (!res.ok) throw new Error("CSAT submit failed");
}

export function transcriptUrl(sessionId: string): string {
  return `${API_BASE}/api/sessions/${sessionId}/transcript`;
}

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onDone: (response: MessageResponse) => void;
  onError: (message: string) => void;
};

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(String).join(", ");
  } catch {
    /* ignore */
  }
  if (res.status === 503) {
    return "The assistant is temporarily unavailable. Check the API server and Gemini quota.";
  }
  return `Request failed (${res.status})`;
}

export async function streamMessage(
  sessionId: string,
  content: string,
  callbacks: StreamCallbacks
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/api/sessions/${sessionId}/messages/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
  } catch {
    callbacks.onError(
      "Could not reach the API. Is uvicorn running on port 8000?"
    );
    return;
  }

  if (!res.ok || !res.body) {
    callbacks.onError(await readErrorDetail(res));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  let sawError = false;

  const processLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.type === "token") {
        callbacks.onToken(data.content);
      } else if (data.type === "done") {
        sawDone = true;
        callbacks.onDone(data as MessageResponse);
      } else if (data.type === "error") {
        sawError = true;
        callbacks.onError(
          data.message ?? "The assistant could not respond."
        );
      }
    } catch {
      /* ignore partial parse */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processLine(line);
    }
  }

  // Flush any remaining event in the buffer
  if (buffer.trim()) {
    for (const line of buffer.split("\n")) {
      processLine(line);
    }
  }

  if (!sawDone && !sawError) {
    callbacks.onError(
      "The assistant did not finish responding. Please try again."
    );
  }
}
