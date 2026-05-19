CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  rule_id TEXT REFERENCES automation_rules(id) ON DELETE SET NULL,
  vacancy_id TEXT NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id TEXT REFERENCES candidates(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  vacancy_title TEXT NOT NULL,
  candidate_name TEXT,
  trigger_type TEXT NOT NULL,
  trigger_stage_id TEXT,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message_text TEXT,
  error TEXT,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS automation_runs_rule_created_idx
  ON automation_runs(rule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS automation_runs_vacancy_created_idx
  ON automation_runs(vacancy_id, created_at DESC);
