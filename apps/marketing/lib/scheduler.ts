/**
 * Scheduler adapter (ADR-0007 §3): consultation booking sits behind this
 * interface so the vendor (Cal.com recommended) is swappable without touching
 * business logic. The local adapter just mints a reference — the prospect row
 * in the control plane is the system of record either way.
 */
export interface BookingRequest {
  name: string;
  email: string;
  company: string;
  preferredAt?: string; // ISO datetime the prospect asked for
}

export interface BookingResult {
  ref: string;
  scheduledAt: string | null;
}

export interface SchedulerAdapter {
  book(req: BookingRequest): Promise<BookingResult>;
}

/** Local/dev adapter: no external service; confirms the requested slot. */
export const localScheduler: SchedulerAdapter = {
  async book(req) {
    return {
      ref: `local-${Date.now().toString(36)}`,
      scheduledAt: req.preferredAt ?? null,
    };
  },
};

/** Cal.com adapter lands when credentials exist; same interface. */
export function getScheduler(): SchedulerAdapter {
  return localScheduler;
}
