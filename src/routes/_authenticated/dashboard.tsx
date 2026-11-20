import { Link, createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Link2, Target, UserRound } from "lucide-react";

import { PageHeading } from "@/components/page-heading";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Lockedin" },
      { name: "description", content: "Your outreach at a glance." },
      { property: "og:title", content: "Dashboard · Lockedin" },
      { property: "og:description", content: "Your outreach at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const next = [
  { icon: UserRound, title: "Import your profile", body: "Check what we imported from LinkedIn and add your goals.", to: "/profile" as const },
  { icon: Link2, title: "Add a recruiter", body: "Paste their LinkedIn link to find common ground." },
  { icon: Target, title: "Send a warm message", body: "Copy one of three drafts and send it yourself." },
];

function Dashboard() {
  return (
    <div className="space-y-8">
      <PageHeading icon={LayoutDashboard} title="Dashboard"><p>Good to see you.</p></PageHeading>
      <div className="grid gap-5 xl:grid-cols-3">
        {next.map((n, i) => (
          <div key={n.title} className="tech-card relative overflow-hidden border-t-2 border-t-primary p-6">
            <div className="flex items-center justify-between">
              <n.icon className="size-5 text-primary" />
              <span className="font-display text-4xl tabular-nums text-primary/40">0{i + 1}</span>
            </div>
            <h3 className="mt-8 text-xl">{n.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            {"to" in n && n.to && <Link to={n.to} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Open my profile →</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
