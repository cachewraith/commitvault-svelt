<!-- Change the account password. On success every other session is signed out by the server. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { apiFieldErrors, isApiError, type FieldErrors } from '$lib/api';
  import { FormField, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { validateForm } from '$lib/validators';
  import { changePassword } from '$features/auth/session';
  import { changePasswordSchema, MIN_PASSWORD_LENGTH } from '$features/auth/validation';

  const EMPTY = { current_password: '', new_password: '', confirm_password: '' };

  let values = $state({ ...EMPTY });
  let errors = $state<FieldErrors>({});
  let submitting = $state(false);
  let form = $state<HTMLFormElement | null>(null);

  async function focusFirstInvalid() {
    await tick();
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;

    const result = validateForm(changePasswordSchema, values);
    errors = result.errors;
    if (!result.ok) {
      await focusFirstInvalid();
      return;
    }

    submitting = true;
    let failure: unknown;
    try {
      await changePassword({
        current_password: result.data.current_password,
        new_password: result.data.new_password,
      });
    } catch (error) {
      failure = error ?? new Error('Unknown error');
    } finally {
      submitting = false;
    }

    if (failure === undefined) {
      // Passwords are cleared only after the server accepted the change.
      values = { ...EMPTY };
      errors = {};
      toast.success('Password changed. Every other session has been signed out.');
      return;
    }

    // Keep what was typed; report the problem next to the field when possible.
    errors = apiFieldErrors(failure);
    if (isApiError(failure) && failure.isValidation && Object.keys(errors).length > 0) {
      await focusFirstInvalid();
    } else {
      toastError(failure, 'Could not change the password.');
    }
  }
</script>

<form bind:this={form} onsubmit={submit} novalidate class="flex max-w-sm flex-col gap-4">
  <FormField label="Current password" error={errors.current_password} required>
    {#snippet children(field)}
      <Input
        {...field}
        type="password"
        bind:value={values.current_password}
        autocomplete="current-password"
        disabled={submitting}
      />
    {/snippet}
  </FormField>

  <FormField
    label="New password"
    error={errors.new_password}
    hint={`At least ${MIN_PASSWORD_LENGTH} characters. A long passphrase works well.`}
    required
  >
    {#snippet children(field)}
      <Input
        {...field}
        type="password"
        bind:value={values.new_password}
        autocomplete="new-password"
        disabled={submitting}
      />
    {/snippet}
  </FormField>

  <FormField label="Confirm new password" error={errors.confirm_password} required>
    {#snippet children(field)}
      <Input
        {...field}
        type="password"
        bind:value={values.confirm_password}
        autocomplete="new-password"
        disabled={submitting}
      />
    {/snippet}
  </FormField>

  <div>
    <Button type="submit" disabled={submitting}>{submitting ? 'Changing…' : 'Change password'}</Button>
  </div>
</form>
