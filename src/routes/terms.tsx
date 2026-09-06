import { createFileRoute, Link } from "@tanstack/react-router";

const SITE_URL = "https://chameleonaire.lovable.app/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — chamele-on-air" },
      {
        name: "description",
        content: "Terms governing use of chamele-on-air and its YouTube publishing tools.",
      },
      { property: "og:title", content: "Terms of Service — chamele-on-air" },
      {
        property: "og:description",
        content: "Terms governing use of chamele-on-air and its YouTube publishing tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          chamele-on-air
        </Link>
        <h1 className="mt-8 font-display text-4xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective September 6, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Using the service</h2>
            <p className="mt-2">
              You may use chamele-on-air to study public content performance, create original branded
              material, and publish content to channels you are authorized to manage. You are responsible
              for your account activity and the accuracy of information you provide.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Original content</h2>
            <p className="mt-2">
              The service is designed to analyze repeatable structures and public performance signals, not
              to copy another creator’s titles, scripts, branding, identity, or protected work. You must
              review generated material and ensure you have the rights required to publish it.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">YouTube publishing</h2>
            <p className="mt-2">
              Connecting a YouTube channel authorizes the app to read basic channel information and upload
              approved videos. You remain responsible for each upload and for compliance with YouTube’s
              Terms of Service, Community Guidelines, and applicable laws.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Availability and estimates</h2>
            <p className="mt-2">
              Revenue, profit, view, and confidence figures are estimates based on available signals and do
              not guarantee results. The service may change, pause, or discontinue features as needed.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Acceptable use</h2>
            <p className="mt-2">
              You may not use the service to impersonate others, infringe intellectual property, evade
              platform safeguards, publish unlawful material, or access a channel without permission.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Account access</h2>
            <p className="mt-2">
              You can stop YouTube publishing by disconnecting the channel or revoking access from your
              Google Account. These terms remain applicable to activity completed before disconnection.
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </footer>
      </article>
    </main>
  );
}