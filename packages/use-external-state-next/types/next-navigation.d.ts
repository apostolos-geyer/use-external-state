declare module 'next/navigation' {
  export type NavigationOptions = {
    scroll?: boolean;
  };

  export interface AppRouterInstance {
    push(href: string, options?: NavigationOptions): void;
    replace(href: string, options?: NavigationOptions): void;
  }

  export class ReadonlyURLSearchParams extends URLSearchParams {
    toString(): string;
  }

  export function usePathname(): string;
  export function useRouter(): AppRouterInstance;
  export function useSearchParams(): ReadonlyURLSearchParams;
}
