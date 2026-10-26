import type { ProfileFormValues } from "@/lib/persona-lab";
import { normalizeList } from "@/lib/persona-lab";

export type ResumeExtraction = {
  name: string | null;
  field_of_study: string | null;
  occupation: string | null;
  location: string | null;
  bio: string | null;
  communication_style: string | null;
  skills: string[] | null;
  interests: string[] | null;
  personality_traits: string[] | null;
  goals: string[] | null;
  values: string[] | null;
  languages: string[] | null;
  hobbies: string[] | null;
};

const MAX_FIELD_LENGTH = 160;

/**
 * Turns a failed resume scan into a message a non-technical user can act on.
 * `detail` is the server-provided error text, when we managed to read it.
 */
export const describeScanError = (status: number | undefined, detail: string): string => {
  if (status === 401) return "Your session has expired. Please log out and sign in again.";
  if (status === 429) return "The AI service is busy right now. Please try again in a minute.";
  const clean = detail.trim();
  if (clean && clean !== "Edge Function returned a non-2xx status code") return clean;
  return "The resume scan failed. Please try again.";
};

const cleanText = (value: string | null | undefined) => {
  if (!value) return "";
  return value.trim().slice(0, MAX_FIELD_LENGTH);
};

const mergeList = (currentInput: string, incoming: string[] | null) => {
  if (!incoming?.length) return currentInput;
  const combined = normalizeList(`${currentInput ? `${currentInput}, ` : ""}${incoming.join(", ")}`);
  // Dedupe case-insensitively, keeping the user's original spelling first.
  const seen = new Set<string>();
  const merged = combined.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return merged.join(", ");
};


/**
 * Fills the persona form from a scanned resume. Text fields the user already
 * filled stay untouched; list fields merge incoming entries without duplicates.
 */
export const mergeResumeIntoValues = (
  values: ProfileFormValues,
  extraction: ResumeExtraction,
): ProfileFormValues => {
  const text = (current: string, incoming: string | null | undefined) => {
    const existing = cleanText(current);
    if (existing) return existing;
    return cleanText(incoming);
  };

  return {
    ...values,
    name: text(values.name, extraction.name),
    fieldOfStudy: text(values.fieldOfStudy, extraction.field_of_study),
    occupation: text(values.occupation, extraction.occupation),
    location: text(values.location, extraction.location),
    communicationStyle: text(values.communicationStyle, extraction.communication_style),
    bio: text(values.bio, extraction.bio),
    skillsInput: mergeList(values.skillsInput, extraction.skills),
    interestsInput: mergeList(values.interestsInput, extraction.interests),
    personalityInput: mergeList(values.personalityInput, extraction.personality_traits),
    goalsInput: mergeList(values.goalsInput, extraction.goals),
    valuesInput: mergeList(values.valuesInput, extraction.values),
    languagesInput: mergeList(values.languagesInput, extraction.languages),
    hobbiesInput: mergeList(values.hobbiesInput, extraction.hobbies),
  };
};

export const countResumeFills = (
  values: ProfileFormValues,
  extraction: ResumeExtraction,
) => {
  const merged = mergeResumeIntoValues(values, extraction);
  const before = values;
  const textKeys: Array<keyof ProfileFormValues> = [
    "name",
    "fieldOfStudy",
    "occupation",
    "location",
    "communicationStyle",
    "bio",
  ];
  const listKeys: Array<keyof ProfileFormValues> = [
    "skillsInput",
    "interestsInput",
    "personalityInput",
    "goalsInput",
    "valuesInput",
    "languagesInput",
    "hobbiesInput",
  ];

  let added = 0;
  for (const key of textKeys) {
    if (!String(before[key]).trim() && String(merged[key]).trim()) added += 1;
  }
  for (const key of listKeys) {
    const beforeItems = normalizeList(String(before[key])).length;
    const afterItems = normalizeList(String(merged[key])).length;
    if (afterItems > beforeItems) added += 1;
  }
  return added;
};
