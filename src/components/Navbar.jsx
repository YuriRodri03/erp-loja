import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { useContext, useState } from 'react';

import { AppContext } from '../utils/AppProvider';
import { criarPlanilhaBase, buscarPlanilhaExistente } from '../services/googleSheets';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate(); 
  
  const { 
    tokenGoogle, setTokenGoogle, 
    idPlanilha, setIdPlanilha,
    nomeLoja, setNomeLoja
  } = useContext(AppContext);

  const [inputNomeLoja, setInputNomeLoja] = useState('');
  const [criandoPlanilha, setCriandoPlanilha] = useState(false);
  const [buscandoNoDrive, setBuscandoNoDrive] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false); 

  const fazerLogin = useGoogleLogin({
    onSuccess: async (resposta) => {
      const token = resposta.access_token;
      
      setTokenGoogle(token);
      localStorage.setItem('tokenGoogle', token);
      
      let planilhaAtual = localStorage.getItem('idPlanilha');
      
      if (!planilhaAtual) {
        setBuscandoNoDrive(true);
        const planilhaEncontrada = await buscarPlanilhaExistente(token);
        
        if (planilhaEncontrada) {
          setIdPlanilha(planilhaEncontrada.id);
          localStorage.setItem('idPlanilha', planilhaEncontrada.id);
          
          const nomeExtraido = planilhaEncontrada.name.replace('Base de Dados - ', '');
          setNomeLoja(nomeExtraido);
          localStorage.setItem('nomeLoja', nomeExtraido);
        }
        setBuscandoNoDrive(false);
      }
    },
    onError: (erro) => console.log('Erro no Login:', erro),
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'
  });

  const handleLogout = () => {
    googleLogout();
    setTokenGoogle(null);
    setIdPlanilha(null);
    setNomeLoja('Minha Loja'); 
    localStorage.removeItem('tokenGoogle');
    localStorage.removeItem('idPlanilha');
    localStorage.removeItem('nomeLoja');
    setMenuMobileAberto(false);
    navigate('/');
  };

  const handleCriarLoja = async (e) => {
    e.preventDefault();
    if(!inputNomeLoja) return;

    setCriandoPlanilha(true);
    const novoId = await criarPlanilhaBase(tokenGoogle, inputNomeLoja);
    
    if (novoId) {
      setIdPlanilha(novoId);
      localStorage.setItem('idPlanilha', novoId);
      setNomeLoja(inputNomeLoja);
      localStorage.setItem('nomeLoja', inputNomeLoja);
      alert("Sucesso! Banco de Dados criado no seu Drive.");
    }
    setCriandoPlanilha(false);
  };

  const classesLinkAtivo = (caminho) => {
    const baseClasses = "px-3 xl:px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ease-in-out whitespace-nowrap";
    return location.pathname === caminho
      ? `${baseClasses} bg-blue-600 text-white shadow-sm`
      : `${baseClasses} text-gray-300 hover:bg-gray-700 hover:text-white`;
  };

  const classesLinkMobileAtivo = (caminho) => {
    const baseClasses = "block px-4 py-3 rounded-xl text-base font-bold transition-colors";
    return location.pathname === caminho
      ? `${baseClasses} bg-blue-600 text-white shadow-sm`
      : `${baseClasses} text-gray-300 hover:bg-gray-800 hover:text-white`;
  };

  const fecharMenuMobile = () => setMenuMobileAberto(false);

  const mostrarModalConfiguracao = tokenGoogle && !idPlanilha && !buscandoNoDrive;

  return (
    <>
      <nav className="bg-gray-900 border-b border-gray-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* LOGO / BRAND */}
            <div className="flex-shrink-0 flex items-center">
              <span className="text-white text-lg sm:text-xl xl:text-2xl font-black tracking-tight flex items-center gap-2 sm:gap-3 truncate max-w-[200px] sm:max-w-none">
                <span className="bg-white/10 p-2 rounded-lg flex-shrink-0">🛒</span> 
                <span className="truncate">{!tokenGoogle ? 'Sistema de Gestão' : (buscandoNoDrive ? 'Sincronizando...' : nomeLoja)}</span>
              </span>
            </div>

            {/* MENU DESKTOP */}
            <div className="hidden lg:block">
              <div className="flex items-center space-x-1 xl:space-x-3">
                {tokenGoogle ? (
                  <>
                    <Link to="/dashboard" className={classesLinkAtivo('/dashboard')}>Dashboard</Link>
                    <Link to="/estoque" className={classesLinkAtivo('/estoque')}>Estoque</Link>
                    <Link to="/vendas" className={classesLinkAtivo('/vendas')}>Vendas</Link>
                    <Link to="/despesas" className={classesLinkAtivo('/despesas')}>Despesas</Link>
                    <Link to="/clientes" className={classesLinkAtivo('/clientes')}>Clientes</Link>
                    <Link to="/cobrancas" className={classesLinkAtivo('/cobrancas')}>Cobranças</Link>
                    
                    <div className="flex items-center space-x-3 ml-2 xl:ml-4 pl-4 xl:pl-6 border-l border-gray-700 h-10">
                      <span className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold rounded-lg cursor-default flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                        <span className="hidden xl:inline">Conectado</span>
                      </span>
                      <button 
                        onClick={handleLogout}
                        className="px-4 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm font-bold rounded-xl transition-all flex items-center"
                      >
                        Sair
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => fazerLogin()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all hover:-translate-y-0.5">
                    Entrar com Google
                  </button>
                )}
              </div>
            </div>

            {/* BOTÃO DO MENU MOBILE (Hambúrguer) */}
            <div className="lg:hidden flex items-center">
              {tokenGoogle ? (
                <button 
                  onClick={() => setMenuMobileAberto(!menuMobileAberto)}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors focus:outline-none"
                >
                  <span className="sr-only">Abrir menu principal</span>
                  {!menuMobileAberto ? (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  ) : (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              ) : (
                <button onClick={() => fazerLogin()} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all">
                  Login
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MENU MOBILE EXPANDIDO */}
        {menuMobileAberto && tokenGoogle && (
          <div className="lg:hidden bg-gray-900 border-t border-gray-800 absolute w-full shadow-2xl rounded-b-2xl animate-fade-in-down max-h-[80vh] overflow-y-auto">
            <div className="px-4 pt-4 pb-6 space-y-2">
              <Link to="/dashboard" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/dashboard')}>📊 Dashboard</Link>
              <Link to="/estoque" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/estoque')}>📦 Estoque</Link>
              <Link to="/vendas" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/vendas')}>🛒 Vendas</Link>
              <Link to="/clientes" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/clientes')}>👥 Clientes</Link>
              <Link to="/despesas" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/despesas')}>💸 Despesas</Link>
              <Link to="/cobrancas" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/cobrancas')}>📢 Cobranças</Link>
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-800/50 rounded-b-2xl">
              <div className="flex flex-col gap-3">
                <span className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold rounded-xl w-full">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  Drive Sincronizado
                </span>
                <button onClick={handleLogout} className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-xl transition-colors w-full text-center border border-red-500/20">
                  Desconectar do Sistema
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* MODAL CONFIGURAÇÃO INICIAL */}
      {mostrarModalConfiguracao && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full border border-gray-100 animate-fade-in-down">
            <h2 className="text-3xl font-black mb-3 text-gray-900 tracking-tight">Bem-vindo(a)!</h2>
            <p className="text-gray-500 mb-8 text-base leading-relaxed font-medium">
              Não encontramos um banco de dados ativo. Precisamos criar uma estrutura segura no seu Google Drive. Qual o nome da sua loja?
            </p>

            <form onSubmit={handleCriarLoja}>
              <div className="mb-8">
                <label className="block text-gray-700 font-extrabold mb-3 text-xs uppercase tracking-widest">Nome do Estabelecimento</label>
                <input 
                  type="text"
                  required
                  value={inputNomeLoja}
                  onChange={(e) => setInputNomeLoja(e.target.value)}
                  placeholder="Ex: Adelaide Variedades"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all font-bold text-gray-900 text-lg shadow-inner"
                />
              </div>
              <button 
                type="submit" 
                disabled={criandoPlanilha}
                className={`w-full py-4 px-6 text-white text-lg font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 ${criandoPlanilha ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}
              >
                {criandoPlanilha ? (
                  <><span className="animate-spin text-xl">⏳</span> Estruturando Banco...</>
                ) : 'Criar ERP na Nuvem 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}