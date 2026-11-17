/**
 * Rich-text schema constants shared by the editor, the viewer and tests.
 * This module has NO Tiptap imports, so it is safe to use from the main bundle.
 *
 * ============================================================================
 * DOCUMENT ALLOWLIST  (mirror this in the backend validator — keep in sync!)
 * ============================================================================
 *
 * Stored format: Tiptap/ProseMirror JSON, root `{ "type": "doc", "content": [...] }`.
 *
 * NODES (type → allowed attrs)
 *   doc             — (none)
 *   paragraph       — (none)
 *   text            — (none; carries `text` and optional `marks`)
 *   heading         — level: 1 | 2 | 3 | 4
 *   bulletList      — (none)
 *   orderedList     — start: integer >= 1 (default 1)
 *                     type:  null | "1" | "a" | "A" | "i" | "I" (default null)
 *   listItem        — (none)
 *   taskList        — (none)
 *   taskItem        — checked: boolean (default false)
 *   blockquote      — (none)
 *   codeBlock       — language: null | one of CODE_LANGUAGES[].id (see below)
 *   horizontalRule  — (none)
 *   hardBreak       — (none)
 *   image           — src:   string, absolute http:// or https:// URL (required)
 *                     alt:   string | null
 *                     title: string | null
 *   table           — (none)
 *   tableRow        — (none)
 *   tableHeader     — colspan: integer >= 1 (default 1)
 *                     rowspan: integer >= 1 (default 1)
 *                     colwidth: null | integer[] (default null)
 *                     align:   null | "left" | "center" | "right" (default null)
 *   tableCell       — same attrs as tableHeader
 *
 * MARKS (type → allowed attrs)
 *   bold            — (none)
 *   italic          — (none)
 *   underline       — (none)
 *   strike          — (none)
 *   code            — (none)
 *   link            — href:   string, absolute URL with scheme http:, https: or mailto: (required)
 *                     target: "_blank"                         (constant)
 *                     rel:    "noopener noreferrer nofollow"   (constant)
 *
 * Nothing else is enabled. Non-schema editor behaviours (undo/redo history,
 * drop cursor, gap cursor, trailing node, list keymap, placeholder) do not
 * appear in the stored JSON.
 * ============================================================================
 */

export const NODE_TYPES = [
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'image',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
] as const;

export const MARK_TYPES = ['bold', 'italic', 'underline', 'strike', 'code', 'link'] as const;

export const HEADING_LEVELS = [1, 2, 3, 4] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const;
export const IMAGE_PROTOCOLS = ['http:', 'https:'] as const;
export const LINK_TARGET = '_blank';
export const LINK_REL = 'noopener noreferrer nofollow';

/** Curated syntax-highlighting languages (`id` is stored in `codeBlock.attrs.language`). */
export const CODE_LANGUAGES = [
  { id: 'bash', label: 'Bash / Shell' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'css', label: 'CSS' },
  { id: 'diff', label: 'Diff' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'go', label: 'Go' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'ini', label: 'INI / TOML' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'json', label: 'JSON' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'nginx', label: 'Nginx' },
  { id: 'php', label: 'PHP' },
  { id: 'plaintext', label: 'Plain text' },
  { id: 'python', label: 'Python' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'rust', label: 'Rust' },
  { id: 'sql', label: 'SQL' },
  { id: 'swift', label: 'Swift' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'xml', label: 'HTML / XML' },
  { id: 'yaml', label: 'YAML' },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['id'];

function hasProtocol(value: string, protocols: readonly string[]): boolean {
  try {
    const url = new URL(value.trim());
    return protocols.includes(url.protocol);
  } catch {
    return false;
  }
}

/** Link hrefs must be absolute http:, https: or mailto: URLs. */
export function isAllowedLinkHref(value: string | null | undefined): boolean {
  return typeof value === 'string' && hasProtocol(value, LINK_PROTOCOLS);
}

/** Image sources must be absolute http: or https: URLs (no data:, blob:, relative). */
export function isAllowedImageSrc(value: string | null | undefined): boolean {
  return typeof value === 'string' && hasProtocol(value, IMAGE_PROTOCOLS);
}

/**
 * Normalise what a user typed into the link box: bare domains get `https://`,
 * bare email addresses get `mailto:`. Returns `null` when the result is not allowed.
 */
export function normaliseLinkHref(input: string): string | null {
  const value = input.trim();
  if (value === '') return null;
  if (isAllowedLinkHref(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // some other scheme (javascript:, data:, …)
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`;
  const candidate = `https://${value.replace(/^\/+/, '')}`;
  return isAllowedLinkHref(candidate) && /^https:\/\/[^\s/]+\.[^\s/]+/.test(candidate) ? candidate : null;
}

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  'c++': 'cpp',
  cs: 'csharp',
  docker: 'dockerfile',
  golang: 'go',
  gql: 'graphql',
  toml: 'ini',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  postgres: 'sql',
  postgresql: 'sql',
  pgsql: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  svg: 'xml',
  svelte: 'xml',
  vue: 'xml',
  yml: 'yaml',
};

const LANGUAGE_IDS: ReadonlySet<string> = new Set(CODE_LANGUAGES.map((language) => language.id));

/** Map a typed language (```` ```ts ````) to a curated id, or `null` when unknown. */
export function normaliseCodeLanguage(value: unknown): CodeLanguage | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (LANGUAGE_IDS.has(key)) return key as CodeLanguage;
  return LANGUAGE_ALIASES[key] ?? null;
}
