import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Archive, Bot, LayoutDashboard, LogOut, Menu, Orbit, Rocket, Sparkles, UserCircle2, UsersRound, Workflow } from "lucide-react";
import { toast } from "sonner";

import { AuthScreen } from "@/components/persona-lab/AuthScreen";
import { ConversationConsole } from "@/components/persona-lab/ConversationConsole";
import { DiscoveryRail } from "@/components/persona-lab/DiscoveryRail";
import { ProfileStudio } from "@/components/persona-lab/ProfileStudio";
import { PersonalChatbot } from "@/components/persona-lab/PersonalChatbot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSession } from "@/hooks/use-auth-session";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, scaleIn, staggerContainer } from "@/lib/motion";
import { buildInviteLink, captureInviteFromUrl, clearPendingInvite, pairInvitedPersonas, readPendingInvite, type PendingInvite } from "@/lib/invite";
import {
  formatDateTime,
  getModeLabel,
  type CompatibilityRow,
  type ConversationRow,
  type MessageRow,
  type ParticipantRow,
  type ProfileRow,
} from "@/lib/persona-lab";

type Section = "dashboard" | "composition" | "directory" | "chatbot" | "launchpad" | "archive";

const navItems: Array<{ id: Section; label: string; icon: typeof LayoutDashboard; description: string }> = [
  { id: "composition", label: "Persona Composition", icon: UserCircle2, description: "Shape the voice behind your AI." },
  { id: "directory", label: "Directory & Matching", icon: UsersRound, description: "Discover other AI personas." },
  { id: "chatbot", label: "Talk to Your Bot", icon: Bot, description: "Chat privately with your personal AI." },
  { id: "launchpad", label: "Launchpad", icon: Rocket, description: "Pick personas and start a live run." },
  { id: "archive", label: "Live Theater & History", icon: Archive, description: "Watch live and revisit your persona's past runs." },
];

