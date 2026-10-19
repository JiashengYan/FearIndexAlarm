"use server";

import { fetchMarket } from "../lib/cnn";

// Fixed public upstream only. No caller-supplied URL, credentials, or user state.
export async function readMarketAction() {
  return fetchMarket();
}
