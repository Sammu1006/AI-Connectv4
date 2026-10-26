import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const pepper = Deno.env.get("SECURITY_QUESTION_PEPPER") ?? "";
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const encoder = new TextEncoder();
const allowedQuestions = new Set(["first_pet", "childhood_friend", "favorite_teacher", "born_city"]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const normalizeAnswer = (value: unknown) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") : "";
const validPassword = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hashAnswer = async (answer: string, salt: Uint8Array) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pepper), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, key, 256);
  return toHex(new Uint8Array(bits));
};

const constantTimeEqual = (left: string, right: string) => {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !pepper) return json({ error: "Recovery service is not configured." }, 500);

  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";
    const email = normalizeEmail(body.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);

    if (action === "get_question") {
      const { data, error } = await admin.from("user_security_questions").select("question_key").eq("email_key", email).maybeSingle();
      if (error) return json({ error: "Could not check recovery details." }, 500);
      return json({ questionKey: data?.question_key ?? null });
    }

    if (action === "save_question") {
      const authorization = request.headers.get("Authorization") ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!token) return json({ error: "Sign in to save a recovery question." }, 401);
      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !authData.user || normalizeEmail(authData.user.email) !== email) return json({ error: "Could not verify this account." }, 401);
      const questionKey = typeof body.questionKey === "string" ? body.questionKey : "";
      const answer = normalizeAnswer(body.answer);
      if (!allowedQuestions.has(questionKey) || answer.length < 2 || answer.length > 150) return json({ error: "Choose a valid question and answer." }, 400);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const answerHash = await hashAnswer(answer, salt);
      const { error } = await admin.from("user_security_questions").upsert({
        user_id: authData.user.id,
        email_key: email,
        question_key: questionKey,
        answer_salt: toHex(salt),
        answer_hash: answerHash,
      }, { onConflict: "user_id" });
      if (error) return json({ error: "Could not save recovery details." }, 500);
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const answer = normalizeAnswer(body.answer);
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (answer.length < 2 || answer.length > 150 || !validPassword(newPassword)) return json({ error: "Check your answer and password requirements." }, 400);
      const { data: allowed, error: limitError } = await admin.rpc("record_security_question_attempt", { _email_key: email });
      if (limitError) return json({ error: "Could not verify recovery details." }, 500);
      if (!allowed) return json({ error: "Too many attempts. Please try again in 15 minutes." }, 429);

      const { data: recovery, error: lookupError } = await admin
        .from("user_security_questions")
        .select("user_id, answer_salt, answer_hash")
        .eq("email_key", email)
        .maybeSingle();
      if (lookupError || !recovery) return json({ error: "The email or security answer is incorrect." }, 400);

      const salt = Uint8Array.from(recovery.answer_salt.match(/.{1,2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
      const candidateHash = await hashAnswer(answer, salt);
      if (!constantTimeEqual(candidateHash, recovery.answer_hash)) return json({ error: "The email or security answer is incorrect." }, 400);

      const { error: passwordError } = await admin.auth.admin.updateUserById(recovery.user_id, { password: newPassword });
      if (passwordError) return json({ error: "Could not change the password. Please try again." }, 400);
      await admin.from("user_security_questions").update({ failed_attempts: 0, failure_window_started_at: null }).eq("email_key", email);
      return json({ ok: true });
    }

    return json({ error: "Unknown recovery action." }, 400);
  } catch {
    return json({ error: "Could not process the recovery request." }, 400);
  }
});