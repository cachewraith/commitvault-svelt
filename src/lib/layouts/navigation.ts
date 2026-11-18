import type { Component } from 'svelte';
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import FolderGitIcon from '@lucide/svelte/icons/folder-git-2';
import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range';
import RocketIcon from '@lucide/svelte/icons/rocket';
import ServerIcon from '@lucide/svelte/icons/server';
import PackageIcon from '@lucide/svelte/icons/package';
import NotebookIcon from '@lucide/svelte/icons/notebook-text';
import TagsIcon from '@lucide/svelte/icons/tags';
import SettingsIcon from '@lucide/svelte/icons/settings';

export interface NavItem {
  label: string;
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: Component<any>;
  /** Match only the exact path (used for the dashboard at `/`). */
  exact?: boolean;
}

/** Primary navigation, in sidebar order. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboardIcon, exact: true },
  { label: 'Projects', href: '/projects', icon: FolderGitIcon },
  { label: 'Commits', href: '/commits', icon: GitCommitIcon },
  { label: 'Timeline', href: '/timeline', icon: CalendarRangeIcon },
  { label: 'Deployments', href: '/deployments', icon: RocketIcon },
  { label: 'Environments', href: '/environments', icon: ServerIcon },
  { label: 'Releases', href: '/releases', icon: PackageIcon },
  { label: 'Notes', href: '/notes', icon: NotebookIcon },
  { label: 'Tags', href: '/tags', icon: TagsIcon },
];

/** Pinned to the bottom of the sidebar. */
export const SECONDARY_NAV: NavItem[] = [{ label: 'Settings', href: '/settings', icon: SettingsIcon }];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
