<!--
  Second sign-in step: the password was accepted and a one-time code was
  emailed. On success the session store flips to `authenticated` and the route
  guard redirects. The parent owns the challenge so a resend replaces it.
-->
<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import { apiFieldErrors, errorMessage, isApiError } from '$lib/api/errors';
  import type { FieldErrors } from '$lib/api/types';
  import FormField from '$lib/components/FormField.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { validateForm } from '$lib/validators/form';
  import { Countdown, formatWait } from '../countdown.svelte';
  import { isSignInExpired, resendLoginCode, verifyLoginCode } from '../session';
  import type { CodeChallenge } from '../types';
  import { CODE_LENGTH, loginCodeSchema } from '../validation';

  interface Props {
    challenge: CodeChallenge;
    /** A new code was sent; replace the challenge. */
    onchallenge: (challenge: CodeChallenge) => void;
    /** Go back to the password step, optionally explaining why. */
    onrestart: (message?: string) => void;
  }

  let { challenge, onchallenge, onrestart }: Props = $props();

  const EXPIRED_MESSAGE = 'Your sign-in expired. Enter your password again.';

  let code = $state('');
  let submitting = $state(false);
  let resending = $state(false);
  let errors = $state<FieldErrors>({});
  let formError = $state<string | null>(null);
  let notice = $state<string | null>(null);

  let form = $state<HTMLFormElement | null>(null);
  let alert = $state<HTMLElement | null>(null);

  /** Wait after too many wrong codes (429). */
  const locked = new Countdown();
  /** Until another code may be requested. */
  const resendWait = new Countdown();
  /** Until the current code stops working. */
  const expiry = new Countdown();

  $effect(() => {
    const { expires_at, resend_available_at } = challenge;
    untrack(() => {
      expiry.startUntil(expires_at);
      resendWait.startUntil(resend_available_at);
    });
  });

  onDestroy(() => {
    locked.stop();
    resendWait.stop();
    expiry.stop();
  });

  async function focusFirstInvalid() {
    await tick();
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? alert)?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting || locked.active) return;

    formError = null;
    const result = validateForm(loginCodeSchema, { code });
    errors = result.errors;
    if (!result.ok) {
      await focusFirstInvalid();
      return;
    }

    submitting = true;
    try {
      await verifyLoginCode(result.data.code);
      // Redirect is handled by the route guard once the session is authenticated.
    } catch (error) {
      if (isSignInExpired(error)) {
        onrestart(EXPIRED_MESSAGE);
        return;
      }
      // Keep the typed code; only report what went wrong.
      if (isApiError(error) && error.isRateLimited) {
        locked.start(error.retryAfter ?? 60, () => (formError = null));
        formError = 'Too many incorrect codes.';
      } else if (isApiError(error) && error.isValidation) {
        errors = apiFieldErrors(error);
        formError = Object.keys(errors).length === 0 ? error.message : null;
      } else {
        formError = errorMessage(error, 'Could not check the code. Please try again.');
      }
      notice = null;
      // Re-enable the input before moving focus to it.
      submitting = false;
      await focusFirstInvalid();
    } finally {
      submitting = false;
    }
  }

  async function resend() {
    if (resending || resendWait.active) return;
    resending = true;
    formError = null;
    notice = null;
    try {
      const next = await resendLoginCode();
      onchallenge(next);
      code = '';
      errors = {};
      notice = 'We sent a new code. The previous code no longer works.';
      await tick();
      form?.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
    } catch (error) {
      if (isSignInExpired(error)) {
        onrestart(EXPIRED_MESSAGE);
        return;
      }
      if (isApiError(error) && error.isRateLimited) {
        resendWait.start(error.retryAfter ?? 60);
        formError = 'A new code was sent less than a minute ago.';
      } else {
        formError = errorMessage(error, 'Could not send a new code. Please try again.');
      }
      await tick();
      alert?.focus();
    } finally {
      resending = false;
    }
  }
</script>

<div class="mb-8 space-y-1 text-center">
  <h1 class="text-foreground text-lg font-semibold tracking-tight">Check your email</h1>
  <p class="text-muted-foreground text-sm">
    We sent a {CODE_LENGTH}-digit code to <span class="text-foreground font-medium">{challenge.email_hint}</span>.
  </p>
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
      {#if locked.active}
        <span class="tabular">Try again in {formatWait(locked.remaining)}.</span>
      {:else if resendWait.active}
        <span class="tabular">You can request another in {formatWait(resendWait.remaining)}.</span>
      {/if}
    </div>
  {/if}

  <FormField
    label="Sign-in code"
    error={errors.code}
    hint="This browser will be remembered for 90 days."
  >
    {#snippet children(field)}
      <Input
        {...field}
        type="text"
        name="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        autocapitalize="none"
        spellcheck="false"
        maxlength={CODE_LENGTH + 2}
        class="tabular font-mono tracking-[0.3em]"
        bind:value={code}
        disabled={submitting}
        autofocus
      />
    {/snippet}
  </FormField>

  <p class="text-muted-foreground text-xs tabular">
    {#if expiry.active}
      The code expires in {formatWait(expiry.remaining)}.
    {:else}
      This code has expired. Send a new code to continue.
    {/if}
  </p>

  {#if notice}
    <p role="status" class="text-success text-sm">{notice}</p>
  {/if}

  <Button type="submit" size="lg" class="w-full" disabled={submitting || locked.active}>
    {#if submitting}
      <LoaderIcon class="animate-spin" aria-hidden="true" />
      Verifying…
    {:else if locked.active}
      Try again in {formatWait(locked.remaining)}
    {:else}
      Verify code
    {/if}
  </Button>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={resending || resendWait.active}
      onclick={resend}
    >
      {#if resending}
        <LoaderIcon class="animate-spin" aria-hidden="true" />
        Sending…
      {:else if resendWait.active}
        <span class="tabular">Send a new code in {formatWait(resendWait.remaining)}</span>
      {:else}
        Send a new code
      {/if}
    </Button>
    <Button type="button" variant="link" size="sm" class="px-0" onclick={() => onrestart()}>
      Use a different account
    </Button>
  </div>
</form>
