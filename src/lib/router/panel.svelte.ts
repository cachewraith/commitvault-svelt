import { compilePattern, matchPattern, type CompiledPattern } from './match';
import { router } from './router.svelte';

/**
 * App-wide slide-in panel for record details.
 *
 * The open record lives in the query string (`?panel=commit.<id>`), so a
 * panel can be linked and reloaded, and the browser's Back button closes it.
 * Once `installPanelLinks()` runs, a plain click on any link to a record's
 * page (`/commits/:id`, `/projects/:id`…) opens that record in the panel
 * instead of navigating — on every screen, without per-link wiring. Modifier
 * clicks, links inside `[data-full-page]` and links to the page already shown
 * keep their normal behaviour.
 */

const KEY = 'panel';
/** History-state marker of an entry pushed by opening the panel. */
const PANEL_STATE = 'cvDetailPanel';

export interface PanelTarget {
  type: string;
  id: string;
}

interface PanelRule {
  type: string;
  compiled: CompiledPattern;
}

let rules: PanelRule[] = [];
let hostMounted = false;

/** Record pages that open in the panel, e.g. `{ type: 'commit', path: '/commits/:id' }` (one param). */
export function registerPanelRoutes(definitions: readonly { type: string; path: string }[]): void {
  rules = definitions.map((definition) => ({ type: definition.type, compiled: compilePattern(definition.path) }));
}

/** Set by the panel host while it is mounted (signed-in layout only). */
export function setPanelHostMounted(mounted: boolean): void {
  hostMounted = mounted;
}

/** The record an in-app link points to, if that record opens in the panel. */
export function panelTargetFor(href: string | null | undefined): PanelTarget | null {
  if (!href || typeof window === 'undefined') return null;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || url.search || url.hash) return null;
  for (const rule of rules) {
    const params = matchPattern(rule.compiled, url.pathname);
    const id = params && Object.values(params)[0];
    if (id) return { type: rule.type, id };
  }
  return null;
}

function parse(raw: string | null): PanelTarget | null {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return null;
  return { type: raw.slice(0, dot), id: raw.slice(dot + 1) };
}

export const recordPanel = {
  /** The record shown in the panel, or `null` when it is closed. */
  get current(): PanelTarget | null {
    return parse(router.query.get(KEY));
  },

  /** Whether the panel shows the record behind `href`. */
  shows(href: string | null | undefined): boolean {
    const target = panelTargetFor(href);
    const current = this.current;
    return target !== null && current !== null && target.type === current.type && target.id === current.id;
  },

  open(target: PanelTarget): void {
    const params = new URLSearchParams(window.location.search);
    const wasOpen = params.has(KEY);
    params.set(KEY, `${target.type}.${target.id}`);
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    if (wasOpen) {
      // Swap the record in place, keeping whether this history entry is ours.
      router.navigate(url, { replace: true, keepScroll: true, state: window.history.state });
    } else {
      router.navigate(url, { keepScroll: true, state: { [PANEL_STATE]: true } });
    }
  },

  close(): void {
    if (!router.query.has(KEY)) return;
    // Undo our own history entry; a deep-linked panel just drops the key.
    const state = window.history.state as Record<string, unknown> | null;
    if (state?.[PANEL_STATE]) window.history.back();
    else router.setQuery({ [KEY]: null });
  },
};

/**
 * Opens the record behind `href` in the panel. Returns `false` (and does
 * nothing) when `href` is not a panel record or no panel host is mounted —
 * the caller then navigates as usual.
 */
export function openPanelFor(href: string | null | undefined): boolean {
  if (!hostMounted) return false;
  const target = panelTargetFor(href);
  if (!target) return false;
  const url = new URL(href as string, window.location.href);
  // A link to the record whose page is already shown stays a no-op link.
  if (url.pathname === window.location.pathname) return false;
  recordPanel.open(target);
  return true;
}

let installed = false;

/** Turns plain clicks on record links into panel opens (call once at start-up). */
export function installPanelLinks(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // Capture phase: runs before the router's own link handler, which then
  // sees `defaultPrevented` and leaves the click alone.
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.closest('[data-full-page]')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (openPanelFor(anchor.href)) event.preventDefault();
    },
    true,
  );
}
