import type { JSX } from 'react';
import { useExternalState, SessionStorageStore } from '@apostoli/use-external-state';
import { z } from 'zod';

const draftSchema = z.object({
  name: z.string().optional(),
  email: z.string().default(''),
  message: z.string().default(''),
});

type Draft = z.output<typeof draftSchema>;

export function SessionFormDemo(): JSX.Element {
  const draft = useExternalState<typeof draftSchema, Draft>(
    SessionStorageStore<Draft>({ key: 'contact-draft' }),
    draftSchema,
  );
  return (
    <form
      style={{ display: 'grid', gap: 12, padding: 24, maxWidth: 420 }}
      onSubmit={(event) => {
        event.preventDefault();
        alert(`Submitting draft for ${draft.value.email}`);
        draft.setValue({ name: '', email: '', message: '' });
      }}
    >
      <h1>Contact Draft</h1>
      <input
        placeholder="Full name"
        value={draft.value.name}
        onChange={(event) => draft.set.name(event.currentTarget.value)}
      />
      <input
        placeholder="Email"
        value={draft.value.email}
        onChange={(event) => draft.set.email(event.currentTarget.value)}
      />
      <textarea
        rows={4}
        placeholder="Message"
        value={draft.value.message}
        onChange={(event) => draft.set.message(event.currentTarget.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit">Send</button>
        <button
          type="button"
          onClick={() =>
            draft.merge?.({ message: '' }) ??
            draft.setValue((current) => ({ ...current, message: '' }))
          }
        >
          Clear message
        </button>
      </div>
    </form>
  );
}

export default SessionFormDemo;
