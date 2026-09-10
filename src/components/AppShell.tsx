import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  Calculator,
  CalendarClock,
  Fingerprint,
  Gauge,
  LayoutGrid,
  LineChart,


  Palette,
  Plug,
  Radar,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Start", icon: Gauge },
  { to: "/studio", label: "Studio", icon: LayoutGrid },
  { to: "/scanner", label: "Profit scanner", icon: Radar },
  { to: "/calculator", label: "Money calculator", icon: Calculator },
  { to: "/blueprints", label: "Blueprints", icon: Fingerprint },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/channels", label: "Channels", icon: Boxes },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/queue", label: "Queue", icon: CalendarClock },
  { to: "/library", label: "Library", icon: Film },
  { to: "/performance", label: "Performance", icon: LineChart },
  { to: "/integrations/chatgpt", label: "ChatGPT", icon: Plug },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;


export function AppShell({
  children,
  title,
  subtitle,
  action,
  publicPage = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  publicPage?: boolean;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const locked = !publicPage && ready && !email;


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                <Sparkles className="size-4 text-primary" />
              </span>
              <span className="font-display text-base font-semibold tracking-tight">
                chamele<span className="spectrum-text">-on-</span>air
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              {email ? (
                <>
                  <Link
                    to="/profile"
                    className="hidden text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:inline"
                  >
                    {email}
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate({ to: "/auth" });
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/auth" })}>
                  Sign in
                </Button>
              )}
            </div>
          </div>
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="grid-glow">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {action}
          </div>
          {locked ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to run scans, extract blueprints and manage channels.
              </p>
              <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>
                Sign in
              </Button>
            </div>
          ) : (
            children
          )}

        </div>
      </main>
      <footer className="border-t border-border/70 px-4 py-6">
        <div className="mx-auto flex max-w-7xl items-center gap-5 text-xs text-muted-foreground lg:px-4">
          <span>© 2026 chamele-on-air</span>
          <Link to="/privacy" className="ml-auto hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
