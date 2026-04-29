import type { ClassLevel } from "@prisma/client";

export const CLASS_LEVEL_CONFIG: Record<
  ClassLevel,
  { label: string; group: "Early Years" | "Basic" | "Junior" | "Senior" }
> = {
  PRE_NURSERY: { label: "Pre-Nursery", group: "Early Years" },
  NURSERY1:    { label: "Nursery 1",   group: "Early Years" },
  NURSERY2:    { label: "Nursery 2",   group: "Early Years" },
  NURSERY:     { label: "Nursery",     group: "Early Years" },
  PRIMARY:     { label: "Primary",     group: "Early Years" },
  BASIC1:      { label: "Basic 1",     group: "Basic" },
  BASIC2:      { label: "Basic 2",     group: "Basic" },
  BASIC3:      { label: "Basic 3",     group: "Basic" },
  BASIC4:      { label: "Basic 4",     group: "Basic" },
  BASIC5:      { label: "Basic 5",     group: "Basic" },
  BASIC6:      { label: "Basic 6",     group: "Basic" },
  JSS1:        { label: "JSS 1",       group: "Junior" },
  JSS2:        { label: "JSS 2",       group: "Junior" },
  JSS3:        { label: "JSS 3",       group: "Junior" },
  SS1:         { label: "SS 1",        group: "Senior" },
  SS2:         { label: "SS 2",        group: "Senior" },
  SS3:         { label: "SS 3",        group: "Senior" },
};

export const CLASS_LEVELS: ClassLevel[] = [
  "PRE_NURSERY", "NURSERY1", "NURSERY2", "NURSERY", "PRIMARY",
  "BASIC1", "BASIC2", "BASIC3", "BASIC4", "BASIC5", "BASIC6",
  "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3",
];

export const EARLY_YEARS_CLASSES: ClassLevel[] = ["PRE_NURSERY", "NURSERY1", "NURSERY2", "NURSERY", "PRIMARY"];
export const BASIC_CLASSES: ClassLevel[]        = ["BASIC1", "BASIC2", "BASIC3", "BASIC4", "BASIC5", "BASIC6"];
export const JUNIOR_CLASSES: ClassLevel[]       = ["JSS1", "JSS2", "JSS3"];
export const SENIOR_CLASSES: ClassLevel[]       = ["SS1", "SS2", "SS3"];
export const BOARDING_CLASSES: ClassLevel[]     = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

export const CAMPUS_CLASS_MAP: Record<"BOARDING" | "DAY" | "METRO", ClassLevel[]> = {
  BOARDING: BOARDING_CLASSES,
  DAY:      CLASS_LEVELS,
  METRO:    CLASS_LEVELS,
};
