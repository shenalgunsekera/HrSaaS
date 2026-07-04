import { Reveal, SectionHeading } from '@hr/design-system';

export default function Home() {
  return (
    <main className="relative min-h-svh flex items-center border-b border-line overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <SectionHeading
          kicker="System Admin · Control Plane (Phase 2)"
          title={
            <>
              THE
              <span className="bg-brand-gradient bg-clip-text text-transparent"> FACTORY </span>
              CONSOLE
            </>
          }
          standfirst="Tenant registry, tier flips, provisioning runs, domains and prospect conversion — the UI over the control plane arrives in Phase 2."
        />
        <Reveal delay={0.24}>
          <p className="font-body text-sm text-mute-2 mt-10">
            Placeholder shell — vendor-side only, never tenant-reachable.
          </p>
        </Reveal>
      </div>
    </main>
  );
}
