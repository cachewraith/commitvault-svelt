import { describe, expect, it } from 'vitest';
import { validateForm } from '$lib/validators';
import { looksLikeSemver, releaseSchema } from '../validation';

const valid = {
  project_id: 'p1',
  version: ' 1.4.0 ',
  title: ' Spring release ',
  status: 'draft' as const,
  released_at: '',
  description: '   ',
};

describe('releaseSchema', () => {
  it('normalises valid input', () => {
    const result = validateForm(releaseSchema, valid);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      project_id: 'p1',
      version: '1.4.0',
      title: 'Spring release',
      status: 'draft',
      released_at: null,
      description: null,
    });
  });

  it('converts a local date-time to an ISO instant', () => {
    const result = validateForm(releaseSchema, { ...valid, released_at: '2026-03-01T10:30' });
    expect(result.ok).toBe(true);
    expect(result.data?.released_at).toBe(new Date('2026-03-01T10:30').toISOString());
  });

  it('reports each missing or oversized field', () => {
    const result = validateForm(releaseSchema, {
      ...valid,
      project_id: '',
      version: '',
      title: 'x'.repeat(201),
      released_at: 'not a date',
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({
      project_id: 'Choose a project.',
      version: 'Version is required.',
      title: 'Title must be at most 200 characters.',
      released_at: 'Enter a valid date and time.',
    });
  });

  it('accepts free-form versions (semantic versioning is not enforced)', () => {
    for (const version of ['2026.03', 'spring-drop', 'v2-beta', 'build 418']) {
      expect(validateForm(releaseSchema, { ...valid, version }).ok).toBe(true);
    }
    expect(validateForm(releaseSchema, { ...valid, version: 'x'.repeat(65) }).ok).toBe(false);
  });
});

describe('looksLikeSemver', () => {
  it('recognises semantic versions', () => {
    for (const version of ['1.4.0', 'v2.0.0', '1.0.0-rc.1', '1.0.0+build.5', ' 0.1.0 ']) {
      expect(looksLikeSemver(version), version).toBe(true);
    }
    for (const version of ['2026.03', '1.4', 'spring', '1.4.0.1', '']) {
      expect(looksLikeSemver(version), version).toBe(false);
    }
  });
});
