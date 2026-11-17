import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { RichTextDoc } from '$lib/types';
import { docToPlainText, isEmptyDoc, sanitizeDoc, toDoc } from './doc';
import {
  CODE_LANGUAGES,
  isAllowedImageSrc,
  isAllowedLinkHref,
  LINK_REL,
  MARK_TYPES,
  NODE_TYPES,
  normaliseCodeLanguage,
  normaliseLinkHref,
} from './schema';
import ViewerImpl from './ViewerImpl.svelte';

describe('URL allowlists', () => {
  it('allows only http, https and mailto links', () => {
    expect(isAllowedLinkHref('https://example.com/a?b=c')).toBe(true);
    expect(isAllowedLinkHref('http://localhost:3000')).toBe(true);
    expect(isAllowedLinkHref('mailto:ops@example.com')).toBe(true);
    expect(isAllowedLinkHref('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkHref(' JaVaScRiPt:alert(1)')).toBe(false);
    expect(isAllowedLinkHref('data:text/html;base64,AAAA')).toBe(false);
    expect(isAllowedLinkHref('vbscript:x')).toBe(false);
    expect(isAllowedLinkHref('/relative')).toBe(false);
    expect(isAllowedLinkHref(null)).toBe(false);
  });

  it('allows only http and https images', () => {
    expect(isAllowedImageSrc('https://example.com/a.png')).toBe(true);
    expect(isAllowedImageSrc('data:image/png;base64,AAAA')).toBe(false);
    expect(isAllowedImageSrc('blob:https://example.com/1')).toBe(false);
    expect(isAllowedImageSrc('mailto:a@b.c')).toBe(false);
    expect(isAllowedImageSrc('a.png')).toBe(false);
  });

  it('normalises typed link targets', () => {
    expect(normaliseLinkHref('example.com/docs')).toBe('https://example.com/docs');
    expect(normaliseLinkHref(' https://example.com ')).toBe('https://example.com');
    expect(normaliseLinkHref('ops@example.com')).toBe('mailto:ops@example.com');
    expect(normaliseLinkHref('javascript:alert(1)')).toBeNull();
    expect(normaliseLinkHref('ftp://example.com')).toBeNull();
    expect(normaliseLinkHref('not a url')).toBeNull();
    expect(normaliseLinkHref('')).toBeNull();
  });

  it('maps code language aliases to the curated set', () => {
    expect(normaliseCodeLanguage('ts')).toBe('typescript');
    expect(normaliseCodeLanguage('RUST')).toBe('rust');
    expect(normaliseCodeLanguage('yml')).toBe('yaml');
    expect(normaliseCodeLanguage('brainfuck')).toBeNull();
    expect(normaliseCodeLanguage(null)).toBeNull();
    expect(new Set(CODE_LANGUAGES.map((l) => l.id)).size).toBe(CODE_LANGUAGES.length);
  });
});

describe('document helpers', () => {
  const doc: RichTextDoc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollback' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Run ' },
          { type: 'text', text: 'make rollback', marks: [{ type: 'code' }] },
        ],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Notify team' }] }],
          },
        ],
      },
    ],
  };

  it('extracts plain text', () => {
    expect(docToPlainText(doc)).toBe('Rollback\nRun make rollback\nNotify team');
    expect(docToPlainText(null)).toBe('');
  });

  it('detects empty documents', () => {
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(isEmptyDoc(doc)).toBe(false);
    expect(
      isEmptyDoc({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/a.png' } }] }),
    ).toBe(false);
  });

  it('coerces invalid input to an empty document', () => {
    expect(toDoc(undefined)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(toDoc('<p>html</p>')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(toDoc(doc)).toBe(doc);
  });
});

describe('sanitizeDoc', () => {
  it('drops unknown nodes and marks, unsafe links and unsafe images', () => {
    const dirty = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'bold' }] },
            { type: 'text', text: 'b', marks: [{ type: 'highlight' }] },
            { type: 'text', text: 'c', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
          ],
        },
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
        { type: 'image', attrs: { src: 'data:image/svg+xml;base64,AAAA' } },
        { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'diagram' } },
        { type: 'bulletList', content: [{ type: 'video' }, { type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ],
    };

    expect(sanitizeDoc(dirty)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'b' },
            { type: 'text', text: 'c', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
          ],
        },
        { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'diagram' } },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ],
    });
  });

  it('returns an empty document for unusable input', () => {
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(sanitizeDoc(null)).toEqual(empty);
    expect(sanitizeDoc({ type: 'doc', content: [{ type: 'script' }] })).toEqual(empty);
    expect(sanitizeDoc({ type: 'paragraph' })).toEqual(empty);
  });
});

describe('RichTextViewer (Tiptap schema)', () => {
  it('enables exactly the documented node and mark types', async () => {
    const { Editor } = await import('@tiptap/core');
    const { createExtensions } = await import('./extensions');
    const editor = new Editor({ extensions: createExtensions({ readonly: true }), editable: false });

    expect(Object.keys(editor.schema.nodes).sort()).toEqual([...NODE_TYPES].sort());
    expect(Object.keys(editor.schema.marks).sort()).toEqual([...MARK_TYPES].sort());
    expect(Object.keys(editor.schema.marks.link!.spec.attrs ?? {}).sort()).toEqual(['href', 'rel', 'target']);
    expect(Object.keys(editor.schema.nodes.image!.spec.attrs ?? {}).sort()).toEqual(['alt', 'src', 'title']);
    expect(Object.keys(editor.schema.nodes.codeBlock!.spec.attrs ?? {})).toEqual(['language']);
    expect(Object.keys(editor.schema.nodes.heading!.spec.attrs ?? {})).toEqual(['level']);
    expect(Object.keys(editor.schema.nodes.taskItem!.spec.attrs ?? {})).toEqual(['checked']);
    expect(Object.keys(editor.schema.nodes.tableCell!.spec.attrs ?? {}).sort()).toEqual([
      'align',
      'colspan',
      'colwidth',
      'rowspan',
    ]);
    editor.destroy();
  });

  it('renders formatted content with safe link attributes', async () => {
    const value: RichTextDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deploy steps' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See the ' },
            {
              type: 'text',
              text: 'runbook',
              marks: [{ type: 'link', attrs: { href: 'https://example.com/runbook' } }],
            },
          ],
        },
        { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'make deploy' }] },
      ],
    };
    const { container } = render(ViewerImpl, { value });

    await waitFor(() => expect(container.querySelector('h2')).toHaveTextContent('Deploy steps'));
    const link = container.querySelector('a')!;
    expect(link).toHaveAttribute('href', 'https://example.com/runbook');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', LINK_REL);
    expect(container.querySelector('pre code')).toHaveTextContent('make deploy');
    expect(container.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it('neutralises script URLs and drops unknown nodes', async () => {
    const value = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click me',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(document.cookie)' } }],
            },
          ],
        },
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    } as RichTextDoc;
    const { container } = render(ViewerImpl, { value });

    await waitFor(() => expect(container).toHaveTextContent('click me'));
    expect(container).toHaveTextContent('after');
    expect(container.querySelector('a')).toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:/i);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('shows the empty text for empty documents', () => {
    const { getByText } = render(ViewerImpl, { value: null, emptyText: 'No notes yet.' });
    expect(getByText('No notes yet.')).toBeInTheDocument();
  });
});
