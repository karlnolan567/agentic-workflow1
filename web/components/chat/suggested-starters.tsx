const STARTERS = [
  "Why was I charged twice on my last invoice?",
  "The app crashes when I try to log in",
  "How do I export my data to CSV?",
  "What's the weather like in Boston today?",
];

export function SuggestedStarters({
  onSelect,
  disabled,
}: {
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8">
      <p className="text-sm text-[var(--muted)]">
        Start a conversation — we route you to the right specialist
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {STARTERS.map((text) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(text)}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left text-xs text-[var(--foreground)] hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
