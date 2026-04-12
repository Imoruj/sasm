export interface GradeEntry {
  grade: string;
  min: number;
  max: number;
  label: string;
}

export const NIGERIAN_GRADING_SCALE: GradeEntry[] = [
  { grade: "A1", min: 75, max: 100, label: "Excellent" },
  { grade: "B2", min: 70, max: 74, label: "Very Good" },
  { grade: "B3", min: 65, max: 69, label: "Good" },
  { grade: "C4", min: 60, max: 64, label: "Credit" },
  { grade: "C5", min: 55, max: 59, label: "Credit" },
  { grade: "C6", min: 50, max: 54, label: "Credit" },
  { grade: "D7", min: 45, max: 49, label: "Pass" },
  { grade: "E8", min: 40, max: 44, label: "Pass" },
  { grade: "F9", min: 0, max: 39, label: "Fail" },
];

export function getGrade(score: number): GradeEntry {
  return (
    NIGERIAN_GRADING_SCALE.find((g) => score >= g.min && score <= g.max) ??
    NIGERIAN_GRADING_SCALE[NIGERIAN_GRADING_SCALE.length - 1]
  );
}

export function isPassing(score: number): boolean {
  return score >= 40;
}
