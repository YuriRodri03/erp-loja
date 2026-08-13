import { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../utils/AppProvider';
import { useGoogleLogin } from '@react-oauth/google';
import { buscarPlanilhaExistente } from '../services/googleSheets';

export default function Home() {
  const { tokenGoogle, setTokenGoogle, setIdPlanilha, setNomeLoja, setIsAdmin } = useContext(AppContext);
  const navigate = useNavigate();

  // Estados dos Modais
  const [mostrarTermosLogin, setMostrarTermosLogin] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [processandoLogin, setProcessandoLogin] = useState(false);
  
  // Estado para controlar qual documento legal abrir ('termos', 'privacidade' ou null)
  const [documentoLegalAberto, setDocumentoLegalAberto] = useState(null);
  
  const [planoEscolhido, setPlanoEscolhido] = useState({ nome: '', valor: 0, valorFormatado: '' });
  const [mostrarModalPagamento, setMostrarModalPagamento] = useState(false);
  const [emailCliente, setEmailCliente] = useState('');

  // Roteamento inicial
  useEffect(() => {
    if (tokenGoogle && !mostrarModalPagamento) {
      const adminCache = localStorage.getItem('isAdmin') === 'true';
      if (adminCache) {
        navigate('/operacoes', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [tokenGoogle, navigate, mostrarModalPagamento]);

  const fazerLogin = useGoogleLogin({
    onSuccess: async (resposta) => {
      setProcessandoLogin(true);
      const token = resposta.access_token;
      
      try {
        const resGoogle = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const dadosGoogle = await resGoogle.json();
        const emailUsuario = dadosGoogle.email;

        if (!emailUsuario) {
           alert("O Google não forneceu o seu e-mail. Verifique as configurações do Google Cloud Console.");
           setProcessandoLogin(false);
           return;
        }

        setEmailCliente(emailUsuario);

        const resBackend = await fetch('https://erp-loja.onrender.com/api/auth/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario })
        });
        
        const dadosConta = await resBackend.json();

        // 🎉 ALERTA DE 30 DIAS GRÁTIS
        if (dadosConta.mensagem === 'Teste de 30 dias iniciado!') {
            alert("Parabéns! O seu teste grátis de 30 dias começou agora. Crie sua base de dados a seguir e aproveite o sistema completo!");
        }

        localStorage.setItem('tokenGoogle', token);
        
        if (dadosConta.is_admin) {
            localStorage.setItem('isAdmin', 'true');
            setIsAdmin(true);
            setTokenGoogle(token); 
            navigate('/operacoes', { replace: true });
            return; 
        } else {
            localStorage.setItem('isAdmin', 'false');
            setIsAdmin(false);
        }

        if (dadosConta.status_pagamento === 'inativo') {
            setProcessandoLogin(false);
            setMostrarModalPagamento(true);
            return; 
        }

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

        setTokenGoogle(token);

      } catch (error) {
          console.error("Erro geral no login:", error);
          alert("Ocorreu um erro ao processar o login.");
      } finally {
          setProcessandoLogin(false);
      }
    },
    onError: (erro) => console.log('Erro no Login:', erro),
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email'
  });

  const iniciarProcessoDeLogin = (nomePlano = 'Mensal', valorPlano = '35,00') => {
    setPlanoEscolhido({ nome: nomePlano, valor: valorPlano });
    setMostrarTermosLogin(true);
  };

  const handleAceitarEProsseguir = () => {
    setMostrarTermosLogin(false);
    fazerLogin(); 
  };

  const linkInfinitePay = `https://pay.infinitepay.io/yuri-rodrigues07/${planoEscolhido.valor}`;

  return (
    <div className="relative bg-gray-50 overflow-hidden font-sans min-h-screen flex flex-col items-center">
      <div className="absolute inset-y-0 h-full w-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      <div className="absolute top-0 left-[-10%] w-[60%] sm:w-[40%] h-[40%] rounded-full bg-blue-200/50 blur-[100px] sm:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-[-10%] w-[50%] sm:w-[30%] h-[30%] rounded-full bg-indigo-200/50 blur-[100px] sm:blur-[120px] pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16 z-10 w-full text-center">
        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-600 border border-blue-500 text-white font-bold text-xs sm:text-sm tracking-wide mb-6 sm:mb-8 shadow-sm animate-fade-in-down">
          🚀 O seu negócio conectado na Nuvem
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-gray-900 tracking-tight mb-4 sm:mb-6 leading-tight animate-fade-in-down" style={{ animationDelay: '100ms' }}>
          Gestão <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">simples e poderosa</span> <br className="hidden lg:block" /> para quem não tem tempo a perder.
        </h1>
        
        <p className="mt-4 text-base sm:text-lg lg:text-xl text-gray-600 mb-8 sm:mb-10 max-w-3xl mx-auto animate-fade-in-down font-medium" style={{ animationDelay: '200ms' }}>
          Esqueça os sistemas caros e complicados. Controle de estoque integrado, fluxo de caixa em tempo real e o melhor gerador de carnês do mercado. Tudo sincronizado com segurança na sua própria conta Google.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-down w-full" style={{ animationDelay: '300ms' }}>
          <button 
            onClick={() => iniciarProcessoDeLogin('Mensal', '35,00')}
            disabled={processandoLogin}
            className={`w-full sm:w-auto px-8 py-4 text-white font-extrabold text-base sm:text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 ${processandoLogin ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
          >
            {processandoLogin ? 'Processando Login...' : 'Começar Meu Teste Grátis'}
            {!processandoLogin && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 sm:hover:shadow-xl sm:hover:border-blue-100 transition-all duration-300">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-3xl mb-6">📦</div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">Estoque Sem Erro</h3>
            <p className="text-gray-500 font-medium">Controle de inventário visual. Saiba exatamente o que vender, quando repor e acompanhe seu capital imobilizado de forma automática.</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 sm:hover:shadow-xl sm:hover:border-green-100 transition-all duration-300">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-3xl mb-6">📈</div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">Painel Financeiro</h3>
            <p className="text-gray-500 font-medium">Dê adeus às planilhas manuais. Acompanhe entradas, despesas e descubra o seu Lucro Líquido real a cada final de mês em uma tela só.</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 sm:hover:shadow-xl sm:hover:border-yellow-100 transition-all duration-300">
            <div className="w-14 h-14 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center text-3xl mb-6">📝</div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-3">Motor de Fiado</h3>
            <p className="text-gray-500 font-medium">Crie carnês profissionais com QRCode PIX em 3 cliques. Controle parcelas atrasadas e saiba exatamente quanto dinheiro está na rua.</p>
          </div>
        </div>
      </div>

      <div className="relative w-full bg-white mt-12 py-16 sm:py-24 border-t border-gray-100 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">Escolha a melhor opção para a sua loja.</h2>
          <p className="text-gray-500 text-lg mb-12 font-medium max-w-2xl mx-auto">Sem taxas escondidas. Cancele a qualquer momento. Suporte humano para te ajudar a crescer.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Mensal</h3>
              <p className="text-gray-500 text-sm mb-6 font-medium">Ideal para testar sem compromisso de longo prazo.</p>
              <div className="mb-6">
                <span className="text-4xl font-black text-gray-900">R$ 35</span><span className="text-gray-500 font-bold">/mês</span>
              </div>
              <ul className="text-left space-y-4 mb-8 flex-1">
                <li className="flex items-center text-gray-700 font-medium text-sm"><span className="text-green-500 mr-2 font-bold">✓</span> Acesso completo ao sistema</li>
                <li className="flex items-center text-gray-700 font-medium text-sm"><span className="text-green-500 mr-2 font-bold">✓</span> Suporte via WhatsApp</li>
                <li className="flex items-center text-gray-700 font-medium text-sm"><span className="text-green-500 mr-2 font-bold">✓</span> Gerador de Carnês com PIX</li>
              </ul>
              <button onClick={() => iniciarProcessoDeLogin('Mensal', '35,00')} className="w-full py-3.5 bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold rounded-xl transition-colors">
                Assinar Mensal
              </button>
            </div>

            <div className="bg-gray-900 rounded-3xl p-8 border border-gray-900 shadow-2xl flex flex-col relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                Melhor Custo-Benefício
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Anual</h3>
              <p className="text-gray-400 text-sm mb-6 font-medium">A economia máxima para focar em crescer seu negócio.</p>
              <div className="mb-2">
                <span className="text-4xl font-black text-white">R$ 28</span><span className="text-gray-400 font-bold">/mês</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-6 font-bold uppercase tracking-wider">Faturado em 1x de R$ 336,00</p>
              <ul className="text-left space-y-4 mb-8 flex-1">
                <li className="flex items-center text-gray-300 font-medium text-sm"><span className="text-blue-400 mr-2 font-bold">✓</span> Tudo do plano mensal</li>
                <li className="flex items-center text-gray-300 font-medium text-sm"><span className="text-blue-400 mr-2 font-bold">✓</span> <strong>Economia de 20% ao ano</strong></li>
                <li className="flex items-center text-gray-300 font-medium text-sm"><span className="text-blue-400 mr-2 font-bold">✓</span> Suporte Prioritário</li>
              </ul>
              <button onClick={() => iniciarProcessoDeLogin('Anual', '336,00')} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/30">
                Assinar Anual Agora
              </button>
            </div>

            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Trimestral</h3>
              <p className="text-gray-500 text-sm mb-6 font-medium">Equilíbrio perfeito entre economia e previsibilidade.</p>
              <div className="mb-2">
                <span className="text-4xl font-black text-gray-900">R$ 32</span><span className="text-gray-500 font-bold">/mês</span>
              </div>
              <p className="text-[11px] text-gray-500 mb-6 font-bold uppercase tracking-wider">Faturado em 1x de R$ 96,00</p>
              <ul className="text-left space-y-4 mb-8 flex-1">
                <li className="flex items-center text-gray-700 font-medium text-sm"><span className="text-green-500 mr-2 font-bold">✓</span> Acesso completo ao sistema</li>
                <li className="flex items-center text-gray-700 font-medium text-sm"><span className="text-green-500 mr-2 font-bold">✓</span> <strong>Economia de 10%</strong></li>
                <li className="flex items-center text-gray-700 font-medium text-sm"><span className="text-green-500 mr-2 font-bold">✓</span> Suporte via WhatsApp</li>
              </ul>
              <button onClick={() => iniciarProcessoDeLogin('Trimestral', '96,00')} className="w-full py-3.5 bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold rounded-xl transition-colors">
                Assinar Trimestral
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RODAPÉ COM SUPORTE E LINKS LEGAIS SEPARADOS */}
      <footer className="w-full bg-gray-900 pt-16 pb-8 border-t border-gray-800 z-10 text-center sm:text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            
            <div className="lg:col-span-2">
              <span className="text-white text-2xl font-black tracking-tight flex items-center gap-2 justify-center sm:justify-start mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 rounded-lg shadow-inner flex items-center justify-center">
                   <span className="text-lg leading-none">🛒</span> 
                </div>
                GIRO - Sistema de Gestão
              </span>
              <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-xs mx-auto sm:mx-0">
                Ajudando pequenos empreendedores a organizar as contas, acabar com a calotagem no fiado e profissionalizar a gestão da loja de forma simples e rápida.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Fale Conosco</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm font-medium flex items-center justify-center sm:justify-start gap-2">💬 WhatsApp Suporte</a></li>
                <li><a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm font-medium flex items-center justify-center sm:justify-start gap-2">📧 suporte@seusistema.com</a></li>
                <li><a href="#" className="text-gray-400 hover:text-blue-400 transition-colors text-sm font-medium flex items-center justify-center sm:justify-start gap-2">📱 Instagram Oficial</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Transparência</h4>
              <ul className="space-y-3">
                <li><button onClick={() => setDocumentoLegalAberto('termos')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Termos de Serviço</button></li>
                <li><button onClick={() => setDocumentoLegalAberto('privacidade')} className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Políticas de Privacidade</button></li>
              </ul>
            </div>

          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-xs font-bold">© {new Date().getFullYear()} GIRO ERP. Todos os direitos reservados.</p>
            <p className="text-gray-600 text-xs font-bold flex items-center gap-1">Desenvolvido com segurança Google Cloud ☁️</p>
          </div>
        </div>
      </footer>

      {/* MODAL 1: ACEITE DOS TERMOS NO MOMENTO DO LOGIN */}
      {mostrarTermosLogin && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-down border border-gray-100">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-white">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Login e Privacidade</h2>
              <p className="text-gray-500 text-sm sm:text-base font-medium mt-2">Como este sistema gerencia os dados da sua loja.</p>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto bg-gray-50/50 flex-1 space-y-5 text-sm sm:text-base text-gray-600 font-medium">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base mb-1">Seus dados são 100% seus</h4>
                  <p>O aplicativo não possui um banco de dados central. As informações de vendas e estoque são gravadas <strong>exclusivamente na sua própria conta do Google Drive</strong>, em formato de planilha. Ao prosseguir, você concorda com nossos <span onClick={() => setDocumentoLegalAberto('termos')} className="text-blue-600 cursor-pointer hover:underline font-bold">Termos de Serviço</span> e <span onClick={() => setDocumentoLegalAberto('privacidade')} className="text-blue-600 cursor-pointer hover:underline font-bold">Políticas de Privacidade</span>.</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-white border-t border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer group mb-6">
                <div className="relative flex items-start pt-0.5">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={termosAceitos} onChange={(e) => setTermosAceitos(e.target.checked)}/>
                </div>
                <span className="text-sm font-bold text-gray-700 select-none group-hover:text-gray-900 transition-colors leading-snug">Estou ciente de que meus dados serão armazenados na minha conta e compreendo as permissões.</span>
              </label>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
                <button onClick={() => setMostrarTermosLogin(false)} className="w-full sm:w-auto px-6 py-3.5 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleAceitarEProsseguir} disabled={!termosAceitos} className={`w-full sm:w-auto px-8 py-3.5 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${termosAceitos ? 'bg-gray-900 hover:bg-black text-white shadow-md hover:-translate-y-0.5' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  Continuar com o Google
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TELA DE PAGAMENTO EMBUTIDA */}
      {mostrarModalPagamento && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-down border border-gray-100">
            
            <div className="p-6 text-center bg-gray-900 relative">
              <button onClick={() => setMostrarModalPagamento(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              <h2 className="text-2xl font-black text-white">Finalizar Assinatura</h2>
              <p className="text-gray-400 text-sm font-medium mt-1">Plano {planoEscolhido.nome}</p>
            </div>

            <div className="p-8 flex flex-col items-center">
              <div className="text-center mb-6">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest block mb-1">Total a pagar</span>
                <span className="text-5xl font-black text-gray-900">R$ {planoEscolhido.valor}</span>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-200 mb-6 flex flex-col items-center justify-center relative group">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkInfinitePay)}`} 
                  alt="QR Code InfinitePay" 
                  className="w-48 h-48 rounded-lg shadow-sm"
                />
                <p className="text-xs font-bold text-gray-400 mt-4 uppercase tracking-widest">Escaneie para pagar</p>
              </div>

              <div className="w-full space-y-3">
                <a 
                  href={linkInfinitePay}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 text-white bg-[#00D77D] hover:bg-[#00c270] font-black text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  💳 Pagar no Cartão / Pix
                </a>

                <button 
                  onClick={() => {
                    alert("Aguarde nossa equipe verificar o pagamento. Assim que liberado, seu acesso será automático ao fazer login!");
                    setMostrarModalPagamento(false);
                  }}
                  className="w-full py-3.5 bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold text-sm rounded-xl transition-all"
                >
                  Já realizei o pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LEITURA DOS DOCUMENTOS LEGAIS (SEPARADOS) */}
      {documentoLegalAberto && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-fade-in-down border border-gray-100">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-white flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {documentoLegalAberto === 'termos' ? 'Termos de Serviço' : 'Políticas de Privacidade'}
              </h2>
              <button onClick={() => setDocumentoLegalAberto(null)} className="text-gray-400 hover:text-gray-800 transition-colors p-2 bg-gray-50 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-8 text-sm text-gray-600 font-medium">
              
              {/* CONTEÚDO DOS TERMOS DE SERVIÇO */}
              {documentoLegalAberto === 'termos' && (
                <>
                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">1. Aceitação dos Termos</h3>
                    <p className="leading-relaxed">Ao acessar e utilizar nosso Sistema de Gestão ("SaaS"), você concorda em cumprir e ser regido por estes Termos de Serviço. Caso não concorde com qualquer parte destes termos, o uso do sistema é expressamente proibido. O sistema destina-se a facilitar a organização comercial e financeira de pequenos negócios.</p>
                  </section>
                  
                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">2. Descrição e Disponibilidade do Serviço</h3>
                    <p className="leading-relaxed">O sistema fornece uma interface web interativa. Nós não possuímos um banco de dados centralizado com as suas informações financeiras; nosso software atua como uma ponte, gerando e lendo planilhas diretamente no seu Google Drive pessoal. Nós nos esforçamos para manter a plataforma online 24/7, porém não garantimos disponibilidade ininterrupta, isentando-nos de responsabilidade por instabilidades de servidores de terceiros (como Google ou provedores de hospedagem).</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">3. Pagamentos, Assinaturas e Reembolsos</h3>
                    <p className="leading-relaxed">O serviço é cobrado de forma antecipada (pré-paga) através de planos selecionados pelo usuário. Todo o processamento financeiro é terceirizado (via InfinitePay). Em caso de inadimplência, o acesso ao painel do sistema será suspenso, mas seus arquivos no Google Drive permanecerão intactos. Não oferecemos reembolso por meses parcialmente utilizados.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">4. Propriedade Intelectual e Uso Indevido</h3>
                    <p className="leading-relaxed">O código-fonte, design, marca e interfaces do sistema são de nossa propriedade exclusiva. É estritamente proibido realizar engenharia reversa, copiar a interface ou usar o sistema para facilitar a venda de produtos ilícitos, pirataria ou fraudes. A violação desta cláusula resultará em banimento imediato sem aviso prévio.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">5. Isenção e Limitação de Responsabilidade</h3>
                    <p className="leading-relaxed">Você compreende que é o único responsável pelos dados que insere no sistema. Não nos responsabilizamos por perdas financeiras, erros de estoque, exclusão acidental de arquivos do seu Drive ou quebras de sigilo oriundas do compartilhamento indevido da sua própria conta do Google.</p>
                  </section>
                </>
              )}

              {/* CONTEÚDO DAS POLÍTICAS DE PRIVACIDADE */}
              {documentoLegalAberto === 'privacidade' && (
                <>
                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">1. Coleta de Dados Pessoais</h3>
                    <p className="leading-relaxed">Coletamos o mínimo de informações possíveis. No momento do login, utilizamos o serviço de autenticação do Google (OAuth 2.0) e armazenamos em nossos registros de assinatura exclusivamente o seu **Endereço de E-mail**. Não capturamos nem armazenamos sua senha do Google em nenhuma hipótese.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">2. Acesso ao Google Drive e Escopos Restritos</h3>
                    <p className="leading-relaxed">Para entregar a funcionalidade principal do sistema, solicitamos as permissões `drive.file` e `spreadsheets`. Isto significa que a nossa aplicação **só tem permissão para visualizar, editar e gerenciar os arquivos de planilha que ela mesma criou** no seu Google Drive. Nós não temos permissão técnica nem lógica para ler suas fotos, PDFs ou documentos pessoais criados por você ou por outros aplicativos.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">3. Armazenamento Descentralizado dos Dados Financeiros</h3>
                    <p className="leading-relaxed">Diferente de sistemas convencionais, todas as suas métricas de vendas, despesas, lista de clientes e inventário de estoque **não** passam por nossos servidores centrais para serem guardadas. Elas são gravadas diretamente no seu ecossistema do Google. Nós não vendemos, alugamos ou repassamos seus dados financeiros para terceiros, pois sequer temos acesso direto a eles fora do escopo da sua utilização na interface web.</p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">4. Retenção e Exclusão de Dados</h3>
                    <p className="leading-relaxed">Como seus arquivos de gestão estão no seu Drive, você tem total controle sobre eles. Se você desejar parar de usar o sistema e apagar seus dados, basta acessar o seu Google Drive e deletar a planilha "Base de Dados". Para solicitar a exclusão do seu e-mail do nosso controle de assinaturas, basta entrar em contato através dos nossos canais de suporte.</p>
                  </section>
                  
                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">5. Uso de Cookies e Cache Local</h3>
                    <p className="leading-relaxed">Utilizamos o `localStorage` do seu navegador exclusivamente para manter a sua sessão de login ativa e guardar referências de navegação (como o ID da sua planilha), com o objetivo de melhorar a velocidade e a experiência de uso. Você pode limpá-los a qualquer momento nas configurações do seu navegador.</p>
                  </section>
                </>
              )}

            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setDocumentoLegalAberto(null)} className="w-full sm:w-auto px-10 py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5">
                Fechar documento
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}