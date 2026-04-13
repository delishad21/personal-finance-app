import type { SelectOption } from "@/components/ui/Select";

const FALLBACK_CURRENCIES = ["SGD", "USD", "EUR", "GBP", "JPY", "CNY"];

export function getCurrencyOptions(): SelectOption[] {
  const codes =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("currency")
      : FALLBACK_CURRENCIES;

  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "currency" })
      : null;

  return codes
    .map((code) => {
      const upper = code.toUpperCase();
      const display = displayNames?.of(upper);
      return {
        value: upper,
        label: display ? `${upper} - ${display}` : upper,
      };
    })
    .sort((a, b) => a.value.localeCompare(b.value));
}

