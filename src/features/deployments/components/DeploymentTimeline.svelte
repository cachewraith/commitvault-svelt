<!--
  Read-only timeline of deployment records (status tone, title, environment,
  commit, time) for embedding: project overview, commit detail, dashboard, and
  — with `groupByDay` — the deployment history page. Renders nothing for an
  empty array; the parent owns the empty state.

  Each entry is a *record* the user made. Nothing here is checked against a server.
-->
<script lang="ts">
  import {
    DateTime,
    EnvironmentBadge,
    HashChip,
    StatusBadge,
    TagBadge,
    Timeline,
    TimelineItem,
    statusPresentation,
  } from '$lib/components';
  import { recordPanel } from '$lib/router';
  import { formatDateTime, formatTime } from '$lib/utils/format';
  import { commitSubject } from '$features/commits/format';
  import { paths } from '$routes/paths';
  import { groupByDay } from '../grouping';
  import type { Deployment } from '../types';
  import { STATUS_ICONS } from './status-icons';

  interface Props {
    deployments: Deployment[];
    showProject?: boolean;
    /** Hide when every item is the same environment / commit. */
    showEnvironment?: boolean;
    showCommit?: boolean;
    label?: string;
    /** Split into sections with a heading per local calendar day. */
    groupByDay?: boolean;
  }

  let {
    deployments,
    showProject = false,
    showEnvironment = true,
    showCommit = true,
    label = 'Deployment records',
    groupByDay: grouped = false,
  }: Props = $props();

  const groups = $derived(grouped ? groupByDay(deployments) : []);
</script>

{#snippet entry(deployment: Deployment)}
  <TimelineItem tone={statusPresentation(deployment.status).tone} icon={STATUS_ICONS[deployment.status]}>
    {#snippet title()}
      {@const shown = recordPanel.shows(paths.deployment(deployment.id))}
      <a
        href={paths.deployment(deployment.id)}
        class={shown ? 'text-brand' : 'hover:text-brand'}
        aria-current={shown ? 'true' : undefined}
      >
        {deployment.deployment_title}
      </a>
    {/snippet}
    {#snippet meta()}
      <StatusBadge status={deployment.status} variant="dot" />
      {#if grouped}
        <time datetime={deployment.deployed_at} title={formatDateTime(deployment.deployed_at)} class="tabular">
          {formatTime(deployment.deployed_at)}
        </time>
      {:else}
        <DateTime value={deployment.deployed_at} mode="relative" class="tabular" />
      {/if}
    {/snippet}

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {#if showEnvironment}
        <EnvironmentBadge name={deployment.environment.name} color={deployment.environment.color} size="sm" />
      {/if}
      {#if showCommit}
        <span class="flex min-w-0 items-center gap-2">
          <HashChip
            hash={deployment.commit.commit_hash}
            short={deployment.commit.short_hash}
            href={paths.commit(deployment.commit.id)}
          />
          <a
            href={paths.commit(deployment.commit.id)}
            class="hover:text-foreground min-w-0 truncate"
            title={commitSubject(deployment.commit.commit_message)}
          >
            {commitSubject(deployment.commit.commit_message)}
          </a>
        </span>
      {/if}
      {#if showProject}
        <a href={paths.project(deployment.project.id)} class="hover:text-foreground text-xs">
          {deployment.project.name}
        </a>
      {/if}
      {#each deployment.tags as tag (tag.id)}
        <TagBadge name={tag.name} color={tag.color} />
      {/each}
    </div>
  </TimelineItem>
{/snippet}

{#if deployments.length > 0}
  {#if grouped}
    <div class="flex flex-col gap-6">
      {#each groups as group (group.day)}
        <section aria-label={group.label}>
          <h2 class="eyebrow mb-3 flex items-center gap-2">
            <span>{group.label}</span>
            <span class="text-muted-foreground tabular font-normal normal-case">
              {group.items.length}
              {group.items.length === 1 ? 'record' : 'records'}
            </span>
          </h2>
          <Timeline label="{label} — {group.label}">
            {#each group.items as deployment (deployment.id)}
              {@render entry(deployment)}
            {/each}
          </Timeline>
        </section>
      {/each}
    </div>
  {:else}
    <Timeline {label}>
      {#each deployments as deployment (deployment.id)}
        {@render entry(deployment)}
      {/each}
    </Timeline>
  {/if}
{/if}
