// SVG charts. Time always runs left → right (the convention of Arabic financial charts too);
// all labels, tooltips and numbers follow the current language. Colours come from CSS variables,
// so the same chart works on the dark Experience stage and the light Platform.

import { compact, L, month, num, pct, score, year } from "./i18n.js";
import type { Company } from "./types.js";
import { h, s } from "./util.js";

const lin = (d0: number, d1: number, r0: number, r1: number) =>
  (v: number): number => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

function path(points: [number, number | null][]): string {
  let d = "", pen = false;
  for (const [x, y] of points) {
    if (y === null || Number.isNaN(y)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

function hoverLayer(svg: SVGSVGElement, W: number, H: number, padL: number, padR: number, y0: number, y1: number,
  n: number, x: (i: number) => number, html: (i: number) => string, onClick?: (i: number) => void): HTMLElement {
  const wrap = h("div.chart-wrap", { dir: "ltr" });
  const tip = h("div.chart-tip", { role: "status" });
  const cross = s("line", { y1: y0, y2: y1, class: "crosshair" });
  const hit = s("rect", { x: padL - 10, y: 0, width: W - padL - padR + 20, height: H, fill: "transparent", class: "hit" });
  svg.append(cross, hit);
  const idx = (ev: MouseEvent): number => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1))));
  };
  hit.addEventListener("mousemove", (ev) => {
    const i = idx(ev as MouseEvent);
    cross.setAttribute("x1", String(x(i))); cross.setAttribute("x2", String(x(i)));
    cross.classList.add("is-on");
    tip.innerHTML = html(i);
    tip.dir = document.documentElement.dir;
    tip.classList.add("is-on");
    const width = wrap.clientWidth;
    tip.style.left = `${Math.min(Math.max((x(i) / W) * width, 100), width - 100)}px`;
  });
  hit.addEventListener("mouseleave", () => { cross.classList.remove("is-on"); tip.classList.remove("is-on"); });
  if (onClick) hit.addEventListener("click", (ev) => onClick(idx(ev as MouseEvent)));
  wrap.append(svg, tip);
  return wrap;
}

