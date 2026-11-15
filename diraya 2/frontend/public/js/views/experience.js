// MODE 1 — EXPERIENCE. A presenter-controlled story (≈2–3 minutes) powered by the live models:
// The Signal → The Portfolio → The Investigation → The Decision.
// Keys: Space / Enter / PageDown = next · PageUp / Backspace = back · ← → follow the reading direction · Esc = platform.
import { api } from "../api.js";
import { activityChart } from "../charts.js";
import { portfolioField } from "../field.js";
import { CATEGORY_COLOR, L, actions, category, categoryDesc, companies, indicatorText, indicatorValue, industry, int, isAr, lang, month, months as monthsText, num, pct, region, score, setLang, sizeShort, } from "../i18n.js";
import { back, clear, countUp, fwd, h, logoMark, reducedMotion, s, wait } from "../util.js";
const HERO_CHOICES = ["PC00514", "PC01474", "PC02207"];
let savedStep = 0; // survives a language switch
let heroId = HERO_CHOICES[0];
const companyCache = new Map();
const STEPS = [
    { scene: 0, id: "hook1" }, { scene: 0, id: "hook2" },
    { scene: 1, id: "calm" }, { scene: 1, id: "read" }, { scene: 1, id: "alerts" }, { scene: 1, id: "priority" },
    { scene: 2, id: "trace" }, { scene: 2, id: "signals" }, { scene: 2, id: "m1" }, { scene: 2, id: "m2" }, { scene: 2, id: "m3" },
    { scene: 3, id: "decision" }, { scene: 3, id: "queue" },
];
const sceneName = (i) => [L("الإشارة", "The Signal"), L("المحفظة", "The Portfolio"),
    L("التحقيق", "The Investigation"), L("القرار", "The Decision")][i];
