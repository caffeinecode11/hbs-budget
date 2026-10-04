import type { BudgetTransaction } from "./models";

function belongsToMonth(transaction: BudgetTransaction, month: string): boolean {
  return transaction.date.slice(0, 7) === month;
}

export function cashOutflowForMonth(
  transactions: readonly BudgetTransaction[],
  month: string,
): number {
  return transactions.reduce((total, transaction) => {
    if (transaction.direction !== "outgoing" || !belongsToMonth(transaction, month)) {
      return total;
    }
    return total + transaction.amountCents;
  }, 0);
}

export function categoryCashOutflowForMonth(
  transactions: readonly BudgetTransaction[],
  month: string,
): Readonly<Record<string, number>> {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.direction !== "outgoing" || !belongsToMonth(transaction, month)) {
      return totals;
    }

    totals[transaction.categoryId] = (totals[transaction.categoryId] ?? 0) + transaction.amountCents;
    return totals;
  }, {});
}
