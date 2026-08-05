'use strict';

const { parsePagination } = require('../pagination');

describe('parsePagination', () => {
  it('applies defaults when page/limit are absent', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('computes offset from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('falls back to the default page for zero, negative, or non-integer values', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
    expect(parsePagination({ page: 'abc' }).page).toBe(1);
  });

  it('falls back to the default limit for zero, negative, or non-integer values', () => {
    expect(parsePagination({ limit: '0' }).limit).toBe(20);
    expect(parsePagination({ limit: '-1' }).limit).toBe(20);
    expect(parsePagination({ limit: 'abc' }).limit).toBe(20);
  });

  it('clamps limit to MAX_LIMIT (100) even if a client requests more', () => {
    expect(parsePagination({ limit: '99999' }).limit).toBe(100);
  });
});
