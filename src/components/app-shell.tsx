import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, Settings, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="workspace min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-brand-surface text-brand-foreground">
        <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-4 py-2 sm:px-6">
          <Logo />
          <span className="hidden border-l border-border pl-6 font-display text-xs text-brand-muted sm:block">YOUR WORKSPACE</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-44 truncate text-xs text-brand-muted xl:inline">{user.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut /></Button>
          </div>
        </div>
      </header>
      <div className="workspace-layout mx-auto max-w-[1440px]">
        <aside className="workspace-sidebar">
          <p className="mb-5 hidden px-3 font-display text-xs text-muted-foreground lg:block">WORKSPACE</p>
          <nav className="workspace-navigation" aria-label="Main navigation">
            <Link to="/dashboard" className="tech-nav-link">
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
            <Link to="/profile" className="tech-nav-link">
              <UserRound className="size-4" /> My profile
            </Link>
            <Link to="/targets" className="tech-nav-link">
              <Users className="size-4" /> Targets
            </Link>
            <Link to="/settings" className="tech-nav-link">
              <Settings className="size-4" /> Settings
            </Link>
          </nav>
          <div className="workspace-sidebar-brand hidden lg:block"><span className="inline-block size-2 bg-success" /> Lockedin</div>
        </aside>
        <main className="workspace-content min-w-0 px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
