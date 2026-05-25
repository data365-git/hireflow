"use client";
import { useState, useEffect } from "react";
import { CandidatePhoto } from "@/components/candidates/CandidatePhoto";
import { getFileUrl } from "@/app/actions/telegram-files";
import type { Candidate, Application } from "@/lib/types";

function LangDots({ level }: { level: string | null | undefined }) {
  const map: Record<string, number> = {
    none: 0,
    a1_a2: 2,
    b1_b2: 3,
    c1_c2: 4,
    native: 5,
  };
  const filled = level ? (map[level] ?? 0) : 0;
  return (
    <span className="inline-flex gap-0.5 ml-2 align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= filled ? "bg-primary" : "bg-surface-2"}`}
        />
      ))}
    </span>
  );
}

type WorkEntry = {
  company?: string;
  position?: string;
  period?: string;
  leaveReason?: string;
};

type AnketaData = {
  candidate: Candidate & {
    photoFileId?: string | null;
    photoUrl?: string | null;
    consentedAt?: string | null;
    consentVersion?: string | null;
    educationInstitution?: string | null;
    studyForm?: string | null;
    studyYear?: string | null;
  };
  application: Application & {
    motivationLetter?: string | null;
    portfolioLinks?: string[] | null;
    applicationPhotoFileId?: string | null;
  };
};

type Props = {
  data: AnketaData;
};

const STUDY_FORM_LABELS: Record<string, string> = {
  daytime: "Kunduzgi",
  evening: "Kechki",
  correspondence: "Sirtqi",
  online: "Onlayn",
};

const STUDY_YEAR_LABELS: Record<string, string> = {
  "1": "1-kurs",
  "2": "2-kurs",
  "3": "3-kurs",
  "4": "4-kurs",
  "5": "5-kurs",
  masters: "Magistratura",
  phd: "Doktorantura",
  graduated: "Bitirgan",
};

const LANG_LEVEL_LABELS: Record<string, string> = {
  none: "Yo'q",
  a1_a2: "A1-A2",
  b1_b2: "B1-B2",
  c1_c2: "C1-C2",
  native: "Native",
};

