import { z } from "zod";

export const approveApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  adminNotes: z.string().max(1000).optional(),
});

export const rejectApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  rejectionReason: z.string().min(10, "Please provide a rejection reason").max(1000),
});

export const requestRevisionSchema = z.object({
  applicationId: z.string().uuid(),
  revisionFeedback: z.record(z.string(), z.string()),
  adminNotes: z.string().max(1000).optional(),
});

export const startApplicationReviewSchema = z.object({
  applicationId: z.string().uuid(),
});

export const startApplicationForApplicantSchema = z.object({
  applicantEmail: z.string().email(),
  templateId: z.string().uuid("A published application template is required"),
  branchId: z.string().uuid().optional(),
  admissionCycleId: z.string().uuid().optional(),
  classApplied: z.enum([
    "PRE_NURSERY", "NURSERY1", "NURSERY2", "NURSERY", "PRIMARY",
    "BASIC1", "BASIC2", "BASIC3", "BASIC4", "BASIC5", "BASIC6",
    "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3",
  ]),
});

export const createExamSessionSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  examDate: z.string().min(1, "Exam date is required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  durationMinutes: z.number().int().min(30).max(480),
  mode: z.enum(["ONLINE", "ON_CAMPUS"]),
  venue: z.string().optional(),
  onlineLink: z.string().url().optional().or(z.literal("")),
  capacity: z.number().int().min(1),
  classLevels: z.array(z.enum(["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"])).min(1),
});

export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;
export type RequestRevisionInput = z.infer<typeof requestRevisionSchema>;
export type StartApplicationReviewInput = z.infer<typeof startApplicationReviewSchema>;
export type StartApplicationForApplicantInput = z.infer<typeof startApplicationForApplicantSchema>;
export type CreateExamSessionInput = z.infer<typeof createExamSessionSchema>;
