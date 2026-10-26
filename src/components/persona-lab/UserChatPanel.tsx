import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Send, UserCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, getInitials, type ConversationRow, type MessageRow, type ParticipantRow, type ProfileRow } from "@/lib/persona-lab";
import { getUserChatState, USER_CHAT_THRESHOLD, type ConsentStatus } from "@/lib/user-chat";

interface Props {
  conversation: ConversationRow;
  messages: MessageRow[];
  participants: ParticipantRow[];
  currentUserId: string;
  profileLookup: Record<string, ProfileRow | undefined>;
}

export const UserChatPanel = ({ conversation, messages, participants, currentUserId, profileLookup }: Props) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const consents = participants.map((p) => ((p as any).consent_status ?? "none") as ConsentStatus);
  const state = getUserChatState(conversation.status, conversation.compatibility_score, consents);
  const mine = participants.find((p) => p.user_id === currentUserId);
  const myConsent = ((mine as any)?.consent_status ?? "none") as ConsentStatus;
  const others = participants.filter((p) => p.user_id !== currentUserId).map((p) => profileLookup[p.user_id]?.name ?? "the other user");
  const otherName = others.join(", ") || "the other user";

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversation.id] });
    };
    const channel = supabase
      .channel(`user-chat-${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversation.id}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversation.id}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const setConsent = async (value: ConsentStatus) => {
    if (!mine) return;
    setBusy(true);
    const { error } = await supabase.from("conversation_participants").update({ consent_status: value } as any).eq("id", mine.id);
    setBusy(false);
    if (error) return toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["conversation-participants", conversation.id] });
  };

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: conversation.id,
      speaker_user_id: currentUserId,
      content: content.slice(0, 2000),
      sender_type: "human",
    } as any);
    setBusy(false);
    if (error) return toast({ title: "Message not sent", description: error.message, variant: "destructive" });
    setDraft("");
    queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversation.id] });
  };

  if (state !== "connected") {
    const score = conversation.compatibility_score != null ? Math.round(conversation.compatibility_score) : null;
    return (
      <div className="empty-tile flex-1 gap-3 text-center">
        <Lock className="h-5 w-5 text-primary" />
        {state === "running" && <p className="text-sm text-muted-foreground">User chat unlocks after the AI bots finish chatting.</p>}
        {state === "below_threshold" && (
          <p className="text-sm text-muted-foreground">
            Compatibility was {score ?? "—"}%. User chat needs at least {USER_CHAT_THRESHOLD}%.
          </p>
        )}
        {state === "declined" && <p className="text-sm text-muted-foreground">This connection was passed on, so user chat stays closed.</p>}
        {state === "awaiting" && (
          <>
            <p className="text-sm text-foreground">
              Great match — {score}% compatible! Want to chat directly with {otherName}?
            </p>
            {myConsent === "accepted" ? (
              <p className="text-sm text-muted-foreground">Waiting for {otherName} to accept…</p>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => setConsent("accepted")} disabled={busy}>
                  <UserCheck className="h-4 w-4" /> Accept & chat
                </Button>
                <Button variant="outline" onClick={() => setConsent("declined")} disabled={busy}>
                  <X className="h-4 w-4" /> Pass
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-sm text-muted-foreground">You're connected with {otherName}. Messages here are from real people.</p>
      <div className="conversation-stage flex-1">
        {messages.length ? (
          messages.map((m) => {
            const self = m.speaker_user_id === currentUserId;
            return (
              <article key={m.id} className={`message-row ${self ? "message-row-self" : "message-row-peer"}`}>
                <span className="avatar-orb avatar-orb-small">{getInitials(profileLookup[m.speaker_user_id]?.name)}</span>
                <div className={`message-bubble ${self ? "message-bubble-self" : "message-bubble-peer"}`}>
                  <div className="mb-2 flex justify-between gap-3 text-xs uppercase tracking-[0.2em] text-current/70">
                    <span>{self ? "You" : profileLookup[m.speaker_user_id]?.name ?? "User"}</span>
                    <span>{formatDateTime(m.created_at)}</span>
                  </div>
                  <p className="text-sm leading-6">{m.content}</p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-tile h-full">
            <p className="text-sm text-muted-foreground">Say hi — pick up where your AI bots left off.</p>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Type a message…" />
        <Button type="submit" disabled={busy || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
