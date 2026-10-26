import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export const useAuthSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const authFallback = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2500);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.clearTimeout(authFallback);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data }) => {
        window.clearTimeout(authFallback);
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        window.clearTimeout(authFallback);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(authFallback);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) =>
    supabase.auth.signInWithPassword({
      email,
      password,
    });

  const signUp = async (email: string, password: string, name: string) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name },
      },
    });

  const signOut = async () => supabase.auth.signOut();

  return {
    loading,
    session,
    user,
    signIn,
    signOut,
    signUp,
  };
};
