import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importando o Provedor de Dados (Context API)
import { AppProvider } from './utils/AppProvider';

// Importando os Componentes
import Navbar from './components/Navbar';

// Importando as Páginas
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Vendas from './pages/Vendas';
import Clientes from './pages/Clientes';
import Despesas from './pages/Despesas';
import Cobrancas from './pages/Cobrancas'; // <-- A nova página de cobranças!

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        {/* Contêiner Master: Adicionado overflow-x-hidden e max-w-full para matar o scroll horizontal fantasma */}
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-x-hidden w-full max-w-full">
          
          <Navbar />

          {/* Adicionado max-w-full e relative aqui também */}
          <main className="flex-1 w-full max-w-full flex flex-col relative">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/despesas" element={<Despesas />} />
              <Route path="/cobrancas" element={<Cobrancas />} />
            </Routes>
          </main>

          {/* FOOTER CORPORATIVO (Rodapé) - Adicionado w-full */}
          <footer className="bg-white border-t border-gray-200 mt-auto w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
              <p className="text-sm text-gray-500 font-bold tracking-wide">
                © {new Date().getFullYear()} Sistema de Gestão ERP. Todos os direitos reservados.
              </p>
            </div>
          </footer>

        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;