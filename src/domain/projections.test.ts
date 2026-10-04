import { describe, expect, it } from "vitest";
import type { BudgetSettings, BudgetTransaction } from "./models";
import { calculateProjection, monthlyOutflowTotals, previousMonth } from "./projections";

function expense(
  id: string,
  date: string,
  amountCents: number,
  overrides: Partial<BudgetTransaction> = {},
): BudgetTransaction {
  return {
    id,
    date,
    amountCents,
    categoryId: "food",
    direction: "outgoing",
    source: "manual",
    createdAt: `${date}T12:00:00.000Z`,
    excludedFromProjection: false,
    ...overrides,
  };
}

const settings: BudgetSettings = {
  id: "primary",
  mbaStartDate: "2026-08-01",
  graduationDate: "2027-05-31",
  availableFundsCents: 50_000_00,
  incompleteMonths: ["2026-09"],
};

describe("projection calculations", () => {
  it("calculates monthly actual outflow without subtracting income", () => {
    const transactions = [
      expense("aug", "2026-08-10", 100_00),
      expense("refund", "2026-08-12", 20_00, { direction: "incoming" }),
    ];
    expect(monthlyOutflowTotals(transactions)).toEqual({ "2026-08": 100_00 });
  });

  it("handles a year boundary when finding the prior month", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("uses only complete past months for the run rate", () => {
    const transactions = [
      expense("aug", "2026-08-10", 100_00),
      expense("sep", "2026-09-10", 500_00),
      expense("oct-current", "2026-10-02", 900_00),
      expense("outside", "2026-07-10", 800_00),
      expense("excluded", "2026-08-20", 300_00, { excludedFromProjection: true }),
    ];

    const result = calculateProjection(transactions, settings, "2026-10-04");
    expect(result.completeMonths).toEqual(["2026-08"]);
    expect(result.runRateCents).toBe(100_00);
    expect(result.annualProjectionCents).toBe(1_200_00);
    expect(result.actualProgramOutflowCents).toBe(1_800_00);
    expect(result.remainingProjectionCents).not.toBeNull();
    expect(result.totalProgramProjectionCents).toBe(
      result.actualProgramOutflowCents + result.remainingProjectionCents!,
    );
    expect(result.fundingBalanceCents).toBe(50_000_00 - result.remainingProjectionCents!);
  });

  it("returns an unavailable forecast when no complete month exists", () => {
    const result = calculateProjection(
      [expense("current", "2026-10-02", 100_00)],
      settings,
      "2026-10-04",
    );
    expect(result.completeMonths).toEqual([]);
    expect(result.runRateCents).toBeNull();
    expect(result.remainingProjectionCents).toBeNull();
    expect(result.fundingBalanceCents).toBeNull();
  });
});
