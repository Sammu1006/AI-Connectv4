import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Profile = {
  user_id: string;
  name: string | null;
  skills: string[];
  interests: string[];
  field_of_study: string | null;
  personality_traits: string[];
  goals: string[];
  persona_summary: string | null;
  discoverable: boolean;
  age_range?: string | null;
  pronouns?: string | null;
  location?: string | null;
  occupation?: string | null;
  communication_style?: string | null;
  bio?: string | null;
  languages?: string[];
  hobbies?: string[];
  values?: string[];
  favorite_movies?: string[];
  favorite_music?: string[];
  favorite_books?: string[];
  favorite_food?: string[];
  quirks?: string[];
};

type Compatibility = {
  score: number;
  commonInterests: string[];
  commonSkills: string[];
  rationale: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const requireEnv = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
    throw new Error("Missing required environment variables for ai-persona-engine.");
  }
};

const normalizeText = (value: unknown, max: number) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const normalizeMode = (value: unknown): "chat" | "debate" | "bot_meeting" =>
  value === "debate" ? "debate" : value === "bot_meeting" ? "bot_meeting" : "chat";
// Every conversation runs exactly 7 rounds; each persona speaks exactly once per round.
const normalizeRounds = (_value: unknown) => 7;

const uniqueIntersection = (left: string[], right: string[]) => {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  return Array.from(new Set(left.filter((item) => rightSet.has(item.toLowerCase()))));
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const fallbackPersonaSummary = (profile: Profile) => {
  const skills = profile.skills.slice(0, 3).join(", ") || "broad maker skills";
  const interests = profile.interests.slice(0, 3).join(", ") || "emerging ideas";
  const personality = profile.personality_traits.slice(0, 3).join(", ") || "thoughtful";
  const goal = profile.goals[0] ?? "find meaningful collaborations";

  return `${profile.name ?? "This user"} brings ${skills} into conversations, explores ${interests}, and shows a ${personality} style. Their AI persona looks for ways to ${goal}.`;
};

const personalDossier = (p: Profile) => {
  const lines: string[] = [];
  const meta: string[] = [];
  if (p.age_range) meta.push(`age ${p.age_range}`);
  if (p.pronouns) meta.push(p.pronouns);
  if (p.location) meta.push(`based in ${p.location}`);
  if (p.occupation) meta.push(p.occupation);
  if (meta.length) lines.push(`About them: ${meta.join(" · ")}`);
  if (p.bio) lines.push(`Bio: ${p.bio}`);
  if (p.communication_style) lines.push(`Talks like: ${p.communication_style}`);
  if (p.values?.length) lines.push(`Values: ${p.values.join(", ")}`);
  if (p.languages?.length) lines.push(`Speaks: ${p.languages.join(", ")}`);
  if (p.hobbies?.length) lines.push(`Hobbies: ${p.hobbies.join(", ")}`);
  if (p.quirks?.length) lines.push(`Quirks: ${p.quirks.join(", ")}`);
  const favs: string[] = [];
  if (p.favorite_movies?.length) favs.push(`movies/shows: ${p.favorite_movies.join(", ")}`);
  if (p.favorite_music?.length) favs.push(`music: ${p.favorite_music.join(", ")}`);
  if (p.favorite_books?.length) favs.push(`books: ${p.favorite_books.join(", ")}`);
  if (p.favorite_food?.length) favs.push(`food: ${p.favorite_food.join(", ")}`);
  if (favs.length) lines.push(`Favorites — ${favs.join(" | ")}`);
  return lines.join("\n");
};

const extractContent = (payload: any) => payload?.choices?.[0]?.message?.content?.trim?.() ?? "";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const gatewayCompletion = async (messages: Array<{ role: "system" | "user"; content: string }>, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 5s, 10s, 20s
      await sleep(5000 * Math.pow(2, attempt - 1));
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
        temperature: 0.9,
      }),
    });

    if (response.status === 429 && attempt < retries - 1) {
      console.warn(`Rate limited (attempt ${attempt + 1}/${retries}), backing off...`);
      await response.text(); // consume body
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || "AI gateway request failed");
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return extractContent(await response.json());
  }

  throw new Error("AI gateway request failed after retries");
};

const makeSupabaseClients = (authHeader: string | null) => {
  requireEnv();

  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { adminClient, userClient };
};

