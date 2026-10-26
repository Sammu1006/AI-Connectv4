import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageRow, ProfileRow } from "@/lib/persona-lab";

// Deterministic voice assignment — each persona always gets the same voice
// Voice hints per gender — used to pick from browser TTS voices
const FEMALE_HINTS = ["female", "samantha", "victoria", "karen", "tessa", "moira", "fiona", "susan", "zira", "google uk english female", "google us english"];
const MALE_HINTS = ["male", "daniel", "alex", "fred", "tom", "aaron", "david", "google uk english male"];
const NEUTRAL_HINTS = ["google", "microsoft"];

type VoiceAssignment = {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
};

const getVoices = (): SpeechSynthesisVoice[] => {
  return window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
};

const assignVoices = (
  speakerIds: string[],
  profileLookup: Record<string, ProfileRow | undefined>,
): Map<string, VoiceAssignment> => {
  const voices = getVoices();
  const assignments = new Map<string, VoiceAssignment>();

  const preferred = voices.slice().sort((a, b) => (a.localService ? 0 : 1) - (b.localService ? 0 : 1));
  const used = new Set<number>();

  const pickByHints = (hints: string[]) => {
    for (const hint of hints) {
      const idx = preferred.findIndex((v, vi) => !used.has(vi) && v.name.toLowerCase().includes(hint));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  speakerIds.forEach((id, i) => {
    const gender = ((profileLookup[id] as any)?.gender ?? "").toLowerCase();
    const isFemale = gender === "female";
    const isMale = gender === "male";

    let voiceIdx = -1;
    if (isFemale) voiceIdx = pickByHints(FEMALE_HINTS);
    else if (isMale) voiceIdx = pickByHints(MALE_HINTS);
    if (voiceIdx === -1) voiceIdx = pickByHints(NEUTRAL_HINTS);
    if (voiceIdx === -1) voiceIdx = preferred.findIndex((_, vi) => !used.has(vi));
    if (voiceIdx === -1 && preferred.length) voiceIdx = i % preferred.length;
    if (voiceIdx !== -1) used.add(voiceIdx);

    const pitch = isFemale ? 1.15 : isMale ? 0.8 : 1.0 + (i % 3) * 0.05;
    const rate = isFemale ? 1.0 : isMale ? 0.95 : 0.97;

    assignments.set(id, {
      voice: voiceIdx !== -1 ? preferred[voiceIdx] : null,
      pitch,
      rate,
    });
  });

  return assignments;
};

export type TheaterState = "idle" | "playing" | "paused";

export type RevealedMessage = {
  messageId: string;
  revealedText: string;
  isComplete: boolean;
  isSpeaking: boolean;
};

export const useVoiceTheater = (
  messages: MessageRow[],
  profileLookup: Record<string, ProfileRow | undefined>,
) => {
  const [state, setState] = useState<TheaterState>("idle");
  const [revealedMessages, setRevealedMessages] = useState<Map<string, RevealedMessage>>(new Map());
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(-1);

  const voiceAssignmentsRef = useRef<Map<string, VoiceAssignment>>(new Map());
  const messageQueueRef = useRef<MessageRow[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const abortRef = useRef(false);
  const spokenIdsRef = useRef<Set<string>>(new Set());

  // Initialize voice assignments when speaker IDs change
  useEffect(() => {
    const speakerIds = [...new Set(messages.map((m) => m.speaker_user_id))];
    if (speakerIds.length > 0) {
      // Wait for voices to load
      const assignOnLoad = () => {
        voiceAssignmentsRef.current = assignVoices(speakerIds, profileLookup);
      };

      if (getVoices().length > 0) {
        assignOnLoad();
      } else {
        window.speechSynthesis.addEventListener("voiceschanged", assignOnLoad, { once: true });
      }
    }
  }, [messages.map((m) => m.speaker_user_id).join(",")]);

  const revealWordByWord = useCallback(
    (message: MessageRow, assignment: VoiceAssignment): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (abortRef.current) {
          reject(new Error("aborted"));
          return;
        }

        const words = message.content.split(/(\s+)/);
        const totalChars = message.content.length;

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(message.content);
        if (assignment.voice) utterance.voice = assignment.voice;
        utterance.pitch = assignment.pitch;
        utterance.rate = assignment.rate;

        // Estimate duration to sync word reveal
        // Average reading speed ~150 wpm, adjusted by rate
        const wordCount = words.filter((w) => w.trim()).length;
        const estimatedDurationMs = (wordCount / (150 * assignment.rate)) * 60 * 1000;
        const charInterval = estimatedDurationMs / totalChars;

        let charIndex = 0;
        let intervalId: ReturnType<typeof setInterval>;

        // Mark as speaking
        setRevealedMessages((prev) => {
          const next = new Map(prev);
          next.set(message.id, {
            messageId: message.id,
            revealedText: "",
            isComplete: false,
            isSpeaking: true,
          });
          return next;
        });

        // Progressively reveal text
        intervalId = setInterval(() => {
          if (abortRef.current) {
            clearInterval(intervalId);
            reject(new Error("aborted"));
            return;
          }

          charIndex = Math.min(charIndex + 3, totalChars);

          setRevealedMessages((prev) => {
            const next = new Map(prev);
            next.set(message.id, {
              messageId: message.id,
              revealedText: message.content.slice(0, charIndex),
              isComplete: charIndex >= totalChars,
              isSpeaking: true,
            });
            return next;
          });

          if (charIndex >= totalChars) {
            clearInterval(intervalId);
          }
        }, charInterval * 3);

        utterance.onend = () => {
          clearInterval(intervalId);
          // Ensure full text is revealed
          setRevealedMessages((prev) => {
            const next = new Map(prev);
            next.set(message.id, {
              messageId: message.id,
              revealedText: message.content,
              isComplete: true,
              isSpeaking: false,
            });
            return next;
          });
          resolve();
        };

        utterance.onerror = (e) => {
          clearInterval(intervalId);
          // Still reveal full text on error
          setRevealedMessages((prev) => {
            const next = new Map(prev);
            next.set(message.id, {
              messageId: message.id,
              revealedText: message.content,
              isComplete: true,
              isSpeaking: false,
            });
            return next;
          });
          if (e.error === "canceled" || abortRef.current) {
            reject(new Error("aborted"));
          } else {
            resolve(); // Continue to next message even on error
          }
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [],
  );

  const playSequence = useCallback(
    async (messagesToPlay: MessageRow[], startIndex = 0) => {
      isPlayingRef.current = true;
      abortRef.current = false;
      setState("playing");

      for (let i = startIndex; i < messagesToPlay.length; i++) {
        if (abortRef.current) break;

        const message = messagesToPlay[i];
        const assignment = voiceAssignmentsRef.current.get(message.speaker_user_id) ?? {
          voice: null,
          pitch: 1,
          rate: 0.95,
        };

        currentIndexRef.current = i;
        setCurrentSpeakerIndex(i);
        spokenIdsRef.current.add(message.id);

        try {
          // Small breathing pause between speakers (like humans)
          if (i > startIndex) {
            await new Promise((r) => setTimeout(r, 800));
          }
          await revealWordByWord(message, assignment);
        } catch {
          break; // aborted
        }
      }

      isPlayingRef.current = false;
      if (!abortRef.current) {
        setState("idle");
        setCurrentSpeakerIndex(-1);
      }
    },
    [revealWordByWord],
  );

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    window.speechSynthesis.cancel();

    // Reset state
    setRevealedMessages(new Map());
    spokenIdsRef.current.clear();
    messageQueueRef.current = [...messages];
    playSequence(messages, 0);
  }, [messages, playSequence]);

  const stop = useCallback(() => {
    abortRef.current = true;
    window.speechSynthesis.cancel();
    setState("idle");
    isPlayingRef.current = false;
    setCurrentSpeakerIndex(-1);

    // Reveal all messages fully
    setRevealedMessages((prev) => {
      const next = new Map(prev);
      messages.forEach((m) => {
        next.set(m.id, {
          messageId: m.id,
          revealedText: m.content,
          isComplete: true,
          isSpeaking: false,
        });
      });
      return next;
    });
  }, [messages]);

  const speakSingle = useCallback(
    (message: MessageRow) => {
      window.speechSynthesis.cancel();
      abortRef.current = false;

      const assignment = voiceAssignmentsRef.current.get(message.speaker_user_id) ?? {
        voice: null,
        pitch: 1,
        rate: 0.95,
      };

      setState("playing");
      setRevealedMessages((prev) => {
        const next = new Map(prev);
        next.set(message.id, {
          messageId: message.id,
          revealedText: message.content,
          isComplete: true,
          isSpeaking: true,
        });
        return next;
      });

      const utterance = new SpeechSynthesisUtterance(message.content);
      if (assignment.voice) utterance.voice = assignment.voice;
      utterance.pitch = assignment.pitch;
      utterance.rate = assignment.rate;

      utterance.onend = () => {
        setState("idle");
        setRevealedMessages((prev) => {
          const next = new Map(prev);
          const existing = next.get(message.id);
          if (existing) next.set(message.id, { ...existing, isSpeaking: false });
          return next;
        });
      };

      utterance.onerror = () => {
        setState("idle");
      };

      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    state,
    revealedMessages,
    currentSpeakerIndex,
    play,
    stop,
    speakSingle,
  };
};
