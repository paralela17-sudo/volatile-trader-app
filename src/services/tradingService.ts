import { supabase } from "@/integrations/supabase/client";
import { binanceService } from "./binanceService";
import { tradeService } from "./botService";
import { toast } from "sonner";

export interface TradingConfig {
  userId: string;
  configId: string;
  symbol: string;
  quantity: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  testMode: boolean;
}

export interface Position {
  tradeId: string;
  symbol: string;
  buyPrice: number;
  quantity: number;
  timestamp: number;
}

class TradingService {
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private config: TradingConfig | null = null;
  private openPositions: Map<string, Position> = new Map();
  private lastPrices: Map<string, number[]> = new Map();
  private readonly PRICE_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly POSITION_CHECK_INTERVAL = 3000; // 3 seconds
  private readonly PRICE_HISTORY_LENGTH = 20; // Keep last 20 prices
  private readonly BUY_THRESHOLD = -0.5; // Buy when price drops 0.5%
  private readonly MIN_VOLATILITY = 0.1; // Minimum volatility to trade

  async start(config: TradingConfig): Promise<void> {
    if (this.isRunning) {
      console.log("Trading already running");
      return;
    }

    this.config = config;
    this.isRunning = true;
    
    console.log("Starting automated trading...", config);
    toast.success("Trading automático iniciado!");

    // Load existing open positions
    await this.loadOpenPositions();

    // Start monitoring market and positions
    this.startMarketMonitoring();
    this.startPositionMonitoring();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = null;
    }

    console.log("Stopped automated trading");
    toast.info("Trading automático pausado");
  }

  private async loadOpenPositions(): Promise<void> {
    if (!this.config) return;

    try {
      const { data: trades } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", this.config.userId)
        .eq("status", "PENDING")
        .eq("side", "BUY");

      if (trades) {
        trades.forEach((trade) => {
          this.openPositions.set(trade.id, {
            tradeId: trade.id,
            symbol: trade.symbol,
            buyPrice: Number(trade.price),
            quantity: Number(trade.quantity),
            timestamp: new Date(trade.created_at).getTime(),
          });
        });
        console.log(`Loaded ${this.openPositions.size} open positions`);
      }
    } catch (error) {
      console.error("Error loading open positions:", error);
    }
  }

  private startMarketMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning || !this.config) return;

      try {
        await this.analyzeMarketAndTrade();
      } catch (error) {
        console.error("Error in market monitoring:", error);
      }
    }, this.PRICE_CHECK_INTERVAL);
  }

  private startPositionMonitoring(): void {
    this.priceCheckInterval = setInterval(async () => {
      if (!this.isRunning || !this.config) return;

      try {
        await this.checkOpenPositions();
      } catch (error) {
        console.error("Error in position monitoring:", error);
      }
    }, this.POSITION_CHECK_INTERVAL);
  }

  private async analyzeMarketAndTrade(): Promise<void> {
    if (!this.config) return;

    const priceData = await binanceService.getPrice(this.config.symbol);
    if (!priceData) return;

    // Store price history
    const history = this.lastPrices.get(this.config.symbol) || [];
    history.push(priceData.price);
    if (history.length > this.PRICE_HISTORY_LENGTH) {
      history.shift();
    }
    this.lastPrices.set(this.config.symbol, history);

    // Need at least 10 prices for analysis
    if (history.length < 10) return;

    // Calculate volatility and trend
    const volatility = this.calculateVolatility(history);
    const priceChange = this.calculatePriceChangePercent(history);

    console.log(`Market Analysis - Price: ${priceData.price}, Change: ${priceChange.toFixed(2)}%, Volatility: ${volatility.toFixed(2)}%`);

    // Trading logic: Buy on dips in volatile markets
    if (
      volatility >= this.MIN_VOLATILITY &&
      priceChange <= this.BUY_THRESHOLD &&
      this.openPositions.size < 3 // Max 3 simultaneous positions
    ) {
      await this.executeBuy(priceData.price);
    }
  }

  private async checkOpenPositions(): Promise<void> {
    if (!this.config || this.openPositions.size === 0) return;

    for (const [tradeId, position] of this.openPositions.entries()) {
      const currentPrice = await binanceService.getPrice(position.symbol);
      if (!currentPrice) continue;

      const profitPercent = ((currentPrice.price - position.buyPrice) / position.buyPrice) * 100;

      console.log(`Position ${tradeId}: Buy ${position.buyPrice}, Current ${currentPrice.price}, P/L: ${profitPercent.toFixed(2)}%`);

      // Check take profit
      if (profitPercent >= this.config.takeProfitPercent) {
        console.log(`Take profit triggered for ${tradeId}`);
        await this.executeSell(position, currentPrice.price, "TAKE_PROFIT");
        continue;
      }

      // Check stop loss
      if (profitPercent <= -this.config.stopLossPercent) {
        console.log(`Stop loss triggered for ${tradeId}`);
        await this.executeSell(position, currentPrice.price, "STOP_LOSS");
        continue;
      }
    }
  }

  private async executeBuy(price: number): Promise<void> {
    if (!this.config) return;

    try {
      console.log(`Executing BUY: ${this.config.symbol} at ${price}`);
      
      const result = await tradeService.executeTrade(
        this.config.symbol,
        "BUY",
        this.config.quantity,
        this.config.testMode
      );

      if (result && result.trade) {
        this.openPositions.set(result.trade.id, {
          tradeId: result.trade.id,
          symbol: this.config.symbol,
          buyPrice: price,
          quantity: this.config.quantity,
          timestamp: Date.now(),
        });

        toast.success(`Compra executada: ${this.config.symbol} @ $${price.toFixed(2)}`);
      }
    } catch (error) {
      console.error("Error executing buy:", error);
      toast.error("Erro ao executar compra");
    }
  }

  private async executeSell(position: Position, price: number, reason: string): Promise<void> {
    if (!this.config) return;

    try {
      console.log(`Executing SELL: ${position.symbol} at ${price} (${reason})`);
      
      const result = await tradeService.executeTrade(
        position.symbol,
        "SELL",
        position.quantity,
        this.config.testMode
      );

      if (result) {
        // Calculate profit/loss
        const profitLoss = binanceService.calculateProfitLoss(
          position.buyPrice,
          price,
          position.quantity
        );

        // Update the original buy trade with profit/loss
        await supabase
          .from("trades")
          .update({
            status: "EXECUTED",
            profit_loss: profitLoss,
            executed_at: new Date().toISOString(),
          })
          .eq("id", position.tradeId);

        this.openPositions.delete(position.tradeId);

        const profitPercent = ((price - position.buyPrice) / position.buyPrice) * 100;
        toast.success(
          `Venda executada: ${position.symbol} @ $${price.toFixed(2)} | ${profitPercent > 0 ? "Lucro" : "Perda"}: ${Math.abs(profitPercent).toFixed(2)}%`
        );
      }
    } catch (error) {
      console.error("Error executing sell:", error);
      toast.error("Erro ao executar venda");
    }
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;

    return volatility;
  }

  private calculatePriceChangePercent(prices: number[]): number {
    if (prices.length < 2) return 0;
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getOpenPositionsCount(): number {
    return this.openPositions.size;
  }
}

export const tradingService = new TradingService();
