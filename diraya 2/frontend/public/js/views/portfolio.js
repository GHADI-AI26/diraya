// MODE 2 — PLATFORM · Portfolio: the snapshot month as scored by the three models.
import { api } from "../api.js";
import { portfolioField } from "../field.js";
import { CATEGORY_COLOR, L, iso, category, categoryDesc, categoryShort, companies, demoStops, industry, int, month, num, pct, score, sizeShort, } from "../i18n.js";
import { countUp, fwd, h, observeReveals } from "../util.js";
const SIGNALS = ["products", "balance", "collections", "trend", "streak", "payroll"];
export async function renderPortfolio(root, go) {
    root.append(h("div.page-loading", {}, h("span.loader"), L("جارٍ تقييم المحفظة…", "Scoring the portfolio…")));
    const p = await api.portfolio();
    root.replaceChildren();
    const open = (id) => go(`#/platform/company/${id}`);
    const k = p.kpis;
    const top = p.attention.filter((r) => r.follow_up === "priority").slice(0, 3);
    // ------------------------------------------------------------- hero band
    const headline = h("h1.pf-display", {}, h("span.pf-num", { "data-count": k.alerts }, "0"), " ", L("علاقة تُظهر بوادر تراجع.", "relationships are showing early signs of deterioration."));
    const hero = h("section.pf-hero", {}, h("div.wrap.pf-hero-grid", {}, h("div", {}, h("p.overline", {}, L(`المحفظة · لقطة ${month(p.snapshot_month)}`, `Portfolio · ${month(p.snapshot_month)} snapshot`)), headline, h("p.pf-lede", {}, h("strong", {}, L(`${int(k.priority)} منها`, `${k.priority} of them`)), " ", L("تجمع تنبيه التراجع مع تراجع هيكلي في النشاط. من هنا يبدأ مدير العلاقة هذا الشهر.", "combine a deterioration alert with a structural activity dip. That is where a relationship manager starts this month."))), h("aside.pf-start", {}, h("p.overline.ember", {}, L("ابدأ من هنا", "Start here")), h("ol", {}, ...top.map((r, i) => h("li", { style: `--i:${i}`, tabindex: 0, onclick: () => open(r.customer_id),
        onkeydown: (e) => { if (e.key === "Enter")
            open(r.customer_id); } }, h("span.pf-start-rank", {}, iso(`#${num(r.rank)}`)), h("span.pf-start-who", {}, h("strong", {}, r.customer_id), h("small", {}, `${industry(r.industry)} · ${sizeShort(r.company_size)}`)), h("span.pf-start-num", {}, h("b", {}, score(r.t1_score)), h("small", {}, pct(r.t2_pred, 0, true))), h("span.go", {}, fwd())))))));
    const kpi = (v, label, note, ember = false) => h(`div.kpi${ember ? ".ember" : ""}`, {}, h("span.kpi-v", { "data-count": v }, "0"), h("span.kpi-l", {}, label), h("span.kpi-n", {}, note));
    const kpis = h("section.wrap.kpis.reveal", {}, kpi(k.customers, L("شركة قُيّمت", "Companies scored"), L("كل شركة نشطة في الشهر الأخير", "Every company active in the latest month")), kpi(k.alerts, L("تنبيه تراجع", "Deterioration alerts"), L("درجة الترتيب فوق حدّ مأخوذ من فترة التحقق", "Ranking score above a validation-based threshold"), true), kpi(k.priority, L("مراجعة ذات أولوية", "Priority reviews"), L("تنبيه وتراجع هيكلي في الشهر نفسه", "Alert and structural dip in the same month"), true), kpi(k.structural, L(`تراجع هيكلي من ${int(k.t3_eligible)}`, `Structural dips of ${k.t3_eligible}`), L("النموذج الثالث يعمل في أشهر التراجع فقط", "Model 3 only runs in dip months")));
    // ------------------------------------------------------------- health
    const total = p.distribution.reduce((a, d) => a + d.count, 0);
    let active = null;
    const bar = h("div.health-bar", { dir: "ltr" });
    const legend = h("div.health-legend");
    for (const d of p.distribution) {
        const seg = h("button.health-seg", { "data-key": d.key, title: `${category(d.key)}: ${int(d.count)}`,
            style: `flex-grow:${Math.max(d.count / total, d.count ? 0.012 : 0)};background:${CATEGORY_COLOR[d.key]}${d.count ? "" : ";display:none"}`,
            onclick: () => toggle(d.key) });
        bar.append(seg);
        legend.append(h("button.legend-item", { "data-key": d.key, onclick: () => toggle(d.key) }, h("i.sw", { style: `background:${CATEGORY_COLOR[d.key]}` }), h("span.legend-label", {}, category(d.key)), h("span.legend-count", {}, int(d.count)), h("span.legend-desc", {}, categoryDesc(d.key))));
    }
    const health = h("section.wrap.section.reveal", {}, sectionHead(L("توزيع صحة العلاقات", "Relationship health"), L("أين تقف كل علاقة", "Where every relationship stands"), L("تحصل كل شركة على فئة متابعة واحدة من مخرجات النماذج الثلاثة. انقر فئة لتركيز الخريطة والقائمة.", "Each company gets one follow-up category from the three model outputs. Click a category to focus the map and the list.")), bar, legend);
    // ------------------------------------------------------------- map + list
    const field = portfolioField(p, { interactive: true, onOpen: open, height: "560px" });
    field.setLayout("map");
    field.setMode("categories");
    const listBody = h("ol.att-list");
    const tabs = h("div.tabs");
    const count = h("span.muted");
    let tab = "priority";
    const tabDefs = [["priority", categoryShort("priority")], ["checkin", categoryShort("checkin")],
        ["monitor", categoryShort("monitor")], ["alerts", L("كل التنبيهات", "All alerts")]];
    for (const [key, label] of tabDefs)
        tabs.append(h("button.tab", { "data-key": key, onclick: () => { tab = key; list(); } }, label));
    const list = () => {
        tabs.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.key === tab));
        const rows = (tab === "alerts" ? p.attention.filter((r) => r.t1_alert) : p.attention.filter((r) => r.follow_up === tab))
            .slice().sort((a, b) => b.t1_score - a.t1_score);
        count.textContent = companies(rows.length);
        listBody.replaceChildren(...rows.slice(0, 40).map((r, i) => row(r, i)));
    };
    const row = (r, i) => h("li.att-row", { style: `--i:${i}`, tabindex: 0, onclick: () => open(r.customer_id),
        onkeydown: (e) => { if (e.key === "Enter")
            open(r.customer_id); },
        onmouseenter: () => field.highlight(r.customer_id), onmouseleave: () => field.highlight(null) }, h("span.att-rank", {}, iso(`#${num(r.rank)}`)), h("span.att-who", {}, h("strong", {}, r.customer_id), h("small", {}, `${industry(r.industry)} · ${sizeShort(r.company_size)}`)), h("span.att-score", {}, h("span.track", { dir: "ltr" }, h("i", { style: `width:${Math.sqrt(r.t1_score) * 100}%` })), h("small", {}, score(r.t1_score))), h(`span.att-delta${r.t2_pred < 0 ? ".neg" : ""}`, {}, pct(r.t2_pred, 0, true)), h("span.att-dip", {}, r.t3_eligible
        ? h(`b.${r.t3_assessment === "Structural" ? "st" : "ns"}`, {}, r.t3_assessment === "Structural" ? L("هيكلي", "Structural") : L("غير هيكلي", "Non-structural"))
        : h("small", {}, L("لا تراجع", "No dip"))), h("span.att-signals", { title: L("إشارات التحذير الست", "The six warning signals") }, ...SIGNALS.map((s) => h(`i${r.signals.includes(s) ? ".on" : ""}`))), h("span.go", {}, fwd()));
    const toggle = (key) => {
        active = active === key ? null : key;
        field.setFilter(active ? new Set([active]) : null);
        root.querySelectorAll(".health-seg, .legend-item").forEach((e) => e.classList.toggle("is-dim", active !== null && e.dataset.key !== active));
        if (active === "priority" || active === "checkin" || active === "monitor") {
            tab = active;
            list();
        }
    };
    const mapList = h("section.wrap.section.maplist.reveal", {}, h("div.map-col", {}, h("div.col-head", {}, h("p.overline", {}, L("خريطة المخاطر · كل نقطة شركة", "Risk map · one dot per company")), h("p.col-note", {}, L("يمينًا = ترتيب أعلى لخطر التراجع (النموذج ١). للأسفل = انخفاض أكبر متوقع في النشاط (النموذج ٢). الحلقة = أولوية.", "Right = higher deterioration ranking (model 1). Down = larger expected activity drop (model 2). Ring = priority."))), field.el), h("div.list-col", {}, h("div.col-head", {}, h("p.overline", {}, L("قائمة الاهتمام", "Attention list")), count), tabs, h("div.att-head", {}, h("span", {}, L("الترتيب", "Rank")), h("span", {}, L("الشركة", "Company")), h("span", {}, L("درجة الترتيب", "Score")), h("span", {}, L("Δ ٣ أشهر", "Δ 3M")), h("span", {}, L("التراجع", "Dip")), h("span", {}, L("الإشارات", "Signals")), h("span", {})), listBody));
    // ------------------------------------------------------------- trust
    const t1 = p.test_metrics.target1, t2 = p.test_metrics.target2, t3 = p.test_metrics.target3;
    const trust = h("section.pf-trust", {}, h("div.wrap", {}, sectionHead(L("إلى أي حد يمكن الوثوق بها؟", "How far can you trust it?"), L("قيست مرة واحدة، على أشهر لم ترها النماذج", "Measured once, on months the models never saw"), L("فترة الاختبار من مايو إلى سبتمبر ٢٠٢٥. اختيرت النماذج على فترة تحقق سابقة، واستُخدمت بيانات الاختبار مرة واحدة فقط.", "Test period May–September 2025. Models were selected on an earlier validation period; the test set was used only once."), true), h("div.trust-grid", {}, trustCard(L("النموذج ١ · التنبؤ بالتراجع", "Model 1 · Deterioration"), pct(t1["Precision@200"], 1), L("من أعلى ٢٠٠ سجل في الترتيب تراجعت فعلًا", "of the 200 highest-ranked test records really deteriorated"), L(`${num(t1["Correct alerts in Top-200 (records)"])} من ٢٠٠ سجل، مقابل ${pct(t1["Random-guess PR-AUC"], 1)} عشوائيًا · ${iso(`PR-AUC ${num(t1["PR-AUC"], 4)}`)} · ${iso("Recall@200")} ${pct(t1["Recall@200"], 1)} · تعود السجلات الـ٢٠٠ إلى ${companies(t1["Distinct companies in Top-200"])} مختلفة.`, `${t1["Correct alerts in Top-200 (records)"]} of 200 records, vs ${pct(t1["Random-guess PR-AUC"], 1)} at random · PR-AUC ${t1["PR-AUC"].toFixed(4)} · Recall@200 ${pct(t1["Recall@200"], 1)} · those 200 records belong to ${t1["Distinct companies in Top-200"]} distinct companies.`)), trustCard(L("النموذج ٢ · التغيّر في النشاط", "Model 2 · Activity change"), `±${num(t2["MAE"] * 100, 1)}`, L("نقطة متوسط الخطأ في توقع نشاط ٣ أشهر", "points average error of the 3-month activity forecast"), L(`${iso(`R² ${num(t2["R2"], 3)}`)} · ${iso(`RMSE ${num(t2["RMSE"], 3)}`)}. مفيد لترتيب من يُتوقع تراجعه، وليس دقيقًا بما يكفي لإعطاء رقم للعميل.`, `R² ${t2["R2"].toFixed(3)} · RMSE ${t2["RMSE"].toFixed(3)}. Useful to rank who is likely to decline — not precise enough to quote a number to a client.`)), trustCard(L("النموذج ٣ · طبيعة التراجع", "Model 3 · Nature of the dip"), pct(t3["Precision"], 1), L("من التراجعات المصنفة هيكلية كانت هيكلية فعلًا", "of dips flagged as structural really were structural"), L(`${iso("Recall")} ${pct(t3["Recall"], 1)} · ${iso(`F1 ${num(t3["F1"], 3)}`)} · ${iso(`PR-AUC ${num(t3["PR-AUC"], 4)}`)}. عيّنة صغيرة: ٩٨ تراجعًا هيكليًا في فترة الاختبار.`, `Recall ${pct(t3["Recall"], 1)} · F1 ${t3["F1"].toFixed(3)} · PR-AUC ${t3["PR-AUC"].toFixed(4)}. Small sample: 98 structural dips in the test period.`))), h("p.fine.light", {}, L("الدرجات ترتّب الشركات ولا تمثل احتمالات معايرة. التنبؤات ليست نتائج مؤكدة. جميع البيانات اصطناعية.", "Scores rank companies; they are not calibrated probabilities. Predictions are not confirmed outcomes. All data is synthetic."))));
    // ------------------------------------------------------------- demo stops
    const stops = h("section.wrap.section.reveal", {}, sectionHead(L("محطات العرض", "Guided stops"), L("أربع شركات تروي القصة", "Four companies that tell the story"), ""), h("div.stops", {}, ...demoStops().map((d) => h("button.stop", { onclick: () => open(d.id) }, h("span.stop-role", {}, d.role), h("strong", {}, d.id), h("span.stop-why", {}, d.why)))));
    root.append(hero, kpis, health, mapList, trust, stops);
    list();
    root.querySelectorAll("[data-count]").forEach((e) => countUp(e, Number(e.dataset.count), int));
    observeReveals(root);
    return () => field.destroy();
}
export function sectionHead(over, title, note, light = false) {
    return h(`div.sec-head${light ? ".light" : ""}`, {}, h("p.overline", {}, over), h("h2.sec-title", {}, title), note ? h("p.sec-note", {}, note) : "");
}
function trustCard(kicker, big, label, detail) {
    return h("article.trust-card", {}, h("p.trust-kicker", {}, kicker), h("p.trust-big", {}, big), h("p.trust-label", {}, label), h("p.trust-detail", {}, detail));
}
