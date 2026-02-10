// Note: Node-only imports removed to support Vite browser builds.
import { RISK_SETTINGS } from './riskService';

const isBrowser = typeof window !== 'undefined';

interface MoltBotIntel {
    networkAnalysis: {
        recommendedPriorityFee: string;
        stableRPC: string;
        cexTriggerThreshold: number;
    };
    strategyUpdates: {
        topRoutes: string[];
        poolLiquidityAlerts: string[];
        competitorBehaviors: string;
    };
    optimizedParameters: {
        slippageMax: number;
        gasMultiplier: number;
    };
    date: string;
}

class MoltBotIntelService {
    private intelPath: string | null = null;

    constructor() {
        if (!isBrowser) {
            const path = require('path');
            // Caminho relativo ao MoltBot no projeto pai
            this.intelPath = path.resolve(
                process.cwd(),
                '../../.emergent/defi-arbitrage-intelligence-agent/data/intelligence/latest_intel.json'
            );
        }
    }

    public getLatestIntel(): MoltBotIntel | null {
        if (isBrowser) return null;

        try {
            const fs = require('fs');
            if (!this.intelPath || !fs.existsSync(this.intelPath)) {
                // Silenced warning in dashboard to avoid spam
                // console.warn(`[MoltBot] Relatório não encontrado em: ${this.intelPath}`);
                return null;
            }

            const content = fs.readFileSync(this.intelPath, 'utf-8');
            return JSON.parse(content) as MoltBotIntel;
        } catch (error) {
            console.error('[MoltBot] Erro ao ler inteligência:', error);
            return null;
        }
    }

    /**
     * Aplica a inteligência do MoltBot aos parâmetros de risco do Volatile Trader
     */
    public applyIntelToRisk(currentParams: any): any {
        const intel = this.getLatestIntel();
        if (!intel) return currentParams;

        console.log(`🧠 [MoltBot] Aplicando Inteligência Gemini de ${new Date(intel.date).toLocaleString()}`);

        // Exemplo de ajuste: Usar o threshold da IA se for mais conservador
        const aiThreshold = intel.networkAnalysis.cexTriggerThreshold * 100; // Converter para %

        return {
            ...currentParams,
            // Se a IA sugere um gatilho maior, nós nos tornamos mais seletivos
            momentumBuyThreshold: Math.max(currentParams.momentumBuyThreshold, aiThreshold),
            // Ajuste de SL/TP baseado na volatilidade sugerida (exemplo conceitual)
            slippageMax: intel.optimizedParameters.slippageMax
        };
    }
}

export const moltBotIntelService = new MoltBotIntelService();
