# دِراية · DIRAYA — Brand identity

## The name

The official name is **DIRAYA | دِراية**. It replaces the earlier working names (SILA, LAMHA), which are no longer used in the interface.

**Tagline (as shown in the interface)**
- **AR:** اعرف قبل أن يبتعدوا
- **EN:** *Know Before They Leave.*

**Experience hook (Arabic-first)**
- بعض الإشارات لا تُرى. — لكن يمكن التنبؤ بها.
- *Some signals go unseen. — But they can be predicted.*

> **Availability is not verified.** Before any commercial use, run a trademark search (for example with the Saudi Authority for Intellectual Property, SAIP) and check domain availability.

## Logo — preserved

The symbol is **unchanged** from the original mark:
- Two dune ridges form the trace.
- One grain sits ahead of them as the signal.

The geometry is identical (`frontend/src/util.ts → logoMark`, `frontend/public/assets/favicon.svg`). Only the colours follow the new palette: ridges in mist or ink, and the grain in **Ember**.

**Wordmarks**
- **Arabic:** **دِراية** in **thmanyah serif display**, Bold (700), the same official Thmanyah family as the Arabic headlines.
- **English:** **DIRAYA** in Inter Display, uppercase, tracked +0.3em.
- **Lockup:** the symbol, then the lead-language wordmark, a hairline, and the second-language wordmark. Arabic leads in Arabic mode; English leads in English mode.

## Colour — "Najd at dusk, one ember"

Deep palm green replaces the usual banking navy. It is rooted in the Saudi landscape and national colour, and it feels calm and sovereign. Against it, a single vivid **Ember** is the glimpse.

| Token | Hex | Role |
|---|---|---|
| Palm Night | `#061B17` | Experience stage, action brief, trust band |
| Palm | `#0E3B32` | Platform hero bands, active navigation |
| Jade | `#2E7D67` | Balance, healthy movement |
| Limestone | `#F3EEE4` | Platform paper |
| Limestone 2 | `#EAE2D3` | Cards, quiet surfaces |
| Ink | `#0F241F` | Text on light |
| Mist | `#E9F0EA` | Text on dark |
| **Ember** | `#FF5A36` | **The signal**: alerts, priority, the logo grain, primary actions |
| Saffron | `#F3B23C` | RM check-in, expected decline |
| Rose | `#E86F8F` | Review dip |
| Dune | `#C8B489` | Monitor |
| Lilac | `#A99CF2` | Non-structural (temporary) dip |
| Mint | `#57D1A0` | Live inference indicator |

Rule: **Ember always means "look here".** It is never decoration.

## Typography

Arabic typography follows **Thmanyah (ثمانية)**; full details, licence notes and preview steps are in [TYPOGRAPHY.md](TYPOGRAPHY.md).

| Role | Arabic | English (unchanged) |
|---|---|---|
| Display: headlines, statements, big figures | **thmanyah serif display** 300–900 | **Inter Display** 300–400, tight tracking |
| Small headings | **thmanyah serif text** 700 | Inter 500 |
| Interface: navigation, buttons, descriptions, charts | **thmanyah sans** 400–700 | **Inter** 400–600 |
| Accent | — | Lora italic (taglines) |
| Wordmark «دِراية» | **thmanyah serif display** 700 | DIRAYA in Inter Display, tracked |

**Arabic rules**
- No letter-spacing.
- Display line-height 1.3–1.42; reading line-height 1.85–1.95.
- Headlines at weight 700, figures at 500, capstones at 900.
- «لا تُرى» in the opening line is set Light and faint, on purpose.

**Numbers**
- Arabic mode uses **Arabic-Indic digits** (٢٬٩٦٠ · ٤٩٪) and the **Gregorian** calendar (ديسمبر ٢٠٢٥).
- English mode uses Western digits.
- Company IDs always stay in Latin (PC00514).

**Fonts in the ZIP**
- Thmanyah is never shipped or hosted, because its licence forbids it. Each user adds their own copy (see TYPOGRAPHY.md).

## Visual language

- **Architectural composition:**
  - a 12-column grid, sometimes visible as faint vertical lines;
  - full-bleed colour bands (palm hero, night trust band, night action brief);
  - strong 2 px ink rules opening each chapter.
- **One point = one company:** the portfolio is always drawn as its real 2,960 companies. On the Experience stage they move from a calm lattice to the risk map, and then the signals ignite.
- **Progressive disclosure:** each Experience step answers one question. The Platform reveals evidence chapter by chapter.
- **Charts stay left → right in both languages,** as in Arabic financial products. All labels, tooltips and numbers follow the interface language.
- **Motion with meaning:** dots migrate, signals ignite, evidence cards arrive one by one, the three model pillars rise and the decision drops in as a capstone. Everything respects *prefers-reduced-motion*.

## KSIA inspiration — principles, not assets

The reference's quality markers translate as follows:
- **Sophisticated landscape-derived colour** → palm and limestone with an ember accent.
- **Architectural compositions** → grids, bands, pillars and capstone.
- **Confident bilingual typography** → Thmanyah and Inter.
- **Generous space** → editorial spacing throughout.
- **Immersive storytelling** → the four-scene Experience.

No KSIA logo, layout, illustration, photography or brand asset is reproduced.

## Voice

**Arabic first, never translated literally.** The voice is calm, precise and honest:
- «درجة ترتيب» (ranking score), never «احتمال» (probability).
- «متابعة مقترحة» (suggested follow-up), never «قرار» (decision).
- The data is always called «بيانات اصطناعية» (synthetic data).
