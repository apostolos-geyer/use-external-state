import { defineConfig } from 'tsup';
import { legacyConfig, modernConfig } from '../../scripts/tsup.config';

const ENTRY_POINTS = ['src/*.ts', 'src/internal/*.ts', 'src/stores/*.ts', 'src/*.tsx'];

export default defineConfig([
  modernConfig({ entry: ENTRY_POINTS }),
  legacyConfig({ entry: ENTRY_POINTS }),
]);
