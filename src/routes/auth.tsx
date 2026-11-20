import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { GoogleLogo } from "@/components/google-logo";
import { LinkedInLogo } from "@/components/linkedin-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Lockedin" },
      { name: "description", content: "Sign in or create your free Lockedin account." },
      { property: "og:title", content: "Sign in · Lockedin" },
      { property: "og:description", content: "Sign in or create your free Lockedin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const err = q.get("error_description") || h.get("error_description") || q.get("error") || h.get("error");
    if (err) toast.error(`Sign-in didn't finish: ${err.replace(/\+/g, " ")}`, { duration: 15000 });
    const liToken = h.get("li_token");
    if (liToken) {
      window.history.replaceState(null, "", "/auth");
      supabase.auth.verifyOtp({ token_hash: liToken, type: "magiclink" }).then(({ error }) => {
        if (error) toast.error(`LinkedIn sign-in didn't finish: ${error.message}`);
      });
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
  }

  function linkedin() {
    // LinkedIn refuses to load inside the editor's preview frame, so open a real tab there.
    if (window.self !== window.top) window.open("/api/public/linkedin/start", "_blank");
    else window.location.href = "/api/public/linkedin/start";
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-background bg-warm px-4 py-12">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo large /></div>
        <div className="auth-panel">
          {sent ? (
            <div className="text-center">
              <h1 className="text-2xl">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to {email}. Click it to finish creating your account.</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Free, and your data stays private.</p>
              <Button type="button" variant="outline" className="mt-6 w-full" onClick={linkedin}>
                <LinkedInLogo /> Continue with LinkedIn
              </Button>
              <Button type="button" variant="google" className="mt-3 w-full" onClick={google}>
                <GoogleLogo /> Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </Button>
              </p>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">LinkedIn sign-in only shares your name, email and photo.</p>
      </div>
    </div>
  );
}
