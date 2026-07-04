import { Reveal, SectionHeading } from '@hr/design-system';

export default function Home() {
  return (
    <main className="relative min-h-svh flex items-center border-b border-line overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <SectionHeading
          kicker="HR Platform · Marketing Site (Phase 5)"
          title={
            <>
              HR SOFTWARE YOUR
              <br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">
                PEOPLE ACTUALLY USE
              </span>
            </>
          }
          standfirst="Public onboarding site placeholder — product story, tier pricing and consultation booking arrive in Phase 5, on this same design system."
        />
        <Reveal delay={0.24}>
          <p className="font-body text-sm text-mute-2 mt-10">
            Placeholder shell — content lands in Phase 5.
          </p>
        </Reveal>
      </div>
    </main>
  );
}
