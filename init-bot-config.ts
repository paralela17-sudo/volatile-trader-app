import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function initBotConfig() {
    console.log('🚀 Inicializando configuração do bot para Paper Trading...\n');

    const userId = '00000000-0000-0000-0000-000000000000';

    // Verificar se já existe uma configuração
    const { data: existing, error: fetchErr } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

    if (fetchErr) {
        console.error('❌ Erro ao buscar config:', fetchErr);
        return;
    }

    if (existing && existing.length > 0) {
        console.log('✅ Configuração já existe:', existing[0].id);
        console.log('📊 Estado atual:');
        console.log('  - is_powered_on:', existing[0].is_powered_on);
        console.log('  - is_running:', existing[0].is_running);
        console.log('  - test_mode:', existing[0].test_mode);
        console.log('  - test_balance:', existing[0].test_balance);
        console.log('\n💡 Para ativar Paper Trading, use o Dashboard para LIGAR o bot.\n');
        return;
    }

    // Criar configuração inicial para Paper Trading
    const config = {
        user_id: userId,
        is_powered_on: false, // Usuário liga manualmente via Dashboard
        is_running: false,
        test_mode: true, // MODO TESTE - Paper Trading
        test_balance: 1000, // $1000 virtual para simular
        quantity: 100,
        take_profit_percent: 5.0,
        stop_loss_percent: 2.5,
        daily_profit_goal: 50,
        trading_pair: 'BTCUSDT',
    };

    const { data, error } = await supabase
        .from('bot_configs')
        .insert([config])
        .select();

    if (error) {
        console.error('❌ Erro ao criar config:', error);
        return;
    }

    console.log('✅ Configuração criada com sucesso!');
    console.log('📋 Config ID:', data[0].id);
    console.log('\n🎯 PAPER TRADING CONFIGURADO:');
    console.log('  ✅ Modo Teste: ATIVO (sem gastar dinheiro real)');
    console.log('  ✅ Saldo Virtual: $1000.00');
    console.log('  ✅ Bot analisa dados REAIS da Binance');
    console.log('  ✅ Executa trades SIMULADAS');
    console.log('  ✅ Mostra P/L REALISTA no Dashboard');
    console.log('\n🚀 PRÓXIMO PASSO: Abra o Dashboard e clique em "LIGAR BOT"\n');
}

initBotConfig();
