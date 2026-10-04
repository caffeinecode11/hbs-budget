import { budgetDatabase } from "../data/db";
import { createBackup, type BudgetBackup, validateBackup } from "../domain/backup";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) dialog.close();
}

function announceDataChanged(): void {
  window.dispatchEvent(new CustomEvent("budget:categories-changed"));
  window.dispatchEvent(new CustomEvent("budget:transactions-changed"));
}

function backupFilename(now = new Date()): string {
  return `hbs-budget-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function setupPrivacyAndData(): void {
  const openButton = requireElement<HTMLButtonElement>("#open-data-privacy");
  const closeButton = requireElement<HTMLButtonElement>("#close-data-privacy");
  const dialog = requireElement<HTMLDialogElement>("#data-privacy-dialog");
  const persistenceStatus = requireElement<HTMLElement>("#persistence-status");
  const offlineStatus = requireElement<HTMLElement>("#offline-status");
  const dataCounts = requireElement<HTMLElement>("#data-counts");
  const storageSummary = requireElement<HTMLElement>("#storage-summary");
  const feedback = requireElement<HTMLElement>("#data-privacy-feedback");
  const downloadButton = requireElement<HTMLButtonElement>("#download-backup");
  const restoreButton = requireElement<HTMLButtonElement>("#restore-backup");
  const restoreFile = requireElement<HTMLInputElement>("#restore-file");
  const restoreDialog = requireElement<HTMLDialogElement>("#restore-confirm-dialog");
  const restoreCopy = requireElement<HTMLElement>("#restore-copy");
  const cancelRestore = requireElement<HTMLButtonElement>("#cancel-restore");
  const confirmRestore = requireElement<HTMLButtonElement>("#confirm-restore");
  const requestDeleteAll = requireElement<HTMLButtonElement>("#request-delete-all");
  const deleteDialog = requireElement<HTMLDialogElement>("#delete-all-dialog");
  const cancelDeleteAll = requireElement<HTMLButtonElement>("#cancel-delete-all");
  const confirmDeleteAll = requireElement<HTMLButtonElement>("#confirm-delete-all");
  const privacyCover = requireElement<HTMLElement>("#privacy-cover");
  const dismissPrivacyCover = requireElement<HTMLButtonElement>("#dismiss-privacy-cover");
  let pendingRestore: BudgetBackup | null = null;
  let offlineReady = false;

  const showFeedback = (message: string, isError = false): void => {
    feedback.textContent = message;
    feedback.classList.toggle("view-feedback--error", isError);
    feedback.hidden = false;
  };

  const refreshCounts = async (): Promise<void> => {
    const [transactions, categories] = await Promise.all([
      budgetDatabase.getTransactions(),
      budgetDatabase.getCategories(),
    ]);
    const transactionLabel = transactions.length === 1 ? "transaction" : "transactions";
    const categoryLabel = categories.length === 1 ? "category" : "categories";
    dataCounts.textContent = `${transactions.length} ${transactionLabel} · ${categories.length} ${categoryLabel}`;
  };

  const updateConnectionStatus = (): void => {
    offlineStatus.textContent = navigator.onLine
      ? offlineReady
        ? "Online · offline copy ready"
        : "Online · preparing offline copy"
      : "Offline · using saved app";
    offlineStatus.classList.toggle("status-good", !navigator.onLine);
  };

  const updatePersistenceStatus = async (): Promise<void> => {
    if (!navigator.storage?.persisted) {
      persistenceStatus.textContent = "Local storage · backup recommended";
      return;
    }

    try {
      const alreadyPersistent = await navigator.storage.persisted();
      const persistent = alreadyPersistent || (navigator.storage.persist && (await navigator.storage.persist()));
      if (persistent) {
        persistenceStatus.textContent = "Persistent on this device";
        persistenceStatus.classList.add("status-good");
        storageSummary.textContent = "Private local storage · persistence granted";
      } else {
        persistenceStatus.textContent = "Best-effort · backup recommended";
        storageSummary.textContent = "Private local storage · create regular backups";
      }
    } catch {
      persistenceStatus.textContent = "Local storage · backup recommended";
    }
  };

  const registerOfflineApp = async (): Promise<void> => {
    if (!("serviceWorker" in navigator)) {
      offlineStatus.textContent = "Offline loading is not supported here";
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      const worker = registration.installing ?? registration.waiting ?? registration.active;
      offlineReady = Boolean(registration.active || worker?.state === "installed");
      updateConnectionStatus();
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" || worker.state === "activated") {
          offlineReady = true;
          updateConnectionStatus();
        }
        if (worker.state === "redundant") {
          offlineStatus.textContent = "Offline setup failed · stay online";
          offlineStatus.classList.add("status-warning");
        }
      });
    } catch {
      offlineStatus.textContent = "Offline setup failed · stay online";
      offlineStatus.classList.add("status-warning");
    }
  };

  const coverFinancialDetails = (): void => {
    privacyCover.hidden = false;
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") coverFinancialDetails();
  });
  window.addEventListener("pagehide", coverFinancialDetails);
  dismissPrivacyCover.addEventListener("click", () => {
    privacyCover.hidden = true;
  });

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);

  openButton.addEventListener("click", () => {
    feedback.hidden = true;
    openDialog(dialog);
    void refreshCounts().catch(() => showFeedback("Saved-data totals could not be read.", true));
  });
  closeButton.addEventListener("click", () => closeDialog(dialog));

  downloadButton.addEventListener("click", async () => {
    downloadButton.disabled = true;
    feedback.hidden = true;
    try {
      const [transactions, categories, settings] = await Promise.all([
        budgetDatabase.getTransactions(),
        budgetDatabase.getCategories(),
        budgetDatabase.getSettings(),
      ]);
      const backup = createBackup(transactions, categories, settings);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFilename();
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      showFeedback("Backup downloaded. Keep the file private.");
    } catch {
      showFeedback("The backup could not be created. Your app data was not changed.", true);
    } finally {
      downloadButton.disabled = false;
    }
  });

  restoreButton.addEventListener("click", () => {
    restoreFile.value = "";
    restoreFile.click();
  });

  restoreFile.addEventListener("change", async () => {
    const file = restoreFile.files?.[0];
    if (!file) return;
    feedback.hidden = true;
    if (file.size > 5_000_000) {
      showFeedback("That backup is too large to open safely. Nothing was changed.", true);
      return;
    }

    try {
      pendingRestore = validateBackup(JSON.parse(await file.text()));
      const count = pendingRestore.transactions.length;
      restoreCopy.textContent = `This verified backup contains ${count} ${count === 1 ? "transaction" : "transactions"} and ${pendingRestore.categories.length} categories. Restoring replaces everything currently in the app.`;
      openDialog(restoreDialog);
    } catch {
      pendingRestore = null;
      showFeedback("This file is not a valid HBS Budget backup. Nothing was changed.", true);
    }
  });

  cancelRestore.addEventListener("click", () => {
    pendingRestore = null;
    closeDialog(restoreDialog);
  });

  confirmRestore.addEventListener("click", async () => {
    if (!pendingRestore) return;
    confirmRestore.disabled = true;
    try {
      await budgetDatabase.replaceAllData(pendingRestore);
      pendingRestore = null;
      closeDialog(restoreDialog);
      await refreshCounts();
      showFeedback("Backup restored. All views now use the restored data.");
      announceDataChanged();
    } catch {
      showFeedback("The backup could not be restored. Your current data was not changed.", true);
    } finally {
      confirmRestore.disabled = false;
    }
  });

  requestDeleteAll.addEventListener("click", () => openDialog(deleteDialog));
  cancelDeleteAll.addEventListener("click", () => closeDialog(deleteDialog));
  confirmDeleteAll.addEventListener("click", async () => {
    confirmDeleteAll.disabled = true;
    try {
      await budgetDatabase.resetAllData();
      closeDialog(deleteDialog);
      await refreshCounts();
      showFeedback("All app data was deleted. Starter categories are ready for a fresh start.");
      announceDataChanged();
    } catch {
      closeDialog(deleteDialog);
      showFeedback("The data could not be deleted. Nothing was changed.", true);
    } finally {
      confirmDeleteAll.disabled = false;
    }
  });

  updateConnectionStatus();
  void updatePersistenceStatus();
  void registerOfflineApp();
}
