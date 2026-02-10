import { botConfigService } from "./botService";
import { binanceService } from "./binanceService";

export interface ConnectivityResult {
  ok: boolean;
  symbol: string;
  error?: string;
}

export const statusService = {
  // Verifica conectividade com a Binance testando a função de preço
  async checkBinanceConnectivity(userId: string): Promise<ConnectivityResult> {
    try {
      const config = await botConfigService.getConfig(userId);
      const symbol = config?.trading_pair || "BTCUSDT";

      const priceData = await binanceService.getPrice(symbol);
      const ok = !!priceData && typeof priceData.price === "number" && priceData.price > 0;

      return { ok, symbol };
    } catch (e) {
      console.error("Erro ao verificar conectividade com a Binance:", e);
      return { ok: false, symbol: "BTCUSDT", error: String(e) };
    }
  },
};
