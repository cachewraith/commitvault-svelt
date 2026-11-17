import { describe, expect, it } from 'vitest';
import { deleteProjectDescription, describeProjectContents } from '../queries';
import { projectCreateSchema, projectUpdateSchema } from '../validation';
import { makeProject } from './fixtures/records';

const stats = (overrides: Partial<ReturnType<typeof makeProject>['stats']>) =>
  makeProject({ stats: { ...makeProject().stats, ...overrides } });

describe('describeProjectContents', () => {
  it('returns null for an empty project', () => {
    expect(describeProjectContents(makeProject())).toBeNull();
  });

  it('lists only what exists, with correct plurals', () => {
    expect(describeProjectContents(stats({ commit_count: 1 }))).toBe('1 commit');
    expect(
      describeProjectContents(
        stats({ environment_count: 3, commit_count: 12, deployment_count: 5, release_count: 1, note_count: 2 }),
      ),
    ).toBe('3 environments, 12 commits, 5 deployment records, 1 release and 2 notes');
  });

  it('names the project and its contents in the delete confirmation', () => {
    const text = deleteProjectDescription(makeProject({ name: 'Shop', stats: { ...makeProject().stats, commit_count: 4 } }));
    expect(text).toContain('“Shop”');
    expect(text).toContain('4 commits');
    expect(text).toContain('cannot be undone');
  });
});

describe('project schemas', () => {
  const base = { name: 'Shop', description: '', repository_url: '', default_branch: 'main', tag_ids: [] };

  it('omits a blank slug on create so the server generates one', () => {
    const parsed = projectCreateSchema.parse({ ...base, slug: '  ' });
    expect(parsed.slug).toBeUndefined();
    expect(parsed.description).toBeNull();
    expect(parsed.repository_url).toBeNull();
  });

  it('lower-cases an explicit slug and rejects invalid ones', () => {
    expect(projectCreateSchema.parse({ ...base, slug: 'Web-App' }).slug).toBe('web-app');
    expect(projectCreateSchema.safeParse({ ...base, slug: 'a--b' }).success).toBe(false);
    expect(projectUpdateSchema.safeParse({ ...base, slug: '' }).success).toBe(false);
  });

  it('enforces the backend limits', () => {
    expect(projectCreateSchema.safeParse({ ...base, slug: '', name: 'x'.repeat(121) }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ ...base, slug: 'a'.repeat(141) }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ ...base, slug: '', repository_url: 'ftp://host/repo' }).success).toBe(false);
  });
});
