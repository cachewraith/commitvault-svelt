import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// jsdom lacks these browser APIs used by UI primitives.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

window.scrollTo = () => {};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ProseMirror (Tiptap) measures DOM ranges when focusing/scrolling; jsdom has no layout.
const emptyRect = (): DOMRect =>
  ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
const emptyRectList = (): DOMRectList =>
  Object.assign([] as unknown as DOMRectList, { item: () => null });

if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = emptyRect;
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = emptyRectList;
if (!document.elementFromPoint) document.elementFromPoint = () => null;
