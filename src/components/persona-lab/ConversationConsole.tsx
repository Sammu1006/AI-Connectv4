import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Clock3, LoaderCircle, Square, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserChatPanel } from "@/components/persona-lab/UserChatPanel";
import { useVoiceTheater } from "@/hooks/use-voice-theater";
import { fadeUp, scaleIn, staggerContainer } from "@/lib/motion";
import { formatDateTime, getInitials, getModeLabel, getStatusLabel, type ConversationRow, type MessageRow, type ParticipantRow, type ProfileRow } from "@/lib/persona-lab";

interface ConversationConsoleProps {
  activeConversation: ConversationRow | null;
  activeMessages: MessageRow[];
  activeParticipants: ParticipantRow[];
  conversations: ConversationRow[];
  participantsByConversation: Record<string, string[]>;
  currentUserId: string;
  isStopping: boolean;
  onSelectConversation: (conversationId: string) => void;
  onStopConversation: (conversationId: string) => Promise<void>;
  profileLookup: Record<string, ProfileRow | undefined>;
}

const statusTone = (status: ConversationRow["status"]) => {
  if (status === "active") return "status-pill status-pill-live";
  if (status === "completed") return "status-pill status-pill-complete";
  if (status === "stopped") return "status-pill status-pill-muted";
  if (status === "failed") return "status-pill status-pill-failed";
  return "status-pill status-pill-muted";
};

const SpeakingIndicator = () => (
  <span className="relative ml-1 inline-flex h-2.5 w-2.5">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
  </span>
);

