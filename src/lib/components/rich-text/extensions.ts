/**
 * Tiptap extension set for CommitVault rich text.
 *
 * The enabled node/mark types and their attributes are documented as an
 * allowlist at the top of `./schema.ts`; the backend validates stored
 * documents against the same list. Do not add an extension here without
 * updating that comment and the backend validator.
 */
import type { Extensions } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { StarterKit } from '@tiptap/starter-kit';
import { lowlight } from './lowlight';
import {
  CODE_LANGUAGES,
  HEADING_LEVELS,
  isAllowedImageSrc,
  isAllowedLinkHref,
  LINK_REL,
  LINK_TARGET,
} from './schema';

const LANGUAGE_IDS = new Set<string>(CODE_LANGUAGES.map((language) => language.id));

/** Link mark restricted to http/https/mailto with constant target/rel. */
const SafeLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('href'),
      },
      target: {
        default: LINK_TARGET,
        parseHTML: () => LINK_TARGET,
      },
      rel: {
        default: LINK_REL,
        parseHTML: () => LINK_REL,
      },
    };
  },
});

/** Block image by absolute http(s) URL only: no uploads, no data: URIs, no markdown input rule. */
const SafeImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element: HTMLElement) =>
          isAllowedImageSrc(element.getAttribute('src')) ? null : false,
      },
    ];
  },
  addInputRules() {
    return [];
  },
});

/** Code block whose `language` is constrained to the curated set. */
const SafeCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const className = element.firstElementChild?.className ?? '';
          const match = /(?:^|\s)language-([\w-]+)/.exec(className);
          const language = match?.[1];
          return language && LANGUAGE_IDS.has(language) ? language : null;
        },
        rendered: false,
      },
    };
  },
});

export interface ExtensionOptions {
  /** Placeholder shown in an empty, editable document. */
  placeholder?: string;
  /** Read-only rendering (viewer): links open on click, no placeholder. */
  readonly?: boolean;
}

export function createExtensions(options: ExtensionOptions = {}): Extensions {
  const { placeholder, readonly = false } = options;

  const extensions: Extensions = [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      // Replaced below by restricted variants.
      codeBlock: false,
      link: false,
    }),
    SafeLink.configure({
      openOnClick: readonly,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      // http, https and mailto are built into linkify; `isAllowedUri` narrows to exactly those.
      HTMLAttributes: { target: LINK_TARGET, rel: LINK_REL, class: null },
      isAllowedUri: (url, context) => context.defaultValidate(url) && isAllowedLinkHref(url),
      shouldAutoLink: (url) => isAllowedLinkHref(url),
    }),
    SafeCodeBlock.configure({
      lowlight,
      defaultLanguage: null,
      enableTabIndentation: true,
      tabSize: 2,
      HTMLAttributes: { spellcheck: 'false' },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({
      table: { resizable: false },
    }),
    SafeImage.configure({ inline: false, allowBase64: false, resize: false }),
  ];

  if (!readonly) {
    extensions.push(
      Placeholder.configure({
        placeholder: placeholder ?? 'Write something…',
        showOnlyWhenEditable: true,
      }),
    );
  }

  return extensions;
}
