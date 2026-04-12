import { z } from "zod";
import { NIGERIAN_PHONE_REGEX } from "@/constants";

export const applicantProfileSchema = z.object({
  guardianTitle: z.enum(["Mr", "Mrs", "Ms", "Dr", "Prof", "Chief", "Engr", "Barrister"]).optional(),
  occupation: z.string().max(255).optional().or(z.literal("")),
  employer: z.string().max(255).optional().or(z.literal("")),
  officeAddress: z.string().optional().or(z.literal("")),
  secondaryPhone: z
    .string()
    .regex(NIGERIAN_PHONE_REGEX, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  residentialAddress: z.string().min(5, "Address is required"),
  state: z.string().min(2, "State is required"),
  lga: z.string().min(2, "LGA is required"),
  city: z.string().max(100).optional().or(z.literal("")),
  emergencyContactName: z.string().max(255).optional().or(z.literal("")),
  emergencyContactPhone: z
    .string()
    .regex(NIGERIAN_PHONE_REGEX, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  emergencyContactRelation: z.string().max(50).optional().or(z.literal("")),
});

export type ApplicantProfileInput = z.infer<typeof applicantProfileSchema>;
