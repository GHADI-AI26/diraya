// API client with an honest fallback.
// Live mode: every call goes to the Python backend (real model inference).
// Recorded mode: if the backend cannot be reached, the app replays JSON files that were
// captured from the live backend (frontend/public/recorded/). The UI labels this clearly.
// Where is the backend? Same origin by default. Override with public/config.js
// (window.LAMHA_CONFIG.apiBase) or the ?api=https://... query parameter.
// ?mode=recorded forces the recorded replay (useful for presenting fully offline).
const params = new URLSearchParams(window.location.search);
const w = window;
const config = w.LAMHA_CONFIG ?? w.ATHAR_CONFIG ?? {};
const API_BASE = (params.get("api") ?? config.apiBase ?? "").replace(/\/$/, "");
const FORCE_RECORDED = params.get("mode") === "recorded";
const apiUrl = (path) => (API_BASE ? `${API_BASE}/${path}` : path);
class Api {
    mode = "connecting";
    recordedIndex = null;
    listeners = [];
    onMode(fn) { this.listeners.push(fn); }
    setMode(mode) {
        if (this.mode === mode)
            return;
        this.mode = mode;
        this.listeners.forEach((fn) => fn(mode));
    }
    async fetchJson(url, timeoutMs = 8000, init) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new ApiError(response.status, body.error ?? response.statusText);
            }
            return (await response.json());
        }
        finally {
            window.clearTimeout(timer);
        }
    }
    async recorded(file) {
        return this.fetchJson(`recorded/${file}`, 8000);
    }
    async loadIndex() {
        if (!this.recordedIndex) {
            try {
                this.recordedIndex = await this.recorded("index.json");
            }
            catch {
                this.recordedIndex = null;
            }
        }
        return this.recordedIndex;
    }
    /** Try the live backend; on network failure switch to recorded mode. */
    async live(path, recordedFile, timeoutMs = 8000) {
        if (this.mode !== "recorded") {
            try {
                const data = await this.fetchJson(apiUrl(path), timeoutMs);
                this.setMode("live");
                return data;
            }
            catch (err) {
                if (err instanceof ApiError)
                    throw err; // the server answered: do not hide real errors
                if (recordedFile === null)
                    throw err;
                this.setMode("recorded");
            }
        }
        if (recordedFile === null)
            throw new Error("Not available in recorded mode");
        await this.loadIndex();
        return this.recorded(recordedFile);
    }
    /** Re-check whether the live backend is back. */
    async probe() {
        if (FORCE_RECORDED) {
            this.setMode("recorded");
            return false;
        }
        try {
            await this.fetchJson(apiUrl("api/status"), 3000);
            this.setMode("live");
            return true;
        }
        catch {
            if (this.mode === "connecting")
                this.setMode("recorded");
            return false;
        }
    }
    forceRecorded() { this.setMode("recorded"); }
    async tryLive() { this.mode = "connecting"; return this.probe(); }
    status() { return this.live("api/status", "status.json", 4000); }
    portfolio() { return this.live("api/portfolio", "portfolio.json"); }
    traces() { return this.live("api/traces", "traces.json"); }
    demo() { return this.live("api/demo", "demo.json"); }
    async company(id, month) {
        const query = month ? `?month=${encodeURIComponent(month)}` : "";
        if (this.mode === "recorded")
            return this.recordedCompany(id, month);
        try {
            return await this.live(`api/companies/${encodeURIComponent(id)}${query}`, null, 10000);
        }
        catch (err) {
            if (err instanceof ApiError)
                throw err;
            this.setMode("recorded");
            return this.recordedCompany(id, month);
        }
    }
    async recordedCompany(id, month) {
        const index = await this.loadIndex();
        const months = index?.companies[id];
        if (!months || months.length === 0)
            throw new ApiError(404, `${id} is not part of the recorded demo set`);
        const chosen = month && months.includes(month) ? month : months[months.length - 1];
        const data = await this.recorded(`companies/${id}__${chosen}.json`);
        data.inference = { ...data.inference, live: false, recorded_at: index?.recorded_at };
        return data;
    }
    async search(q, limit = 12) {
        if (this.mode !== "recorded") {
            try {
                const data = await this.fetchJson(apiUrl(`api/companies?q=${encodeURIComponent(q)}&limit=${limit}`), 5000);
                this.setMode("live");
                return data.results;
            }
            catch (err) {
                if (err instanceof ApiError)
                    throw err;
                this.setMode("recorded");
            }
        }
        const portfolio = await this.recorded("portfolio.json");
        const index = await this.loadIndex();
        const recordedIds = new Set(Object.keys(index?.companies ?? {}));
        const needle = q.trim().toLowerCase();
        return portfolio.attention
            .filter((r) => recordedIds.has(r.customer_id))
            .filter((r) => !needle || r.customer_id.toLowerCase().includes(needle) || r.industry.toLowerCase().includes(needle))
            .slice(0, limit);
    }
    isRecordedCompany(id) {
        return Boolean(this.recordedIndex?.companies[id]);
    }
    recordedMonths(id) {
        return this.recordedIndex?.companies[id] ?? [];
    }
}
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export const api = new Api();
