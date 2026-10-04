import "./styles.css";
import { budgetDatabase } from "./data/db";
import { setupCategoryManager } from "./ui/category-controller";
import { setupExpenseEntry } from "./ui/entry-controller";
import { setupOverview } from "./ui/overview-controller";
import { setupPrivacyAndData } from "./ui/privacy-controller";
import { setupTransactionHistory } from "./ui/transaction-controller";

type ViewId = "add" | "transactions" | "overview" | "settings";

const navItems: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "add", label: "Add", icon: "+" },
  { id: "transactions", label: "Transactions", icon: "☷" },
  { id: "overview", label: "Overview", icon: "▥" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const iosNavigator = navigator as Navigator & { standalone?: boolean };
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">MBA money, made clear</p>
        <h1>HBS Budget</h1>
      </div>
      <span class="mode-badge ${isStandalone ? "mode-badge--installed" : ""}">
        ${isStandalone ? "Installed" : "Browser preview"}
      </span>
    </header>

    ${
      isStandalone
        ? ""
        : `
          <aside class="install-card" aria-labelledby="install-title">
            <div class="install-card__icon" aria-hidden="true">↗</div>
            <div>
              <p class="install-card__label">Install before using real data</p>
              <h2 id="install-title">Add this app to your iPhone Home Screen</h2>
              <p>In Safari, tap Share, choose <strong>Add to Home Screen</strong>, and keep <strong>Open as Web App</strong> turned on. Data entered in this browser tab may not transfer to the installed app.</p>
            </div>
          </aside>
        `
    }

    <main class="main-content">
      <section class="view" data-view="add" aria-labelledby="add-title">
        <div class="view-heading">
          <div>
            <p class="section-label">Quick entry</p>
            <h2 id="add-title">What did you spend?</h2>
          </div>
          <span class="today-pill" id="selected-date-pill">Today</span>
        </div>

        <div class="entry-card">
          <form id="entry-form" novalidate>
            <label class="field-label" for="amount">Amount</label>
            <div class="amount-field">
              <span aria-hidden="true">$</span>
              <input id="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" disabled />
            </div>

            <label class="field-label" for="category">Category</label>
            <select id="category" disabled>
              <option>Preparing categories…</option>
            </select>

            <fieldset class="date-mode">
              <legend class="field-label">When?</legend>
              <div class="segmented-control">
                <button id="date-mode-today" type="button" aria-pressed="true" disabled>Today</button>
                <button id="date-mode-earlier" type="button" aria-pressed="false" disabled>Earlier</button>
              </div>
            </fieldset>

            <div id="historical-date" class="historical-date" hidden>
              <label class="field-label" for="date">Historical date</label>
              <input id="date" type="date" disabled />
              <p>This date stays selected only when you choose Add another.</p>
            </div>

            <details class="optional-details">
              <summary>Add note or record money in</summary>
              <div class="optional-details__content">
                <div>
                  <label class="field-label" for="description">Merchant or note</label>
                  <input id="description" type="text" maxlength="120" autocomplete="off" disabled />
                </div>
                <div>
                  <label class="field-label" for="direction">Transaction type</label>
                  <select id="direction" disabled>
                    <option value="outgoing">Cash outflow</option>
                    <option value="incoming">Money in</option>
                  </select>
                </div>
              </div>
            </details>

            <p class="entry-message" id="entry-message" role="alert" hidden></p>
            <button class="primary-button" id="save-expense" type="submit" disabled>Save expense</button>
            <p class="step-note" id="storage-note">Preparing private on-device storage…</p>
          </form>

          <div class="entry-success" id="entry-success" role="status" hidden>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Saved on this device</strong>
              <p id="entry-success-text"></p>
            </div>
            <div class="entry-success__actions">
              <button class="primary-button" id="add-another" type="button">Add another</button>
              <button class="secondary-button" id="entry-done" type="button">Done</button>
            </div>
          </div>
        </div>

        <dialog class="warning-dialog" id="entry-warning-dialog" aria-labelledby="warning-title">
          <p class="section-label">Check this entry</p>
          <h3 id="warning-title">Before you save</h3>
          <p id="entry-warning-text"></p>
          <div class="warning-dialog__actions">
            <button class="secondary-button" id="warning-cancel" type="button">Go back</button>
            <button class="primary-button" id="warning-confirm" type="button">Save anyway</button>
          </div>
        </dialog>

        <div class="promise-row" aria-label="Product promises">
          <div><span aria-hidden="true">◉</span><strong>Local</strong><small>Your data stays on this device</small></div>
          <div><span aria-hidden="true">⌁</span><strong>Fast</strong><small>Designed for ten-second entry</small></div>
        </div>
      </section>

      <section class="view" data-view="transactions" aria-labelledby="transactions-title" hidden>
        <div class="view-heading">
          <div>
            <p class="section-label">History</p>
            <h2 id="transactions-title">Transactions</h2>
          </div>
        </div>
        <p class="view-feedback" id="transaction-feedback" role="status" hidden></p>
        <div class="bulk-bar" id="bulk-bar" hidden>
          <strong id="bulk-count">0 selected</strong>
          <select id="bulk-category" aria-label="New category for selected transactions"></select>
          <button class="compact-button" id="apply-bulk-category" type="button">Apply</button>
        </div>
        <div class="transaction-list" id="transaction-list" aria-live="polite"></div>
        <div class="empty-card" id="transactions-empty">
          <span class="empty-card__icon" aria-hidden="true">☷</span>
          <h3>Your history will live here</h3>
          <p>Current and backfilled expenses will appear together, organized by date.</p>
          <button class="secondary-button" data-go-to="add" type="button">Add your first expense</button>
        </div>
      </section>

      <section class="view" data-view="overview" aria-labelledby="overview-title" hidden>
        <div class="view-heading">
          <div>
            <p class="section-label">Monthly view</p>
            <h2 id="overview-title">Overview</h2>
          </div>
          <select class="month-select" id="overview-month" aria-label="Overview month"></select>
        </div>
        <p class="view-feedback" id="overview-feedback" role="status" hidden></p>
        <div class="metric-card metric-card--accent">
          <p>Cash outflow</p>
          <strong id="actual-month-outflow">—</strong>
          <small id="month-comparison">Add spending to see your monthly picture.</small>
        </div>
        <div class="metric-grid">
          <div class="metric-card"><p>Monthly run rate</p><strong id="monthly-run-rate">—</strong><small id="run-rate-months">Complete months only</small></div>
          <div class="metric-card"><p>Funding outlook</p><strong id="funding-outlook">—</strong><small id="funding-label">Add MBA dates and funds</small></div>
        </div>
        <section class="projection-card" aria-labelledby="projection-title">
          <div class="projection-card__heading">
            <div>
              <p class="section-label">Forecast</p>
              <h3 id="projection-title">MBA funding projection</h3>
            </div>
            <button class="text-button" id="edit-projection-settings" type="button">Edit inputs</button>
          </div>
          <div class="projection-grid">
            <div><small>Annual projection</small><strong id="annual-projection">—</strong></div>
            <div><small>Remaining MBA spend</small><strong id="remaining-projection">—</strong></div>
            <div><small>Total MBA projection</small><strong id="total-program-projection">—</strong></div>
            <div><small>Actual MBA outflow</small><strong id="actual-program-outflow">—</strong></div>
          </div>
          <p class="projection-assumptions" id="projection-assumptions">Add MBA dates to calculate a forecast.</p>
        </section>
        <section class="breakdown-card" aria-labelledby="breakdown-title">
          <div class="breakdown-card__heading">
            <h3 id="breakdown-title">Category breakdown</h3>
            <button class="text-button" id="toggle-month-complete" type="button">Mark incomplete</button>
          </div>
          <div class="category-breakdown" id="category-breakdown"></div>
          <p class="empty-breakdown" id="empty-breakdown">No outgoing transactions in this month.</p>
        </section>
        <p class="cashflow-warning">Cash outflow counts every outgoing entry, including transfers and credit-card payments. This can overstate consumption spending.</p>
      </section>

      <section class="view" data-view="settings" aria-labelledby="settings-title" hidden>
        <div class="view-heading">
          <div>
            <p class="section-label">Preferences</p>
            <h2 id="settings-title">Settings</h2>
          </div>
        </div>
        <div class="settings-list">
          <button id="open-categories" type="button"><span><strong>Categories</strong><small>Create and organize spending categories</small></span><b>›</b></button>
          <button id="open-projection-settings" type="button"><span><strong>MBA dates and funds</strong><small id="projection-settings-summary">Set the period used by projections</small></span><b>›</b></button>
          <button id="open-data-privacy" type="button"><span><strong>Data and privacy</strong><small id="storage-summary">Preparing local storage…</small></span><b>›</b></button>
        </div>
        <p class="privacy-note"><span aria-hidden="true">●</span> No bank login, analytics, or advertising connections.</p>
      </section>
    </main>

    <dialog class="manager-dialog" id="category-dialog" aria-labelledby="category-dialog-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Settings</p>
          <h2 id="category-dialog-title">Categories</h2>
        </div>
        <button class="icon-button" id="close-categories" type="button" aria-label="Close categories">×</button>
      </div>
      <p class="manager-intro">Your changes update past and future spending views immediately.</p>
      <form class="new-category" id="new-category-form">
        <label class="field-label" for="new-category-name">New category</label>
        <div>
          <input id="new-category-name" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Recruiting" />
          <button class="compact-button" type="submit">Add</button>
        </div>
      </form>
      <p class="view-feedback" id="category-feedback" role="status" hidden></p>
      <div class="category-list" id="category-list"></div>
    </dialog>

    <dialog class="warning-dialog" id="delete-category-dialog" aria-labelledby="delete-category-title">
      <p class="section-label">Delete category</p>
      <h3 id="delete-category-title">Preserve the transaction history</h3>
      <p id="delete-category-copy"></p>
      <div id="replacement-category-field">
        <label class="field-label" for="replacement-category">Move existing transactions to</label>
        <select id="replacement-category"></select>
      </div>
      <p class="entry-message entry-message--error" id="delete-category-error" hidden></p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-delete-category" type="button">Cancel</button>
        <button class="danger-button" id="confirm-delete-category" type="button">Delete category</button>
      </div>
    </dialog>

    <dialog class="manager-dialog transaction-dialog" id="transaction-dialog" aria-labelledby="transaction-dialog-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Transaction</p>
          <h2 id="transaction-dialog-title">Edit entry</h2>
        </div>
        <button class="icon-button" id="close-transaction" type="button" aria-label="Close transaction editor">×</button>
      </div>
      <form id="transaction-form" class="edit-form">
        <label class="field-label" for="edit-amount">Amount</label>
        <input id="edit-amount" inputmode="decimal" autocomplete="off" />
        <label class="field-label" for="edit-category">Category</label>
        <select id="edit-category"></select>
        <label class="field-label" for="edit-date">Date</label>
        <input id="edit-date" type="date" />
        <label class="field-label" for="edit-description">Merchant or note</label>
        <input id="edit-description" type="text" maxlength="120" autocomplete="off" />
        <label class="field-label" for="edit-direction">Transaction type</label>
        <select id="edit-direction">
          <option value="outgoing">Cash outflow</option>
          <option value="incoming">Money in</option>
        </select>
        <label class="check-row"><input id="edit-excluded" type="checkbox" /><span><strong>Exclude from projections</strong><small>Keeps this entry in actual historical totals.</small></span></label>
        <p class="entry-message entry-message--error" id="transaction-edit-error" hidden></p>
        <div class="edit-form__actions">
          <button class="danger-link" id="request-delete-transaction" type="button">Delete</button>
          <button class="primary-button" type="submit">Save changes</button>
        </div>
      </form>
    </dialog>

    <dialog class="warning-dialog" id="delete-transaction-dialog" aria-labelledby="delete-transaction-title">
      <p class="section-label">Delete transaction</p>
      <h3 id="delete-transaction-title">Remove this entry?</h3>
      <p>This permanently removes the transaction from history, reports, and projections.</p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-delete-transaction" type="button">Cancel</button>
        <button class="danger-button" id="confirm-delete-transaction" type="button">Delete transaction</button>
      </div>
    </dialog>

    <dialog class="manager-dialog" id="projection-settings-dialog" aria-labelledby="projection-settings-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Forecast inputs</p>
          <h2 id="projection-settings-title">MBA dates and funds</h2>
        </div>
        <button class="icon-button" id="close-projection-settings" type="button" aria-label="Close projection settings">×</button>
      </div>
      <p class="manager-intro">These values stay on this device and can be changed at any time.</p>
      <form id="projection-settings-form" class="edit-form">
        <label class="field-label" for="mba-start-date">MBA start date</label>
        <input id="mba-start-date" type="date" />
        <label class="field-label" for="graduation-date">Graduation date</label>
        <input id="graduation-date" type="date" />
        <label class="field-label" for="available-funds">Current funds available</label>
        <div class="money-input"><span>$</span><input id="available-funds" inputmode="decimal" autocomplete="off" placeholder="0.00" /></div>
        <p class="entry-message entry-message--error" id="projection-settings-error" hidden></p>
        <button class="primary-button" type="submit">Save projection inputs</button>
      </form>
    </dialog>

    <dialog class="manager-dialog" id="data-privacy-dialog" aria-labelledby="data-privacy-title">
      <div class="manager-dialog__header">
        <div>
          <p class="section-label">Settings</p>
          <h2 id="data-privacy-title">Data and privacy</h2>
        </div>
        <button class="icon-button" id="close-data-privacy" type="button" aria-label="Close data and privacy">×</button>
      </div>
      <p class="manager-intro">Financial data stays in this app on this device. Nothing is sent to a bank, analytics service, or advertising network.</p>

      <section class="data-status-card" aria-labelledby="device-status-title">
        <h3 id="device-status-title">Device status</h3>
        <div class="status-row"><span>Storage</span><strong id="persistence-status">Checking…</strong></div>
        <div class="status-row"><span>Connection</span><strong id="offline-status">Checking…</strong></div>
        <div class="status-row"><span>Saved data</span><strong id="data-counts">Checking…</strong></div>
      </section>

      <section class="data-action-card" aria-labelledby="backup-title">
        <h3 id="backup-title">Backup</h3>
        <p>Download a JSON copy for safekeeping. The file is not encrypted or password-protected, so store it somewhere private.</p>
        <div class="data-action-grid">
          <button class="secondary-button" id="download-backup" type="button">Download backup</button>
          <button class="secondary-button" id="restore-backup" type="button">Restore backup</button>
        </div>
        <input class="visually-hidden" id="restore-file" type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true" />
      </section>

      <section class="data-action-card data-action-card--danger" aria-labelledby="delete-all-title">
        <h3 id="delete-all-title">Delete all app data</h3>
        <p>Remove every transaction, custom category, and projection input from this device.</p>
        <button class="danger-button" id="request-delete-all" type="button">Delete all data</button>
      </section>
      <p class="view-feedback" id="data-privacy-feedback" role="status" hidden></p>
    </dialog>

    <dialog class="warning-dialog" id="restore-confirm-dialog" aria-labelledby="restore-confirm-title">
      <p class="section-label">Restore backup</p>
      <h3 id="restore-confirm-title">Replace all current data?</h3>
      <p id="restore-copy">This replaces the data currently stored in the app.</p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-restore" type="button">Cancel</button>
        <button class="primary-button" id="confirm-restore" type="button">Replace and restore</button>
      </div>
    </dialog>

    <dialog class="warning-dialog" id="delete-all-dialog" aria-labelledby="delete-all-confirm-title">
      <p class="section-label">Delete all data</p>
      <h3 id="delete-all-confirm-title">Start over on this device?</h3>
      <p>This permanently deletes all transactions, custom categories, and projection settings. A downloaded backup can be restored later.</p>
      <div class="warning-dialog__actions">
        <button class="secondary-button" id="cancel-delete-all" type="button">Keep my data</button>
        <button class="danger-button" id="confirm-delete-all" type="button">Delete everything</button>
      </div>
    </dialog>

    <nav class="bottom-nav" aria-label="Primary navigation">
      ${navItems
        .map(
          (item) => `
            <button type="button" data-nav="${item.id}" aria-label="${item.label}" ${
              item.id === "add" ? 'aria-current="page"' : ""
            }>
              <span class="nav-icon" aria-hidden="true">${item.icon}</span>
              <span>${item.label}</span>
            </button>
          `,
        )
        .join("")}
    </nav>
  </div>

  <section class="privacy-cover" id="privacy-cover" aria-labelledby="privacy-cover-title" hidden>
    <div class="privacy-cover__mark" aria-hidden="true">H</div>
    <p class="section-label">Privacy screen</p>
    <h2 id="privacy-cover-title">HBS Budget is covered</h2>
    <p>Your financial details stay hidden until you’re ready.</p>
    <button class="primary-button" id="dismiss-privacy-cover" type="button">Continue</button>
  </section>
`;

function parseHash(): ViewId {
  const candidate = window.location.hash.replace("#", "") as ViewId;
  return navItems.some((item) => item.id === candidate) ? candidate : "add";
}

function showView(viewId: ViewId, updateHash = true): void {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((view) => {
    view.hidden = view.dataset.view !== viewId;
  });

  document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
    const active = button.dataset.nav === viewId;
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (updateHash && window.location.hash !== `#${viewId}`) {
    window.history.replaceState(null, "", `#${viewId}`);
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.nav as ViewId));
});

