import { api } from '$lib/api/client';
import type { Dashboard } from './types';

export const dashboardApi = {
  /** Totals, recent activity and the latest recorded deployment per environment — all live data. */
  get: (signal?: AbortSignal) => api.get<Dashboard>('/dashboard', { signal }),
};
