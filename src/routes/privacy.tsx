import { createFileRoute, Link } from "@tanstack/react-router";

const SITE_URL = "https://chameleonaire.lovable.app/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — chamele-on-air" },
      {
        name: "description",
        content: "How chamele-on-air handles account, YouTube, and channel performance data.",
      },
      { property: "og:title", content: "Privacy Policy — chamele-on-air" },
      {
        property: "og:description",
        content: "How chamele-on-air handles account, YouTube, and channel performance data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          chamele-on-air
        </Link>
        <h1 className="mt-8 font-display text-4xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective September 6, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Information we process</h2>
            <p className="mt-2">
              We process account information you provide, public YouTube channel and video metadata,
              channel settings you create, and operational records needed to generate, schedule, and
              publish your content.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Google and YouTube data</h2>
            <p className="mt-2">
              When you connect YouTube, Google provides authorization tokens and basic information about
              the channel you select. We use that access only to identify the connected channel and upload
              videos you explicitly approve. We do not sell Google user data or use it for advertising.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Storage and security</h2>
            <p className="mt-2">
              Connection credentials are stored securely in the app backend and are not exposed in the
              browser. Generated video files are stored privately. Access is limited to authenticated app
              operations required to provide the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Sharing and retention</h2>
            <p className="mt-2">
              We share data only with service providers needed to operate the app and with YouTube when
              you request an upload. Connection data is retained while your channel remains connected.
              Disconnecting removes the stored YouTube connection from the app.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Your choices</h2>
            <p className="mt-2">
              You can disconnect YouTube from the channel page and revoke the app’s access at any time in
              your Google Account permissions. You may also stop using the service and request deletion
              through the project owner’s published support channel.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">Policy updates</h2>
            <p className="mt-2">
              We may update this policy as the product changes. Material changes will be reflected here
              with a new effective date.
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
        </footer>
      </article>
    </main>
  );
}