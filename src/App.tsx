import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

const DebugOverlay = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(`CRASH: ${event.message} @ ${event.filename}:${event.lineno}`);
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (!error) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      zIndex: 99999,
      background: 'white',
      color: 'red',
      padding: '20px',
      border: '5px solid red',
      fontWeight: 'bold',
      fontFamily: 'monospace'
    }}>
      <h2 style={{ margin: 0 }}>ERRO GRAVE DETECTADO NO VERCEL</h2>
      <pre style={{ whiteSpace: 'pre-wrap', color: 'black', background: '#eee', padding: '10px' }}>{error}</pre>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '10px', background: 'red', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        RECARREGAR PÁGINA
      </button>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DebugOverlay />
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
export default App;
