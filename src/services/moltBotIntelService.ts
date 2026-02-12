import * as fs from 'fs';
import * as path from 'path';
import { RISK_SETTINGS } from './riskService';

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

const isBrowser = typeof window !== 'undefined';

class MoltBotIntelService {
    private intelPath: string | null = null;

    constructor() {
        if (!isBrowser) {
            // Caminho relativo ao MoltBot no projeto pai (Apenas Node/VPS)
            this.intelPath = path.resolve(
                process.cwd(),
                '../../.emergent/defi-arbitrage-intelligence-agent/data/intelligence/latest_intel.json'
            );
        }
    }

    public getLatestIntel(): MoltBotIntel | null {
        if (isBrowser || !this.intelPath) {
            // No navegador, a inteligência via filesystem não está disponível
            return null;
        }

        try {
            if (!fs.existsSync(this.intelPath)) {
                console.warn(`[MoltBot] Relatório não encontrado em: ${this.intelPath}`);
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
