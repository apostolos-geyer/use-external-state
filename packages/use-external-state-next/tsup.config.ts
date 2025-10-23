import { defineConfig } from 'tsup';
import { legacyConfig, modernConfig } from '../../scripts/tsup.config';

const ENTRY_POINTS = ['src/index.ts'];

export default defineConfig([
  modernConfig({ entry: ENTRY_POINTS }),
  legacyConfig({ entry: ENTRY_POINTS }),
]);
