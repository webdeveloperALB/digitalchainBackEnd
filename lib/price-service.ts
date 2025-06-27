"use client";

class PriceService {
  private cryptoCache: any = null;
  private exchangeCache: any = null;
  private lastCryptoFetch = 0;
  private lastExchangeFetch = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  async getCryptoPrices() {
    const now = Date.now();

    if (this.cryptoCache && now - this.lastCryptoFetch < this.CACHE_DURATION) {
      return this.cryptoCache;
    }

    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.cryptoCache = data;
      this.lastCryptoFetch = now;

      return data;
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      // Return cached data or fallback
      return (
        this.cryptoCache || {
          bitcoin: { usd: 43250 },
          ethereum: { usd: 2650 },
        }
      );
    }
  }

  async getExchangeRates() {
    const now = Date.now();

    if (
      this.exchangeCache &&
      now - this.lastExchangeFetch < this.CACHE_DURATION
    ) {
      return this.exchangeCache;
    }

    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.exchangeCache = data.rates;
      this.lastExchangeFetch = now;

      return data.rates;
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      // Return cached data or fallback
      return (
        this.exchangeCache || {
          EUR: 1.18,
          CAD: 0.74,
          GBP: 1.27,
        }
      );
    }
  }
}

export const priceService = new PriceService();
