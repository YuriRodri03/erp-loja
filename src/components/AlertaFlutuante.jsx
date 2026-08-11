import { useEffect, useState } from 'react';

export default function AlertaFlutuante({ mensagem, tipo = 'sucesso', tempo = 4000, onClose }) {
  const [visivel, setVisivel] = useState(true);
  const [animarSaida, setAnimarSaida] = useState(false);

  useEffect(() => {
    // Inicia a animação de saída antes do tempo acabar
    const timerSaida = setTimeout(() => {
      setAnimarSaida(true);
    }, tempo - 300);

    // Remove o componente
    const timerRemover = setTimeout(() => {
      setVisivel(false);
      onClose();
    }, tempo);

    return () => {
      clearTimeout(timerSaida);
      clearTimeout(timerRemover);
    };
  }, [tempo, onClose]);

  if (!visivel || !mensagem) return null;

  const config = {
    sucesso: {
      corFundo: 'bg-white',
      corBorda: 'border-green-100',
      corTexto: 'text-gray-800',
      corIconeFundo: 'bg-green-100 text-green-600',
      corProgresso: 'bg-green-500',
      icone: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
      )
    },
    erro: {
      corFundo: 'bg-white',
      corBorda: 'border-red-100',
      corTexto: 'text-gray-800',
      corIconeFundo: 'bg-red-100 text-red-600',
      corProgresso: 'bg-red-500',
      icone: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
      )
    },
    aviso: {
      corFundo: 'bg-white',
      corBorda: 'border-yellow-100',
      corTexto: 'text-gray-800',
      corIconeFundo: 'bg-yellow-100 text-yellow-600',
      corProgresso: 'bg-yellow-500',
      icone: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      )
    }
  };

  const c = config[tipo] || config.sucesso;

  const handleFecharManual = () => {
    setAnimarSaida(true);
    setTimeout(() => {
      setVisivel(false);
      onClose();
    }, 300);
  };

  return (
    <div className={`fixed top-4 left-4 right-4 sm:top-24 sm:left-auto sm:right-6 z-[60] transition-all duration-300 transform ${!animarSaida ? 'translate-y-0 opacity-100' : 'translate-y-[-20px] sm:translate-x-full opacity-0'}`}>
      
      <div className={`relative overflow-hidden flex items-start p-4 ${c.corFundo} border ${c.corBorda} rounded-2xl shadow-2xl shadow-gray-200/50 w-auto sm:w-[350px] max-w-full backdrop-blur-sm bg-white/95`}>
        
        {/* Ícone */}
        <div className={`flex-shrink-0 p-2 rounded-xl ${c.corIconeFundo}`}>
          {c.icone}
        </div>
        
        {/* Mensagem */}
        <div className="ml-4 w-0 flex-1 pt-1">
          <p className={`text-sm font-bold ${c.corTexto} leading-snug`}>
            {mensagem}
          </p>
        </div>
        
        {/* Botão Fechar */}
        <div className="ml-4 flex-shrink-0 flex">
          <button onClick={handleFecharManual} className="inline-flex text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-lg focus:outline-none transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Barra de Progresso no rodapé do card */}
        <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
            <div 
              className={`h-full ${c.corProgresso}`} 
              style={{
                width: '100%',
                animation: `encolher ${tempo}ms linear forwards`
              }}
            ></div>
        </div>
        
      </div>

      {/* Adicionando keyframes dinâmicos para a animação da barra funcionar no Tailwind/React */}
      <style>{`
        @keyframes encolher {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}