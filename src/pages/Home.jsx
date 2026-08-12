import { useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../utils/AppProvider';
import { useGoogleLogin } from '@react-oauth/google';
import { buscarPlanilhaExistente } from '../services/googleSheets';

export default function Home() {
  const { tokenGoogle, setTokenGoogle, setIdPlanilha, setNomeLoja } = useContext(AppContext);

  // Estados para o Modal de Termos
  const [mostrarTermos, setMostrarTermos] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);

  // O Hook useGoogleLogin PRECISA ficar antes de qualquer 'return' (Regra do React)
  const fazerLogin = useGoogleLogin({
    onSuccess: async (resposta) => {
      const token = resposta.access_token;
      
      setTokenGoogle(token);
      localStorage.setItem('tokenGoogle', token);
      
      let planilhaAtual = localStorage.getItem('idPlanilha');
      
      if (!planilhaAtual) {
        const planilhaEncontrada = await buscarPlanilhaExistente(token);
        
        if (planilhaEncontrada) {
          setIdPlanilha(planilhaEncontrada.id);
          localStorage.setItem('idPlanilha', planilhaEncontrada.id);
          
          const nomeExtraido = planilhaEncontrada.name.replace('Base de Dados - ', '');
          setNomeLoja(nomeExtraido);
          localStorage.setItem('nomeLoja', nomeExtraido);
        }
      }
    },
    onError: (erro) => console.log('Erro no Login:', erro),
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'
  });

  // Só depois de declarar todos os Hooks, nós fazemos o return antecipado!
  if (tokenGoogle) {
    return <Navigate to="/dashboard" replace />;
  }

  // Função que o botão principal da Home chama primeiro
  const iniciarProcessoDeLogin = () => {
    setMostrarTermos(true);
  };

  const handleAceitarEProsseguir = () => {
    setMostrarTermos(false);
    fazerLogin(); // Chama a janela do Google
  };

  return (
    <div className="relative bg-white overflow-hidden font-sans min-h-[calc(100vh-64px)] flex flex-col items-center justify-center">
      
      {/* Background Decorativo */}
      <div className="absolute inset-y-0 h-full w-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      <div className="absolute top-[-5%] left-[-10%] w-[60%] sm:w-[40%] h-[40%] rounded-full bg-blue-100 blur-[80px] sm:blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-5%] right-[-10%] w-[50%] sm:w-[30%] h-[30%] rounded-full bg-indigo-100 blur-[80px] sm:blur-[100px] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 z-10 w-full">
        <div className="text-center max-w-4xl mx-auto">
          
          <div className="inline-block px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-bold text-xs sm:text-sm tracking-wide mb-6 sm:mb-8 shadow-sm animate-fade-in-down">
            ✨ O seu novo ERP na nuvem
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight mb-4 sm:mb-6 leading-tight animate-fade-in-down" style={{ animationDelay: '100ms' }}>
            A forma mais <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 block sm:inline">inteligente</span> de gerir o seu negócio.
          </h1>
          
          <p className="mt-4 text-base sm:text-lg lg:text-xl text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto animate-fade-in-down font-medium px-2 sm:px-0" style={{ animationDelay: '200ms' }}>
            Controle de estoque, fluxo de caixa avançado e gestão de crediário. Tudo 100% gratuito e salvo diretamente no seu próprio Google Drive.
          </p>

          <div className="flex flex-col items-center gap-3 sm:gap-4 animate-fade-in-down w-full px-4 sm:px-0" style={{ animationDelay: '300ms' }}>
            <button 
              onClick={iniciarProcessoDeLogin}
              className="w-full sm:w-auto px-6 sm:px-8 py-4 bg-gray-900 hover:bg-black text-white font-bold text-base sm:text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5 bg-white rounded-full flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Acessar com o Google
            </button>
            <span className="text-xs sm:text-sm font-bold text-gray-400">Não requer cartão de crédito.</span>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 mt-16 sm:mt-20 lg:mt-24 px-2 sm:px-0">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 sm:hover:shadow-xl sm:hover:border-blue-100 transition-all duration-300 transform sm:hover:-translate-y-2 group">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl sm:text-3xl mb-5 sm:mb-6 shadow-sm group-hover:scale-110 transition-transform">
              📦
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2 sm:mb-3">Estoque Inteligente</h3>
            <p className="text-gray-500 text-sm sm:text-base leading-relaxed font-medium">
              Controle de inventário com alertas de ruptura, cálculo de patrimônio imobilizado e gestão visual do seu portfólio.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 sm:hover:shadow-xl sm:hover:border-green-100 transition-all duration-300 transform sm:hover:-translate-y-2 group">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl sm:text-3xl mb-5 sm:mb-6 shadow-sm group-hover:scale-110 transition-transform">
              📈
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2 sm:mb-3">Dashboard Financeiro</h3>
            <p className="text-gray-500 text-sm sm:text-base leading-relaxed font-medium">
              Acompanhe seu fluxo de caixa diário, mensal e anual com gráficos interativos que revelam o seu Lucro Líquido real.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 sm:hover:shadow-xl sm:hover:border-yellow-100 transition-all duration-300 transform sm:hover:-translate-y-2 group sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center text-2xl sm:text-3xl mb-5 sm:mb-6 shadow-sm group-hover:scale-110 transition-transform">
              📝
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2 sm:mb-3">Motor de Crediário</h3>
            <p className="text-gray-500 text-sm sm:text-base leading-relaxed font-medium">
              Chega de perder dinheiro com fiados soltos. Controle carnês, parcelas, estornos e saiba exatamente quem te deve.
            </p>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL DE TERMOS DE SERVIÇO E PRIVACIDADE */}
      {/* ========================================================================= */}
      {mostrarTermos && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-down border border-gray-100">
            
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-white">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Privacidade & Nuvem</h2>
              <p className="text-gray-500 text-sm sm:text-base font-medium mt-2">
                Como este sistema gerencia os dados da sua loja.
              </p>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto bg-gray-50/50 flex-1 space-y-5 text-sm sm:text-base text-gray-600 font-medium">
              
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base mb-1">Seus dados são 100% seus</h4>
                  <p>Este aplicativo não possui um banco de dados central (servidor). Todas as informações cadastradas (clientes, vendas, estoque) são gravadas <strong>exclusivamente na sua própria conta do Google Drive</strong>, em formato de planilha.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base mb-1">Permissões Solicitadas</h4>
                  <p>Para o sistema funcionar, você precisará autorizar que ele crie e edite planilhas dentro do seu Google Drive. <strong>O sistema não terá acesso a outras fotos, e-mails ou documentos pessoais.</strong></p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base mb-1">Cuidado com Edições Manuais</h4>
                  <p>Uma planilha será criada no seu Google Drive chamada "Base de Dados - Sua Loja". Evite abrir esse arquivo diretamente pelo Excel ou Google Sheets para modificar as linhas, pois isso pode corromper as máscaras financeiras do sistema.</p>
                </div>
              </div>

            </div>

            <div className="p-6 sm:p-8 bg-white border-t border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer group mb-6">
                <div className="relative flex items-start pt-0.5">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={termosAceitos}
                    onChange={(e) => setTermosAceitos(e.target.checked)}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 select-none group-hover:text-gray-900 transition-colors leading-snug">
                  Estou ciente de que meus dados serão armazenados na minha própria conta Google e compreendo as permissões solicitadas.
                </span>
              </label>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
                <button 
                  onClick={() => setMostrarTermos(false)} 
                  className="w-full sm:w-auto px-6 py-3.5 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAceitarEProsseguir} 
                  disabled={!termosAceitos}
                  className={`w-full sm:w-auto px-8 py-3.5 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${termosAceitos ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:-translate-y-0.5' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  Continuar para o Login
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}