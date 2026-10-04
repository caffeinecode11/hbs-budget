import type { BudgetSettings, BudgetTransaction } from "./models";

const AVERAGE_DAYS_PER_MONTH = 365.25 / 12;

export interface ProjectionSummary {
  completeMonths: string[];
  runRateCents: number | null;
  annualProjectionCents: number | null;
  actualProgramOutflowCents: number;
  remainingMonths: number | null;
  remainingProjectionCents: number | null;
  totalProgramProjectionCents: number | null;
  fundingBalanceCents: number | null;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthlyOutflowTotals(
  transactions: readonly BudgetTransaction[],
): Readonly<Record<string, number>> {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.direction !== "outgoing") return totals;
    const month = monthKey(transaction.date);
    totals[month] = (totals[month] ?? 0) + transaction.amountCents;
    return totals;
  }, {});
}

function dateAtNoon(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function calculateProjection(
  transactions: readonly BudgetTransaction[],
  settings: BudgetSettings,
  today: string,
): ProjectionSummary {
  const currentMonth = monthKey(today);
  const hasProgramDates = Boolean(settings.mbaStartDate && settings.graduationDate);
  const withinProgram = (transaction: BudgetTransaction): boolean =>
    hasProgramDates &&
    transaction.date >= settings.mbaStartDate! &&
    transaction.date <= settings.graduationDate!;

  const actualProgramOutflowCents = transactions.reduce((total, transaction) => {
    if (
      transaction.direction !== "outgoing" ||
      !withinProgram(transaction) ||
      transaction.date > today
    ) {
      return total;
    }
    return total + transaction.amountCents;
  }, 0);

  if (!hasProgramDates || settings.mbaStartDate! > settings.graduationDate!) {
    return {
      completeMonths: [],
      runRateCents: null,
      annualProjectionCents: null,
      actualProgramOutflowCents,
      remainingMonths: null,
      remainingProjectionCents: null,
      totalProgramProjectionCents: null,
      fundingBalanceCents: null,
    };
  }

  const eligibleMonthlyTotals = transactions.reduce<Record<string, number>>((totals, transaction) => {
    const month = monthKey(transaction.date);
    if (
      transaction.direction !== "outgoing" ||
      transaction.excludedFromProjection ||
      !withinProgram(transaction) ||
      month >= currentMonth ||
      settings.incompleteMonths.includes(month)
    ) {
      return totals;
    }
    totals[month] = (totals[month] ?? 0) + transaction.amountCents;
    return totals;
  }, {});

  const completeMonths = Object.keys(eligibleMonthlyTotals).sort();
  const runRateCents =
    completeMonths.length === 0
      ? null
      : Math.round(
          completeMonths.reduce((total, month) => total + eligibleMonthlyTotals[month], 0) /
            completeMonths.length,
        );

  const graduation = dateAtNoon(settings.graduationDate!);
  const todayDate = dateAtNoon(today);
  const remainingMonths = Math.max(
    0,
    (graduation.getTime() - todayDate.getTime() + 86_400_000) / 86_400_000 / AVERAGE_DAYS_PER_MONTH,
  );
  const remainingProjectionCents =
    runRateCents === null ? null : Math.round(runRateCents * remainingMonths);
  const totalProgramProjectionCents =
    remainingProjectionCents === null ? null : actualProgramOutflowCents + remainingProjectionCents;
  const fundingBalanceCents =
    remainingProjectionCents === null || settings.availableFundsCents === null
      ? null
      : settings.availableFundsCents - remainingProjectionCents;

  return {
    completeMonths,
    runRateCents,
    annualProjectionCents: runRateCents === null ? null : runRateCents * 12,
    actualProgramOutflowCents,
    remainingMonths,
    remainingProjectionCents,
    totalProgramProjectionCents,
    fundingBalanceCents,
  };
}
