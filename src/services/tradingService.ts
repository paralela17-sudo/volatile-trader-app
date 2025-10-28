import { supabase } from "@/integrations/supabase/client";
import { binanceService } from "./binanceService";
import { tradeService } from "./botService";
import { toast } from "sonner";
import { multiPairService } from "./multiPairService";
import { capitalDistributionService, type CapitalAllocation } from "./capitalDistributionService";

export interface TradingConfig {
  userId: string;
  configId: string;
  symbols: string[]; // Agora suporta múltiplos pares
  totalCapital: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  testMode: boolean;
  maxPositions?: number; // Máximo de posições simultâneas
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
  private capitalAllocations: Map<string, CapitalAllocation> = new Map();
  private readonly PRICE_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly POSITION_CHECK_INTERVAL = 3000; // 3 seconds
  private readonly BUY_THRESHOLD = -0.3; // Buy when price drops 0.3% (mais sensível)
  private readonly MIN_VOLATILITY = 0.08; // Minimum volatility to trade (menos restritivo)
  private readonly MAX_POSITIONS = 5; // Máximo de 5 posições simultâneas

  async start(config: TradingConfig): Promise<void> {
    if (this.isRunning) {
      console.log("Trading already running");
      return;
    }

    this.config = config;
    this.isRunning = true;
    
    console.log("Starting multi-pair automated trading...", config);
    
    // Iniciar serviço de múltiplos pares
    await multiPairService.start();
    
    // Distribuir capital entre os pares
    this.capitalAllocations = await capitalDistributionService.distributeCapital(
      config.userId,
      config.totalCapital,
      config.symbols,
      config.testMode
    );
    
    toast.success(`Trading multi-par iniciado! Monitorando ${config.symbols.length} pares.`);

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

    // Parar serviço de múltiplos pares
    multiPairService.stop();

    console.log("Stopped multi-pair automated trading");
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

    // Verificar se atingimos o limite de posições
    const maxPositions = this.config.maxPositions || this.MAX_POSITIONS;
    if (this.openPositions.size >= maxPositions) {
      return; // Já temos posições suficientes abertas
    }

    // Analisar todos os pares monitorados
    for (const symbol of this.config.symbols) {
      try {
        const priceData = await binanceService.getPrice(symbol);
        if (!priceData) continue;

        // Adicionar preço ao histórico do multi-pair service
        multiPairService.addPrice(symbol, priceData.price);

        // Obter dados do par
        const pairMonitor = multiPairService.getPair(symbol);
        if (!pairMonitor || pairMonitor.lastPrices.length < 10) continue;

        // Verificar se já temos posição aberta neste par
        const hasOpenPosition = Array.from(this.openPositions.values())
          .some(pos => pos.symbol === symbol);
        
        if (hasOpenPosition) continue;

        // Lógica de compra adaptativa baseada em volatilidade
        let buyThreshold = this.BUY_THRESHOLD;
        if (pairMonitor.volatility > 0.5) {
          buyThreshold = -0.4; // Mais conservador em alta volatilidade
        } else {
          buyThreshold = -0.2; // Mais agressivo em baixa volatilidade
        }

        console.log(`${symbol} Analysis - Price: ${priceData.price}, Change: ${pairMonitor.priceChangePercent.toFixed(2)}%, Volatility: ${pairMonitor.volatility.toFixed(2)}%`);

        // Verificar condições de compra
        if (
          pairMonitor.volatility >= this.MIN_VOLATILITY &&
          pairMonitor.priceChangePercent <= buyThreshold &&
          this.openPositions.size < maxPositions
        ) {
          const allocation = this.capitalAllocations.get(symbol);
          if (allocation) {
            await this.executeBuy(symbol, priceData.price, allocation.quantity);
          }
        }
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
      }
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

  private async executeBuy(symbol: string, price: number, quantity: number): Promise<void> {
    if (!this.config) return;

    try {
      console.log(`Executing BUY: ${symbol} at ${price} (quantity: ${quantity})`);
      
      const result = await tradeService.executeTrade(
        symbol,
        "BUY",
        quantity,
        this.config.testMode
      );

      if (result && result.trade) {
        this.openPositions.set(result.trade.id, {
          tradeId: result.trade.id,
          symbol: symbol,
          buyPrice: price,
          quantity: quantity,
          timestamp: Date.now(),
        });

        toast.success(`Compra executada: ${symbol} @ $${price.toFixed(2)}`);
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

  isActive(): boolean {
    return this.isRunning;
  }

  getOpenPositionsCount(): number {
    return this.openPositions.size;
  }

  getWatchedPairsCount(): number {
    return multiPairService.getWatchedPairsCount();
  }

  getCapitalAllocations(): Map<string, CapitalAllocation> {
    return this.capitalAllocations;
  }
}

export const tradingService = new TradingService();
