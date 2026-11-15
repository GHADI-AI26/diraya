// Diraya · دِراية — bilingual system. Arabic is the default and the design starting point.
// Every user-facing string goes through L(ar, en) or one of the dictionaries below.
const stored = (() => { try {
    return localStorage.getItem("lamha-lang");
}
catch {
    return null;
} })();
const fromUrl = new URLSearchParams(window.location.search).get("lang");
let current = fromUrl === "en" || fromUrl === "ar" ? fromUrl : stored === "en" ? "en" : "ar";
const listeners = [];
export const lang = () => current;
export const isAr = () => current === "ar";
export function onLang(fn) { listeners.push(fn); }
export function applyLang() {
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    document.title = current === "ar"
        ? "دِراية · ذكاء العلاقات المصرفية للشركات"
        : "Diraya · Corporate relationship intelligence";
}
export function setLang(next) {
    if (next === current)
        return;
    current = next;
    try {
        localStorage.setItem("lamha-lang", next);
    }
    catch { /* private mode */ }
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
        url.searchParams.set("lang", next);
        history.replaceState(null, "", url.toString());
    }
    applyLang();
    listeners.forEach((fn) => fn(next));
}
/** Bidi-isolate a run (e.g. "PR-AUC 0.372") so it keeps its order inside Arabic text. */
export const iso = (text) => `\u2068${text}\u2069`;
/** Pick the string for the current language. */
export const L = (ar, en) => (current === "ar" ? ar : en);
// ------------------------------------------------------------------ numbers & dates
const locale = () => (current === "ar" ? "ar-SA-u-nu-arab" : "en-US");
/** Arabic numbers follow the Thmanyah style guide (e.g. «١,٤٥٦,٧٣٢»): Arabic-Indic digits with the Latin
 *  comma and point. Thmanyah has no «,» / «.» glyphs, so the Intl separators would fall back to another font. */
