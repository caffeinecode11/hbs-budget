import { budgetDatabase } from "../data/db";
import { categoryCashOutflowForMonth } from "../domain/calculations";
import { localDateIso, parseUsdCents } from "../domain/entry";
import type { BudgetSettings, Category } from "../domain/models";
import {
  calculateProjection,
  monthKey,
  monthlyOutflowTotals,
  previousMonth,
} from "../domain/projections";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required overview control is missing: ${selector}`);
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

function formatMoney(amountCents: number | null): string {
  if (amountCents === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function readableMonth(month: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
    new Date(`${month}-15T12:00:00`),
  );
}

function parseAvailableFunds(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\$?0(?:\.0{1,2})?$/.test(trimmed)) return 0;
  return parseUsdCents(trimmed) ?? undefined;
}

export function setupOverview(): void {
  const monthSelect = requiredElement<HTMLSelectElement>("#overview-month");
  const feedback = requiredElement<HTMLElement>("#overview-feedback");
  const actualMonth = requiredElement<HTMLElement>("#actual-month-outflow");
  const comparison = requiredElement<HTMLElement>("#month-comparison");
  const runRate = requiredElement<HTMLElement>("#monthly-run-rate");
  const runRateMonths = requiredElement<HTMLElement>("#run-rate-months");
  const fundingOutlook = requiredElement<HTMLElement>("#funding-outlook");
  const fundingLabel = requiredElement<HTMLElement>("#funding-label");
  const annualProjection = requiredElement<HTMLElement>("#annual-projection");
  const remainingProjection = requiredElement<HTMLElement>("#remaining-projection");
  const totalProjection = requiredElement<HTMLElement>("#total-program-projection");
  const actualProgram = requiredElement<HTMLElement>("#actual-program-outflow");
  const assumptions = requiredElement<HTMLElement>("#projection-assumptions");
  const breakdown = requiredElement<HTMLElement>("#category-breakdown");
  const emptyBreakdown = requiredElement<HTMLElement>("#empty-breakdown");
  const toggleComplete = requiredElement<HTMLButtonElement>("#toggle-month-complete");
  const openFromOverview = requiredElement<HTMLButtonElement>("#edit-projection-settings");
  const openFromSettings = requiredElement<HTMLButtonElement>("#open-projection-settings");
  const settingsSummary = requiredElement<HTMLElement>("#projection-settings-summary");
  const settingsDialog = requiredElement<HTMLDialogElement>("#projection-settings-dialog");
  const closeSettings = requiredElement<HTMLButtonElement>("#close-projection-settings");
  const settingsForm = requiredElement<HTMLFormElement>("#projection-settings-form");
  const startDate = requiredElement<HTMLInputElement>("#mba-start-date");
  const graduationDate = requiredElement<HTMLInputElement>("#graduation-date");
  const availableFunds = requiredElement<HTMLInputElement>("#available-funds");
  const settingsError = requiredElement<HTMLElement>("#projection-settings-error");

  let selectedMonth = monthKey(localDateIso());
  let currentSettings: BudgetSettings | null = null;

  function setFeedback(text = "", error = false): void {
    feedback.textContent = text;
    feedback.hidden = text.length === 0;
    feedback.classList.toggle("view-feedback--error", error);
  }

  function renderBreakdown(
    totals: Readonly<Record<string, number>>,
    categories: readonly Category[],
  ): void {
    const rows = Object.entries(totals).sort(([, first], [, second]) => second - first);
    const maximum = Math.max(1, ...rows.map(([, amount]) => amount));
    emptyBreakdown.hidden = rows.length > 0;
    breakdown.replaceChildren(
      ...rows.map(([categoryId, amount]) => {
        const category = categories.find((candidate) => candidate.id === categoryId);
        const row = document.createElement("div");
        row.className = "breakdown-row";
        const heading = document.createElement("div");
        const name = document.createElement("span");
        name.textContent = category?.name ?? "Uncategorized";
        const value = document.createElement("strong");
        value.textContent = formatMoney(amount);
        heading.append(name, value);
        const track = document.createElement("div");
        track.className = "breakdown-row__track";
        const bar = document.createElement("span");
        bar.style.width = `${Math.max(3, (amount / maximum) * 100)}%`;
        bar.style.backgroundColor = category?.color ?? "#9A9694";
        track.append(bar);
        row.append(heading, track);
        return row;
      }),
    );
  }

  async function render(): Promise<void> {
    try {
      const [transactions, categories, settings] = await Promise.all([
        budgetDatabase.getTransactions(),
        budgetDatabase.getCategories(),
        budgetDatabase.getSettings(),
      ]);
      currentSettings = settings;
      const currentMonth = monthKey(localDateIso());
      const totals = monthlyOutflowTotals(transactions);
      const months = [...new Set([currentMonth, ...Object.keys(totals)])].sort().reverse();
      if (!months.includes(selectedMonth)) selectedMonth = months[0];
      monthSelect.replaceChildren(
        ...months.map((month) => new Option(readableMonth(month), month, false, month === selectedMonth)),
      );
      monthSelect.value = selectedMonth;

      const selectedTotal = totals[selectedMonth] ?? 0;
      const priorTotal = totals[previousMonth(selectedMonth)];
      actualMonth.textContent = formatMoney(selectedTotal);
      if (priorTotal === undefined || priorTotal === 0) {
        comparison.textContent = selectedTotal === 0 ? "No outgoing transactions recorded." : "No prior-month comparison available.";
      } else {
        const change = ((selectedTotal - priorTotal) / priorTotal) * 100;
        comparison.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(0)}% from ${readableMonth(previousMonth(selectedMonth))}`;
      }

      renderBreakdown(categoryCashOutflowForMonth(transactions, selectedMonth), categories);
      const isCurrent = selectedMonth === currentMonth;
      const isIncomplete = settings.incompleteMonths.includes(selectedMonth);
      toggleComplete.disabled = isCurrent;
      toggleComplete.textContent = isCurrent
        ? "Current month is partial"
        : isIncomplete
          ? "Mark complete"
          : "Mark incomplete";

      const projection = calculateProjection(transactions, settings, localDateIso());
      runRate.textContent = formatMoney(projection.runRateCents);
      runRateMonths.textContent =
        projection.completeMonths.length > 0
          ? `${projection.completeMonths.length} complete ${projection.completeMonths.length === 1 ? "month" : "months"}`
          : "No complete month available";
      annualProjection.textContent = formatMoney(projection.annualProjectionCents);
      remainingProjection.textContent = formatMoney(projection.remainingProjectionCents);
      totalProjection.textContent = formatMoney(projection.totalProgramProjectionCents);
      actualProgram.textContent = formatMoney(projection.actualProgramOutflowCents);

      fundingOutlook.classList.remove("positive", "negative");
      if (projection.fundingBalanceCents === null) {
        fundingOutlook.textContent = "—";
        fundingLabel.textContent = settings.availableFundsCents === null ? "Add available funds" : "Forecast unavailable";
      } else if (projection.fundingBalanceCents >= 0) {
        fundingOutlook.textContent = formatMoney(projection.fundingBalanceCents);
        fundingLabel.textContent = "Projected surplus";
        fundingOutlook.classList.add("positive");
      } else {
        fundingOutlook.textContent = formatMoney(Math.abs(projection.fundingBalanceCents));
        fundingLabel.textContent = "Additional cash needed";
        fundingOutlook.classList.add("negative");
      }

      if (!settings.mbaStartDate || !settings.graduationDate) {
        assumptions.textContent = "Add planning start and end dates to calculate a forecast.";
        settingsSummary.textContent = "Set the period used by projections";
      } else if (projection.runRateCents === null) {
        assumptions.textContent = "Forecast unavailable until at least one past month with spending is marked complete.";
        settingsSummary.textContent = `${readableMonth(monthKey(settings.mbaStartDate))}–${readableMonth(monthKey(settings.graduationDate))}`;
      } else {
        assumptions.textContent = `Based on ${projection.completeMonths.map(readableMonth).join(", ")} and ${projection.remainingMonths?.toFixed(1)} months remaining. Projection exclusions do not change actual totals.`;
        settingsSummary.textContent = `${readableMonth(monthKey(settings.mbaStartDate))}–${readableMonth(monthKey(settings.graduationDate))}${settings.availableFundsCents === null ? "" : ` · ${formatMoney(settings.availableFundsCents)} available`}`;
      }
    } catch {
      setFeedback("Overview data is unavailable. No data was changed.", true);
    }
  }

  function showSettings(): void {
    if (!currentSettings) return;
    startDate.value = currentSettings.mbaStartDate ?? "";
    graduationDate.value = currentSettings.graduationDate ?? "";
    availableFunds.value =
      currentSettings.availableFundsCents === null
        ? ""
        : (currentSettings.availableFundsCents / 100).toFixed(2);
    settingsError.hidden = true;
    openDialog(settingsDialog);
  }

  monthSelect.addEventListener("change", () => {
    selectedMonth = monthSelect.value;
    void render();
  });
  toggleComplete.addEventListener("click", async () => {
    if (!currentSettings || toggleComplete.disabled) return;
    const incomplete = new Set(currentSettings.incompleteMonths);
    if (incomplete.has(selectedMonth)) incomplete.delete(selectedMonth);
    else incomplete.add(selectedMonth);
    try {
      await budgetDatabase.saveSettings({ ...currentSettings, incompleteMonths: [...incomplete].sort() });
      setFeedback(incomplete.has(selectedMonth) ? "Month excluded from the run rate." : "Month included in the run rate.");
      await render();
    } catch {
      setFeedback("The month status could not be changed. Nothing changed.", true);
    }
  });
  openFromOverview.addEventListener("click", showSettings);
  openFromSettings.addEventListener("click", showSettings);
  closeSettings.addEventListener("click", () => closeDialog(settingsDialog));

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSettings) return;
    const funds = parseAvailableFunds(availableFunds.value);
    if (!startDate.value || !graduationDate.value) {
      settingsError.textContent = "Enter both planning dates.";
      settingsError.hidden = false;
      return;
    }
    if (startDate.value > graduationDate.value) {
      settingsError.textContent = "The planning end date must be after the start date.";
      settingsError.hidden = false;
      return;
    }
    if (funds === undefined) {
      settingsError.textContent = "Enter a valid USD amount for available funds, or leave it blank.";
      settingsError.hidden = false;
      return;
    }

    try {
      await budgetDatabase.saveSettings({
        ...currentSettings,
        mbaStartDate: startDate.value,
        graduationDate: graduationDate.value,
        availableFundsCents: funds,
      });
      closeDialog(settingsDialog);
      setFeedback("Projection inputs updated.");
      await render();
    } catch {
      settingsError.textContent = "Projection inputs could not be saved. Nothing changed.";
      settingsError.hidden = false;
    }
  });

  window.addEventListener("budget:transaction-saved", () => void render());
  window.addEventListener("budget:transactions-changed", () => void render());
  window.addEventListener("budget:categories-changed", () => void render());
  void render();
}
