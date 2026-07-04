'use client';

import { useState } from 'react';
import {
  Button,
  ButtonLink,
  Card,
  Floaty,
  Magnetic,
  Reveal,
  SectionHeading,
  StatCell,
  Tilt,
} from '@hr/design-system';
import { MODULES, entitlementsForTier, TIERS, type Tier } from '@hr/entitlements';

/** Simulated tenant brand overrides — proves runtime CSS-variable theming. */
const demoThemes: Record<string, Record<string, string>> = {
  Indigo: {},
  Teal: {
    '--brand': '#0D9488',
    '--brand-light': '#5EEAD4',
    '--brand-dark': '#115E59',
    '--brand-50': '#F0FDFA',
    '--brand-100': '#CCFBF1',
    '--brand-600': '#0F766E',
    '--brand-gradient-from': '#5EEAD4',
    '--brand-gradient-via': '#0D9488',
    '--brand-gradient-to': '#0E7490',
  },
  Crimson: {
    '--brand': '#E11D48',
    '--brand-light': '#FDA4AF',
    '--brand-dark': '#9F1239',
    '--brand-50': '#FFF1F2',
    '--brand-100': '#FFE4E6',
    '--brand-600': '#BE123C',
    '--brand-gradient-from': '#FDA4AF',
    '--brand-gradient-via': '#E11D48',
    '--brand-gradient-to': '#7C3AED',
  },
};

export default function Gallery() {
  const [themeName, setThemeName] = useState<keyof typeof demoThemes>('Indigo');
  const [tier, setTier] = useState<Tier>('L1');
  const entitlements = entitlementsForTier(tier);

  return (
    <main style={demoThemes[themeName]} className="bg-ink text-chalk">
      {/* hero */}
      <section className="relative border-b border-line overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 pt-28 pb-16">
          <SectionHeading
            kicker="Design System · Component Gallery"
            title={
              <>
                THE PORTFOLIO LOOK,
                <br />
                <span className="bg-brand-gradient bg-clip-text text-transparent">
                  PRODUCTIZED
                </span>
              </>
            }
            standfirst="Every component reads brand colour from CSS variables — switch the tenant theme below and watch the whole page rebrand without a deploy."
          />
          <Reveal delay={0.24}>
            <div className="flex flex-wrap gap-3 mt-10">
              {Object.keys(demoThemes).map((name) => (
                <button
                  key={name}
                  onClick={() => setThemeName(name)}
                  className={`px-5 py-2.5 font-display tracking-widest uppercase text-sm border transition-colors ${
                    themeName === name
                      ? 'bg-brand text-white border-brand'
                      : 'border-line text-mute-1 hover:border-brand hover:text-brand'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* buttons + fx */}
      <section className="border-b border-line">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-16">
          <Reveal>
            <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-8">
              Buttons · Magnetic hover
            </p>
          </Reveal>
          <div className="flex flex-wrap items-center gap-6">
            <Button>Primary action</Button>
            <Button variant="outline">Outline action</Button>
            <Button variant="ghost">Ghost</Button>
            <Magnetic>
              <span className="font-heading italic text-xl text-mute-1">
                anything can be magnetic
              </span>
            </Magnetic>
          </div>
        </div>
      </section>

      {/* stat strip */}
      <section className="border-b border-line">
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border-x border-line">
          <StatCell value="20" label="Modules in the feature sheet" />
          <StatCell value="5" label="Tiers, L1 through L5" delay={0.08} />
          <StatCell value="1" label="Codebase, always" delay={0.16} />
          <StatCell value="N" label="Dedicated databases — one per company" delay={0.24} />
        </div>
      </section>

      {/* cards: tilt + floaty */}
      <section className="border-b border-line bg-dots-wide">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-16">
          <Reveal>
            <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-8">
              Cards · Tilt &amp; Float
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8">
            <Reveal>
              <Card tilt className="p-8">
                <div className="font-display text-2xl tracking-wide">TILT CARD</div>
                <p className="font-body text-sm text-mute-2 mt-2 leading-relaxed">
                  Cursor-follow 3D at max 6°, spring 160/18 — the portfolio&apos;s
                  signature card feel.
                </p>
              </Card>
            </Reveal>
            <Reveal delay={0.08}>
              <Floaty amp={7} dur={6.5}>
                <Card className="p-8 shadow-brand">
                  <div className="font-display text-2xl tracking-wide">FLOATY CARD</div>
                  <p className="font-body text-sm text-mute-2 mt-2 leading-relaxed">
                    Endless gentle drift. Honors prefers-reduced-motion — renders
                    static when asked.
                  </p>
                </Card>
              </Floaty>
            </Reveal>
            <Reveal delay={0.16}>
              <Card className="p-8">
                <div className="font-display text-2xl tracking-wide">
                  <span className="bg-brand-gradient bg-clip-text text-transparent">
                    TYPE STACK
                  </span>
                </div>
                <p className="font-heading italic text-lg text-mute-1 mt-2">
                  Playfair for editorial voice,
                </p>
                <p className="font-body text-sm text-mute-2 mt-1">
                  DM Sans for the interface, Bebas Neue for display.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* entitlement matrix demo */}
      <section>
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-16">
          <Reveal>
            <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-3">
              Entitlements · Tier matrix (from the feature sheet)
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="font-heading italic text-lg text-mute-1 mb-8 max-w-xl">
              Pick a tier — module availability resolves from data, never from code.
            </p>
          </Reveal>
          <div className="flex gap-3 mb-10">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`px-5 py-2.5 font-display tracking-widest text-sm border transition-colors ${
                  tier === t
                    ? 'bg-brand text-white border-brand'
                    : 'border-line text-mute-1 hover:border-brand hover:text-brand'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
            {MODULES.map((m, i) => {
              const on = entitlements[m.key]?.enabled;
              return (
                <Reveal key={m.key} delay={Math.min(i * 0.03, 0.3)} y={12} className="bg-ink">
                  <div
                    className={`px-6 py-5 h-full transition-colors duration-300 ${
                      on ? 'hover:bg-brand-50' : 'opacity-40'
                    }`}
                  >
                    <div className="font-display text-lg tracking-wide">
                      {m.label.toUpperCase()}
                    </div>
                    <div className={`font-body text-xs mt-1 ${on ? 'text-brand' : 'text-mute-3'}`}>
                      {on ? `Included · ${m.minTier}+` : `Unlocks at ${m.minTier}`}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={0.2}>
            <div className="mt-12">
              <ButtonLink href="/" variant="outline">
                Back to app shell
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
