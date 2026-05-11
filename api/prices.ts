/// <reference path="../vite-env.d.ts" />
export const config = {
  runtime: 'edge',
};

import { handlePricesRequest } from '../lib/pricesApiCore';

export default async function handler(request: Request) {
  return handlePricesRequest(new URL(request.url));
}