function formatDateDisplay(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function age(dob?: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years} yosh`;
}

function formatConsentDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-body-sm text-muted w-36 shrink-0">{label}</span>
      <span className="text-body-sm text-text font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-body-sm font-semibold text-text mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function AnketaTab({ data }: Props) {
  const { candidate: cand, application: app } = data;
  const [motExpanded, setMotExpanded] = useState(false);
  const [view, setView] = useState<"detailed" | "compact">("detailed");
  const [appPhotoUrl, setAppPhotoUrl] = useState<string | null>(null);

  const portfolioLinks = (app as AnketaData["application"]).portfolioLinks ?? [];
  const motivationLetter = (app as AnketaData["application"]).motivationLetter ?? null;
  const applicationPhotoFileId = (app as AnketaData["application"]).applicationPhotoFileId ?? null;

  useEffect(() => {
    if (!applicationPhotoFileId) return;
    getFileUrl(applicationPhotoFileId).then((url) => setAppPhotoUrl(url));
  }, [applicationPhotoFileId]);

  // Cast to access new fields without TypeScript errors until Agent A's schema lands
  const photoFileId = (cand as AnketaData["candidate"]).photoFileId ?? null;
  const consentedAt = (cand as AnketaData["candidate"]).consentedAt ?? null;
  const consentVersion = (cand as AnketaData["candidate"]).consentVersion ?? null;
  const educationInstitution = (cand as AnketaData["candidate"]).educationInstitution ?? null;
  const studyForm = (cand as AnketaData["candidate"]).studyForm ?? null;
  const studyYear = (cand as AnketaData["candidate"]).studyYear ?? null;

  const hasPhoto = Boolean(photoFileId || (cand as AnketaData["candidate"]).photoUrl);
  const dobDisplay = formatDateDisplay(cand.dateOfBirth);
  const dobAge = age(cand.dateOfBirth);

  // Personal section fields
  const hasPersonal =
    hasPhoto || cand.fullName || dobDisplay || cand.phone || cand.address || cand.maritalStatus;

  // Education section fields
  const hasEducation =
    cand.isStudent != null ||
    educationInstitution ||
    cand.educationField ||
    studyForm ||
    studyYear ||
    cand.englishLevel ||
    cand.russianLevel;

  // Work experience
  const workExp: WorkEntry[] = cand.workExperience ?? [];
  const hasWork = workExp.length > 0;

  // Application section
  const hasApplication = portfolioLinks.length > 0 || Boolean(motivationLetter) || Boolean(applicationPhotoFileId);

  // Consent
  const hasConsent = Boolean(consentedAt);

  const motLong = motivationLetter && motivationLetter.length > 300;

  return (
    <div className="space-y-4">
      {/* ── Tab header: consent badge + compact toggle ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          {consentedAt ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              🟢 Consented · {formatConsentDate(consentedAt)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              ⏳ Awaiting consent
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/candidates/${app.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            📄 Download as PDF
          </a>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView("compact")}
              className={`px-3 py-1 rounded-md transition ${view === "compact" ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setView("detailed")}
              className={`px-3 py-1 rounded-md transition ${view === "detailed" ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
            >
              Detailed
            </button>
          </div>
        </div>
      </div>

      {/* ── Personal ── */}
      {hasPersonal && (
        <Section title="Personal">
          {hasPhoto && (
            <div className="mb-4">
              <CandidatePhoto
                candidateId={cand.id}
                candidateName={cand.fullName}
                size="md"
              />
            </div>
          )}
          <Row label="Full name" value={cand.fullName} />
          <Row
            label="Date of birth"
            value={dobDisplay ? `${dobDisplay}${dobAge ? ` (${dobAge})` : ""}` : null}
          />
          <Row label="Phone" value={cand.phone} />
          <Row label="Address" value={cand.address} />
          <Row
            label="Marital status"
            value={
              cand.maritalStatus
                ? cand.maritalStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : null
            }
          />
        </Section>
      )}

      {/* ── Education ── */}
      {hasEducation && (
        <Section title="Education">
          <Row
            label="Student"
            value={cand.isStudent == null ? null : cand.isStudent ? "Ha" : "Yo'q"}
          />
          <Row label="Institution" value={educationInstitution} />
          <Row label="Field" value={cand.educationField} />
          <Row
            label="Study form"
            value={studyForm ? (STUDY_FORM_LABELS[studyForm] ?? studyForm) : null}
          />
          <Row
            label="Year"
            value={studyYear ? (STUDY_YEAR_LABELS[studyYear] ?? studyYear) : null}
          />
          {(cand.englishLevel || cand.russianLevel) && (
            <div className="flex gap-3 py-1.5 border-b border-border last:border-0">
              <span className="text-body-sm text-muted w-36 shrink-0">Languages</span>
              <div className="text-body-sm text-text font-medium space-y-1">
                {cand.englishLevel && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted font-normal">English:</span>{" "}
                    <span>{LANG_LEVEL_LABELS[cand.englishLevel] ?? cand.englishLevel}</span>
                    <LangDots level={cand.englishLevel} />
                  </div>
                )}
                {cand.russianLevel && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted font-normal">Russian:</span>{" "}
                    <span>{LANG_LEVEL_LABELS[cand.russianLevel] ?? cand.russianLevel}</span>
                    <LangDots level={cand.russianLevel} />
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Work experience ── */}
      {hasWork && (
        <Section title="Work experience">
          <div className="space-y-3">
            {workExp.map((exp, i) => {
              const heading = [exp.position, exp.company].filter(Boolean).join(" · ");
              return (
                <div key={i} className="rounded-lg border border-border bg-bg p-3">
                  {heading && (
                    <p className="text-body-sm font-semibold text-text">{heading}</p>
                  )}
                  {exp.period && (
                    <p className="text-micro text-subtle mt-0.5">{exp.period}</p>
                  )}
                  {exp.leaveReason && (
                    <p className="text-body-sm text-muted mt-1.5">
                      <span className="text-micro text-subtle uppercase tracking-wide mr-1">
                        Reason:
                      </span>
                      {exp.leaveReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── This application ── */}
      {hasApplication && view === "detailed" && (
        <Section title="This application">
          {applicationPhotoFileId && (
            <div className="mb-3">
              <p className="text-micro text-subtle uppercase tracking-wide mb-1.5">
                Application photo
              </p>
              {appPhotoUrl ? (
                <img
                  src={appPhotoUrl}
                  alt="Application photo"
                  className="w-32 h-32 object-cover rounded-lg border border-border"
                />
              ) : (
                <p className="text-body-sm text-muted">
                  📸 Application photo: <span className="font-mono text-xs">{applicationPhotoFileId}</span>
                </p>
              )}
            </div>
          )}
          {portfolioLinks.length > 0 && (
            <div className="mb-3">
              <p className="text-micro text-subtle uppercase tracking-wide mb-1.5">
                Portfolio links
              </p>
              <ul className="space-y-1">
                {portfolioLinks.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body-sm text-primary hover:underline break-all"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {motivationLetter && (
            <div>
              <p className="text-micro text-subtle uppercase tracking-wide mb-1.5">
                Motivation letter
              </p>
              <p className="text-body-sm text-text whitespace-pre-wrap leading-relaxed">
                {motLong && !motExpanded
                  ? motivationLetter.slice(0, 300) + "…"
                  : motivationLetter}
              </p>
              {motLong && (
                <button
                  type="button"
                  onClick={() => setMotExpanded((v) => !v)}
                  className="mt-2 text-body-sm text-primary hover:underline"
                >
                  {motExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── Consent ── */}
      <Section title="Consent">
        {hasConsent ? (
          <div className="space-y-1">
            <p className="text-body-sm text-text">
              <span className="mr-1">✅</span>
              Granted on {formatConsentDate(consentedAt)}
            </p>
            {consentVersion && (
              <p className="text-body-sm text-muted">Version: {consentVersion}</p>
            )}
          </div>
        ) : (
          <p className="text-body-sm text-muted">—</p>
        )}
      </Section>
    </div>
  );
}
