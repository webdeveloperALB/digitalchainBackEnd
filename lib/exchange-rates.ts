// Real-time exchange rate service
export interface ExchangeRates {
  fiat: { [key: string]: number }
  crypto: { [key: string]: number }
  lastUpdated: number
}

export class ExchangeRateService {
  private static instance: ExchangeRateService
  private rates: ExchangeRates = { fiat: {}, crypto: {}, lastUpdated: 0 }
  private updateInterval: NodeJS.Timeout | null = null
  private listeners: ((rates: ExchangeRates) => void)[] = []

  static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService()
    }
    return ExchangeRateService.instance
  }

  async initialize() {
    await this.updateRates()
    this.startAutoUpdate()
  }

  private async updateRates() {
    try {
      // Fetch fiat exchange rates (using ExchangeRate-API - free tier)
      const fiatResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const fiatData = await fiatResponse.json()
      
      // Fetch crypto prices (using CoinGecko API - free)
      const cryptoResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano,polkadot,chainlink&vs_currencies=usd'
      )
      const cryptoData = await cryptoResponse.json()

      this.rates = {
        fiat: {
          USD: 1,
          EUR: 1 / fiatData.rates.EUR,
          CAD: 1 / fiatData.rates.CAD,
          GBP: 1 / fiatData.rates.GBP,
          JPY: 1 / fiatData.rates.JPY,
          AUD: 1 / fiatData.rates.AUD,
          CHF: 1 / fiatData.rates.CHF,
          ...fiatData.rates
        },
        crypto: {
          BTC: cryptoData.bitcoin?.usd || 50000,
          ETH: cryptoData.ethereum?.usd || 3000,
          ADA: cryptoData.cardano?.usd || 0.5,
          DOT: cryptoData.polkadot?.usd || 7,
          LINK: cryptoData.chainlink?.usd || 15,
        },
        lastUpdated: Date.now()
      }

      // Notify all listeners
      this.listeners.forEach(listener => listener(this.rates))
      
      console.log('Exchange rates updated:', new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Failed to update exchange rates:', error)
    }
  }

  private startAutoUpdate() {
    // Update every 30 seconds for real-time rates
    this.updateInterval = setInterval(() => {
      this.updateRates()
    }, 30000)
  }

  subscribe(listener: (rates: ExchangeRates) => void) {
    this.listeners.push(listener)
    // Immediately call with current rates
    if (this.rates.lastUpdated > 0) {
      listener(this.rates)
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getRates(): ExchangeRates {
    return this.rates
  }

  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount

    const fromUpper = fromCurrency.toUpperCase()
    const toUpper = toCurrency.toUpperCase()

    // Get USD value first
    let usdValue = amount

    // Convert from source currency to USD
    if (fromUpper !== 'USD') {
      if (this.rates.fiat[fromUpper]) {
        usdValue = amount / this.rates.fiat[fromUpper]
      } else if (this.rates.crypto[fromUpper]) {
        usdValue = amount * this.rates.crypto[fromUpper]
      }
    }

    // Convert from USD to target currency
    if (toUpper === 'USD') {
      return usdValue
    } else if (this.rates.fiat[toUpper]) {
      return usdValue * this.rates.fiat[toUpper]
    } else if (this.rates.crypto[toUpper]) {
      return usdValue / this.rates.crypto[toUpper]
    }

    return amount // Fallback
  }

  getExchangeRate(fromCurrency: string, toCurrency: string): number {
    return this.convertCurrency(1, fromCurrency, toCurrency)
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
    this.listeners = []
  }
}
