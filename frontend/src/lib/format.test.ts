import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatMinutes,
  formatPortions,
  getFirstName,
  getInitials,
  pluralize,
  splitLines,
} from './format';

describe('format', () => {
  it('formats valid dates and handles missing values', () => {
    expect(formatDate('2026-01-15T12:00:00.000Z')).toContain('2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('data-invalida')).toBe('—');
  });

  it('formats minutes into hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(90)).toBe('1 h 30 min');
    expect(formatMinutes(null)).toBe('Tempo não informado');
  });

  it('formats servings in singular and plural', () => {
    expect(formatPortions(1)).toBe('1 porção');
    expect(formatPortions(8)).toBe('8 porções');
    expect(formatPortions(undefined)).toBe('Porções não informadas');
  });

  it('splits ingredients into non-empty lines', () => {
    expect(splitLines('3 cenouras\n\n 3 ovos \r\n2 xícaras')).toEqual([
      '3 cenouras',
      '3 ovos',
      '2 xícaras',
    ]);
    expect(splitLines(null)).toEqual([]);
  });

  it('extracts the first name and initials', () => {
    expect(getFirstName('  Maria Silva  ')).toBe('Maria');
    expect(getFirstName(null)).toBe('');
    expect(getInitials('Maria Silva', 'maria.silva')).toBe('MS');
    expect(getInitials(null, 'maria.silva')).toBe('MA');
  });

  it('pluralizes according to the quantity', () => {
    expect(pluralize(1, 'receita', 'receitas')).toBe('receita');
    expect(pluralize(2, 'receita', 'receitas')).toBe('receitas');
  });
});
