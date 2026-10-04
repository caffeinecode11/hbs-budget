import { describe, expect, it } from "vitest";
import { cashOutflowForMonth, categoryCashOutflowForMonth } from "./calculations";
import type { BudgetTransaction } from "./models";

const septemberTransactions: BudgetTransaction[] = [
  {
    id: "meal",
    amountCents: 1_200,
    date: "2026-09-05",
    description: "Lunch",
    direction: "outgoing",
    categoryId: "food",
    source: "manual",
    createdAt: "2026-09-05T12:00:00.000Z",
    excludedFromProjection: false,
  },
  {
    id: "transfer",
    amountCents: 50_000,
    date: "2026-09-10",
    description: "Savings transfer",
    direction: "outgoing",
    categoryId: "miscellaneous",
    source: "manual",
    createdAt: "2026-09-10T12:00:00.000Z",
    excludedFromProjection: false,
  },
  {
    id: "card-payment",
    amountCents: 60_000,
    date: "2026-09-15",
    description: "Card payment",
    direction: "outgoing",
    categoryId: "miscellaneous",
    source: "manual",
    createdAt: "2026-09-15T12:00:00.000Z",
    excludedFromProjection: false,
  },
  {
    id: "refund",
    amountCents: 1_000,
    date: "2026-09-20",
    description: "Refund",
    direction: "incoming",
    categoryId: "food",
    source: "manual",
    createdAt: "2026-09-20T12:00:00.000Z",
    excludedFromProjection: false,
  },
  {
    id: "other-month",
    amountCents: 9_999,
    date: "2026-08-20",
    direction: "outgoing",
    categoryId: "food",
    source: "manual",
    createdAt: "2026-08-20T12:00:00.000Z",
    excludedFromProjection: false,
  },
];

describe("cash outflow calculations", () => {
  it("includes all outgoing transactions, including transfers and card payments", () => {
    expect(cashOutflowForMonth(septemberTransactions, "2026-09")).toBe(111_200);
  });

  it("does not subtract an incoming refund", () => {
    const totals = categoryCashOutflowForMonth(septemberTransactions, "2026-09");
    expect(totals.food).toBe(1_200);
    expect(totals.miscellaneous).toBe(110_000);
  });
});
