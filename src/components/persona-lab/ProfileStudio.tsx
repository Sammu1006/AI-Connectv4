import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Coffee, Compass, FileText, Film, Globe, Heart, Languages, Loader2, LogOut, MapPin, Music, Quote, Radar, Save, Sparkles, Sticker, Briefcase, BookOpen, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { FunctionsHttpError } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, scaleIn, staggerContainer } from "@/lib/motion";
import { profileFormSchema, toFormValues, buildProfilePayload, getProfileStrength, type ProfileFormValues, type ProfileRow } from "@/lib/persona-lab";
import { mergeResumeIntoValues, countResumeFills, describeScanError, type ResumeExtraction } from "@/lib/resume-scan";

interface ProfileStudioProps {
  isSaving: boolean;
  isSummarizing: boolean;
  onLogout: () => Promise<void>;
  onSave: (values: ReturnType<typeof buildProfilePayload>) => Promise<void>;
  onSummarize: () => Promise<void>;
  profile: ProfileRow | null | undefined;
}

const fieldLabels: Array<{ key: keyof ProfileFormValues; label: string; placeholder: string; icon: typeof BrainCircuit }> = [
  { key: "skillsInput", label: "Skills", placeholder: "Python, AI, product design", icon: BrainCircuit },
  { key: "interestsInput", label: "Interests", placeholder: "Robotics, startups, human-computer interaction", icon: Radar },
  { key: "personalityInput", label: "Personality traits", placeholder: "Analytical, curious, calm", icon: Compass },
  { key: "goalsInput", label: "Goals", placeholder: "Build with AI, meet collaborators, test new ideas", icon: Sparkles },
  { key: "valuesInput", label: "Core values", placeholder: "Honesty, curiosity, freedom", icon: Heart },
  { key: "languagesInput", label: "Languages", placeholder: "English, Hindi, Spanish", icon: Languages },
  { key: "hobbiesInput", label: "Hobbies", placeholder: "Hiking, cooking, gaming, journaling", icon: Sticker },
  { key: "quirksInput", label: "Quirks & habits", placeholder: "Talks to plants, can't sit still, midnight snacker", icon: Quote },
  { key: "favoriteMoviesInput", label: "Favorite movies / shows", placeholder: "Interstellar, The Office, Spirited Away", icon: Film },
  { key: "favoriteMusicInput", label: "Favorite music", placeholder: "Lo-fi, Coldplay, Hindi indie", icon: Music },
  { key: "favoriteBooksInput", label: "Favorite books", placeholder: "Sapiens, Dune, Atomic Habits", icon: BookOpen },
  { key: "favoriteFoodInput", label: "Favorite food", placeholder: "Ramen, biryani, dark chocolate", icon: Coffee },
];

