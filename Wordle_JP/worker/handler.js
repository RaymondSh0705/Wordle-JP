import { createRoundApi } from '../server/round-core.js';

export function createWorker(dictionary, fetchImpl = fetch) {
  const roundApi = createRoundApi({ getDictionary: () => dictionary, fetchImpl });
  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        return roundApi(request);
      }
      return env.ASSETS.fetch(request);
    },
  };
}
