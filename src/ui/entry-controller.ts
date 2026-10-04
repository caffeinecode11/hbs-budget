import { budgetDatabase } from "../data/db";
import { isFutureDate, isLikelyDuplicate, localDateIso, parseUsdCents } from "../domain/entry";
import type { BudgetTransaction, Category, TransactionDirection } from "../domain/models";

type DateMode = "today" | "historical";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required entry control is missing: ${selector}`);
  return element;
}

function readableDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    parsed,
  );
}

function transactionId(): string {
  return crypto.randomUUID?.() ?? `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

export function setupExpenseEntry(categories: readonly Category[]): void {
  const form = requiredElement<HTMLFormElement>("#entry-form");
  const amountInput = requiredElement<HTMLInputElement>("#amount");
  const categorySelect = requiredElement<HTMLSelectElement>("#category");
  const dateInput = requiredElement<HTMLInputElement>("#date");
  const descriptionInput = requiredElement<HTMLInputElement>("#description");
  const directionSelect = requiredElement<HTMLSelectElement>("#direction");
  const todayButton = requiredElement<HTMLButtonElement>("#date-mode-today");
  const earlierButton = requiredElement<HTMLButtonElement>("#date-mode-earlier");
  const historicalDate = requiredElement<HTMLElement>("#historical-date");
  const datePill = requiredElement<HTMLElement>("#selected-date-pill");
  const saveButton = requiredElement<HTMLButtonElement>("#save-expense");
  const message = requiredElement<HTMLElement>("#entry-message");
  const successPanel = requiredElement<HTMLElement>("#entry-success");
  const successText = requiredElement<HTMLElement>("#entry-success-text");
  const addAnother = requiredElement<HTMLButtonElement>("#add-another");
  const doneButton = requiredElement<HTMLButtonElement>("#entry-done");
  const warningDialog = requiredElement<HTMLDialogElement>("#entry-warning-dialog");
  const warningText = requiredElement<HTMLElement>("#entry-warning-text");
  const warningCancel = requiredElement<HTMLButtonElement>("#warning-cancel");
  const warningConfirm = requiredElement<HTMLButtonElement>("#warning-confirm");

  let dateMode: DateMode = "today";
  let pendingTransaction: BudgetTransaction | null = null;
  let availableCategories = [...categories];

  const controls: Array<HTMLInputElement | HTMLSelectElement | HTMLButtonElement> = [
    amountInput,
    categorySelect,
    dateInput,
    descriptionInput,
    directionSelect,
    todayButton,
    earlierButton,
    saveButton,
  ];

  function setControlsDisabled(disabled: boolean): void {
    controls.forEach((control) => {
      control.disabled = disabled;
    });
  }

  function setMessage(text = "", tone: "error" | "neutral" = "neutral"): void {
    message.textContent = text;
    message.hidden = text.length === 0;
    message.classList.toggle("entry-message--error", tone === "error");
  }

  function setDateMode(mode: DateMode): void {
    dateMode = mode;
    const today = localDateIso();
    todayButton.setAttribute("aria-pressed", String(mode === "today"));
    earlierButton.setAttribute("aria-pressed", String(mode === "historical"));
    historicalDate.hidden = mode === "today";

    if (mode === "today") {
      dateInput.value = today;
      datePill.textContent = "Today";
    } else {
      if (!dateInput.value) dateInput.value = today;
      datePill.textContent = readableDate(dateInput.value);
    }
  }

  function renderCategoryOptions(nextCategories: readonly Category[]): void {
    const selected = categorySelect.value;
    availableCategories = [...nextCategories];
    categorySelect.replaceChildren(
      new Option("Select category", ""),
      ...availableCategories.map((category) => new Option(category.name, category.id)),
    );
    if (availableCategories.some((category) => category.id === selected)) {
      categorySelect.value = selected;
    }
  }

  function resetFields(keepDate: boolean): void {
    amountInput.value = "";
    categorySelect.value = "";
    descriptionInput.value = "";
    directionSelect.value = "outgoing";
    setMessage();
    successPanel.hidden = true;
    form.classList.remove("entry-form--saved");
    setControlsDisabled(false);

    if (!keepDate) setDateMode("today");
    amountInput.focus();
  }

  function buildTransaction(): BudgetTransaction | null {
    const amountCents = parseUsdCents(amountInput.value);
    if (amountCents === null) {
      setMessage("Enter a valid USD amount greater than $0.", "error");
      amountInput.focus();
      return null;
    }

    if (!categorySelect.value) {
      setMessage("Choose a category before saving.", "error");
      categorySelect.focus();
      return null;
    }

    if (!dateInput.value) {
      setMessage("Choose a transaction date before saving.", "error");
      dateInput.focus();
      return null;
    }

    return {
      id: transactionId(),
      amountCents,
      date: dateInput.value,
      description: descriptionInput.value.trim() || undefined,
      direction: directionSelect.value as TransactionDirection,
      categoryId: categorySelect.value,
      source: "manual",
      createdAt: new Date().toISOString(),
      excludedFromProjection: false,
    };
  }

  async function persistTransaction(transaction: BudgetTransaction): Promise<void> {
    closeDialog(warningDialog);
    pendingTransaction = null;
    setControlsDisabled(true);
    saveButton.textContent = "Saving…";
    setMessage();

    try {
      await budgetDatabase.saveTransaction(transaction);
      const categoryName = availableCategories.find(
        (category) => category.id === transaction.categoryId,
      )?.name;
      const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
        transaction.amountCents / 100,
      );
      successText.textContent = `${amount} · ${categoryName ?? "Uncategorized"} · ${readableDate(transaction.date)}`;
      successPanel.hidden = false;
      form.classList.add("entry-form--saved");
      window.dispatchEvent(new CustomEvent("budget:transaction-saved"));
    } catch {
      setControlsDisabled(false);
      setMessage("This entry could not be saved locally. Nothing was added.", "error");
    } finally {
      saveButton.textContent = "Save expense";
    }
  }

  async function reviewAndSave(): Promise<void> {
    const transaction = buildTransaction();
    if (!transaction) return;

    saveButton.disabled = true;
    try {
      const existing = await budgetDatabase.getTransactions();
      const warnings: string[] = [];
      if (isFutureDate(transaction.date)) {
        warnings.push("This date is in the future.");
      }
      if (isLikelyDuplicate(transaction, existing)) {
        warnings.push("A transaction with the same amount, date, category, and type already exists.");
      }

      if (warnings.length > 0) {
        pendingTransaction = transaction;
        warningText.textContent = `${warnings.join(" ")} Save it anyway?`;
        openDialog(warningDialog);
        return;
      }

      await persistTransaction(transaction);
    } catch {
      setMessage("The app could not check existing entries. Nothing was saved.", "error");
    } finally {
      if (!form.classList.contains("entry-form--saved")) saveButton.disabled = false;
    }
  }

  renderCategoryOptions(categories);
  dateInput.value = localDateIso();
  setDateMode("today");
  setControlsDisabled(false);

  todayButton.addEventListener("click", () => setDateMode("today"));
  earlierButton.addEventListener("click", () => {
    setDateMode("historical");
    dateInput.focus();
    dateInput.showPicker?.();
  });
  dateInput.addEventListener("change", () => {
    if (dateMode === "historical" && dateInput.value) {
      datePill.textContent = readableDate(dateInput.value);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void reviewAndSave();
  });
  addAnother.addEventListener("click", () => resetFields(dateMode === "historical"));
  doneButton.addEventListener("click", () => resetFields(false));
  warningCancel.addEventListener("click", () => {
    pendingTransaction = null;
    closeDialog(warningDialog);
    saveButton.disabled = false;
  });
  warningConfirm.addEventListener("click", () => {
    if (pendingTransaction) void persistTransaction(pendingTransaction);
  });
  warningDialog.addEventListener("cancel", () => {
    pendingTransaction = null;
    saveButton.disabled = false;
  });
  window.addEventListener("budget:categories-changed", () => {
    void budgetDatabase.getCategories(false).then(renderCategoryOptions).catch(() => {
      setMessage("Updated categories could not be loaded. Try reopening the app.", "error");
    });
  });
}
