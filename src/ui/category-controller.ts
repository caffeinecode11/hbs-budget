import { budgetDatabase } from "../data/db";
import type { Category } from "../domain/models";

const CATEGORY_COLORS = ["#8F3150", "#D16A45", "#3F7391", "#72558A", "#267D70", "#B14E79"];

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required category control is missing: ${selector}`);
  return element;
}

function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function categoryId(): string {
  return crypto.randomUUID?.() ?? `category-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function setupCategoryManager(): void {
  const openButton = requiredElement<HTMLButtonElement>("#open-categories");
  const dialog = requiredElement<HTMLDialogElement>("#category-dialog");
  const closeButton = requiredElement<HTMLButtonElement>("#close-categories");
  const addForm = requiredElement<HTMLFormElement>("#new-category-form");
  const nameInput = requiredElement<HTMLInputElement>("#new-category-name");
  const list = requiredElement<HTMLElement>("#category-list");
  const feedback = requiredElement<HTMLElement>("#category-feedback");
  const deleteDialog = requiredElement<HTMLDialogElement>("#delete-category-dialog");
  const deleteCopy = requiredElement<HTMLElement>("#delete-category-copy");
  const replacementField = requiredElement<HTMLElement>("#replacement-category-field");
  const replacementSelect = requiredElement<HTMLSelectElement>("#replacement-category");
  const deleteError = requiredElement<HTMLElement>("#delete-category-error");
  const cancelDelete = requiredElement<HTMLButtonElement>("#cancel-delete-category");
  const confirmDelete = requiredElement<HTMLButtonElement>("#confirm-delete-category");

  let categories: Category[] = [];
  let pendingDelete: { category: Category; affectedCount: number } | null = null;

  function setFeedback(text = "", error = false): void {
    feedback.textContent = text;
    feedback.hidden = text.length === 0;
    feedback.classList.toggle("view-feedback--error", error);
  }

  function emitCategoriesChanged(): void {
    window.dispatchEvent(new CustomEvent("budget:categories-changed"));
  }

  function isDuplicateName(name: string, exceptId?: string): boolean {
    const normalized = name.trim().toLocaleLowerCase();
    return categories.some(
      (category) => category.id !== exceptId && category.name.toLocaleLowerCase() === normalized,
    );
  }

  function actionButton(label: string, action: string, category: Category): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-action";
    button.dataset.action = action;
    button.dataset.categoryId = category.id;
    button.textContent = label;
    button.setAttribute("aria-label", `${label} ${category.name}`);
    return button;
  }

  function createCategoryRow(category: Category, orderedGroup: readonly Category[]): HTMLElement {
    const row = document.createElement("article");
    row.className = category.archived ? "category-row category-row--archived" : "category-row";
    row.dataset.categoryId = category.id;

    const swatch = document.createElement("span");
    swatch.className = "category-swatch";
    swatch.style.backgroundColor = category.color;
    swatch.setAttribute("aria-hidden", "true");

    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 40;
    name.value = category.name;
    name.dataset.nameInput = category.id;
    name.setAttribute("aria-label", `Name for ${category.name}`);
    name.disabled = category.system;

    const actions = document.createElement("div");
    actions.className = "category-row__actions";

    if (category.system) {
      const badge = document.createElement("small");
      badge.className = "system-badge";
      badge.textContent = "System";
      actions.append(badge);
    } else {
      actions.append(actionButton("Save", "rename", category));
      const movableGroup = orderedGroup.filter((candidate) => !candidate.system);
      const position = movableGroup.findIndex((candidate) => candidate.id === category.id);
      const up = actionButton("↑", "up", category);
      const down = actionButton("↓", "down", category);
      up.disabled = position <= 0;
      down.disabled = position === movableGroup.length - 1;
      actions.append(up, down);
      actions.append(
        actionButton(category.archived ? "Restore" : "Archive", "archive", category),
        actionButton("Delete", "delete", category),
      );
    }

    row.append(swatch, name, actions);
    return row;
  }

  function render(): void {
    const active = categories.filter((category) => !category.archived);
    const archived = categories.filter((category) => category.archived);
    const fragments: HTMLElement[] = [];

    if (active.length > 0) {
      const heading = document.createElement("h3");
      heading.className = "category-list__heading";
      heading.textContent = "Available for new entries";
      fragments.push(heading, ...active.map((category) => createCategoryRow(category, active)));
    }
    if (archived.length > 0) {
      const heading = document.createElement("h3");
      heading.className = "category-list__heading";
      heading.textContent = "Archived history";
      fragments.push(heading, ...archived.map((category) => createCategoryRow(category, archived)));
    }

    list.replaceChildren(...fragments);
  }

  async function refresh(): Promise<void> {
    try {
      categories = await budgetDatabase.getCategories();
      render();
    } catch {
      setFeedback("Categories are unavailable. No data was changed.", true);
    }
  }

  async function saveAndRefresh(updated: Category | readonly Category[], success: string): Promise<void> {
    try {
      if (Array.isArray(updated)) await budgetDatabase.saveCategories(updated);
      else await budgetDatabase.saveCategory(updated as Category);
      setFeedback(success);
      await refresh();
      emitCategoriesChanged();
    } catch {
      setFeedback("The category change could not be saved. Nothing changed.", true);
    }
  }

  openButton.addEventListener("click", () => {
    setFeedback();
    void refresh();
    openDialog(dialog);
  });
  closeButton.addEventListener("click", () => closeDialog(dialog));

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      setFeedback("Enter a category name.", true);
      return;
    }
    if (isDuplicateName(name)) {
      setFeedback("A category with that name already exists.", true);
      return;
    }

    const category: Category = {
      id: categoryId(),
      name,
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
      sortOrder: Math.max(-1, ...categories.map((item) => item.sortOrder)) + 1,
      archived: false,
      system: false,
    };
    nameInput.value = "";
    void saveAndRefresh(category, `${name} added.`);
  });

  list.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-action]");
    if (!button) return;
    const category = categories.find((item) => item.id === button.dataset.categoryId);
    if (!category) return;

    if (button.dataset.action === "rename") {
      const input = list.querySelector<HTMLInputElement>(`[data-name-input="${category.id}"]`);
      const name = input?.value.trim() ?? "";
      if (!name) {
        setFeedback("A category name cannot be blank.", true);
      } else if (isDuplicateName(name, category.id)) {
        setFeedback("A category with that name already exists.", true);
      } else {
        void saveAndRefresh({ ...category, name }, `${category.name} renamed to ${name}.`);
      }
      return;
    }

    if (button.dataset.action === "archive") {
      void saveAndRefresh(
        { ...category, archived: !category.archived },
        category.archived ? `${category.name} restored.` : `${category.name} archived.`,
      );
      return;
    }

    if (button.dataset.action === "up" || button.dataset.action === "down") {
      const group = categories.filter((item) => item.archived === category.archived && !item.system);
      const position = group.findIndex((item) => item.id === category.id);
      const otherPosition = button.dataset.action === "up" ? position - 1 : position + 1;
      const other = group[otherPosition];
      if (!other) return;
      void saveAndRefresh(
        [
          { ...category, sortOrder: other.sortOrder },
          { ...other, sortOrder: category.sortOrder },
        ],
        `${category.name} reordered.`,
      );
      return;
    }

    if (button.dataset.action === "delete") {
      void Promise.all([budgetDatabase.getTransactions(), budgetDatabase.getCategories(false)])
        .then(([transactions, active]) => {
          const affectedCount = transactions.filter((item) => item.categoryId === category.id).length;
          pendingDelete = { category, affectedCount };
          deleteCopy.textContent =
            affectedCount > 0
              ? `${category.name} has ${affectedCount} ${affectedCount === 1 ? "transaction" : "transactions"}. Choose where to move them before deleting it.`
              : `${category.name} has no transactions. Deleting it will remove it from category options.`;
          replacementField.hidden = affectedCount === 0;
          replacementSelect.replaceChildren(
            new Option("Choose category", ""),
            ...active
              .filter((item) => item.id !== category.id)
              .map((item) => new Option(item.name, item.id)),
          );
          deleteError.hidden = true;
          openDialog(deleteDialog);
        })
        .catch(() => setFeedback("The category details could not be loaded.", true));
    }
  });

  cancelDelete.addEventListener("click", () => {
    pendingDelete = null;
    closeDialog(deleteDialog);
  });
  confirmDelete.addEventListener("click", async () => {
    if (!pendingDelete) return;
    if (pendingDelete.affectedCount > 0 && !replacementSelect.value) {
      deleteError.textContent = "Choose where the existing transactions should move.";
      deleteError.hidden = false;
      return;
    }

    confirmDelete.disabled = true;
    try {
      await budgetDatabase.deleteCategory(
        pendingDelete.category.id,
        pendingDelete.affectedCount > 0 ? replacementSelect.value : undefined,
      );
      const deletedName = pendingDelete.category.name;
      pendingDelete = null;
      closeDialog(deleteDialog);
      setFeedback(`${deletedName} deleted; transaction history was preserved.`);
      await refresh();
      emitCategoriesChanged();
    } catch {
      deleteError.textContent = "The category could not be deleted. Nothing changed.";
      deleteError.hidden = false;
    } finally {
      confirmDelete.disabled = false;
    }
  });

  void refresh();
}
