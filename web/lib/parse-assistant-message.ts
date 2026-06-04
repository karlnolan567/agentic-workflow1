export type ParsedQuestion = {
  id: string;
  label: string;
  hints: string[];
  options: string[];
  allowBinary: boolean;
};

export type ParsedAssistantContent = {
  preamble: string;
  questions: ParsedQuestion[];
  footer: string;
  steps: string;
};

const QUESTION_WORD =
  /^(When|What|Which|Who|Where|Why|How|Do|Does|Did|Is|Are|Was|Were|Have|Has|Had|Can|Could|Would|Will|Should)\b/i;

const META_OR_EMPATHY =
  /^(to start|before we begin|first,|let me ask|could you please provide|i(?:'ll| will) need|please (?:tell|share|provide)|i'?m sorry|unfortunately|that sounds|once i have|thank you for)/i;

const FOOTER_LINE =
  /^(once i have|let me know|feel free|thank you|i hope|please don't hesitate)/i;

const OPEN_ENDED_START =
  /^(what|which|who|where|when|how|tell me|list|name|describe)\b/i;

function capitalizeOption(text: string): string {
  const cleaned = text.replace(/[.,;!?]+$/, "").trim();
  if (!cleaned) return cleaned;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractExampleOptions(text: string): string[] {
  const match = text.match(
    /\((?:e\.g\.|eg\.|for example|such as)[,:]?\s*([^)]+)\)/i
  );
  if (!match) return [];
  return match[1]
    .split(/(?:,|\s)\s*or\s+|\s*\/\s*/i)
    .map((part) => capitalizeOption(part.trim()))
    .filter((part) => part.length > 0 && part.length < 60);
}

function stripExamplesFromLabel(text: string): string {
  return text
    .replace(/\((?:e\.g\.|eg\.|for example|such as)[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOrOptions(text: string): string[] {
  const cleaned = text.replace(/\?+$/, "").trim();
  if (!/(?:,|\s)\s*or\s+/i.test(cleaned)) return [];

  const parts = cleaned.split(/(?:,|\s)\s*or\s+/i);
  if (parts.length < 2 || parts.length > 3) return [];
  if (parts.some((p) => p.length > 55)) return [];

  return parts
    .map((part, i) => {
      let p = part.trim();
      if (i === 0) {
        p = p.replace(
          /^(?:when|what|which|who|where|why|how|do|does|did|is|are|was|were|have|has|can|could)\b[^?]*?\b(?:this|that|it)\s+/i,
          ""
        );
      }
      p = p.replace(/^(a|an|the)\s+/i, "");
      return capitalizeOption(p);
    })
    .filter((p) => p.length > 0 && p.length < 60);
}

function inferDefaultOptions(label: string): string[] {
  const lower = label.toLowerCase();

  if (/what (?:operating system|os)\b|windows or mac|mac or windows/.test(lower)) {
    return ["Windows 11", "Windows 10", "macOS", "Linux", "ChromeOS"];
  }
  if (/what (?:kind of |type of )?device|what device|which device/.test(lower)) {
    return ["Laptop", "Desktop", "Phone", "Tablet"];
  }
  if (/what (?:brand|make|manufacturer)/.test(lower)) {
    return ["Apple", "Dell", "HP", "Lenovo", "Asus", "Other"];
  }
  if (/what (?:browser|web browser)/.test(lower)) {
    return ["Chrome", "Safari", "Firefox", "Edge"];
  }
  if (/what color/.test(lower)) {
    return ["Black", "Blue", "White", "Other"];
  }
  if (/when did (?:this|it|the problem)/.test(lower)) {
    return ["Just now", "Today", "This week", "More than a week ago"];
  }
  if (/how (?:often|many times)/.test(lower)) {
    return ["Once", "Sometimes", "Every time", "Not sure"];
  }
  if (/personal laptop|work\/school|work or school/.test(lower)) {
    return ["Personal laptop", "Work/school laptop"];
  }

  return [];
}

function isOpenEnded(label: string): boolean {
  return OPEN_ENDED_START.test(label.trim());
}

function isBinaryQuestion(label: string): boolean {
  if (isOpenEnded(label)) return false;
  return /^(is|are|do|does|did|can|could|have|has|had|will|would|was|were|any)\b/i.test(
    label.trim()
  );
}

function needsFreeText(label: string): boolean {
  return /write down|describe|explain|as much as you can|error message|serial|model number|paste|copy the|exact wording/i.test(
    label
  );
}

function isNumberedLine(line: string): { num: string; text: string } | null {
  const match = line.match(/^(\d+)[.)]\s+(.+)$/);
  if (!match) return null;
  return { num: match[1], text: match[2].trim() };
}

function isBulletLine(line: string): boolean {
  return /^[\s]*[-*•]\s+/.test(line);
}

function cleanBullet(line: string): string {
  return line.replace(/^[\s]*[-*•]\s+/, "").trim();
}

function isQuestionText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || META_OR_EMPATHY.test(trimmed)) return false;
  if (trimmed.endsWith("?")) return true;
  if (QUESTION_WORD.test(trimmed)) return true;
  if (/\((?:e\.g\.|for example)/i.test(trimmed)) return true;
  return false;
}

function startSteps(line: string): boolean {
  return /in the meantime|here are a few|troubleshooting steps|you can try|try these steps|perform a hard reset/i.test(
    line
  );
}

function bulletToOption(bullet: string): string {
  return capitalizeOption(bullet.replace(/\?+$/, ""));
}

function finalizeQuestion(block: {
  label: string;
  hints: string[];
  options: string[];
}): ParsedQuestion | null {
  const rawLabel = block.label.trim();
  if (!rawLabel || !isQuestionText(rawLabel)) return null;

  const label = stripExamplesFromLabel(rawLabel);
  const freeText = needsFreeText(rawLabel);

  const options = freeText
    ? []
    : [
        ...new Set([
          ...extractExampleOptions(rawLabel),
          ...extractOrOptions(rawLabel),
          ...block.options.map(bulletToOption),
          ...inferDefaultOptions(rawLabel),
        ]),
      ].filter((o) => o.length > 0);

  const allowBinary =
    !freeText && options.length === 0 && isBinaryQuestion(label);

  return {
    id: "",
    label,
    hints: block.hints.filter((h) => h.endsWith(":") || h.length > 80),
    options,
    allowBinary,
  };
}

export function parseAssistantContent(content: string): ParsedAssistantContent {
  const lines = content.split("\n");
  const preambleLines: string[] = [];
  const footerLines: string[] = [];
  const stepsLines: string[] = [];
  const questionBlocks: {
    label: string;
    hints: string[];
    options: string[];
  }[] = [];

  let phase: "preamble" | "questions" | "steps" | "footer" = "preamble";
  let currentQuestion: {
    label: string;
    hints: string[];
    options: string[];
  } | null = null;

  const flushQuestion = () => {
    if (currentQuestion) {
      questionBlocks.push(currentQuestion);
      currentQuestion = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      if (phase === "questions") flushQuestion();
      continue;
    }

    if (FOOTER_LINE.test(trimmed) && phase !== "steps") {
      flushQuestion();
      phase = "footer";
      footerLines.push(rawLine);
      continue;
    }

    if ((phase === "preamble" || phase === "questions") && startSteps(trimmed)) {
      flushQuestion();
      phase = "steps";
      stepsLines.push(rawLine);
      continue;
    }

    if (phase === "footer") {
      footerLines.push(rawLine);
      continue;
    }

    if (phase === "steps") {
      stepsLines.push(rawLine);
      continue;
    }

    const numbered = isNumberedLine(trimmed);
    if (numbered) {
      if (isQuestionText(numbered.text)) {
        flushQuestion();
        phase = "questions";
        currentQuestion = {
          label: numbered.text,
          hints: [],
          options: [
            ...extractExampleOptions(numbered.text),
            ...extractOrOptions(numbered.text),
          ],
        };
      } else if (phase === "questions" && currentQuestion) {
        currentQuestion.hints.push(numbered.text);
      } else {
        preambleLines.push(rawLine);
      }
      continue;
    }

    if (isBulletLine(line)) {
      const bullet = cleanBullet(line);
      if (currentQuestion) {
        currentQuestion.options.push(bullet);
      } else {
        preambleLines.push(rawLine);
      }
      continue;
    }

    if (isQuestionText(trimmed)) {
      flushQuestion();
      phase = "questions";
      currentQuestion = {
        label: trimmed,
        hints: [],
        options: [
          ...extractExampleOptions(trimmed),
          ...extractOrOptions(trimmed),
        ],
      };
      continue;
    }

    if (currentQuestion) {
      currentQuestion.hints.push(trimmed);
      continue;
    }

    preambleLines.push(rawLine);
  }

  flushQuestion();

  const questions: ParsedQuestion[] = questionBlocks
    .map((block) => finalizeQuestion(block))
    .filter((q): q is ParsedQuestion => q !== null)
    .map((q, index) => ({ ...q, id: `q-${index}` }));

  return {
    preamble: preambleLines.join("\n").trim(),
    questions,
    footer: footerLines.join("\n").trim(),
    steps: stepsLines.join("\n").trim(),
  };
}

export function formatAnswersSubmission(
  questions: ParsedQuestion[],
  answers: Record<string, string>
): string {
  const lines = ["Here are my answers:"];
  questions.forEach((q, i) => {
    const answer = answers[q.id]?.trim();
    if (answer) {
      const shortLabel =
        q.label.length > 100 ? q.label.slice(0, 97) + "…" : q.label;
      lines.push(`${i + 1}. ${shortLabel} → ${answer}`);
    }
  });
  const unanswered = questions.filter((q) => !answers[q.id]?.trim());
  if (unanswered.length > 0) {
    lines.push("");
    lines.push(
      `(I didn't answer ${unanswered.length} question${unanswered.length > 1 ? "s" : ""} yet.)`
    );
  }
  return lines.join("\n");
}
