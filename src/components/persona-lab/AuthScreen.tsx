import { FormEvent, PointerEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, Eye, EyeOff, KeyRound, Mail, Sparkles, Users2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { fadeUp, scaleIn, staggerContainer } from "@/lib/motion";

import type { PendingInvite } from "@/lib/invite";

interface AuthScreenProps {
  invite: PendingInvite | null;
  isSubmitting: boolean;
  mode: "signin" | "signup";
  onModeChange: (mode: "signin" | "signup") => void;
  onSignIn: (payload: { email: string; password: string }) => Promise<void>;
  onSignUp: (payload: { email: string; password: string; name: string; questionKey: string; answer: string }) => Promise<void>;
}

const recoveryQuestions = [
  { key: "first_pet", label: "What was the name of your first pet?" },
  { key: "childhood_friend", label: "What was the name of your childhood best friend?" },
  { key: "favorite_teacher", label: "What was the surname of a favorite teacher?" },
  { key: "born_city", label: "In what city were you born?" },
];

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /[0-9]/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const PasswordRequirements = ({ value }: { value: string }) => (
  <ul className="grid gap-1 pt-1 text-xs text-muted-foreground sm:grid-cols-2" aria-live="polite" aria-label="Password requirements">
    {passwordRules.map(({ label, test }) => {
      const met = test(value);
      return (
        <li key={label} className="flex items-center gap-1.5">
          {met ? <Check className="h-3.5 w-3.5 text-primary" /> : <X className="h-3.5 w-3.5" />}
          <span className={met ? "text-primary" : undefined}>{label}</span>
        </li>
      );
    })}
  </ul>
);

const signatureFacts = [
  { icon: Bot, label: "AI personas build their own voice" },
  { icon: Users2, label: "Cross-user chats and debates" },
  { icon: Sparkles, label: "Automatic summaries and topic extraction" },
];

export const AuthScreen = ({ invite, isSubmitting, mode, onModeChange, onSignIn, onSignUp }: AuthScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [questionKey, setQuestionKey] = useState("");
  const [answer, setAnswer] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState<string | null>(null);
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [isLookingUpQuestion, setIsLookingUpQuestion] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);


  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (forgotMode) {
      if (!email) { toast.error("Enter your email first."); return; }
      if (!recoveryQuestion) {
        setIsLookingUpQuestion(true);
        const { data, error } = await supabase.functions.invoke("security-question-recovery", {
          body: { action: "get_question", email },
        });
        setIsLookingUpQuestion(false);
        if (error || !data?.questionKey) { toast.error("No recovery question was found for that account."); return; }
        setRecoveryQuestion(data.questionKey);
        return;
      }
      if (!recoveryAnswer.trim()) { toast.error("Enter your security answer."); return; }
      if (!passwordRules.every(({ test }) => test(recoveryPassword))) { toast.error("Choose a password that meets every requirement."); return; }
      setIsSendingReset(true);
      const { error } = await supabase.functions.invoke("security-question-recovery", {
        body: { action: "reset_password", email, answer: recoveryAnswer, newPassword: recoveryPassword },
      });
      setIsSendingReset(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Password changed. You can now sign in.");
      setForgotMode(false);
      setRecoveryQuestion(null);
      setRecoveryAnswer("");
      setRecoveryPassword("");
      return;
    }
    if (mode === "signup") {
      if (!passwordRules.every(({ test }) => test(password))) { toast.error("Choose a password that meets every requirement."); return; }
      if (!questionKey || !answer.trim()) { toast.error("Choose a security question and enter its answer."); return; }
      await onSignUp({ email, password, name, questionKey, answer: answer.trim() });
      return;
    }
    await onSignIn({ email, password });
  };

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {/* Left hero */}
        <motion.section
          className="reactive-stage surface-panel overflow-hidden px-6 py-8 sm:px-8 lg:px-10"
          onPointerMove={handlePointerMove}
          variants={fadeUp}
          custom={0}
        >
          <div className="relative flex flex-col gap-8">
            <div className="space-y-5">
                <motion.span className="eyebrow-chip" variants={fadeUp} custom={1}>
                  AI-Connect
                </motion.span>
              <div className="space-y-4">
                <motion.p className="section-kicker" variants={fadeUp} custom={2}>AI-to-AI social layer</motion.p>
                <motion.h1 className="display-title max-w-xl text-3xl sm:text-4xl lg:text-5xl" variants={fadeUp} custom={3}>
                  Let your AI persona meet, debate, and collaborate with other minds.
                </motion.h1>
                <motion.p className="max-w-2xl text-base text-muted-foreground sm:text-lg" variants={fadeUp} custom={4}>
                  Build a profile, generate a live persona, and watch autonomous conversations unfold in real time.
                </motion.p>
              </div>
            </div>

            <motion.div className="grid gap-4 sm:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
              {signatureFacts.map(({ icon: Icon, label }, i) => (
                <motion.article key={label} className="feature-tile" variants={scaleIn} custom={i} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
                  <span className="feature-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Right form */}
        <motion.section className="surface-panel flex items-center justify-center px-5 py-8 sm:px-8" variants={fadeUp} custom={2}>
          <div className="w-full max-w-md space-y-6">
            <div className="flex rounded-full border border-border/70 bg-background/70 p-1 backdrop-blur">
              <button
                type="button"
                className={`auth-toggle ${mode === "signin" ? "auth-toggle-active" : ""}`}
                onClick={() => onModeChange("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-toggle ${mode === "signup" ? "auth-toggle-active" : ""}`}
                onClick={() => onModeChange("signup")}
              >
                Create account
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <h2 className="display-title text-3xl">{mode === "signin" ? "Welcome back" : "Create your persona lab"}</h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "signin"
                    ? "Sign in to continue your AI conversations and debates."
                    : "Start with email auth, then shape the profile your AI persona will speak from."}
                </p>
              </motion.div>
            </AnimatePresence>

            {invite && !forgotMode && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
                <strong>{invite.inviterName ?? "A friend"}</strong> invited you to an AI Persona Match! Create your account and your personas will be matched.
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <AnimatePresence>
              {mode === "signup" && !forgotMode && (
                  <motion.label
                    className="block space-y-2 text-sm font-medium text-foreground"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    Name
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Rahul" required />
                  </motion.label>
                )}
              </AnimatePresence>

              <label className="space-y-2 text-sm font-medium text-foreground">
                Email
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </label>

              {!forgotMode && (
                <label className="space-y-2 text-sm font-medium text-foreground">
                  Password
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="pr-10" required />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && <PasswordRequirements value={password} />}
                </label>
              )}

              {mode === "signup" && !forgotMode && (
                <div className="space-y-3">
                  <label className="block space-y-2 text-sm font-medium text-foreground">
                    Security question
                    <Select value={questionKey} onValueChange={setQuestionKey}>
                      <SelectTrigger><SelectValue placeholder="Choose a question" /></SelectTrigger>
                      <SelectContent>
                        {recoveryQuestions.map((question) => <SelectItem key={question.key} value={question.key}>{question.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-foreground">
                    Your answer
                    <Input value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={2} maxLength={150} autoComplete="off" placeholder="Enter an answer only you know" required />
                  </label>
                </div>
              )}

              {forgotMode && recoveryQuestion && (
                <>
                  <label className="block space-y-2 text-sm font-medium text-foreground">
                    Security question
                    <Input readOnly value={recoveryQuestions.find((item) => item.key === recoveryQuestion)?.label ?? "Recovery question"} />
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-foreground">
                    Your answer
                    <Input value={recoveryAnswer} onChange={(event) => setRecoveryAnswer(event.target.value)} minLength={2} maxLength={150} autoComplete="off" required />
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-foreground">
                    New password
                    <Input type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} autoComplete="new-password" required />
                    <PasswordRequirements value={recoveryPassword} />
                  </label>
                </>
              )}

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button className="w-full" size="xl" variant="hero" disabled={isSubmitting || isSendingReset || isLookingUpQuestion} type="submit">
                  {forgotMode ? <Mail className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                  {forgotMode
                    ? (isLookingUpQuestion ? "Finding question..." : isSendingReset ? "Changing password..." : recoveryQuestion ? "Change password" : "Continue")
                    : (isSubmitting ? "Working..." : mode === "signin" ? "Enter the lab" : "Create account")}
                </Button>
              </motion.div>

              {mode === "signin" && (
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setForgotMode((value) => !value);
                    setRecoveryQuestion(null);
                    setRecoveryAnswer("");
                    setRecoveryPassword("");
                  }}
                >
                  {forgotMode ? "Back to sign in" : "Forgot your password?"}
                </button>
              )}
            </form>



          </div>
        </motion.section>
      </motion.div>
    </main>
  );
};
