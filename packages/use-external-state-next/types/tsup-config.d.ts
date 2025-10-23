declare module '../../scripts/tsup.config' {
  import type { Options } from 'tsup';

  export interface ConfigOptions {
    entry: Options['entry'];
  }

  export function modernConfig(options: ConfigOptions): Options;
  export function legacyConfig(options: ConfigOptions): Options;
}
