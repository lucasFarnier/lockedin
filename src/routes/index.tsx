import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Copy, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lockedin: LinkedIn messages recruiters actually answer" },
      { name: "description", content: "Paste a recruiter's LinkedIn link. Lockedin finds what you genuinely have in common and drafts short, honest messages you copy and send." },
      { property: "og:title", content: "Lockedin: LinkedIn messages recruiters actually answer" },
      { property: "og:description", content: "Find real common ground with recruiters and hiring managers, then send a message that sounds like you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: Link2, title: "Paste their profile", body: "Drop in a recruiter's or hiring manager's LinkedIn link." },
  { icon: Sparkles, title: "See real common ground", body: "Shared schools, employers, skills and open roles, each with proof from both profiles." },
  { icon: Copy, title: "Copy, then send", body: "Three short drafts. Pick one, tweak it, and send it yourself on LinkedIn." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-brand-cyan/25 bg-brand-surface text-brand-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
        </div>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
          <div className="max-w-3xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium text-brand-cyan"><span className="size-2 bg-success" /> Free for job seekers</p>
            <h1 className="text-5xl leading-tight sm:text-6xl">Lockedin</h1>
            <p className="mt-3 font-display text-3xl leading-tight sm:text-4xl">Cold messages, <span className="text-brand-cyan">warmed up.</span></p>
            <p className="mt-6 max-w-2xl text-base leading-7 text-brand-muted">
              Lockedin compares your profile with a recruiter's, finds what you truly share, and writes a short message that gets read. No made-up compliments. No automation. You send it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg"><Link to="/auth">Get started <ArrowRight /></Link></Button>
            </div>
          </div>
          <div className="landing-draft mt-12 max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-medium text-brand-cyan"><Copy className="size-4" /> Draft · connection note</p>
            <p className="mt-4 text-base leading-relaxed">
              Hi Priya, we both studied Statistics at UT Austin, a few years apart. I saw the Data Analyst opening on your team and my last two years in retail forecasting line up closely. Would you be open to a quick chat about it?
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground">Shared school</span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">Open role match</span>
              <span className="ml-auto tabular-nums text-brand-muted">241 / 300</span>
            </div>
          </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="border-t-2 border-primary pt-5">
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl text-primary">{i + 1}</span>
                <s.icon className="size-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Lockedin never reads LinkedIn pages or sends messages for you.
      </footer>
    </div>
  );
}
