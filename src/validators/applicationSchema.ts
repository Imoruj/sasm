import { z } from "zod";
import { NIGERIAN_PHONE_REGEX } from "@/constants";

const optionalUuid = (message: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid(message).optional(),
  );

export const createApplicationSchema = z.object({
  templateId: z.string().uuid("A published application template is required"),
  branchId: optionalUuid("Please select a branch"),
  admissionCycleId: optionalUuid("Please select an admission cycle"),
  classApplied: z.enum(["NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"]),
});

export const studentInfoSchema = z.object({
  studentFirstName: z.string().min(2, "First name is required").max(100),
  studentLastName: z.string().min(2, "Last name is required").max(100),
  studentMiddleName: z.string().max(100).optional().or(z.literal("")),
  studentDob: z.string().min(1, "Date of birth is required"),
  studentGender: z.enum(["Male", "Female"], { required_error: "Gender is required" }),
  studentNationality: z.string().min(2, "Nationality is required").default("Nigerian"),
  studentStateOfOrigin: z.string().min(2, "State of origin is required"),
  studentLga: z.string().min(2, "LGA is required"),
  previousSchool: z.string().max(255).optional().or(z.literal("")),
  previousSchoolAddress: z.string().optional().or(z.literal("")),
});

export const updateApplicationSchema = z.object({
  studentFirstName: z.string().min(2).max(100).optional(),
  studentLastName: z.string().min(2).max(100).optional(),
  studentMiddleName: z.string().max(100).optional(),
  studentDob: z.string().optional(),
  studentGender: z.string().optional(),
  studentNationality: z.string().optional(),
  studentStateOfOrigin: z.string().optional(),
  studentLga: z.string().optional(),
  previousSchool: z.string().max(255).optional(),
  previousSchoolAddress: z.string().optional(),
  formData: z.record(z.unknown()).optional(),
});

export const submitApplicationSchema = z.object({
  applicationId: z.string().uuid(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type StudentInfoInput = z.infer<typeof studentInfoSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
