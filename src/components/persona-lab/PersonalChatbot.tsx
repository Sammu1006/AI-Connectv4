import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, LoaderCircle, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, staggerContainer } from "@/lib/motion";

type ChatbotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

interface PersonalChatbotProps {
  userId: string;
  ownerName?: string | null;
}

export const PersonalChatbot = ({ userId, ownerName }: PersonalChatbotProps) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["chatbot-messages", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chatbot_messages")
        .select("id, role, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatbotMessage[];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("ai-persona-engine", {
        body: { action: "chatbot_reply", message },
      });
      if (error) throw error;
      return data as { reply: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-messages", userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chatbot_messages").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-messages", userId] });
      toast.success("Chat cleared.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messagesQuery.data, sendMutation.isPending]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    setDraft("");
    sendMutation.mutate(text);
  };

  const messages = messagesQuery.data ?? [];

  return (
    <motion.section
      className="surface-panel flex h-full flex-col gap-5 p-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div className="flex items-start justify-between gap-4" variants={fadeUp} custom={0}>
        <div className="space-y-1">
          <p className="section-kicker">Your AI chatbot</p>
          <h2 className="display-title text-3xl">Talk to your bot</h2>
          <p className="text-sm text-muted-foreground">
            A private AI that remembers your chats. When two users run a Bot Meeting, your bot uses these conversations to talk about you.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="panel"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        )}
      </motion.div>

      <div
        ref={scrollRef}
        className="conversation-stage flex-1 min-h-[18rem] max-h-[28rem]"
      >
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              className="empty-tile h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Bot className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                Say hi to your AI chatbot. It learns from every chat.
              </p>
            </motion.div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <motion.article
                  key={message.id}
                  className={`message-row ${isUser ? "message-row-self" : "message-row-peer"}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  layout
                >
                  <span className="avatar-orb avatar-orb-small">
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={`message-bubble ${isUser ? "message-bubble-self" : "message-bubble-peer"}`}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-current/70">
                      <span>{isUser ? ownerName ?? "You" : "Your bot"}</span>
                    </div>
                    <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.article>
              );
            })
          )}
        </AnimatePresence>

        {sendMutation.isPending && (
          <motion.div
            className="message-row message-row-peer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="avatar-orb avatar-orb-small">
              <Bot className="h-4 w-4" />
            </span>
            <div className="message-bubble message-bubble-peer flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Your bot is thinking…</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Tell your bot what you're working on, how you feel, what you need…"
          rows={2}
          className="resize-none"
        />
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending} variant="hero" className="gap-2">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </motion.div>
      </div>
    </motion.section>
  );
};
