import { Suspense } from "react";
import {
  searchCandidates,
  listFilterableVacancies,
  listFilterableStages,
  listFilterableDepartments,
  type CandidateSearchFilters,
  type LangLevel,
  type MaritalStatus,
} from "@/app/actions/candidate-actions";
import { CandidateFilterBar } from "@/components/candidates/CandidateFilterBar";
import { CandidatesSearchResults } from "@/components/candidates/CandidatesSearchResults";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  vacancyId?: string;
  stageId?: string;
  department?: string;
  englishMin?: string;
  russianMin?: string;
  marital?: string;
};

const VALID_LANG_LEVELS = new Set(["none", "a1_a2", "b1_b2", "c1_c2", "native"]);
const VALID_MARITAL = new Set(["single", "married", "divorced", "other"]);

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const filters: CandidateSearchFilters = {
    q: params.q?.trim() || undefined,
    vacancyId: params.vacancyId || undefined,
    stageId: params.stageId || undefined,
    department: params.department || undefined,
    englishMin: VALID_LANG_LEVELS.has(params.englishMin ?? "")
      ? (params.englishMin as LangLevel)
      : undefined,
    russianMin: VALID_LANG_LEVELS.has(params.russianMin ?? "")
      ? (params.russianMin as LangLevel)
      : undefined,
    maritalStatus: VALID_MARITAL.has(params.marital ?? "")
      ? (params.marital as MaritalStatus)
      : undefined,
  };

  const [rows, vacancyOptions, stageOptions, departmentOptions] = await Promise.all([
    searchCandidates(filters),
    listFilterableVacancies(),
    listFilterableStages(),
    listFilterableDepartments(),
  ]);

  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Candidates</h1>
        <p className="text-body-sm text-muted mt-1">
          Cross-vacancy candidate view with application context.
        </p>
      </div>

      <Suspense>
        <CandidateFilterBar
          vacancies={vacancyOptions}
          stages={stageOptions}
          departments={departmentOptions}
        />
      </Suspense>

      <CandidatesSearchResults rows={rows} />
    </div>
  );
}
