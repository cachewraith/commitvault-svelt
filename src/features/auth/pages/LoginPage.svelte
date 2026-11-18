<!--
  Sign-in screen. Step 1 checks the password; when the API answers
  `code_required`, step 2 asks for the emailed code (LoginCodeStep). Once the
  session store flips to `authenticated` the route guard (App.svelte)
  redirects to `?next=` or `/`.
-->
<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import LockIcon from '@lucide/svelte/icons/lock';
  import { apiFieldErrors, errorMessage, isApiError } from '$lib/api/errors';
  import { queryKeys } from '$lib/api/query-keys';
  import type { FieldErrors } from '$lib/api/types';
  import FormField from '$lib/components/FormField.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import Logo from '$lib/layouts/Logo.svelte';
  import { validateForm } from '$lib/validators/form';
  import { paths } from '$routes/paths';
  import LoginCodeStep from '../components/LoginCodeStep.svelte';
  import { Countdown, formatWait } from '../countdown.svelte';
  import { fetchAuthOptions, login } from '../session';
  import type { CodeChallenge } from '../types';
  import { loginSchema } from '../validation';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let submitting = $state(false);
  let errors = $state<FieldErrors>({});
  let formError = $state<string | null>(null);
  /** Set while the emailed code is expected (step 2). */
  let challenge = $state<CodeChallenge | null>(null);

  let form = $state<HTMLFormElement | null>(null);
  let alert = $state<HTMLElement | null>(null);

  /** Wait before another attempt is allowed (429). */
  const retry = new Countdown();
  const locked = $derived(retry.active);

  const options = createQuery(() => ({
    queryKey: queryKeys.auth.options(),
    queryFn: ({ signal }) => fetchAuthOptions(signal),
    staleTime: 5 * 60_000,
  }));

  /** "Forgot password?" only works when the server can send email. */
  const canResetPassword = $derived(options.data?.email_enabled === true);
  const forgotHref = $derived(paths.forgotPassword({ email: email.trim() || undefined }));

  onDestroy(() => retry.stop());

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
      const outcome = await login(result.data);
      if (outcome.status === 'code_required') {
        // Not signed in yet. The password is not needed any more.
        password = '';
        showPassword = false;
        errors = {};
        challenge = outcome.challenge;
      }
      // Otherwise the route guard redirects once the session is authenticated.
    } catch (error) {
      // Keep what the user typed; only report what went wrong.
      if (isApiError(error) && error.isRateLimited) {
        retry.start(error.retryAfter ?? 60, () => (formError = null));
        formError = 'Too many sign-in attempts.';
      } else if (isApiError(error) && error.isValidation) {
        errors = apiFieldErrors(error);
        formError = Object.keys(errors).length === 0 ? error.message : null;
      } else if (isApiError(error) && error.status === 401) {
        formError = 'Incorrect email or password.';
      } else {
        formError = errorMessage(error, 'Could not sign in. Please try again.');
      }
      // Re-enable the inputs before moving focus to them.
      submitting = false;
      await focusFirstInvalid();
    } finally {
      submitting = false;
    }
  }

  /** Back from the code step to the password step (email kept). */
  async function restart(message?: string) {
    challenge = null;
    errors = {};
    formError = message ?? null;
    await tick();
    form?.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
  }
</script>

<div class="w-full max-w-sm">
  {#if challenge}
    <div class="mb-3 flex justify-center">
      <Logo wordmark={false} class="[&_svg]:size-8" />
    </div>
    <LoginCodeStep
      {challenge}
      onchallenge={(next) => (challenge = next)}
      onrestart={restart}
    />
  {:else}
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
            <span class="tabular">Try again in {formatWait(retry.remaining)}.</span>
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

      <FormField label="Password" error={errors.password} labelAside={canResetPassword ? forgotLink : undefined}>
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
          Try again in {formatWait(retry.remaining)}
        {:else}
          Sign in
        {/if}
      </Button>
    </form>
  {/if}

  <p class="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 text-xs">
    <LockIcon class="size-3" aria-hidden="true" />
    Single-user instance · registration is disabled
  </p>
</div>

{#snippet forgotLink()}
  <a href={forgotHref} class="text-brand text-xs hover:underline">Forgot password?</a>
{/snippet}
