/**
 * Master field registry — the complete set of fields on the school's physical form.
 * The form builder lets admins toggle each field on/off per template.
 * Fields marked `locked: true` are always enabled and cannot be turned off.
 */

export type FieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "date" | "tel" | "email" | "number" | "file";

export interface FieldOption {
  value: string;
  label: string;
  campuses?: string[];
}

export interface ConditionalLogic {
  fieldId: string;
  operator: "equals" | "not_equals";
  value: string;
}

export interface MasterField {
  id:               string;
  type:             FieldType;
  label:            string;
  required:         boolean;
  locked?:          boolean;   // true = always included, toggle disabled
  helpText?:        string;
  defaultValue?:    string;
  options?:         FieldOption[];
  conditionalLogic?: ConditionalLogic;
  accept?:          string[];
}

export interface MasterSubsection {
  id:     string;
  label:  string;
  fields: MasterField[];
}

export interface MasterSection {
  id:          string;
  title:       string;
  order:       number;
  helpText?:   string;
  subsections?: MasterSubsection[];
  fields:      MasterField[];
}

export const FORM_FIELD_REGISTRY: MasterSection[] = [
  // ─── SECTION 1: Campus & Class Selection ────────────────────────────────────
  {
    id: "placement",
    title: "Campus & Class Selection",
    order: 1,
    fields: [
      {
        id: "campusType", type: "select", label: "Campus Type", required: true, locked: true,
        options: [
          { value: "BOARDING", label: "Boarding School (JSS 1 – SS 3)" },
          { value: "DAY",      label: "Day School (Nursery – SS 3)" },
          { value: "METRO",    label: "Metro Campus (Nursery – SS 3)" },
        ],
      },
      {
        id: "classApplied", type: "select", label: "Desired Class of Entry", required: true, locked: true,
        helpText: "Available classes depend on the selected campus type",
        options: [
          { value: "PRE_NURSERY", label: "Pre-Nursery", campuses: ["DAY", "METRO"] },
          { value: "NURSERY1",    label: "Nursery 1",   campuses: ["DAY", "METRO"] },
          { value: "NURSERY2",    label: "Nursery 2",   campuses: ["DAY", "METRO"] },
          { value: "NURSERY",     label: "Nursery",     campuses: ["DAY", "METRO"] },
          { value: "PRIMARY",     label: "Primary",     campuses: ["DAY", "METRO"] },
          { value: "BASIC1",      label: "Basic 1",     campuses: ["DAY", "METRO"] },
          { value: "BASIC2",      label: "Basic 2",     campuses: ["DAY", "METRO"] },
          { value: "BASIC3",      label: "Basic 3",     campuses: ["DAY", "METRO"] },
          { value: "BASIC4",      label: "Basic 4",     campuses: ["DAY", "METRO"] },
          { value: "BASIC5",      label: "Basic 5",     campuses: ["DAY", "METRO"] },
          { value: "BASIC6",      label: "Basic 6",     campuses: ["DAY", "METRO"] },
          { value: "JSS1",        label: "JSS 1",       campuses: ["BOARDING", "DAY", "METRO"] },
          { value: "JSS2",        label: "JSS 2",       campuses: ["BOARDING", "DAY", "METRO"] },
          { value: "JSS3",        label: "JSS 3",       campuses: ["BOARDING", "DAY", "METRO"] },
          { value: "SS1",         label: "SS 1",        campuses: ["BOARDING", "DAY", "METRO"] },
          { value: "SS2",         label: "SS 2",        campuses: ["BOARDING", "DAY", "METRO"] },
          { value: "SS3",         label: "SS 3",        campuses: ["BOARDING", "DAY", "METRO"] },
        ],
      },
      {
        id: "studentType", type: "radio", label: "Student Type", required: true, locked: true,
        options: [{ value: "NEW", label: "New Student" }, { value: "TRANSFER", label: "Transfer Student" }],
      },
    ],
  },

  // ─── SECTION 2: Candidate's Details ─────────────────────────────────────────
  {
    id: "candidate_details",
    title: "Candidate's Details",
    order: 2,
    fields: [
      { id: "studentLastName",       type: "text",   label: "Surname",                  required: true,  locked: true },
      { id: "studentFirstName",      type: "text",   label: "Other Names",               required: true,  locked: true },
      {
        id: "studentGender", type: "radio", label: "Gender", required: true, locked: true,
        options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
      },
      { id: "placeOfBirth",          type: "text",   label: "Place of Birth",            required: true  },
      { id: "studentDob",            type: "date",   label: "Date of Birth",             required: true,  locked: true },
      { id: "studentStateOfOrigin",  type: "select", label: "State of Origin",           required: true,  locked: true },
      { id: "studentLga",            type: "select", label: "L.G.A",                     required: true,  locked: true },
      { id: "studentNationality",    type: "text",   label: "Nationality",               required: true,  defaultValue: "Nigerian" },
      { id: "religion",              type: "text",   label: "Religion",                  required: true  },
      { id: "passportNumber",        type: "text",   label: "International Passport No", required: false, helpText: "Required for non-Nigerian nationals" },
    ],
  },

  // ─── SECTION 3: Parents Details ──────────────────────────────────────────────
  {
    id: "parents_details",
    title: "Parents Details",
    order: 3,
    subsections: [
      {
        id: "father_details",
        label: "(a) Father",
        fields: [
          { id: "fatherSurname",        type: "text",     label: "Father — Surname",         required: false },
          { id: "fatherOtherNames",     type: "text",     label: "Father — Other Names",     required: false },
          { id: "fatherOccupation",     type: "text",     label: "Father — Occupation",      required: false },
          { id: "fatherContactAddress", type: "textarea", label: "Father — Contact Address", required: false },
          { id: "fatherHomeAddress",    type: "textarea", label: "Father — Home Address",    required: false },
          { id: "fatherHomePhone",      type: "tel",      label: "Father — Phone No",        required: false },
          { id: "fatherEmail",          type: "email",    label: "Father — E-mail",          required: false },
          { id: "fatherOfficePhone",    type: "tel",      label: "Father — Office Phone",    required: false },
        ],
      },
      {
        id: "mother_details",
        label: "(b) Mother",
        fields: [
          { id: "motherSurname",        type: "text",     label: "Mother — Surname",         required: false },
          { id: "motherOtherNames",     type: "text",     label: "Mother — Other Names",     required: false },
          { id: "motherOccupation",     type: "text",     label: "Mother — Occupation",      required: false },
          { id: "motherContactAddress", type: "textarea", label: "Mother — Contact Address", required: false },
          { id: "motherHomeAddress",    type: "textarea", label: "Mother — Home Address",    required: false },
          { id: "motherHomePhone",      type: "tel",      label: "Mother — Phone No",        required: false },
          { id: "motherEmail",          type: "email",    label: "Mother — E-mail",          required: false },
          { id: "motherOfficePhone",    type: "tel",      label: "Mother — Office Phone",    required: false },
        ],
      },
      {
        id: "guardian_details",
        label: "(c) Guardian / Sponsor",
        fields: [
          { id: "guardianSurname",        type: "text",     label: "Guardian — Surname",         required: false },
          { id: "guardianOtherNames",     type: "text",     label: "Guardian — Other Names",     required: false },
          { id: "guardianOccupation",     type: "text",     label: "Guardian — Occupation",      required: false },
          { id: "guardianContactAddress", type: "textarea", label: "Guardian — Contact Address", required: false },
          { id: "guardianHomeAddress",    type: "textarea", label: "Guardian — Home Address",    required: false },
          { id: "guardianPhone",          type: "tel",      label: "Guardian — Phone No",        required: false },
          { id: "guardianEmail",          type: "email",    label: "Guardian — E-mail",          required: false },
        ],
      },
    ],
    fields: [
      { id: "numChildrenInFamily", type: "number",   label: "Number of Children in the Family", required: false },
      { id: "numChildrenInSchool", type: "number",   label: "Number of Children in T.I.S",       required: false },
      { id: "brothersNameAge",     type: "textarea", label: "Name(s) of Brother(s) / Age",       required: false, helpText: "Enter each brother on a new line: Name, Age" },
      { id: "sistersNameAge",      type: "textarea", label: "Name(s) of Sister(s) / Age",        required: false, helpText: "Enter each sister on a new line: Name, Age" },
    ],
  },

  // ─── SECTION 4: Educational Details ─────────────────────────────────────────
  {
    id: "educational_details",
    title: "Educational Details",
    order: 4,
    fields: [
      { id: "primarySchoolName",       type: "text",     label: "Name of Primary School",              required: false },
      { id: "transferPrimarySchool",   type: "text",     label: "Name of Primary School (Transfer)",   required: false, conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
      { id: "transferSecondarySchool", type: "text",     label: "Name of Secondary School (Transfer)", required: false, conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
      { id: "transferReason",          type: "textarea", label: "Reason for Transfer",                 required: false, helpText: "Enclose photocopies of previous results", conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
    ],
  },

  // ─── SECTION 5: Health Details ───────────────────────────────────────────────
  {
    id: "health_details",
    title: "Health Details",
    order: 5,
    helpText: "Enclose photocopies of birth certificate and immunisation card or record",
    fields: [
      { id: "allergyFood",               type: "radio",    label: "Allergic to any food?",               required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
      { id: "allergyFoodDetails",        type: "text",     label: "If yes, state food",                  required: false, conditionalLogic: { fieldId: "allergyFood",        operator: "equals", value: "Yes" } },
      { id: "allergyDrugs",              type: "radio",    label: "Allergic to any tablets/drugs?",      required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
      { id: "allergyDrugsDetails",       type: "text",     label: "If yes, state drugs",                 required: false, conditionalLogic: { fieldId: "allergyDrugs",       operator: "equals", value: "Yes" } },
      { id: "allergyPlant",              type: "radio",    label: "Allergic to any plant?",              required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
      { id: "allergyPlantDetails",       type: "text",     label: "If yes, state plant",                 required: false, conditionalLogic: { fieldId: "allergyPlant",       operator: "equals", value: "Yes" } },
      { id: "physicalDisability",        type: "radio",    label: "Any physical disability?",            required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
      { id: "physicalDisabilityDetails", type: "text",     label: "If yes, state",                       required: false, conditionalLogic: { fieldId: "physicalDisability", operator: "equals", value: "Yes" } },
      { id: "eyeCheckDone",              type: "radio",    label: "Eye check done before?",              required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
      { id: "eyeCheckWhere",             type: "text",     label: "Eye check — where?",                  required: false, conditionalLogic: { fieldId: "eyeCheckDone",       operator: "equals", value: "Yes" } },
      { id: "eyeCheckDate",              type: "date",     label: "Eye check — date",                    required: false, conditionalLogic: { fieldId: "eyeCheckDone",       operator: "equals", value: "Yes" } },
      { id: "dentalCheckDone",           type: "radio",    label: "Dental check done before?",           required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
      { id: "dentalCheckWhere",          type: "text",     label: "Dental check — where?",               required: false, conditionalLogic: { fieldId: "dentalCheckDone",    operator: "equals", value: "Yes" } },
      { id: "dentalCheckDate",           type: "date",     label: "Dental check — date",                 required: false, conditionalLogic: { fieldId: "dentalCheckDone",    operator: "equals", value: "Yes" } },
      { id: "otherHealthChallenges",     type: "textarea", label: "Other ailments / health challenges",  required: false },
    ],
  },

  // ─── SECTION 6: Hobbies ──────────────────────────────────────────────────────
  {
    id: "hobbies",
    title: "Hobbies",
    order: 6,
    fields: [
      { id: "hobbies", type: "textarea", label: "Hobbies & Interests", required: false },
    ],
  },

  // ─── SECTION 7: Declaration ──────────────────────────────────────────────────
  {
    id: "declaration",
    title: "Declaration",
    order: 7,
    fields: [
      {
        id: "declarationAccepted", type: "checkbox", required: true, locked: true,
        label: "I/We declare that each piece of information supplied is accurate and subject to verification.",
      },
    ],
  },

  // ─── SECTION 8: Required Documents ──────────────────────────────────────────
  {
    id: "documents",
    title: "Required Documents",
    order: 8,
    helpText: "Maximum 5MB per file. Accepted formats: PDF, JPG, PNG",
    fields: [
      { id: "doc_passport_photo", type: "file", label: "Passport Photograph",        required: true,  locked: true,  accept: ["JPG", "PNG"],        helpText: "Recent passport-sized photograph" },
      { id: "doc_birth_cert",     type: "file", label: "Birth Certificate",          required: true,  locked: true,  accept: ["PDF", "JPG", "PNG"], helpText: "Official birth certificate or declaration of age" },
      { id: "doc_immunisation",   type: "file", label: "Immunisation Card / Record", required: false, accept: ["PDF", "JPG", "PNG"] },
      { id: "doc_report_card",    type: "file", label: "Last School Report Card",    required: false, accept: ["PDF", "JPG", "PNG"], helpText: "Required for transfer students" },
      { id: "doc_transfer_cert",  type: "file", label: "Transfer Certificate",       required: false, accept: ["PDF", "JPG", "PNG"], conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
    ],
  },
];

/** All field IDs that are locked (always enabled) */
export const LOCKED_FIELD_IDS = new Set(
  FORM_FIELD_REGISTRY.flatMap((s) => [
    ...s.fields.filter((f) => f.locked).map((f) => f.id),
    ...(s.subsections ?? []).flatMap((sub) => sub.fields.filter((f) => f.locked).map((f) => f.id)),
  ]),
);

/** All field IDs (locked + optional) — used to build the default "all enabled" state */
export const ALL_FIELD_IDS = FORM_FIELD_REGISTRY.flatMap((s) => [
  ...s.fields.map((f) => f.id),
  ...(s.subsections ?? []).flatMap((sub) => sub.fields.map((f) => f.id)),
]);