const seps = (s) => (current === "ar" ? s.replace(/\u066C/g, ",").replace(/\u066B/g, ".") : s);
export function num(n, digits = 0) {
    return seps(new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n));
}
export const int = (n) => num(Math.round(n), 0);
export function pct(v, digits = 0, signed = false) {
    if (v === null || v === undefined || Number.isNaN(v))
        return "—";
    return seps(new Intl.NumberFormat(locale(), { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits,
        signDisplay: signed ? "exceptZero" : "auto" }).format(v));
}
export const score = (v, digits = 3) => (v === null || v === undefined ? "—" : num(v, digits));
export function compact(v) {
    if (v === null || v === undefined)
        return "—";
    return seps(new Intl.NumberFormat(locale(), { notation: "compact", maximumFractionDigits: 2 }).format(v));
}
export function month(m, style = "long") {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(Date.UTC(y, mo - 1, 1));
    return new Intl.DateTimeFormat(current === "ar" ? "ar-SA-u-ca-gregory-nu-arab" : "en-US", { month: style, year: "numeric", timeZone: "UTC" }).format(d);
}
export const year = (m) => num(Number(m.slice(0, 4)), 0).replace(/[٬,]/g, "");
/** Arabic counted nouns: 1 شهر, 2 شهران, 3–10 أشهر, 11+ شهرًا */
function arCount(n, one, two, few, many) {
    const a = Math.abs(Math.round(n));
    if (a === 1)
        return one;
    if (a === 2)
        return two;
    if (a >= 3 && a <= 10)
        return `${int(a)} ${few}`;
    return `${int(a)} ${many}`;
}
export function months(n) {
    return current === "ar" ? arCount(n, "شهر واحد", "شهران", "أشهر", "شهرًا") : `${int(n)} month${Math.abs(n) === 1 ? "" : "s"}`;
}
export function companies(n) {
    return current === "ar" ? arCount(n, "شركة واحدة", "شركتان", "شركات", "شركة") : `${int(n)} compan${n === 1 ? "y" : "ies"}`;
}
// ------------------------------------------------------------------ data vocabularies
const INDUSTRY = {
    "Agriculture & Food": "الزراعة والأغذية", "Construction & Contracting": "الإنشاءات والمقاولات",
    "Healthcare": "الرعاية الصحية", "Hospitality & Tourism": "الضيافة والسياحة",
    "Information Technology": "تقنية المعلومات", "Logistics & Transport": "الخدمات اللوجستية والنقل",
    "Manufacturing": "الصناعة", "Oil & Gas Services": "خدمات النفط والغاز",
    "Professional Services": "الخدمات المهنية", "Real Estate": "العقارات", "Retail": "التجزئة",
    "Wholesale & Distribution": "الجملة والتوزيع",
};
const SIZE = { Large: "كبيرة", Medium: "متوسطة", Small: "صغيرة", Micro: "متناهية الصغر" };
const SIZE_EN = { Large: "Large", Medium: "Medium", Small: "Small", Micro: "Micro" };
const REGION = {
    "Asir": "عسير", "Eastern Province": "المنطقة الشرقية", "Madinah": "المدينة المنورة", "Makkah": "مكة المكرمة",
    "Qassim": "القصيم", "Riyadh": "الرياض", "Tabuk": "تبوك",
};
export const industry = (v) => (current === "ar" ? INDUSTRY[v] ?? v : v);
export const size = (v) => (current === "ar" ? `منشأة ${SIZE[v] ?? v}` : `${SIZE_EN[v] ?? v} company`);
export const sizeShort = (v) => (current === "ar" ? SIZE[v] ?? v : v);
export const region = (v) => (current === "ar" ? REGION[v] ?? v : v);
const SIGNAL_GROUP = {
    "Product loss": "فقدان المنتجات", "Balance erosion": "تآكل الرصيد", "Collections decline": "تراجع التحصيلات",
    "Payments & transactions": "المدفوعات والعمليات", "Service friction": "شكاوى الخدمة", "Payroll shift": "تحوّل الرواتب",
    "Credit usage": "استخدام الائتمان", "Digital engagement": "التفاعل الرقمي",
};
export const signalGroup = (v) => (current === "ar" ? SIGNAL_GROUP[v] ?? v : v);
export function split(key) {
    const map = {
        train: ["فترة التدريب — رأى النموذج نتائجها", "Training period — the model has seen these labels"],
        valid: ["فترة التحقق — استُخدمت لاختيار النموذج", "Validation period — used to choose the model"],
        test: ["فترة الاختبار — لم يرها النموذج", "Test period — unseen by the model"],
        embargo: ["فاصل زمني بين الفترات", "Gap between periods"],
        no_label_horizon: ["المستقبل لم يُرصد بعد", "Future not yet observed"],
    };
    const pair = map[key] ?? [key, key];
    return L(pair[0], pair[1]);
}
export function splitShort(key) {
    const map = {
        train: ["تدريب", "Training"], valid: ["تحقق", "Validation"], test: ["اختبار", "Test"],
        embargo: ["", ""], no_label_horizon: ["لا نتيجة بعد", "No outcome yet"],
    };
    const pair = map[key] ?? ["", ""];
    return L(pair[0], pair[1]);
}
// ------------------------------------------------------------------ follow-up categories
export const CATEGORY_COLOR = {
    priority: "#FF5A36", checkin: "#F3B23C", review_dip: "#E86F8F", monitor: "#C8B489", routine: "#B9C4BE",
};
const CATEGORY_TEXT = {
    priority: { ar: ["مراجعة ذات أولوية", "أولوية", "تنبيه تراجع مع تراجع هيكلي في الشهر نفسه."],
        en: ["Priority review", "Priority", "Deterioration alert and a structural dip in the same month."] },
    checkin: { ar: ["تواصل من مدير العلاقة", "تواصل", "تنبيه تراجع دون تراجع هيكلي."],
        en: ["RM check-in", "Check-in", "Deterioration alert without a structural dip."] },
    review_dip: { ar: ["مراجعة التراجع", "مراجعة تراجع", "تراجع هيكلي دون تنبيه تراجع."],
        en: ["Review dip", "Review dip", "Structural dip without a deterioration alert."] },
    monitor: { ar: ["متابعة", "متابعة", "لا تنبيه، لكن النموذج يتوقع انخفاضًا ملحوظًا في النشاط."],
        en: ["Monitor", "Monitor", "No alert, but the model expects a notable activity decline."] },
    routine: { ar: ["اعتيادي", "اعتيادي", "لا تنبيه ولا تراجع هيكلي ولا انخفاض ملحوظ متوقع."],
        en: ["Routine", "Routine", "No alert, no structural dip and no notable expected decline."] },
};
export const category = (k) => CATEGORY_TEXT[k][current][0];
export const categoryShort = (k) => CATEGORY_TEXT[k][current][1];
export const categoryDesc = (k) => CATEGORY_TEXT[k][current][2];
export function actions(k) {
    const ar = {
        priority: ["حدّد اجتماع مراجعة للعلاقة مع العميل خلال هذا الشهر.",
            "ناقش الإشارات المرصودة مع العميل ومختصي المنتجات.",
            "اتفق على خطة للحفاظ على العلاقة، وراجع قراءة دِراية في الشهر القادم."],
        checkin: ["تواصل مع العميل خلال الشهر للاطمئنان على العلاقة.",
            "استفسر عن التغيّرات المرصودة في النشاط والمنتجات والأرصدة.",
            "راجع قراءة دِراية في الشهر القادم."],
        review_dip: ["راجع التراجع الحالي مع العميل لمعرفة ما إذا كان مستمرًا.", "راجع قراءة دِراية في الشهر القادم."],
        monitor: ["لا حاجة للتواصل بعد — أبقِ الحساب ضمن قائمة المتابعة.", "راجع قراءة دِراية في الشهر القادم."],
        routine: ["إدارة اعتيادية للعلاقة — لا توجد متابعة محددة مقترحة."],
    };
    const en = {
        priority: ["Schedule a relationship review with the client this month.",
            "Walk through the observed signals with the client and the product specialists.",
            "Agree a retention plan and re-check Diraya's reading next month."],
        checkin: ["Contact the client within the month for a relationship check-in.",
            "Ask about the observed changes in activity, products and balances.",
            "Re-check Diraya's reading next month."],
        review_dip: ["Review the current dip with the client to understand whether it is lasting.", "Re-check Diraya's reading next month."],
        monitor: ["No contact needed yet — keep the account on the watch list.", "Re-check Diraya's reading next month."],
        routine: ["Routine relationship management — no specific follow-up suggested."],
    };
    return current === "ar" ? ar[k] : en[k];
}
export function indicatorText(key, threshold) {
    const thr = pct(threshold, 1, true);
    const t = {
        products: {
            ar: { label: "انخفاض المنتجات", window: "آخر ٦ أشهر", rule: "تُطلَق عند انخفاض عدد المنتجات", explain: "انخفض عدد المنتجات النشطة خلال الأشهر الستة الماضية." },
            en: { label: "Products dropped", window: "Last 6 months", rule: "Fires when products fall", explain: "Active products fell over the last 6 months." }
        },
        balance: {
            ar: { label: "هبوط حاد في الرصيد", window: "٣ أشهر مقابل الثلاثة السابقة", rule: `تُطلَق عند ${thr} أو أقل`, explain: "تغيّر الرصيد التشغيلي ضمن أسوأ ١٠٪ في فترة التدريب." },
            en: { label: "Balance down sharply", window: "3 months vs previous 3", rule: `Fires at ≤ ${thr}`, explain: "Operating balance change is in the worst 10% of the training period." }
        },
        collections: {
            ar: { label: "هبوط حاد في التحصيلات", window: "٣ أشهر مقابل الثلاثة السابقة", rule: `تُطلَق عند ${thr} أو أقل`, explain: "تغيّر التحصيلات الواردة ضمن أسوأ ١٠٪ في فترة التدريب." },
            en: { label: "Collections down sharply", window: "3 months vs previous 3", rule: `Fires at ≤ ${thr}`, explain: "Incoming collections change is in the worst 10% of the training period." }
        },
        trend: {
            ar: { label: "اتجاه هابط للتحصيلات", window: "اتجاه ٦ أشهر · شهريًا", rule: `تُطلَق عند ${thr} أو أقل`, explain: "اتجاه التحصيلات خلال ستة أشهر ضمن أسوأ ١٠٪ في فترة التدريب." },
            en: { label: "Collections trending down", window: "6-month trend · per month", rule: `Fires at ≤ ${thr}`, explain: "The 6-month collections trend is in the worst 10% of the training period." }
        },
        streak: {
            ar: { label: "رصيد يتناقص باستمرار", window: "أشهر متتالية", rule: "تُطلَق عند ٣ أشهر متتالية أو أكثر", explain: "انخفض الرصيد ثلاثة أشهر متتالية أو أكثر." },
            en: { label: "Balance falling", window: "Consecutive months", rule: "Fires at 3+ months in a row", explain: "The balance has fallen three or more months in a row." }
        },
        payroll: {
            ar: { label: "توقّف الرواتب", window: "هذا الشهر", rule: "تُطلَق عند توقف الرواتب", explain: "توقفت معالجة رواتب الشركة عبر البنك." },
            en: { label: "Payroll stopped", window: "This month", rule: "Fires when payroll stops", explain: "Payroll processing through the bank has stopped." }
        },
    };
    return (t[key] ?? { ar: { label: key, window: "", rule: "", explain: "" }, en: { label: key, window: "", rule: "", explain: "" } })[current];
}
/** Indicator value split into a big figure and a small unit. */
export function indicatorValue(unit, value) {
    if (value === null)
        return { figure: "—", unit: L("لا يوجد سجل كافٍ بعد", "No history yet") };
    switch (unit) {
        case "count": return value === 0
            ? { figure: L("لا تغيير", "No change"), unit: "" }
            : { figure: `${value < 0 ? "−" : "+"}${num(Math.abs(value), 0)}`, unit: L(Math.abs(value) === 1 ? "منتج" : Math.abs(value) === 2 ? "منتجان" : "منتجات", Math.abs(value) === 1 ? "product" : "products") };
        case "pct": return { figure: pct(value, 1, true), unit: "" };
        case "months": return { figure: int(value), unit: L(value >= 3 && value <= 10 ? "أشهر" : "شهر", value === 1 ? "month" : "months") };
        default: return { figure: value === 1 ? L("متوقفة", "Stopped") : L("نشطة", "Active"), unit: "" };
    }
}
// ------------------------------------------------------------------ demo companies
export function demoStops() {
    return [
        { id: "PC00514", role: L("التحقيق", "Investigation"), why: L("خمس من ست إشارات تحذير ظاهرة في تاريخها.", "Five of six warning signals are visible in its history.") },
        { id: "PC01474", role: L("رأس القائمة", "Top of the list"), why: L("أعلى درجة ترتيب لخطر التراجع في ديسمبر ٢٠٢٥.", "Highest deterioration ranking score in December 2025.") },
        { id: "PC01857", role: L("الإعادة", "Replay"), why: L("نُبّه عليها في مايو ٢٠٢٥ — شهر اختبار لم يره النموذج — وسجّلت البيانات تراجعًا خلال ثلاثة أشهر.", "Alerted in May 2025, a test month the model never saw; the dataset records a deterioration within 3 months.") },
        { id: "PC01232", role: L("تراجع غير هيكلي", "Non-structural dip"), why: L("عليها تنبيه، لكن تراجعها الحالي مُقيَّم بأنه غير هيكلي.", "Alerted, but its current dip is assessed as non-structural.") },
    ];
}
