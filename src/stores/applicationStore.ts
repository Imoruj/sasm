import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ApplicationDraft {
  id?: string;
  branchId?: string;
  admissionCycleId?: string;
  classApplied?: string;
  studentFirstName?: string;
  studentLastName?: string;
  studentMiddleName?: string;
  studentDob?: string;
  studentGender?: string;
  studentNationality?: string;
  studentStateOfOrigin?: string;
  studentLga?: string;
  previousSchool?: string;
  formData?: Record<string, unknown>;
}

interface ApplicationStore {
  draft: ApplicationDraft;
  currentStep: number;
  setDraft: (data: Partial<ApplicationDraft>) => void;
  setStep: (step: number) => void;
  clearDraft: () => void;
}

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set) => ({
      draft: {},
      currentStep: 1,
      setDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
      setStep: (step) => set({ currentStep: step }),
      clearDraft: () => set({ draft: {}, currentStep: 1 }),
    }),
    { name: "sams-application-draft" },
  ),
);
