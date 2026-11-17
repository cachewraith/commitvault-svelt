import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

export type Dashboard = Schemas['DashboardResponse'];
export type DashboardTotals = Schemas['DashboardTotals'];
export type ProjectActivity = Schemas['ProjectActivity'];
/** Deployment records of one UTC day, by status. */
export type DailyDeployments = Schemas['DailyDeployments'];
