// Diraya · دِراية — application shell: two connected modes (Experience / Platform), bilingual switching,
// live/recorded status, company search and the hash router.

import { api } from "./api.js";
import { CATEGORY_COLOR, L, applyLang, categoryShort, industry, isAr, lang, onLang, pct, score, setLang, sizeShort } from "./i18n.js";
import type { SummaryRow } from "./types.js";
import { clear, debounce, h, wordmark } from "./util.js";
import { renderCompany } from "./views/company.js";
import { renderExperience } from "./views/experience.js";
import { renderMethod } from "./views/method.js";
import { renderPortfolio } from "./views/portfolio.js";

applyLang();
const app = document.getElementById("app")!;
const bar = h("header.topbar");
const banner = h("div.rec-banner", { role: "status" });
const main = h("main#view", { tabindex: -1 });
const footer = h("footer.site-foot");
app.append(bar, banner, main, footer);
let cleanup: (() => void) | null = null;

// ------------------------------------------------------------------ shell (rebuilt on language change)
function shell(): void {
  const modeText = api.mode === "live" ? L("النماذج مباشرة", "Live models") : api.mode === "recorded" ? L("إعادة عرض مسجّلة", "Recorded replay") : L("جارٍ الاتصال…", "Connecting…");
  clear(bar);
  bar.append(
    wordmark("#/platform"),
    h("nav.mainnav", {},
      h("a", { href: "#/platform", "data-route": "portfolio" }, L("المحفظة", "Portfolio")),
      h("a", { href: "#/platform/company/PC00514", "data-route": "company" }, L("تحقيق", "Investigate")),
      h("a", { href: "#/platform/method", "data-route": "method" }, L("المنهجية", "Methodology"))),
    h("div.bar-end", {},
      h("a.mode-switch", { href: "#/experience/start" }, h("i"), L("وضع التجربة", "Experience mode")),
      h("button.search-btn", { onclick: () => openPalette() }, h("span", {}, L("ابحث عن شركة", "Find a company")), h("kbd", {}, "/")),
      h("button.lang-btn", { onclick: () => setLang(lang() === "ar" ? "en" : "ar"), lang: isAr() ? "en" : "ar", title: L("Switch to English", "التبديل إلى العربية") }, isAr() ? "English" : "العربية"),
      h(`button.mode-pill.mode-${api.mode}`, { onclick: async () => { if (api.mode === "recorded" && await api.tryLive()) void route(); } }, h("i"), h("span", {}, modeText))));
  clear(banner);
  banner.append(h("strong", {}, L("إعادة عرض مسجّلة. ", "Recorded replay. ")),
    L("خادم النماذج غير متاح، لذا تعرض دِراية نتائج سُجّلت سابقًا من النماذج الحية. لا شيء على الشاشة استدلال مباشر. ",
      "The model server is unreachable, so Diraya is replaying outputs recorded earlier from the live models. Nothing on screen is live inference. "),
    h("button", { onclick: async () => { if (await api.tryLive()) void route(); } }, L("إعادة محاولة الاتصال المباشر", "Retry live connection")));
  clear(footer);
  footer.append(h("div.wrap", {},
    h("span", {}, L("دِراية · DIRAYA — اعرف قبل أن يبتعدوا", "Diraya · دِراية — Know Before They Leave")),
    h("span", {}, L("عرض تعلّم آلي على بيانات اصطناعية. الدرجات ترتيبية وليست احتمالات، والتنبؤات ليست نتائج مؤكدة.",
      "Machine-learning demonstration on synthetic data. Scores are rankings, not probabilities. Predictions are not outcomes."))));
  markNav();
  document.body.classList.toggle("is-recorded", api.mode === "recorded");
}
function markNav(): void {
  const name = currentRoute().page;
  bar.querySelectorAll<HTMLElement>(".mainnav a").forEach((a) => a.classList.toggle("is-active", a.dataset.route === name));
}
api.onMode(() => shell());
window.setInterval(() => { if (api.mode === "live") void api.probe(); }, 20000);

// ---------------------------------------------------------------- palette
const input = h("input.pal-input", { type: "search" }) as HTMLInputElement;
const results = h("ul.pal-list", { role: "listbox" });
const hint = h("p.pal-hint");
const palette = h("div.palette", { role: "dialog", "aria-modal": "true", onclick: (e: Event) => { if (e.target === palette) closePalette(); } },
  h("div.pal-box", {}, input, results, hint));
