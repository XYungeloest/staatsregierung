import timelineData from '../../../../../content/dashboard/timeline.json' with { type: 'json' };
import { parseTimelineData } from '@ostrecht/shared/lib/portal/dashboard-content.ts';

export const timelineEntries = parseTimelineData(timelineData);
