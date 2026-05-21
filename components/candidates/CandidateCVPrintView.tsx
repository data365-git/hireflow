import type { getApplicationFull } from "@/app/actions/applications";

type FullData = NonNullable<Awaited<ReturnType<typeof getApplicationFull>>>;

type Props = {
  data: FullData;
  photoUrl: string | null;
  vacancyTitle: string | null;
  stageName: string | null;
};

type WorkEntry = {
  company?: string;
  position?: string;
  period?: string;
  leaveReason?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(value?: Date | string | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function age(dob?: Date | string | null): string | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years} yosh`;
}

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
  none: "None",
  a1_a2: "A1–A2",
  b1_b2: "B1–B2",
  c1_c2: "C1–C2",
  native: "Native",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 print:break-inside-avoid">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CandidateCVPrintView({ data, photoUrl, vacancyTitle, stageName }: Props) {
  const { candidate: cand, application: app, sourceName } = data;

  const dobDisplay = formatDate(cand.dateOfBirth);
  const dobAge = age(cand.dateOfBirth);

  const workExp: WorkEntry[] = (cand.workExperience as WorkEntry[] | null) ?? [];
  const portfolioLinks = (app.portfolioLinks as string[] | null) ?? [];
  const motivationLetter = app.motivationLetter ?? null;
  const consentedAt = cand.consentedAt ?? null;
  const consentVersion = cand.consentVersion ?? null;
  const educationInstitution = cand.educationInstitution ?? null;
  const studyForm = cand.studyForm ?? null;
  const studyYear = cand.studyYear ?? null;

  const hasEducation =
    cand.isStudent != null ||
    educationInstitution ||
    cand.educationField ||
    studyForm ||
    studyYear;

  const hasLanguages = cand.englishLevel || cand.russianLevel;

  return (
    <div className="min-h-screen bg-white">
      {/* Print hint — hidden when actually printing */}
      <div className="print:hidden bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md mb-6 text-sm mx-auto max-w-[210mm] mt-6">
        Press Cmd/Ctrl + P to print or save as PDF
      </div>

      {/* CV body */}
      <div className="mx-auto max-w-[210mm] px-10 py-8 text-gray-900">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex gap-6 mb-8 print:break-inside-avoid">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={cand.fullName}
              width={100}
              height={100}
              className="w-24 h-24 rounded-lg object-cover shrink-0 border border-gray-200"
            />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-1">
              {cand.fullName}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-600 mb-2">
              {dobDisplay && (
                <span>
                  {dobDisplay}
                  {dobAge && <span className="text-gray-400 ml-1">({dobAge})</span>}
                </span>
              )}
              {cand.address && <span>{cand.address}</span>}
              {cand.phone && <span>{cand.phone}</span>}
              {cand.telegramUsername && <span>@{cand.telegramUsername}</span>}
            </div>
            {consentedAt && (
              <span className="inline-block text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5">
                Consent granted {formatDate(consentedAt)}
                {consentVersion ? ` · v${consentVersion}` : ""}
              </span>
            )}
          </div>
        </header>

        {/* ── Personal ───────────────────────────────────────────────────────── */}
        <Section title="Personal">
          <Row
            label="Marital status"
            value={
              cand.maritalStatus
                ? cand.maritalStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : null
            }
          />
          <Row
            label="Language"
            value={cand.languagePref ?? cand.language}
          />
        </Section>

        {/* ── Education ─────────────────────────────────────────────────────── */}
        {hasEducation && (
          <Section title="Education">
            <Row
              label="Student"
              value={cand.isStudent == null ? null : cand.isStudent ? "Yes" : "No"}
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
          </Section>
        )}

        {/* ── Languages ─────────────────────────────────────────────────────── */}
        {hasLanguages && (
          <Section title="Languages">
            <Row
              label="English"
              value={
                cand.englishLevel ? (LANG_LEVEL_LABELS[cand.englishLevel] ?? cand.englishLevel) : null
              }
            />
            <Row
              label="Russian"
              value={
                cand.russianLevel ? (LANG_LEVEL_LABELS[cand.russianLevel] ?? cand.russianLevel) : null
              }
            />
          </Section>
        )}

        {/* ── Work Experience ───────────────────────────────────────────────── */}
        {workExp.length > 0 && (
          <Section title="Work Experience">
            <div className="space-y-3">
              {workExp.map((exp, i) => (
                <div key={i} className="print:break-inside-avoid">
                  <p className="text-sm font-semibold text-gray-900">
                    {[exp.position, exp.company].filter(Boolean).join(" · ")}
                  </p>
                  {exp.period && (
                    <p className="text-xs text-gray-500 mt-0.5">{exp.period}</p>
                  )}
                  {exp.leaveReason && (
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="text-xs text-gray-400 uppercase tracking-wide mr-1">Reason:</span>
                      {exp.leaveReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Portfolio ─────────────────────────────────────────────────────── */}
        {portfolioLinks.length > 0 && (
          <Section title="Portfolio">
            <ol className="list-decimal list-inside space-y-1">
              {portfolioLinks.map((url, i) => (
                <li key={i} className="text-sm text-gray-700 break-all">
                  {url}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ── Motivation Letter ─────────────────────────────────────────────── */}
        {motivationLetter && (
          <Section title="Motivation Letter">
            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
              {motivationLetter}
            </p>
          </Section>
        )}

        {/* ── Application Context ───────────────────────────────────────────── */}
        <Section title="Application Context">
          <Row label="Vacancy" value={vacancyTitle} />
          <Row label="Source" value={sourceName} />
          <Row label="Stage" value={stageName} />
          <Row label="Applied at" value={formatDate(app.appliedAt)} />
          <Row label="Application ID" value={app.id} />
        </Section>
      </div>
    </div>
  );
}
