import type { BudgetTransaction } from "./models";

export class TransactionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionValidationError";
  }
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day)
  );
}

export function assertValidTransaction(transaction: BudgetTransaction): void {
  if (!transaction.id.trim()) {
    throw new TransactionValidationError("A transaction ID is required.");
  }

  if (!Number.isSafeInteger(transaction.amountCents) || transaction.amountCents <= 0) {
    throw new TransactionValidationError("Amount must be a positive whole number of cents.");
  }

  if (!isValidIsoDate(transaction.date)) {
    throw new TransactionValidationError("Date must be a valid calendar date.");
  }

  if (!transaction.categoryId.trim()) {
    throw new TransactionValidationError("A category is required.");
  }

  if (!Number.isFinite(Date.parse(transaction.createdAt))) {
    throw new TransactionValidationError("Created time must be valid.");
  }
}
