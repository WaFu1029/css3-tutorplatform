import type { Goal, GoalCategory } from "./types";

/**
 * The achievement checklist from the paper form. Goals marked `federal` carry
 * an asterisk on the printed sheet: they are reported to the state.
 */
export type CatalogGoal = { code: string; label: string; federal?: boolean };
export type GoalSection = {
  key: string;
  category: Exclude<GoalCategory, "other">;
  title: string;
  goals: CatalogGoal[];
};

export const GOAL_SECTIONS: GoalSection[] = [
  {
    key: "A",
    category: "economic",
    title: "Economic",
    goals: [
      { code: "A1", label: "Enter employment", federal: true },
      { code: "A2", label: "Retain employment", federal: true },
      { code: "A3", label: "Leave public assistance" },
    ],
  },
  {
    key: "B",
    category: "educational",
    title: "Educational",
    goals: [
      { code: "B1", label: "Achieve work-based project learner goal" },
      { code: "B2", label: "Enter occupational skills training program", federal: true },
      { code: "B3", label: "Enter postsecondary education", federal: true },
      { code: "B4", label: "Obtain high school diploma", federal: true },
    ],
  },
  {
    key: "C",
    category: "family",
    title: "Family",
    goals: [
      { code: "C1", label: "Help more frequently with school" },
      { code: "C2", label: "Increase contact with child(ren)'s teachers" },
      { code: "C3", label: "More involvement in child(ren)'s school activities" },
      { code: "C4", label: "Purchase books or magazines" },
      { code: "C5", label: "Read to child(ren)" },
      { code: "C6", label: "Visit the library (with/for child(ren))" },
    ],
  },
  {
    key: "D",
    category: "societal",
    title: "Societal / community",
    goals: [
      { code: "D1", label: "Obtain citizenship", federal: true },
      { code: "D2", label: "Achieve civics skills" },
      { code: "D3", label: "Increase involvement in community activities" },
      { code: "D4", label: "Vote or register to vote" },
    ],
  },
];

export const CATEGORY_TITLE: Record<GoalCategory, string> = {
  economic: "Economic",
  educational: "Educational",
  family: "Family",
  societal: "Societal / community",
  other: "Other",
};

export const ALL_GOALS: CatalogGoal[] = GOAL_SECTIONS.flatMap((s) => s.goals);

export function catalogGoal(code: string): CatalogGoal | undefined {
  return ALL_GOALS.find((g) => g.code === code);
}

export function categoryOf(code: string): GoalCategory {
  return GOAL_SECTIONS.find((s) => s.goals.some((g) => g.code === code))?.category ?? "other";
}

export function goalLabel(code: string): string {
  return catalogGoal(code)?.label ?? code;
}

/** What to call a student's goal on screen and in exports. */
export function goalText(goal: Goal): string {
  return goal.catalogKey !== undefined ? goalLabel(goal.catalogKey) : goal.customLabel;
}

/** True for the goals the paper form stars. */
export function isStarred(goal: Goal): boolean {
  return Boolean(goal.catalogKey && catalogGoal(goal.catalogKey)?.federal);
}
