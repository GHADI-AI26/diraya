// MODE 2 — PLATFORM · Company case file (live inference as of any month) + action brief.
import { api, ApiError } from "../api.js";
import { activityChart, trajectoryChart } from "../charts.js";
import { CATEGORY_COLOR, L, iso, actions, category, categoryDesc, compact, indicatorText, indicatorValue, industry, int, isAr, month, months as monthsText, num, pct, region, score, signalGroup, size, split, } from "../i18n.js";
import { clear, fwd, h, observeReveals } from "../util.js";
export async function renderCompany(root, id, monthParam, go) {
    const page = h("div.case");
    root.append(page);
    const load = async (m, keep = false) => {
        const y = window.scrollY;
        page.classList.add("is-updating");
        if (!page.firstChild)
            page.append(h("div.page-loading", {}, h("span.loader"), L(`قراءة أثر ${id}… تشغيل النماذج الثلاثة`, `Reading ${id}'s trace… running three models`)));
        let c;
        try {
            c = await api.company(id, m);
        }
        catch (err) {
            clear(page);
            page.append(errorState(err, go));
            return;
        }
        clear(page);
        build(page, c, (next) => { history.replaceState(null, "", `#/platform/company/${c.customer_id}?month=${next}`); void load(next, true); }, go);
        page.classList.remove("is-updating");
        observeReveals(page);
        if (keep)
            window.scrollTo({ top: y });
    };
    await load(monthParam);
    return () => undefined;
}
function errorState(err, go) {
    const msg = err instanceof ApiError && err.status === 404 && api.mode === "recorded"
        ? L("هذه الشركة ليست ضمن مجموعة الإعادة المسجّلة.", "This company is not part of the recorded demo set.")
        : err instanceof ApiError && err.status === 404 ? L("لم يُعثر على هذه الشركة.", "This company was not found.")
            : L("تعذّر تحميل الشركة.", "The company could not be loaded.");
    return h("section.wrap.empty", {}, h("p.overline", {}, L("غير متاح", "Not available")), h("h1.pf-display.small", {}, msg), h("p.pf-lede", {}, api.mode === "recorded"
        ? L("وضع الإعادة المسجّلة يتضمن شركات العرض فقط. أعد الاتصال بالخادم للتحقيق في أي شركة.", "Recorded mode only contains the guided-demo companies. Reconnect the live backend to investigate any company.")
        : L("تحقق من رقم الشركة وحاول مجددًا.", "Check the company ID and try again.")), h("button.btn-ink", { onclick: () => go("#/platform") }, L("العودة إلى المحفظة", "Back to the portfolio")));
}
function build(page, c, select, go) {
    const r = c.reading;
    const cat = c.follow_up.key;
    const recorded = !c.inference.live;
    const enabled = (m) => !recorded || api.recordedMonths(c.customer_id).includes(m);
    // ------------------------------------------------------------ header band
    const t = c.trajectory;
    const ticks = h("div.scrub-ticks", { dir: "ltr" }, ...t.months.map((m, i) => h(`button.tick.t-${t.split[i]}${t.t1_alert[i] ? ".alert" : ""}${m === c.month ? ".is-active" : ""}`, {
        title: `${month(m)}${t.t1_alert[i] ? ` · ${L("تنبيه", "alert")}` : ""}`, disabled: !enabled(m), onclick: () => select(m)
    }, h("i"))));
    const head = h("section.case-band", { style: `--cat:${CATEGORY_COLOR[cat]}` }, h("div.wrap", {}, h("nav.crumbs", {}, h("a", { href: "#/platform" }, L("المحفظة", "Portfolio")), h("span", {}, "/"), h("span", {}, L("ملف الحالة", "Case file"))), h("div.case-title", {}, h("div", {}, h("p.overline", {}, L(`ملف الحالة · ${month(c.month)}`, `Case file · ${month(c.month)}`)), h("h1.case-id", {}, c.customer_id), h("p.case-meta", {}, [industry(c.profile.industry), size(c.profile.company_size), region(c.profile.region),
        L(`عميل منذ ${num(Number(c.profile.relationship_start_date?.slice(0, 4) ?? 0)).replace(/[٬,]/g, "")}`, `client since ${c.profile.relationship_start_date?.slice(0, 4) ?? "—"}`),
        L(`${num(c.profile.active_products)} منتجات نشطة`, `${c.profile.active_products} active products`)].join(" · "))), h("div.verdict", {}, h("span", {}, L("أولوية المتابعة المقترحة", "Suggested follow-up")), h("strong", {}, category(cat)), h("em", {}, categoryDesc(cat)))), h("div.scrubber", {}, h("div.scrub-label", {}, h("span.overline", {}, L("التحليل كما في", "Analyse as of")), h("strong", {}, month(c.month))), ticks, h("div.scrub-legend", {}, h("span", {}, h("i.k.k-train"), L("تدريب", "training")), h("span", {}, h("i.k.k-valid"), L("تحقق", "validation")), h("span", {}, h("i.k.k-test"), L("اختبار", "test")), h("span", {}, h("i.k.k-alert"), L("شهر فيه تنبيه", "alert month")))), h("div.inference", {}, h(`span.live-pill${recorded ? ".rec" : ""}`, {}, h("i"), recorded ? L("مخرجات مسجّلة · ليست استدلالًا مباشرًا", "Recorded output · not live inference") : L("استدلال مباشر", "Live inference")), h("span", {}, recorded
        ? L(`سُجّلت من النماذج الحية في ${c.inference.recorded_at ?? "—"}`, `Captured from the live models on ${c.inference.recorded_at ?? "—"}`)
        : L(`${num(Math.round(c.inference.milliseconds))} ملّي ثانية · ${monthsText(c.inference.rows_used)} من السجل · ${num(c.inference.features)} خاصية`, `${Math.round(c.inference.milliseconds)} ms · ${c.inference.rows_used} months of history · ${c.inference.features} features`)), h("span", {}, L(`البيانات المستخدمة: حتى ${month(c.inference.data_cutoff)} فقط`, `Data used: up to ${month(c.inference.data_cutoff)} only`)), h("span.split-tag", {}, split(c.month_split)))));
    // ------------------------------------------------------------ chapters
    const on = c.indicators.filter((i) => i.triggered).length;
    const ch1 = chapter(1, L("الأثر", "The trace"), L("ستة وثلاثون شهرًا من النشاط المصرفي كما سجّله البنك.", "Thirty-six months of banking activity, exactly as the bank recorded it."), h("div.legend-row", {}, h("span", {}, h("i.sw.sw-collections"), L("التحصيلات الواردة", "Incoming collections")), h("span", {}, h("i.sw.sw-payments"), L("المدفوعات الصادرة", "Outgoing payments")), h("span", {}, h("i.sw.sw-balance"), L("الرصيد التشغيلي", "Operating balance")), h("span", {}, h("i.sw.sw-dip"), L("شهر تراجع", "Dip month")), h("span", {}, h("i.sw.sw-fell"), L("إغلاق منتج", "Product closed"))), activityChart(c, { onSelect: (m) => { if (enabled(m))
            select(m); } }));
    const ch2 = chapter(2, L("الإشارات", "The signals"), on ? L(`${num(on)} من ٦ إشارات تحذير ظاهرة في ${month(c.month)}. كل قاعدة تقارن القيمة الفعلية بحدّ من فترة التدريب.`, `${on} of 6 warning signals are visible in ${month(c.month)}. Each rule compares the observed value with a cut-off from the training period.`)
        : L(`لا تظهر أي من إشارات التحذير الست في ${month(c.month)}.`, `None of the 6 warning signals is visible in ${month(c.month)}.`), h("div.signal-grid", {}, ...c.indicators.map((ind, i) => {
        const tx = indicatorText(ind.key, ind.threshold);
        const v = indicatorValue(ind.unit, ind.value);
        return h(`article.signal${ind.triggered ? ".on" : ""}`, { style: `--i:${i}` }, h("div.signal-top", {}, h("span.signal-state", {}, ind.triggered ? L("مرصودة", "Observed") : L("غير مرصودة", "Not observed")), h("span", {}, tx.window)), h("h3", {}, tx.label), h("p.signal-value", {}, v.figure, v.unit ? h("small", {}, ` ${v.unit}`) : ""), h("p.signal-rule", {}, tx.rule), h("p.signal-expl", {}, tx.explain));
    })));
    const lo = -0.6, hi = 0.6, P = (v) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
    const ch3 = chapter(3, L("القراءة", "The reading"), L("ثلاثة نماذج تقرأ السجل نفسه، وكل منها يجيب عن سؤال مختلف.", "Three models read the same history. Each answers a different question."), h("div.reading-grid", {}, h(`article.reading${r.t1.alert ? ".hot" : ""}`, {}, h("p.reading-kicker", {}, L("النموذج ١ · هل ستتراجع العلاقة خلال ٣ أشهر؟", "Model 1 · Deterioration in the next 3 months?")), h("p.reading-big", {}, score(r.t1.score)), h("p.reading-label", {}, L("درجة الترتيب", "Ranking score")), h("div.pct-track", { dir: "ltr" }, h("i", { style: `width:${r.t1.percentile}%` })), h("p.reading-line", {}, L(`المرتبة ${num(r.t1.rank)} من ${int(r.t1.of)} شركة في ${month(c.month)}`, `#${r.t1.rank} of ${int(r.t1.of)} companies in ${month(c.month)}`)), h(`span.chip${r.t1.alert ? ".ember" : ""}`, {}, r.t1.alert ? L(`تنبيه · فوق الحدّ ${score(r.t1.threshold)}`, `Alert · above threshold ${score(r.t1.threshold)}`) : L(`لا تنبيه · الحدّ ${score(r.t1.threshold)}`, `No alert · threshold ${score(r.t1.threshold)}`)), h("p.reading-note", {}, L("درجة لترتيب الشركات وليست احتمالًا. حدّ التنبيه هو درجة السجل رقم ٢٠٠ في فترة التحقق.", "A score for ranking companies, not a probability. The alert threshold is the score of the 200th-ranked validation record."))), h(`article.reading${r.t2.expected_decline ? ".warm" : ""}`, {}, h("p.reading-kicker", {}, L("النموذج ٢ · التغيّر في النشاط خلال ٣ أشهر", "Model 2 · Activity change, next 3 months")), h("p.reading-big", {}, pct(r.t2.prediction, 0, true)), h("p.reading-label", {}, L("التغيّر المتوقع في النشاط المصرفي", "Expected change in banking activity")), h("div.range", { dir: "ltr" }, h("i.range-band", { style: `left:${P(r.t2.prediction - r.t2.typical_error)}%;width:${P(r.t2.prediction + r.t2.typical_error) - P(r.t2.prediction - r.t2.typical_error)}%` }), h("i.range-zero", { style: `left:${P(0)}%` }), h("i.range-cut", { style: `left:${P(r.t2.decline_cutoff)}%` }), h("i.range-pt", { style: `left:${P(r.t2.prediction)}%` })), h("div.range-axis", { dir: "ltr" }, h("span", {}, pct(-0.6, 0, true)), h("span", {}, pct(0)), h("span", {}, pct(0.6, 0, true))), h(`span.chip${r.t2.expected_decline ? ".saffron" : ""}`, {}, r.t2.expected_decline ? L("انخفاض ملحوظ متوقع", "Notable decline expected") : L("لا انخفاض ملحوظ متوقع", "No notable decline expected")), h("p.reading-note", {}, L(`الشريط هو هامش الخطأ المعتاد (±${num(r.t2.typical_error * 100, 0)} نقطة). هذا النموذج يفسّر أقل من ربع التباين (${iso("R² ≈ ٠.٢٣")}): نقرؤه اتجاهًا لا رقمًا.`, `The band is the typical error (±${Math.round(r.t2.typical_error * 100)} points). The model explains less than a quarter of the variation (R² ≈ 0.23): read it as a direction, not a number.`))), r.t3.eligible
        ? h(`article.reading${r.t3.assessment === "Structural" ? ".hot" : ".calm"}`, {}, h("p.reading-kicker", {}, L("النموذج ٣ · هل التراجع هيكلي؟", "Model 3 · Is the dip structural?")), h("p.reading-word", {}, r.t3.assessment === "Structural" ? L("هيكلي", "Structural") : L("غير هيكلي", "Non-structural")), h("p.reading-label", {}, L("تقييم تراجع النشاط هذا الشهر", "Assessment of this month's activity dip")), h("div.gauge", { dir: "ltr" }, h("i", { style: `width:${(r.t3.score ?? 0) * 100}%` }), h("b", { style: `left:${r.t3.threshold * 100}%` })), h("p.reading-line", {}, L(`الدرجة ${num(r.t3.score ?? 0, 2)} · الحدّ ${num(r.t3.threshold, 2)} (أفضل ${iso("F1")} في التحقق)`, `Score ${(r.t3.score ?? 0).toFixed(2)} · threshold ${r.t3.threshold.toFixed(2)} (best F1 on validation)`)), h("p.reading-note", {}, L("«غير هيكلي» يعني أن التراجع لا يبدو مستمرًا، ولا يعني بالضرورة أنه موسمي.", "Non-structural means the dip does not look lasting; it is not assumed to be seasonal.")))
        : h("article.reading.na", {}, h("p.reading-kicker", {}, L("النموذج ٣ · هل التراجع هيكلي؟", "Model 3 · Is the dip structural?")), h("p.reading-word.muted", {}, L("لا ينطبق", "Not applicable")), h("p.reading-label", {}, L(`لا يوجد تراجع في النشاط في ${month(c.month)}`, `No activity dip in ${month(c.month)}`)), h("p.reading-note", {}, L("يعمل هذا النموذج فقط في الأشهر التي يُرصد فيها تراجع (is_dip_month = 1). لا يصدر أي تنبؤ غير ذلك.", "This model only runs when a dip is observed (is_dip_month = 1). No prediction is produced otherwise.")))));
    const shown = c.sensitivity.filter((x) => Math.abs(x.delta) >= 0.002).slice(0, 6);
    const maxD = Math.max(...shown.map((x) => Math.abs(x.delta)), 0.001);
    const ch4 = chapter(4, L("ما الذي حرّك الدرجة؟", "What moved the score"), L("لو استُبدلت مجموعة إشارات واحدة بقيمة نموذجية (وسيط فترة التدريب)، كيف تتغيّر درجة الترتيب؟ هذا يصف سلوك النموذج، لا سبب التراجع.", "If one group of signals were replaced with a typical value (the training-period median), how would the ranking score change? This describes the model's behaviour — not the cause of the decline."), shown.length ? h("div.sens", {}, ...shown.map((x, i) => h("div.sens-row", { style: `--i:${i}` }, h("span.sens-name", {}, signalGroup(x.signal)), h("span.sens-bar", {}, h(`i${x.delta < 0 ? ".neg" : ""}`, { style: `width:${(Math.abs(x.delta) / maxD) * 100}%` })), h("span.sens-val", { dir: "ltr" }, `${score(r.t1.score)} → ${score(x.score_if_typical)}`))))
        : h("p.muted", {}, L("لا توجد مجموعة إشارات تغيّر الدرجة بشكل ملحوظ.", "No single signal group changes the score noticeably.")));
    const alertMonths = t.months.filter((_, i) => t.t1_alert[i]);
    const outcome = c.outcome
        ? h(`div.outcome${c.outcome.deteriorated_next_3m ? ".bad" : ""}`, {}, h("strong", {}, c.outcome.deteriorated_next_3m
            ? L(`بأثر رجعي: تسجّل البيانات تراجعًا خلال الأشهر الثلاثة التي تلت ${month(c.month)}.`, `In hindsight: the dataset records a deterioration within the 3 months after ${month(c.month)}.`)
            : L(`بأثر رجعي: لا تسجّل البيانات تراجعًا خلال الأشهر الثلاثة التي تلت ${month(c.month)}.`, `In hindsight: the dataset records no deterioration within the 3 months after ${month(c.month)}.`)), h("span", {}, L("تسمية مسجّلة في البيانات الاصطناعية ولا تُعرف إلا لاحقًا. ", "A label recorded in the synthetic dataset, known only in hindsight. "), c.month_split === "test" ? L("هذا الشهر من فترة الاختبار — لم يره النموذج أثناء التدريب أو الاختيار.", "This month is in the test period — the model never saw it during training or selection.")
            : c.month_split === "train" ? L("هذا الشهر من فترة التدريب، لذا رأى النموذج هذه التسمية.", "This month belongs to the training period, so the model has seen this label.") : ""))
        : h("div.outcome.unknown", {}, h("strong", {}, L("النتيجة لم تُعرف بعد.", "Outcome not yet known.")), h("span", {}, L("الأشهر الثلاثة التالية لم تحدث بعد في البيانات — هذا تنبؤ حقيقي بالمستقبل.", "The next three months have not happened in the dataset — this is a genuine forward-looking prediction.")));
    const ch5 = chapter(5, L("الإعادة", "Replay"), L("قيّمت دِراية كل شهر من تاريخ هذه الشركة. انقر أي شهر لترى ما كانت ستقوله دِراية حينها، باستخدام البيانات المتاحة آنذاك فقط.", "Diraya scored every month of this company's history. Click any month to see what Diraya would have said then, using only the data available at the time."), trajectoryChart(c, r.t1.threshold, select, enabled), h("div.replay-row", {}, h("span.muted", {}, alertMonths.length ? L("أشهر التنبيه:", "Alert months:") : L("لم تُصدر دِراية أي تنبيه لهذه الشركة.", "Diraya never raised an alert for this company.")), ...alertMonths.slice(-8).map((m) => h(`button.chip-btn${m === c.month ? ".is-active" : ""}`, { disabled: !enabled(m), onclick: () => select(m) }, month(m, "short")))), outcome);
    page.append(head, ch1, ch2, ch3, ch4, ch5, brief(c, go));
}
function chapter(n, title, intro, ...body) {
    return h("section.wrap.chapter.reveal", {}, h("div.chapter-head", {}, h("span.chapter-n", {}, num(n).padStart(2, isAr() ? "٠" : "0")), h("h2", {}, title), h("p", {}, intro)), h("div.chapter-body", {}, ...body));
}
function brief(c, go) {
    const r = c.reading, cat = c.follow_up.key;
    const reasons = [
        L(`درجة ترتيب خطر التراجع ${score(r.t1.score)}: المرتبة ${num(r.t1.rank)} من ${int(r.t1.of)} شركة في ${month(c.month)} — ${r.t1.alert ? "فوق حدّ التنبيه" : "تحت حدّ التنبيه"}.`, `Deterioration ranking score ${score(r.t1.score)}: #${r.t1.rank} of ${int(r.t1.of)} companies in ${month(c.month)} — ${r.t1.alert ? "above" : "below"} the alert threshold.`),
        L(`التغيّر المتوقع في النشاط خلال ٣ أشهر: ${pct(r.t2.prediction, 0, true)} (هامش الخطأ المعتاد ±${num(r.t2.typical_error * 100, 0)} نقطة).`, `Expected activity change over the next 3 months: ${pct(r.t2.prediction, 0, true)} (typical error about ±${Math.round(r.t2.typical_error * 100)} points).`),
        r.t3.eligible
            ? L(`رُصد تراجع في النشاط هذا الشهر، وقُيّم بأنه ${r.t3.assessment === "Structural" ? "هيكلي" : "غير هيكلي"} (الدرجة ${num(r.t3.score ?? 0, 2)} مقابل حدّ ${num(r.t3.threshold, 2)}).`, `This month shows an activity dip, assessed as ${r.t3.assessment === "Structural" ? "structural" : "non-structural"} (score ${(r.t3.score ?? 0).toFixed(2)} vs threshold ${r.t3.threshold.toFixed(2)}).`)
            : L("لا يوجد تراجع في النشاط هذا الشهر، لذا لا ينطبق نموذج طبيعة التراجع.", "No activity dip this month, so the structural-decline model does not apply."),
    ];
    const signals = c.indicators.filter((x) => x.triggered).map((x) => indicatorText(x.key, x.threshold).label);
    const drivers = c.sensitivity.filter((x) => x.delta > 0.01).slice(0, 3).map((x) => signalGroup(x.signal));
    const caveat = L("مخرجات نموذج على بيانات اصطناعية. الدرجات ترتّب الشركات ولا تمثل احتمالات معايرة. التنبؤات ليست نتائج مؤكدة، والمتابعة المقترحة توجيه أولي لمدير العلاقة وليست قرارًا مصرفيًا معتمدًا.", "Model output on synthetic data. Scores rank companies; they are not calibrated probabilities. Predictions are not confirmed outcomes; suggested follow-ups are triage prompts, not verified banking decisions.");
    const text = [`${L("دِراية · موجز الإجراء", "DIRAYA · ACTION BRIEF")} — ${c.customer_id} (${month(c.month)})`,
        `${L("المتابعة المقترحة", "Suggested follow-up")}: ${category(cat)}`, "", ...reasons.map((x) => `- ${x}`), "",
        `${L("الإشارات المرصودة", "Observed signals")}: ${signals.join("، ") || L("لا توجد", "None")}`, "",
        ...actions(cat).map((x, i) => `${i + 1}. ${x}`), "", caveat].join("\n");
    const copyBtn = h("button.btn-light", { onclick: async () => {
            try {
                await navigator.clipboard.writeText(text);
                copyBtn.textContent = L("نُسخ ✓", "Copied ✓");
            }
            catch {
                copyBtn.textContent = L("تعذّر النسخ", "Copy failed");
            }
            window.setTimeout(() => { copyBtn.textContent = L("نسخ الموجز", "Copy brief"); }, 1800);
        } }, L("نسخ الموجز", "Copy brief"));
    return h("section.brief.reveal", { style: `--cat:${CATEGORY_COLOR[cat]}` }, h("div.wrap", {}, h("p.overline.light", {}, L("من الرؤية إلى الإجراء", "From insight to action")), h("div.brief-card", {}, h("div.brief-head", {}, h("div", {}, h("p.brief-kicker", {}, L(`موجز الإجراء · ${month(c.month)}`, `Action brief · ${month(c.month)}`)), h("h2.brief-id", {}, c.customer_id), h("p.brief-sub", {}, `${industry(c.profile.industry)} · ${size(c.profile.company_size)} · ${region(c.profile.region)}`)), h("div.brief-cat", {}, h("span", {}, L("المتابعة المقترحة", "Suggested follow-up")), h("strong", {}, category(cat)))), h("div.brief-grid", {}, h("div", {}, h("h3", {}, L("لماذا نبّهت دِراية", "Why Diraya flagged it")), h("ul", {}, ...reasons.map((x) => h("li", {}, x)))), h("div", {}, h("h3", {}, L("الإشارات المرصودة", "Observed signals")), signals.length ? h("ul.tags", {}, ...signals.map((x) => h("li", {}, x))) : h("p", {}, L("لا توجد إشارة مرصودة.", "No rule-based signal observed.")), h("h3", {}, L("أقوى محركات النموذج", "Strongest model drivers")), drivers.length ? h("ul.tags.soft", {}, ...drivers.map((x) => h("li", {}, x))) : h("p", {}, L("لا يوجد محرك بارز.", "None stands out."))), h("div", {}, h("h3", {}, L("الخطوات المقترحة", "Suggested next steps")), h("ol", {}, ...actions(cat).map((x) => h("li", {}, x))))), h("p.brief-caveat", {}, caveat), h("div.brief-actions", {}, copyBtn, h("button.btn-ghost", { onclick: () => window.print() }, L("طباعة", "Print")), h("button.btn-ghost", { onclick: () => go("#/platform") }, L("العودة إلى المحفظة", "Back to the portfolio"), " ", fwd())))));
}
void compact;
