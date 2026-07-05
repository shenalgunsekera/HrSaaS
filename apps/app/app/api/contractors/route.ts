import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../lib/objects';

const TYPES = ['fixed-term', 'casual', 'gig', 'outsourced', 'retainer'];
const BASES = ['daily', 'piece-rate', 'project', 'hourly'];

/** Register a contractor / gig worker (typed core, classification-checked). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const contractorNumber = String(form.get('contractorNumber') ?? '').trim();
  const fullName = String(form.get('fullName') ?? '').trim();
  const contractorType = String(form.get('contractorType') ?? '');
  const engagementBasis = String(form.get('engagementBasis') ?? '');
  const rate = Number(form.get('rate'));
  const agency = String(form.get('agency') ?? '').trim() || null;
  const contractStart = String(form.get('contractStart') ?? '');
  const contractEnd = String(form.get('contractEnd') ?? '').trim() || null;

  if (
    !contractorNumber || !fullName || !TYPES.includes(contractorType) ||
    !BASES.includes(engagementBasis) || !Number.isFinite(rate) || rate < 0 || !contractStart
  ) {
    return NextResponse.json({ error: 'contractorNumber, fullName, valid type/basis, rate and contractStart required' }, { status: 400 });
  }
  if (contractEnd && contractEnd < contractStart) {
    return NextResponse.json({ error: 'contractEnd before contractStart' }, { status: 400 });
  }

  const result = await withTenantDb(async (db) => {
    const [row] = await db<{ id: string }[]>`
      insert into contractors (contractor_number, full_name, contractor_type, engagement_basis,
                               rate, agency, contract_start, contract_end)
      values (${contractorNumber}, ${fullName}, ${contractorType}, ${engagementBasis},
              ${rate}, ${agency}, ${contractStart}, ${contractEnd})
      on conflict (contractor_number) do nothing
      returning id`;
    if (!row) return { error: 'contractor number already exists' };
    await db`insert into audit_log (action, object_key, record_id)
      values ('contractor.created', 'contractor', ${row.id})`;
    return { id: row.id };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/contractors', request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
