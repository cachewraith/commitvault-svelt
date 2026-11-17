import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DOC, type RichTextDoc } from '$lib/types';
import { diffDraft, NoteAutosave, type NoteDraft } from '../autosave.svelte';
import type { UpdateNoteInput } from '../types';

const doc = (text: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function baseDraft(overrides: Partial<NoteDraft> = {}): NoteDraft {
  return {
    title: 'Deploy runbook',
    project_id: null,
    category: 'Runbooks',
    is_pinned: false,
    tag_ids: ['t1'],
    content_json: EMPTY_DOC,
    ...overrides,
  };
}

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(delay = 1000) {
  const baseline = baseDraft();
  const state = { draft: { ...baseline } };
  const calls: UpdateNoteInput[] = [];
  const pending: ReturnType<typeof deferred<string>>[] = [];
  const save = vi.fn((patch: UpdateNoteInput) => {
    calls.push(patch);
    const next = deferred<string>();
    pending.push(next);
    return next.promise;
  });
  const onsaved = vi.fn();
  const autosave = new NoteAutosave<string>({ baseline, read: () => state.draft, save, onsaved, delay });
  const edit = (changes: Partial<NoteDraft>) => {
    state.draft = { ...state.draft, ...changes };
    autosave.touch();
  };
  return { autosave, state, calls, pending, save, onsaved, edit };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('diffDraft', () => {
  it('returns only the fields that changed, in API form', () => {
    const base = baseDraft();
    expect(diffDraft(base, base)).toEqual({});
    expect(diffDraft(base, { ...base, title: '  New title ' })).toEqual({ title: 'New title' });
    expect(diffDraft(base, { ...base, category: '   ' })).toEqual({ category: null });
    expect(diffDraft(base, { ...base, project_id: 'p1', is_pinned: true })).toEqual({
      project_id: 'p1',
      is_pinned: true,
    });
    const content = doc('hello');
    expect(diffDraft(base, { ...base, content_json: content })).toEqual({ content_json: content });
  });

  it('ignores whitespace-only title edits and tag reordering', () => {
    const base = baseDraft({ tag_ids: ['a', 'b'] });
    expect(diffDraft(base, { ...base, title: 'Deploy runbook  ', tag_ids: ['b', 'a'] })).toEqual({});
    expect(diffDraft(base, { ...base, tag_ids: ['a'] })).toEqual({ tag_ids: ['a'] });
  });
});

describe('NoteAutosave', () => {
  it('debounces: one request, one second after the last change, with only changed fields', async () => {
    const { autosave, calls, pending, edit } = setup();
    expect(autosave.status).toBe('saved');

    edit({ title: 'Deploy r' });
    expect(autosave.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(600);
    edit({ title: 'Deploy runbook v2' });
    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(400);
    expect(calls).toEqual([{ title: 'Deploy runbook v2' }]);
    expect(autosave.status).toBe('saving');

    pending[0]!.resolve('ok');
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.status).toBe('saved');
    expect(autosave.savedAt).toBeInstanceOf(Date);
    expect(autosave.busy).toBe(false);
  });

  it('does not send anything when a change is reverted before the debounce fires', async () => {
    const { autosave, calls, edit } = setup();
    edit({ title: 'Something else' });
    edit({ title: 'Deploy runbook' });
    expect(autosave.status).toBe('saved');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(0);
  });

  it('pauses instead of sending an empty title, and resumes when it is fixed', async () => {
    const { autosave, calls, edit } = setup();
    const content = doc('typed while the title is empty');
    edit({ title: '   ', content_json: content });
    expect(autosave.status).toBe('invalid');
    await vi.advanceTimersByTimeAsync(5000);
    await autosave.flush();
    expect(calls).toHaveLength(0);
    expect(autosave.status).toBe('invalid');

    edit({ title: 'Fixed' });
    expect(autosave.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual([{ title: 'Fixed', content_json: content }]);
  });

  it('keeps the changes after a failure and sends them again on retry', async () => {
    const { autosave, calls, pending, edit, onsaved } = setup();
    const content = doc('important');
    edit({ content_json: content });
    await vi.advanceTimersByTimeAsync(1000);

    const failure = new Error('network down');
    pending[0]!.reject(failure);
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.status).toBe('error');
    expect(autosave.error).toBe(failure);
    expect(autosave.busy).toBe(true);
    expect(onsaved).not.toHaveBeenCalled();

    const retry = autosave.retry();
    expect(autosave.status).toBe('saving');
    expect(calls).toEqual([{ content_json: content }, { content_json: content }]);
    pending[1]!.resolve('ok');
    await retry;
    expect(autosave.status).toBe('saved');
    expect(autosave.error).toBeNull();
    expect(onsaved).toHaveBeenCalledWith('ok', { content_json: content });
  });

  it('keeps showing the failure while the user types on, then retries with the newest state', async () => {
    const { autosave, calls, pending, edit } = setup();
    edit({ title: 'One' });
    await vi.advanceTimersByTimeAsync(1000);
    pending[0]!.reject(new Error('boom'));
    await vi.advanceTimersByTimeAsync(0);

    edit({ title: 'Two' });
    expect(autosave.status).toBe('error');
    await vi.advanceTimersByTimeAsync(1000);
    expect(autosave.status).toBe('saving');
    expect(calls[1]).toEqual({ title: 'Two' });
  });

  it('serialises saves: edits made during a request go out afterwards, and a slow response cannot overwrite them', async () => {
    const { autosave, state, calls, pending, edit } = setup();
    const first = doc('first');
    const second = doc('second, typed while saving');

    edit({ content_json: first });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual([{ content_json: first }]);

    // The user keeps typing while request #1 is in flight.
    edit({ content_json: second });
    expect(autosave.status).toBe('saving');
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toHaveLength(1); // never two requests at once

    // Request #1 finally answers (with the older content).
    pending[0]!.resolve('stale response');
    await vi.advanceTimersByTimeAsync(0);
    expect(state.draft.content_json).toBe(second); // local state untouched
    expect(autosave.status).not.toBe('saved'); // the newer edit is still pending
    expect(autosave.busy).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual([{ content_json: first }, { content_json: second }]);
    pending[1]!.resolve('ok');
    await vi.advanceTimersByTimeAsync(0);
    expect(autosave.status).toBe('saved');
  });

  it('flush saves immediately without waiting for the debounce', async () => {
    const { autosave, calls, pending, edit } = setup();
    edit({ is_pinned: true });
    const flushed = autosave.flush();
    expect(calls).toEqual([{ is_pinned: true }]);
    pending[0]!.resolve('ok');
    await flushed;
    expect(autosave.status).toBe('saved');
    // The cancelled debounce must not fire a second request.
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
  });

  it('flushValid saves everything except fields the server would reject', async () => {
    const { autosave, calls, edit } = setup();
    const content = doc('do not lose this');
    edit({ title: '', content_json: content, category: 'x'.repeat(61) });
    expect(autosave.status).toBe('invalid');

    void autosave.flushValid();
    expect(calls).toEqual([{ content_json: content }]);
  });

  it('stops scheduling after dispose', async () => {
    const { autosave, calls, edit } = setup();
    edit({ title: 'Changed' });
    autosave.dispose();
    edit({ title: 'Changed again' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(0);
  });
});
