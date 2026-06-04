import Link from "next/link";
import { MessageCircle, Route, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Route,
    title: "Smart routing",
    description:
      "First message is classified into billing, tech, product, or general support—then stays sticky.",
  },
  {
    icon: Users,
    title: "Human handoff",
    description:
      "Escalate anytime; your full context is packaged for a human specialist.",
  },
  {
    icon: MessageCircle,
    title: "Session memory",
    description:
      "Multi-turn conversations keep context so follow-ups feel continuous.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <span className="text-sm font-semibold text-brand">SupportFlow</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-brand mb-3">Agentic workflow demo</p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Support that routes you to the right specialist
        </h1>
        <p className="mt-4 max-w-lg text-[var(--muted)] text-lg">
          Tier 1 Python orchestration with Gemini personas—now in a modern chat
          experience built for portfolio demos.
        </p>
        <Link href="/chat" className="mt-8">
          <Button size="lg">Start conversation</Button>
        </Link>

        <ul className="mt-16 grid gap-8 sm:grid-cols-3 max-w-4xl text-left">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
            >
              <Icon className="h-8 w-8 text-brand mb-3" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
        Phase 2 portfolio demo · API keys stay server-side
      </footer>
    </div>
  );
}
