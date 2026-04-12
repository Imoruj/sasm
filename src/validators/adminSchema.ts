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
export type CreateExamSessionInput = z.infer<typeof createExamSessionSchema>;
