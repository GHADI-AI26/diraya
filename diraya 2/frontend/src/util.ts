// DOM, motion and brand helpers (no framework).

import { L } from "./i18n.js";

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

/** h("div.card#id", {attrs}, ...children) */
export function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const el = document.createElement(name || "div");
  for (const part of rest) {
    if (part.startsWith(".")) el.classList.add(part.slice(1));
    else if (part.startsWith("#")) el.id = part.slice(1);
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "html") el.innerHTML = String(value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function s(tag: string, attrs: Record<string, string | number | undefined> = {}, ...children: (Node | string)[]): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

export function clear(el: Element): void { while (el.firstChild) el.removeChild(el.firstChild); }

export const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

export function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number): (...args: T) => void {
  let t: number | undefined;
  return (...args: T) => { window.clearTimeout(t); t = window.setTimeout(() => fn(...args), ms); };
}

/** Animate a number into an element using the provided formatter. */
export function countUp(el: HTMLElement, target: number, format: (n: number) => string, duration = 1300): void {
  if (reducedMotion()) { el.textContent = format(target); return; }
  const start = performance.now();
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(target * (1 - Math.pow(1 - t, 4)));
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

let observer: IntersectionObserver | null = null;
export function observeReveals(root: ParentNode): void {
  observer ??= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-visible"); observer?.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  root.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => observer?.observe(el));
}

/** Read a CSS custom property (used by canvas drawings so they follow the theme). */
export function cssVar(el: Element, name: string, fallback = "#000"): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/** Arrow that points "forward" in the current reading direction. */
export const fwd = (): string => (document.documentElement.dir === "rtl" ? "←" : "→");
export const back = (): string => (document.documentElement.dir === "rtl" ? "→" : "←");

// ------------------------------------------------------------------ brand
/** The preserved logo symbol: two dune ridges (the trace) and one grain ahead of them (the glimpse).
 *  Geometry is unchanged from the original mark; only colours follow the new palette. */
export function logoMark(size = 28, ridge = "currentColor", grain = "#FF5A36"): SVGElement {
  return s("svg", { width: size, height: size, viewBox: "0 0 32 32", "aria-hidden": "true", class: "logo-mark" },
    s("path", { d: "M3 22 C 8 22, 9 13, 14 13 S 20 20, 24 17", fill: "none", stroke: ridge, "stroke-width": 2.2, "stroke-linecap": "round" }),
    s("path", { d: "M3 27 C 9 27, 11 20, 16 20 S 22 24, 26 22.5", fill: "none", stroke: ridge, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0.45 }),
    s("circle", { cx: 28, cy: 14.2, r: 2.4, fill: grain, class: "logo-grain" }));
}

/** Bilingual lockup: symbol · دِراية · DIRAYA (Arabic always leads in Arabic mode). */
export function wordmark(href = "#/"): HTMLElement {
  return h("a.wordmark", { href, "aria-label": L("دِراية — الصفحة الرئيسية", "Diraya — home") },
    logoMark(30),
    h("span.wm-ar", { lang: "ar" }, "دِراية"),
    h("span.wm-en", { lang: "en" }, "DIRAYA"));
}
