/**
 * Toast notifications. The `<Toaster />` is mounted once in `App.svelte`.
 *
 *   toast.success('Project created');
 *   toastError(error, 'Could not save the project.');
 */
import { toast } from 'svelte-sonner';
import { errorMessage, isApiError } from '$lib/api/errors';

export { toast };

/**
 * Show an error toast for a thrown value. Validation errors (422) are expected
 * to be shown inline next to the fields, so they produce a short generic toast.
 * Aborted requests are ignored.
 */
export function toastError(error: unknown, fallback = 'Something went wrong.'): void {
  if (isApiError(error)) {
    if (error.code === 'aborted') return;
    if (error.isValidation) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    if (error.isRateLimited && error.retryAfter) {
      toast.error(`Too many attempts. Try again in ${error.retryAfter} s.`);
      return;
    }
  }
  toast.error(errorMessage(error, fallback));
}
