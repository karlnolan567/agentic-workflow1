"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { submitCsat, transcriptUrl } from "@/lib/api";

export function CsatDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!rating) return;
    await submitCsat(sessionId, rating, comment || undefined);
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-xl">
        {submitted ? (
          <>
            <h3 className="text-lg font-semibold">Thanks for your feedback</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Your session transcript is ready to download.
            </p>
            <div className="mt-4 flex gap-2">
              <a
                href={transcriptUrl(sessionId)}
                download
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-teal-700"
              >
                Download transcript
              </a>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">How was this chat?</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Quick feedback helps us improve the demo experience.
            </p>
            <div className="mt-4 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setRating("up")}
                className={`rounded-full p-3 border ${
                  rating === "up"
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-[var(--border)]"
                }`}
              >
                <ThumbsUp className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => setRating("down")}
                className={`rounded-full p-3 border ${
                  rating === "down"
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-[var(--border)]"
                }`}
              >
                <ThumbsDown className="h-6 w-6" />
              </button>
            </div>
            <textarea
              className="mt-4 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              placeholder="Optional comment..."
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Skip
              </Button>
              <Button disabled={!rating} onClick={handleSubmit}>
                Submit
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
