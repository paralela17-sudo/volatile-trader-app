import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, AlertCircle, ExternalLink, Key, Database, Settings, Lock } from "lucide-react";

export const AdminPanel = () => {
  const setupSteps = [
    {
      id: 1,
      title: "Chave de Encriptação Configurada",
      description: "BINANCE_ENCRYPTION_KEY adicionado aos secrets",
      status: "complete" as const,
      icon: Lock,
    },
    {
      id: 2,
      title: "Configurar Credenciais da Binance",
      description: "Adicione suas API Key e Secret Key da Binance nas configurações do bot",
      status: "pending" as const,
      icon: Key,
      instructions: [
        "1. Acesse https://www.binance.com/en/my/settings/api-management",
        "2. Crie uma nova API Key (requer autenticação 2FA)",
        "3. Configure as permissões: Enable Spot & Margin Trading",
        "4. IMPORTANTE: Adicione o IP do servidor às whitelist (se aplicável)",
        "5. Copie a API Key e Secret Key",
        "6. Cole as credenciais na aba 'Configurações' do dashboard"
      ]
    },
    {
      id: 3,
      title: "Banco de Dados Configurado",
      description: "Tabelas criadas: trades, bot_logs, price_alerts",
      status: "complete" as const,
      icon: Database,
    },
    {
      id: 4,
      title: "Testar Conexão com Binance",
      description: "Teste a conexão e busca de preços",
      status: "pending" as const,
      icon: Settings,
      instructions: [
        "1. Certifique-se de que as credenciais foram salvas",
        "2. Ative o 'Modo de Teste' no dashboard",
        "3. Clique em 'Iniciar Bot' para testar",
        "4. Verifique os logs para confirmar a conexão",
        "5. O bot deve começar a monitorar preços"
      ]
    }
  ];

  const technicalDetails = {
    backend: {
      tables: [
        { name: "bot_configurations", description: "Armazena configurações do bot por usuário" },
        { name: "trades", description: "Histórico de todas as operações executadas" },
        { name: "bot_logs", description: "Logs de atividades e erros do bot" },
        { name: "price_alerts", description: "Alertas de preço configurados" }
      ],
      edgeFunctions: [
        { name: "binance-get-price", description: "Busca preços em tempo real da Binance (API pública)" },
        { name: "binance-execute-trade", description: "Executa trades na Binance (requer credenciais)" }
      ]
    },
    services: [
      { name: "botService.ts", description: "Gerencia configurações, trades e logs do bot" },
      { name: "binanceService.ts", description: "Interface com APIs da Binance (preços, mercado, WebSocket)" }
    ],
    security: [
      "✅ Encriptação XOR para API Keys (BINANCE_ENCRYPTION_KEY)",
      "✅ Row Level Security (RLS) habilitado em todas as tabelas",
      "✅ Autenticação obrigatória para todas as operações",
      "✅ Modo de teste disponível para simulações sem risco"
    ]
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Painel Administrativo</h2>
        <p className="text-muted-foreground">
          Configure e monitore a integração do bot com a Binance
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Status do Sistema</AlertTitle>
        <AlertDescription>
          O backend está configurado e pronto. Complete os passos abaixo para ativar a integração com a Binance.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Checklist de Configuração</CardTitle>
          <CardDescription>
            Siga estes passos para tornar o bot totalmente funcional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupSteps.map((step, index) => (
            <div key={step.id}>
              {index > 0 && <Separator className="my-4" />}
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {step.status === "complete" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <step.icon className="h-4 w-4" />
                    <h3 className="font-semibold">{step.title}</h3>
                    <Badge variant={step.status === "complete" ? "default" : "secondary"}>
                      {step.status === "complete" ? "Completo" : "Pendente"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  
                  {step.instructions && (
                    <div className="mt-3 space-y-2 rounded-lg bg-muted p-4">
                      <p className="text-sm font-medium">Instruções:</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {step.instructions.map((instruction, idx) => (
                          <li key={idx}>{instruction}</li>
                        ))}
                      </ul>
                      {step.id === 2 && (
                        <Button variant="outline" size="sm" className="mt-2" asChild>
                          <a 
                            href="https://www.binance.com/en/my/settings/api-management" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir Binance API Management
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes Técnicos</CardTitle>
          <CardDescription>
            Arquitetura e componentes implementados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Tabelas do Banco de Dados
            </h3>
            <div className="space-y-2">
              {technicalDetails.backend.tables.map((table) => (
                <div key={table.name} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="font-mono">
                    {table.name}
                  </Badge>
                  <span className="text-muted-foreground">{table.description}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Edge Functions Deployadas</h3>
            <div className="space-y-2">
              {technicalDetails.backend.edgeFunctions.map((func) => (
                <div key={func.name} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="font-mono">
                    {func.name}
                  </Badge>
                  <span className="text-muted-foreground">{func.description}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Serviços Frontend</h3>
            <div className="space-y-2">
              {technicalDetails.services.map((service) => (
                <div key={service.name} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="font-mono">
                    {service.name}
                  </Badge>
                  <span className="text-muted-foreground">{service.description}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Segurança Implementada</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {technicalDetails.security.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Modo de Teste Recomendado</AlertTitle>
        <AlertDescription>
          Antes de usar dinheiro real, teste o bot no modo de simulação. O modo de teste usa preços reais da Binance mas simula as operações localmente, sem executar trades reais.
        </AlertDescription>
      </Alert>
    </div>
  );
};
