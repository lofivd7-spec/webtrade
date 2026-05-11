/// <reference path="../vite-env.d.ts" />
export const config = {
  runtime: 'edge',
};

import { handleBannerMarketsRequest } from '../lib/bannerMarketsApiCore';

export default async function handler(request: Request) {
  return handleBannerMarketsRequest(new URL(request.url));
}
