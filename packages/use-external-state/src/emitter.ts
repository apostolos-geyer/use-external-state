export interface StoreEmitter {
  subscribe(listener: () => void): () => void;
  emit(): void;
}

export function createStoreEmitter(): StoreEmitter {
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          if (error instanceof Error) {
            console.error('useBrowserState listener threw an error', error);
          } else {
            console.error('useBrowserState listener threw an error', String(error));
          }
        }
      });
    },
  };
}