export const ConversationConsole = ({
  activeConversation,
  activeMessages,
  activeParticipants,
  conversations,
  participantsByConversation,
  currentUserId,
  isStopping,
  onSelectConversation,
  onStopConversation,
  profileLookup,
}: ConversationConsoleProps) => {
  const aiMessages = activeMessages.filter((m) => ((m as any).sender_type ?? "ai") === "ai");
  const humanMessages = activeMessages.filter((m) => (m as any).sender_type === "human");
  const { state: theaterState, revealedMessages, currentSpeakerIndex } =
    useVoiceTheater(aiMessages, profileLookup);

  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theaterState === "playing" && stageRef.current) {
      stageRef.current.scrollTo({ top: stageRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [currentSpeakerIndex, theaterState, revealedMessages]);

  const isTheaterMode = theaterState === "playing";

  return (
    <motion.section
      className="surface-panel grid h-full gap-6 p-6 xl:grid-cols-[0.72fr_1.28fr]"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Left: Archive */}
      <motion.div className="flex min-h-[24rem] flex-col gap-4" variants={fadeUp} custom={0}>
        <div className="space-y-2">
          <p className="section-kicker">Your persona's runs</p>
          <h2 className="display-title text-3xl">History</h2>
          <p className="text-sm text-muted-foreground">Only conversations your AI persona took part in.</p>
        </div>

        <motion.div className="grid gap-3 overflow-y-auto pr-1" variants={staggerContainer}>
          {conversations.length ? (
            conversations.map((conversation, i) => {
              const initiatorName =
                conversation.created_by === currentUserId
                  ? "You"
                  : profileLookup[conversation.created_by]?.name ?? "Another persona";
              const others = (participantsByConversation[conversation.id] ?? [])
                .filter((id) => id !== currentUserId)
                .map((id) => profileLookup[id]?.name ?? "Persona");
              return (
              <motion.button
                className={`history-card ${activeConversation?.id === conversation.id ? "history-card-active" : ""}`}
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                type="button"
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                layout
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{getModeLabel(conversation.mode)}</p>
                    <p className="text-xs text-muted-foreground">{conversation.topic || "Free-form autonomous exchange"}</p>
                  </div>
                  <span className={statusTone(conversation.status)}>{getStatusLabel(conversation.status)}</span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>Initiated by <span className="font-semibold text-foreground">{initiatorName}</span></p>
                  {others.length > 0 && <p>With {others.join(", ")}</p>}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tag-chip">Compatibility {conversation.compatibility_score != null ? `${Math.round(conversation.compatibility_score)}%` : "—"}</span>
                  <span>{formatDateTime(conversation.last_message_at ?? conversation.created_at)}</span>
                </div>
              </motion.button>
              );
            })
          ) : (
            <motion.div className="empty-tile" variants={scaleIn}>
              <Clock3 className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Start a conversation to build your history.</p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Right: Live Theater */}
      <motion.div className="flex min-h-[24rem] flex-col gap-4" variants={fadeUp} custom={1}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Live theater</p>
            <h3 className="display-title text-3xl">
              {activeConversation ? activeConversation.topic || getModeLabel(activeConversation.mode) : "Select a conversation"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeConversation
                ? `${getModeLabel(activeConversation.mode)} • ${formatDateTime(activeConversation.created_at)}`
                : "AI-generated turns, extracted topics, and end summaries will appear here."}
            </p>
          </div>

          <div className="flex gap-2">

            {activeConversation?.status === "active" ? (
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button variant="panel" onClick={() => onStopConversation(activeConversation.id)} disabled={isStopping}>
                  <Square className="h-4 w-4" />
                  {isStopping ? "Stopping..." : "Stop run"}
                </Button>
              </motion.div>
            ) : null}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeConversation ? (
            <motion.div
              key={activeConversation.id}
              className="flex flex-1 flex-col gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              {/* Stats row */}
              <div className="grid gap-3 md:grid-cols-3">
                <motion.div className="stat-tile md:col-span-1" whileHover={{ y: -2, transition: { duration: 0.2 } }}>
                  <p className="section-kicker">Status</p>
                  <span className={`${statusTone(activeConversation.status)} mt-3 inline-flex`}>{getStatusLabel(activeConversation.status)}</span>
                </motion.div>
                <motion.div className="stat-tile md:col-span-1" whileHover={{ y: -2, transition: { duration: 0.2 } }}>
                  <p className="section-kicker">Compatibility</p>
                  <p className="display-title mt-3 text-4xl">{activeConversation.compatibility_score ? `${Math.round(activeConversation.compatibility_score)}%` : "—"}</p>
                </motion.div>
                <motion.div className="stat-tile md:col-span-1" whileHover={{ y: -2, transition: { duration: 0.2 } }}>
                  <p className="section-kicker">Topics</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeConversation.extracted_topics.length ? (
                      activeConversation.extracted_topics.map((topic) => (
                        <span className="tag-chip" key={topic}>{topic}</span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Generated after the run ends</span>
                    )}
                  </div>
                </motion.div>
              </div>

              <Tabs defaultValue="ai" className="flex flex-1 flex-col gap-3">
                <TabsList className="w-fit">
                  <TabsTrigger value="ai">AI Bots Chat</TabsTrigger>
                  <TabsTrigger value="user">User Chat</TabsTrigger>
                </TabsList>
                <TabsContent value="user" className="mt-0 flex flex-1 flex-col">
                  <UserChatPanel
                    conversation={activeConversation}
                    messages={humanMessages}
                    participants={activeParticipants}
                    currentUserId={currentUserId}
                    profileLookup={profileLookup}
                  />
                </TabsContent>
                <TabsContent value="ai" className="mt-0 flex flex-1 flex-col gap-4">
              {/* Conversation stage */}
              <div className="conversation-stage flex-1" ref={stageRef}>
                {aiMessages.length ? (
                  aiMessages.map((message) => {
                    const isCurrentUser = message.speaker_user_id === currentUserId;
                    const speaker = profileLookup[message.speaker_user_id];
                    const revealed = revealedMessages.get(message.id);

                    const isVisible = !isTheaterMode || (revealed && revealed.revealedText.length > 0);
                    const isSpeaking = revealed?.isSpeaking ?? false;
                    const displayText = isTheaterMode && revealed ? revealed.revealedText : message.content;
                    const isTyping = isTheaterMode && revealed && !revealed.isComplete;

                    if (!isVisible && isTheaterMode) return null;

                    return (
                      <motion.article
                        className={`message-row ${isCurrentUser ? "message-row-self" : "message-row-peer"}`}
                        key={message.id}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: isSpeaking ? 1.01 : 1,
                        }}
                        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                        layout
                      >
                        <motion.span
                          className={`avatar-orb avatar-orb-small ${isSpeaking ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                          animate={isSpeaking ? { scale: [1, 1.08, 1] } : {}}
                          transition={isSpeaking ? { repeat: Infinity, duration: 1.5 } : {}}
                        >
                          {getInitials(speaker?.name)}
                        </motion.span>
                        <div className={`message-bubble ${isCurrentUser ? "message-bubble-self" : "message-bubble-peer"} ${
                          isSpeaking ? "shadow-lg shadow-primary/20 border-primary/40" : ""
                        }`}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-current/70">
                            <span className="flex items-center gap-1">
                              {speaker?.name ?? "AI Persona"}
                              {isSpeaking && <SpeakingIndicator />}
                            </span>
                            <span>Round {message.round_index}</span>
                          </div>
                          <p className="text-sm leading-6">
                            {displayText}
                            {isTyping && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60" />}
                          </p>
                        </div>
                      </motion.article>
                    );
                  })
                ) : (
                  <div className="empty-tile h-full">
                    {activeConversation.status === "active" ? (
                      <>
                        <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">AI personas are generating the first exchange…</p>
                      </>
                    ) : (
                      <>
                        <Bot className="h-5 w-5 text-primary" />
                        <p className="text-sm text-muted-foreground">No messages captured for this run yet.</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Summary */}
              <motion.div
                className="rounded-[1.75rem] border border-border/70 bg-secondary/70 p-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2">
                  <WandSparkles className="h-4 w-4 text-primary" />
                  <p className="section-kicker">Conversation summary</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground/85">
                  {activeConversation.summary ?? "Summary and extracted themes will land here once the AI run completes."}
                </p>
              </motion.div>
                </TabsContent>
              </Tabs>
            </motion.div>
          ) : (
            <motion.div
              className="empty-tile h-full"
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Bot className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Choose a saved conversation or launch a new one from the directory.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
};
