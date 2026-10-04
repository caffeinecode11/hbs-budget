import {
  DEFAULT_SETTINGS,
  STARTER_CATEGORIES,
  type BudgetSettings,
  type BudgetTransaction,
  type Category,
} from "../domain/models";
import { assertValidTransaction } from "../domain/validation";
import type { BudgetBackup } from "../domain/backup";

export const DATABASE_NAME = "hbs-student-budget";
const DATABASE_VERSION = 1;

const STORES = {
  transactions: "transactions",
  categories: "categories",
  settings: "settings",
} as const;

export class StorageOperationError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Local storage could not ${operation}.`, { cause });
    this.name = "StorageOperationError";
  }
}

export class CategoryOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryOperationError";
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

function openBudgetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener(
      "upgradeneeded",
      () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORES.transactions)) {
          database.createObjectStore(STORES.transactions, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(STORES.categories)) {
          database.createObjectStore(STORES.categories, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(STORES.settings)) {
          database.createObjectStore(STORES.settings, { keyPath: "id" });
        }
      },
      { once: true },
    );

    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Database upgrade was blocked.")), {
      once: true,
    });
  });
}

type DatabaseProvider = () => Promise<IDBDatabase>;

export class BudgetDatabase {
  constructor(private readonly provideDatabase: DatabaseProvider = openBudgetDatabase) {}

  private async perform<T>(operation: string, action: (database: IDBDatabase) => Promise<T>): Promise<T> {
    let database: IDBDatabase | undefined;
    try {
      database = await this.provideDatabase();
      return await action(database);
    } catch (error) {
      if (error instanceof StorageOperationError || error instanceof CategoryOperationError) throw error;
      throw new StorageOperationError(operation, error);
    } finally {
      database?.close();
    }
  }

  async initialize(): Promise<void> {
    return this.perform("initialize", async (database) => {
      const categoryRead = database.transaction(STORES.categories, "readonly");
      const categoryReadDone = transactionCompletion(categoryRead);
      const categoryCount = await requestResult(categoryRead.objectStore(STORES.categories).count());
      await categoryReadDone;

      if (categoryCount === 0) {
        const categoryWrite = database.transaction(STORES.categories, "readwrite");
        const categoryWriteDone = transactionCompletion(categoryWrite);
        const categoryStore = categoryWrite.objectStore(STORES.categories);
        STARTER_CATEGORIES.forEach((category) => categoryStore.put(category));
        await categoryWriteDone;
      }

      const settingsRead = database.transaction(STORES.settings, "readonly");
      const settingsReadDone = transactionCompletion(settingsRead);
      const settings = await requestResult<BudgetSettings | undefined>(
        settingsRead.objectStore(STORES.settings).get(DEFAULT_SETTINGS.id),
      );
      await settingsReadDone;

      if (!settings) {
        const settingsWrite = database.transaction(STORES.settings, "readwrite");
        const settingsWriteDone = transactionCompletion(settingsWrite);
        settingsWrite.objectStore(STORES.settings).put(DEFAULT_SETTINGS);
        await settingsWriteDone;
      }
    });
  }

  async getCategories(includeArchived = true): Promise<Category[]> {
    return this.perform("read categories", async (database) => {
      const transaction = database.transaction(STORES.categories, "readonly");
      const completed = transactionCompletion(transaction);
      const categories = await requestResult<Category[]>(
        transaction.objectStore(STORES.categories).getAll(),
      );
      await completed;
      return categories
        .filter((category) => includeArchived || !category.archived)
        .sort((first, second) => first.sortOrder - second.sortOrder);
    });
  }

  async saveCategory(category: Category): Promise<void> {
    return this.perform("save a category", async (database) => {
      const transaction = database.transaction(STORES.categories, "readwrite");
      const completed = transactionCompletion(transaction);
      transaction.objectStore(STORES.categories).put(category);
      await completed;
    });
  }

  async saveCategories(categories: readonly Category[]): Promise<void> {
    return this.perform("save categories", async (database) => {
      const transaction = database.transaction(STORES.categories, "readwrite");
      const completed = transactionCompletion(transaction);
      const store = transaction.objectStore(STORES.categories);
      categories.forEach((category) => store.put(category));
      await completed;
    });
  }

  async deleteCategory(categoryId: string, replacementCategoryId?: string): Promise<void> {
    return this.perform("delete a category", async (database) => {
      const transaction = database.transaction(
        [STORES.categories, STORES.transactions],
        "readwrite",
      );
      const completed = transactionCompletion(transaction);
      const categoryStore = transaction.objectStore(STORES.categories);
      const transactionStore = transaction.objectStore(STORES.transactions);

      const sourceRequest = requestResult<Category | undefined>(categoryStore.get(categoryId));
      const replacementRequest = replacementCategoryId
        ? requestResult<Category | undefined>(categoryStore.get(replacementCategoryId))
        : Promise.resolve(undefined);
      const transactionsRequest = requestResult<BudgetTransaction[]>(transactionStore.getAll());
      const [source, replacement, transactions] = await Promise.all([
        sourceRequest,
        replacementRequest,
        transactionsRequest,
      ]);

      if (!source) throw new CategoryOperationError("The category no longer exists.");
      if (source.system) throw new CategoryOperationError("System categories cannot be deleted.");

      const affected = transactions.filter((item) => item.categoryId === categoryId);
      if (affected.length > 0) {
        if (!replacementCategoryId || !replacement) {
          throw new CategoryOperationError("Choose where existing transactions should move.");
        }
        if (replacement.id === source.id || replacement.archived) {
          throw new CategoryOperationError("Choose a different active category.");
        }
        affected.forEach((item) => {
          transactionStore.put({ ...item, categoryId: replacement.id });
        });
      }

      categoryStore.delete(categoryId);
      await completed;
    });
  }

  async reassignTransactions(transactionIds: readonly string[], categoryId: string): Promise<void> {
    if (transactionIds.length === 0) return;

    return this.perform("recategorize transactions", async (database) => {
      const transaction = database.transaction(
        [STORES.categories, STORES.transactions],
        "readwrite",
      );
      const completed = transactionCompletion(transaction);
      const categoryStore = transaction.objectStore(STORES.categories);
      const transactionStore = transaction.objectStore(STORES.transactions);

      const categoryRequest = requestResult<Category | undefined>(categoryStore.get(categoryId));
      const itemRequests = transactionIds.map((id) =>
        requestResult<BudgetTransaction | undefined>(transactionStore.get(id)),
      );
      const [category, items] = await Promise.all([categoryRequest, Promise.all(itemRequests)]);

      if (!category || category.archived) {
        throw new CategoryOperationError("Choose an active category.");
      }
      if (items.some((item) => !item)) {
        throw new CategoryOperationError("One or more transactions no longer exist.");
      }

      items.forEach((item) => {
        transactionStore.put({ ...item!, categoryId });
      });
      await completed;
    });
  }

  async saveTransaction(transactionToSave: BudgetTransaction): Promise<void> {
    assertValidTransaction(transactionToSave);

    return this.perform("save a transaction", async (database) => {
      const transaction = database.transaction(STORES.transactions, "readwrite");
      const completed = transactionCompletion(transaction);
      transaction.objectStore(STORES.transactions).put(transactionToSave);
      await completed;
    });
  }

  async getTransactions(): Promise<BudgetTransaction[]> {
    return this.perform("read transactions", async (database) => {
      const transaction = database.transaction(STORES.transactions, "readonly");
      const completed = transactionCompletion(transaction);
      const transactions = await requestResult<BudgetTransaction[]>(
        transaction.objectStore(STORES.transactions).getAll(),
      );
      await completed;
      return transactions.sort((first, second) => second.date.localeCompare(first.date));
    });
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return this.perform("delete a transaction", async (database) => {
      const transaction = database.transaction(STORES.transactions, "readwrite");
      const completed = transactionCompletion(transaction);
      transaction.objectStore(STORES.transactions).delete(transactionId);
      await completed;
    });
  }

  async getSettings(): Promise<BudgetSettings> {
    return this.perform("read settings", async (database) => {
      const transaction = database.transaction(STORES.settings, "readonly");
      const completed = transactionCompletion(transaction);
      const settings = await requestResult<BudgetSettings | undefined>(
        transaction.objectStore(STORES.settings).get(DEFAULT_SETTINGS.id),
      );
      await completed;
      return settings ?? { ...DEFAULT_SETTINGS };
    });
  }

  async saveSettings(settings: BudgetSettings): Promise<void> {
    return this.perform("save settings", async (database) => {
      const transaction = database.transaction(STORES.settings, "readwrite");
      const completed = transactionCompletion(transaction);
      transaction.objectStore(STORES.settings).put(settings);
      await completed;
    });
  }

  async replaceAllData(backup: BudgetBackup): Promise<void> {
    return this.perform("restore a backup", async (database) => {
      const transaction = database.transaction(
        [STORES.transactions, STORES.categories, STORES.settings],
        "readwrite",
      );
      const completed = transactionCompletion(transaction);
      const transactionStore = transaction.objectStore(STORES.transactions);
      const categoryStore = transaction.objectStore(STORES.categories);
      const settingsStore = transaction.objectStore(STORES.settings);
      transactionStore.clear();
      categoryStore.clear();
      settingsStore.clear();
      backup.transactions.forEach((item) => transactionStore.put(item));
      backup.categories.forEach((category) => categoryStore.put(category));
      settingsStore.put(backup.settings);
      await completed;
    });
  }

  async resetAllData(): Promise<void> {
    return this.perform("delete all data", async (database) => {
      const transaction = database.transaction(
        [STORES.transactions, STORES.categories, STORES.settings],
        "readwrite",
      );
      const completed = transactionCompletion(transaction);
      const transactionStore = transaction.objectStore(STORES.transactions);
      const categoryStore = transaction.objectStore(STORES.categories);
      const settingsStore = transaction.objectStore(STORES.settings);
      transactionStore.clear();
      categoryStore.clear();
      settingsStore.clear();
      STARTER_CATEGORIES.forEach((category) => categoryStore.put(category));
      settingsStore.put(DEFAULT_SETTINGS);
      await completed;
    });
  }
}

export const budgetDatabase = new BudgetDatabase();
