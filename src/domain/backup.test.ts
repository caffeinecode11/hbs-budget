import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, STARTER_CATEGORIES, type BudgetTransaction } from "./models";
import { BackupValidationError, createBackup, validateBackup } from "./backup";

const transaction: BudgetTransaction = {
  id: "backup-transaction",
  amountCents: 1_500,
  date: "2026-09-10",
  direction: "outgoing",
  categoryId: "food",
  source: "manual",
  createdAt: "2026-09-10T12:00:00.000Z",
  excludedFromProjection: false,
};

describe("backup validation", () => {
  it("accepts a backup created by the app", () => {
    const backup = createBackup(
      [transaction],
      STARTER_CATEGORIES,
      DEFAULT_SETTINGS,
      "2026-10-04T12:00:00.000Z",
    );
    expect(validateBackup(backup)).toEqual(backup);
  });

  it("rejects unsupported versions", () => {
    const backup = { ...createBackup([], STARTER_CATEGORIES, DEFAULT_SETTINGS), schemaVersion: 2 };
    expect(() => validateBackup(backup)).toThrow(BackupValidationError);
  });

  it("rejects partial backups and orphaned transactions", () => {
    const backup = createBackup([transaction], STARTER_CATEGORIES, DEFAULT_SETTINGS);
    const withoutFood = { ...backup, categories: backup.categories.filter((item) => item.id !== "food") };
    expect(() => validateBackup(withoutFood)).toThrow("missing category");
  });

  it("rejects a backup without the system Uncategorized category", () => {
    const backup = createBackup([], STARTER_CATEGORIES, DEFAULT_SETTINGS);
    const withoutSystem = {
      ...backup,
      categories: backup.categories.filter((item) => item.id !== "uncategorized"),
    };
    expect(() => validateBackup(withoutSystem)).toThrow("Uncategorized");
  });

  it("rejects malformed runtime transaction fields", () => {
    const backup = createBackup([transaction], STARTER_CATEGORIES, DEFAULT_SETTINGS) as unknown as {
      transactions: Array<Record<string, unknown>>;
    };
    backup.transactions[0].direction = "expense";

    expect(() => validateBackup(backup)).toThrow(BackupValidationError);
  });

  it("rejects impossible settings dates and months", () => {
    const backup = createBackup([], STARTER_CATEGORIES, {
      ...DEFAULT_SETTINGS,
      mbaStartDate: "2026-02-30",
      incompleteMonths: ["2026-13"],
    });

    expect(() => validateBackup(backup)).toThrow(BackupValidationError);
  });
});