/** The company's banking activity: collections, payments, balance, products, dip months. */
export function activityChart(c: Company, opts: { onSelect?: (m: string) => void; compactMode?: boolean } = {}): HTMLElement {
  const W = 1000, H = opts.compactMode ? 300 : 360, padL = 58, padR = 18;
  const top = { y0: 18, y1: opts.compactMode ? 168 : 190 };
  const mid = { y0: top.y1 + 26, y1: top.y1 + (opts.compactMode ? 88 : 106) };
  const low = { y0: mid.y1 + 22, y1: mid.y1 + 46 };
  const m = c.history.months, n = m.length;
  const x = lin(0, n - 1, padL, W - padR);
  const flows = [...c.history.collections, ...c.history.payments].filter((v): v is number => v !== null);
  const fMax = Math.max(...flows) * 1.08;
  const yFlow = lin(0, fMax, top.y1, top.y0);
  const bal = c.history.balance.filter((v): v is number => v !== null);
  const yBal = lin(Math.min(0, ...bal), Math.max(...bal) * 1.1, mid.y1, mid.y0);
  const pMax = Math.max(...c.history.products.filter((v): v is number => v !== null), 1);

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
    "aria-label": L(`النشاط المصرفي الشهري للشركة ${c.customer_id}`, `Monthly banking activity of ${c.customer_id}`) }) as SVGSVGElement;
  for (const t of [0.33, 0.66, 1]) {
    svg.append(s("line", { x1: padL, x2: W - padR, y1: yFlow(fMax * t), y2: yFlow(fMax * t), class: "grid" }));
    svg.append(s("text", { x: padL - 10, y: yFlow(fMax * t) + 4, class: "axis", "text-anchor": "end" }, compact(fMax * t)));
  }
  c.history.dip.forEach((d, i) => { if (d) svg.append(s("rect", { x: x(i) - 4, y: top.y0, width: 8, height: top.y1 - top.y0, class: "dip-band" })); });
  svg.append(s("text", { x: padL, y: mid.y0 - 7, class: "panel-label" }, L("متوسط الرصيد التشغيلي", "Average operating balance")));
  svg.append(s("text", { x: padL, y: low.y0 - 7, class: "panel-label" }, L("المنتجات النشطة", "Active products")));

  const balPts: [number, number | null][] = c.history.balance.map((v, i) => [x(i), v === null ? null : yBal(v)]);
  svg.append(s("path", { d: path(balPts) + `L${x(n - 1)},${mid.y1}L${x(0)},${mid.y1}Z`, class: "area" }));
  svg.append(s("path", { d: path(balPts), class: "line line-balance draw" }));
  svg.append(s("path", { d: path(c.history.payments.map((v, i) => [x(i), v === null ? null : yFlow(v)])), class: "line line-payments draw" }));
  svg.append(s("path", { d: path(c.history.collections.map((v, i) => [x(i), v === null ? null : yFlow(v)])), class: "line line-collections draw" }));

  c.history.products.forEach((v, i) => {
    if (v === null) return;
    const w = (W - padL - padR) / n - 3;
    const prev = i > 0 ? c.history.products[i - 1] : v;
    const fell = prev !== null && v < prev;
    const hgt = (v / pMax) * (low.y1 - low.y0);
    svg.append(s("rect", { x: x(i) - w / 2, y: low.y1 - hgt, width: w, height: hgt, rx: 1, class: fell ? "prod fell" : "prod" }));
  });
  m.forEach((mm, i) => { if (mm.endsWith("-01") || i === 0) svg.append(s("text", { x: x(i), y: H - 2, class: "axis", "text-anchor": "middle" }, year(mm))); });

  const sel = m.indexOf(c.month);
  if (sel >= 0) {
    svg.append(s("line", { x1: x(sel), x2: x(sel), y1: top.y0 - 6, y2: low.y1, class: "sel-line" }));
    svg.append(s("circle", { cx: x(sel), cy: top.y0 - 8, r: 4.5, class: "sel-dot" }));
  }

  return hoverLayer(svg, W, H, padL, padR, top.y0, low.y1, n, x, (i) => `
    <strong>${month(m[i])}</strong>
    <span><i class="sw sw-collections"></i>${L("التحصيلات الواردة", "Collections")} ${compact(c.history.collections[i])}</span>
    <span><i class="sw sw-payments"></i>${L("المدفوعات الصادرة", "Payments")} ${compact(c.history.payments[i])}</span>
    <span><i class="sw sw-balance"></i>${L("الرصيد", "Balance")} ${compact(c.history.balance[i])}</span>
    <span>${L("المنتجات", "Products")} ${c.history.products[i] === null ? "—" : num(c.history.products[i] as number)}${c.history.dip[i] ? ` · <em>${L("شهر تراجع", "dip month")}</em>` : ""}</span>
    ${opts.onSelect ? `<small>${L("انقر لإعادة قراءة دِراية لهذا الشهر", "Click to replay Diraya's reading for this month")}</small>` : ""}`,
    opts.onSelect ? (i) => opts.onSelect?.(m[i]) : undefined);
}

