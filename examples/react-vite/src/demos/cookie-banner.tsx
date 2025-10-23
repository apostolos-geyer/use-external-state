import type { JSX } from 'react';
import { CookieStore, useExternalState } from '@apostoli/use-external-state';
import { z } from 'zod';

const consentSchema = z.object({
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  seenBanner: z.boolean().default(false),
});

type Consent = z.output<typeof consentSchema>;

const consentStore = CookieStore<Consent>({
  name: 'consent',
  attributes: { path: '/', maxAge: 60 * 60 * 24 * 180 },
});

export function CookieBannerDemo(): JSX.Element {
  const consent = useExternalState<typeof consentSchema, Consent>(
    consentStore,
    consentSchema,
    {
      defaultValue: { analytics: false, marketing: false, seenBanner: false },
    },
  );

  if (consent.value.seenBanner) {
    return (
      <p style={{ padding: 24 }}>
        Consent stored. Analytics enabled: {String(consent.value.analytics)}
      </p>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        right: 24,
        padding: 16,
        border: '1px solid #ccc',
        borderRadius: 8,
        background: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        display: 'grid',
        gap: 12,
      }}
    >
      <strong>We use cookies</strong>
      <label style={{ display: 'flex', gap: 8 }}>
        <input
          type="checkbox"
          checked={consent.value.analytics}
          onChange={(event) => consent.set.analytics(event.target.checked)}
        />
        <span>Allow analytics</span>
      </label>
      <label style={{ display: 'flex', gap: 8 }}>
        <input
          type="checkbox"
          checked={consent.value.marketing}
          onChange={(event) => consent.set.marketing(event.target.checked)}
        />
        <span>Allow marketing</span>
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() =>
            consent.setValue((current) => ({ ...current, seenBanner: true }))
          }
        >
          Save
        </button>
        <button
          type="button"
          onClick={() =>
            consent.setValue({
              analytics: false,
              marketing: false,
              seenBanner: true,
            })
          }
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default CookieBannerDemo;