document.querySelectorAll<HTMLButtonElement>("[data-go-to]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.goTo as ViewId));
});

window.addEventListener("hashchange", () => showView(parseHash(), false));
showView(parseHash(), false);

async function initializeStorage(): Promise<void> {
  const categorySelect = document.querySelector<HTMLSelectElement>("#category");
  const storageNote = document.querySelector<HTMLElement>("#storage-note");
  const storageSummary = document.querySelector<HTMLElement>("#storage-summary");

  try {
    await budgetDatabase.initialize();
    const categories = await budgetDatabase.getCategories(false);

    if (categorySelect) {
      const placeholder = new Option("Select category", "");
      categorySelect.replaceChildren(
        placeholder,
        ...categories.map((category) => new Option(category.name, category.id)),
      );
    }

    if (storageNote) {
      storageNote.textContent = "Saved entries stay in this browser on this device.";
    }
    if (storageSummary) {
      storageSummary.textContent = `Local database ready · ${categories.length} categories`;
    }
    setupExpenseEntry(categories);
    setupTransactionHistory();
    setupCategoryManager();
    setupOverview();
    setupPrivacyAndData();
  } catch {
    if (categorySelect) {
      categorySelect.replaceChildren(new Option("Storage unavailable", ""));
    }
    if (storageNote) {
      storageNote.textContent = "Local storage is unavailable. No transaction can be saved.";
      storageNote.classList.add("step-note--error");
    }
    if (storageSummary) {
      storageSummary.textContent = "Local database unavailable";
    }
  }
}

void initializeStorage();
