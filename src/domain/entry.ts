import type { BudgetTransaction } from "./models";

export function localDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseUsdCents(value: string): number | null {
  const normalized = value.trim().replaceAll(",", "").replace(/^\$/, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [dollars, cents = ""] = normalized.split(".");
  const amount = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function isFutureDate(date: string, today = localDateIso()): boolean {
  return date > today;
}

export function isLikelyDuplicate(
  candidate: BudgetTransaction,
  transactions: readonly BudgetTransaction[],
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.amountCents === candidate.amountCents &&
      transaction.date === candidate.date &&
      transaction.categoryId === candidate.categoryId &&
      transaction.direction === candidate.direction,
  );
}
