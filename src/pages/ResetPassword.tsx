import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, staggerContainer } from "@/lib/motion";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Supabase automatically parses the recovery token from the URL hash and signs in temporarily
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setIsReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated. You're signed in.");
    navigate("/", { replace: true });
  };

  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4">
      <motion.section
        className="surface-panel w-full max-w-md space-y-6 p-8"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div className="space-y-2" variants={fadeUp} custom={0}>
          <p className="section-kicker flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Password reset
          </p>
          <h1 className="display-title text-3xl">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            {isReady
              ? "Enter a new password below to regain access to your persona lab."
              : "Waiting for your recovery link — open the email we sent and tap the link."}
          </p>
        </motion.div>

        <motion.form className="space-y-4" onSubmit={handleSubmit} variants={fadeUp} custom={1}>
          <label className="space-y-2 text-sm font-medium text-foreground">
            New password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              disabled={!isReady}
              required
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-foreground">
            Confirm password
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat it"
              disabled={!isReady}
              required
            />
          </label>
          <Button
            type="submit"
            className="w-full"
            size="xl"
            variant="hero"
            disabled={!isReady || isSubmitting}
          >
            <KeyRound className="h-4 w-4" />
            {isSubmitting ? "Updating..." : "Update password"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/")}
          >
            Back to sign in
          </button>
        </motion.form>
      </motion.section>
    </main>
  );
};

export default ResetPassword;