document.body.append(palette);
let rows: SummaryRow[] = [], active = 0;
function openPalette(): void {
  input.placeholder = L("رقم الشركة أو القطاع أو المنطقة…", "Company ID, industry or region…");
  input.setAttribute("aria-label", L("ابحث عن شركة", "Find a company"));
  hint.textContent = L("↑ ↓ للتنقل · Enter للتحقيق · Esc للإغلاق", "↑ ↓ to move · Enter to investigate · Esc to close");
  palette.classList.add("is-open"); input.value = ""; void search("");
  window.setTimeout(() => input.focus(), 30);
}
function closePalette(): void { palette.classList.remove("is-open"); }
async function search(q: string): Promise<void> {
  try { rows = await api.search(q, 12); } catch { rows = []; }
  active = 0; drawPalette();
}
function drawPalette(): void {
  clear(results);
  if (!rows.length) { results.append(h("li.pal-empty", {}, api.mode === "recorded" ? L("في وضع الإعادة المسجّلة تتوفر شركات العرض فقط.", "Recorded mode: only guided-demo companies are available.") : L("لا توجد نتائج.", "No company found."))); return; }
  rows.forEach((r, i) => results.append(h(`li.pal-row${i === active ? ".is-active" : ""}`, { role: "option",
    onclick: () => { closePalette(); location.hash = `#/platform/company/${r.customer_id}`; } },
    h("i.sw", { style: `background:${CATEGORY_COLOR[r.follow_up]}` }), h("strong", {}, r.customer_id),
    h("span", {}, `${industry(r.industry)} · ${sizeShort(r.company_size)}`),
    h("span.pal-num", {}, `${score(r.t1_score)} · ${pct(r.t2_pred, 0, true)}`), h("span.pal-cat", {}, categoryShort(r.follow_up)))));
}
input.addEventListener("input", debounce(() => void search(input.value), 160));
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { active = Math.min(rows.length - 1, active + 1); drawPalette(); e.preventDefault(); }
  if (e.key === "ArrowUp") { active = Math.max(0, active - 1); drawPalette(); e.preventDefault(); }
  if (e.key === "Enter" && rows[active]) { closePalette(); location.hash = `#/platform/company/${rows[active].customer_id}`; }
  if (e.key === "Escape") closePalette();
});
window.addEventListener("keydown", (e) => {
  const typing = (e.target as HTMLElement).closest("input, textarea");
  if (e.key === "/" && !typing && document.body.dataset.mode !== "experience") { e.preventDefault(); openPalette(); }
  if (e.key === "Escape" && palette.classList.contains("is-open")) closePalette();
});

// ------------------------------------------------------------------ router
interface Route { page: "experience" | "portfolio" | "company" | "method"; id?: string; month?: string; start?: boolean }
function currentRoute(): Route {
  const [path, query] = (location.hash || "#/").slice(1).split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query ?? "");
  if (parts[0] === "platform") {
    if (parts[1] === "company" && parts[2]) return { page: "company", id: parts[2].toUpperCase(), month: params.get("month") ?? undefined };
    if (parts[1] === "method") return { page: "method" };
    return { page: "portfolio" };
  }
  return { page: "experience", start: parts[1] === "start" };
}
const LEGACY: Record<string, string> = { "#/workspace": "#/platform", "#/method": "#/platform/method" };
const go = (hash: string): void => { if (location.hash === hash) void route(); else location.hash = hash; };

async function route(): Promise<void> {
  if (LEGACY[location.hash]) { location.replace(LEGACY[location.hash]); return; }
  if (location.hash.startsWith("#/company/")) { location.replace(location.hash.replace("#/company/", "#/platform/company/")); return; }
  const r = currentRoute();
  main.classList.add("is-leaving");
  await new Promise((res) => window.setTimeout(res, main.childElementCount ? 160 : 0));
  cleanup?.(); cleanup = null;
  clear(main);
  document.body.dataset.mode = r.page === "experience" ? "experience" : "platform";
  markNav();
  window.scrollTo({ top: 0 });
  try {
    if (r.page === "experience") cleanup = await renderExperience(main, go, r.start ? "start" : undefined);
    else if (r.page === "portfolio") cleanup = await renderPortfolio(main, go);
    else if (r.page === "company" && r.id) cleanup = await renderCompany(main, r.id, r.month, go);
    else cleanup = await renderMethod(main);
    if (r.start) history.replaceState(null, "", "#/experience");
  } catch (err) {
    console.error(err);
    clear(main);
    main.append(h("section.wrap.empty", {}, h("p.overline", {}, L("حدث خطأ", "Something went wrong")),
      h("h1.pf-display.small", {}, L("تعذّر تحميل هذه الصفحة.", "This view could not be loaded.")),
      h("p.pf-lede", {}, String(err instanceof Error ? err.message : err)),
      h("button.btn-ink", { onclick: () => go("#/platform") }, L("العودة إلى المحفظة", "Back to the portfolio"))));
  }
  main.classList.remove("is-leaving");
}

onLang(() => { shell(); void route(); });   // same page, same company, same month — only the language changes
window.addEventListener("hashchange", () => void route());
void (async () => {
  shell();
  await api.probe();
  await api.loadIndex();
  shell();
  await route();
})();
