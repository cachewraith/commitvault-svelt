<!--
  Password reset by email. Step 1 asks for the address and requests a code
  (the API answers the same whether or not the address belongs to the
  account). Step 2 takes the code and a new password, then returns to sign-in.
  `?email=` prefills the address (the login page passes what was typed).
-->
<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import { apiFieldErrors, errorMessage, isApiError } from '$lib/api/errors';
  import type { FieldErrors } from '$lib/api/types';
  import FormField from '$lib/components/FormField.svelte';
  import { toast } from '$lib/components/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import Logo from '$lib/layouts/Logo.svelte';
  import { navigate, router } from '$lib/router';
  import { validateForm } from '$lib/validators/form';
  import { paths } from '$routes/paths';
  import { Countdown, formatWait } from '../countdown.svelte';
  import { requestPasswordReset, resetPassword } from '../session';
  import {
    CODE_LENGTH,
    forgotPasswordSchema,
    MIN_PASSWORD_LENGTH,
    resetPasswordSchema,
  } from '../validation';

  /** The API sends at most one code per minute. */
  const RESEND_INTERVAL_SECONDS = 60;
  const UNAVAILABLE_MESSAGE =
    'Password reset by email is not available because outgoing email is not configured on the server. Set SMTP_HOST in the backend configuration, then try again.';

  let step = $state<'request' | 'reset'>('request');
  let email = $state(router.query.get('email') ?? '');
  /** The address the code was requested for (trimmed). */
  let requestedEmail = $state('');
  let values = $state({ code: '', new_password: '', confirm_password: '' });

  let submitting = $state(false);
  let resending = $state(false);
  let errors = $state<FieldErrors>({});
  let formError = $state<string | null>(null);
  let notice = $state<string | null>(null);

  let form = $state<HTMLFormElement | null>(null);
  let alert = $state<HTMLElement | null>(null);

  /** 429 on requesting a code. */
  const requestLocked = new Countdown();
  /** 429 on the reset itself (too many wrong codes). */
  const resetLocked = new Countdown();
  /** Until another code may be requested. */
  const resendWait = new Countdown();

  const resendBlockedFor = $derived(Math.max(requestLocked.remaining, resendWait.remaining));

  onDestroy(() => {
    requestLocked.stop();
    resetLocked.stop();
    resendWait.stop();
  });

  async function focusFirstInvalid() {
    await tick();
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? alert)?.focus();
  }

  /** Message for a failed code request; `null` when it was shown next to a field. */
  function requestFailure(error: unknown): string | null {
    if (isApiError(error) && error.isRateLimited) {
      requestLocked.start(error.retryAfter ?? RESEND_INTERVAL_SECONDS, () => (formError = null));
      return 'Too many reset requests from this browser.';
    }
    if (isApiError(error) && error.code === 'email_unavailable') return UNAVAILABLE_MESSAGE;
    if (isApiError(error) && error.isValidation) {
      errors = apiFieldErrors(error);
      return Object.keys(errors).length === 0 ? error.message : null;
    }
    return errorMessage(error, 'Could not send a reset code. Please try again.');
  }

  async function submitRequest(event: SubmitEvent) {
    event.preventDefault();
    if (submitting || requestLocked.active) return;

    formError = null;
    const result = validateForm(forgotPasswordSchema, { email });
    errors = result.errors;
    if (!result.ok) {
      await focusFirstInvalid();
      return;
    }

    submitting = true;
    let failure: unknown;
    try {
      await requestPasswordReset(result.data);
    } catch (error) {
      failure = error ?? new Error('Unknown error');
    } finally {
      submitting = false;
    }

    if (failure !== undefined) {
      formError = requestFailure(failure);
      await focusFirstInvalid();
      return;
    }
    requestedEmail = result.data.email;
    resendWait.start(RESEND_INTERVAL_SECONDS);
    notice = null;
    step = 'reset';
    await tick();
    form?.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
  }

  async function resend() {
    if (resending || resendBlockedFor > 0) return;
    resending = true;
    formError = null;
    notice = null;
    try {
      await requestPasswordReset({ email: requestedEmail });
      resendWait.start(RESEND_INTERVAL_SECONDS);
      values.code = '';
      errors = {};
      notice = 'If that address belongs to the account, a new code is on its way. The previous code no longer works.';
      await tick();
      form?.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
    } catch (error) {
      formError = requestFailure(error) ?? errors.email ?? 'Could not send a new code.';
      await tick();
      alert?.focus();
    } finally {
      resending = false;
    }
  }

  async function submitReset(event: SubmitEvent) {
    event.preventDefault();
    if (submitting || resetLocked.active) return;

    formError = null;
    const result = validateForm(resetPasswordSchema, values);
    errors = result.errors;
    if (!result.ok) {
      await focusFirstInvalid();
      return;
    }

    submitting = true;
    let failure: unknown;
    try {
      await resetPassword({
        email: requestedEmail,
        code: result.data.code,
        new_password: result.data.new_password,
      });
    } catch (error) {
      failure = error ?? new Error('Unknown error');
    } finally {
      submitting = false;
    }

    if (failure === undefined) {
      toast.success('Password changed. Sign in with your new password.');
      navigate(paths.login(), { replace: true });
      return;
    }

    // Keep what was typed; only report what went wrong.
    notice = null;
    if (isApiError(failure) && failure.isRateLimited) {
      resetLocked.start(failure.retryAfter ?? RESEND_INTERVAL_SECONDS, () => (formError = null));
      formError = 'Too many incorrect codes.';
    } else if (isApiError(failure) && failure.isValidation) {
      const { email: emailError, ...fieldErrors } = apiFieldErrors(failure);
      errors = fieldErrors;
      // The address is not editable on this step; report it above the form.
      formError = emailError ?? (Object.keys(fieldErrors).length === 0 ? failure.message : null);
    } else {
      formError = errorMessage(failure, 'Could not reset the password. Please try again.');
    }
    await focusFirstInvalid();
  }

  async function useDifferentEmail() {
    step = 'request';
    values = { code: '', new_password: '', confirm_password: '' };
    errors = {};
    formError = null;
    notice = null;
    await tick();
    form?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }
