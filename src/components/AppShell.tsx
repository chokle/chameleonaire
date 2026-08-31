import { Link } from "@tanstack/react-router";
import {
  Boxes,
  CalendarClock,
  Fingerprint,
  Gauge,
  Palette,
  Radar,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Command", icon: Gauge },
  { to: "/scanner", label: "Profit scanner", icon: Radar },
  { to: "/blueprints", label: "Blueprints", icon: Fingerprint },
  { to: "/brands", label: "Brands", icon: Palette },
  { to: "/channels", label: "Channels", icon: Boxes },
  { to: "/queue", label: "Queue", icon: CalendarClock },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
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
          {children}
        </div>
      </main>
    </div>
  );
}
