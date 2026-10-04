import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  STARTER_CATEGORIES,
  type BudgetTransaction,
} from "../domain/models";
import { createBackup } from "../domain/backup";
import { TransactionValidationError } from "../domain/validation";
import {
  BudgetDatabase,
  CategoryOperationError,
  DATABASE_NAME,
  StorageOperationError,
} from "./db";

const validTransaction: BudgetTransaction = {
  id: "transaction-1",
  amountCents: 2_500,
  date: "2026-09-12",
  description: "Dinner",
  direction: "outgoing",
  categoryId: "food",
  source: "manual",
  createdAt: "2026-09-12T22:00:00.000Z",
  excludedFromProjection: false,
};

function deleteTestDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Test database deletion was blocked.")), {
      once: true,
    });
  });
}

beforeEach(deleteTestDatabase);
afterEach(deleteTestDatabase);

describe("BudgetDatabase", () => {
  it("seeds starter categories and settings once", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    await database.initialize();

    const categories = await database.getCategories();
    expect(categories).toHaveLength(STARTER_CATEGORIES.length);
    expect(await database.getSettings()).toMatchObject({ id: "primary", availableFundsCents: null });
  });

  it("persists a valid transaction", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    await database.saveTransaction(validTransaction);

    expect(await database.getTransactions()).toEqual([validTransaction]);
  });

  it("rejects zero-value transactions before writing", async () => {
    const database = new BudgetDatabase();
    await database.initialize();

    await expect(
      database.saveTransaction({ ...validTransaction, amountCents: 0 }),
    ).rejects.toBeInstanceOf(TransactionValidationError);
    expect(await database.getTransactions()).toHaveLength(0);
  });

  it("keeps historical transactions linked when a category is archived", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    const food = (await database.getCategories()).find((category) => category.id === "food");
    expect(food).toBeDefined();

    await database.saveTransaction(validTransaction);
    await database.saveCategory({ ...food!, archived: true });

    expect(await database.getCategories(false)).not.toContainEqual(expect.objectContaining({ id: "food" }));
    expect(await database.getTransactions()).toEqual([validTransaction]);
  });

  it("reports a failed write instead of appearing successful", async () => {
    const database = new BudgetDatabase(() => Promise.reject(new Error("Simulated quota failure")));

    await expect(database.saveTransaction(validTransaction)).rejects.toBeInstanceOf(StorageOperationError);
  });

  it("requires reassignment before deleting a category with transactions", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    await database.saveTransaction(validTransaction);

    await expect(database.deleteCategory("food")).rejects.toBeInstanceOf(CategoryOperationError);
    expect(await database.getTransactions()).toEqual([validTransaction]);
    expect(await database.getCategories()).toContainEqual(expect.objectContaining({ id: "food" }));
  });

  it("atomically reassigns history when deleting a category", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    await database.saveTransaction(validTransaction);

    await database.deleteCategory("food", "miscellaneous");

    expect(await database.getCategories()).not.toContainEqual(expect.objectContaining({ id: "food" }));
    expect(await database.getTransactions()).toEqual([
      { ...validTransaction, categoryId: "miscellaneous" },
    ]);
  });

  it("recategorizes multiple transactions without changing other fields", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    const second = { ...validTransaction, id: "transaction-2", amountCents: 9_900 };
    await database.saveTransaction(validTransaction);
    await database.saveTransaction(second);

    await database.reassignTransactions([validTransaction.id, second.id], "travel");

    expect(await database.getTransactions()).toEqual([
      { ...validTransaction, categoryId: "travel" },
      { ...second, categoryId: "travel" },
    ]);
  });

  it("protects the Uncategorized system category", async () => {
    const database = new BudgetDatabase();
    await database.initialize();

    await expect(database.deleteCategory("uncategorized")).rejects.toBeInstanceOf(
      CategoryOperationError,
    );
  });

  it("persists projection settings", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    const settings = {
      id: "primary" as const,
      mbaStartDate: "2026-08-01",
      graduationDate: "2028-05-31",
      availableFundsCents: 125_000_00,
      incompleteMonths: ["2026-09"],
    };

    await database.saveSettings(settings);
    expect(await database.getSettings()).toEqual(settings);
  });

  it("deletes only the requested transaction", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    const second = { ...validTransaction, id: "transaction-2" };
    await database.saveTransaction(validTransaction);
    await database.saveTransaction(second);

    await database.deleteTransaction(validTransaction.id);
    expect(await database.getTransactions()).toEqual([second]);
  });

  it("restores a validated snapshot as one complete replacement", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    const customCategory = {
      id: "custom",
      name: "Custom",
      color: "#123456",
      sortOrder: 9,
      archived: false,
      system: false,
    };
    const restoredTransaction = { ...validTransaction, categoryId: customCategory.id };
    const backup = createBackup(
      [restoredTransaction],
      [...STARTER_CATEGORIES, customCategory],
      { ...DEFAULT_SETTINGS, availableFundsCents: 20_000_00 },
    );

    await database.replaceAllData(backup);
    expect(await database.getTransactions()).toEqual([restoredTransaction]);
    expect(await database.getCategories()).toContainEqual(customCategory);
    expect(await database.getSettings()).toEqual(backup.settings);
  });

  it("resets to starter data without leaving financial records", async () => {
    const database = new BudgetDatabase();
    await database.initialize();
    await database.saveTransaction(validTransaction);
    await database.saveCategory({
      id: "custom",
      name: "Custom",
      color: "#123456",
      sortOrder: 10,
      archived: false,
      system: false,
    });
    await database.saveSettings({ ...DEFAULT_SETTINGS, availableFundsCents: 12_000_00 });

    await database.resetAllData();
    expect(await database.getTransactions()).toEqual([]);
    expect(await database.getCategories()).toEqual(STARTER_CATEGORIES);
    expect(await database.getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
