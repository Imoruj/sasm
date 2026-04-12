export * from "./nigeria";
export * from "./classLevels";
export * from "./grading";
export * from "./statuses";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
export const ACCEPTED_FILE_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".docx"];

export const NIGERIAN_PHONE_REGEX = /^(\+234|0)(70|80|81|90|91)\d{8}$/;
export const ACADEMIC_YEAR_REGEX = /^\d{4}\/\d{4}$/;

export const DEBOUNCE_DELAY = 2000; // 2 seconds for auto-save
export const PAGINATION_LIMIT = 20;
