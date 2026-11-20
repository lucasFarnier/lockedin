import { Settings, Save } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import type { Json } from "@/integrations/supabase/types";
import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteAllMyData } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkedInLogo } from "@/components/linkedin-logo";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Lockedin" },
      { name: "description", content: "Message limits, connected accounts and your data." },
      { property: "og:title", content: "Settings · Lockedin" },
      { property: "og:description", content: "Message limits, connected accounts and your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type Settings = { note_limit?: number; followup_days?: number };

function SettingsPage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const del = useServerFn(deleteAllMyData);
  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("settings, linkedin_sub").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [noteLimit, setNoteLimit] = useState(300);
  const [followup, setFollowup] = useState(5);
  useEffect(() => {
    const s = (profile?.settings ?? {}) as Settings;
    setNoteLimit(s.note_limit ?? 300);
    setFollowup(s.followup_days ?? 5);
  }, [profile]);

  const linked = !!profile?.linkedin_sub;

  async function save() {
    const { error } = await supabase.from("profiles").update({ settings: { ...((profile?.settings ?? {}) as Record<string, unknown>), note_limit: noteLimit, followup_days: followup } as Json }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Settings saved");
  }

  async function connectLinkedIn() {
    // Our LinkedIn flow links by verified email: it signs into the account with the same email.
    if (window.self !== window.top) window.open("/api/public/linkedin/start", "_blank");
    else window.location.href = "/api/public/linkedin/start";
  }

  async function deleteEverything() {
    try {
      await del();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
      toast.success("Your account was deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeading icon={Settings} title="Settings" />

      <section className="tech-section">
        <h2 className="text-xl">Messages</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="limit">Connection note character limit</Label>
            <Input id="limit" type="number" min={100} max={1000} value={noteLimit} onChange={(e) => setNoteLimit(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu">Suggest a follow-up after (days)</Label>
            <Input id="fu" type="number" min={1} max={60} value={followup} onChange={(e) => setFollowup(Number(e.target.value))} />
          </div>
        </div>
        <Button className="mt-5" onClick={save}><Save /> Save</Button>
      </section>

      <section className="tech-section">
        <h2 className="text-xl">Connected accounts</h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><LinkedInLogo /><span>LinkedIn</span></div>
          {linked ? <span className="border border-success/30 bg-accent px-3 py-1 text-sm text-success">Connected</span> : <Button variant="outline" onClick={connectLinkedIn}>Connect</Button>}
        </div>
      </section>

      <section className="tech-section danger-section">
        <h2 className="text-xl">Delete your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Removes your sign-in and profile. This prototype may retain contact, message and lookup records.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4">Delete account</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteEverything}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
