import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../utils/AppProvider';
import { useGoogleLogin } from '@react-oauth/google';
import { buscarPlanilhaExistente } from '../services/googleSheets';

export default function Home() {
  const { tokenGoogle, setTokenGoogle, setIdPlanilha, setNomeLoja } = useContext(AppContext);

  if (tokenGoogle) {
    return <Navigate to="/dashboard" replace />;
  }

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
              onClick={() => fazerLogin()}
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
    </div>
  );
}