import actionPlanData from '../../../../../content/dashboard/action-plan.json' with { type: 'json' };
import { parseActionPlanData } from '@ostrecht/shared/lib/portal/dashboard-content.ts';

export const actionPlanItems = parseActionPlanData(actionPlanData);