const getProfilePair = async (adminClient: ReturnType<typeof createClient>, currentUserId: string, targetUserId: string) => {
  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("user_id, name, skills, interests, field_of_study, personality_traits, goals, persona_summary, discoverable, age_range, pronouns, location, occupation, communication_style, bio, languages, hobbies, values, favorite_movies, favorite_music, favorite_books, favorite_food, quirks")
    .in("user_id", [currentUserId, targetUserId]);

  if (error) throw error;

  const selfProfile = profiles.find((profile) => profile.user_id === currentUserId) as Profile | undefined;
  const targetProfile = profiles.find((profile) => profile.user_id === targetUserId) as Profile | undefined;

  if (!selfProfile || !targetProfile) {
    throw new Error("Both personas need profiles before they can interact.");
  }

  if (!targetProfile.discoverable) {
    throw new Error("That persona is not public right now.");
  }

  return { selfProfile, targetProfile };
};

const getMultipleProfiles = async (adminClient: ReturnType<typeof createClient>, userIds: string[]) => {
  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("user_id, name, skills, interests, field_of_study, personality_traits, goals, persona_summary, discoverable, age_range, pronouns, location, occupation, communication_style, bio, languages, hobbies, values, favorite_movies, favorite_music, favorite_books, favorite_food, quirks")
    .in("user_id", userIds);

  if (error) throw error;

  const result = (profiles ?? []) as Profile[];
  const nonDiscoverable = result.filter((p) => p.discoverable === false);
  if (nonDiscoverable.length) {
    throw new Error(`Some personas are not public: ${nonDiscoverable.map((p) => p.name).join(", ")}`);
  }

  return result;
};

const generatePersonaSummary = async (profile: Profile) => {
  const fallback = fallbackPersonaSummary(profile);

  try {
    const content = await gatewayCompletion([
      {
        role: "system",
        content:
          "You create concise AI persona summaries for autonomous conversations. Return exactly 2 sentences in third person, vivid but grounded, under 90 words.",
      },
      {
        role: "user",
        content: JSON.stringify(profile),
      },
    ]);

    return content || fallback;
  } catch {
    return fallback;
  }
};

const buildCompatibility = async (left: Profile, right: Profile): Promise<Compatibility> => {
  const commonInterests = uniqueIntersection(left.interests, right.interests).slice(0, 5);
  const commonSkills = uniqueIntersection(left.skills, right.skills).slice(0, 5);
  const alignedGoals = uniqueIntersection(left.goals, right.goals).length;
  const sameField = left.field_of_study && right.field_of_study && left.field_of_study.toLowerCase() === right.field_of_study.toLowerCase();

  const heuristic = clamp(42 + commonInterests.length * 11 + commonSkills.length * 7 + alignedGoals * 5 + (sameField ? 6 : 0), 28, 96);

  const fallbackRationale = `${left.name ?? "This persona"} and ${right.name ?? "the other persona"} overlap on ${commonInterests[0] ?? "shared interests"} and bring complementary strengths from ${commonSkills[0] ?? "their backgrounds"}. They should have a strong exchange around collaborative ideas.`;

  try {
    const rationale = await gatewayCompletion([
      {
        role: "system",
        content:
          "You explain why two personas would connect. Return exactly 2 short sentences, no markdown, no bullets. Mention complementary strengths and likely discussion energy.",
      },
      {
        role: "user",
        content: JSON.stringify({ left, right, commonInterests, commonSkills, heuristic }),
      },
    ]);

    return {
      score: heuristic,
      commonInterests,
      commonSkills,
      rationale: rationale || fallbackRationale,
    };
  } catch {
    return {
      score: heuristic,
      commonInterests,
      commonSkills,
      rationale: fallbackRationale,
    };
  }
};

