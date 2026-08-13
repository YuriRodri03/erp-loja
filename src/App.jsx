import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppProvider, AppContext } from './utils/AppProvider';
import Navbar from './components/Navbar';
import Operacoes from './pages/Operacoes';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import Vendas from './pages/Vendas';
import Clientes from './pages/Clientes';
import Despesas from './pages/Despesas';
import Cobrancas from './pages/Cobrancas';

const RotaProtegidaAdmin = ({ children }) => {
  const { isAdmin } = useContext(AppContext);
  const adminCache = localStorage.getItem('isAdmin') === 'true';
  
  if (!isAdmin && !adminCache) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-x-hidden w-full max-w-full">
      {/* A Navbar fica fixa aqui no topo para aparecer em TODAS as páginas */}
      <Navbar />
      
      <main className="flex-1 w-full max-w-full flex flex-col relative">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/cobrancas" element={<Cobrancas />} />
          
          <Route path="/operacoes" element={
            <RotaProtegidaAdmin>
              <Operacoes />
            </RotaProtegidaAdmin>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;