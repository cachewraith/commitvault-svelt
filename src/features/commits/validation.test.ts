import { describe, expect, it } from 'vitest';
import { validateForm } from '$lib/validators';
import { commitFormSchema, normalizeHashInput } from './validation';

const valid = {
  project_id: 'p1',
  branch_id: 'b1',
  commit_hash: '9FCEB02D0AE598E95DC970B74767F19372D61AF8',
  commit_message: '  feat: add checkout flow  ',
  commit_date: '2026-03-01T10:30',
  author_name: '',
  external_url: '',
  description: '   ',
  tag_ids: [],
};

describe('commitFormSchema', () => {
  it('normalises a valid form into the API payload shape', () => {
    const result = validateForm(commitFormSchema, valid);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      project_id: 'p1',
      branch_id: 'b1',
      commit_hash: '9fceb02d0ae598e95dc970b74767f19372d61af8',
      commit_message: 'feat: add checkout flow',
      commit_date: new Date('2026-03-01T10:30').toISOString(),
      author_name: null,
      external_url: null,
      description: null,
      tag_ids: [],
    });
  });

  it('accepts 7 to 64 hexadecimal characters and nothing else', () => {
    const check = (commit_hash: string) => validateForm(commitFormSchema, { ...valid, commit_hash });
    expect(check('a1b2c3d').ok).toBe(true);
    expect(check('a'.repeat(64)).ok).toBe(true);
    expect(check('a1b2c3').errors.commit_hash).toBe('Enter 7–64 hexadecimal characters.');
    expect(check('a'.repeat(65)).errors.commit_hash).toBe('Enter 7–64 hexadecimal characters.');
    expect(check('g1b2c3d').errors.commit_hash).toBe('Enter 7–64 hexadecimal characters.');
    expect(check('').errors.commit_hash).toBe('Commit hash is required.');
  });

  it('requires a branch', () => {
    expect(validateForm(commitFormSchema, { ...valid, branch_id: '' }).errors.branch_id).toBe('Choose a branch.');
  });

  it('requires project, message and a real date, and only allows http(s) links', () => {
    const result = validateForm(commitFormSchema, {
      ...valid,
      project_id: '',
      commit_message: '   ',
      commit_date: '',
      external_url: 'javascript:alert(1)',
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({
      project_id: 'Choose a project.',
      commit_message: 'Message is required.',
      commit_date: 'Commit date is required.',
      external_url: 'Link must start with http:// or https://.',
    });
    expect(validateForm(commitFormSchema, { ...valid, commit_date: 'not-a-date' }).errors.commit_date).toBe(
      'Commit date is not a valid date and time.',
    );
  });
});

describe('normalizeHashInput', () => {
  it('strips whitespace and lower-cases pasted hashes', () => {
    expect(normalizeHashInput('  9FCEB02D0AE5\n')).toBe('9fceb02d0ae5');
    expect(normalizeHashInput('9fce b02d')).toBe('9fceb02d');
    expect(normalizeHashInput('')).toBe('');
  });
});
