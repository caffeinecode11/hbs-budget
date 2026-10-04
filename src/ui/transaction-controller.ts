import { budgetDatabase } from "../data/db";
import { parseUsdCents } from "../domain/entry";
import type { BudgetTransaction, Category } from "../domain/models";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required transaction control is missing: ${selector}`);
  return element;
}

function formatMoney(amountCents: number, direction: BudgetTransaction["direction"]): string {
  const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    amountCents / 100,
  );
  return direction === "incoming" ? `+${amount}` : amount;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

export function setupTransactionHistory(): void {
  const list = requiredElement<HTMLElement>("#transaction-list");
  const empty = requiredElement<HTMLElement>("#transactions-empty");
  const bulkBar = requiredElement<HTMLElement>("#bulk-bar");
  const bulkCount = requiredElement<HTMLElement>("#bulk-count");
  const bulkCategory = requiredElement<HTMLSelectElement>("#bulk-category");
  const bulkApply = requiredElement<HTMLButtonElement>("#apply-bulk-category");
  const feedback = requiredElement<HTMLElement>("#transaction-feedback");
  const editor = requiredElement<HTMLDialogElement>("#transaction-dialog");
  const closeEditor = requiredElement<HTMLButtonElement>("#close-transaction");
  const editForm = requiredElement<HTMLFormElement>("#transaction-form");
  const editAmount = requiredElement<HTMLInputElement>("#edit-amount");
  const editCategory = requiredElement<HTMLSelectElement>("#edit-category");
  const editDate = requiredElement<HTMLInputElement>("#edit-date");
  const editDescription = requiredElement<HTMLInputElement>("#edit-description");
  const editDirection = requiredElement<HTMLSelectElement>("#edit-direction");
  const editExcluded = requiredElement<HTMLInputElement>("#edit-excluded");
  const editError = requiredElement<HTMLElement>("#transaction-edit-error");
  const requestDelete = requiredElement<HTMLButtonElement>("#request-delete-transaction");
  const deleteDialog = requiredElement<HTMLDialogElement>("#delete-transaction-dialog");
  const cancelDelete = requiredElement<HTMLButtonElement>("#cancel-delete-transaction");
  const confirmDelete = requiredElement<HTMLButtonElement>("#confirm-delete-transaction");
  const selected = new Set<string>();
  let editingTransaction: BudgetTransaction | null = null;

  function setFeedback(text = "", error = false): void {
    feedback.textContent = text;
    feedback.hidden = text.length === 0;
    feedback.classList.toggle("view-feedback--error", error);
  }

  function updateBulkBar(): void {
    bulkBar.hidden = selected.size === 0;
    bulkCount.textContent = `${selected.size} selected`;
  }

  function categoryOptions(
    select: HTMLSelectElement,
    activeCategories: readonly Category[],
    current?: Category,
  ): void {
    const options: HTMLOptionElement[] = [];
    if (current?.archived) {
      const archived = new Option(`${current.name} (Archived)`, current.id, true, true);
      archived.disabled = true;
      options.push(archived);
    }
    options.push(...activeCategories.map((category) => new Option(category.name, category.id)));
    select.replaceChildren(...options);
    if (current && !current.archived) select.value = current.id;
  }

  function createTransactionRow(
    item: BudgetTransaction,
    categories: readonly Category[],
    activeCategories: readonly Category[],
  ): HTMLElement {
    const row = document.createElement("article");
    row.className = "transaction-row";
    row.dataset.transactionId = item.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(item.id);
    checkbox.setAttribute(
      "aria-label",
      `Select ${formatMoney(item.amountCents, item.direction)} on ${formatDate(item.date)}`,
    );
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(item.id);
      else selected.delete(item.id);
      updateBulkBar();
    });

    const details = document.createElement("div");
    details.className = "transaction-row__details";
    const title = document.createElement("strong");
    title.textContent = item.description || (item.direction === "incoming" ? "Money in" : "Expense");
    const date = document.createElement("small");
    date.textContent = formatDate(item.date);
    details.append(title, date);

    const amount = document.createElement("strong");
    amount.className = item.direction === "incoming" ? "transaction-row__amount incoming" : "transaction-row__amount";
    amount.textContent = formatMoney(item.amountCents, item.direction);

    const category = document.createElement("select");
    category.className = "transaction-row__category";
    category.setAttribute("aria-label", `Category for ${title.textContent}`);
    const current = categories.find((candidate) => candidate.id === item.categoryId);
    categoryOptions(category, activeCategories, current);
    category.addEventListener("change", async () => {
      category.disabled = true;
      setFeedback();
      try {
        await budgetDatabase.reassignTransactions([item.id], category.value);
        setFeedback("Category updated.");
        await refresh();
        window.dispatchEvent(new CustomEvent("budget:transactions-changed"));
      } catch {
        setFeedback("The category could not be updated. Nothing changed.", true);
        await refresh();
      } finally {
        category.disabled = false;
      }
    });

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "transaction-row__edit";
    edit.textContent = item.excludedFromProjection ? "Edit · Excluded from forecast" : "Edit details";
    edit.setAttribute("aria-label", `Edit ${title.textContent}`);
    edit.addEventListener("click", () => {
      editingTransaction = item;
      editAmount.value = (item.amountCents / 100).toFixed(2);
      categoryOptions(editCategory, activeCategories, current);
      editDate.value = item.date;
      editDescription.value = item.description ?? "";
      editDirection.value = item.direction;
      editExcluded.checked = item.excludedFromProjection;
      editError.hidden = true;
      openDialog(editor);
    });

    row.append(checkbox, details, amount, category, edit);
    return row;
  }

  async function refresh(): Promise<void> {
    try {
      const [transactions, categories] = await Promise.all([
        budgetDatabase.getTransactions(),
        budgetDatabase.getCategories(),
      ]);
      const activeCategories = categories.filter((category) => !category.archived);
      const liveIds = new Set(transactions.map((transaction) => transaction.id));
      [...selected].forEach((id) => {
        if (!liveIds.has(id)) selected.delete(id);
      });

      bulkCategory.replaceChildren(
        new Option("Choose category", ""),
        ...activeCategories.map((category) => new Option(category.name, category.id)),
      );
      list.replaceChildren(
        ...transactions.map((transaction) =>
          createTransactionRow(transaction, categories, activeCategories),
        ),
      );
      empty.hidden = transactions.length > 0;
      updateBulkBar();
    } catch {
      setFeedback("Transaction history is unavailable. No data was changed.", true);
    }
  }

  bulkApply.addEventListener("click", async () => {
    if (!bulkCategory.value) {
      setFeedback("Choose a category for the selected transactions.", true);
      return;
    }

    bulkApply.disabled = true;
    setFeedback();
    try {
      await budgetDatabase.reassignTransactions([...selected], bulkCategory.value);
      const count = selected.size;
      selected.clear();
      setFeedback(`${count} ${count === 1 ? "transaction" : "transactions"} updated.`);
      await refresh();
      window.dispatchEvent(new CustomEvent("budget:transactions-changed"));
    } catch {
      setFeedback("The selected transactions could not be updated. Nothing changed.", true);
    } finally {
      bulkApply.disabled = false;
    }
  });

  closeEditor.addEventListener("click", () => {
    editingTransaction = null;
    closeDialog(editor);
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingTransaction) return;
    const amountCents = parseUsdCents(editAmount.value);
    if (amountCents === null || !editCategory.value || !editDate.value) {
      editError.textContent = "Enter a valid amount, category, and date.";
      editError.hidden = false;
      return;
    }

    const updated: BudgetTransaction = {
      ...editingTransaction,
      amountCents,
      categoryId: editCategory.value,
      date: editDate.value,
      description: editDescription.value.trim() || undefined,
      direction: editDirection.value as BudgetTransaction["direction"],
      excludedFromProjection: editExcluded.checked,
    };

    try {
      await budgetDatabase.saveTransaction(updated);
      editingTransaction = null;
      closeDialog(editor);
      setFeedback("Transaction updated.");
      await refresh();
      window.dispatchEvent(new CustomEvent("budget:transactions-changed"));
    } catch {
      editError.textContent = "The transaction could not be updated. Nothing changed.";
      editError.hidden = false;
    }
  });

  requestDelete.addEventListener("click", () => {
    if (editingTransaction) openDialog(deleteDialog);
  });
  cancelDelete.addEventListener("click", () => closeDialog(deleteDialog));
  confirmDelete.addEventListener("click", async () => {
    if (!editingTransaction) return;
    confirmDelete.disabled = true;
    try {
      await budgetDatabase.deleteTransaction(editingTransaction.id);
      editingTransaction = null;
      closeDialog(deleteDialog);
      closeDialog(editor);
      setFeedback("Transaction deleted.");
      await refresh();
      window.dispatchEvent(new CustomEvent("budget:transactions-changed"));
    } catch {
      closeDialog(deleteDialog);
      editError.textContent = "The transaction could not be deleted. Nothing changed.";
      editError.hidden = false;
    } finally {
      confirmDelete.disabled = false;
    }
  });

  window.addEventListener("budget:transaction-saved", () => void refresh());
  window.addEventListener("budget:categories-changed", () => void refresh());
  void refresh();
}