</script>

<div class="w-full max-w-sm">
  <div class="mb-8 flex flex-col items-center gap-3 text-center">
    <Logo wordmark={false} class="[&_svg]:size-8" />
    <div class="space-y-1">
      {#if step === 'request'}
        <h1 class="text-foreground text-lg font-semibold tracking-tight">Reset your password</h1>
        <p class="text-muted-foreground text-sm">
          Enter the email address of the account and we will send you a code.
        </p>
      {:else}
        <h1 class="text-foreground text-lg font-semibold tracking-tight">Check your email</h1>
        <p class="text-muted-foreground text-sm">
          If <span class="text-foreground font-medium">{requestedEmail}</span> belongs to the account, we sent
          a {CODE_LENGTH}-digit code to it. The code expires after 10 minutes.
        </p>
      {/if}
    </div>
  </div>

  {#snippet alertBox()}
    {#if formError}
      <div
        bind:this={alert}
        tabindex="-1"
        role="alert"
        class="border-danger/30 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm outline-none"
      >
        {formError}
        {#if step === 'request' && requestLocked.active}
          <span class="tabular">Try again in {formatWait(requestLocked.remaining)}.</span>
        {:else if step === 'reset' && resetLocked.active}
          <span class="tabular">Try again in {formatWait(resetLocked.remaining)}.</span>
        {:else if step === 'reset' && requestLocked.active}
          <span class="tabular">You can request another code in {formatWait(requestLocked.remaining)}.</span>
        {/if}
      </div>
    {/if}
  {/snippet}

  {#if step === 'request'}
    <form
      bind:this={form}
      class="bg-card flex flex-col gap-4 rounded-xl border p-6 shadow-xs"
      onsubmit={submitRequest}
      novalidate
    >
      {@render alertBox()}

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

      <Button type="submit" size="lg" class="mt-1 w-full" disabled={submitting || requestLocked.active}>
        {#if submitting}
          <LoaderIcon class="animate-spin" aria-hidden="true" />
          Sending…
        {:else if requestLocked.active}
          Try again in {formatWait(requestLocked.remaining)}
        {:else}
          Send code
        {/if}
      </Button>
    </form>
  {:else}
    <form
      bind:this={form}
      class="bg-card flex flex-col gap-4 rounded-xl border p-6 shadow-xs"
      onsubmit={submitReset}
      novalidate
    >
      {@render alertBox()}

      <!-- Lets password managers store the new password for the right account. -->
      <input type="email" name="username" autocomplete="username" value={requestedEmail} hidden readonly />

      <FormField label="Reset code" error={errors.code}>
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
            bind:value={values.code}
            disabled={submitting}
          />
        {/snippet}
      </FormField>

      <FormField
        label="New password"
        error={errors.new_password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A long passphrase works well.`}
      >
        {#snippet children(field)}
          <Input
            {...field}
            type="password"
            name="new_password"
            autocomplete="new-password"
            bind:value={values.new_password}
            disabled={submitting}
          />
        {/snippet}
      </FormField>

      <FormField label="Confirm new password" error={errors.confirm_password}>
        {#snippet children(field)}
          <Input
            {...field}
            type="password"
            name="confirm_password"
            autocomplete="new-password"
            bind:value={values.confirm_password}
            disabled={submitting}
          />
        {/snippet}
      </FormField>

      <p class="text-muted-foreground text-xs">
        Every session will be signed out, and every browser will be asked for a sign-in code again.
      </p>

      {#if notice}
        <p role="status" class="text-success text-sm">{notice}</p>
      {/if}

      <Button type="submit" size="lg" class="w-full" disabled={submitting || resetLocked.active}>
        {#if submitting}
          <LoaderIcon class="animate-spin" aria-hidden="true" />
          Resetting…
        {:else if resetLocked.active}
          Try again in {formatWait(resetLocked.remaining)}
        {:else}
          Reset password
        {/if}
      </Button>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resending || resendBlockedFor > 0}
          onclick={resend}
        >
          {#if resending}
            <LoaderIcon class="animate-spin" aria-hidden="true" />
            Sending…
          {:else if resendBlockedFor > 0}
            <span class="tabular">Send a new code in {formatWait(resendBlockedFor)}</span>
          {:else}
            Send a new code
          {/if}
        </Button>
        <Button type="button" variant="link" size="sm" class="px-0" onclick={useDifferentEmail}>
          Use a different email
        </Button>
      </div>
    </form>
  {/if}

  <p class="mt-6 text-center text-sm">
    <a href={paths.login()} class="text-brand hover:underline">Back to sign in</a>
  </p>
</div>
