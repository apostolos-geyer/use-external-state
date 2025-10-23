import type { JSX } from 'react';
import { useExternalState, LocalStorageStore } from '@1apostoli/use-external-state';
import { z } from 'zod';

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  compact: z.boolean().default(false),
  name: z.string().default('some title'),
});

type Preferences = z.output<typeof preferencesSchema>;

export function LocalStoragePreferencesDemo(): JSX.Element {
  const prefs = useExternalState<typeof preferencesSchema, Preferences>(
    LocalStorageStore<Preferences>({ key: 'preferences' }),
    preferencesSchema,
  );
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, display: 'grid', gap: 16 }}>
      <h1>Preferences</h1>
      <input
        value={prefs.value.name}
        onChange={(e) => prefs.set.name(e.currentTarget.value)}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Theme</span>
        <select
          value={prefs.value.theme}
          onChange={(event) =>
            prefs.set.theme(event.target.value as Preferences['theme'])
          }
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={prefs.value.compact}
          onChange={(event) => prefs.set.compact(event.target.checked)}
        />
        <span>Compact layout</span>
      </label>
      <button
        type="button"
        onClick={() =>
          prefs.merge?.({ theme: 'light', compact: false }) ??
          prefs.setValue(() => ({ theme: 'light', compact: false, name: '' }))
        }
        style={{ width: 'fit-content' }}
      >
        Reset
      </button>
    </div>
  );
}

export default LocalStoragePreferencesDemo;
