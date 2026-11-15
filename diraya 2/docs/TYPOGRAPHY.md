# Arabic typography: Thmanyah (ثمانية)

The whole Arabic interface uses the **official Thmanyah fonts**. English is unchanged (Inter, Inter Display, Lora).

| Thmanyah family (exact internal name) | Used for |
|---|---|
| `thmanyah serif display` | The «دِراية» wordmark (Bold 700, in both languages), headlines, the Experience statements, hero sections, big figures (KPIs, scores), chapter titles, the follow-up capstone |
| `thmanyah serif text` | Small headings (17–24 px): signal names, model answers, method steps, table questions |
| `thmanyah sans` | Paragraphs, descriptions, navigation, buttons, labels, cards, tables, charts, the search form |

**Weights** are those of the official files:
- Light 300, Regular 400, Medium 500, Bold 700, Black 900.
- The opening line uses Bold, with «لا تُرى» in Light.
- «لكن يمكن التنبؤ بها.» uses Black.
- Figures use Medium.

**Kept outside Thmanyah on purpose**
- Symbols that Thmanyah does not contain (← → ↑ Δ ² ≈) are drawn by Inter, the site's English font. Inter has no Arabic letters, so it can never stand in for Thmanyah.

**Numbers**
- Thmanyah has no «٬» or «٫» characters, so Arabic numbers follow Thmanyah's own style guide: «١,٤٥٦,٧٣٢», with Arabic-Indic digits and the Latin comma and point.

## Setup on your Mac (once)

1. **Download the font** from https://font.thmanyah.com/: enter your email and press «تحميل الخط». The email comes from font@thmanyah.com. Save `Thmanyah-Font-Family.zip` in **Downloads**.
2. **Start Diraya:**
   ```bash
   cd diraya
   ./run.sh
   ```
   `run.sh` finds `~/Downloads/Thmanyah-Font-Family.zip` and copies the 15 official woff2 files into `fonts-local/thmanyah/`. The server then prints:
   ```
   Thmanyah fonts found (15 files): the Arabic site renders in Thmanyah.
   ```
   If the font is missing, it prints a clear `*** Thmanyah fonts NOT found …` message with the command to run. You can also run that command yourself, with the ZIP anywhere:
   ```bash
   python3 backend/scripts/add_thmanyah.py ~/path/to/Thmanyah-Font-Family.zip
   ```
3. **Open** `http://127.0.0.1:8000` in **Safari**, Chrome or Firefox.

**How it works:** the fonts are loaded as standard web fonts (`@font-face` with woff2 files), served by your local Diraya server.
- **Safari:** this works without any Font Book install. Safari ignores fonts that users install themselves, but it does load web fonts.
- **No proxies or other computers:** the server sends the font files only to a browser on the same computer, at `127.0.0.1` or `localhost` with no proxy in between. Requests from any other address get 404.

## Verify the real font is rendering

**Safari**
1. Turn on Safari → Settings → Advanced → "Show features for web developers".
2. Open the Arabic page, right-click a headline and choose **Inspect Element**.
3. In the sidebar, open **Font**. It must show **thmanyah serif display** for headlines, or **thmanyah sans** for text.

**Chrome:** right-click a headline and choose **Inspect**. Under Computed, scroll to **Rendered Fonts**; it must name a Thmanyah family.

## Licence

The licence in the official package (`LICENSE.pdf` and `ترخيص خط ثمانية.pdf`; the Arabic version prevails) **allows** using the font on your own devices and projects, including websites.

It **forbids**:
- redistributing, sharing, uploading or hosting the font;
- downloading it from anywhere but the official site;
- any setup that lets end users or third parties extract the font files, "including through web embedding".

So, in this project:
- **No Thmanyah file is included.** Not in the project ZIP, not in git (`.gitignore`) and not in the Docker image (`.dockerignore`).
- **Each person uses their own copy.** It is downloaded from the official site and kept in `fonts-local/` on their own computer.
- **The server never offers the font to another computer.**
- **Never deploy `fonts-local/`.** A public website that serves Thmanyah to visitors needs written permission from Thmanyah: Ask@thmanyah.com. Without the fonts, a deployed Diraya still works, but its Arabic text shows in the browser's default font.

This is a reading of the published terms, not legal advice.

## Verification status

The Thmanyah font files are **not** in this project (licence), and they could not be downloaded in the build environment, so the official glyphs could not be checked here. What was verified:
- The wordmark «دِراية», all Arabic headlines and the Arabic interface text request the three Thmanyah families above; no Kufi or other Arabic lookalike remains in the CSS.
- With files named exactly like the official package placed in `fonts-local/thmanyah/`, Chrome loads all three families from the local server and uses them for the wordmark, headlines and body text (checked through Chrome's own Rendered Fonts data).

**Please check once on your Mac** after `./run.sh` reports "Thmanyah fonts found (15 files)": use the Safari or Chrome steps above on the wordmark «دِراية» in the top bar and on the Experience opening screen.
