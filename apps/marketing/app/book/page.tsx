import { TIERS } from '@hr/entitlements';
import { SectionHeading } from '@hr/design-system';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand w-full';

/** Consultation booking: lead capture → control-plane prospect + scheduler. */
export default function Book(props: { searchParams: Promise<{ booked?: string }> }) {
  return <BookInner searchParams={props.searchParams} />;
}

async function BookInner({ searchParams }: { searchParams: Promise<{ booked?: string }> }) {
  const { booked } = await searchParams;
  return (
    <main className="relative min-h-svh">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-24 grid lg:grid-cols-2 gap-16">
        <SectionHeading
          kicker="Book a consultation"
          title={
            <>
              LET&apos;S TALK ABOUT
              <br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">YOUR PEOPLE</span>
            </>
          }
          standfirst="Thirty minutes with our team. When you're ready, the same record flows straight into provisioning — no re-keying, your instance can be live the same day."
        />
        <div>
          {booked ? (
            <div className="border border-brand bg-brand-50 p-8">
              <p className="font-display text-2xl text-brand tracking-wide">BOOKED.</p>
              <p className="font-body text-sm text-mute-1 mt-2">
                Reference <span className="text-brand font-semibold">{booked}</span>. We&apos;ll be
                in touch shortly to confirm.
              </p>
            </div>
          ) : (
            <form method="post" action="/api/leads" className="grid sm:grid-cols-2 gap-4 border border-line bg-surface p-8">
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest sm:col-span-2">
                Company *
                <input name="company" required placeholder="Acme Holdings (Pvt) Ltd" className={input} />
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                Your name *
                <input name="name" required className={input} />
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                Email *
                <input name="email" type="email" required className={input} />
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                Phone
                <input name="phone" className={input} />
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                Headcount
                <input name="headcount" type="number" min="1" className={input} />
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                Interested level
                <select name="tier" className={input}>
                  <option value="">Not sure yet</option>
                  {TIERS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                Preferred time
                <input name="preferredAt" type="datetime-local" className={input} />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="px-9 py-4 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand"
                >
                  Book consultation
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
