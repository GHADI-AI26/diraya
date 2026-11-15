// MODE 2 — PLATFORM · Methodology & model performance.

import { api } from "../api.js";
import { L, int, iso, num, pct } from "../i18n.js";
import { h, observeReveals } from "../util.js";
import { sectionHead } from "./portfolio.js";

export async function renderMethod(root: HTMLElement): Promise<() => void> {
  const [st, p] = await Promise.all([api.status(), api.portfolio()]);
  const t1 = p.test_metrics.target1, t2 = p.test_metrics.target2, t3 = p.test_metrics.target3;
  const step = (n: number, title: string, body: string, detail: string): HTMLElement =>
    h("article.mstep.reveal", { style: `--i:${n}` }, h("span.mstep-n", {}, num(n).padStart(2, L("٠", "0"))), h("h3", {}, title), h("p", {}, body), h("p.mstep-d", {}, detail));
  const metric = (q: string, model: string, head: string, rest: string): HTMLElement =>
    h("tr", {}, h("td.q", {}, q), h("td", {}, model), h("td.m", {}, head), h("td", {}, rest));

  root.append(
    h("section.pf-hero.method-hero", {}, h("div.wrap", {},
      h("p.overline", {}, L("المنهجية", "Methodology")),
      h("h1.pf-display", {}, L("من أثر شهري… إلى مكالمة مدير العلاقة التالية.", "From monthly traces to a relationship manager's next call.")),
      h("p.pf-lede", {}, L(`بُنيت دِراية على ${int(st.dataset.rows)} سجلًا شهريًا اصطناعيًا لـ ${int(st.dataset.customers)} شركة (يناير ٢٠٢٣ — ديسمبر ٢٠٢٥). كل رقم في هذا المنتج يصدر عن النماذج المدرّبة في لحظته.`,
        `Diraya is built on ${int(st.dataset.rows)} synthetic customer-month records for ${int(st.dataset.customers)} companies (January 2023 — December 2025). Every number in this product is produced by the trained models in real time.`)))),
    h("section.wrap.section.msteps", {},
      step(1, L("قراءة الأثر", "Read the trace"), L("التحصيلات والمدفوعات والأرصدة والمنتجات والرواتب واستخدام الائتمان والدخول الرقمي والشكاوى، شهرًا بشهر.", "Monthly collections, payments, balances, products, payroll, credit use, digital logins and complaints."),
        L("تقسيم زمني: تدريب ٢٠٢٣/٠١–٢٠٢٤/٠٦، تحقق ٢٠٢٤/١٠–٢٠٢٥/٠١، اختبار ٢٠٢٥/٠٥–٢٠٢٥/٠٩، مع فواصل أطول من أفق التسمية (٣ أشهر).", "Chronological split: train 2023-01→2024-06, validation 2024-10→2025-01, test 2025-05→2025-09, with gaps longer than the 3-month label horizon.")),
      step(2, L("بناء خصائص تاريخية", "Build history features"), L("١٧ خاصية تصف شكل العلاقة: الاتجاهات، والانخفاضات المتتالية، والتراجع عن القمة، واستقرار المنتجات.", "17 history features describe the shape of each relationship: trends, streaks, drawdowns from a recent peak, product stability."),
        L(`تُحسب من الشهر الحالي والأشهر السابقة فقط. الشيفرة نفسها في الدفتر وفي هذه الواجهة (المطابقة: ${st.feature_code_matches_notebook ? "مؤكدة" : "غير مؤكدة"}).`, `Computed from the current and previous months only. Same code in the notebook and this API (match: ${st.feature_code_matches_notebook ? "verified" : "NOT verified"}).`)),
      step(3, L("ثلاثة نماذج", "Three models"), L("تعزيز التدرج المبني على المدرجات (Histogram Gradient Boosting) لكل سؤال، اختير على بيانات التحقق مقابل خطوط أساس والانحدار اللوجستي وRidge والغابة العشوائية.", "Histogram Gradient Boosting for each question, selected on validation against baselines, Logistic Regression, Ridge and Random Forest."),
        L(`${num(st.models.target1.features)} خاصية لكل نموذج. النموذج الثالث يعمل فقط عند وجود تراجع (is_dip_month = 1).`, `${st.models.target1.features} features each. Model 3 runs only when a dip is observed (is_dip_month = 1).`)),
      step(4, L("صحة العلاقة", "Relationship health"), L("تُدمج المخرجات الثلاثة في فئة متابعة واحدة: مراجعة ذات أولوية، أو تواصل، أو مراجعة تراجع، أو متابعة، أو اعتيادي.", "The three outputs combine into one follow-up category: priority review, check-in, review dip, monitor or routine."),
        L("الحدود ثابتة من بيانات التحقق: درجة السجل رقم ٢٠٠ للتنبيه، والمئين العاشر للانخفاض المتوقع، وأفضل F1 للتراجع الهيكلي.", "Thresholds are fixed on validation: the 200th-ranked score for alerts, the 10th percentile for expected decline, best F1 for structural dips."))),
    h("section.wrap.section.reveal", {},
      sectionHead(L("نتائج الاختبار النهائية", "Final test results"), L("قيست مرة واحدة بعد اختيار النماذج", "Measured once, after model selection"), ""),
      h("table.results", {},
        h("thead", {}, h("tr", {}, h("th", {}, L("السؤال", "Question")), h("th", {}, L("النموذج", "Model")), h("th", {}, L("المقياس الرئيسي", "Headline metric")), h("th", {}, L("مقاييس داعمة", "Supporting metrics")))),
        h("tbody", {},
          metric(L("هل ستتراجع العلاقة خلال ٣ أشهر؟", "Will the relationship deteriorate in 3 months?"), "HistGradientBoostingClassifier", iso(`PR-AUC ${num(t1["PR-AUC"], 4)}`),
            L(`${iso("Precision@200")} ${pct(t1["Precision@200"], 1)} (${num(t1["Correct alerts in Top-200 (records)"])} من ٢٠٠ سجل) · ${iso("Recall@200")} ${pct(t1["Recall@200"], 1)} · العشوائي ${num(t1["Random-guess PR-AUC"], 3)} · قائمة أعلى ٥٠ الشهرية: ${iso("Precision")} ${pct(t1["Monthly top-50 list: average precision"], 1)} في المتوسط`, `Precision@200 ${pct(t1["Precision@200"], 1)} (${t1["Correct alerts in Top-200 (records)"]} of 200 records) · Recall@200 ${pct(t1["Recall@200"], 1)} · random ${t1["Random-guess PR-AUC"].toFixed(3)} · monthly Top-50 list: average precision ${pct(t1["Monthly top-50 list: average precision"], 1)}`)),
          metric(L("كم سيتغيّر النشاط؟", "How much will activity change?"), "HistGradientBoostingRegressor", iso(`MAE ${num(t2["MAE"], 4)}`), `${iso(`RMSE ${num(t2["RMSE"], 4)}`)} · ${iso(`R² ${num(t2["R2"], 3)}`)}`),
          metric(L("هل التراجع الحالي هيكلي؟", "Is the current dip structural?"), "HistGradientBoostingClassifier", iso(`PR-AUC ${num(t3["PR-AUC"], 4)}`),
            L(`${iso("Precision")} ${pct(t3["Precision"], 1)} · ${iso("Recall")} ${pct(t3["Recall"], 1)} · ${iso(`F1 ${num(t3["F1"], 3)}`)}`, `Precision ${pct(t3["Precision"], 1)} · Recall ${pct(t3["Recall"], 1)} · F1 ${t3["F1"].toFixed(3)}`)))),
      h("p.fine", {}, L("لماذا PR-AUC؟ لأن ١.٢٪ فقط من السجلات تتراجع: نموذج يقول «لا أحد سيتراجع» يكون دقيقًا بنسبة ٩٩٪ وعديم الفائدة. المهم هو جودة ترتيب الحالات النادرة في أعلى القائمة.",
        "Why PR-AUC? Only 1.2% of records deteriorate: a model that says “nobody will” is 99% accurate and useless. What matters is how well the rare cases are ranked at the top of the list."))),
    h("section.wrap.section.reveal", {},
      sectionHead(L("حدود نعلنها بوضوح", "Limits we state openly"), L("ما لا تدّعيه دِراية", "What Diraya does not claim"), ""),
      h("ul.limits", {},
        h("li", {}, h("strong", {}, L("بيانات اصطناعية. ", "Synthetic data. ")), L("لا تُستخدم أي بيانات عملاء حقيقية في هذا المنتج.", "No real customer data is used anywhere in this product.")),
        h("li", {}, h("strong", {}, L("الدرجات ترتيبية. ", "Scores are rankings. ")), L("ترتّب الشركات حسب الخطر، وليست احتمالات معايرة.", "They order companies by risk; they are not calibrated probabilities.")),
        h("li", {}, h("strong", {}, L("التنبؤات ليست نتائج. ", "Predictions are not outcomes. ")), L("المتابعة المقترحة توجيه أولي لمدير العلاقة، وليست قرارًا مصرفيًا معتمدًا.", "Suggested follow-ups are triage prompts, not verified banking decisions.")),
        h("li", {}, h("strong", {}, L("توقع النشاط تقريبي. ", "Activity forecasts are rough. ")), L(`متوسط الخطأ ±${num(t2["MAE"] * 100, 0)} نقطة؛ ${iso(`R² ${num(t2["R2"], 2)}`)}.`, `Average error ±${Math.round(t2["MAE"] * 100)} points; R² ${t2["R2"].toFixed(2)}.`)),
        h("li", {}, h("strong", {}, L("عيّنة هيكلية صغيرة. ", "Small structural sample. ")), L("نتائج النموذج الثالث مبنية على ٥٤ تراجعًا هيكليًا في التحقق و٩٨ في الاختبار.", "Model 3 results rest on 54 validation and 98 test structural dips.")),
        h("li", {}, h("strong", {}, L("عملاء معروفون. ", "Known customers. ")), L("تتنبأ النماذج بأشهر مستقبلية لشركات موجودة في المحفظة.", "The models predict future months of companies already in the portfolio.")))),
    h("section.wrap.section.reveal", {},
      sectionHead(L("منشورة كواجهة برمجية", "Deployed as an API"), L("كل شاشة تعتمد على هذه النقاط", "Every screen is backed by these endpoints"), ""),
      h("pre.code", { dir: "ltr" }, [
        "GET  /api/status                         models, bundle, dataset, feature-code check",
        "GET  /api/portfolio                      snapshot KPIs, health distribution, risk map, attention list",
        "GET  /api/companies?q=PC00               search companies",
        "GET  /api/companies/{id}?month=YYYY-MM   live inference for one company as of a month",
        "POST /api/score                          score the latest month of a supplied monthly history",
      ].join("\n")),
      h("p.fine", { dir: "ltr" }, `Bundle: ${st.bundle} · scikit-learn ${st.scikit_learn} · start-up ${st.startup_seconds}s`)));
  observeReveals(root);
  return () => undefined;
}
