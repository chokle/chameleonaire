import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Only same-origin relative paths may be used as a post-login destination.
function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s['next']) }),
  head: () => ({
    meta: [
      { title: "Sign in — chamele-on-air" },
      {
        name: "description",
        content:
          "Sign in to run profit scans, extract blueprints and publish chameleonized videos from your channels.",
      },
      { property: "og:title", content: "Sign in to chamele-on-air" },
      {
        property: "og:description",
        content: "Operator access to the scanner, blueprint engine and publish queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  // `next` is validated as a same-origin relative path, so a raw href keeps
  // OAuth consent round-trips (which are not typed routes) intact.
  const goNext = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: next ? window.location.origin + next : window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) goNext();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-glow min-h-screen place-items-center px-4 py-16">
      <Card className="w-full max-w-sm spectrum-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">
            chamele<span className="spectrum-text">-on-</span>air
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Operator access. Scans, generation and publishing run under your account.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button className="w-full" disabled={busy || !email || !password} onClick={submit}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
