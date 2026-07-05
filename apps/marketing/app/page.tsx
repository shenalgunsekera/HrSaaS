import Link from 'next/link';
import { Reveal, SectionHeading } from '@hr/design-system';

export default function Home() {
  return (
    <main className="relative min-h-svh flex items-center border-b border-line overflow-hidden">
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <SectionHeading
          kicker="HR software for Sri Lankan business"
          title={
            <>
              HR SOFTWARE YOUR
              <br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">
                PEOPLE ACTUALLY USE
              </span>
            </>
          }
          standfirst="Employee records, attendance, leave and fully statutory payroll — growing with you through five levels, up to AI-orchestrated HR. Every company on its own private database and domain."
        />
        <Reveal delay={0.24}>
          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              href="/pricing"
              className="inline-flex items-center px-9 py-4 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand"
            >
              See levels &amp; pricing
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center px-8 py-4 border border-brand text-brand font-display text-base tracking-widest uppercase hover:bg-brand hover:text-white transition-colors"
            >
              Book a consultation
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
