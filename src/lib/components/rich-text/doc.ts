/** Helpers for Tiptap JSON documents. No Tiptap imports — safe for the main bundle. */
import { EMPTY_DOC, type RichTextDoc, type RichTextMark, type RichTextNode } from '$lib/types';
import { isAllowedImageSrc, isAllowedLinkHref, MARK_TYPES, NODE_TYPES } from './schema';

const ALLOWED_NODES: ReadonlySet<string> = new Set(NODE_TYPES);
const ALLOWED_MARKS: ReadonlySet<string> = new Set(MARK_TYPES);

/** Coerce unknown input (API payload, null) into a document the editor accepts. */
export function toDoc(value: unknown): RichTextDoc {
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as RichTextNode).type === 'doc' &&
    Array.isArray((value as RichTextNode).content)
  ) {
    return value as RichTextDoc;
  }
  return structuredClone(EMPTY_DOC);
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'tableRow',
  'horizontalRule',
]);

/** Plain text of a document (for excerpts, emptiness checks, word counts). */
export function docToPlainText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (node: RichTextNode | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.text === 'string') parts.push(node.text);
    if (node.type === 'hardBreak') parts.push('\n');
    if (Array.isArray(node.content)) node.content.forEach(walk);
    if (BLOCK_TYPES.has(node.type) || node.type === 'tableCell' || node.type === 'tableHeader') {
      parts.push('\n');
    }
  };
  walk(doc as RichTextNode);
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** True when the document has no text and no media/structure worth saving. */
export function isEmptyDoc(doc: unknown): boolean {
  if (docToPlainText(doc) !== '') return false;
  let hasContent = false;
  const walk = (node: RichTextNode | undefined) => {
    if (!node || typeof node !== 'object' || hasContent) return;
    if (node.type === 'image' || node.type === 'horizontalRule' || node.type === 'table') {
      hasContent = true;
      return;
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc as RichTextNode);
  return !hasContent;
}

function sanitizeMarks(marks: RichTextMark[] | undefined): RichTextMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const kept = marks.filter((mark) => {
    if (!mark || typeof mark !== 'object' || !ALLOWED_MARKS.has(mark.type)) return false;
    if (mark.type === 'link') return isAllowedLinkHref(mark.attrs?.href as string | undefined);
    return true;
  });
  return kept.length > 0 ? kept : undefined;
}

function sanitizeNode(node: RichTextNode): RichTextNode | null {
  if (!node || typeof node !== 'object' || !ALLOWED_NODES.has(node.type)) return null;
  if (node.type === 'image' && !isAllowedImageSrc(node.attrs?.src as string | undefined)) return null;

  const result: RichTextNode = { type: node.type };
  if (node.attrs && typeof node.attrs === 'object') result.attrs = node.attrs;
  if (typeof node.text === 'string') result.text = node.text;
  const marks = sanitizeMarks(node.marks);
  if (marks) result.marks = marks;
  if (Array.isArray(node.content)) {
    result.content = node.content
      .map(sanitizeNode)
      .filter((child): child is RichTextNode => child !== null);
  }
  return result;
}

/**
 * Defensive client-side pass before a document reaches Tiptap: drops node and
 * mark types outside the allowlist, links with disallowed schemes and images
 * with disallowed sources. The backend enforces the same rules on write; this
 * keeps the viewer/editor robust (Tiptap discards a whole document that
 * contains a single unknown node type).
 */
export function sanitizeDoc(value: unknown): RichTextDoc {
  const doc = toDoc(value);
  const sanitized = sanitizeNode(doc);
  if (!sanitized || !sanitized.content || sanitized.content.length === 0) {
    return structuredClone(EMPTY_DOC);
  }
  return sanitized as RichTextDoc;
}
