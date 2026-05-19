"use client";

import { useMemo, useState, useEffect } from "react";
import { useDataMode } from "@/context/DataModeContext";
import { getAnalyticsData, type AnalyticsData } from "@/app/actions/analytics";

function DeltaChip({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-xs text-success font-semibold">New</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-success" : "text-danger"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

const STAGE_BAR_COLORS: Record<string, string> = {
  new:        "bg-gray-400",
  screening:  "bg-blue-500",
  qualified:  "bg-violet-500",
  test:       "bg-amber-500",
  interview:  "bg-orange-500",
  hired:      "bg-green-500",
  rejected:   "bg-red-500",
};

type DbApplication = AnalyticsData["applications"][number];

function avgDaysInPipeline(apps: DbApplication[]): string {
  // Caller pre-filters to hired apps.
  if (apps.length === 0) return "N/A";
  const totalMs = apps.reduce((sum, a) => {
    const start = new Date(a.appliedAt).getTime();
    const end   = new Date(a.lastActivityAt).getTime();
    return sum + (end - start);
  }, 0);
  const avgMs   = totalMs / apps.length;
  const avgDays = Math.round(avgMs / 86_400_000);
  return `${avgDays}d`;
}

export default function AnalyticsPage() {
  const { mode } = useDataMode();
  const [data, setData] = useState<AnalyticsData>({ vacancies: [], applications: [], stages: [], sources: [], timeline: [], messages: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAnalyticsData().then((d) => { setData(d); setLoading(false); });
  }, [mode]);

  const vacancies = data.vacancies;
  const stages = data.stages;
  const applications = data.applications;
  const timeline = data.timeline;
  const messages = data.messages;

  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("all");

  // ── Derived: filtered apps & stages ─────────────────────────────────────────
  const filteredApps = useMemo(() => {
    if (selectedVacancyId === "all") return applications;
    return applications.filter((a) => a.vacancyId === selectedVacancyId);
  }, [applications, selectedVacancyId]);

  const filteredStages = useMemo(() => {
    if (selectedVacancyId === "all") return stages;
    return stages
      .filter((s) => s.vacancyId === selectedVacancyId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [stages, selectedVacancyId]);

  // ── Section 1: Pipeline Funnel ───────────────────────────────────────────────
  const funnelRows = useMemo(() => {
    // For "All": aggregate by stage name (same-named stages across vacancies merged)
    // For specific vacancy: one row per stage
    if (selectedVacancyId === "all") {
      // Group stages by name, count apps in each
      const stageNameMap = new Map<string, { color: string; stageIds: string[] }>();
      for (const s of stages) {
        const existing = stageNameMap.get(s.name);
        if (existing) {
          existing.stageIds.push(s.id);
        } else {
          stageNameMap.set(s.name, { color: s.color, stageIds: [s.id] });
        }
      }
      const rows = Array.from(stageNameMap.entries()).map(([name, { color, stageIds }]) => {
        const count = applications.filter((a) => stageIds.includes(a.currentStageId)).length;
        return { name, color, count };
      });
      return rows.filter((r) => r.count > 0);
    }

    return filteredStages.map((s) => ({
      name: s.name,
      color: s.color,
      count: filteredApps.filter((a) => a.currentStageId === s.id).length,
    }));
  }, [selectedVacancyId, stages, filteredStages, applications, filteredApps]);

  const maxCount = useMemo(
    () => Math.max(1, ...funnelRows.map((r) => r.count)),
    [funnelRows]
  );

  const totalApps   = filteredApps.length;
  const hiredStages = useMemo(() => {
    const base = selectedVacancyId === "all" ? stages : filteredStages;
    return base.filter((s) => s.isFinal && !s.isRejected);
  }, [selectedVacancyId, stages, filteredStages]);
  const hiredApps = useMemo(
    () => filteredApps.filter((a) => hiredStages.some((s) => s.id === a.currentStageId)),
    [filteredApps, hiredStages]
  );
  const hiredCount     = hiredApps.length;
  const conversionRate = totalApps > 0 ? ((hiredCount / totalApps) * 100).toFixed(1) : "0.0";
  const avgTime        = avgDaysInPipeline(hiredApps);

  // ── Section 2: Source Breakdown ──────────────────────────────────────────────
  const sources = useMemo(
    () => (selectedVacancyId !== "all" ? data.sources.filter((s) => s.vacancyId === selectedVacancyId) : []),
    [data.sources, selectedVacancyId],
  );

  // ── Section 3: Stage Conversion Rates ───────────────────────────────────────
  const conversionTableRows = useMemo(() => {
    const orderedStages =
      selectedVacancyId === "all"
        ? // For "All", use v1's stages as representative (most complete funnel)
          stages
            .filter((s) => s.vacancyId === "v1")
            .sort((a, b) => a.orderIndex - b.orderIndex)
        : filteredStages;

    if (orderedStages.length < 2) return [];

    const rows = [];
    for (let i = 0; i < orderedStages.length - 1; i++) {
      const thisStage = orderedStages[i];
      const nextStage = orderedStages[i + 1];

      // "At or past" = current stage orderIndex >= thisStage.orderIndex
      // For "all" mode we compare within each vacancy separately, then sum
      let entering = 0;
      let nextCount = 0;

      if (selectedVacancyId === "all") {
        // Per-vacancy: find equivalent stages by orderIndex
        for (const v of vacancies) {
          const vStages = stages
            .filter((s) => s.vacancyId === v.id)
            .sort((a, b) => a.orderIndex - b.orderIndex);
          if (vStages.length <= i) continue;
          const vThis  = vStages[i];
          const vNext  = vStages[i + 1];
          const vApps  = applications.filter((a) => a.vacancyId === v.id);
          entering += vApps.filter((a) => {
            const appStage = stages.find((s) => s.id === a.currentStageId);
            return appStage && appStage.orderIndex >= vThis.orderIndex;
          }).length;
          if (vNext) {
            nextCount += vApps.filter((a) => {
              const appStage = stages.find((s) => s.id === a.currentStageId);
              return appStage && appStage.orderIndex >= vNext.orderIndex;
            }).length;
          }
        }
      } else {
        entering = filteredApps.filter((a) => {
          const appStage = filteredStages.find((s) => s.id === a.currentStageId);
          return appStage && appStage.orderIndex >= thisStage.orderIndex;
        }).length;
        nextCount = filteredApps.filter((a) => {
          const appStage = filteredStages.find((s) => s.id === a.currentStageId);
          return appStage && appStage.orderIndex >= nextStage.orderIndex;
        }).length;
      }

      const dropOff = entering - nextCount;
      const pct     = entering > 0 ? Math.round((nextCount / entering) * 100) : 0;

      rows.push({
        from:      thisStage.name,
        to:        nextStage.name,
        entering,
        dropOff,
        pct,
      });
    }
    return rows;
  }, [selectedVacancyId, stages, filteredStages, filteredApps, applications, vacancies]);

  // ── Week-over-week trend deltas ──────────────────────────────────────────────
  const fourteenDaysAgo = useMemo(() => Date.now() - 14 * 86_400_000, []);

  // ── Section 4: Recent Activity (last 7 days) ────────────────────────────────
  const sevenDaysAgo = useMemo(() => Date.now() - 7 * 86_400_000, []);

  const recentNewApps = useMemo(
    () =>
      filteredApps.filter(
        (a) => new Date(a.appliedAt).getTime() >= sevenDaysAgo
      ).length,
    [filteredApps, sevenDaysAgo]
  );

  const recentStageMoves = useMemo(() => {
    const appIds = new Set(filteredApps.map((a) => a.id));
    return timeline.filter(
      (t) =>
        t.type === "stage_changed" &&
        appIds.has(t.applicationId) &&
        new Date(t.createdAt).getTime() >= sevenDaysAgo
    ).length;
  }, [timeline, filteredApps, sevenDaysAgo]);

  const recentMessages = useMemo(() => {
    const appIds = new Set(filteredApps.map((a) => a.id));
    return messages.filter(
      (m) =>
        m.applicationId != null &&
        appIds.has(m.applicationId) &&
        new Date(m.sentAt).getTime() >= sevenDaysAgo
    ).length;
  }, [messages, filteredApps, sevenDaysAgo]);

  // ── Delta: new apps this week vs last week ───────────────────────────────────
  const newThisWeek = useMemo(
    () => filteredApps.filter((a) => new Date(a.appliedAt).getTime() >= sevenDaysAgo).length,
    [filteredApps, sevenDaysAgo]
  );
  const newLastWeek = useMemo(
    () =>
      filteredApps.filter((a) => {
        const t = new Date(a.appliedAt).getTime();
        return t >= fourteenDaysAgo && t < sevenDaysAgo;
      }).length,
    [filteredApps, fourteenDaysAgo, sevenDaysAgo]
  );

  // ── Funnel rows with bottleneck flag ─────────────────────────────────────────
  const funnelRowsWithBottleneck = useMemo(() => {
    let prev = 0;
    return funnelRows.map((row, i) => {
      const isBottleneck = i > 0 && prev > 0 && row.count < prev * 0.5 && row.count > 0;
      prev = row.count;
      return { ...row, isBottleneck };
    });
  }, [funnelRows]);

  // ── Avg days per stage (current candidates, time since lastActivityAt) ────────
  const avgDaysPerStage = useMemo(() => {
    const orderedStages =
      selectedVacancyId === "all"
        ? stages
            .filter((s) => s.vacancyId === "v1")
            .sort((a, b) => a.orderIndex - b.orderIndex)
        : filteredStages;

    return orderedStages
      .map((stage) => {
        const appsInStage = filteredApps.filter((a) => a.currentStageId === stage.id);
        if (appsInStage.length === 0)
          return { name: stage.name, color: stage.color, avgDays: 0, count: 0 };
        const avgMs =
          appsInStage.reduce(
            (sum, a) => sum + (Date.now() - new Date(a.lastActivityAt).getTime()),
            0
          ) / appsInStage.length;
        const avgDays = Math.round(avgMs / 86_400_000);
        return { name: stage.name, color: stage.color, avgDays, count: appsInStage.length };
      })
      .filter((s) => s.count > 0);
  }, [filteredApps, filteredStages, stages, selectedVacancyId]);

  const maxAvgDays = useMemo(
    () => Math.max(1, ...avgDaysPerStage.map((s) => s.avgDays)),
    [avgDaysPerStage]
  );

  // ── Total candidates across all vacancies (for subtitle) ────────────────────
  const totalAllCandidates = applications.length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-body-sm text-subtle">Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          {totalAllCandidates} total candidate{totalAllCandidates !== 1 ? "s" : ""} across all vacancies
        </p>
      </div>

      {/* Vacancy selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedVacancyId("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            selectedVacancyId === "all"
              ? "bg-primary text-primary-fg border-transparent"
              : "bg-surface-2 text-text border-border hover:bg-surface-3"
          }`}
        >
          All
        </button>
        {vacancies.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVacancyId(v.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selectedVacancyId === v.id
                ? "bg-primary text-primary-fg border-transparent"
                : "bg-surface-2 text-text border-border hover:bg-surface-3"
            }`}
          >
            {v.title}
          </button>
        ))}
      </div>

      {/* ── Section 1: Pipeline Funnel ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text">Pipeline Funnel</h2>

        {funnelRows.length === 0 ? (
          <p className="text-sm text-muted">No applications yet.</p>
        ) : (
          <div className="space-y-2">
            {funnelRowsWithBottleneck.map((row) => {
              const widthPct = Math.round((row.count / maxCount) * 100);
              const pct =
                totalApps > 0 ? ((row.count / totalApps) * 100).toFixed(1) : "0.0";
              const barColor = STAGE_BAR_COLORS[row.color] ?? "bg-gray-400";
              return (
                <div key={row.name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted truncate text-right">
                    {row.name}
                  </span>
                  <div className="flex-1 bg-surface-2 rounded h-6 overflow-hidden">
                    <div
                      className={`h-full rounded ${barColor} transition-all`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-sm text-muted text-right flex items-center justify-end gap-1.5">
                    {row.count} ({pct}%)
                    {row.isBottleneck && (
                      <span
                        className="size-2 rounded-full bg-danger shrink-0"
                        title="Bottleneck: <50% pass-through"
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Total Applied</p>
            <p className="mt-1 text-2xl font-semibold text-text">{totalApps}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <DeltaChip current={newThisWeek} previous={newLastWeek} />
              <span className="text-xs text-subtle">this week</span>
            </div>
          </div>
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Conversion Rate</p>
            <p className="mt-1 text-2xl font-semibold text-text">{conversionRate}%</p>
            <p className="text-xs text-subtle mt-0.5">{hiredCount} hired</p>
          </div>
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Avg. Time in Pipeline</p>
            <p className="mt-1 text-2xl font-semibold text-text">{avgTime}</p>
            <p className="text-xs text-subtle mt-0.5">hired candidates only</p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Source Breakdown ────────────────────────────────────── */}
      {selectedVacancyId !== "all" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-text">Source Breakdown</h2>
          {sources.length === 0 ? (
            <p className="text-sm text-muted">No sources configured for this vacancy.</p>
          ) : (
            <>
              <p className="text-xs text-muted bg-accent-soft rounded-md px-3 py-2">
                Source attribution coming soon — connect your bot to track per-source candidates.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border">
                      <th className="text-left px-4 py-2.5 font-medium text-muted">Source</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted">Bot link</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted">Candidates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((src) => (
                      <tr key={src.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-text">{src.name}</td>
                        <td className="px-4 py-2.5 text-muted max-w-[220px]">
                          <span className="truncate block text-xs font-mono">{src.botLink}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-subtle">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Section 3: Stage Conversion Rates ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text">Stage Conversion Rates</h2>
        {conversionTableRows.length === 0 ? (
          <p className="text-sm text-muted">Not enough stages to compute conversions.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium text-muted">Stage transition</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted">Entering</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted">Drop-off</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {conversionTableRows.map((row, i) => (
                  <tr
                    key={`${row.from}-${row.to}`}
                    className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-surface-2" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-text">
                      {row.from}
                      <span className="text-subtle mx-1">→</span>
                      {row.to}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">{row.entering}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{row.dropOff}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-text">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 4: Avg. Days in Stage ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text">Avg. Days in Stage</h2>
        <p className="text-sm text-muted -mt-2">Current candidates only — time since last activity</p>
        {avgDaysPerStage.length === 0 ? (
          <p className="text-sm text-muted">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {avgDaysPerStage.map(({ name, color, avgDays }) => {
              const barColor = STAGE_BAR_COLORS[color] ?? "bg-gray-400";
              const widthPct = Math.round((avgDays / maxAvgDays) * 100);
              const isLong = avgDays >= 7;
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted truncate text-right">
                    {name}
                  </span>
                  <div className="flex-1 bg-surface-2 rounded h-5 overflow-hidden">
                    <div
                      className={`h-full rounded transition-all ${isLong ? "bg-warning" : barColor}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span
                    className={`w-16 shrink-0 text-sm text-right font-medium ${
                      isLong ? "text-warning" : "text-muted"
                    }`}
                  >
                    {avgDays}d
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 5: Recent Activity ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text">Recent Activity</h2>
        <p className="text-xs text-muted -mt-2">Last 7 days</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase tracking-wide">New Applications</p>
            <p className="mt-1 text-2xl font-semibold text-text">{recentNewApps}</p>
          </div>
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Stage Moves</p>
            <p className="mt-1 text-2xl font-semibold text-text">{recentStageMoves}</p>
          </div>
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Messages Sent</p>
            <p className="mt-1 text-2xl font-semibold text-text">{recentMessages}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