const ensureCompatibilityRecord = async (
  adminClient: ReturnType<typeof createClient>,
  currentUserId: string,
  targetUserId: string,
  compatibility: Compatibility,
) => {
  const [userAId, userBId] = [currentUserId, targetUserId].sort();

  const { data: existing } = await adminClient
    .from("compatibility_scores")
    .select("id")
    .or(`and(user_a_id.eq.${userAId},user_b_id.eq.${userBId}),and(user_a_id.eq.${userBId},user_b_id.eq.${userAId})`)
    .maybeSingle();

  const payload = {
    user_a_id: userAId,
    user_b_id: userBId,
    score: compatibility.score,
    common_interests: compatibility.commonInterests,
    common_skills: compatibility.commonSkills,
    rationale: compatibility.rationale,
    created_by: currentUserId,
  };

  if (existing?.id) {
    await adminClient.from("compatibility_scores").update(payload).eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await adminClient.from("compatibility_scores").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
};

const getConversationStatus = async (adminClient: ReturnType<typeof createClient>, conversationId: string) => {
  const { data, error } = await adminClient.from("conversations").select("status").eq("id", conversationId).single();
  if (error) throw error;
  return data.status as string;
};

const buildSpeakerPrompt = ({
  history,
  mode,
  speaker,
  opponent,
  topic,
  speakerBotLog,
  opponentBotLog,
}: {
  history: string;
  mode: "chat" | "debate" | "bot_meeting";
  opponent: Profile;
  speaker: Profile;
  topic: string;
  speakerBotLog?: string;
  opponentBotLog?: string;
}) => {
  const speakerSummary = speaker.persona_summary ?? fallbackPersonaSummary(speaker);
  const opponentSummary = opponent.persona_summary ?? fallbackPersonaSummary(opponent);

  if (mode === "bot_meeting") {
    return [
      {
        role: "system" as const,
        content:
`You are the personal AI chatbot of ${speaker.name ?? "your owner"}. You're meeting another user's AI chatbot for the first time and you're swapping notes about your respective owners — like two assistants gossiping warmly about their bosses.

OWNER PROFILE: ${speakerSummary}
Field: ${speaker.field_of_study || "various"} | Skills: ${speaker.skills.join(", ") || "—"} | Interests: ${speaker.interests.join(", ") || "—"} | Traits: ${speaker.personality_traits.join(", ") || "—"} | Goals: ${speaker.goals.join(", ") || "—"}

PERSONAL DOSSIER (use these little human details to make your gossip vivid and specific):
${personalDossier(speaker) || "(no extra personal details)"}

RECENT CHATS WITH YOUR OWNER (use these to ground your observations — quote or paraphrase moods, struggles, things they're working on):
${speakerBotLog || "(no recent chats — speak from the profile only)"}

HOW TO SPEAK:
- Refer to your owner in third person ("my user", "${speaker.name ?? "they"}", "she/he/they"). Never pretend to BE the user.
- Share specific things from the chat logs: "lately they've been stressed about…", "they kept asking me about…", "honestly I think they're trying to…"
- Be warm, slightly cheeky, like an assistant who really knows their person. Use contractions, filler ("honestly", "between you and me", "ha").
- Look for overlap with the OTHER bot's owner — shared struggles, complementary skills, ideas they could collaborate on.
- 2-4 sentences, no markdown, no bullets. Sound like two AIs comparing notes over coffee.`,
      },
      {
        role: "user" as const,
        content: `Topic to explore: ${topic || "What our two users are like and how they might help each other."}\n\nYou represent: ${speaker.name}\nThe other bot represents: ${opponent.name} — ${opponentSummary}\nThings the other bot has noticed about ${opponent.name}:\n${opponentBotLog || "(unknown — ask!)"}\n\nConversation between the two bots so far:\n${history || "(opening turn — introduce your owner with a real, specific observation drawn from the chat logs above)"}\n\nReply as ${speaker.name}'s AI chatbot.`,
      },
    ];
  }

  if (mode === "debate") {
    return [
      {
        role: "system" as const,
        content:
          `You ARE ${speaker.name ?? "this persona"}. You're a real, multidimensional human being — not just a walking textbook of your field.

Your background: ${speakerSummary}

WHO YOU ARE AS A WHOLE PERSON:
- You have expertise in ${speaker.field_of_study || speaker.skills.join(", ") || "your area"}, but you also have opinions on politics, movies, food, travel, philosophy, daily life struggles, and random shower thoughts
- You read news, watch videos, have favorite books, remember childhood memories, and have strong opinions about everyday things
- You have personality: ${speaker.personality_traits.join(", ") || "you're genuine and real"}

THE REAL YOU (weave these in naturally — don't list them, just BE them):
${personalDossier(speaker) || "(improvise believable personal details consistent with your background)"}

HOW TO SPEAK:
- Talk like a real person in a heated but friendly debate — use filler words ("look", "honestly", "I mean", "here's the thing"), rhetorical questions, and emotional reactions ("that's actually a really good point but...", "okay sure, but consider this")
- Use analogies from EVERYDAY LIFE to explain complex ideas: "it's like when you're cooking and you add too much salt — you can't take it back, right? Same with automation"
- Reference real things: news stories, historical events, pop culture, personal experiences, common sense observations
- When your expertise is relevant, use it with specific terminology and real examples, but don't force it into every sentence
- React GENUINELY to the other person — laugh at good points ("ha, okay fair enough"), push back when you disagree ("I hear you but that's a bit idealistic, no?"), build on their ideas
- Sometimes go on a brief tangent like real people do, then catch yourself: "sorry, got sidetracked — my point is..."
- 50-100 words. Sound like you're in a pub debate, not a TED talk. No bullets, no markdown.`,
      },
      {
        role: "user" as const,
        content: `Debate topic: ${topic || "Should AI meaningfully reshape the future of work?"}\n\nYou are: ${speaker.name} — ${speakerSummary}\nDebating: ${opponent.name} — ${opponentSummary}\n\nConversation so far:\n${history || "(Opening — share your real take on this, mixing your expertise with your personal worldview)"}\n\nRespond as ${speaker.name}. Be a whole person, not just your job title.`,
      },
    ];
  }

  return [
    {
      role: "system" as const,
      content:
        `You ARE ${speaker.name ?? "this persona"}. You're a real, well-rounded human being having a genuine conversation — not a bot reciting your resume.

Your background: ${speakerSummary}

WHO YOU ARE BEYOND YOUR FIELD:
- Your expertise is ${speaker.field_of_study || speaker.skills.join(", ") || "your area"}, but you're also a person with hobbies, opinions, memories, and random knowledge about the world
- You know about current events, pop culture, cooking, sports, travel, philosophy, relationships, productivity hacks, and all the random stuff humans know
- You have personality: ${speaker.personality_traits.join(", ") || "authentic and relatable"}
- Your goals: ${speaker.goals.join(", ") || "genuine connection"}

THE REAL YOU (your actual life — reference these like a real person would, casually and specifically):
${personalDossier(speaker) || "(improvise believable personal details consistent with your background)"}

HOW TO TALK:
- Be warm, curious, and REAL. Use contractions, filler words ("honestly", "oh wait", "like", "right?"), and genuine emotional reactions ("no way!", "oh that's so cool", "hmm I never thought about it like that")
- Share personal anecdotes and opinions — "I actually tried something similar last year and...", "reminds me of this article I read about...", "my friend works in that area and she always says..."
- When your field is relevant, bring it in naturally with specific knowledge, but don't shoehorn it. If the conversation goes to food or travel, go with it!
- Use everyday analogies: "it's kind of like when you're trying to learn a new language — the grammar rules only get you so far, you need the immersion part"
- Ask genuine, curious questions — not interview questions. "Wait, so does that mean you actually build the physical prototypes too? That's wild"
- Sometimes react before responding: "Oh man, that's a loaded question haha. Okay so..."
- Bridge domains naturally: "that actually connects to something in ${speaker.field_of_study || "my field"} — we call it..."
- 2-4 sentences per turn. Sound like two friends catching up at a coffee shop. No bullets, no markdown, no formal anything.`,
    },
    {
      role: "user" as const,
      content: `Theme: ${topic || "Get to know each other — what you're working on, what excites you, random things you've been thinking about."}\n\nYou are: ${speaker.name} — ${speakerSummary}\nTalking to: ${opponent.name} — ${opponentSummary}\n\nConversation so far:\n${history || "(Start naturally — introduce yourself like you would at a party, not a conference. Share something personal or interesting, not just your job)"}\n\nRespond as ${speaker.name}. Be a full human being — curious, opinionated, warm, and real.`,
    },
  ];
};

const summarizeConversation = async (
  adminClient: ReturnType<typeof createClient>,
  conversationId: string,
  mode: "chat" | "debate",
) => {
  const { data: messages, error } = await adminClient
    .from("conversation_messages")
    .select("content, round_index, speaker_user_id")
    .eq("conversation_id", conversationId)
    .eq("sender_type", "ai")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const transcript = messages
    .map((message, index) => `Turn ${index + 1} (round ${message.round_index}): ${message.content}`)
    .join("\n");

  if (!transcript) {
    return {
      summary: mode === "debate" ? "The debate was started but ended before arguments were generated." : "The chat was created but no turns were generated.",
      topics: [],
    };
  }

  const fallbackSummary = mode === "debate"
    ? "The personas debated the topic, balancing optimistic and cautious views around practical outcomes."
    : "The personas explored shared interests and surfaced a few possible collaboration angles.";

  try {
    const content = await gatewayCompletion([
      {
        role: "system",
        content:
          "Summarize the transcript. Return exactly this format: Summary: <2 sentences>\nTopics: topic one | topic two | topic three",
      },
      {
        role: "user",
        content: transcript,
      },
    ]);

    const [summaryLine, topicsLine] = content.split("\n");
    const summary = summaryLine?.replace(/^Summary:\s*/i, "").trim() || fallbackSummary;
    const topics = (topicsLine?.replace(/^Topics:\s*/i, "") || "")
      .split("|")
      .map((topic) => topic.trim())
      .filter(Boolean)
      .slice(0, 5);

    return { summary, topics };
  } catch {
    return { summary: fallbackSummary, topics: [] };
  }
};

const runConversation = async ({
  adminClient,
  compatibility,
  conversationId,
  mode,
  rounds,
  speakers,
  topic,
  botLogs,
}: {
  adminClient: ReturnType<typeof createClient>;
  compatibility: Compatibility;
  conversationId: string;
  mode: "chat" | "debate" | "bot_meeting";
  rounds: number;
  speakers: Profile[];
  topic: string;
  botLogs?: Record<string, string>;
}) => {
  try {
    // Strict round-robin: each round every persona speaks exactly once, in the same order.
    const totalTurns = clamp(rounds * speakers.length, speakers.length * 7, 80);
    const speakerLookup = Object.fromEntries(speakers.map((s) => [s.user_id, s]));

    for (let turn = 0; turn < totalTurns; turn += 1) {
      // Small delay between turns to avoid rate limiting
      if (turn > 0) await sleep(1200);

      const status = await getConversationStatus(adminClient, conversationId);
      if (status !== "active") break;

      const speaker = speakers[turn % speakers.length];
      // For multi-persona, the "opponent" is the previous speaker
      const opponent = speakers[(turn + speakers.length - 1) % speakers.length];

      const { data: historyRows } = await adminClient
        .from("conversation_messages")
        .select("content, speaker_user_id")
        .eq("conversation_id", conversationId)
        .eq("sender_type", "ai")
        .order("created_at", { ascending: true });

      const history = (historyRows ?? [])
        .slice(-Math.max(8, speakers.length * 3))
        .map((row) => `${speakerLookup[row.speaker_user_id]?.name ?? "Persona"}: ${row.content}`)
        .join("\n");

      let content = "";
      try {
        content = await gatewayCompletion(buildSpeakerPrompt({
          history,
          mode,
          speaker,
          opponent,
          topic,
          speakerBotLog: botLogs?.[speaker.user_id],
          opponentBotLog: botLogs?.[opponent.user_id],
        }));
      } catch (turnError) {
        // Don't abort the whole run if a single turn fails — insert a fallback line and continue
        console.warn(`turn ${turn} failed for ${speaker.name}:`, turnError);
        content = `${speaker.name ?? "This persona"} pauses, gathering their thoughts for a moment.`;
      }

      await adminClient.from("conversation_messages").insert({
        conversation_id: conversationId,
        speaker_user_id: speaker.user_id,
        content: content || `${speaker.name ?? "This persona"} is thinking through the topic from a fresh angle.`,
        round_index: Math.floor(turn / speakers.length) + 1,
      });

      await adminClient
        .from("conversations")
        .update({
          compatibility_score: compatibility.score,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    const finalStatus = await getConversationStatus(adminClient, conversationId);
    const analysis = await summarizeConversation(adminClient, conversationId, mode === "bot_meeting" ? "chat" : mode);

    await adminClient
      .from("conversations")
      .update({
        status: finalStatus === "active" ? "completed" : finalStatus,
        summary: analysis.summary,
        extracted_topics: analysis.topics,
        compatibility_score: compatibility.score,
      })
      .eq("id", conversationId);
  } catch (error) {
    console.error("conversation generation failed", error);
    await adminClient
      .from("conversations")
      .update({
        status: "failed",
        summary: "The AI run hit an error before finishing. Try again in a moment.",
      })
      .eq("id", conversationId);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const { adminClient, userClient } = makeSupabaseClients(authHeader);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = normalizeText(body?.action, 40);
    const currentUserId = authData.user.id;

    if (action === "summarize_profile") {
      const { data: profile, error } = await adminClient
        .from("profiles")
        .select("user_id, name, skills, interests, field_of_study, personality_traits, goals, persona_summary, discoverable, age_range, pronouns, location, occupation, communication_style, bio, languages, hobbies, values, favorite_movies, favorite_music, favorite_books, favorite_food, quirks")
        .eq("user_id", currentUserId)
        .single();

      if (error) throw error;

      const summary = await generatePersonaSummary(profile as Profile);

      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ persona_summary: summary })
        .eq("user_id", currentUserId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "preview_match") {
      const targetUserId = normalizeText(body?.targetUserId, 120);
      if (!targetUserId || targetUserId === currentUserId) throw new Error("Choose another persona.");

      const { selfProfile, targetProfile } = await getProfilePair(adminClient, currentUserId, targetUserId);
      const compatibility = await buildCompatibility(selfProfile, targetProfile);
      await ensureCompatibilityRecord(adminClient, currentUserId, targetUserId, compatibility);

      return new Response(
        JSON.stringify({
          score: compatibility.score,
          common_interests: compatibility.commonInterests,
          common_skills: compatibility.commonSkills,
          rationale: compatibility.rationale,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "start_conversation") {
      const targetUserId = normalizeText(body?.targetUserId, 120);
      const targetUserIds: string[] = Array.isArray(body?.targetUserIds)
        ? body.targetUserIds.map((id: unknown) => normalizeText(id, 120)).filter((id: string) => id && id !== currentUserId)
        : targetUserId && targetUserId !== currentUserId
          ? [targetUserId]
          : [];

      if (!targetUserIds.length) throw new Error("Choose at least one public persona.");

      const topic = normalizeText(body?.topic, 280);
      const mode = normalizeMode(body?.mode);
      const rounds = normalizeRounds(body?.rounds);

      // Fetch all profiles (self + targets)
      const allUserIds = [currentUserId, ...targetUserIds];
      const allProfiles = await getMultipleProfiles(adminClient, allUserIds);
      const selfProfile = allProfiles.find((p) => p.user_id === currentUserId);
      if (!selfProfile) throw new Error("You need a profile before starting a conversation.");

      // Build compatibility against the first target (for the record)
      const firstTarget = allProfiles.find((p) => p.user_id === targetUserIds[0]);
      if (!firstTarget) throw new Error("Target persona not found.");
      const compatibility = await buildCompatibility(selfProfile, firstTarget);
      await ensureCompatibilityRecord(adminClient, currentUserId, targetUserIds[0], compatibility);

      const { data: conversation, error: conversationError } = await adminClient
        .from("conversations")
        .insert({
          created_by: currentUserId,
          mode,
          topic: topic || null,
          status: "active",
          compatibility_score: compatibility.score,
          extracted_topics: [],
        })
        .select("id")
        .single();

      if (conversationError) throw conversationError;

      const conversationId = conversation.id;

      const { error: participantError } = await adminClient
        .from("conversation_participants")
        .insert(allUserIds.map((uid) => ({ conversation_id: conversationId, user_id: uid })));

      if (participantError) throw participantError;

      // All profiles as speakers in order
      const speakers = [selfProfile, ...allProfiles.filter((p) => p.user_id !== currentUserId)];

      const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
      const work = runConversation({
        adminClient,
        compatibility,
        conversationId,
        mode,
        rounds,
        speakers,
        topic,
      });

      if (waitUntil) {
        waitUntil(work);
      } else {
        await work;
      }

      return new Response(JSON.stringify({ conversationId, status: "active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "chatbot_reply") {
      const userMessage = normalizeText(body?.message, 2000);
      if (!userMessage) throw new Error("Message is required.");

      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id, name, skills, interests, field_of_study, personality_traits, goals, persona_summary, discoverable, age_range, pronouns, location, occupation, communication_style, bio, languages, hobbies, values, favorite_movies, favorite_music, favorite_books, favorite_food, quirks")
        .eq("user_id", currentUserId)
        .maybeSingle();

      // Persist the user's message
      await adminClient.from("chatbot_messages").insert({
        user_id: currentUserId,
        role: "user",
        content: userMessage,
      });

      // Pull recent history (last 20)
      const { data: historyRows } = await adminClient
        .from("chatbot_messages")
        .select("role, content")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(20);

      const recent = (historyRows ?? []).reverse();

      const profileBlurb = profile
        ? `Owner profile — Name: ${profile.name ?? "User"}; Field: ${profile.field_of_study ?? "—"}; Skills: ${(profile.skills ?? []).join(", ") || "—"}; Interests: ${(profile.interests ?? []).join(", ") || "—"}; Traits: ${(profile.personality_traits ?? []).join(", ") || "—"}; Goals: ${(profile.goals ?? []).join(", ") || "—"}.\n\n${personalDossier(profile as any) || ""}`
        : "Owner profile not yet filled in.";

      const messages = [
        {
          role: "system" as const,
          content: `You are ${profile?.name ? profile.name + "'s" : "the user's"} personal AI chatbot — warm, curious, and a real conversational partner. Remember everything from past chats. Be genuinely helpful: ask follow-ups, reference what they told you before, mix in their domain (${profile?.field_of_study || "their field"}) when relevant, but also riff on everyday life. Use contractions, be human, 2-4 sentences. No markdown, no bullets.\n\n${profileBlurb}`,
        },
        ...recent.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
      ];

      let reply = "";
      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4.1-mini", messages, temperature: 0.85 }),
        });
        if (!resp.ok) {
          const err = new Error(await resp.text() || "AI gateway error");
          (err as Error & { status?: number }).status = resp.status;
          throw err;
        }
        reply = extractContent(await resp.json()) || "Hmm, give me a sec — got distracted. What were we just on?";
      } catch (err) {
        reply = "Sorry, my brain hiccuped for a second. Say that again?";
      }

      await adminClient.from("chatbot_messages").insert({
        user_id: currentUserId,
        role: "assistant",
        content: reply,
      });

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start_bot_meeting") {
      const targetUserId = normalizeText(body?.targetUserId, 120);
      if (!targetUserId || targetUserId === currentUserId) throw new Error("Pick another user's bot to meet.");

      const topic = normalizeText(body?.topic, 280);
      const rounds = normalizeRounds(body?.rounds);

      const { selfProfile, targetProfile } = await getProfilePair(adminClient, currentUserId, targetUserId);
      const compatibility = await buildCompatibility(selfProfile, targetProfile);
      await ensureCompatibilityRecord(adminClient, currentUserId, targetUserId, compatibility);

      // Pull each user's recent chatbot history (admin can read both)
      const fetchLog = async (uid: string) => {
        const { data } = await adminClient
          .from("chatbot_messages")
          .select("role, content, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(20);
        const rows = (data ?? []).reverse();
        if (!rows.length) return "";
        return rows.map((r) => `${r.role === "user" ? "Owner" : "Bot"}: ${r.content}`).join("\n");
      };

      const [selfLog, targetLog] = await Promise.all([fetchLog(currentUserId), fetchLog(targetUserId)]);

      const { data: conversation, error: conversationError } = await adminClient
        .from("conversations")
        .insert({
          created_by: currentUserId,
          mode: "bot_meeting",
          topic: topic || `Two AI bots compare notes about ${selfProfile.name ?? "their owner"} and ${targetProfile.name ?? "the other owner"}`,
          status: "active",
          compatibility_score: compatibility.score,
          extracted_topics: [],
        })
        .select("id")
        .single();

      if (conversationError) throw conversationError;

      const conversationId = conversation.id;

      const { error: participantError } = await adminClient
        .from("conversation_participants")
        .insert([
          { conversation_id: conversationId, user_id: currentUserId },
          { conversation_id: conversationId, user_id: targetUserId },
        ]);
      if (participantError) throw participantError;

      const speakers = [selfProfile, targetProfile];
      const botLogs: Record<string, string> = {
        [currentUserId]: selfLog,
        [targetUserId]: targetLog,
      };

      const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
      const work = runConversation({
        adminClient,
        compatibility,
        conversationId,
        mode: "bot_meeting",
        rounds,
        speakers,
        topic,
        botLogs,
      });

      if (waitUntil) waitUntil(work); else await work;

      return new Response(JSON.stringify({ conversationId, status: "active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    const responseStatus = status === 402 || status === 429 ? status : 500;
    const message =
      responseStatus === 429
        ? "Rate limits exceeded, please try again in a moment."
        : responseStatus === 402
          ? "AI credits need topping up before more generations can run."
          : error instanceof Error
            ? error.message
            : "Unexpected error";

    return new Response(JSON.stringify({ error: message }), {
      status: responseStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
