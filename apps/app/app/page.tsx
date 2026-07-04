import Link from 'next/link';
import { Reveal, SectionHeading } from '@hr/design-system';

export default function Home() {
  return (
    <main className="relative min-h-svh flex items-center border-b border-line overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <SectionHeading
          kicker="HR Platform · Phase 0"
          title={
            <>
              ONE CODEBASE.
              <br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">
                EVERY COMPANY ITS OWN WORLD.
              </span>
            </>
          }
          standfirst="Tenant application shell. Modules arrive per phase; the design system is live now."
        />
        <Reveal delay={0.24}>
          <div className="mt-10">
            <Link
              href="/gallery"
              className="inline-flex items-center px-9 py-4 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand"
            >
              Open design gallery
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
