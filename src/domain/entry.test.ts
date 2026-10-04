import { describe, expect, it } from "vitest";
import type { BudgetTransaction } from "./models";
import { isFutureDate, isLikelyDuplicate, localDateIso, parseUsdCents } from "./entry";

const transaction: BudgetTransaction = {
  id: "existing",
  amountCents: 1_234,
  date: "2026-09-14",
  direction: "outgoing",
  categoryId: "food",
  source: "manual",
  createdAt: "2026-09-14T12:00:00.000Z",
  excludedFromProjection: false,
};

describe("entry helpers", () => {
  it.each([
    ["12", 1_200],
    ["12.3", 1_230],
    ["$12.34", 1_234],
    ["1,234.56", 123_456],
  ])("parses %s as integer cents", (value, expected) => {
    expect(parseUsdCents(value)).toBe(expected);
  });

  it.each(["", "0", "-1", "12.345", "twelve"])("rejects invalid amount %s", (value) => {
    expect(parseUsdCents(value)).toBeNull();
  });

  it("formats a local calendar date without a UTC shift", () => {
    expect(localDateIso(new Date(2026, 8, 4, 23, 30))).toBe("2026-09-04");
  });

  it("detects future dates", () => {
    expect(isFutureDate("2026-10-05", "2026-10-04")).toBe(true);
    expect(isFutureDate("2026-10-04", "2026-10-04")).toBe(false);
  });

  it("flags only a matching amount, date, category, and direction", () => {
    expect(isLikelyDuplicate({ ...transaction, id: "candidate" }, [transaction])).toBe(true);
    expect(
      isLikelyDuplicate({ ...transaction, id: "candidate", categoryId: "travel" }, [transaction]),
    ).toBe(false);
  });
});
