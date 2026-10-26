import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.24.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const MODEL_ID = "gpt-5-mini";
const MAX_BASE64_LENGTH = 9_000_000; // ~6.7 MB decoded file

const ResumeBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ]),
  base64: z.string().min(100).max(MAX_BASE64_LENGTH),
});

/**
 * The AI occasionally overruns the documented limits (e.g. 15 skills).
 * Instead of failing the whole scan, clamp values to what the form accepts.
 */
const clampString = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : value;

const sanitizeList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .slice(0, 12)
        .map((item) => (typeof item === "string" ? item.trim().slice(0, 40) : item))
    : value;

const scalar = (max: number) =>
  z.preprocess((value) => clampString(value, max), z.string().trim().max(max).nullable());

const listField = z.preprocess(sanitizeList, z.array(z.string()).max(12).nullable());

const ExtractionSchema = z.object({
  name: scalar(120),
  field_of_study: scalar(120),
  occupation: scalar(120),
  location: scalar(120),
  bio: scalar(600),
  communication_style: scalar(160),
  skills: listField,
  interests: listField,
  personality_traits: listField,
  goals: listField,
  values: listField,
  languages: listField,
  hobbies: listField,
});

const extractionJsonSchema = {
  name: "resume_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: ["string", "null"], description: "Full name of the person" },
      field_of_study: { type: ["string", "null"], description: "Primary field of study or major" },
      occupation: { type: ["string", "null"], description: "Current or most recent occupation/role" },
      location: { type: ["string", "null"], description: "City/region where the person is based" },
      bio: { type: ["string", "null"], description: "2-4 sentence friendly summary of who this person is, based on the resume" },
      communication_style: { type: ["string", "null"], description: "Likely communication style, e.g. 'formal and precise' — infer conservatively" },
      skills: { type: ["array", "null"], items: { type: "string" }, description: "Technical and professional skills" },
      interests: { type: ["array", "null"], items: { type: "string" }, description: "Professional or personal interests" },
      personality_traits: { type: ["array", "null"], items: { type: "string" }, description: "Personality traits implied by activities/roles — only if well supported" },
      goals: { type: ["array", "null"], items: { type: "string" }, description: "Career goals, stated or clearly implied" },
      values: { type: ["array", "null"], items: { type: "string" }, description: "Core values implied by volunteering, causes, leadership — only if well supported" },
      languages: { type: ["array", "null"], items: { type: "string" }, description: "Spoken languages from the resume" },
      hobbies: { type: ["array", "null"], items: { type: "string" }, description: "Hobbies and extracurricular activities" },
    },
    required: [
      "name",
      "field_of_study",
      "occupation",
      "location",
      "bio",
      "communication_style",
      "skills",
      "interests",
      "personality_traits",
      "goals",
      "values",
      "languages",
      "hobbies",
    ],
    additionalProperties: false,
  },
} as const;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeError = (status: number, body: string) => {
  let message = "The resume scan failed. Please try again.";
  try {
    const parsed = JSON.parse(body);
    message = parsed?.error?.message ?? parsed?.message ?? message;
  } catch {
    // keep default
  }
  return json({ error: message }, status);
};

const buildContentPart = (mimeType: string, filename: string, base64: string) => {
  if (mimeType === "application/pdf") {
    return { type: "input_file", filename, file_data: `data:application/pdf;base64,${base64}` };
  }
  const imageType = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  return { type: "input_image", image_url: `data:${imageType};base64,${base64}` };
};

const readSseFinalText = async (response: Response) => {
  const body = response.body;
  if (!body) throw new Error("Empty response stream from the AI gateway.");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const handleEvent = (raw: string) => {
    const dataLines = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) return;
    const payload = dataLines.join("");
    if (!payload || payload === "[DONE]") return;

    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      text += event.delta;
    } else if (event.type === "response.completed") {
      const parts = event.response?.output ?? [];
      for (const item of parts) {
        if (item?.type === "message") {
          for (const part of item.content ?? []) {
            if (part?.type === "output_text" && typeof part.text === "string" && part.text) {
              text = part.text;
            }
          }
        }
      }
    } else if (event.type === "error" || event.type === "response.failed") {
      const message = event.error?.message ?? event.response?.error?.message ?? "AI request failed.";
      throw new Error(message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      handleEvent(raw);
    }
  }

  return text.trim();
};

const scanResume = async (contentPart: Record<string, string>) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", ...extractionJsonSchema } },
      input: [
        {
          role: "system",
          content:
            "You extract structured persona information from resumes and CVs. Extract only facts present or clearly implied by the document; use null when a field is not supported. Keep list entries short (max 40 characters) and specific.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract this person's details from the attached resume for their personal profile.",
            },
            contentPart,
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(new Error(body || "AI gateway error"), { status: response.status, gateway: true });
  }

  const text = await readSseFinalText(response);
  if (!text) {
    throw Object.assign(new Error("The AI returned an empty result for this resume."), { status: 502, gateway: true });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Could not read the extracted resume details."), { status: 502, gateway: true });
  }

  return ExtractionSchema.parse(parsed);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
    return json({ error: "The resume scanner is not configured yet." }, 500);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: "Please sign in to scan a resume." }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const parsedBody = ResumeBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return json({ error: "Upload a resume as a PDF (or a clear photo) under 6 MB." }, 400);
  }

  try {
    const contentPart = buildContentPart(parsedBody.data.mimeType, parsedBody.data.filename, parsedBody.data.base64);
    const extraction = await scanResume(contentPart);
    return json({ extraction });
  } catch (error) {
    const status = (error as any)?.status;
    if (status) {
      return safeError(status, (error as Error).message);
    }
    const message = error instanceof Error ? error.message : "The resume scan failed. Please try again.";
    return json({ error: message }, 500);
  }
});
