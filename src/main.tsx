import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("🚀 [FLASH BOT] Inicializando aplicação no navegador...");

try {
    const rootElement = document.getElementById("root");
    if (!rootElement) throw new Error("Elemento #root não encontrado no HTML!");

    createRoot(rootElement).render(<App />);
    console.log("✅ [FLASH BOT] Render chamado com sucesso");
} catch (e: any) {
    console.error("❌ [FLASH BOT] Erro fatal na inicialização:", e);
    document.body.innerHTML = `
    <div style="background: white; color: red; padding: 50px; border: 10px solid red; font-family: sans-serif; position: fixed; inset: 0; z-index: 999999;">
      <h1>ERRO FATAL DE CARREGAMENTO</h1>
      <p>O robô falhou ao iniciar no seu navegador.</p>
      <pre style="background: #eee; padding: 20px; border: 1px solid #ccc; overflow: auto;">${e.stack || e.message || e}</pre>
      <button onclick="window.location.reload()" style="padding: 15px 30px; background: red; color: white; border: none; font-weight: bold; cursor: pointer;">TENTAR NOVAMENTE</button>
    </div>
  `;
}
