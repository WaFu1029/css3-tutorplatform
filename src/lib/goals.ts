/**
 * The achievement checklist from the paper form. Goals marked `federal` carry
 * an asterisk on the printed sheet: they are reported to the state.
 */
export type Goal = { code: string; label: string; federal?: boolean };
export type GoalSection = { key: string; title: string; goals: Goal[] };

export const GOAL_SECTIONS: GoalSection[] = [
  {
    key: "A",
    title: "Economic",
    goals: [
      { code: "A1", label: "Enter employment", federal: true },
      { code: "A2", label: "Retain employment", federal: true },
      { code: "A3", label: "Leave public assistance" },
    ],
  },
  {
    key: "B",
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
    title: "Societal / community",
    goals: [
      { code: "D1", label: "Obtain citizenship", federal: true },
      { code: "D2", label: "Achieve civics skills" },
      { code: "D3", label: "Increase involvement in community activities" },
      { code: "D4", label: "Vote or register to vote" },
    ],
  },
];

export const ALL_GOALS: Goal[] = GOAL_SECTIONS.flatMap((s) => s.goals);

export function goalLabel(code: string): string {
  return ALL_GOALS.find((g) => g.code === code)?.label ?? code;
}
