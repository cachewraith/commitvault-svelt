import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RichTextDoc } from '$lib/types';
import EditorImpl from './EditorImpl.svelte';

const value: RichTextDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Release checklist' }] }],
};

async function setup(props: Record<string, unknown> = {}) {
  const onchange = vi.fn<(doc: RichTextDoc) => void>();
  const user = userEvent.setup();
  render(EditorImpl, { value, onchange, label: 'Note content', ...props });
  const toolbar = await screen.findByRole('toolbar', { name: 'Formatting' });
  return { onchange, user, toolbar };
}

const lastDoc = (onchange: ReturnType<typeof vi.fn>) => onchange.mock.calls.at(-1)![0] as RichTextDoc;

describe('RichTextEditor', () => {
  it('renders the document in a labelled, editable surface', async () => {
    await setup();
    const surface = screen.getByRole('textbox', { name: 'Note content' });

    expect(surface).toHaveAttribute('contenteditable', 'true');
    expect(surface).toHaveAttribute('aria-multiline', 'true');
    expect(surface).toHaveTextContent('Release checklist');
  });

  it('exposes a single-tab-stop toolbar with pressed states', async () => {
    const { toolbar } = await setup();
    const items = toolbar.querySelectorAll('[data-toolbar-item]');

    expect(items.length).toBeGreaterThan(12);
    expect(Array.from(items).filter((item) => (item as HTMLElement).tabIndex === 0)).toHaveLength(1);
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Inline code', 'Bullet list', 'Numbered list', 'Checklist', 'Quote', 'Code block']) {
      expect(within(toolbar).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('moves between toolbar items with the arrow keys', async () => {
    const { toolbar, user } = await setup();
    const undo = within(toolbar).getByRole('button', { name: 'Undo' });
    const bold = within(toolbar).getByRole('button', { name: 'Bold' });

    bold.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(toolbar).getByRole('button', { name: 'Italic' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(within(toolbar).getByRole('button', { name: 'Insert table' })).toHaveFocus();
    await user.keyboard('{Home}');
    // Undo is disabled initially, so the first enabled item is the text-style select.
    expect(undo).toBeDisabled();
    expect(within(toolbar).getByLabelText('Text style')).toHaveFocus();
  });

  it('applies block formatting and emits the JSON document', async () => {
    const { toolbar, user, onchange } = await setup();

    await user.click(within(toolbar).getByRole('button', { name: 'Checklist' }));

    await waitFor(() => expect(onchange).toHaveBeenCalled());
    const doc = lastDoc(onchange);
    expect(doc.type).toBe('doc');
    expect(doc.content?.[0]?.type).toBe('taskList');
    expect(doc.content?.[0]?.content?.[0]).toMatchObject({ type: 'taskItem', attrs: { checked: false } });
    expect(within(toolbar).getByRole('button', { name: 'Checklist' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes the heading level through the text-style select', async () => {
    const { toolbar, user, onchange } = await setup();

    await user.selectOptions(within(toolbar).getByLabelText('Text style'), 'Heading 2');

    await waitFor(() => expect(onchange).toHaveBeenCalled());
    expect(lastDoc(onchange).content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
  });

  it('inserts a table with a header row and offers table actions', async () => {
    const { toolbar, user, onchange } = await setup();

    await user.click(within(toolbar).getByRole('button', { name: 'Insert table' }));

    await waitFor(() => expect(onchange).toHaveBeenCalled());
    const table = lastDoc(onchange).content?.find((node) => node.type === 'table');
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    expect(table?.content?.[1]?.content?.[0]?.type).toBe('tableCell');
    expect(await within(toolbar).findByRole('button', { name: 'Table options' })).toBeInTheDocument();
  });

  it('rejects unsafe link targets', async () => {
    const { toolbar, user, onchange } = await setup();

    await user.click(within(toolbar).getByRole('button', { name: 'Link' }));
    const input = await screen.findByLabelText('Link URL');
    await user.type(input, 'javascript:alert(1)');
    // Popover content is unpositioned (hidden) in jsdom, so query by text instead of role.
    await user.click(screen.getByText('Apply'));
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(/http\(s\) URL/);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('rejects non-http image sources', async () => {
    const { toolbar, user, onchange } = await setup();

    await user.click(within(toolbar).getByRole('button', { name: 'Image' }));
    await user.type(await screen.findByLabelText('Image URL'), 'data:image/png;base64,AAAA');
    await user.click(screen.getByText('Insert image'));
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(/http:\/\/ or https:\/\//);
    expect(onchange).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Image URL'));
    await user.type(screen.getByLabelText('Image URL'), 'https://example.com/diagram.png');
    await user.type(screen.getByLabelText(/description/i), 'Architecture');
    await user.click(screen.getByText('Insert image'));

    await waitFor(() => expect(onchange).toHaveBeenCalled());
    const image = lastDoc(onchange).content?.find((node) => node.type === 'image');
    expect(image?.attrs).toEqual({ src: 'https://example.com/diagram.png', alt: 'Architecture', title: null });
  });

  it('does not report editor housekeeping as an edit', async () => {
    // A document ending in a non-paragraph block gets a trailing paragraph appended
    // by the editor itself. That must not look like a user edit (it would autosave).
    const onchange = vi.fn();
    render(EditorImpl, {
      onchange,
      label: 'Note content',
      value: {
        type: 'doc',
        content: [{ type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'make deploy' }] }],
      },
    });
    await screen.findByRole('toolbar', { name: 'Formatting' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onchange).not.toHaveBeenCalled();
  });

  it('normalises code languages typed as aliases', async () => {
    const { toolbar, user, onchange } = await setup({
      value: {
        type: 'doc',
        content: [{ type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'let a = 1' }] }],
      },
    });

    await user.click(within(toolbar).getByRole('button', { name: 'Horizontal rule' }));

    await waitFor(() => expect(onchange).toHaveBeenCalled());
    const block = lastDoc(onchange).content?.find((node) => node.type === 'codeBlock');
    expect(block?.attrs).toEqual({ language: 'typescript' });
  });

  it('becomes read-only and disables the toolbar when disabled', async () => {
    const { toolbar } = await setup({ disabled: true });

    expect(screen.getByRole('textbox', { name: 'Note content' })).toHaveAttribute('contenteditable', 'false');
    expect(within(toolbar).getByRole('button', { name: 'Bold' })).toBeDisabled();
    expect(within(toolbar).getByLabelText('Text style')).toBeDisabled();
  });
});
