export type TransactionDirection = "outgoing" | "incoming";

export interface BudgetTransaction {
  id: string;
  amountCents: number;
  date: string;
  description?: string;
  direction: TransactionDirection;
  categoryId: string;
  source: "manual";
  createdAt: string;
  excludedFromProjection: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  system: boolean;
}

export interface BudgetSettings {
  id: "primary";
  mbaStartDate: string | null;
  graduationDate: string | null;
  availableFundsCents: number | null;
  incompleteMonths: string[];
}

export const STARTER_CATEGORIES: readonly Category[] = [
  { id: "housing", name: "Housing", color: "#8F3150", sortOrder: 0, archived: false, system: false },
  { id: "food", name: "Food", color: "#D16A45", sortOrder: 1, archived: false, system: false },
  { id: "transportation", name: "Transportation", color: "#3F7391", sortOrder: 2, archived: false, system: false },
  { id: "tuition-school", name: "Tuition & school", color: "#72558A", sortOrder: 3, archived: false, system: false },
  { id: "travel", name: "Travel", color: "#267D70", sortOrder: 4, archived: false, system: false },
  { id: "social", name: "Social", color: "#B14E79", sortOrder: 5, archived: false, system: false },
  { id: "health", name: "Health", color: "#56814A", sortOrder: 6, archived: false, system: false },
  { id: "miscellaneous", name: "Miscellaneous", color: "#8A7770", sortOrder: 7, archived: false, system: false },
  { id: "uncategorized", name: "Uncategorized", color: "#9A9694", sortOrder: 8, archived: false, system: true },
];

export const DEFAULT_SETTINGS: BudgetSettings = {
  id: "primary",
  mbaStartDate: null,
  graduationDate: null,
  availableFundsCents: null,
  incompleteMonths: [],
};
