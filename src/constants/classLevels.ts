import type { ClassLevel } from "@prisma/client";

export const CLASS_LEVEL_CONFIG: Record<
  ClassLevel,
  { label: string; group: "Early Years" | "Junior" | "Senior" }
> = {
  NURSERY: { label: "Nursery", group: "Early Years" },
  PRIMARY: { label: "Primary", group: "Early Years" },
  JSS1:    { label: "JSS 1",   group: "Junior" },
  JSS2:    { label: "JSS 2",   group: "Junior" },
  JSS3:    { label: "JSS 3",   group: "Junior" },
  SS1:     { label: "SS 1",    group: "Senior" },
  SS2:     { label: "SS 2",    group: "Senior" },
  SS3:     { label: "SS 3",    group: "Senior" },
};

export const CLASS_LEVELS: ClassLevel[] = [
  "NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3",
];

export const EARLY_YEARS_CLASSES: ClassLevel[] = ["NURSERY", "PRIMARY"];
export const JUNIOR_CLASSES: ClassLevel[]      = ["JSS1", "JSS2", "JSS3"];
export const SENIOR_CLASSES: ClassLevel[]      = ["SS1", "SS2", "SS3"];
export const BOARDING_CLASSES: ClassLevel[]    = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

export const CAMPUS_CLASS_MAP: Record<"BOARDING" | "DAY" | "METRO", ClassLevel[]> = {
  BOARDING: BOARDING_CLASSES,
  DAY:      CLASS_LEVELS,
  METRO:    CLASS_LEVELS,
};
