import LocalStoragePreferencesDemo from './demos/local-storage-preferences';
import CookieBannerDemo from './demos/cookie-banner';
import CustomQueryParamsDemo from './demos/custom-query-params';
import SessionFormDemo from './demos/session-form';
import { Fragment, useState } from 'react';

const DEMOS = {
  localStoragePreferences: LocalStoragePreferencesDemo,
  cookieBanner: CookieBannerDemo,
  customQueryParams: CustomQueryParamsDemo,
  sessionForm: SessionFormDemo,
} as const;
type DemoName = keyof typeof DEMOS;
const DEMO_NAMES = Object.keys(DEMOS) as DemoName[];

export function App() {
  const [currentDemo, setCurrentDemo] = useState<DemoName>('localStoragePreferences');
  return (
    <>
      <select
        value={currentDemo}
        onChange={(e) => setCurrentDemo(e.currentTarget.value as DemoName)}
      >
        {DEMO_NAMES.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      {DEMO_NAMES.map((k) => {
        const Component = DEMOS[k];
        return <Fragment key={k}>{currentDemo === k && <Component />}</Fragment>;
      })}
    </>
  );
}

export default App;
