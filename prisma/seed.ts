import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Create demo organisation
  const org = await db.organization.upsert({
    where: { slug: "greenfield-schools" },
    update: {},
    create: {
      name: "Greenfield Schools",
      slug: "greenfield-schools",
      email: "admin@greenfieldschools.edu.ng",
      phone: "+2348012345678",
      address: "12 Education Way, Victoria Island",
      state: "Lagos",
      lga: "Lagos Island",
      city: "Lagos",
      primaryColor: "#1B4332",
      secondaryColor: "#2D6A4F",
      subscriptionPlan: "PREMIUM",
      isActive: true,
    },
  });

  console.log("✅ Organisation created:", org.name);

  // Create branches
  const branchData = [
    { name: "Greenfield Victoria Island", code: "GF-VI", state: "Lagos", lga: "Lagos Island", city: "Victoria Island", address: "12 Education Way, V/I", capacity: 200 },
    { name: "Greenfield Lekki", code: "GF-LK", state: "Lagos", lga: "Eti Osa", city: "Lekki", address: "5 Admiralty Way, Lekki Phase 1", capacity: 150 },
    { name: "Greenfield Abuja", code: "GF-ABJ", state: "FCT", lga: "Municipal Area Council", city: "Abuja", address: "Plot 10, Wuse Zone 5, Abuja", capacity: 100 },
  ];

  const branches = [];
  for (const b of branchData) {
    const branch = await db.branch.upsert({
      where: { organizationId_code: { organizationId: org.id, code: b.code } },
      update: {},
      create: {
        organizationId: org.id,
        phone: "+2348012345678",
        email: `${b.code.toLowerCase()}@greenfieldschools.edu.ng`,
        contactPerson: "Principal",
        isActive: true,
        ...b,
      },
    });
    branches.push(branch);
  }
  console.log(`✅ ${branches.length} branches created`);

  // Create admission cycle
  const CYCLE_ID = "00000000-0000-0000-0000-000000002026";
  const cycle = await db.admissionCycle.upsert({
    where: { id: CYCLE_ID },
    update: {},
    create: {
      id: CYCLE_ID,
      organizationId: org.id,
      name: "2026/2027 Academic Session",
      academicYear: "2026/2027",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-07-31"),
      status: "OPEN",
      isDefault: true,
    },
  });
  console.log("✅ Admission cycle created:", cycle.name);

  // Create fee structures
  const feeStructures = [
    { classLevel: null, paymentType: "APPLICATION_FEE" as const, amountKobo: 500000 }, // ₦5,000
    { classLevel: null, paymentType: "EXAM_FEE" as const, amountKobo: 1000000 },       // ₦10,000
    { classLevel: null, paymentType: "ADMISSION_FEE" as const, amountKobo: 5000000 },  // ₦50,000
  ];

  for (const fee of feeStructures) {
    await db.feeStructure.create({
      data: {
        organizationId: org.id,
        admissionCycleId: cycle.id,
        ...fee,
        isActive: true,
      },
    }).catch(() => {}); // Ignore duplicates
  }
  console.log("✅ Fee structures created");

  // Hash passwords
  const adminHash = await bcrypt.hash("Admin@1234", 12);
  const superHash = await bcrypt.hash("SuperAdmin@1234", 12);
  const applicantHash = await bcrypt.hash("Applicant@1234", 12);

  // Create super admin
  const superAdmin = await db.user.upsert({
    where: { email: "superadmin@greenfieldschools.edu.ng" },
    update: {},
    create: {
      email: "superadmin@greenfieldschools.edu.ng",
      firstName: "Emeka",
      lastName: "Okafor",
      passwordHash: superHash,
      role: "SUPER_ADMIN",
      organizationId: org.id,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log("✅ Super admin created:", superAdmin.email);

  // Create branch admin
  const branchAdmin = await db.user.upsert({
    where: { email: "admin.vi@greenfieldschools.edu.ng" },
    update: {},
    create: {
      email: "admin.vi@greenfieldschools.edu.ng",
      firstName: "Amaka",
      lastName: "Nwosu",
      passwordHash: adminHash,
      role: "SCHOOL_ADMIN",
      organizationId: org.id,
      branchId: branches[0].id,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log("✅ Branch admin created:", branchAdmin.email);

  // Create demo applicant
  const applicant = await db.user.upsert({
    where: { email: "parent@example.com" },
    update: {},
    create: {
      email: "parent@example.com",
      firstName: "Chidi",
      lastName: "Obi",
      passwordHash: applicantHash,
      phone: "+2348099887766",
      role: "APPLICANT",
      emailVerified: true,
      isActive: true,
    },
  });
  console.log("✅ Demo applicant created:", applicant.email);

  // Create demo application
  const appCount = await db.application.count({ where: { applicantId: applicant.id } });
  if (appCount === 0) {
    await db.application.create({
      data: {
        applicationNumber: "SAMS-2026-DEMO01",
        applicantId: applicant.id,
        organizationId: org.id,
        branchId: branches[0].id,
        admissionCycleId: cycle.id,
        classApplied: "JSS1",
        status: "SUBMITTED",
        studentFirstName: "Chukwuemeka",
        studentLastName: "Obi",
        studentDob: new Date("2014-03-15"),
        studentGender: "Male",
        studentNationality: "Nigerian",
        studentStateOfOrigin: "Anambra",
        studentLga: "Onitsha North",
        previousSchool: "Sunrise Primary School, Onitsha",
        submittedAt: new Date(),
        statusHistory: {
          create: [
            { toStatus: "DRAFT", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
            { fromStatus: "DRAFT", toStatus: "SUBMITTED", changedBy: applicant.id, createdAt: new Date() },
          ],
        },
      },
    });
    console.log("✅ Demo application created");
  }

  // Create default form template (matches the physical school admission form)
  const FORM_TEMPLATE_ID = "00000000-0000-0000-0000-000000003001";
  await db.formTemplate.upsert({
    where: { id: FORM_TEMPLATE_ID },
    update: {
      name: "Standard Admission Form",
      description: "Official admission application form — matches the school's physical form",
      status: "PUBLISHED",
      isDefault: true,
      schema: {
        // Campus → available class levels mapping
        campusClassMap: {
          BOARDING: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
          DAY:      ["NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
          METRO:    ["NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
        },
        sections: [
          // ─── SECTION 1: Campus & Class Selection ───────────────────────────
          {
            id: "placement",
            title: "Campus & Class Selection",
            order: 1,
            fields: [
              {
                id: "campusType",
                type: "select",
                label: "Campus Type",
                required: true,
                options: [
                  { value: "BOARDING", label: "Boarding School (JSS 1 – SS 3)" },
                  { value: "DAY",      label: "Day School (Nursery – SS 3)" },
                  { value: "METRO",    label: "Metro Campus (Nursery – SS 3)" },
                ],
              },
              {
                id: "classApplied",
                type: "select",
                label: "Desired Class of Entry",
                required: true,
                helpText: "Available classes depend on your selected campus type",
                // Options are dynamically filtered by campusType at runtime
                options: [
                  { value: "NURSERY",  label: "Nursery",  campuses: ["DAY", "METRO"] },
                  { value: "PRIMARY",  label: "Primary",  campuses: ["DAY", "METRO"] },
                  { value: "JSS1",     label: "JSS 1",    campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "JSS2",     label: "JSS 2",    campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "JSS3",     label: "JSS 3",    campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "SS1",      label: "SS 1",     campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "SS2",      label: "SS 2",     campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "SS3",      label: "SS 3",     campuses: ["BOARDING", "DAY", "METRO"] },
                ],
              },
              {
                id: "studentType",
                type: "radio",
                label: "Student Type",
                required: true,
                options: [
                  { value: "NEW",      label: "New Student" },
                  { value: "TRANSFER", label: "Transfer Student" },
                ],
              },
            ],
          },

          // ─── SECTION 2: Candidate's Details ────────────────────────────────
          {
            id: "candidate_details",
            title: "Candidate's Details",
            order: 2,
            fields: [
              { id: "studentLastName",      type: "text",     label: "Surname",                   required: true },
              { id: "studentFirstName",     type: "text",     label: "Other Names",                required: true },
              {
                id: "studentGender",
                type: "radio",
                label: "Gender",
                required: true,
                options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
              },
              { id: "placeOfBirth",         type: "text",     label: "Place of Birth",             required: true },
              { id: "studentDob",           type: "date",     label: "Date of Birth",              required: true },
              { id: "studentStateOfOrigin", type: "select",   label: "State of Origin",            required: true },
              { id: "studentLga",           type: "select",   label: "L.G.A",                      required: true },
              { id: "studentNationality",   type: "text",     label: "Nationality",                required: true, defaultValue: "Nigerian" },
              { id: "religion",             type: "text",     label: "Religion",                   required: true },
              { id: "passportNumber",       type: "text",     label: "International Passport No",  required: false, helpText: "Required for non-Nigerian nationals" },
            ],
          },

          // ─── SECTION 3: Parents Details ─────────────────────────────────────
          {
            id: "parents_details",
            title: "Parents Details",
            order: 3,
            subsections: [
              {
                id: "father_details",
                label: "(a) Father",
                fields: [
                  { id: "fatherSurname",       type: "text",     label: "Surname",         required: false },
                  { id: "fatherOtherNames",    type: "text",     label: "Other Names",     required: false },
                  { id: "fatherOccupation",    type: "text",     label: "Occupation",      required: false },
                  { id: "fatherContactAddress",type: "textarea", label: "Contact Address", required: false },
                  { id: "fatherHomeAddress",   type: "textarea", label: "Home Address",    required: false },
                  { id: "fatherHomePhone",     type: "tel",      label: "Phone No",        required: false },
                  { id: "fatherEmail",         type: "email",    label: "E-mail Address",  required: false },
                  { id: "fatherOfficePhone",   type: "tel",      label: "Office Phone No", required: false },
                ],
              },
              {
                id: "mother_details",
                label: "(b) Mother",
                fields: [
                  { id: "motherSurname",        type: "text",     label: "Surname",         required: false },
                  { id: "motherOtherNames",     type: "text",     label: "Other Names",     required: false },
                  { id: "motherOccupation",     type: "text",     label: "Occupation",      required: false },
                  { id: "motherContactAddress", type: "textarea", label: "Contact Address", required: false },
                  { id: "motherHomeAddress",    type: "textarea", label: "Home Address",    required: false },
                  { id: "motherHomePhone",      type: "tel",      label: "Phone No",        required: false },
                  { id: "motherEmail",          type: "email",    label: "E-mail Address",  required: false },
                  { id: "motherOfficePhone",    type: "tel",      label: "Office Phone No", required: false },
                ],
              },
              {
                id: "guardian_details",
                label: "(c) Guardian / Sponsor",
                fields: [
                  { id: "guardianSurname",       type: "text",     label: "Surname",         required: false },
                  { id: "guardianOtherNames",    type: "text",     label: "Other Names",     required: false },
                  { id: "guardianOccupation",    type: "text",     label: "Occupation",      required: false },
                  { id: "guardianContactAddress",type: "textarea", label: "Contact Address", required: false },
                  { id: "guardianHomeAddress",   type: "textarea", label: "Home Address",    required: false },
                  { id: "guardianPhone",         type: "tel",      label: "Phone No",        required: false },
                  { id: "guardianEmail",         type: "email",    label: "E-mail Address",  required: false },
                ],
              },
            ],
            // Top-level fields for this section (family info)
            fields: [
              { id: "numChildrenInFamily", type: "number",   label: "Number of Children in the Family",    required: false },
              { id: "numChildrenInSchool", type: "number",   label: "Number of Children in T.I.S",          required: false },
              { id: "brothersNameAge",     type: "textarea", label: "Name(s) of Brother(s) / Age",          required: false, helpText: "Enter each brother on a new line: Name, Age" },
              { id: "sistersNameAge",      type: "textarea", label: "Name(s) of Sister(s) / Age",           required: false, helpText: "Enter each sister on a new line: Name, Age" },
            ],
          },

          // ─── SECTION 4: Educational Details ────────────────────────────────
          {
            id: "educational_details",
            title: "Educational Details",
            order: 4,
            fields: [
              { id: "primarySchoolName",    type: "text", label: "Name of Primary School",  required: false },
              // Transfer-only fields — shown when studentType === "TRANSFER"
              {
                id: "transferPrimarySchool",
                type: "text",
                label: "Name of Primary School (Transfer)",
                required: false,
                conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" },
              },
              {
                id: "transferSecondarySchool",
                type: "text",
                label: "Name of Secondary School (Transfer)",
                required: false,
                conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" },
              },
              {
                id: "transferReason",
                type: "textarea",
                label: "Reason for Transfer",
                required: false,
                helpText: "Enclose photocopies of previous results for record purposes",
                conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" },
              },
            ],
          },

          // ─── SECTION 5: Health Details ──────────────────────────────────────
          {
            id: "health_details",
            title: "Health Details",
            order: 5,
            helpText: "Enclose photocopies of birth certificate and immunisation card or record",
            fields: [
              {
                id: "allergyFood",
                type: "radio",
                label: "Are you allergic to any food?",
                required: false,
                options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }],
              },
              {
                id: "allergyFoodDetails",
                type: "text",
                label: "If yes, state food",
                required: false,
                conditionalLogic: { fieldId: "allergyFood", operator: "equals", value: "Yes" },
              },
              {
                id: "allergyDrugs",
                type: "radio",
                label: "Are you allergic to any tablets/drugs?",
                required: false,
                options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }],
              },
              {
                id: "allergyDrugsDetails",
                type: "text",
                label: "If yes, state drugs",
                required: false,
                conditionalLogic: { fieldId: "allergyDrugs", operator: "equals", value: "Yes" },
              },
              {
                id: "allergyPlant",
                type: "radio",
                label: "Are you allergic to any plant?",
                required: false,
                options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }],
              },
              {
                id: "allergyPlantDetails",
                type: "text",
                label: "If yes, state plant",
                required: false,
                conditionalLogic: { fieldId: "allergyPlant", operator: "equals", value: "Yes" },
              },
              {
                id: "physicalDisability",
                type: "radio",
                label: "Do you have any physical disability?",
                required: false,
                options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }],
              },
              {
                id: "physicalDisabilityDetails",
                type: "text",
                label: "If yes, state",
                required: false,
                conditionalLogic: { fieldId: "physicalDisability", operator: "equals", value: "Yes" },
              },
              {
                id: "eyeCheckDone",
                type: "radio",
                label: "Have you checked your eyes in the past?",
                required: false,
                options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }],
              },
              {
                id: "eyeCheckWhere",
                type: "text",
                label: "If yes, where?",
                required: false,
                conditionalLogic: { fieldId: "eyeCheckDone", operator: "equals", value: "Yes" },
              },
              {
                id: "eyeCheckDate",
                type: "date",
                label: "Eye check date",
                required: false,
                conditionalLogic: { fieldId: "eyeCheckDone", operator: "equals", value: "Yes" },
              },
              {
                id: "dentalCheckDone",
                type: "radio",
                label: "Have you checked your dental status?",
                required: false,
                options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }],
              },
              {
                id: "dentalCheckWhere",
                type: "text",
                label: "If yes, where?",
                required: false,
                conditionalLogic: { fieldId: "dentalCheckDone", operator: "equals", value: "Yes" },
              },
              {
                id: "dentalCheckDate",
                type: "date",
                label: "Dental check date",
                required: false,
                conditionalLogic: { fieldId: "dentalCheckDone", operator: "equals", value: "Yes" },
              },
              {
                id: "otherHealthChallenges",
                type: "textarea",
                label: "State any other ailment or health challenges",
                required: false,
              },
            ],
          },

          // ─── SECTION 6: Hobbies ─────────────────────────────────────────────
          {
            id: "hobbies",
            title: "Hobbies",
            order: 6,
            fields: [
              { id: "hobbies", type: "textarea", label: "Hobbies & Interests", required: false },
            ],
          },

          // ─── SECTION 7: Declaration ─────────────────────────────────────────
          {
            id: "declaration",
            title: "Declaration",
            order: 7,
            fields: [
              {
                id: "declarationAccepted",
                type: "checkbox",
                label: "I/We declare that each piece of information supplied is accurate and subject to verification.",
                required: true,
              },
            ],
          },

          // ─── SECTION 8: Required Documents ─────────────────────────────────
          {
            id: "documents",
            title: "Required Documents",
            order: 8,
            helpText: "Maximum 5MB per file. Accepted formats: PDF, JPG, PNG",
            fields: [
              { id: "doc_passport_photo", type: "file", label: "Passport Photograph",            required: true,  accept: ["JPG", "PNG"],          helpText: "Recent passport-sized photograph" },
              { id: "doc_birth_cert",     type: "file", label: "Birth Certificate",              required: true,  accept: ["PDF", "JPG", "PNG"],   helpText: "Official birth certificate or declaration of age" },
              { id: "doc_immunisation",   type: "file", label: "Immunisation Card / Record",     required: false, accept: ["PDF", "JPG", "PNG"] },
              { id: "doc_report_card",    type: "file", label: "Last School Report Card",        required: false, accept: ["PDF", "JPG", "PNG"],   helpText: "Required for transfer students" },
              { id: "doc_transfer_cert",  type: "file", label: "Transfer Certificate",           required: false, accept: ["PDF", "JPG", "PNG"],   conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
            ],
          },
        ],
      },
    },
    create: {
      id: FORM_TEMPLATE_ID,
      organizationId: org.id,
      name: "Standard Admission Form",
      description: "Official admission application form — matches the school's physical form",
      status: "PUBLISHED",
      isDefault: true,
      schema: {
        campusClassMap: {
          BOARDING: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
          DAY:      ["NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
          METRO:    ["NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
        },
        sections: [
          {
            id: "placement",
            title: "Campus & Class Selection",
            order: 1,
            fields: [
              {
                id: "campusType",
                type: "select",
                label: "Campus Type",
                required: true,
                options: [
                  { value: "BOARDING", label: "Boarding School (JSS 1 – SS 3)" },
                  { value: "DAY",      label: "Day School (Nursery – SS 3)" },
                  { value: "METRO",    label: "Metro Campus (Nursery – SS 3)" },
                ],
              },
              {
                id: "classApplied",
                type: "select",
                label: "Desired Class of Entry",
                required: true,
                helpText: "Available classes depend on your selected campus type",
                options: [
                  { value: "NURSERY",  label: "Nursery",  campuses: ["DAY", "METRO"] },
                  { value: "PRIMARY",  label: "Primary",  campuses: ["DAY", "METRO"] },
                  { value: "JSS1",     label: "JSS 1",    campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "JSS2",     label: "JSS 2",    campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "JSS3",     label: "JSS 3",    campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "SS1",      label: "SS 1",     campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "SS2",      label: "SS 2",     campuses: ["BOARDING", "DAY", "METRO"] },
                  { value: "SS3",      label: "SS 3",     campuses: ["BOARDING", "DAY", "METRO"] },
                ],
              },
              {
                id: "studentType",
                type: "radio",
                label: "Student Type",
                required: true,
                options: [
                  { value: "NEW",      label: "New Student" },
                  { value: "TRANSFER", label: "Transfer Student" },
                ],
              },
            ],
          },
          {
            id: "candidate_details",
            title: "Candidate's Details",
            order: 2,
            fields: [
              { id: "studentLastName",      type: "text",   label: "Surname",                  required: true },
              { id: "studentFirstName",     type: "text",   label: "Other Names",               required: true },
              {
                id: "studentGender",
                type: "radio",
                label: "Gender",
                required: true,
                options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
              },
              { id: "placeOfBirth",         type: "text",   label: "Place of Birth",            required: true },
              { id: "studentDob",           type: "date",   label: "Date of Birth",             required: true },
              { id: "studentStateOfOrigin", type: "select", label: "State of Origin",           required: true },
              { id: "studentLga",           type: "select", label: "L.G.A",                     required: true },
              { id: "studentNationality",   type: "text",   label: "Nationality",               required: true, defaultValue: "Nigerian" },
              { id: "religion",             type: "text",   label: "Religion",                  required: true },
              { id: "passportNumber",       type: "text",   label: "International Passport No", required: false, helpText: "Required for non-Nigerian nationals" },
            ],
          },
          {
            id: "parents_details",
            title: "Parents Details",
            order: 3,
            subsections: [
              {
                id: "father_details",
                label: "(a) Father",
                fields: [
                  { id: "fatherSurname",        type: "text",     label: "Surname",         required: false },
                  { id: "fatherOtherNames",     type: "text",     label: "Other Names",     required: false },
                  { id: "fatherOccupation",     type: "text",     label: "Occupation",      required: false },
                  { id: "fatherContactAddress", type: "textarea", label: "Contact Address", required: false },
                  { id: "fatherHomeAddress",    type: "textarea", label: "Home Address",    required: false },
                  { id: "fatherHomePhone",      type: "tel",      label: "Phone No",        required: false },
                  { id: "fatherEmail",          type: "email",    label: "E-mail Address",  required: false },
                  { id: "fatherOfficePhone",    type: "tel",      label: "Office Phone No", required: false },
                ],
              },
              {
                id: "mother_details",
                label: "(b) Mother",
                fields: [
                  { id: "motherSurname",        type: "text",     label: "Surname",         required: false },
                  { id: "motherOtherNames",     type: "text",     label: "Other Names",     required: false },
                  { id: "motherOccupation",     type: "text",     label: "Occupation",      required: false },
                  { id: "motherContactAddress", type: "textarea", label: "Contact Address", required: false },
                  { id: "motherHomeAddress",    type: "textarea", label: "Home Address",    required: false },
                  { id: "motherHomePhone",      type: "tel",      label: "Phone No",        required: false },
                  { id: "motherEmail",          type: "email",    label: "E-mail Address",  required: false },
                  { id: "motherOfficePhone",    type: "tel",      label: "Office Phone No", required: false },
                ],
              },
              {
                id: "guardian_details",
                label: "(c) Guardian / Sponsor",
                fields: [
                  { id: "guardianSurname",        type: "text",     label: "Surname",         required: false },
                  { id: "guardianOtherNames",     type: "text",     label: "Other Names",     required: false },
                  { id: "guardianOccupation",     type: "text",     label: "Occupation",      required: false },
                  { id: "guardianContactAddress", type: "textarea", label: "Contact Address", required: false },
                  { id: "guardianHomeAddress",    type: "textarea", label: "Home Address",    required: false },
                  { id: "guardianPhone",          type: "tel",      label: "Phone No",        required: false },
                  { id: "guardianEmail",          type: "email",    label: "E-mail Address",  required: false },
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
          {
            id: "educational_details",
            title: "Educational Details",
            order: 4,
            fields: [
              { id: "primarySchoolName",       type: "text",     label: "Name of Primary School",                required: false },
              { id: "transferPrimarySchool",   type: "text",     label: "Name of Primary School (Transfer)",     required: false, conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
              { id: "transferSecondarySchool", type: "text",     label: "Name of Secondary School (Transfer)",   required: false, conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
              { id: "transferReason",          type: "textarea", label: "Reason for Transfer",                   required: false, helpText: "Enclose photocopies of previous results for record purposes", conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
            ],
          },
          {
            id: "health_details",
            title: "Health Details",
            order: 5,
            helpText: "Enclose photocopies of birth certificate and immunisation card or record",
            fields: [
              { id: "allergyFood",              type: "radio",    label: "Are you allergic to any food?",             required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
              { id: "allergyFoodDetails",       type: "text",     label: "If yes, state food",                        required: false, conditionalLogic: { fieldId: "allergyFood",       operator: "equals", value: "Yes" } },
              { id: "allergyDrugs",             type: "radio",    label: "Are you allergic to any tablets/drugs?",    required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
              { id: "allergyDrugsDetails",      type: "text",     label: "If yes, state drugs",                       required: false, conditionalLogic: { fieldId: "allergyDrugs",      operator: "equals", value: "Yes" } },
              { id: "allergyPlant",             type: "radio",    label: "Are you allergic to any plant?",            required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
              { id: "allergyPlantDetails",      type: "text",     label: "If yes, state plant",                       required: false, conditionalLogic: { fieldId: "allergyPlant",      operator: "equals", value: "Yes" } },
              { id: "physicalDisability",       type: "radio",    label: "Do you have any physical disability?",      required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
              { id: "physicalDisabilityDetails",type: "text",     label: "If yes, state",                             required: false, conditionalLogic: { fieldId: "physicalDisability", operator: "equals", value: "Yes" } },
              { id: "eyeCheckDone",             type: "radio",    label: "Have you checked your eyes in the past?",   required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
              { id: "eyeCheckWhere",            type: "text",     label: "If yes, where?",                            required: false, conditionalLogic: { fieldId: "eyeCheckDone",      operator: "equals", value: "Yes" } },
              { id: "eyeCheckDate",             type: "date",     label: "Eye check date",                            required: false, conditionalLogic: { fieldId: "eyeCheckDone",      operator: "equals", value: "Yes" } },
              { id: "dentalCheckDone",          type: "radio",    label: "Have you checked your dental status?",      required: false, options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] },
              { id: "dentalCheckWhere",         type: "text",     label: "If yes, where?",                            required: false, conditionalLogic: { fieldId: "dentalCheckDone",   operator: "equals", value: "Yes" } },
              { id: "dentalCheckDate",          type: "date",     label: "Dental check date",                         required: false, conditionalLogic: { fieldId: "dentalCheckDone",   operator: "equals", value: "Yes" } },
              { id: "otherHealthChallenges",    type: "textarea", label: "State any other ailment or health challenges", required: false },
            ],
          },
          {
            id: "hobbies",
            title: "Hobbies",
            order: 6,
            fields: [
              { id: "hobbies", type: "textarea", label: "Hobbies & Interests", required: false },
            ],
          },
          {
            id: "declaration",
            title: "Declaration",
            order: 7,
            fields: [
              {
                id: "declarationAccepted",
                type: "checkbox",
                label: "I/We declare that each piece of information supplied is accurate and subject to verification.",
                required: true,
              },
            ],
          },
          {
            id: "documents",
            title: "Required Documents",
            order: 8,
            helpText: "Maximum 5MB per file. Accepted formats: PDF, JPG, PNG",
            fields: [
              { id: "doc_passport_photo", type: "file", label: "Passport Photograph",        required: true,  accept: ["JPG", "PNG"],        helpText: "Recent passport-sized photograph" },
              { id: "doc_birth_cert",     type: "file", label: "Birth Certificate",          required: true,  accept: ["PDF", "JPG", "PNG"], helpText: "Official birth certificate or declaration of age" },
              { id: "doc_immunisation",   type: "file", label: "Immunisation Card / Record", required: false, accept: ["PDF", "JPG", "PNG"] },
              { id: "doc_report_card",    type: "file", label: "Last School Report Card",    required: false, accept: ["PDF", "JPG", "PNG"], helpText: "Required for transfer students" },
              { id: "doc_transfer_cert",  type: "file", label: "Transfer Certificate",       required: false, accept: ["PDF", "JPG", "PNG"], conditionalLogic: { fieldId: "studentType", operator: "equals", value: "TRANSFER" } },
            ],
          },
        ],
      },
    },
  });
  console.log("✅ Default form template created");

  console.log("\n🎉 Seed complete!");
  console.log("\nDemo credentials:");
  console.log("  Super Admin:  superadmin@greenfieldschools.edu.ng / SuperAdmin@1234");
  console.log("  Branch Admin: admin.vi@greenfieldschools.edu.ng   / Admin@1234");
  console.log("  Applicant:    parent@example.com                  / Applicant@1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
