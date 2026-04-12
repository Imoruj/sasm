import type { ApplicationStatus } from "@prisma/client";

export const APPLICATION_STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; bgColor: string; description: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    description: "Application is saved but not yet submitted",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    description: "Application has been submitted and is awaiting review",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    description: "Application is being reviewed by the admissions team",
  },
  REVISION_REQUIRED: {
    label: "Revision Required",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    description: "Additional information or changes are required",
  },
  APPROVED: {
    label: "Approved",
    color: "text-green-700",
    bgColor: "bg-green-100",
    description: "Application has been approved. Exam scheduling is available",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-700",
    bgColor: "bg-red-100",
    description: "Application was not successful",
  },
  EXAM_SCHEDULED: {
    label: "Exam Scheduled",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    description: "Entrance exam has been scheduled",
  },
  EXAM_COMPLETED: {
    label: "Exam Completed",
    color: "text-violet-700",
    bgColor: "bg-violet-100",
    description: "Entrance exam has been completed",
  },
  ADMITTED: {
    label: "Admitted",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    description: "Congratulations! Student has been admitted",
  },
  NOT_ADMITTED: {
    label: "Not Admitted",
    color: "text-red-700",
    bgColor: "bg-red-100",
    description: "Student was not admitted after examination",
  },
  ENROLLED: {
    label: "Enrolled",
    color: "text-teal-700",
    bgColor: "bg-teal-100",
    description: "Student has completed enrollment",
  },
};

/** Valid status transitions for the admission workflow */
export const VALID_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "REVISION_REQUIRED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "REVISION_REQUIRED"],
  REVISION_REQUIRED: ["SUBMITTED"],
  APPROVED: ["EXAM_SCHEDULED"],
  EXAM_SCHEDULED: ["EXAM_COMPLETED"],
  EXAM_COMPLETED: ["ADMITTED", "NOT_ADMITTED"],
  ADMITTED: ["ENROLLED"],
};
