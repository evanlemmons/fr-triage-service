import { describe, it, expect } from 'vitest';
import { normalizeNotionId, validateIds, mergeRelationIds } from '../../../src/validation/ids.js';

describe('normalizeNotionId', () => {
  it('normalizes a standard UUID', () => {
    expect(normalizeNotionId('8f51014d-9759-4e7a-b1e8-b622194cecf3'))
      .toBe('8f51014d-9759-4e7a-b1e8-b622194cecf3');
  });

  it('normalizes uppercase UUID to lowercase', () => {
    expect(normalizeNotionId('8F51014D-9759-4E7A-B1E8-B622194CECF3'))
      .toBe('8f51014d-9759-4e7a-b1e8-b622194cecf3');
  });

  it('normalizes 32-char hex to UUID format', () => {
    expect(normalizeNotionId('8f51014d97594e7ab1e8b622194cecf3'))
      .toBe('8f51014d-9759-4e7a-b1e8-b622194cecf3');
  });

  it('returns null for invalid formats', () => {
    expect(normalizeNotionId('not-a-uuid')).toBeNull();
    expect(normalizeNotionId('')).toBeNull();
    expect(normalizeNotionId('12345')).toBeNull();
  });

  it('handles trimming whitespace', () => {
    expect(normalizeNotionId('  8f51014d-9759-4e7a-b1e8-b622194cecf3  '))
      .toBe('8f51014d-9759-4e7a-b1e8-b622194cecf3');
  });
});

describe('validateIds', () => {
  const validIds = [
    '8f51014d-9759-4e7a-b1e8-b622194cecf3',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  ];

  it('accepts valid IDs that exist in the set', () => {
    const result = validateIds(
      ['8f51014d-9759-4e7a-b1e8-b622194cecf3'],
      validIds,
    );
    expect(result.valid).toEqual(['8f51014d-9759-4e7a-b1e8-b622194cecf3']);
    expect(result.invalid).toEqual([]);
  });

  it('rejects IDs not in the valid set (hallucinated)', () => {
    const result = validateIds(
      ['11111111-2222-3333-4444-555555555555'],
      validIds,
    );
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['11111111-2222-3333-4444-555555555555']);
  });

  it('normalizes IDs before comparison', () => {
    const result = validateIds(
      ['8f51014d97594e7ab1e8b622194cecf3'], // 32-char hex
      validIds,
    );
    expect(result.valid).toEqual(['8f51014d-9759-4e7a-b1e8-b622194cecf3']);
  });

  it('deduplicates proposed IDs', () => {
    const result = validateIds(
      [
        '8f51014d-9759-4e7a-b1e8-b622194cecf3',
        '8f51014d-9759-4e7a-b1e8-b622194cecf3',
      ],
      validIds,
    );
    expect(result.valid).toHaveLength(1);
  });

  it('handles empty inputs', () => {
    const result = validateIds([], validIds);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it('rejects malformed IDs', () => {
    const result = validateIds(['not-a-uuid', ''], validIds);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['not-a-uuid', '']);
  });
});

describe('mergeRelationIds', () => {
  it('merges existing and new IDs', () => {
    const result = mergeRelationIds(
      ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
      ['8f51014d-9759-4e7a-b1e8-b622194cecf3'],
    );
    expect(result).toEqual([
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '8f51014d-9759-4e7a-b1e8-b622194cecf3',
    ]);
  });

  it('deduplicates across existing and new', () => {
    const result = mergeRelationIds(
      ['8f51014d-9759-4e7a-b1e8-b622194cecf3'],
      ['8f51014d-9759-4e7a-b1e8-b622194cecf3'],
    );
    expect(result).toHaveLength(1);
  });

  it('preserves order: existing first, then new', () => {
    const result = mergeRelationIds(
      ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
      ['11111111-2222-3333-4444-555555555555'],
    );
    expect(result[0]).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result[1]).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('handles empty arrays', () => {
    expect(mergeRelationIds([], [])).toEqual([]);
    expect(mergeRelationIds(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'], [])).toHaveLength(1);
    expect(mergeRelationIds([], ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'])).toHaveLength(1);
  });
});
