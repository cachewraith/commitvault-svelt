/**
 * WAI-ARIA toolbar keyboard pattern as a Svelte action: the toolbar is a single
 * tab stop; Left/Right/Home/End move between `[data-toolbar-item]` controls.
 */
export function rovingToolbar(node: HTMLElement) {
  const items = () =>
    Array.from(node.querySelectorAll<HTMLElement>('[data-toolbar-item]')).filter(
      (item) => !(item as HTMLButtonElement).disabled && !item.hidden,
    );

  function setTabStop(target: HTMLElement | undefined) {
    for (const item of node.querySelectorAll<HTMLElement>('[data-toolbar-item]')) {
      const next = item === target ? 0 : -1;
      if (item.tabIndex !== next) item.tabIndex = next;
    }
  }

  /** Keep exactly one enabled item tabbable (items come and go, or get disabled). */
  function ensureTabStop() {
    const all = items();
    const current = all.filter((item) => item.tabIndex === 0);
    if (current.length !== 1) setTabStop(current[0] ?? all[0]);
  }

  function onKeydown(event: KeyboardEvent) {
    const all = items();
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % all.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + all.length) % all.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = all.length - 1;
    if (next === null) return;

    // Native selects use arrow keys themselves; only Home/End would conflict.
    if ((document.activeElement as HTMLElement).tagName === 'SELECT' && event.key.startsWith('Arrow')) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    }

    event.preventDefault();
    const target = all[next];
    setTabStop(target);
    target?.focus();
  }

  function onFocusin(event: FocusEvent) {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-toolbar-item]');
    if (target && node.contains(target)) setTabStop(target);
  }

  const observer = new MutationObserver(ensureTabStop);
  observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  node.addEventListener('keydown', onKeydown);
  node.addEventListener('focusin', onFocusin);
  ensureTabStop();

  return {
    destroy() {
      observer.disconnect();
      node.removeEventListener('keydown', onKeydown);
      node.removeEventListener('focusin', onFocusin);
    },
  };
}
