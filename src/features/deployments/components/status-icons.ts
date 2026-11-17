import type { Component } from 'svelte';
import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
import CircleXIcon from '@lucide/svelte/icons/circle-x';
import ClockIcon from '@lucide/svelte/icons/clock';
import Undo2Icon from '@lucide/svelte/icons/undo-2';
import type { DeploymentStatus } from '../types';

/** Timeline marker icon per deployment status (the label is always shown too). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STATUS_ICONS: Record<DeploymentStatus, Component<any>> = {
  successful: CircleCheckIcon,
  failed: CircleXIcon,
  rolled_back: Undo2Icon,
  pending: ClockIcon,
};
