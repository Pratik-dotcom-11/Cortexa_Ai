import { IVectorStore } from './interfaces/vectorStore.interface.ts';
import { PostgresVectorStore } from './stores/postgresVectorStore.ts';
import { InMemoryVectorStore } from './stores/inMemoryVectorStore.ts';

let defaultStore: IVectorStore | null = null;

export const vectorStoreFactory = {
  getVectorStore(type: 'postgres' | 'memory' = 'postgres'): IVectorStore {
    if (type === 'memory') {
      return new InMemoryVectorStore();
    }

    if (!defaultStore) {
      defaultStore = new PostgresVectorStore();
      defaultStore.init().catch(() => {});
    }

    return defaultStore;
  },

  setVectorStore(store: IVectorStore): void {
    defaultStore = store;
  },
};
