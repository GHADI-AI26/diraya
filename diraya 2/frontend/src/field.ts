// The portfolio field: every company in the snapshot month as one point (real model outputs).
// Layout "grid": a calm architectural lattice - the portfolio as the bank normally sees it.
// Layout "map":  x = deterioration ranking (Target 1, log scale of rank), y = expected activity change (Target 2).
// Modes colour the same points: calm → alerts → priority → full follow-up categories.

import { CATEGORY_COLOR, category, companies, industry, int, L, num, pct, score } from "./i18n.js";
import type { FollowUpKey, Portfolio } from "./types.js";
import { cssVar, h, reducedMotion } from "./util.js";

export type Layout = "grid" | "map";
export type Mode = "calm" | "hidden" | "alerts" | "priority" | "categories";

export interface Field {
  el: HTMLElement;
  setLayout(layout: Layout): void;
  setMode(mode: Mode): void;
  setFilter(keys: Set<FollowUpKey> | null): void;
  highlight(id: string | null): void;
  destroy(): void;
}

interface Opts { interactive: boolean; onOpen?: (id: string) => void; height?: string }

export function portfolioField(p: Portfolio, opts: Opts): Field {
  const pts = p.points, n = pts.id.length;
  const canvas = h("canvas.field-canvas") as HTMLCanvasElement;
  const tip = h("div.chart-tip.field-tip");
  const axisX = h("div.field-axis.field-axis-x", { dir: "ltr" },
    h("span", {}, L("خطر أقل", "lower risk")),
    h("span.mid", {}, L(`ترتيب خطر التراجع بين ${companies(n)} (مقياس لوغاريتمي)`, `Deterioration ranking among ${int(n)} companies (log scale)`)),
    h("span", {}, L("خطر أعلى", "higher risk")));
  const axisY = h("div.field-axis.field-axis-y", {}, L("↑ التغيّر المتوقع في النشاط خلال ٣ أشهر", "↑ Expected activity change, next 3 months"));
  const thresholdTag = h("div.field-threshold");
  const el = h("div.field", { style: opts.height ? `height:${opts.height}` : "" }, canvas, axisX, axisY, thresholdTag, tip);

  // rank 1 = highest ranking score
  const byScore = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts.score[b] - pts.score[a]);
  const rank = new Array<number>(n);
  byScore.forEach((i, r) => { rank[i] = r + 1; });
  const alertCount = pts.score.filter((v) => v >= p.thresholds.t1_alert).length;
  const logN = Math.log10(n);
  const mapX = (i: number): number => Math.log10(n / rank[i]) / logN;
  const yLo = Math.max(-0.62, Math.min(...pts.y) - 0.03), yHi = Math.min(0.48, Math.max(...pts.y) + 0.03);
  const hash = (i: number): number => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  const gridOrder = Array.from({ length: n }, (_, i) => i).sort((a, b) => hash(a) - hash(b));
  const gridSlot = new Array<number>(n);
  gridOrder.forEach((i, k) => { gridSlot[i] = k; });

  let width = 0, height = 0, dpr = 1;
  let layout: Layout = "grid", mode: Mode = "calm";
  let filter: Set<FollowUpKey> | null = null, pinned: string | null = null, hover = -1;
  const from = { x: new Float32Array(n), y: new Float32Array(n) };
  const to = { x: new Float32Array(n), y: new Float32Array(n) };
  const cur = { x: new Float32Array(n), y: new Float32Array(n) };
  let tStart = 0, animating = false, raf = 0, alive = true, modeT = 0;
  const pad = { l: 52, r: 18, t: 34, b: 34 };

  function targets(l: Layout): void {
    if (l === "grid") {
      const cols = Math.ceil(Math.sqrt(n * (width / Math.max(height, 1))));
      const rows = Math.ceil(n / cols);
      const cw = (width - 40) / cols, ch = (height - 40) / rows;
      for (let i = 0; i < n; i++) {
        const k = gridSlot[i];
        to.x[i] = 20 + (k % cols + 0.5) * cw;
        to.y[i] = 20 + (Math.floor(k / cols) + 0.5) * ch;
      }
    } else {
      for (let i = 0; i < n; i++) {
        to.x[i] = pad.l + mapX(i) * (width - pad.l - pad.r);
        to.y[i] = pad.t + (1 - (pts.y[i] - yLo) / (yHi - yLo)) * (height - pad.t - pad.b);
      }
    }
  }

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = window.devicePixelRatio || 1;
    width = r.width; height = r.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    targets(layout);
    cur.x.set(to.x); cur.y.set(to.y); from.x.set(to.x); from.y.set(to.y);
    placeOverlays();
    kick();
  }

  function placeOverlays(): void {
    const show = layout === "map";
    el.classList.toggle("is-map", show);
    if (show && alertCount) {
      const ax = pad.l + Math.log10(n / alertCount) / logN * (width - pad.l - pad.r);
      thresholdTag.style.left = `${ax}px`;
      thresholdTag.textContent = L(`حدّ التنبيه · ${int(alertCount)} تنبيهًا`, `Alert threshold · ${int(alertCount)} alerts`);
    }
  }

  function colorOf(i: number, t: number): [string, number, number] {
    const cat = pts.category[i];
    const neutral = cssVar(el, "--f-dot", "#9fb5ab");
    const ember = cssVar(el, "--ember", "#FF5A36");
    const alert = pts.score[i] >= p.thresholds.t1_alert;
    const base = layout === "grid" ? Math.max(1.1, Math.min(2.6, Math.sqrt((width * height) / n) * 0.2)) : 2.1;
    if (filter && !filter.has(cat)) return [neutral, 0.07, base];
    switch (mode) {
      case "calm": return [neutral, 0.5, base];
      case "hidden": {
        if (!alert) return [neutral, 0.42, base];
        const glow = 0.5 + 0.5 * Math.sin(t / 700 + hash(i) * 40);
        return glow > 0.92 ? [ember, 0.35 + (glow - 0.92) * 8, base * 1.15] : [neutral, 0.42, base];
      }
      case "alerts": return alert ? [ember, 0.95, base * 1.45] : [neutral, 0.22, base];
      case "priority":
        if (cat === "priority") return [ember, 1, base * 1.9];
        return alert ? [cssVar(el, "--saffron", "#F3B23C"), 0.75, base * 1.3] : [neutral, 0.16, base];
      default:
        return cat === "routine" ? [neutral, 0.38, base] : [CATEGORY_COLOR[cat], 0.92, base * (cat === "priority" ? 1.8 : 1.4)];
    }
  }

  function draw(now: number): void {
    const ctx = canvas.getContext("2d");
    if (!ctx || !width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const dur = reducedMotion() ? 0 : 1700;
    const tt = dur ? (now - tStart) / dur : 1;
    animating = tt < 1.35;
    for (let i = 0; i < n; i++) {
      const delay = layout === "map" ? (1 - mapX(i)) * 0.25 + hash(i) * 0.1 : hash(i) * 0.3;
      const local = Math.max(0, Math.min(1, (tt - delay) / 0.9));
      const e = local < 0.5 ? 4 * local ** 3 : 1 - Math.pow(-2 * local + 2, 3) / 2;
      cur.x[i] = from.x[i] + (to.x[i] - from.x[i]) * e;
      cur.y[i] = from.y[i] + (to.y[i] - from.y[i]) * e;
    }
    // axes (map only)
    if (layout === "map") {
      const ink = cssVar(el, "--f-axis", "#6f8780");
      ctx.font = `11px ${cssVar(document.body, "--font-ui", "sans-serif")}`;
      ctx.fillStyle = ink; ctx.strokeStyle = cssVar(el, "--f-grid", "rgba(255,255,255,.08)"); ctx.lineWidth = 1;
      for (const v of [-0.6, -0.4, -0.2, 0, 0.2, 0.4]) {
        if (v < yLo || v > yHi) continue;
        const y = pad.t + (1 - (v - yLo) / (yHi - yLo)) * (height - pad.t - pad.b);
        ctx.globalAlpha = v === 0 ? 0.9 : 0.5;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.textAlign = "right"; ctx.fillText(pct(v, 0, true), pad.l - 8, y + 4);
      }
      for (const r of [n, 1000, 300, 100, 30, 10, 3, 1]) {
        if (r > n) continue;
        ctx.textAlign = "center";
        ctx.fillText(`#${num(r)}`, pad.l + Math.log10(n / r) / logN * (width - pad.l - pad.r), height - pad.b + 18);
      }
      if (alertCount) {
        const ax = pad.l + Math.log10(n / alertCount) / logN * (width - pad.l - pad.r);
        ctx.setLineDash([4, 5]); ctx.strokeStyle = cssVar(el, "--ember", "#FF5A36"); ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(ax, pad.t - 6); ctx.lineTo(ax, height - pad.b); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }
    // points: routine first so flagged companies sit on top
    const order = mode === "calm" ? byScore : byScore.slice().reverse();
    const pulse = 0.5 + 0.5 * Math.sin(now / 420);
    for (const i of order) {
      const [color, alpha, r] = colorOf(i, now);
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cur.x[i], cur.y[i], r, 0, Math.PI * 2); ctx.fill();
      const isPriority = pts.category[i] === "priority" && (mode === "priority" || mode === "categories") && !(filter && !filter.has("priority"));
      if (isPriority) {
        ctx.globalAlpha = mode === "priority" ? 0.25 + 0.4 * pulse : 0.6;
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cur.x[i], cur.y[i], r + 3 + (mode === "priority" ? pulse * 3 : 1), 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const focus = hover >= 0 ? hover : pinned ? pts.id.indexOf(pinned) : -1;
    if (focus >= 0) {
      ctx.strokeStyle = cssVar(el, "--f-focus", "#fff"); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cur.x[focus], cur.y[focus], 9, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const needsLoop = (): boolean => animating || mode === "hidden" || mode === "priority";
  function loop(now: number): void {
    if (!alive || !el.isConnected) { raf = 0; return; }
    draw(now);
    raf = needsLoop() && !reducedMotion() ? requestAnimationFrame(loop) : 0;
  }
  function kick(): void { if (!raf) raf = requestAnimationFrame(loop); }

  function nearest(ev: MouseEvent): number {
    if (layout !== "map") return -1;
    const r = canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = -1, bestD = 14 * 14;
    for (let i = 0; i < n; i++) {
      if (filter && !filter.has(pts.category[i])) continue;
      const dx = cur.x[i] - mx, dy = cur.y[i] - my, d = dx * dx + dy * dy + (pts.category[i] === "routine" ? 30 : 0);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  if (opts.interactive) {
    canvas.addEventListener("mousemove", (ev) => {
      const i = nearest(ev);
      if (i !== hover) { hover = i; kick(); }
      if (i < 0) { tip.classList.remove("is-on"); canvas.style.cursor = "default"; return; }
      canvas.style.cursor = opts.onOpen ? "pointer" : "default";
      tip.dir = document.documentElement.dir;
      tip.innerHTML = `<strong>${pts.id[i]}</strong><span>${industry(pts.industry[i])}</span>
        <span>${L("الترتيب", "Rank")} #${num(rank[i])} ${L("من", "of")} ${num(n)} · ${L("الدرجة", "score")} ${score(pts.score[i])}</span>
        <span>${L("التغيّر المتوقع", "Expected change")} ${pct(pts.y[i], 0, true)}</span>
        <span><i class="sw" style="background:${CATEGORY_COLOR[pts.category[i]]}"></i>${category(pts.category[i])}</span>
        ${opts.onOpen ? `<small>${L("انقر للتحقيق", "Click to investigate")}</small>` : ""}`;
      tip.classList.add("is-on");
      tip.style.left = `${Math.min(Math.max(cur.x[i], 110), width - 110)}px`;
      tip.style.top = `${Math.max(cur.y[i] - 14, 0)}px`;
    });
    canvas.addEventListener("mouseleave", () => { hover = -1; tip.classList.remove("is-on"); kick(); });
    canvas.addEventListener("click", (ev) => { const i = nearest(ev); if (i >= 0) opts.onOpen?.(pts.id[i]); });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    el,
    setLayout(l) {
      if (l === layout && width) return;
      from.x.set(cur.x); from.y.set(cur.y);
      layout = l;
      if (width) targets(l);
      placeOverlays();
      tStart = performance.now(); animating = true; kick();
    },
    setMode(m) { mode = m; modeT = performance.now(); void modeT; kick(); },
    setFilter(keys) { filter = keys; kick(); },
    highlight(id) { pinned = id; kick(); },
    destroy() { alive = false; ro.disconnect(); if (raf) cancelAnimationFrame(raf); },
  };
}
