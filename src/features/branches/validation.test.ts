import { describe, expect, it } from 'vitest';
import { validateForm } from '$lib/validators';
import { branchFormSchema } from './validation';

describe('branchFormSchema', () => {
  it('applies the Git branch rules the backend enforces', () => {
    const check = (name: string) => validateForm(branchFormSchema, { name, description: '' });
    expect(check('main').ok).toBe(true);
    expect(check('  release/2026.03 ').data?.name).toBe('release/2026.03');
    for (const bad of ['has space', 'a..b', '/leading', 'trailing/', 'dot.', 'a~1', 'a:b']) {
      expect(check(bad).ok, bad).toBe(false);
      expect(check(bad).errors.name, bad).toBeTruthy();
    }
    expect(check('').errors.name).toBe('Branch is required.');
  });

  it('turns an empty description into null', () => {
    expect(validateForm(branchFormSchema, { name: 'main', description: '  ' }).data?.description).toBeNull();
  });
});
