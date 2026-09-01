import type { Themenstatus } from '@ostrecht/shared/lib/portal/schema.ts';

export function formatTopicStatus(status: Themenstatus): string {
  switch (status) {
    case 'geplant':
      return 'Geplant';
    case 'entwurf':
      return 'Entwurf';
    case 'im-gesetzgebungsverfahren':
      return 'Im Gesetzgebungsverfahren';
    case 'beschlossen':
      return 'Beschlossen';
    case 'in-umsetzung':
      return 'In Umsetzung';
    case 'abgeschlossen':
      return 'Abgeschlossen';
  }
}

export function getTopicStatusTone(status: Themenstatus): 'green' | 'blue' | 'amber' {
  switch (status) {
    case 'abgeschlossen':
      return 'green';
    case 'beschlossen':
    case 'in-umsetzung':
      return 'blue';
    case 'geplant':
    case 'entwurf':
    case 'im-gesetzgebungsverfahren':
      return 'amber';
  }
}
