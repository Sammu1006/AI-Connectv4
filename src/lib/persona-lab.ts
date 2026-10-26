import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type CompatibilityRow = Database["public"]["Tables"]["compatibility_scores"]["Row"];
export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["conversation_messages"]["Row"];
export type ParticipantRow = Database["public"]["Tables"]["conversation_participants"]["Row"];

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, "Add a name for the persona.").max(120),
  fieldOfStudy: z.string().trim().max(120, "Field of study is too long.").optional().default(""),
  skillsInput: z.string().trim().max(260, "Keep skills concise.").default(""),
  interestsInput: z.string().trim().max(260, "Keep interests concise.").default(""),
  personalityInput: z.string().trim().max(260, "Keep personality traits concise.").default(""),
  goalsInput: z.string().trim().max(260, "Keep goals concise.").default(""),
  discoverable: z.boolean(),
  age: z.string().trim().max(3, "Add your age in years.").default(""),
  pronouns: z.string().trim().max(40).default(""),
  location: z.string().trim().max(120).default(""),
  occupation: z.string().trim().max(120).default(""),
  communicationStyle: z.string().trim().max(160).default(""),
  bio: z.string().trim().max(600, "Keep your bio under 600 chars.").default(""),
  languagesInput: z.string().trim().max(260).default(""),
  hobbiesInput: z.string().trim().max(260).default(""),
  valuesInput: z.string().trim().max(260).default(""),
  favoriteMoviesInput: z.string().trim().max(260).default(""),
  favoriteMusicInput: z.string().trim().max(260).default(""),
  favoriteBooksInput: z.string().trim().max(260).default(""),
  favoriteFoodInput: z.string().trim().max(260).default(""),
  quirksInput: z.string().trim().max(260).default(""),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const normalizeList = (value: string) => {
  const unique = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 40)),
    ),
  );

  return unique.slice(0, 8);
};

export const toFormValues = (profile: ProfileRow | null | undefined): ProfileFormValues => ({
  name: profile?.name ?? "",
  fieldOfStudy: profile?.field_of_study ?? "",
  skillsInput: profile?.skills.join(", ") ?? "",
  interestsInput: profile?.interests.join(", ") ?? "",
  personalityInput: profile?.personality_traits.join(", ") ?? "",
  goalsInput: profile?.goals.join(", ") ?? "",
  discoverable: profile?.discoverable ?? true,
  age: (profile as any)?.age_range ?? "",
  pronouns: (profile as any)?.pronouns ?? "",
  location: (profile as any)?.location ?? "",
  occupation: (profile as any)?.occupation ?? "",
  communicationStyle: (profile as any)?.communication_style ?? "",
  bio: (profile as any)?.bio ?? "",
  languagesInput: ((profile as any)?.languages ?? []).join(", "),
  hobbiesInput: ((profile as any)?.hobbies ?? []).join(", "),
  valuesInput: ((profile as any)?.values ?? []).join(", "),
  favoriteMoviesInput: ((profile as any)?.favorite_movies ?? []).join(", "),
  favoriteMusicInput: ((profile as any)?.favorite_music ?? []).join(", "),
  favoriteBooksInput: ((profile as any)?.favorite_books ?? []).join(", "),
  favoriteFoodInput: ((profile as any)?.favorite_food ?? []).join(", "),
  quirksInput: ((profile as any)?.quirks ?? []).join(", "),
});

export const buildProfilePayload = (values: ProfileFormValues) => ({
  name: values.name.trim(),
  field_of_study: values.fieldOfStudy.trim() || null,
  skills: normalizeList(values.skillsInput),
  interests: normalizeList(values.interestsInput),
  personality_traits: normalizeList(values.personalityInput),
  goals: normalizeList(values.goalsInput),
  discoverable: values.discoverable,
  age_range: values.age.trim() || null,
  pronouns: values.pronouns.trim() || null,
  location: values.location.trim() || null,
  occupation: values.occupation.trim() || null,
  communication_style: values.communicationStyle.trim() || null,
  bio: values.bio.trim() || null,
  languages: normalizeList(values.languagesInput),
  hobbies: normalizeList(values.hobbiesInput),
  values: normalizeList(values.valuesInput),
  favorite_movies: normalizeList(values.favoriteMoviesInput),
  favorite_music: normalizeList(values.favoriteMusicInput),
  favorite_books: normalizeList(values.favoriteBooksInput),
  favorite_food: normalizeList(values.favoriteFoodInput),
  quirks: normalizeList(values.quirksInput),
});

export const getProfileStrength = (profile: ProfileRow | null | undefined) => {
  if (!profile) return 0;

  const checks = [
    profile.name,
    profile.field_of_study,
    profile.skills.length,
    profile.interests.length,
    profile.personality_traits.length,
    profile.goals.length,
    profile.persona_summary,
    (profile as any).bio,
    (profile as any).occupation,
    (profile as any).location,
    ((profile as any).hobbies ?? []).length,
    ((profile as any).favorite_movies ?? []).length
      || ((profile as any).favorite_music ?? []).length
      || ((profile as any).favorite_books ?? []).length,
    ((profile as any).values ?? []).length,
  ];

  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
};

export const getInitials = (value: string | null | undefined) => {
  if (!value) return "AI";

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Just now";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export const getModeLabel = (mode: ConversationRow["mode"]) =>
  mode === "debate" ? "Debate" : mode === "bot_meeting" ? "Bot Meeting" : "AI Chat";

export const getStatusLabel = (status: ConversationRow["status"]) => {
  if (status === "active") return "Live";
  if (status === "completed") return "Finished";
  if (status === "stopped") return "Stopped";
  if (status === "failed") return "Failed";
  return "Draft";
};

export const getDisplayTags = (profile: ProfileRow | null | undefined) => [
  ...(profile?.skills ?? []),
  ...(profile?.interests ?? []),
  ...(profile?.goals ?? []),
].slice(0, 5);
