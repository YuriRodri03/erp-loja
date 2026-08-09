export default function Botao({ 
  texto, 
  cor = 'blue', 
  tipo = 'button', 
  onClick, 
  desabilitado = false,
  larguraTotal = false 
}) {

  // Um mapa (dicionário) para traduzir a intenção de cor para as classes do Tailwind
  const estilosDeCor = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    gray: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    cyan: 'bg-cyan-600 hover:bg-cyan-700 text-white'
  };

  const corSelecionada = estilosDeCor[cor] || estilosDeCor.blue;
  const estiloLargura = larguraTotal ? 'w-full' : '';

  return (
    <button 
      type={tipo} 
      onClick={onClick}
      disabled={desabilitado}
      className={`
        ${corSelecionada} ${estiloLargura}
        px-6 py-2.5 font-bold rounded-lg shadow-sm 
        transition-all duration-200 ease-in-out
        flex items-center justify-center
        ${desabilitado ? 'opacity-50 cursor-not-allowed transform-none hover:bg-opacity-100' : 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer'}
      `}
    >
      {desabilitado ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processando...
        </>
      ) : (
        texto
      )}
    </button>
  );
}