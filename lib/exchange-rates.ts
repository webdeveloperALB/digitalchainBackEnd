// lib/exchange-rates.ts

export interface ExchangeRates {
  fiat: { [key: string]: number };
  crypto: { [key: string]: number };
  lastUpdated: number;
}

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private rates: ExchangeRates = { fiat: {}, crypto: {}, lastUpdated: 0 };
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: ((rates: ExchangeRates) => void)[] = [];

  static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  async initialize() {
    await this.updateRates();
    this.startAutoUpdate();
  }

  private async updateRates() {
    try {
      let fiatData: any = {};
      let cryptoData: any = {};

      // --- Fetch fiat exchange rates ---
      try {
        console.log("Fetching fiat rates...");
        const fiatResponse = await fetch(
          "https://api.exchangerate.host/latest?base=USD"
        );

        if (!fiatResponse.ok) {
          throw new Error(
            `ExchangeRate.host error: ${fiatResponse.status} ${fiatResponse.statusText}`
          );
        }

        fiatData = await fiatResponse.json();
        console.log("Fiat rates fetched successfully");
      } catch (fiatError: any) {
        console.error(
          "Failed to fetch fiat exchange rates:",
          fiatError.message || fiatError
        );
      }

      // --- Fetch crypto prices ---
      try {
        console.log("Fetching crypto rates...");
        const cryptoResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano,polkadot,chainlink&vs_currencies=usd"
        );

        if (!cryptoResponse.ok) {
          throw new Error(
            `CoinGecko API error: ${cryptoResponse.status} ${cryptoResponse.statusText}`
          );
        }

        cryptoData = await cryptoResponse.json();
        console.log("Crypto rates fetched successfully");
      } catch (cryptoError: any) {
        console.error(
          "Failed to fetch crypto prices:",
          cryptoError.message || cryptoError
        );
      }

      // Set rates only if at least one source worked
      if (Object.keys(fiatData).length || Object.keys(cryptoData).length) {
        this.rates = {
          fiat: {
            USD: 1,
            EUR: 1 / (fiatData.rates?.EUR || 1),
            CAD: 1 / (fiatData.rates?.CAD || 1),
            GBP: 1 / (fiatData.rates?.GBP || 1),
            JPY: 1 / (fiatData.rates?.JPY || 1),
            AUD: 1 / (fiatData.rates?.AUD || 1),
            CHF: 1 / (fiatData.rates?.CHF || 1),
            ...fiatData.rates,
          },
          crypto: {
            BTC: cryptoData.bitcoin?.usd || 50000,
            ETH: cryptoData.ethereum?.usd || 3000,
            ADA: cryptoData.cardano?.usd || 0.5,
            DOT: cryptoData.polkadot?.usd || 7,
            LINK: cryptoData.chainlink?.usd || 15,
          },
          lastUpdated: Date.now(),
        };

        this.listeners.forEach((listener) => listener(this.rates));
        console.log(
          "Exchange rates updated at",
          new Date().toLocaleTimeString()
        );
      } else {
        console.warn("No rates updated: both fiat and crypto fetch failed");
      }
    } catch (error: any) {
      console.error("Failed to update exchange rates:", {
        message: error.message,
        stack: error.stack,
        fullError: error,
      });
    }
  }

  private startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.updateRates();
    }, 30000); // every 30 seconds
  }

  subscribe(listener: (rates: ExchangeRates) => void) {
    this.listeners.push(listener);
    if (this.rates.lastUpdated > 0) {
      listener(this.rates);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getRates(): ExchangeRates {
    return this.rates;
  }

  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number {
    if (fromCurrency === toCurrency) return amount;

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    let usdValue = amount;

    if (from !== "USD") {
      if (this.rates.fiat[from]) {
        usdValue = amount / this.rates.fiat[from];
      } else if (this.rates.crypto[from]) {
        usdValue = amount * this.rates.crypto[from];
      }
    }

    if (to === "USD") {
      return usdValue;
    } else if (this.rates.fiat[to]) {
      return usdValue * this.rates.fiat[to];
    } else if (this.rates.crypto[to]) {
      return usdValue / this.rates.crypto[to];
    }

    return amount; // fallback
  }

  getExchangeRate(fromCurrency: string, toCurrency: string): number {
    return this.convertCurrency(1, fromCurrency, toCurrency);
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.listeners = [];
  }
}
