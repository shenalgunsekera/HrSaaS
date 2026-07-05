import Link from 'next/link';
import { MODULES, TIERS, entitlementsForTier } from '@hr/entitlements';
import { Reveal, SectionHeading } from '@hr/design-system';

/**
 * Pricing — 100% data-driven from the same tier matrix the product enforces
 * (@hr/entitlements, transcribed from the feature sheet), so this page can
 * never drift from reality.
 */
const TIER_PITCH: Record<string, string> = {
  L1: 'The foundation: records, time, leave, statutory payroll, privacy.',
  L2: 'Grow the team: hiring, performance, training, rewards, engagement.',
  L3: 'Build the bench: succession, competency, skills, planning, multi-entity.',
  L4: 'See everything: HR analytics across every module.',
  L5: 'Put it to work: AI assistant and agent orchestration.',
};

export default function Pricing() {
  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <SectionHeading
          kicker="Pricing · Five levels"
          title={
            <>
              START SMALL.
              <br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">
                UNLOCK, NEVER MIGRATE.
              </span>
            </>
          }
          standfirst="Every company runs the full platform on its own dedicated database and domain — upgrading a level simply switches modules on. Downgrading locks them, never deletes."
        />

        <div className="grid md:grid-cols-5 gap-px bg-line border border-line mt-14">
          {TIERS.map((tier, i) => {
            const set = entitlementsForTier(tier);
            const included = MODULES.filter((m) => set[m.key].enabled);
            return (
              <Reveal key={tier} delay={i * 0.08} className="bg-ink">
                <div className="p-6 h-full flex flex-col hover:bg-brand-50 transition-colors duration-300">
                  <div className="font-display text-5xl text-brand">{tier}</div>
                  <p className="font-heading italic text-sm text-mute-1 mt-2 mb-4 leading-relaxed">
                    {TIER_PITCH[tier]}
                  </p>
                  <div className="font-body text-xs text-mute-2 mb-4">
                    {included.length} modules included
                  </div>
                  <ul className="font-body text-xs text-mute-1 space-y-1.5 flex-1">
                    {included.slice(-5).map((m) => (
                      <li key={m.key}>
                        {m.minTier === tier ? <span className="text-brand">+ </span> : '· '}
                        {m.label}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/book"
                    className="mt-6 inline-flex justify-center px-5 py-3 border border-brand text-brand font-display text-sm tracking-widest uppercase hover:bg-brand hover:text-white transition-colors"
                  >
                    Book a consultation
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <div className="border border-line overflow-x-auto mt-14">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  <th className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">Module</th>
                  {TIERS.map((t) => (
                    <th key={t} className="px-4 py-3 font-display text-lg text-chalk text-center">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.key} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                    <td className="px-5 py-3">{m.label}</td>
                    {TIERS.map((t) => (
                      <td key={t} className="px-4 py-3 text-center">
                        {entitlementsForTier(t)[m.key].enabled ? (
                          <span className="text-brand font-semibold">✓</span>
                        ) : (
                          <span className="text-mute-3">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
