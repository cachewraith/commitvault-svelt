/**
 * Promise-based confirmation dialog, usable from any module:
 *
 *   if (await confirm({ title: 'Delete commit?', description: '…', confirmLabel: 'Delete', destructive: true })) {
 *     await mutation.mutateAsync(id);
 *   }
 *
 * `<ConfirmDialogHost />` (mounted once in App.svelte) renders the dialog.
 * Requests are queued, so two overlapping calls are shown one after another.
 */

export interface ConfirmOptions {
  title: string;
  /** Explain the consequence in one or two sentences. */
  description?: string;
  /** Label of the confirming button. Use the verb: "Delete", "Archive". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive. */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (confirmed: boolean) => void;
}

class ConfirmService {
  #queue = $state.raw<PendingConfirm[]>([]);
  #nextId = 1;

  /** The request currently displayed, if any. */
  get current(): PendingConfirm | null {
    return this.#queue[0] ?? null;
  }

  request(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.#queue = [...this.#queue, { ...options, id: this.#nextId++, resolve }];
    });
  }

  /** Settle the displayed request and move on to the next one. */
  settle(confirmed: boolean): void {
    const [head, ...rest] = this.#queue;
    if (!head) return;
    this.#queue = rest;
    head.resolve(confirmed);
  }
}

export const confirmService = new ConfirmService();

/** Ask the user to confirm an action. Resolves `true` when confirmed, `false` otherwise. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return confirmService.request(options);
}
