import type { ScreeningQuestion, ScreeningAnswer } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type Props = {
  question: ScreeningQuestion;
  answer: ScreeningAnswer;
};

const TYPE_LABELS: Record<string, string> = {
  "short-text": "Text",
  "long-text": "Long text",
  phone: "Phone",
  "single-choice": "Choice",
  "yes-no": "Yes/No",
  rating: "Rating",
};

export function ScreeningAnswerRow({ question, answer }: Props) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-1.5">
        <p className="text-body-sm font-semibold text-text">{question.text}</p>
        <span className="shrink-0 text-micro text-subtle bg-surface-2 px-2 h-5 rounded-full inline-flex items-center">
          {TYPE_LABELS[question.type] ?? question.type}
        </span>
      </div>
      <p className="text-body-sm text-muted leading-relaxed">{answer.answerText}</p>
      <p className="text-micro text-subtle mt-1.5">{formatRelativeTime(answer.answeredAt)}</p>
    </div>
  );
}
