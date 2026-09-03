import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Calculator, TrendingUp, BadgeDollarSign } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { NICHE_RPM, estimateProfit, money, compact } from "@/lib/domain";

const BASE_URL = "https://chameleonaire.lovable.app";
const NICHES = Object.keys(NICHE_RPM).filter((n) => n !== "general");

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "YouTube Money Calculator — Estimate Channel Earnings | chamele-on-air" },
      {
        name: "description",
        content:
          "Free YouTube money calculator: estimate how much a channel earns per video, per month and per year from views and niche RPM — with sponsorship uplift baked in.",
      },
      { property: "og:title", content: "YouTube Money Calculator — chamele-on-air" },
      {
        property: "og:description",
        content:
          "Estimate YouTube earnings per video, month and year from views, niche RPM and sponsor uplift. Free calculator built on real profit-modelling data.",
      },
      { property: "og:url", content: `${BASE_URL}/calculator` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/calculator` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "YouTube Money Calculator",
          url: `${BASE_URL}/calculator`,
          applicationCategory: "FinanceApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "Estimate YouTube channel earnings per video, per month and per year from views, niche RPM and sponsorship uplift.",
        }),
      },
    ],
  }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const [monthlyViews, setMonthlyViews] = useState(250_000);
  const [niche, setNiche] = useState("finance");
  const [videosPerMonth, setVideosPerMonth] = useState(8);

  const result = useMemo(() => {
    const avgViews = Math.max(1, Math.round(monthlyViews / Math.max(1, videosPerMonth)));
    const perVideo = estimateProfit(avgViews, niche);
    const [rpmLow, rpmHigh] = NICHE_RPM[niche] ?? NICHE_RPM["general"]!;
    return {
      perVideoLow: perVideo.profitLow,
      perVideoHigh: perVideo.profitHigh,
      monthlyLow: perVideo.profitLow * videosPerMonth,
      monthlyHigh: perVideo.profitHigh * videosPerMonth,
      yearlyLow: perVideo.profitLow * videosPerMonth * 12,
      yearlyHigh: perVideo.profitHigh * videosPerMonth * 12,
      rpmLow,
      rpmHigh,
    };
  }, [monthlyViews, videosPerMonth, niche]);

  return (
    <AppShell
      publicPage
      title="YouTube money calculator"
      subtitle="Estimate what a channel earns — per video, per month, per year — from views, niche RPM and sponsorship uplift."
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-primary" /> Your inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="calc-views" className="text-sm font-medium">
                  Monthly views
                </label>
                <span className="font-mono text-sm text-primary">{compact(monthlyViews)}</span>
              </div>
              <Slider
                id="calc-views"
                aria-label="Monthly views"
                min={1000}
                max={10_000_000}
                step={1000}
                value={[monthlyViews]}
                onValueChange={([v]) => setMonthlyViews(v ?? monthlyViews)}
                className="mt-3"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Total views across the whole channel in a month.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="calc-cadence" className="text-sm font-medium">
                  Videos per month
                </label>
                <span className="font-mono text-sm text-primary">{videosPerMonth}</span>
              </div>
              <Slider
                id="calc-cadence"
                aria-label="Videos per month"
                min={1}
                max={60}
                step={1}
                value={[videosPerMonth]}
                onValueChange={([v]) => setVideosPerMonth(v ?? videosPerMonth)}
                className="mt-3"
              />
            </div>

            <div>
              <label htmlFor="calc-niche" className="text-sm font-medium">
                Niche
              </label>
              <select
                id="calc-niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
              >
                {NICHES.map((n) => (
                  <option key={n} value={n}>
                    {n} (${NICHE_RPM[n]![0]}–${NICHE_RPM[n]![1]} RPM)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                RPM is revenue per 1,000 monetized views. Finance and business niches command the
                highest rates; entertainment the lowest.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="spectrum-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeDollarSign className="size-4 text-primary" /> Estimated earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Estimate label="Per video" low={result.perVideoLow} high={result.perVideoHigh} />
            <Estimate label="Per month" low={result.monthlyLow} high={result.monthlyHigh} />
            <Estimate label="Per year" low={result.yearlyLow} high={result.yearlyHigh} big />
            <p className="text-xs text-muted-foreground">
              Modelled with a {money(result.rpmLow)}–{money(result.rpmHigh)} RPM band, a 55%
              monetized-view rate, and sponsorship uplift that scales with audience size. Real
              earnings vary with geography, watch time and season.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" /> How the money math works
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-card/40 p-4">
            <p className="font-mono text-xs text-primary">01</p>
            <p className="mt-1 font-display font-semibold">Views ÷ 1,000 × RPM</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ad revenue scales with monetized views — roughly 55% of total views serve ads — times
              your niche's RPM band.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card/40 p-4">
            <p className="font-mono text-xs text-primary">02</p>
            <p className="mt-1 font-display font-semibold">Niche sets the rate</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Advertisers pay far more to reach finance and business audiences than gaming or
              entertainment ones — often 5–10× per view.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card/40 p-4">
            <p className="font-mono text-xs text-primary">03</p>
            <p className="mt-1 font-display font-semibold">Sponsors multiply it</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Channels above ~40K average views add 40–90% on top of ad revenue through sponsorship
              slots.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
        <h2 className="font-display text-xl font-semibold">
          Want to see who is actually earning this in your niche?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          The profit scanner runs this same model against real channels — pick a niche and a profit
          bracket, and it surfaces the creators clearing it with the strategy breakdown to match.
        </p>
        <Link
          to="/scanner"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Scan real channels <ArrowRight className="ml-1 size-4" />
        </Link>
      </div>
    </AppShell>
  );
}

function Estimate({
  label,
  low,
  high,
  big,
}: {
  label: string;
  low: number;
  high: number;
  big?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display font-semibold ${big ? "text-3xl text-primary" : "text-xl"}`}>
        {money(low)} – {money(high)}
      </p>
    </div>
  );
}