export const ProfileStudio = ({ isSaving, isSummarizing, onLogout, onSave, onSummarize, profile }: ProfileStudioProps) => {
  const [formValues, setFormValues] = useState<ProfileFormValues>(() => toFormValues(profile));
  const [isScanningResume, setIsScanningResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormValues(toFormValues(profile));
  }, [profile]);

  const profileStrength = useMemo(() => getProfileStrength(profile), [profile]);

  const handleResumeFile = async (file: File) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Upload your resume as a PDF or a clear photo.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("That file is too large. Keep the resume under 6 MB.");
      return;
    }

    setIsScanningResume(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";

      const { data, error } = await supabase.functions.invoke("resume-scanner", {
        body: { filename: file.name, mimeType: file.type, base64 },
      });
      if (error || !data?.extraction) {
        let status: number | undefined;
        let detail = typeof data?.error === "string" ? data.error : "";
        if (!detail && error instanceof FunctionsHttpError) {
          status = (error.context as Response).status;
          try {
            detail = (JSON.parse(await error.context.text()) as { error?: string })?.error ?? "";
          } catch {
            // keep empty — describeScanError falls back to a generic message
          }
        }
        throw new Error(describeScanError(status, detail));
      }

      const extraction = data.extraction as ResumeExtraction;
      const filled = countResumeFills(formValues, extraction);
      setFormValues((current) => mergeResumeIntoValues(current, extraction));
      toast.success(
        filled > 0
          ? `Resume scanned — ${filled} field${filled === 1 ? "" : "s"} filled in. Review and edit anything that's off.`
          : "Resume scanned, but nothing new was found. You can fill the rest manually.",
      );
    } catch (scanError) {
      toast.error(scanError instanceof Error ? scanError.message : "The resume scan failed. Please try again.");
    } finally {
      setIsScanningResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };


  const handleSave = async () => {
    const parsed = profileFormSchema.safeParse(formValues);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your profile fields.");
      return;
    }
    await onSave(buildProfilePayload(parsed.data));
  };

  return (
    <motion.section
      className="surface-panel flex h-full flex-col gap-6 p-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div className="flex flex-wrap items-start justify-between gap-4" variants={fadeUp} custom={0}>
        <div className="space-y-2">
          <p className="section-kicker">Persona composition</p>
          <h2 className="display-title text-3xl">Shape the voice behind your AI.</h2>
          <p className="text-sm text-muted-foreground">
            The richer the profile, the sharper the persona summary, matching, and debate quality.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleResumeFile(file);
            }}
            ref={resumeInputRef}
            type="file"
          />
          <Button
            size="sm"
            onClick={() => resumeInputRef.current?.click()}
            disabled={isScanningResume}
          >
            {isScanningResume ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning resume...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Scan resume
              </>
            )}
          </Button>
          <Button variant="panel" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </motion.div>

      {isScanningResume && (
        <motion.div className="rounded-2xl border border-border/70 bg-secondary/60 px-4 py-3 text-sm text-muted-foreground" variants={fadeUp} custom={1}>
          Reading your resume and pulling out your details. Everything it finds lands in the fields below — anything missing, you can type in yourself.
        </motion.div>
      )}


      <motion.div className="grid gap-3 sm:grid-cols-3" variants={fadeUp} custom={1}>
        <div className="stat-tile sm:col-span-2">
          <span className="section-kicker">Persona strength</span>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="display-title text-4xl">{profileStrength}%</p>
              <p className="text-sm text-muted-foreground">Profile completeness score</p>
            </div>
            <div className="h-3 w-28 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${profileStrength}%` }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
              />
            </div>
          </div>
        </div>

        <div className="stat-tile">
          <span className="section-kicker">Directory status</span>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {formValues.discoverable ? "Visible" : "Hidden"}
          </p>
          <p className="text-sm text-muted-foreground">Control whether others can discover your persona.</p>
        </div>
      </motion.div>

      <motion.div className="grid gap-4 md:grid-cols-2" variants={fadeUp} custom={2}>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Name
          <Input
            value={formValues.name}
            onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="Rahul"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Field of study
          <Input
            value={formValues.fieldOfStudy}
            onChange={(event) => setFormValues((current) => ({ ...current, fieldOfStudy: event.target.value }))}
            placeholder="Computer science"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Occupation</span>
          <Input
            value={formValues.occupation}
            onChange={(event) => setFormValues((current) => ({ ...current, occupation: event.target.value }))}
            placeholder="Student / Designer / Founder"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Location</span>
          <Input
            value={formValues.location}
            onChange={(event) => setFormValues((current) => ({ ...current, location: event.target.value }))}
            placeholder="Bengaluru, India"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Age</span>
          <Input
            value={formValues.age}
            onChange={(event) => setFormValues((current) => ({ ...current, age: event.target.value }))}
            placeholder="24"
            inputMode="numeric"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Pronouns
          <Input
            value={formValues.pronouns}
            onChange={(event) => setFormValues((current) => ({ ...current, pronouns: event.target.value }))}
            placeholder="she/her, he/him, they/them"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
          <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />Communication style</span>
          <Input
            value={formValues.communicationStyle}
            onChange={(event) => setFormValues((current) => ({ ...current, communicationStyle: event.target.value }))}
            placeholder="Witty and sarcastic / Calm and thoughtful / Energetic and direct"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
          <span className="flex items-center gap-2"><Quote className="h-4 w-4 text-primary" />Short bio</span>
          <Textarea
            value={formValues.bio}
            onChange={(event) => setFormValues((current) => ({ ...current, bio: event.target.value }))}
            placeholder="A few sentences about who you are, what you're into, and what makes you, you."
            rows={3}
          />
        </label>
      </motion.div>

      <motion.div className="grid gap-4 md:grid-cols-2" variants={staggerContainer}>
        {fieldLabels.map(({ key, label, placeholder, icon: Icon }, i) => (
          <motion.label className="space-y-2 text-sm font-medium text-foreground" key={key} variants={fadeUp} custom={i}>
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </span>
            <Input
              value={formValues[key] as string}
              onChange={(event) => setFormValues((current) => ({ ...current, [key]: event.target.value }))}
              placeholder={placeholder}
            />
          </motion.label>
        ))}
      </motion.div>

      <motion.label
        className="flex items-center justify-between gap-4 rounded-3xl border border-border/70 bg-background/65 px-4 py-3 text-sm font-medium text-foreground"
        variants={fadeUp}
        custom={4}
      >
        <div>
          <p>Public directory visibility</p>
          <p className="text-xs font-normal text-muted-foreground">Others can discover you for AI chat and debate.</p>
        </div>
        <input
          checked={formValues.discoverable}
          className="h-4 w-4 accent-primary"
          onChange={(event) => setFormValues((current) => ({ ...current, discoverable: event.target.checked }))}
          type="checkbox"
        />
      </motion.label>

      <motion.div className="rounded-[1.75rem] border border-border/70 bg-secondary/60 p-5" variants={scaleIn} custom={5}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">AI persona summary</p>
            <p className="mt-2 text-sm text-muted-foreground">Generate the compact identity your autonomous agent will use.</p>
          </div>
          <Button variant="secondary" onClick={onSummarize} disabled={isSummarizing}>
            <Sparkles className="h-4 w-4" />
            {isSummarizing ? "Generating..." : "Refresh summary"}
          </Button>
        </div>
        <p className="mt-4 text-sm leading-6 text-foreground/90">
          {profile?.persona_summary ?? "No AI persona summary yet — save your profile and generate one."}
        </p>
      </motion.div>

      <motion.div className="mt-auto flex flex-wrap gap-3" variants={fadeUp} custom={6}>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button variant="hero" size="xl" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save profile"}
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button variant="panel" size="xl" onClick={onSummarize} disabled={isSummarizing}>
            <Sparkles className="h-4 w-4" />
            Generate persona
          </Button>
        </motion.div>
      </motion.div>
    </motion.section>
  );
};
