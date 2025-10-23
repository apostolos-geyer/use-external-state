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
          console.error('useExternalState listener threw an error', error);
        }
      });
    },
  };
}
