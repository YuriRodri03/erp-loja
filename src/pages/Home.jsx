import { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  
  const [planoEscolhido, setPlanoEscolhido] = useState({ nome: '', valor: '0,00' });
  const [mostrarModalPagamento, setMostrarModalPagamento] = useState(false);

  // Roteamento inicial - Só redireciona pro Dashboard se não estiver olhando a tela de pagamento
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
           alert("O Google não forneceu o seu e-mail.");
           setProcessandoLogin(false);
           return;
        }

        const resBackend = await fetch('https://erp-loja.onrender.com/api/auth/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario })
        });
        
        const dadosConta = await resBackend.json();

        // ALERTA DE 30 DIAS GRÁTIS
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

        // Se a conta já existe e tá inativa, bloqueia e manda pagar
        if (dadosConta.status_pagamento === 'inativo') {
            setProcessandoLogin(false);
            setPlanoEscolhido({ nome: 'Renovação', valor: '35,00' });
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

  // FUNÇÃO 1: Botão do Herói - Começa o teste grátis (pede login)
  const iniciarTesteGratis = () => {
    setMostrarTermosLogin(true);
  };

  // FUNÇÃO 2: Botões de Preço - Mostra a tela de pagamento DIRETO
  const iniciarCompraPlano = (nomePlano, valorPlano) => {
    setPlanoEscolhido({ nome: nomePlano, valor: valorPlano });
    setMostrarModalPagamento(true);
  };

  const linkInfinitePay = `https://pay.infinitepay.io/yuri-rodrigues07/${planoEscolhido.valor}`;

  return (
    <div className="relative bg-gray-50 overflow-hidden font-sans min-h-screen flex flex-col items-center">
      {/* TELA DE CARREGAMENTO PROFISSIONAL (Entra por cima de tudo) */}
      {processandoLogin && (
        <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center z-[100] transition-opacity duration-300">
          <div className="relative flex items-center justify-center mb-8">
            {/* Círculo de fundo */}
            <div className="absolute inset-0 w-24 h-24 border-4 border-gray-800 rounded-full"></div>
            {/* Círculo animado girando */}
            <div className="absolute inset-0 w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {/* Logo central */}
            <div className="bg-gray-800 p-4 rounded-full shadow-inner z-10 flex items-center justify-center">
              <span className="text-3xl leading-none">🛒</span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight animate-pulse">
            Construindo seu ambiente...
          </h2>
          <p className="text-gray-400 font-medium text-sm sm:text-base text-center max-w-sm px-4">
            Autenticando e sincronizando seu banco de dados seguro com o Google Drive.
          </p>
        </div>
      )}
      
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
        
        {/* TEXTO ATUALIZADO PARA O GOOGLE APROVAR */}
        <p className="mt-4 text-base sm:text-lg lg:text-xl text-gray-600 mb-8 sm:mb-10 max-w-3xl mx-auto animate-fade-in-down font-medium" style={{ animationDelay: '200ms' }}>
          O GIRO é um aplicativo de gestão financeira e controle de estoque criado para pequenos lojistas. Nossa finalidade é organizar suas vendas e carnês armazenando os dados exclusivamente na sua própria conta do Google Drive, garantindo privacidade e controle total sobre suas informações, sem banco de dados de terceiros.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-down w-full" style={{ animationDelay: '300ms' }}>
          <button 
            onClick={iniciarTesteGratis}
            disabled={processandoLogin}
            className={`w-full sm:w-auto px-8 py-4 text-white font-extrabold text-base sm:text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 ${processandoLogin ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
          >
            {processandoLogin ? 'Iniciando...' : 'Começar Meu Teste Grátis'}
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
              <button onClick={() => iniciarCompraPlano('Mensal', '35,00')} className="w-full py-3.5 bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold rounded-xl transition-colors">
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
              <button onClick={() => iniciarCompraPlano('Anual', '336,00')} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/30">
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
              <button onClick={() => iniciarCompraPlano('Trimestral', '96,00')} className="w-full py-3.5 bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold rounded-xl transition-colors">
                Assinar Trimestral
              </button>
            </div>
          </div>
        </div>
      </div>

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

            {/* LINKS REAIS PARA AS PÁGINAS LEGAIS */}
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Transparência</h4>
              <ul className="space-y-3">
                <li><Link to="/termos" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Termos de Serviço</Link></li>
                <li><Link to="/privacidade" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Políticas de Privacidade</Link></li>
              </ul>
            </div>

          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-xs font-bold">© {new Date().getFullYear()} GIRO ERP. Todos os direitos reservados.</p>
            <p className="text-gray-600 text-xs font-bold flex items-center gap-1">Desenvolvido com segurança Google Cloud ☁️</p>
          </div>
        </div>
      </footer>

      {/* MODAL 1: ACEITE DOS TERMOS - APENAS PARA QUEM CLICOU NO TESTE GRÁTIS */}
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
                  <p>
                    O aplicativo não possui um banco de dados central. As informações de vendas e estoque são gravadas <strong>exclusivamente na sua própria conta do Google Drive</strong>, em formato de planilha. Ao prosseguir, você concorda com nossos <Link to="/termos" target="_blank" className="text-blue-600 hover:underline font-bold">Termos de Serviço</Link> e <Link to="/privacidade" target="_blank" className="text-blue-600 hover:underline font-bold">Políticas de Privacidade</Link>.
                  </p>
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
                <button onClick={() => { setMostrarTermosLogin(false); fazerLogin(); }} disabled={!termosAceitos} className={`w-full sm:w-auto px-8 py-3.5 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${termosAceitos ? 'bg-gray-900 hover:bg-black text-white shadow-md hover:-translate-y-0.5' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  Continuar com o Google
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TELA DE PAGAMENTO */}
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
                    alert("Aguarde nossa equipe verificar o pagamento. Assim que liberado, basta clicar em Login no topo do site!");
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

    </div>
  );
}