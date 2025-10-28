import { supabase } from "@/integrations/supabase/client";

export interface CapitalAllocation {
  symbol: string;
  allocatedAmount: number;
  allocatedPercent: number;
  quantity: number;
}

class CapitalDistributionService {
  private readonly MAX_ALLOCATION_PER_PAIR = 0.20; // 20% máximo por par
  private readonly SAFETY_RESERVE = 0.10; // 10% de reserva de segurança

  /**
   * Distribui capital entre múltiplos pares
   */
  async distributeCapital(
    userId: string,
    totalCapital: number,
    pairs: string[],
    testMode: boolean
  ): Promise<Map<string, CapitalAllocation>> {
    const allocations = new Map<string, CapitalAllocation>();
    
    if (pairs.length === 0) {
      console.warn("No pairs to allocate capital");
      return allocations;
    }

    // Capital disponível para trading (excluindo reserva de segurança)
    const availableCapital = totalCapital * (1 - this.SAFETY_RESERVE);
    
    // Calcular alocação por par
    const allocationPerPair = Math.min(
      availableCapital / pairs.length,
      totalCapital * this.MAX_ALLOCATION_PER_PAIR
    );

    console.log(`Distributing ${availableCapital.toFixed(2)} USDT among ${pairs.length} pairs`);
    console.log(`Allocation per pair: ${allocationPerPair.toFixed(2)} USDT`);

    // Criar alocações para cada par
    for (const symbol of pairs) {
      try {
        // Buscar preço atual do par
        const { data, error } = await supabase.functions.invoke('binance-get-price', {
          body: { symbol }
        });

        if (error || !data) {
          console.error(`Error fetching price for ${symbol}:`, error);
          continue;
        }

        const price = data.price;
        const quantity = allocationPerPair / price;

        allocations.set(symbol, {
          symbol,
          allocatedAmount: allocationPerPair,
          allocatedPercent: (allocationPerPair / totalCapital) * 100,
          quantity: Number(quantity.toFixed(8)), // 8 casas decimais para cripto
        });

        console.log(`${symbol}: ${allocationPerPair.toFixed(2)} USDT (${quantity.toFixed(8)} units @ $${price.toFixed(2)})`);
      } catch (error) {
        console.error(`Error allocating capital for ${symbol}:`, error);
      }
    }

    return allocations;
  }

  /**
   * Calcula quantidade de compra baseado no capital alocado
   */
  calculateQuantity(allocatedAmount: number, currentPrice: number): number {
    return Number((allocatedAmount / currentPrice).toFixed(8));
  }

  /**
   * Verifica se a alocação está dentro dos limites
   */
  isAllocationValid(allocatedAmount: number, totalCapital: number): boolean {
    const percent = allocatedAmount / totalCapital;
    return percent <= this.MAX_ALLOCATION_PER_PAIR && percent > 0;
  }

  /**
   * Retorna capital total alocado
   */
  getTotalAllocated(allocations: Map<string, CapitalAllocation>): number {
    let total = 0;
    for (const allocation of allocations.values()) {
      total += allocation.allocatedAmount;
    }
    return total;
  }

  /**
   * Retorna capital disponível
   */
  getAvailableCapital(totalCapital: number, allocations: Map<string, CapitalAllocation>): number {
    const allocated = this.getTotalAllocated(allocations);
    return totalCapital - allocated;
  }

  /**
   * Rebalanceia alocações quando pares mudam
   */
  async rebalance(
    userId: string,
    totalCapital: number,
    currentPairs: string[],
    existingAllocations: Map<string, CapitalAllocation>,
    testMode: boolean
  ): Promise<Map<string, CapitalAllocation>> {
    console.log("Rebalancing capital allocations...");
    
    // Liberar capital de pares removidos
    const currentSet = new Set(currentPairs);
    const freedCapital = Array.from(existingAllocations.entries())
      .filter(([symbol]) => !currentSet.has(symbol))
      .reduce((sum, [_, allocation]) => sum + allocation.allocatedAmount, 0);

    // Remover alocações de pares que não estão mais na lista
    for (const symbol of existingAllocations.keys()) {
      if (!currentSet.has(symbol)) {
        existingAllocations.delete(symbol);
      }
    }

    // Distribuir capital livre entre novos pares
    const newPairs = currentPairs.filter(symbol => !existingAllocations.has(symbol));
    
    if (newPairs.length > 0 && freedCapital > 0) {
      const allocationPerNewPair = freedCapital / newPairs.length;
      
      for (const symbol of newPairs) {
        try {
          const { data } = await supabase.functions.invoke('binance-get-price', {
            body: { symbol }
          });

          if (data) {
            const quantity = allocationPerNewPair / data.price;
            existingAllocations.set(symbol, {
              symbol,
              allocatedAmount: allocationPerNewPair,
              allocatedPercent: (allocationPerNewPair / totalCapital) * 100,
              quantity: Number(quantity.toFixed(8)),
            });
          }
        } catch (error) {
          console.error(`Error allocating to new pair ${symbol}:`, error);
        }
      }
    }

    console.log(`Rebalanced: ${existingAllocations.size} pairs, ${freedCapital.toFixed(2)} USDT redistributed`);
    return existingAllocations;
  }
}

export const capitalDistributionService = new CapitalDistributionService();
