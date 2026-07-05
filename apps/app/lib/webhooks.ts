import 'server-only';
import { createHmac } from 'node:crypto';
import type postgres from 'postgres';

/**
 * Best-effort webhook dispatch (Integrations module F: Webhook Events).
 * Each active webhook subscribed to the event receives a JSON POST signed
 * with `x-hr-signature: sha256=<hmac(secret, body)>`. Delivery is
 * fire-and-forget with a short timeout; a durable retry queue arrives with
 * the platform hardening phase.
 */
export async function dispatchWebhooks(
  db: ReturnType<typeof postgres>,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const hooks = await db<{ id: string; url: string; secret: string; events: string[] }[]>`
    select id, url, secret, events from webhooks where active = true`;
  const matching = hooks.filter(
    (h) => h.events.length === 0 || h.events.includes(event),
  );
  if (matching.length === 0) return;

  const body = JSON.stringify({ event, at: new Date().toISOString(), data: payload });
  await Promise.allSettled(
    matching.map(async (h) => {
      const signature = createHmac('sha256', h.secret).update(body).digest('hex');
      try {
        await fetch(h.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hr-event': event,
            'x-hr-signature': `sha256=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(4000),
        });
      } catch {
        await db`insert into audit_log (action, object_key, detail)
          values ('webhook.delivery_failed', 'webhook', ${db.json({ id: h.id, event })})`.catch(() => {});
      }
    }),
  );
}
