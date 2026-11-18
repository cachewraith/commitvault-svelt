<!--
  Stacked bar chart of deployment records per UTC day. Dependency-free inline
  SVG. Accessible: the figure has a text summary, every bar has a tooltip
  title, the legend names each status, and the same data is available as a
  visually hidden table.
-->
<script lang="ts">
  import { statusPresentation } from '$lib/components';
  import { DEPLOYMENT_STATUSES, type DeploymentStatus } from '$lib/types';
  import { DATE_LOCALE, formatNumber, pluralize } from '$lib/utils';
  import type { DailyDeployments } from '../types';

  let { days }: { days: DailyDeployments[] } = $props();

  const WIDTH = 600;
  const HEIGHT = 120;
  const GAP = 3;

  const FILL: Record<DeploymentStatus, string> = {
    successful: 'fill-success',
    failed: 'fill-danger',
    rolled_back: 'fill-warning',
    pending: 'fill-info',
  };
  const SWATCH: Record<DeploymentStatus, string> = {
    successful: 'bg-success',
    failed: 'bg-danger',
    rolled_back: 'bg-warning',
    pending: 'bg-info',
  };

  const dayTotal = (day: DailyDeployments) => DEPLOYMENT_STATUSES.reduce((sum, status) => sum + day[status], 0);

  const totals = $derived(
    Object.fromEntries(
      DEPLOYMENT_STATUSES.map((status) => [status, days.reduce((sum, day) => sum + day[status], 0)]),
    ) as Record<DeploymentStatus, number>,
  );
  const total = $derived(DEPLOYMENT_STATUSES.reduce((sum, status) => sum + totals[status], 0));
  const peak = $derived(Math.max(1, ...days.map(dayTotal)));

  /** `2026-11-17` → "Nov 17" (the API reports UTC calendar days). */
  const dayFormat = new Intl.DateTimeFormat(DATE_LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dayLabel = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

  const breakdown = (counts: Record<DeploymentStatus, number>) =>
    DEPLOYMENT_STATUSES.filter((status) => counts[status] > 0)
      .map((status) => `${formatNumber(counts[status])} ${statusPresentation(status).label.toLowerCase()}`)
      .join(', ');

  const summary = $derived(
    total === 0
      ? `No deployments were recorded in the last ${days.length} days.`
      : `${pluralize(total, 'deployment record')} in the last ${days.length} days: ${breakdown(totals)}.`,
  );

  const bars = $derived.by(() => {
    const slot = days.length > 0 ? WIDTH / days.length : WIDTH;
    return days.map((day, index) => {
      let offset = 0;
      const segments = DEPLOYMENT_STATUSES.filter((status) => day[status] > 0).map((status) => {
        const height = (day[status] / peak) * HEIGHT;
        offset += height;
        return { status, height, y: HEIGHT - offset };
      });
      return {
        day,
        x: index * slot + GAP / 2,
        width: Math.max(1, slot - GAP),
        segments,
        title: `${dayLabel(day.date)}: ${dayTotal(day) === 0 ? 'no records' : breakdown(day)}`,
      };
    });
  });

  const activeDays = $derived(days.filter((day) => dayTotal(day) > 0));
</script>

<figure class="m-0">
  <figcaption class="text-muted-foreground mb-3 text-sm">{summary}</figcaption>

  {#if total > 0}
    <div class="flex gap-2">
      <div class="text-muted-foreground tabular flex flex-col justify-between text-right text-[0.6875rem]" aria-hidden="true">
        <span>{formatNumber(peak)}</span>
        <span>0</span>
      </div>
      <svg
        viewBox="0 0 {WIDTH} {HEIGHT}"
        preserveAspectRatio="none"
        class="border-border h-28 w-full border-b"
        role="img"
        aria-label={summary}
      >
        {#each bars as bar (bar.day.date)}
          <g>
            <title>{bar.title}</title>
            <!-- Invisible full-height target so empty days also show a tooltip. -->
            <rect x={bar.x} y="0" width={bar.width} height={HEIGHT} fill="transparent" />
            {#each bar.segments as segment (segment.status)}
              <rect x={bar.x} y={segment.y} width={bar.width} height={segment.height} class={FILL[segment.status]} />
            {/each}
          </g>
        {/each}
      </svg>
    </div>
    <div class="text-muted-foreground tabular mt-1 flex justify-between pl-6 text-[0.6875rem]" aria-hidden="true">
      <span>{days[0] ? dayLabel(days[0].date) : ''}</span>
      <span>{days.at(-1) ? dayLabel(days.at(-1)!.date) : ''}</span>
    </div>

    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
      {#each DEPLOYMENT_STATUSES as status (status)}
        <li class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm {SWATCH[status]}" aria-hidden="true"></span>
          <span>{statusPresentation(status).label}</span>
          <span class="text-muted-foreground tabular">{formatNumber(totals[status])}</span>
        </li>
      {/each}
    </ul>

    <table class="sr-only">
      <caption>Deployment records per day (UTC)</caption>
      <thead>
        <tr>
          <th scope="col">Day</th>
          {#each DEPLOYMENT_STATUSES as status (status)}
            <th scope="col">{statusPresentation(status).label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each activeDays as day (day.date)}
          <tr>
            <th scope="row">{dayLabel(day.date)}</th>
            {#each DEPLOYMENT_STATUSES as status (status)}
              <td>{day[status]}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  <p class="text-muted-foreground mt-2 text-xs">Days are UTC calendar days.</p>
</figure>
