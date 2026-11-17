<!--
  Sign-in screen. After a successful login the session store flips to
  `authenticated` and the route guard (App.svelte) redirects to `?next=` or `/`.
-->
<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import LockIcon from '@lucide/svelte/icons/lock';
  import { apiFieldErrors, errorMessage, isApiError } from '$lib/api/errors';
  import type { FieldErrors } from '$lib/api/types';
  import FormField from '$lib/components/FormField.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import Logo from '$lib/layouts/Logo.svelte';
  import { validateForm } from '$lib/validators/form';
  import { login } from '../session';
  import { loginSchema } from '../validation';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let submitting = $state(false);
  let errors = $state<FieldErrors>({});
  let formError = $state<string | null>(null);
  /** Seconds until another attempt is allowed (429). */
  let retryIn = $state(0);

  let form = $state<HTMLFormElement | null>(null);
  let alert = $state<HTMLElement | null>(null);
  let countdown: ReturnType<typeof setInterval> | undefined;

  const locked = $derived(retryIn > 0);

  function startCountdown(seconds: number) {
    clearInterval(countdown);
    retryIn = Math.max(1, Math.ceil(seconds));
    countdown = setInterval(() => {
      retryIn -= 1;
      if (retryIn <= 0) {
        retryIn = 0;
        clearInterval(countdown);
        formError = null;
      }
    }, 1000);
  }

  onDestroy(() => clearInterval(countdown));

  function formatWait(seconds: number): string {
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  async function focusFirstInvalid() {
    await tick();
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? alert)?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting || locked) return;

    formError = null;
    const result = validateForm(loginSchema, { email, password });
    errors = result.errors;
    if (!result.ok) {
      await focusFirstInvalid();
      return;
    }

    submitting = true;
    try {
      await login(result.data);
      // Redirect is handled by the route guard once the session is authenticated.
    } catch (error) {
      // Keep what the user typed; only report what went wrong.
      if (isApiError(error) && error.isRateLimited) {
        startCountdown(error.retryAfter ?? 60);
        formError = 'Too many sign-in attempts.';
      } else if (isApiError(error) && error.isValidation) {
        errors = apiFieldErrors(error);
        formError = Object.keys(errors).length === 0 ? error.message : null;
      } else if (isApiError(error) && error.status === 401) {
        formError = 'Incorrect email or password.';
      } else {
        formError = errorMessage(error, 'Could not sign in. Please try again.');
      }
      await focusFirstInvalid();
    } finally {
      submitting = false;
    }
  }
</script>

<div class="w-full max-w-sm">
  <div class="mb-8 flex flex-col items-center gap-3 text-center">
    <Logo wordmark={false} class="[&_svg]:size-8" />
    <div class="space-y-1">
      <h1 class="text-foreground text-lg font-semibold tracking-tight">Sign in to CommitVault</h1>
      <p class="text-muted-foreground text-sm">Your private commit and deployment workspace.</p>
    </div>
  </div>

  <form
    bind:this={form}
    class="bg-card flex flex-col gap-4 rounded-xl border p-6 shadow-xs"
    onsubmit={submit}
    novalidate
  >
    {#if formError}
      <div
        bind:this={alert}
        tabindex="-1"
        role="alert"
        class="border-danger/30 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm outline-none"
      >
        {formError}
        {#if locked}
          <span class="tabular">Try again in {formatWait(retryIn)}.</span>
        {/if}
      </div>
    {/if}

    <FormField label="Email" error={errors.email}>
      {#snippet children(field)}
        <Input
          {...field}
          type="email"
          name="email"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          inputmode="email"
          placeholder="you@example.com"
          bind:value={email}
          disabled={submitting}
          autofocus
        />
      {/snippet}
    </FormField>

    <FormField label="Password" error={errors.password}>
      {#snippet children(field)}
        <div class="relative">
          <Input
            {...field}
            type={showPassword ? 'text' : 'password'}
            name="password"
            autocomplete="current-password"
            class="pr-9"
            bind:value={password}
            disabled={submitting}
          />
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onclick={() => (showPassword = !showPassword)}
          >
            {#if showPassword}
              <EyeOffIcon class="size-4" aria-hidden="true" />
            {:else}
              <EyeIcon class="size-4" aria-hidden="true" />
            {/if}
          </button>
        </div>
      {/snippet}
    </FormField>

    <Button type="submit" size="lg" class="mt-1 w-full" disabled={submitting || locked}>
      {#if submitting}
        <LoaderIcon class="animate-spin" aria-hidden="true" />
        Signing in…
      {:else if locked}
        Try again in {formatWait(retryIn)}
      {:else}
        Sign in
      {/if}
    </Button>
  </form>

  <p class="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 text-xs">
    <LockIcon class="size-3" aria-hidden="true" />
    Single-user instance · registration is disabled
  </p>
</div>
