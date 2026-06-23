import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// --- jsdom gaps the UI relies on -------------------------------------------

// IntersectionObserver — used by motion's useInView (AnimatedNumber, reveals).
if (!('IntersectionObserver' in globalThis)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}

// matchMedia — used by next-themes / sonner / reduced-motion checks.
// jsdom leaves it as an undefined property, so check for a callable, not `in`.
if (typeof window.matchMedia !== 'function') {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

// localStorage — used by Onboarding dismissal persistence.
if (!('localStorage' in globalThis) || globalThis.localStorage == null) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  vi.stubGlobal('localStorage', localStorageMock);
}

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});
