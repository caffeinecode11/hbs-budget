import type { BudgetSettings, BudgetTransaction, Category } from "./models";
import { assertValidTransaction } from "./validation";

export const BACKUP_SCHEMA_VERSION = 1;

export interface BudgetBackup {
  schemaVersion: 1;
  exportedAt: string;
  transactions: BudgetTransaction[];
  categories: Category[];
  settings: BudgetSettings;
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    parsed.getUTCFullYear() === Number(match[1]) &&
    parsed.getUTCMonth() === Number(match[2]) - 1 &&
    parsed.getUTCDate() === Number(match[3])
  );
}

function isCalendarMonth(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

function validateCategory(value: unknown): asserts value is Category {
  if (!isRecord(value)) throw new BackupValidationError("A category record is invalid.");
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 120 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 40 ||
    typeof value.color !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(value.color) ||
    !Number.isSafeInteger(value.sortOrder) ||
    Number(value.sortOrder) < 0 ||
    typeof value.archived !== "boolean" ||
    typeof value.system !== "boolean"
  ) {
    throw new BackupValidationError("A category record is invalid.");
  }
}

function validateSettings(value: unknown): asserts value is BudgetSettings {
  if (!isRecord(value) || value.id !== "primary") {
    throw new BackupValidationError("Backup settings are invalid.");
  }
  const validOptionalDate = (date: unknown): boolean => date === null || isCalendarDate(date);
  if (
    !validOptionalDate(value.mbaStartDate) ||
    !validOptionalDate(value.graduationDate) ||
    !(
      value.availableFundsCents === null ||
      (Number.isSafeInteger(value.availableFundsCents) && Number(value.availableFundsCents) >= 0)
    ) ||
    !Array.isArray(value.incompleteMonths) ||
    !value.incompleteMonths.every(isCalendarMonth) ||
    new Set(value.incompleteMonths).size !== value.incompleteMonths.length
  ) {
    throw new BackupValidationError("Backup settings are invalid.");
  }
}

export function createBackup(
  transactions: readonly BudgetTransaction[],
  categories: readonly Category[],
  settings: BudgetSettings,
  exportedAt = new Date().toISOString(),
): BudgetBackup {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    transactions: [...transactions],
    categories: [...categories],
    settings,
  };
}

export function validateBackup(value: unknown): BudgetBackup {
  if (!isRecord(value) || value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError("This backup version is not supported.");
  }
  if (!Array.isArray(value.transactions) || !Array.isArray(value.categories)) {
    throw new BackupValidationError("Backup records are missing.");
  }
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
    throw new BackupValidationError("The backup date is invalid.");
  }

  value.categories.forEach(validateCategory);
  validateSettings(value.settings);
  value.transactions.forEach((transaction) => {
    if (
      !isRecord(transaction) ||
      typeof transaction.id !== "string" ||
      typeof transaction.amountCents !== "number" ||
      typeof transaction.date !== "string" ||
      typeof transaction.categoryId !== "string" ||
      typeof transaction.createdAt !== "string" ||
      (transaction.description !== undefined &&
        (typeof transaction.description !== "string" || transaction.description.length > 120)) ||
      (transaction.direction !== "outgoing" && transaction.direction !== "incoming") ||
      transaction.source !== "manual" ||
      typeof transaction.excludedFromProjection !== "boolean"
    ) {
      throw new BackupValidationError("A transaction record is invalid.");
    }
    try {
      assertValidTransaction(transaction as unknown as BudgetTransaction);
    } catch {
      throw new BackupValidationError("A transaction record is invalid.");
    }
  });

  const categoryIds = new Set(value.categories.map((category) => category.id));
  const transactionIds = new Set(value.transactions.map((transaction) => transaction.id));
  if (categoryIds.size !== value.categories.length || transactionIds.size !== value.transactions.length) {
    throw new BackupValidationError("The backup contains duplicate record IDs.");
  }
  if (
    !value.categories.some(
      (category) => category.id === "uncategorized" && category.system && !category.archived,
    )
  ) {
    throw new BackupValidationError("The required Uncategorized category is missing.");
  }
  if (value.transactions.some((transaction) => !categoryIds.has(transaction.categoryId))) {
    throw new BackupValidationError("A transaction refers to a missing category.");
  }

  return value as unknown as BudgetBackup;
}