const Index = () => {
  const queryClient = useQueryClient();
  const { loading: authLoading, signIn, signOut, signUp, user } = useAuthSession();

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isPreviewingMatch, setIsPreviewingMatch] = useState(false);
  const [isLaunchingConversation, setIsLaunchingConversation] = useState(false);
  const [isStoppingConversation, setIsStoppingConversation] = useState(false);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [compatibilityPreview, setCompatibilityPreview] = useState<CompatibilityRow | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(() => readPendingInvite());
  const [isPairingInvite, setIsPairingInvite] = useState(false);
  const [invitePairingError, setInvitePairingError] = useState<string | null>(null);
  const [inviteRetry, setInviteRetry] = useState(0);
  const inviteAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    setPendingInvite(captureInviteFromUrl());
  }, []);

  // An invite link should land directly on account creation, not sign-in.
  useEffect(() => {
    if (!user && pendingInvite) setAuthMode("signup");
  }, [user, pendingInvite]);

  const profileQuery = useQuery({
    enabled: Boolean(user),
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const directoryQuery = useQuery({
    enabled: Boolean(user),
    queryKey: ["directory", user?.id],
    queryFn: async () => {
      if (!user) return [] as ProfileRow[];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("discoverable", true)
        .neq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const conversationsQuery = useQuery({
    enabled: Boolean(user),
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [] as ConversationRow[];
      const { data: mine, error: mineError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (mineError) throw mineError;
      const ids = Array.from(new Set((mine ?? []).map((row) => row.conversation_id)));
      if (!ids.length) return [] as ConversationRow[];

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .in("id", ids)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ConversationRow[];
    },
    refetchInterval: (query) =>
      Array.isArray(query.state.data) && query.state.data.some((conversation) => conversation.status === "active") ? 1600 : false,
  });

  useEffect(() => {
    if (selectedTargetIds.length === 0 && directoryQuery.data?.length) {
      setSelectedTargetIds([directoryQuery.data[0].user_id]);
    }
  }, [directoryQuery.data, selectedTargetIds]);

  useEffect(() => {
    if (!selectedConversationId && conversationsQuery.data?.length) {
      setSelectedConversationId(conversationsQuery.data[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  useEffect(() => {
    setCompatibilityPreview(null);
  }, [selectedTargetIds]);

  const activeConversation = useMemo(
    () => conversationsQuery.data?.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversationsQuery.data, selectedConversationId],
  );

  const participantsQuery = useQuery({
    enabled: Boolean(selectedConversationId),
    queryKey: ["conversation-participants", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [] as ParticipantRow[];
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("*")
        .eq("conversation_id", selectedConversationId)
        .order("joined_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ParticipantRow[];
    },
  });

  const participantUserIds = useMemo(
    () => Array.from(new Set((participantsQuery.data ?? []).map((participant) => participant.user_id))),
    [participantsQuery.data],
  );

  const participantProfilesQuery = useQuery({
    enabled: participantUserIds.length > 0,
    queryKey: ["participant-profiles", participantUserIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").in("user_id", participantUserIds);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const messagesQuery = useQuery({
    enabled: Boolean(selectedConversationId),
    queryKey: ["conversation-messages", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [] as MessageRow[];
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
    refetchInterval: activeConversation?.status === "active" ? 1200 : false,
  });

  const conversationIdsKey = (conversationsQuery.data ?? []).map((c) => c.id).join(",");
  const historyParticipantsQuery = useQuery({
    enabled: Boolean(conversationIdsKey),
    queryKey: ["history-participants", conversationIdsKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIdsKey.split(","));
      if (error) throw error;
      return data ?? [];
    },
  });

  const participantsByConversation = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of historyParticipantsQuery.data ?? []) {
      (map[row.conversation_id] ??= []).push(row.user_id);
    }
    return map;
  }, [historyParticipantsQuery.data]);

  useEffect(() => {
    if (!pendingInvite || !user || isAuthSubmitting) return;
    if (pendingInvite.inviterId === user.id) {
      clearPendingInvite();
      setPendingInvite(null);
      return;
    }
    // Wait for the signup profile and history before launching or resuming the invited pair.
    if (!profileQuery.data || !conversationsQuery.isSuccess ||
      (conversationIdsKey && !historyParticipantsQuery.isSuccess)) return;
    const attemptKey = `${user.id}:${pendingInvite.inviterId}:${inviteRetry}`;
    if (inviteAttemptRef.current === attemptKey) return;
    inviteAttemptRef.current = attemptKey;
    const currentUserId = user.id;
    setIsPairingInvite(true);
    setInvitePairingError(null);

    const pair = async () => {
      try {
        const conversationId = await pairInvitedPersonas({
          invite: pendingInvite,
          currentUserId,
          conversations: conversationsQuery.data ?? [],
          participantsByConversation,
          startConversation: async (payload) => {
            const { data, error } = await supabase.functions.invoke("ai-persona-engine", { body: payload });
            if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Could not pair your personas.");
            return typeof data?.conversationId === "string" ? data.conversationId : "";
          },
        });
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user.id !== currentUserId || !conversationId) return;
        clearPendingInvite();
        setPendingInvite(null);
        setSelectedTargetIds([pendingInvite.inviterId]);
        setSelectedConversationId(conversationId);
        setSection("archive");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["conversations", currentUserId] }),
          queryClient.invalidateQueries({ queryKey: ["conversation-messages"] }),
          queryClient.invalidateQueries({ queryKey: ["conversation-participants"] }),
          queryClient.invalidateQueries({ queryKey: ["directory", currentUserId] }),
        ]);
        toast.success("Your personas are paired. Your AI Match Challenge is ready.");
      } catch {
        setInvitePairingError("Your personas couldn't be paired yet. Your friend needs a public persona. You can retry without losing the invite.");
      } finally {
        setIsPairingInvite(false);
      }
    };
    void pair();
  }, [pendingInvite, user, isAuthSubmitting, profileQuery.data, conversationsQuery.isSuccess,
    conversationsQuery.data, conversationIdsKey, historyParticipantsQuery.isSuccess, participantsByConversation,
    inviteRetry, queryClient]);

  const historyUserIds = useMemo(
    () => Array.from(new Set([
      ...(historyParticipantsQuery.data ?? []).map((r) => r.user_id),
      ...(conversationsQuery.data ?? []).map((c) => c.created_by),
    ])),
    [historyParticipantsQuery.data, conversationsQuery.data],
  );

  const historyProfilesQuery = useQuery({
    enabled: historyUserIds.length > 0,
    queryKey: ["history-profiles", historyUserIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").in("user_id", historyUserIds);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const profileLookup = useMemo(() => {
    const entries = [...(historyProfilesQuery.data ?? []), profileQuery.data, ...(directoryQuery.data ?? []), ...(participantProfilesQuery.data ?? [])]
      .filter((profile): profile is ProfileRow => Boolean(profile))
      .map((profile) => [profile.user_id, profile] as const);

    return Object.fromEntries(entries) as Record<string, ProfileRow | undefined>;
  }, [directoryQuery.data, participantProfilesQuery.data, profileQuery.data, historyProfilesQuery.data]);

  const handleSignIn = async ({ email, password }: { email: string; password: string }) => {
    setIsAuthSubmitting(true);
    const { error } = await signIn(email, password);
    setIsAuthSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signed in.");
  };

  const handleSignUp = async ({ email, password, name, questionKey, answer }: { email: string; password: string; name: string; questionKey: string; answer: string }) => {
    setIsAuthSubmitting(true);
    const { data: available } = await supabase.rpc("is_name_available", { _name: name.trim() });
    if (available === false) { setIsAuthSubmitting(false); toast.error("This username is already taken. Please choose a different name."); return; }
    const { data, error } = await signUp(email, password, name.trim());
    if (error) { setIsAuthSubmitting(false); toast.error(error.message); return; }
    if (!data.session) {
      setIsAuthSubmitting(false);
      toast.error("Account created, but sign-in was not ready to save your recovery question. Please contact support before signing out.");
      return;
    }
    // Remixed projects may not have the original signup trigger installed.
    // Ensure the new persona exists before the pending invite can be paired.
    const { error: profileError } = await supabase.from("profiles").upsert(
      { user_id: data.session.user.id, name: name.trim() },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    await queryClient.invalidateQueries({ queryKey: ["profile", data.session.user.id] });
    if (profileError) toast.error("Your account is ready, but your persona couldn't be created. Save it from Persona Composition to finish pairing.");
    const { error: recoveryError } = await supabase.functions.invoke("security-question-recovery", {
      body: { action: "save_question", email, questionKey, answer },
    });
    setIsAuthSubmitting(false);
    if (recoveryError) { toast.error("Your account was created, but the recovery question could not be saved. Please contact support before signing out."); return; }
    toast.success("Account created with password recovery set up.");
  };

  const handleSaveProfile = async (payload: Omit<ProfileRow, "id" | "created_at" | "updated_at" | "persona_summary" | "avatar_url" | "user_id"> & { field_of_study: string | null }) => {
    if (!user) return;
    setIsSavingProfile(true);
    if (payload.name?.trim()) {
      const { data: available } = await supabase.rpc("is_name_available", { _name: payload.name.trim(), _exclude_user: user.id });
      if (available === false) { setIsSavingProfile(false); toast.error("This username is already taken. Please choose a different name."); return; }
    }
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" });
    setIsSavingProfile(false);
    if (error) { toast.error(error.code === "23505" ? "This username is already taken. Please choose a different name." : error.message); return; }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["directory", user.id] }),
    ]);
    toast.success("Profile saved.");
  };

  const handleGenerateSummary = async () => {
    if (!user) return;
    setIsSummarizing(true);
    const { data, error } = await supabase.functions.invoke("ai-persona-engine", { body: { action: "summarize_profile" } });
    setIsSummarizing(false);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["directory", user.id] });
    toast.success(data?.summary ? "Persona summary refreshed." : "Persona summary generated.");
  };

  const handlePreviewMatch = async (targetUserId: string) => {
    setIsPreviewingMatch(true);
    const { data, error } = await supabase.functions.invoke("ai-persona-engine", { body: { action: "preview_match", targetUserId } });
    setIsPreviewingMatch(false);
    if (error) { toast.error(error.message); return; }
    setCompatibilityPreview(data as CompatibilityRow);
    toast.success("Compatibility updated.");
  };

  const handleStartConversation = async (mode: "chat" | "debate", topic: string) => {
    if (!selectedTargetIds.length) { toast.error("Pick at least one persona."); return; }
    setIsLaunchingConversation(true);
    const { data, error } = await supabase.functions.invoke("ai-persona-engine", {
      body: { action: "start_conversation", targetUserIds: selectedTargetIds, mode, topic, rounds: 7 },
    });
    setIsLaunchingConversation(false);
    if (error) { toast.error(error.message); return; }
    const nextConversationId = data?.conversationId as string | undefined;
    if (nextConversationId) setSelectedConversationId(nextConversationId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-participants"] }),
    ]);
    toast.success(mode === "debate" ? "Debate launched." : "AI chat started.");
    setSection("archive");
  };

  const handleStartBotMeeting = async (targetUserId: string, topic: string) => {
    setIsLaunchingConversation(true);
    const { data, error } = await supabase.functions.invoke("ai-persona-engine", {
      body: { action: "start_bot_meeting", targetUserId, topic, rounds: 7 },
    });
    setIsLaunchingConversation(false);
    if (error) { toast.error(error.message); return; }
    const nextConversationId = data?.conversationId as string | undefined;
    if (nextConversationId) setSelectedConversationId(nextConversationId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-participants"] }),
    ]);
    toast.success("Bots are meeting up.");
    setSection("archive");
  };

  const handleStopConversation = async (conversationId: string) => {
    setIsStoppingConversation(true);
    const { error } = await supabase.from("conversations").update({ status: "stopped" }).eq("id", conversationId);
    setIsStoppingConversation(false);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    toast.success("Conversation stopped.");
  };

  if (authLoading) {
    return (
      <main key="auth-loading" className="page-shell flex items-center justify-center">
        <motion.div
          className="surface-panel flex min-h-52 w-full max-w-xl flex-col items-center justify-center gap-4 p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Orbit className="h-8 w-8 animate-spin text-primary" />
          <div>
            <h1 className="display-title text-3xl">Warming up the persona lab</h1>
            <p className="mt-2 text-sm text-muted-foreground">Connecting your session, profile graph, and AI engines.</p>
          </div>
        </motion.div>
      </main>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        invite={pendingInvite}
        isSubmitting={isAuthSubmitting}
        mode={authMode}
        onModeChange={setAuthMode}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    );
  }

  const conversations = conversationsQuery.data ?? [];
  const liveCount = conversations.filter((conversation) => conversation.status === "active").length;
  const latestRun = conversations[0];

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) { toast.error(error.message); return; }
    toast.success("Signed out.");
  };

  const renderSection = () => {
    if (section === "composition") {
      return (
        <ProfileStudio
          isSaving={isSavingProfile}
          isSummarizing={isSummarizing}
          onLogout={handleLogout}
          onSave={handleSaveProfile}
          onSummarize={handleGenerateSummary}
          profile={profileQuery.data}
        />
      );
    }
    if (section === "directory" || section === "launchpad") {
      return (
        <DiscoveryRail
          compatibilityPreview={compatibilityPreview}
          featuredUserId={pendingInvite?.inviterId}
          inviteLink={buildInviteLink(window.location.origin, user.id, profileQuery.data?.name)}
          isLaunching={isLaunchingConversation}
          isPreviewing={isPreviewingMatch}
          onPreviewMatch={handlePreviewMatch}
          onSelect={setSelectedTargetIds}
          onStartConversation={handleStartConversation}
          onStartBotMeeting={handleStartBotMeeting}
          profiles={directoryQuery.data ?? []}
          selectedUserIds={selectedTargetIds}
        />
      );
    }
    if (section === "chatbot") {
      return <PersonalChatbot userId={user.id} ownerName={profileQuery.data?.name} />;
    }
    if (section === "archive") {
      return (
        <ConversationConsole
          activeConversation={activeConversation}
          activeMessages={messagesQuery.data ?? []}
          activeParticipants={participantsQuery.data ?? []}
          conversations={conversations}
          participantsByConversation={participantsByConversation}
          currentUserId={user.id}
          isStopping={isStoppingConversation}
          onSelectConversation={setSelectedConversationId}
          onStopConversation={handleStopConversation}
          profileLookup={profileLookup}
        />
      );
    }
    // dashboard hub
    return (
      <motion.section className="hero-banner" initial="hidden" animate="visible" variants={staggerContainer}>
        <div className="relative flex flex-col gap-8">
          <motion.div className="max-w-3xl space-y-4" variants={staggerContainer}>
            <motion.span className="eyebrow-chip" variants={fadeUp} custom={0}>Persona orchestration platform</motion.span>
            <motion.h1 className="display-title text-4xl sm:text-5xl lg:text-6xl" variants={fadeUp} custom={1}>
              Welcome back{profileQuery.data?.name ? `, ${profileQuery.data.name}` : ""}.
            </motion.h1>
            <motion.p className="max-w-2xl text-base text-muted-foreground sm:text-lg" variants={fadeUp} custom={2}>
              Pick a section below to shape your persona, discover others, chat with your bot, launch conversations, or revisit archived runs.
            </motion.p>
          </motion.div>

          <motion.div className="grid gap-3 sm:grid-cols-3" variants={staggerContainer}>
            <motion.div className="stat-tile" variants={scaleIn} custom={0}>
              <p className="section-kicker">Live runs</p>
              <p className="display-title mt-3 text-4xl">{liveCount}</p>
              <p className="text-sm text-muted-foreground">Streaming AI exchanges</p>
            </motion.div>
            <motion.div className="stat-tile" variants={scaleIn} custom={1}>
              <p className="section-kicker">Latest activity</p>
              <p className="mt-3 text-lg font-semibold text-foreground">
                {latestRun ? getModeLabel(latestRun.mode) : "No runs yet"}
              </p>
              <p className="text-sm text-muted-foreground">{latestRun ? formatDateTime(latestRun.created_at) : "Start one from the Launchpad"}</p>
            </motion.div>
            <motion.div className="stat-tile" variants={scaleIn} custom={2}>
              <p className="section-kicker">Agent state</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="metric-chip"><Workflow className="h-3.5 w-3.5 text-primary" />Stored history</span>
                <span className="metric-chip"><Activity className="h-3.5 w-3.5 text-primary" />Match scoring</span>
                <span className="metric-chip"><Sparkles className="h-3.5 w-3.5 text-primary" />Summaries</span>
              </div>
            </motion.div>
          </motion.div>

          <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer}>
            {navItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className="feature-tile text-left transition-all hover:border-primary/60"
                  variants={scaleIn}
                  custom={i}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="feature-icon"><Icon className="h-5 w-5" /></span>
                  <p className="text-base font-semibold text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </motion.section>
    );
  };

  return (
    <main key="dashboard-shell" className="page-shell">
      <motion.div
        key={`dashboard-${user.id}`}
        className="mx-auto flex max-w-7xl flex-col gap-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Top nav */}
        <motion.nav
          className="surface-panel flex items-center justify-between gap-3 p-3"
          variants={fadeUp}
          custom={0}
        >
          <p className="display-title text-lg">AI-Connect</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="panel" size="sm" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Go to</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSection("dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </DropdownMenuItem>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.id} onClick={() => setSection(item.id)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.nav>

        {pendingInvite && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4" role="status">
            <p className="min-w-0 flex-1 text-sm text-foreground">
              {isPairingInvite ? `Pairing your persona with ${pendingInvite.inviterName ?? "your friend"}…`
                : invitePairingError ?? `An invite from ${pendingInvite.inviterName ?? "a friend"} is waiting for your persona.`}
            </p>
            {!isPairingInvite && (
              <div className="flex flex-wrap gap-2">
                {!profileQuery.data && <Button size="sm" variant="secondary" onClick={() => setSection("composition")}>Create persona</Button>}
                {invitePairingError && <Button size="sm" variant="secondary" onClick={() => setInviteRetry((value) => value + 1)}>Retry pairing</Button>}
                <Button size="sm" variant="ghost" onClick={() => { clearPendingInvite(); setPendingInvite(null); setInvitePairingError(null); }}>Dismiss invite</Button>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </main>
  );
};

export default Index;
