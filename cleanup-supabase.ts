import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupTestData() {
    console.log('🧹 Iniciando limpeza de dados de teste no Supabase...\n');

    try {
        // 1. Verificar trades existentes
        const { data: trades, error: tradesErr } = await supabase
            .from('trades')
            .select('*')
            .order('created_at', { ascending: false });

        if (tradesErr) {
            console.error('❌ Erro ao buscar trades:', tradesErr);
            return;
        }

        console.log(`📊 Total de trades no banco: ${trades?.length || 0}\n`);

        if (trades && trades.length > 0) {
            console.log('🔍 Primeiras 5 trades:');
            trades.slice(0, 5).forEach((t, i) => {
                console.log(`  ${i + 1}. ${t.symbol} - ${t.side} - Status: ${t.status} - P/L: ${t.profit_loss || 'N/A'} - Created: ${new Date(t.created_at).toLocaleString()}`);
            });
            console.log('');
        }

        // 2. Opção: DELETAR TODAS as trades (use com cuidado!)
        const confirmDelete = process.argv.includes('--confirm-delete-all');

        if (confirmDelete) {
            console.log('⚠️  DELETANDO TODAS AS TRADES...');
            const { error: deleteErr } = await supabase
                .from('trades')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except impossible ID

            if (deleteErr) {
                console.error('❌ Erro ao deletar:', deleteErr);
            } else {
                console.log('✅ Todas as trades foram deletadas!\n');
            }
        } else {
            console.log('ℹ️  Para deletar todas as trades, execute:');
            console.log('   npx tsx cleanup-supabase.ts --confirm-delete-all\n');
        }

        // 3. Verificar logs
        const { data: logs, error: logsErr } = await supabase
            .from('bot_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (!logsErr && logs) {
            console.log(`📝 Últimos ${logs.length} logs:`);
            logs.forEach((log, i) => {
                console.log(`  ${i + 1}. [${log.level}] ${log.message?.substring(0, 80)}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

cleanupTestData();
