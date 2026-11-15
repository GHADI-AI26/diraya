// Shapes returned by the Diraya API (backend/app/engine.py).

export type FollowUpKey = "priority" | "checkin" | "review_dip" | "monitor" | "routine";

export interface Status {
  live: boolean;
  product: string;
  bundle: string;
  scikit_learn: string;
  feature_code_matches_notebook: boolean;
  startup_seconds: number;
  dataset: { rows: number; customers: number; first_month: string; last_month: string; synthetic: boolean };
  models: Record<string, { task: string; algorithm: string; features: number; eligibility: string }>;
  snapshot_month: string;
}

export interface Distribution { key: FollowUpKey; label: string; notebook_label: string; description: string; count: number }

export interface SummaryRow {
  customer_id: string; industry: string; company_size: string; region: string;
  rank: number; percentile: number; t1_score: number; t1_alert: boolean; score_3m_avg: number;
  t2_pred: number; t3_eligible: boolean; t3_score: number | null; t3_assessment: string;
  follow_up: FollowUpKey; signals: string[];
}

export interface Portfolio {
  snapshot_month: string;
  kpis: { customers: number; alerts: number; priority: number; t3_eligible: number; structural: number; expected_decline: number };
  distribution: Distribution[];
  points: { id: string[]; x: number[]; y: number[]; score: number[]; category: FollowUpKey[]; structural: boolean[]; industry: string[] };
  attention: SummaryRow[];
  thresholds: { t1_alert: number; t2_decline: number; t3_structural: number; indicator_cutoffs: Record<string, number>; notes: Record<string, string> };
  test_metrics: {
    target1: Record<string, number>;
    target2: Record<string, number>;
    target3: Record<string, number>;
  };
  industries: string[];
}

export interface Traces { months: string[]; traces: { id: string; flagged: boolean; values: (number | null)[] }[] }

export interface Indicator {
  key: string; label: string; window: string; value: number | null; threshold: number | null;
  unit: "count" | "pct" | "months" | "flag"; triggered: boolean; explanation: string;
}

export interface Company {
  customer_id: string;
  profile: { industry: string; company_size: string; region: string; relationship_start_date: string; tenure_months: number;
             annual_revenue_sar: number | null; employees: number | null; active_products: number };
  month: string; months: string[]; month_split: string; month_split_label: string; is_snapshot: boolean;
  history: { months: string[]; collections: (number | null)[]; payments: (number | null)[]; balance: (number | null)[];
             products: (number | null)[]; payroll: (number | null)[]; dip: boolean[] };
  trajectory: { months: string[]; t1_score: number[]; t2_pred: number[]; t1_alert: boolean[]; y1_label: (number | null)[]; split: string[] };
  reading: {
    t1: { score: number; alert: boolean; threshold: number; rank: number; of: number; percentile: number };
    t2: { prediction: number; decline_cutoff: number; expected_decline: boolean; typical_error: number };
    t3: { eligible: boolean; score: number | null; threshold: number; assessment: string };
  };
  indicators: Indicator[];
  sensitivity: { signal: string; features: string[]; score_if_typical: number; delta: number }[];
  follow_up: { key: FollowUpKey; label: string; notebook_label: string; description: string };
  outcome: { deteriorated_next_3m: boolean; note: string } | null;
  inference: { live: boolean; milliseconds: number; rows_used: number; features: number; data_cutoff: string; note: string; recorded_at?: string };
  brief: { headline: string; category: string; reasons: string[]; signals: string[]; drivers: string[]; actions: string[]; caveats: string[] };
}

export interface DemoCompany { customer_id: string; role: string; why: string }