/** Deterioration ranking score month by month, with the alert threshold, data periods and recorded labels. */
export function trajectoryChart(c: Company, threshold: number, onSelect: (m: string) => void, enabled: (m: string) => boolean): HTMLElement {
  const W = 1000, H = 260, padL = 58, padR = 18, y0 = 22, y1 = 190;
  const t = c.trajectory, n = t.months.length;
  const x = lin(0, n - 1, padL, W - padR);
  const yv = (v: number): number => y1 - Math.sqrt(Math.max(0, v)) * (y1 - y0);   // √ scale
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
    "aria-label": L("درجة ترتيب خطر التراجع شهرًا بشهر", "Deterioration ranking score by month") }) as SVGSVGElement;
  const half = (x(1) - x(0)) / 2;
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || t.split[i] !== t.split[start]) {
      const xa = start === 0 ? padL : x(start) - half, xb = i === n ? W - padR : x(i) - half;
      svg.append(s("rect", { x: xa, y: y0, width: xb - xa, height: y1 - y0, class: `band band-${t.split[start]}` }));
      const label = t.split[start] === "embargo" ? "" : (t.split[start] === "train" ? L("تدريب", "Training") : t.split[start] === "valid" ? L("تحقق", "Validation") : t.split[start] === "test" ? L("اختبار", "Test") : L("لا نتيجة بعد", "No outcome yet"));
      if (label && xb - xa > 90) svg.append(s("text", { x: xa + 8, y: y0 + 15, class: "band-label" }, label));
      start = i;
    }
  }
  for (const v of [0.01, 0.05, 0.25, 0.5, 1]) {
    svg.append(s("line", { x1: padL, x2: W - padR, y1: yv(v), y2: yv(v), class: "grid" }));
    svg.append(s("text", { x: padL - 10, y: yv(v) + 4, class: "axis", "text-anchor": "end" }, num(v, v < 0.1 ? 2 : v < 1 ? 2 : 0)));
  }
  svg.append(s("line", { x1: padL, x2: W - padR, y1: yv(threshold), y2: yv(threshold), class: "threshold" }));
  svg.append(s("text", { x: W - padR - 4, y: yv(threshold) - 7, class: "threshold-label", "text-anchor": "end" },
    `${L("حدّ التنبيه", "Alert threshold")} ${score(threshold)}`));
  svg.append(s("path", { d: path(t.t1_score.map((v, i) => [x(i), yv(v)])), class: "line line-score draw" }));
  t.t1_score.forEach((v, i) => {
    svg.append(s("circle", { cx: x(i), cy: yv(v), r: t.t1_alert[i] ? 4.4 : 2.4, class: t.t1_alert[i] ? "pt pt-alert" : "pt" }));
    if (t.y1_label[i] === 1) svg.append(s("rect", { x: x(i) - 5, y: y1 + 12, width: 10, height: 10, rx: 2, class: "label-yes" }));
    else if (t.y1_label[i] === 0) svg.append(s("rect", { x: x(i) - 1, y: y1 + 15, width: 2, height: 4, class: "label-no" }));
  });
  t.months.forEach((mm, i) => { if (mm.endsWith("-01")) svg.append(s("text", { x: x(i), y: H - 2, class: "axis", "text-anchor": "middle" }, year(mm))); });
  const sel = t.months.indexOf(c.month);
  if (sel >= 0) {
    svg.append(s("line", { x1: x(sel), x2: x(sel), y1: y0, y2: y1, class: "sel-line" }));
    svg.append(s("circle", { cx: x(sel), cy: yv(t.t1_score[sel]), r: 7.5, class: "sel-ring" }));
  }
  const legend = h("div.chart-legend", {},
    h("span", {}, h("i.lg.lg-yes"), L("التسمية في البيانات: تراجعت خلال ٣ أشهر", "Dataset label: deteriorated within 3 months")),
    h("span", {}, h("i.lg.lg-no"), L("التسمية: لم تتراجع", "Label: no deterioration")),
    h("span", {}, h("i.lg.lg-alert"), L("شهر فيه تنبيه", "Alert month")));
  const chart = hoverLayer(svg, W, H, padL, padR, y0, y1, n, x, (i) => {
    const lab = t.y1_label[i] === null ? L("لم تُرصد بعد", "not observed yet")
      : t.y1_label[i] === 1 ? `<b class="ember">${L("تراجعت", "deteriorated")}</b>` : L("لم تتراجع", "no deterioration");
    return `<strong>${month(t.months[i])}</strong>
      <span>${L("درجة الترتيب", "Ranking score")} ${score(t.t1_score[i])}${t.t1_alert[i] ? ` · <b class="ember">${L("تنبيه", "alert")}</b>` : ""}</span>
      <span>${L("التغيّر المتوقع في النشاط", "Expected activity change")} ${pct(t.t2_pred[i], 0, true)}</span>
      <span>${L("التسمية للأشهر الثلاثة التالية:", "Label, next 3 months:")} ${lab}</span>
      <small>${enabled(t.months[i]) ? L("انقر لإعادة القراءة لهذا الشهر", "Click to replay this month") : L("غير متاح في وضع الإعادة المسجّلة", "Not available in recorded mode")}</small>`;
  }, (i) => { if (enabled(t.months[i])) onSelect(t.months[i]); });
  return h("div", {}, chart, legend);
}
