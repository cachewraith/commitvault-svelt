import { describe, expect, it } from 'vitest';
import { buildPath, compilePattern, findMatch, matchPattern, safeInternalPath, withQuery } from './match';

const table = ['/', '/notes', '/notes/new', '/notes/:noteId', '/notes/:noteId/edit', '/projects/:projectId/compare'].map(
  (path) => ({ path, compiled: compilePattern(path) }),
);

describe('matchPattern', () => {
  it('matches static paths and the root', () => {
    expect(matchPattern(compilePattern('/'), '/')).toEqual({});
    expect(matchPattern(compilePattern('/notes'), '/notes')).toEqual({});
    expect(matchPattern(compilePattern('/notes'), '/notes/')).toEqual({});
    expect(matchPattern(compilePattern('/notes'), '/commits')).toBeNull();
  });

  it('extracts and decodes params', () => {
    expect(matchPattern(compilePattern('/notes/:noteId/edit'), '/notes/abc-123/edit')).toEqual({
      noteId: 'abc-123',
    });
    expect(matchPattern(compilePattern('/tags/:name'), '/tags/hot%20fix')).toEqual({ name: 'hot fix' });
  });

  it('rejects different segment counts and malformed encodings', () => {
    expect(matchPattern(compilePattern('/notes/:noteId'), '/notes')).toBeNull();
    expect(matchPattern(compilePattern('/notes/:noteId'), '/notes/a/b')).toBeNull();
    expect(matchPattern(compilePattern('/notes/:noteId'), '/notes/%E0%A4%A')).toBeNull();
  });
});

describe('findMatch', () => {
  it('prefers static segments over params regardless of declaration order', () => {
    expect(findMatch(table, '/notes/new')?.route.path).toBe('/notes/new');
    expect(findMatch([...table].reverse(), '/notes/new')?.route.path).toBe('/notes/new');
    expect(findMatch(table, '/notes/42')).toMatchObject({
      route: { path: '/notes/:noteId' },
      params: { noteId: '42' },
    });
  });

  it('returns null when nothing matches', () => {
    expect(findMatch(table, '/nope')).toBeNull();
    expect(findMatch(table, '/projects/1')).toBeNull();
  });
});

describe('buildPath / withQuery', () => {
  it('fills and encodes params', () => {
    expect(buildPath('/projects/:projectId/compare', { projectId: 'a b' })).toBe('/projects/a%20b/compare');
    expect(buildPath('/', {})).toBe('/');
  });

  it('throws on missing params', () => {
    expect(() => buildPath('/notes/:noteId', { noteId: '' })).toThrow(/noteId/);
  });

  it('appends only meaningful query values', () => {
    expect(withQuery('/commits', { page: 2, search: '', branch: undefined, deployed: false })).toBe(
      '/commits?page=2&deployed=false',
    );
    expect(withQuery('/commits')).toBe('/commits');
    expect(withQuery('/commits', {})).toBe('/commits');
  });
});

describe('safeInternalPath', () => {
  it('accepts same-origin absolute paths', () => {
    expect(safeInternalPath('/notes/1?tab=a')).toBe('/notes/1?tab=a');
  });

  it('rejects external, protocol-relative, API and empty targets', () => {
    expect(safeInternalPath('https://evil.example')).toBe('/');
    expect(safeInternalPath('//evil.example')).toBe('/');
    expect(safeInternalPath('/\\evil.example')).toBe('/');
    expect(safeInternalPath('javascript:alert(1)')).toBe('/');
    expect(safeInternalPath('/api/v1/auth/logout')).toBe('/');
    expect(safeInternalPath(null, '/home')).toBe('/home');
  });
});
