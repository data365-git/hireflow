"use client";
import { useStore } from "@/lib/store";

const TYPE_STYLES: Record<string, string> = {
  "short-text":    "bg-surface-2 text-muted",
  "long-text":     "bg-surface-2 text-muted",
  "phone":         "bg-primary/10 text-primary",
  "single-choice": "bg-surface-3 text-text",
  "yes-no":        "bg-success-soft text-success",
  "rating":        "bg-warning-soft text-warning",
};

const TYPE_LABELS: Record<string, string> = {
  "short-text":    "Short text",
  "long-text":     "Long text",
  "phone":         "Phone",
  "single-choice": "Single choice",
  "yes-no":        "Yes / No",
  "rating":        "Rating",
};

export default function QuestionTemplatesPage() {
  const questionTemplates = useStore((s) => s.questionTemplates);

  return (
    <div className="px-8 py-8 max-w-[760px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-h1 text-text">Question Templates</h1>
        <p className="text-body-sm text-muted mt-1">
          Pre-built question sets you can load when creating a vacancy.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {questionTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <h2 className="text-h3 text-text">{template.name}</h2>
            <p className="text-body-sm text-muted mt-1">{template.description}</p>

            <hr className="border-border my-4" />

            <ul className="space-y-2.5">
              {template.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={`shrink-0 text-micro px-2 h-5 rounded-full inline-flex items-center font-semibold mt-0.5 ${
                      TYPE_STYLES[q.type] ?? "bg-surface-2 text-muted"
                    }`}
                  >
                    {TYPE_LABELS[q.type] ?? q.type}
                  </span>
                  <span className="text-body-sm text-text leading-snug">{q.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
