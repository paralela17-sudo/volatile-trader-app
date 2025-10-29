import { supabase } from "@/integrations/supabase/client";
import { binanceService } from "./binanceService";
import { tradeService } from "./botService";
import { toast } from "sonner";
import { multiPairService } from "./multiPairService";
import { capitalDistributionService, type CapitalAllocation } from "./capitalDistributionService";
import { momentumStrategyService } from "./momentumStrategyService";
import { RISK_SETTINGS } from "./riskService";

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
  private reinvestInterval: NodeJS.Timeout | null = null;
  private config: TradingConfig | null = null;
  private openPositions: Map<string, Position> = new Map();
  private capitalAllocations: Map<string, CapitalAllocation> = new Map();
  
  // Momentum Trading Strategy Parameters (SSOT via RISK_SETTINGS)
  private readonly PRICE_CHECK_INTERVAL = 3000; // 3 segundos (mais rápido)
  private readonly POSITION_CHECK_INTERVAL = 2000; // 2 segundos (mais rápido)
  private readonly REINVEST_CHECK_INTERVAL = 10000; // 10 segundos
  private readonly MAX_POSITIONS = RISK_SETTINGS.MAX_POSITIONS;

  async start(config: TradingConfig): Promise<void> {
    if (this.isRunning) {
      console.log("Trading already running");
      return;
    }

    this.config = config;
    this.isRunning = true;
    
    console.log("Starting multi-pair automated trading...", config);
    
    // Iniciar serviço de múltiplos pares com os símbolos configurados
    await multiPairService.start(config.symbols);
    
    // Distribuir capital entre os pares
    this.capitalAllocations = await capitalDistributionService.distributeCapital(
      config.userId,
      config.totalCapital,
      config.symbols,
      config.testMode
    );
    
    toast.success(`🚀 Momentum Trading ativado! Usando 20% do capital em ${config.symbols.length} pares.`);

    // Load existing open positions
    await this.loadOpenPositions();

    // Start monitoring market and positions
    this.startMarketMonitoring();
    this.startPositionMonitoring();
    
    // Start auto-reinvestment monitoring
    if (RISK_SETTINGS.AUTO_REINVEST) {
      this.startReinvestmentMonitoring();
    }
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

    if (this.reinvestInterval) {
      clearInterval(this.reinvestInterval);
      this.reinvestInterval = null;
    }

    // Parar serviço de múltiplos pares
    multiPairService.stop();

    console.log("Stopped Momentum Trading");
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
    // Executa imediatamente para começar a acumular histórico e avaliar na largada
    (async () => {
      try {
        await this.analyzeMarketAndTrade();
      } catch (error) {
        console.error("Error in initial market analysis:", error);
      }
    })();

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

        // Buscar dados de mercado (incluindo volume)
        const marketData = await binanceService.getMarketData(symbol);
        const volume = marketData?.volume;

        // Adicionar preço e volume ao histórico do multi-pair service
        multiPairService.addPrice(symbol, priceData.price, volume);

        // Obter dados do par
        const pairMonitor = multiPairService.getPair(symbol);
        if (!pairMonitor || pairMonitor.lastPrices.length < 5) {
          // Aguardar histórico mínimo para análise (5 ticks)
          continue;
        }

        // Verificar se já temos posição aberta neste par
        const hasOpenPosition = Array.from(this.openPositions.values())
          .some(pos => pos.symbol === symbol);
        
        if (hasOpenPosition) continue;

        // === MOMENTUM TRADING STRATEGY ===
        // Analisar momentum do par (com volumes se disponíveis)
        const volumes = pairMonitor.lastVolumes.length > 0 ? pairMonitor.lastVolumes : undefined;
        const momentum = momentumStrategyService.analyzeMomentum(pairMonitor.lastPrices, volumes);
        const signal = momentumStrategyService.generateBuySignal(symbol, momentum);

        console.log(`📈 ${symbol} | Preço: $${priceData.price.toFixed(2)} | Mudança: ${momentum.priceChangePercent.toFixed(2)}% | Tendência: ${momentum.trend} | Confiança: ${(signal.confidence * 100).toFixed(0)}%`);

        // Verificar sinal de compra do momentum
        if (signal.shouldBuy && this.openPositions.size < maxPositions) {
          const allocation = this.capitalAllocations.get(symbol);
          if (allocation) {
            console.log(`🎯 Sinal de compra: ${signal.reason}`);
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

      // Obter momentum atual para decisão de hold
      const pairMonitor = multiPairService.getPair(position.symbol);
      if (pairMonitor && pairMonitor.lastPrices.length >= 10) {
        const momentum = momentumStrategyService.analyzeMomentum(pairMonitor.lastPrices);
        
        console.log(`📊 ${position.symbol} | Compra: $${position.buyPrice.toFixed(2)} | Atual: $${currentPrice.price.toFixed(2)} | P/L: ${profitPercent.toFixed(2)}% | Tendência: ${momentum.trend}`);

        // Check take profit (Momentum: 2.5%)
        if (profitPercent >= RISK_SETTINGS.TAKE_PROFIT_PERCENT) {
          console.log(`✅ Take profit atingido: ${profitPercent.toFixed(2)}%`);
          await this.executeSell(position, currentPrice.price, "TAKE_PROFIT");
          continue;
        }

        // Check stop loss (Momentum: 1.5%)
        if (profitPercent <= -RISK_SETTINGS.STOP_LOSS_PERCENT) {
          console.log(`🛑 Stop loss atingido: ${profitPercent.toFixed(2)}%`);
          await this.executeSell(position, currentPrice.price, "STOP_LOSS");
          continue;
        }

        // Saída por reversão de momentum (proteção adicional)
        if (profitPercent > 0 && momentum.trend === 'BEARISH') {
          console.log(`⚠️ Reversão de momentum detectada, realizando lucro`);
          await this.executeSell(position, currentPrice.price, "MOMENTUM_REVERSAL");
          continue;
        }
      }
    }
  }

  /**
   * Monitora capital liberado e reinveste automaticamente
   */
  private startReinvestmentMonitoring(): void {
    this.reinvestInterval = setInterval(async () => {
      if (!this.isRunning || !this.config) return;

      try {
        // Se temos menos posições que o máximo, tentar abrir novas
        const maxPositions = this.config.maxPositions || this.MAX_POSITIONS;
        if (this.openPositions.size < maxPositions) {
          console.log(`💰 Capital disponível para reinvestimento. Posições abertas: ${this.openPositions.size}/${maxPositions}`);
          // O analyzeMarketAndTrade já vai cuidar de abrir novas posições
        }
      } catch (error) {
        console.error("Error in reinvestment monitoring:", error);
      }
    }, this.REINVEST_CHECK_INTERVAL);
  }

  private async executeBuy(symbol: string, price: number, quantity: number): Promise<void> {
    if (!this.config) return;

    try {
      console.log(`🟢 Executando COMPRA: ${symbol} @ $${price.toFixed(2)} (qty: ${quantity})`);
      
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

        toast.success(`🚀 Compra: ${symbol} @ $${price.toFixed(2)}`);
      }
    } catch (error) {
      console.error("Error executing buy:", error);
      toast.error("Erro ao executar compra");
    }
  }

  private async executeSell(position: Position, price: number, reason: string): Promise<void> {
    if (!this.config) return;

    try {
      const profitPercent = ((price - position.buyPrice) / position.buyPrice) * 100;
      const reasonEmoji = reason === "TAKE_PROFIT" ? "✅" : reason === "STOP_LOSS" ? "🛑" : "⚠️";
      
      console.log(`🔴 Executando VENDA: ${position.symbol} @ $${price.toFixed(2)} | ${reason} (${profitPercent.toFixed(2)}%)`);
      
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

        toast.success(
          `${reasonEmoji} Venda: ${position.symbol} @ $${price.toFixed(2)} | ${profitPercent > 0 ? "Lucro" : "Perda"}: ${profitPercent.toFixed(2)}%`
        );

        // Após venda, capital está disponível para reinvestimento automático
        console.log(`💰 Capital liberado! Posições restantes: ${this.openPositions.size}/${this.MAX_POSITIONS}`);
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
