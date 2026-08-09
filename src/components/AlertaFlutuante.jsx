import { useEffect, useState } from 'react';

export default function AlertaFlutuante({ mensagem, tipo = 'sucesso', tempo = 4000, onClose }) {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    // Inicia o timer para a barra de progresso sumir e o alerta desaparecer
    const timer = setTimeout(() => {
      setVisivel(false);
      setTimeout(onClose, 300); // Dá 300ms para a animação de saída terminar antes de remover o componente
    }, tempo);

    return () => clearTimeout(timer);
  }, [tempo, onClose]);

  if (!mensagem) return null;

  const config = {
    sucesso: {
      corFundo: 'bg-green-50',
      corBorda: 'border-green-200',
      corTexto: 'text-green-800',
      corIcone: 'text-green-500',
      icone: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      )
    },
    erro: {
      corFundo: 'bg-red-50',
      corBorda: 'border-red-200',
      corTexto: 'text-red-800',
      corIcone: 'text-red-500',
      icone: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      )
    }
  };

  const c = config[tipo] || config.sucesso;

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${visivel ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      <div className={`flex items-start p-4 ${c.corFundo} border ${c.corBorda} rounded-xl shadow-xl max-w-sm`}>
        <div className={`flex-shrink-0 ${c.corIcone}`}>
          {c.icone}
        </div>
        <div className="ml-3 w-0 flex-1 pt-0.5">
          <p className={`text-sm font-bold ${c.corTexto}`}>
            {mensagem}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button onClick={() => { setVisivel(false); setTimeout(onClose, 300); }} className={`inline-flex ${c.corTexto} hover:opacity-75 focus:outline-none transition-opacity`}>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}