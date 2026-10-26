import { describe, expect, it } from "vitest";

import { profileFormSchema, toFormValues } from "@/lib/persona-lab";
import { mergeResumeIntoValues, countResumeFills, describeScanError, type ResumeExtraction } from "@/lib/resume-scan";

const extraction: ResumeExtraction = {
  name: "Samarth Sharma",
  field_of_study: "Computer Science",
  occupation: "Backend Intern",
  location: "Bengaluru",
  bio: "Builder who loves shipping fast.",
  communication_style: null,
  skills: ["Python", "PostgreSQL", "python", "Python"],
  interests: ["AI", "startups"],
  personality_traits: null,
  goals: null,
  values: null,
  languages: ["English", "Hindi"],
  hobbies: null,
};

const valuesFrom = (overrides: Record<string, unknown>) => {
  const base = toFormValues(null) as Record<string, unknown>;
  base.name = "Test User"; // the form schema requires a name of 2+ chars
  return profileFormSchema.parse({ ...base, ...overrides });
};

describe("mergeResumeIntoValues", () => {
  it("fills empty text fields from the resume scan", () => {
    const values = valuesFrom({});
    const merged = mergeResumeIntoValues(values, extraction);
    expect(merged.fieldOfStudy).toBe("Computer Science");
    expect(merged.occupation).toBe("Backend Intern");
    expect(merged.location).toBe("Bengaluru");
    expect(merged.bio).toBe("Builder who loves shipping fast.");
  });

  it("never overwrites text the user already typed", () => {
    const values = valuesFrom({ name: "My Own Name", occupation: "Founder" });
    const merged = mergeResumeIntoValues(values, extraction);
    expect(merged.name).toBe("My Own Name");
    expect(merged.occupation).toBe("Founder");
  });

  it("merges list fields without duplicates, even with different casing", () => {
    const values = valuesFrom({ skillsInput: "python, AI" });
    const merged = mergeResumeIntoValues(values, extraction);
    const skills = merged.skillsInput.split(", ");
    expect(skills.filter((skill) => skill.toLowerCase() === "python")).toHaveLength(1);
    expect(skills.some((skill) => skill.toLowerCase() === "postgresql")).toBe(true);
    expect(skills.some((skill) => skill.toLowerCase() === "ai")).toBe(true);
    expect(merged.languagesInput).toBe("English, Hindi");
    expect(merged.interestsInput).toContain("startups");
  });

  it("keeps list fields unchanged when the scan has nothing for them", () => {
    const values = valuesFrom({ hobbiesInput: "chess" });
    const merged = mergeResumeIntoValues(values, extraction);
    expect(merged.hobbiesInput).toBe("chess");
    expect(merged.personalityInput).toBe("");
  });

  it("reports how many empty persona fields the scan filled", () => {
    const empty = valuesFrom({});
    // fills 4 text fields (study, occupation, location, bio) + 3 lists (skills, interests, languages)
    expect(countResumeFills(empty, extraction)).toBe(7);

    const full = valuesFrom({
      fieldOfStudy: "Physics",
      occupation: "Founder",
      location: "Goa",
      bio: "My bio",
      skillsInput: "Python",
    });
    expect(countResumeFills(full, extraction)).toBeLessThan(7);
  });
});

describe("describeScanError", () => {
  it("tells the user to sign in again when the session expired", () => {
    expect(describeScanError(401, "")).toBe("Your session has expired. Please log out and sign in again.");
  });

  it("asks the user to retry later when the AI service is busy", () => {
    expect(describeScanError(429, "")).toBe("The AI service is busy right now. Please try again in a minute.");
  });

  it("shows the server's own reason when it is readable", () => {
    expect(describeScanError(400, "Upload a resume as a PDF (or a clear photo) under 6 MB."))
      .toBe("Upload a resume as a PDF (or a clear photo) under 6 MB.");
  });

  it("falls back to a generic message when nothing readable came back", () => {
    expect(describeScanError(502, "")).toBe("The resume scan failed. Please try again.");
    expect(describeScanError(undefined, "Edge Function returned a non-2xx status code"))
      .toBe("The resume scan failed. Please try again.");
  });
});