export async function renderExperience(root, go, startAt) {
    document.body.dataset.mode = "experience";
    if (startAt === "start")
        savedStep = 0;
    const field = h("div.xp-field");
    const copy = h("div.xp-copy", { "aria-live": "polite" });
    const viz = h("div.xp-viz");
    const stage = h("section.xp-stage", {}, h("div.xp-grid-lines", { "aria-hidden": "true" }), field, h("div.xp-layout", {}, copy, viz));
    const progress = h("nav.xp-progress", { "aria-label": L("مراحل التجربة", "Experience scenes") });
    const prevBtn = h("button.xp-nav-btn", { onclick: () => step(-1), "aria-label": L("السابق", "Previous") }, back());
    const nextBtn = h("button.xp-nav-btn.xp-next", { onclick: () => step(1) }, h("span", {}, L("التالي", "Next")), h("b", {}, fwd()));
    const chrome = h("div.xp-chrome", {}, h("header.xp-top", {}, h("a.xp-brand", { href: "#/", "aria-label": L("دِراية", "Diraya") }, logoMark(30, "#E9F0EA"), h("span.wm-ar", {}, "دِراية"), h("span.wm-en", {}, "DIRAYA")), h("div.xp-top-actions", {}, h("button.lang-btn", { onclick: () => setLang(lang() === "ar" ? "en" : "ar"), lang: isAr() ? "en" : "ar" }, isAr() ? "English" : "العربية"), h("button.xp-skip", { onclick: () => go("#/platform") }, L("تخطَّ إلى المنصة", "Skip to the platform"), " ", fwd()))), h("footer.xp-bottom", {}, progress, h("div.xp-controls", {}, prevBtn, nextBtn), h("p.xp-hint", {}, L("المسافة أو الأسهم للتنقل · Esc للمنصة · بيانات اصطناعية", "Space or arrow keys to advance · Esc for the platform · synthetic data"))));
    root.append(stage, chrome);
    let portfolio = null;
    let map = null;
    let index = Math.min(savedStep, STEPS.length - 1);
    let token = 0;
    let autoTimer = 0;
    const loadCompany = async (id) => {
        const cached = companyCache.get(id);
        if (cached)
            return cached;
        const c = await api.company(id);
        companyCache.set(id, c);
        return c;
    };
    try {
        portfolio = await api.portfolio();
        map = portfolioField(portfolio, { interactive: false });
        field.append(map.el);
        void loadCompany(heroId).catch(() => undefined);
    }
    catch (err) {
        copy.append(h("p.xp-error", {}, L("تعذّر تحميل بيانات المحفظة.", "The portfolio could not be loaded."), " ", String(err)));
    }
    function renderProgress() {
        clear(progress);
        for (let sc = 0; sc < 4; sc++) {
            const stepsIn = STEPS.map((st, i) => ({ st, i })).filter((x) => x.st.scene === sc);
            const current = STEPS[index].scene;
            progress.append(h(`button.xp-scene${sc === current ? ".is-current" : sc < current ? ".is-done" : ""}`, {
                onclick: () => goTo(stepsIn[0].i), "aria-current": sc === current ? "step" : undefined
            }, h("span.xp-scene-num", {}, num(sc + 1)), h("span.xp-scene-name", {}, sceneName(sc)), h("span.xp-scene-dots", {}, ...stepsIn.map((x) => h(`i${x.i === index ? ".on" : x.i < index ? ".done" : ""}`)))));
        }
        prevBtn.toggleAttribute("disabled", index === 0);
        nextBtn.toggleAttribute("disabled", index === STEPS.length - 1);
    }
    function step(delta) { goTo(index + delta); }
    async function goTo(i) {
        if (i < 0 || i >= STEPS.length)
            return;
        index = i;
        savedStep = i;
        window.clearTimeout(autoTimer);
        const my = ++token;
        renderProgress();
        stage.dataset.step = STEPS[i].id;
        stage.dataset.scene = String(STEPS[i].scene);
        await show(STEPS[i], my);
    }
    // -------------------------------------------------------------------- steps
    async function show(st, my) {
        const p = portfolio;
        if (!p || !map)
            return;
        const k = p.kpis;
        swapCopy();
        clear(viz);
        const isCompanyStep = st.scene >= 2;
        stage.classList.toggle("is-company", isCompanyStep);
        switch (st.id) {
            case "hook1":
                map.setLayout("grid");
                map.setMode("hidden");
                copy.append(h("div.xp-hook", {}, h("h1.xp-hook-line", {}, ...hookLine())));
                autoTimer = window.setTimeout(() => { if (my === token)
                    void goTo(1); }, reducedMotion() ? 600 : 2600);
                break;
            case "hook2":
                map.setLayout("grid");
                map.setMode("hidden");
                copy.append(h("div.xp-hook", {}, h("h1.xp-hook-line.is-dim", {}, ...hookLine()), h("h1.xp-hook-line.ember.rise", {}, L("لكن يمكن التنبؤ بها.", "But they can be predicted.")), h("div.xp-lockup.rise", { style: "--d:600ms" }, logoMark(64, "#E9F0EA"), h("div", {}, h("span.xp-lockup-ar", {}, "دِراية"), h("span.xp-lockup-en", {}, "DIRAYA")), h("p.xp-tagline", {}, L("اعرف قبل أن يبتعدوا", "Know Before They Leave"))), h("p.xp-hook-sub.rise", { style: "--d:900ms" }, L("ادخل بصفتك مدير علاقة في بنك للشركات. دِراية تقرأ أثر كل علاقة مصرفية، وتنبّهك قبل التراجع بثلاثة أشهر.", "Step in as a relationship manager at a corporate bank. Diraya reads the trace of every banking relationship — and warns you three months before it declines.")), h("button.btn-ember.rise", { style: "--d:1200ms", onclick: () => step(1) }, L("ادخل إلى البنك", "Enter the Bank"), h("b", {}, fwd()))));
                break;
            case "calm":
                map.setLayout("grid");
                map.setMode("calm");
                copyBlock(sceneName(1), L("شركة في محفظتك.", "companies in your portfolio."), L("على السطح تبدو كلها مستقرة. هكذا يرى البنك محفظته في التقارير المعتادة.", "On the surface, they all look stable. This is how a bank usually sees its portfolio."), bigCount(k.customers));
                break;
            case "read":
                map.setLayout("map");
                map.setMode("calm");
                copyBlock(sceneName(1), L(`دِراية قرأت ${monthsText(36)} من تعاملات كل شركة.`, "Diraya read 36 months of every company's banking activity."), L("ثلاثة نماذج تعلّم آلي أعادت ترتيب المحفظة: كلما اتجهت النقطة يمينًا زاد خطر تراجع العلاقة، وكلما نزلت زاد الانخفاض المتوقع في النشاط.", "Three machine-learning models rearranged the portfolio: the further right a dot sits, the higher its deterioration risk; the lower it sits, the larger the expected drop in activity."));
                break;
            case "alerts":
                map.setLayout("map");
                map.setMode("alerts");
                copyBlock(sceneName(1), L("علاقة تُظهر بوادر تراجع.", "relationships show early signs of deterioration."), L("تنبيهات تخص الأشهر الثلاثة القادمة — قبل أن يظهر التراجع في الأرقام المعتادة.", "Alerts for the next three months — before the decline shows up in the usual numbers."), bigCount(k.alerts, true));
                break;
            case "priority": {
                map.setLayout("map");
                map.setMode("priority");
                const picks = HERO_CHOICES.map((id) => p.attention.find((r) => r.customer_id === id)).filter((r) => Boolean(r));
                copyBlock(sceneName(1), L("منها تجمع التنبيه مع تراجع هيكلي.", "of them combine an alert with a structural dip."), L("من هنا يبدأ مدير العلاقة. اختر شركة للتحقيق:", "This is where a relationship manager starts. Choose a company to investigate:"), bigCount(k.priority, true), h("div.xp-picks", {}, ...picks.map((r) => h(`button.xp-pick${r.customer_id === heroId ? ".is-selected" : ""}`, {
                    onclick: () => { heroId = r.customer_id; void loadCompany(heroId); void goTo(index + 1); }
                }, h("strong", {}, r.customer_id), h("span", {}, `${industry(r.industry)} · ${L(`المرتبة ${num(r.rank)}`, `rank #${r.rank}`)}`), h("b", {}, `${pct(r.t2_pred, 0, true)}`)))));
                break;
            }
            default:
                await companyStep(st.id, my);
        }
        if (my === token)
            stage.classList.add("is-ready");
    }
    function bigCount(n, ember = false) {
        const el = h(`span.xp-count${ember ? ".ember" : ""}`, {}, "0");
        countUp(el, n, int);
        return el;
    }
    function swapCopy() { clear(copy); copy.classList.remove("in"); void copy.offsetWidth; copy.classList.add("in"); }
    function copyBlock(kicker, title, body, ...extra) {
        const count = extra.find((e) => e.classList.contains("xp-count"));
        const rest = extra.filter((e) => e !== count);
        copy.append(h("p.xp-kicker", {}, kicker), count ?? "", h("h2.xp-title", {}, title), h("p.xp-body", {}, body), ...rest);
    }
    // ------------------------------------------------------------- company steps
    async function companyStep(id, my) {
        viz.append(h("div.xp-loading", {}, h("span.loader"), L("تشغيل النماذج الثلاثة…", "Running the three models…")));
        let c;
        try {
            c = await loadCompany(heroId);
        }
        catch (err) {
            clear(viz);
            viz.append(h("p.xp-error", {}, String(err)));
            return;
        }
        if (my !== token)
            return;
        clear(viz);
        const p = portfolio;
        const r = c.reading;
        const header = h("div.xp-case-head", {}, h("span.xp-case-label", {}, L("ملف الحالة", "Case file")), h("strong.xp-case-id", {}, c.customer_id), h("span.xp-case-meta", {}, `${industry(c.profile.industry)} · ${sizeShort(c.profile.company_size)} · ${region(c.profile.region)} · ${month(c.month)}`), h(`span.xp-live${c.inference.live ? "" : ".rec"}`, {}, h("i"), c.inference.live
            ? L(`استدلال مباشر · ${num(Math.round(c.inference.milliseconds))} ملّي ثانية`, `Live inference · ${Math.round(c.inference.milliseconds)} ms`)
            : L("إعادة عرض مسجّلة — ليست استدلالًا مباشرًا", "Recorded replay — not live inference")));
        switch (id) {
            case "trace": {
                copyBlock(sceneName(2), L(`هذا أثر ${c.customer_id}.`, `This is ${c.customer_id}'s trace.`), L(`التحصيلات الواردة والرصيد التشغيلي والمنتجات كما سجّلها البنك، شهرًا بشهر، على مدى ${monthsText(c.history.months.length)}.`, `Incoming collections, operating balance and products exactly as the bank recorded them, month by month, over ${c.history.months.length} months.`), legend());
                viz.append(header, h("div.xp-panel", {}, activityChart(c, { compactMode: true })));
                break;
            }
            case "signals": {
                const on = c.indicators.filter((i) => i.triggered).length;
                copyBlock(sceneName(2), on
                    ? L(`${num(on)} من ٦ إشارات تحذير ظاهرة.`, `${on} of 6 warning signals are visible.`)
                    : L("لا تظهر أي إشارة تحذير واضحة.", "No clear warning signal is visible."), L("كل إشارة قاعدة واضحة تقارن القيمة الفعلية بحدّ مأخوذ من فترة التدريب. هذه هي الأدلة التي يستطيع مدير العلاقة رؤيتها بعينه.", "Each signal is a transparent rule comparing the observed value with a cut-off from the training period — evidence a relationship manager can see for themselves."));
                viz.append(header, h("div.xp-signals", {}, ...c.indicators.map((ind, i) => {
                    const tx = indicatorText(ind.key, ind.threshold);
                    const v = indicatorValue(ind.unit, ind.value);
                    return h(`div.xp-signal${ind.triggered ? ".on" : ""}`, { style: `--i:${i}` }, h("span.xp-signal-state", {}, ind.triggered ? L("مرصودة", "Observed") : L("غير مرصودة", "Not observed")), h("strong", {}, tx.label), h("span.xp-signal-value", {}, v.figure, v.unit ? h("small", {}, ` ${v.unit}`) : ""), h("span.xp-signal-rule", {}, tx.rule));
                })));
                break;
            }
            case "m1": {
                copyBlock(L("النموذج الأول · التنبؤ بالتراجع", "Model 1 · Deterioration"), L("هل ستتراجع العلاقة خلال الأشهر الثلاثة القادمة؟", "Will the relationship deteriorate in the next three months?"), L(`تحتل ${c.customer_id} المرتبة ${num(r.t1.rank)} من ${num(r.t1.of)} شركة — ${r.t1.alert ? "فوق حدّ التنبيه" : "تحت حدّ التنبيه"}. الدرجة ترتيبية وليست احتمالًا: إنها تخبرك بمن تبدأ.`, `${c.customer_id} ranks #${r.t1.rank} of ${int(r.t1.of)} companies — ${r.t1.alert ? "above" : "below"} the alert threshold. The score ranks companies; it is not a probability. It tells you where to start.`));
                viz.append(header, skyline(c), h("div.xp-readout", {}, h("span.xp-readout-num", {}, score(r.t1.score)), h("span.xp-readout-label", {}, L("درجة ترتيب خطر التراجع", "Deterioration ranking score")), h(`span.xp-chip${r.t1.alert ? ".ember" : ""}`, {}, r.t1.alert ? L("تنبيه", "Alert") : L("لا تنبيه", "No alert"))));
                break;
            }
            case "m2": {
                const lo = -0.6, hi = 0.6, P = (v) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
                const e = r.t2.typical_error;
                copyBlock(L("النموذج الثاني · التغيّر في النشاط", "Model 2 · Activity change"), L("كم سيتغيّر نشاطها؟", "How much will its activity change?"), L(`يتوقع النموذج تغيّرًا بنسبة ${pct(r.t2.prediction, 0, true)} خلال الأشهر الثلاثة القادمة. هامش الخطأ المعتاد ±${num(e * 100, 0)} نقطة، لذا نقرؤه اتجاهًا لا رقمًا دقيقًا.`, `The model expects a ${pct(r.t2.prediction, 0, true)} change over the next three months. Typical error is ±${Math.round(e * 100)} points — read it as a direction, not an exact figure.`));
                viz.append(header, h("div.xp-gauge", { dir: "ltr" }, h("div.xp-gauge-track", {}, h("span.xp-gauge-band", { style: `left:${P(r.t2.prediction - e)}%;width:${P(r.t2.prediction + e) - P(r.t2.prediction - e)}%` }), h("span.xp-gauge-zero", { style: `left:${P(0)}%` }), h("span.xp-gauge-point", { style: `left:${P(r.t2.prediction)}%` }, h("b", {}, pct(r.t2.prediction, 0, true)))), h("div.xp-gauge-axis", {}, h("span", {}, pct(-0.6, 0, true)), h("span", {}, pct(0)), h("span", {}, pct(0.6, 0, true))), h("p.xp-gauge-note", { dir: isAr() ? "rtl" : "ltr" }, L("الشريط يمثل هامش الخطأ المعتاد (متوسط الخطأ المطلق في فترة الاختبار).", "The band shows the typical error (test-period MAE)."))));
                break;
            }
            case "m3": {
                const t3 = r.t3;
                copyBlock(L("النموذج الثالث · طبيعة التراجع", "Model 3 · Nature of the dip"), L("هل هذا التراجع مؤقت أم هيكلي؟", "Is this dip temporary or structural?"), t3.eligible
                    ? L(`رُصد تراجع في نشاط الشركة هذا الشهر، والنموذج يقيّمه بأنه ${t3.assessment === "Structural" ? "هيكلي — يبدو مستمرًا" : "غير هيكلي — لا يبدو مستمرًا"}. الدرجة ${num(t3.score ?? 0, 2)} مقابل حدّ ${num(t3.threshold, 2)}.`, `An activity dip was observed this month, and the model assesses it as ${t3.assessment === "Structural" ? "structural — it looks lasting" : "non-structural — it does not look lasting"}. Score ${num(t3.score ?? 0, 2)} vs threshold ${num(t3.threshold, 2)}.`)
                    : L("لا ينطبق هذا الشهر: لم يُرصد تراجع في النشاط، لذا لا يصدر هذا النموذج أي تنبؤ.", "Not applicable this month: no activity dip was observed, so this model makes no prediction."));
                viz.append(header, dipPaths(t3.eligible ? t3.assessment : "Not applicable"));
                break;
            }
            case "decision": {
                const cat = c.follow_up.key;
                copyBlock(sceneName(3), L("ثلاثة نماذج. قرار واحد.", "Three models. One decision."), L("تجتمع القراءات الثلاث في أولوية متابعة واحدة يفهمها مدير العلاقة من النظرة الأولى.", "The three readings combine into one follow-up priority a relationship manager understands at a glance."));
                const pillar = (n, q, a, hot, i) => h(`div.xp-pillar${hot ? ".hot" : ""}`, { style: `--i:${i}` }, h("span.xp-pillar-n", {}, num(n)), h("span.xp-pillar-q", {}, q), h("strong.xp-pillar-a", {}, a));
                const signals = c.indicators.filter((x) => x.triggered).map((x) => indicatorText(x.key, x.threshold).label);
                viz.append(header, h("div.xp-decision", { style: `--cat:${CATEGORY_COLOR[cat]}` }, h("div.xp-capstone", {}, h("span", {}, L("أولوية المتابعة المقترحة", "Suggested follow-up")), h("strong", {}, category(cat)), h("em", {}, categoryDesc(cat))), h("div.xp-pillars", {}, pillar(1, L("هل ستتراجع العلاقة؟", "Will it deteriorate?"), r.t1.alert ? L(`تنبيه · المرتبة ${num(r.t1.rank)}`, `Alert · #${r.t1.rank}`) : L("لا تنبيه", "No alert"), r.t1.alert, 0), pillar(2, L("كم سيتغير النشاط؟", "How will activity change?"), pct(r.t2.prediction, 0, true), r.t2.expected_decline, 1), pillar(3, L("مؤقت أم هيكلي؟", "Temporary or structural?"), !r.t3.eligible ? L("لا ينطبق", "Not applicable") : r.t3.assessment === "Structural" ? L("هيكلي", "Structural") : L("غير هيكلي", "Non-structural"), r.t3.assessment === "Structural", 2)), h("div.xp-evidence", {}, h("span", {}, L("الأدلة المرصودة:", "Observed evidence:")), ...(signals.length ? signals : [L("لا توجد", "None")]).map((x) => h("i", {}, x)))));
                break;
            }
            case "queue": {
                const queue = p.attention.filter((x) => x.follow_up === "priority").slice(0, 7);
                if (!queue.some((x) => x.customer_id === c.customer_id)) {
                    const self = p.attention.find((x) => x.customer_id === c.customer_id);
                    if (self)
                        queue.push(self);
                }
                copyBlock(sceneName(3), L("بمن تبدأ اليوم؟", "Who do you call first?"), L(`قائمة أولوية هذا الشهر — ${companies(p.kpis.priority)} مرتبة بالأدلة لا بالحدس. والقرار النهائي يبقى لمدير العلاقة.`, `This month's priority queue — ${p.kpis.priority} companies ranked by evidence, not instinct. The final call stays with the relationship manager.`), h("div.xp-cta", {}, h("button.btn-ember", { onclick: () => go(`#/platform`) }, L("استكشف المنصة", "Explore the platform"), h("b", {}, fwd())), h("button.btn-ghost", { onclick: () => go(`#/platform/company/${c.customer_id}`) }, L(`افتح ملف ${c.customer_id} كاملًا`, `Open ${c.customer_id}'s full case`)), h("button.btn-ghost", { onclick: () => go("#/platform/company/PC01857?month=2025-05") }, L("هل كانت دِراية ستنبّهنا مبكرًا؟", "Would Diraya have warned us earlier?")), h("button.btn-link", { onclick: () => { savedStep = 0; void goTo(0); } }, L("أعد التجربة", "Replay the experience"))));
                viz.append(h("ol.xp-queue", {}, ...queue.map((x, i) => h(`li${x.customer_id === c.customer_id ? ".is-hero" : ""}`, { style: `--i:${i}`,
                    onclick: () => go(`#/platform/company/${x.customer_id}`) }, h("span.xp-q-rank", {}, num(i + 1)), h("span.xp-q-who", {}, h("strong", {}, x.customer_id), h("small", {}, industry(x.industry))), h("span.xp-q-bar", {}, h("i", { style: `width:${Math.sqrt(x.t1_score) * 100}%` })), h("span.xp-q-score", {}, score(x.t1_score)), h("span.xp-q-delta", {}, pct(x.t2_pred, 0, true))))), h("p.xp-actions-title", {}, L("الخطوات المقترحة لـ", "Suggested next steps for"), " ", c.customer_id), h("ol.xp-actions", {}, ...actions(c.follow_up.key).map((a) => h("li", {}, a))));
                break;
            }
        }
    }
    function legend() {
        return h("div.xp-legend", {}, h("span", {}, h("i.sw.sw-collections"), L("التحصيلات الواردة", "Incoming collections")), h("span", {}, h("i.sw.sw-payments"), L("المدفوعات الصادرة", "Outgoing payments")), h("span", {}, h("i.sw.sw-balance"), L("الرصيد التشغيلي", "Operating balance")), h("span", {}, h("i.sw.sw-dip"), L("شهر تراجع", "Dip month")), h("span", {}, h("i.sw.sw-fell"), L("إغلاق منتج", "Product closed")));
    }
    /** The portfolio "skyline": every company's ranking score, sorted, with this company marked. */
    function skyline(c) {
        const p = portfolio;
        const scores = [...p.points.score].sort((a, b) => b - a);
        const W = 900, H = 220, n = scores.length;
        const x = (i) => (Math.log10(i + 1) / Math.log10(n)) * W; // log rank, rank 1 at the left of the drawing
        const y = (v) => H - 20 - Math.sqrt(v) * (H - 40);
        let d = `M0,${H - 20}`;
        const steps = 360;
        for (let k = 0; k <= steps; k++) {
            const i = Math.min(n - 1, Math.round(Math.pow(10, (k / steps) * Math.log10(n)) - 1));
            d += `L${x(i).toFixed(1)},${y(scores[i]).toFixed(1)}`;
        }
        d += `L${W},${H - 20}Z`;
        const alerts = scores.filter((v) => v >= c.reading.t1.threshold).length;
        const rx = x(c.reading.t1.rank - 1), ry = y(c.reading.t1.score);
        const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "xp-skyline" }, s("path", { d, class: "sky-all" }), s("rect", { x: 0, y: 0, width: x(alerts - 1), height: H - 20, class: "sky-alert-zone" }), s("line", { x1: x(alerts - 1), x2: x(alerts - 1), y1: 6, y2: H - 20, class: "sky-threshold" }), s("line", { x1: rx, x2: rx, y1: ry - 26, y2: H - 20, class: "sky-marker" }), s("circle", { cx: rx, cy: ry, r: 6, class: "sky-dot" }), s("text", { x: rx + 10, y: ry - 14, class: "sky-label" }, `${c.customer_id} · #${num(c.reading.t1.rank)}`), s("text", { x: 4, y: H - 4, class: "sky-axis" }, `#${num(1)}`), s("text", { x: W - 4, y: H - 4, class: "sky-axis", "text-anchor": "end" }, `#${num(n)}`));
        return h("figure.xp-sky", { dir: "ltr" }, svg, h("figcaption", { dir: isAr() ? "rtl" : "ltr" }, L(`كل الشركات مرتبة حسب درجة الخطر · المنطقة البرتقالية = ${companies(alerts)} فوق حدّ التنبيه`, `Every company ranked by risk score · ember zone = ${alerts} companies above the alert threshold`)));
    }
    /** Schematic (not company data): what a temporary vs a structural dip looks like; the model's verdict lights one up. */
    function dipPaths(assessment) {
        const card = (kind, title, sub) => {
            const d = kind === "temp" ? "M10,40 C60,40 70,42 95,46 C120,50 125,92 150,92 C175,92 185,52 215,46 C240,42 260,40 290,40"
                : "M10,40 C60,40 70,42 95,46 C120,50 125,92 150,92 C185,92 205,104 235,110 C255,114 270,118 290,120";
            const active = (kind === "struct" && assessment === "Structural") || (kind === "temp" && assessment === "Non-Structural");
            return h(`div.xp-dip${active ? ".active" : ""}${assessment === "Not applicable" ? ".na" : ""}`, {}, s("svg", { viewBox: "0 0 300 140" }, s("line", { x1: 10, x2: 290, y1: 40, y2: 40, class: "dip-base" }), s("path", { d, class: "dip-line" }), s("circle", { cx: 150, cy: 92, r: 5, class: "dip-dot" })), h("strong", {}, title), h("span", {}, sub), active ? h("em", {}, L("تقييم النموذج", "Model's assessment")) : "");
        };
        return h("div.xp-dips", {}, card("temp", L("تراجع غير هيكلي", "Non-structural dip"), L("لا يبدو مستمرًا — قد يتعافى النشاط", "Does not look lasting — activity may recover")), card("struct", L("تراجع هيكلي", "Structural dip"), L("يبدو مستمرًا — تراجع دائم في العلاقة", "Looks lasting — a durable decline in the relationship")), h("p.xp-dips-note", {}, assessment === "Not applicable"
            ? L("لا ينطبق: لا يوجد تراجع هذا الشهر.", "Not applicable: no dip this month.")
            : L("رسم توضيحي للفرق بين النوعين — وليس بيانات الشركة. «غير هيكلي» لا يعني بالضرورة موسميًا.", "Illustration of the difference — not company data. “Non-structural” does not necessarily mean seasonal.")));
    }
    // ------------------------------------------------------------------ keys
    const onKey = (ev) => {
        if (ev.target.closest("input, textarea"))
            return;
        const rtl = document.documentElement.dir === "rtl";
        const next = [" ", "Enter", "PageDown", rtl ? "ArrowLeft" : "ArrowRight", rtl ? "ArrowDown" : "ArrowDown"];
        const prev = ["PageUp", "Backspace", rtl ? "ArrowRight" : "ArrowLeft", "ArrowUp"];
        if (next.includes(ev.key)) {
            ev.preventDefault();
            step(1);
        }
        else if (prev.includes(ev.key)) {
            ev.preventDefault();
            step(-1);
        }
        else if (ev.key === "Escape")
            go("#/platform");
        else if (["1", "2", "3", "4"].includes(ev.key))
            goTo(STEPS.findIndex((x) => x.scene === Number(ev.key) - 1));
    };
    window.addEventListener("keydown", onKey);
    await goTo(index);
    if (!reducedMotion())
        await wait(30);
    return () => { window.removeEventListener("keydown", onKey); window.clearTimeout(autoTimer); token++; map?.destroy(); delete document.body.dataset.mode; };
}
/** The opening line. «لا تُرى» / "go unseen" is its own run so the Arabic typography can set it faint. */
function hookLine() {
    return [L("بعض الإشارات ", "Some signals "), h("span.xp-unseen", {}, L("لا تُرى.", "go unseen."))];
}
