import { NextResponse, type NextRequest } from 'next/server';
import { cp } from '../../../lib/cp';
import { getScheduler } from '../../../lib/scheduler';

const TIERS = ['L1', 'L2', 'L3', 'L4', 'L5'];

/** Lead capture: books via the scheduler adapter, writes a prospect row. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const company = String(form.get('company') ?? '').trim();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim() || null;
  const headcountRaw = Number(form.get('headcount'));
  const headcount = Number.isFinite(headcountRaw) && headcountRaw > 0 ? Math.floor(headcountRaw) : null;
  const tierRaw = String(form.get('tier') ?? '');
  const tier = TIERS.includes(tierRaw) ? tierRaw : null;
  const preferredAt = String(form.get('preferredAt') ?? '').trim() || undefined;

  if (!company || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'company, name and a valid email are required' }, { status: 400 });
  }

  const booking = await getScheduler().book({ name, email, company, preferredAt });

  const sql = cp();
  const [row] = await sql<{ id: string }[]>`
    insert into prospects (company_name, contact_name, email, phone, headcount,
                           interested_tier, consultation_at, scheduler_ref)
    values (${company}, ${name}, ${email}, ${phone}, ${headcount},
            ${tier}, ${booking.scheduledAt}, ${booking.ref})
    returning id`;

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/book?booked=${booking.ref}`, request.url), 303);
  }
  return NextResponse.json({ prospectId: row!.id, ref: booking.ref }, { status: 201 });
}
