/** Option shape shared by `Combobox` and `MultiCombobox`. */
export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary line (e.g. commit message under a hash). */
  description?: string;
  /** Extra terms matched by the client-side filter. */
  keywords?: string[];
  disabled?: boolean;
}
