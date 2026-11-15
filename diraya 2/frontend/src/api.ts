// API client with an honest fallback.
// Live mode: every call goes to the Python backend (real model inference).
// Recorded mode: if the backend cannot be reached, the app replays JSON files that were
// captured from the live backend (frontend/public/recorded/). The UI labels this clearly.

import type { Company, DemoCompany, Portfolio, Status, SummaryRow, Traces } from "./types.js";

export type Mode = "connecting" | "live" | "recorded";

interface RecordedIndex {
  recorded_at: string;
  companies: Record<string, string[]>; // customer_id -> recorded months
}

type Listener = (mode: Mode) => void;

// Where is the backend? Same origin by default. Override with public/config.js
// (window.LAMHA_CONFIG.apiBase) or the ?api=https://... query parameter.
// ?mode=recorded forces the recorded replay (useful for presenting fully offline).
const params = new URLSearchParams(window.location.search);
const w = window as unknown as { LAMHA_CONFIG?: { apiBase?: string }; ATHAR_CONFIG?: { apiBase?: string } };
const config = w.LAMHA_CONFIG ?? w.ATHAR_CONFIG ?? {};
const API_BASE = (params.get("api") ?? config.apiBase ?? "").replace(/\/$/, "");
const FORCE_RECORDED = params.get("mode") === "recorded";
const apiUrl = (path: string): string => (API_BASE ? `${API_BASE}/${path}` : path);

class Api {
  mode: Mode = "connecting";
  recordedIndex: RecordedIndex | null = null;
  private listeners: Listener[] = [];

  onMode(fn: Listener): void { this.listeners.push(fn); }

  private setMode(mode: Mode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.listeners.forEach((fn) => fn(mode));
  }

  private async fetchJson<T>(url: string, timeoutMs = 8000, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(response.status, (body as { error?: string }).error ?? response.statusText);
      }
      return (await response.json()) as T;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async recorded<T>(file: string): Promise<T> {
    return this.fetchJson<T>(`recorded/${file}`, 8000);
  }

  async loadIndex(): Promise<RecordedIndex | null> {
    if (!this.recordedIndex) {
      try { this.recordedIndex = await this.recorded<RecordedIndex>("index.json"); } catch { this.recordedIndex = null; }
    }
    return this.recordedIndex;
  }

  /** Try the live backend; on network failure switch to recorded mode. */
  private async live<T>(path: string, recordedFile: string | null, timeoutMs = 8000): Promise<T> {
    if (this.mode !== "recorded") {
      try {
        const data = await this.fetchJson<T>(apiUrl(path), timeoutMs);
        this.setMode("live");
        return data;
      } catch (err) {
        if (err instanceof ApiError) throw err; // the server answered: do not hide real errors
        if (recordedFile === null) throw err;
        this.setMode("recorded");
      }
    }
    if (recordedFile === null) throw new Error("Not available in recorded mode");
    await this.loadIndex();
    return this.recorded<T>(recordedFile);
  }

  /** Re-check whether the live backend is back. */
  async probe(): Promise<boolean> {
    if (FORCE_RECORDED) { this.setMode("recorded"); return false; }
    try {
      await this.fetchJson<Status>(apiUrl("api/status"), 3000);
      this.setMode("live");
      return true;
    } catch {
      if (this.mode === "connecting") this.setMode("recorded");
      return false;
    }
  }

  forceRecorded(): void { this.setMode("recorded"); }
  async tryLive(): Promise<boolean> { this.mode = "connecting"; return this.probe(); }

  status(): Promise<Status> { return this.live<Status>("api/status", "status.json", 4000); }
  portfolio(): Promise<Portfolio> { return this.live<Portfolio>("api/portfolio", "portfolio.json"); }
  traces(): Promise<Traces> { return this.live<Traces>("api/traces", "traces.json"); }
  demo(): Promise<{ companies: DemoCompany[] }> { return this.live("api/demo", "demo.json"); }

  async company(id: string, month?: string): Promise<Company> {
    const query = month ? `?month=${encodeURIComponent(month)}` : "";
    if (this.mode === "recorded") return this.recordedCompany(id, month);
    try {
      return await this.live<Company>(`api/companies/${encodeURIComponent(id)}${query}`, null, 10000);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      this.setMode("recorded");
      return this.recordedCompany(id, month);
    }
  }

  private async recordedCompany(id: string, month?: string): Promise<Company> {
    const index = await this.loadIndex();
    const months = index?.companies[id];
    if (!months || months.length === 0) throw new ApiError(404, `${id} is not part of the recorded demo set`);
    const chosen = month && months.includes(month) ? month : months[months.length - 1];
    const data = await this.recorded<Company>(`companies/${id}__${chosen}.json`);
    data.inference = { ...data.inference, live: false, recorded_at: index?.recorded_at };
    return data;
  }

  async search(q: string, limit = 12): Promise<SummaryRow[]> {
    if (this.mode !== "recorded") {
      try {
        const data = await this.fetchJson<{ results: SummaryRow[] }>(apiUrl(`api/companies?q=${encodeURIComponent(q)}&limit=${limit}`), 5000);
        this.setMode("live");
        return data.results;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        this.setMode("recorded");
      }
    }
    const portfolio = await this.recorded<Portfolio>("portfolio.json");
    const index = await this.loadIndex();
    const recordedIds = new Set(Object.keys(index?.companies ?? {}));
    const needle = q.trim().toLowerCase();
    return portfolio.attention
      .filter((r) => recordedIds.has(r.customer_id))
      .filter((r) => !needle || r.customer_id.toLowerCase().includes(needle) || r.industry.toLowerCase().includes(needle))
      .slice(0, limit);
  }

  isRecordedCompany(id: string): boolean {
    return Boolean(this.recordedIndex?.companies[id]);
  }

  recordedMonths(id: string): string[] {
    return this.recordedIndex?.companies[id] ?? [];
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const api = new Api();
