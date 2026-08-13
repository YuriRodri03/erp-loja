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
    nomeLoja, setNomeLoja,
    isAdmin, setIsAdmin 
  } = useContext(AppContext);

  const [inputNomeLoja, setInputNomeLoja] = useState('');
  const [criandoPlanilha, setCriandoPlanilha] = useState(false);
  const [buscandoNoDrive, setBuscandoNoDrive] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false); 

  const fazerLogin = useGoogleLogin({
    onSuccess: async (resposta) => {
      const token = resposta.access_token;
      
      try {
        const resGoogle = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const dadosGoogle = await resGoogle.json();
        const emailUsuario = dadosGoogle.email;

        const resBackend = await fetch('http://localhost:3001/api/auth/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario })
        });
        const dadosConta = await resBackend.json();

        // 🎉 ALERTA DE 30 DIAS GRÁTIS - Aparece primeiro, antes de qualquer navegação
        if (dadosConta.mensagem === 'Teste de 30 dias iniciado!') {
            alert("Parabéns! O seu teste grátis de 30 dias começou agora. Crie sua base de dados a seguir e aproveite o sistema completo!");
        }

        localStorage.setItem('tokenGoogle', token);
        if (dadosConta.is_admin) {
            localStorage.setItem('isAdmin', 'true');
            setIsAdmin(true);
        } else {
            localStorage.setItem('isAdmin', 'false');
            setIsAdmin(false);
        }

        // Se estiver inativo, vai pra home exibir o Modal de Pagamento
        if (dadosConta.status_pagamento === 'inativo') {
            navigate('/');
            return; 
        }

        // Se chegou aqui, ele tá ativo (seja dono, assinante antigo, ou nos 30 dias)
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

        // Atualiza a barrinha lá em cima
        setTokenGoogle(token);
        
        // Direciona pro lugar certo
        if (dadosConta.is_admin) {
            navigate('/operacoes', { replace: true });
        } else {
            navigate('/dashboard', { replace: true });
        }

      } catch (erro) {
        console.error("Erro no login pela Navbar:", erro);
      }
    },
    onError: (erro) => console.log('Erro no Login:', erro),
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email'
  });

  const handleLogout = () => {
    googleLogout();
    setTokenGoogle(null);
    setIdPlanilha(null);
    setNomeLoja('Minha Loja'); 
    localStorage.removeItem('tokenGoogle');
    localStorage.removeItem('idPlanilha');
    localStorage.removeItem('nomeLoja');
    localStorage.removeItem('isAdmin'); 
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
      ? `${baseClasses} bg-blue-600 text-white shadow-md shadow-blue-500/20`
      : `${baseClasses} text-gray-400 hover:bg-gray-800 hover:text-white`;
  };

  const classesLinkMobileAtivo = (caminho) => {
    const baseClasses = "block px-4 py-3 rounded-xl text-base font-bold transition-colors";
    return location.pathname === caminho
      ? `${baseClasses} bg-blue-600 text-white shadow-md`
      : `${baseClasses} text-gray-400 hover:bg-gray-800 hover:text-white`;
  };

  const fecharMenuMobile = () => setMenuMobileAberto(false);

  const mostrarModalConfiguracao = tokenGoogle && !idPlanilha && !buscandoNoDrive && !isAdmin;

  return (
    <>
      <nav className="bg-gray-900/95 backdrop-blur-md border-b border-gray-800/50 shadow-sm fixed top-0 left-0 z-50 w-full transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            <div className="flex-shrink-0 flex items-center">
              <span className="text-white text-lg sm:text-xl xl:text-2xl font-black tracking-tight flex items-center gap-2 sm:gap-3 truncate max-w-[200px] sm:max-w-none">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-inner flex-shrink-0 flex items-center justify-center">
                   <span className="text-xl leading-none">🛒</span> 
                </div>
                <span className="truncate">{!tokenGoogle ? 'Giro - Sistema de Gestão' : (buscandoNoDrive ? 'Sincronizando...' : nomeLoja)}</span>
              </span>
            </div>

            <div className="hidden lg:block">
              <div className="flex items-center space-x-1 xl:space-x-2">
                {tokenGoogle ? (
                  <>
                    <Link to="/dashboard" className={classesLinkAtivo('/dashboard')}>Dashboard</Link>
                    <Link to="/estoque" className={classesLinkAtivo('/estoque')}>Estoque</Link>
                    <Link to="/vendas" className={classesLinkAtivo('/vendas')}>Vendas</Link>
                    <Link to="/despesas" className={classesLinkAtivo('/despesas')}>Despesas</Link>
                    <Link to="/clientes" className={classesLinkAtivo('/clientes')}>Clientes</Link>
                    <Link to="/cobrancas" className={classesLinkAtivo('/cobrancas')}>Cobranças</Link>
                    
                    {isAdmin && (
                       <Link to="/operacoes" className={classesLinkAtivo('/operacoes')}>⚙️ Operações</Link>
                    )}
                    
                    <div className="flex items-center space-x-3 ml-2 xl:ml-4 pl-4 xl:pl-6 border-l border-gray-800/80 h-8">
                      <div className="px-3 py-1.5 bg-gray-800/50 text-green-400 border border-gray-700/50 text-xs font-bold rounded-lg cursor-default flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
                        <span className="hidden xl:inline">Conectado</span>
                      </div>
                      <button 
                        onClick={handleLogout}
                        className="px-4 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm font-bold rounded-xl transition-all flex items-center"
                      >
                        Sair
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => fazerLogin()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5">
                    Entrar com Google
                  </button>
                )}
              </div>
            </div>

            <div className="lg:hidden flex items-center">
              {tokenGoogle ? (
                <button 
                  onClick={() => setMenuMobileAberto(!menuMobileAberto)}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-colors focus:outline-none"
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

        {menuMobileAberto && tokenGoogle && (
          <div className="lg:hidden bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 absolute w-full shadow-2xl rounded-b-3xl animate-fade-in-down max-h-[85vh] overflow-y-auto">
            <div className="px-4 pt-4 pb-6 space-y-1.5">
              <Link to="/dashboard" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/dashboard')}>📊 Dashboard</Link>
              <Link to="/estoque" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/estoque')}>📦 Estoque</Link>
              <Link to="/vendas" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/vendas')}>🛒 Vendas</Link>
              <Link to="/clientes" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/clientes')}>👥 Clientes</Link>
              <Link to="/despesas" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/despesas')}>💸 Despesas</Link>
              <Link to="/cobrancas" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/cobrancas')}>📢 Cobranças</Link>
              
              {isAdmin && (
                 <Link to="/operacoes" onClick={fecharMenuMobile} className={classesLinkMobileAtivo('/operacoes')}>⚙️ Controle de Operações</Link>
              )}
            </div>
            <div className="p-5 border-t border-gray-800 bg-gray-900 rounded-b-3xl">
              <div className="flex flex-col gap-3">
                <span className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800/80 text-green-400 border border-gray-700/50 text-sm font-bold rounded-xl w-full">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
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

      <div className="h-20 w-full opacity-0 pointer-events-none"></div>

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