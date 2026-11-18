<!-- Account, password, appearance, session and a short "about" for the workspace. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SunIcon from '@lucide/svelte/icons/sun';
  import { DateTime, PageHeader, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { session, theme, type Theme } from '$lib/stores';
  import { cn } from '$lib/utils';
  import { logout } from '$features/auth/session';
  import ChangePasswordForm from '../components/ChangePasswordForm.svelte';

  const THEMES: { value: Theme; label: string; icon: typeof MoonIcon }[] = [
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'light', label: 'Light', icon: SunIcon },
  ];

  let signingOut = $state(false);

  async function signOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      await logout();
      // The route guard redirects to the sign-in page once the session ends.
    } catch (error) {
      toastError(error, 'Could not reach the server. You have been signed out on this device.');
    } finally {
      signingOut = false;
    }
  }
</script>

{#snippet card(id: string, title: string, description: string, body: Snippet)}
  <section aria-labelledby={id} class="bg-card rounded-lg border">
    <div class="border-b px-4 py-3">
      <h2 {id} class="text-sm font-semibold">{title}</h2>
      <p class="text-muted-foreground mt-0.5 text-sm">{description}</p>
    </div>
    <div class="p-4">
      {@render body()}
    </div>
  </section>
{/snippet}

{#snippet account()}
  <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
    <dt class="text-muted-foreground">Email</dt>
    <dd class="break-all">{session.user?.email ?? '—'}</dd>
    <dt class="text-muted-foreground">Member since</dt>
    <dd class="tabular"><DateTime value={session.user?.created_at} mode="date" /></dd>
    <dt class="text-muted-foreground">Role</dt>
    <dd>Administrator (the only account)</dd>
  </dl>
{/snippet}

{#snippet password()}
  <ChangePasswordForm />
{/snippet}

{#snippet appearance()}
  <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
    {#each THEMES as option (option.value)}
      {@const active = theme.current === option.value}
      <button
        type="button"
        role="radio"
        aria-checked={active}
        class={cn(
          'flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
          active ? 'border-brand/40 bg-brand/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
        onclick={() => theme.set(option.value)}
      >
        <option.icon class="size-4" aria-hidden="true" />
        {option.label}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet sessionBody()}
  <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-muted-foreground max-w-prose text-sm">
      Signing out ends this browser’s session on the server. Sessions also expire after a period of inactivity.
    </p>
    <Button variant="outline" onclick={signOut} disabled={signingOut}>
      <LogOutIcon aria-hidden="true" />
      {signingOut ? 'Signing out…' : 'Sign out'}
    </Button>
  </div>
{/snippet}

{#snippet about()}
  <div class="text-muted-foreground flex max-w-prose flex-col gap-3 text-sm">
    <p>
      <span class="text-foreground font-medium">CommitVault</span> is a personal workspace for remembering which
      commits were deployed where, what a release contained, and the technical notes that go with a project.
    </p>
    <ul class="list-disc space-y-1 pl-5">
      <li>Everything here is entered by you. CommitVault does not connect to Git, GitHub or your servers.</li>
      <li>
        A deployment is a record that you noted one. A missing record does not mean a commit is absent from an
        environment.
      </li>
      <li>Commands stored in notes and deployment records are documentation to copy — nothing is ever executed.</li>
    </ul>
    <p>
      <a
        href="/api/docs/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-brand inline-flex items-center gap-1 hover:underline"
      >
        API documentation
        <ExternalLinkIcon class="size-3.5" aria-hidden="true" />
        <span class="sr-only">(opens in a new tab)</span>
      </a>
      <span> — available on development servers only; it is switched off in production.</span>
    </p>
  </div>
{/snippet}

<div class="page">
  <PageHeader title="Settings" />

  <div class="flex max-w-3xl flex-col gap-6">
    {@render card('settings-account', 'Account', 'The single administrator account of this installation.', account)}
    {@render card(
      'settings-password',
      'Password',
      'Changing your password signs out every other browser and device.',
      password,
    )}
    {@render card('settings-appearance', 'Appearance', 'Stored in this browser only.', appearance)}
    {@render card('settings-session', 'Session', 'You are signed in on this browser.', sessionBody)}
    {@render card('settings-about', 'About', 'What this application does and does not do.', about)}
  </div>
</div>
