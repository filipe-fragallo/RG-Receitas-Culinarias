const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function formatDate(value: string | null | undefined, long = false): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return (long ? longDateFormatter : dateFormatter).format(date).replace('.', '');
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) {
    return 'Tempo não informado';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining === 0 ? `${hours} h` : `${hours} h ${remaining} min`;
}

export function formatPortions(portions: number | null | undefined): string {
  if (portions === null || portions === undefined) {
    return 'Porções não informadas';
  }

  return portions === 1 ? '1 porção' : `${portions} porções`;
}

export function getFirstName(name: string | null | undefined): string {
  const value = name?.trim();

  if (!value) {
    return '';
  }

  return value.split(/\s+/)[0];
}

export function getInitials(name: string | null | undefined, login: string): string {
  const value = name?.trim();

  if (value) {
    const parts = value.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return `${first}${last}`.toUpperCase();
  }

  return login.slice(0, 2).toUpperCase();
}

export function splitLines(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
