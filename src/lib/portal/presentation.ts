import type { Themenstatus } from './schema.ts';

export function formatTopicStatus(status: Themenstatus): string {
  switch (status) {
    case 'umgesetzt':
      return 'Umgesetzt';
    case 'kernprojekt':
      return 'Kernprojekt';
    case 'teilweise-umgesetzt':
      return 'Teilweise umgesetzt';
    case 'sehr-weit-umgesetzt':
      return 'Sehr weit umgesetzt';
    case 'deutlich-umgesetzt':
      return 'Deutlich umgesetzt';
    case 'ausbauphase':
      return 'Ausbauphase';
    case 'laufend':
      return 'Laufend';
  }
}

export function getTopicStatusTone(status: Themenstatus): 'green' | 'blue' | 'amber' {
  switch (status) {
    case 'umgesetzt':
    case 'kernprojekt':
    case 'sehr-weit-umgesetzt':
    case 'deutlich-umgesetzt':
      return 'green';
    case 'teilweise-umgesetzt':
    case 'laufend':
      return 'blue';
    case 'ausbauphase':
      return 'amber';
  }
}
