import { useState, useContext } from 'react';
import { AppContext } from '../utils/AppProvider';

export default function Cobrancas() {
  const { vendas, clientes, nomeLoja } = useContext(AppContext);
  const [termoBusca, setTermoBusca] = useState('');
  const [clienteExpandido, setClienteExpandido] = useState(null);

  // =========================================================================
  // FUNÇÕES UTILITÁRIAS DE DATA E STATUS
  // =========================================================================
  const parseStatusParcelas = (statusString, numParcelas) => {
    if (statusString === 'SIM') return Array(numParcelas).fill('SIM');
    if (statusString === 'NÃO') return Array(numParcelas).fill('NÃO');
    if (!isNaN(statusString) && !statusString.includes('|') && !statusString.includes('/')) {
        const pagas = parseInt(statusString);
        return Array(numParcelas).fill('NÃO').map((_, i) => i < pagas ? 'SIM' : 'NÃO');
    }
    if (statusString.includes('|')) {
        const partes = statusString.split('|');
        return Array(numParcelas).fill('NÃO').map((_, i) => partes[i] || 'NÃO');
    }
    return Array(numParcelas).fill('NÃO');
  };

  const calcularVencimentos = (dataInicial, numParcelas) => {
    if (!dataInicial || dataInicial === '-') return Array(numParcelas).fill('Indefinida');
    const partes = dataInicial.split('/');
    if (partes.length !== 3) return Array(numParcelas).fill('Erro na Data');
    
    const [dia, mes, ano] = partes.map(Number);
    const vencimentos = [];
    let dataAtual = new Date(ano, mes - 1, dia);

    for(let i = 0; i < numParcelas; i++) {
      vencimentos.push(dataAtual.toLocaleDateString('pt-BR'));
      dataAtual.setMonth(dataAtual.getMonth() + 1);
    }
    return vencimentos;
  };

  const converterParaDataObj = (dataBR) => {
    if (!dataBR || !dataBR.includes('/')) return new Date(0);
    const [d, m, a] = dataBR.split('/');
    return new Date(a, m - 1, d).setHours(0,0,0,0);
  };

  // =========================================================================
  // PROCESSAMENTO FINANCEIRO DE COBRANÇAS
  // =========================================================================
  let totalAtrasado = 0;
  let totalHoje = 0;
  let totalFuturo = 0;

  const devedoresMap = {};
  const hojeTempo = new Date().setHours(0,0,0,0);

  vendas.forEach(v => {
    if (v.formaPagamento === 'Crediário' && v.statusPago !== 'SIM') {
      const numParcelas = Number(v.parcelasCartao) || 1;
      const arrayStatus = parseStatusParcelas(v.statusPago, numParcelas);
      const valorParcela = (Number(v.total) - Number(v.valorEntrada || 0)) / numParcelas;
      const vencimentos = calcularVencimentos(v.dataPrimeiraParcela, numParcelas);

      // Se o cliente não existir no mapa, cria
      if (!devedoresMap[v.clienteId]) {
         const cli = clientes.find(c => c.id == v.clienteId);
         if (!cli) return; // Ignora se não achar o cliente (venda avulsa no fiado)
         
         devedoresMap[v.clienteId] = {
            cliente: cli,
            totalDevido: 0,
            parcelasPendentes: []
         };
      }

      vencimentos.forEach((dataVenc, idx) => {
         if (arrayStatus[idx] === 'NÃO') {
            const tempoVenc = converterParaDataObj(dataVenc);
            let statusTempo = 'FUTURO';

            if (tempoVenc < hojeTempo) {
              statusTempo = 'ATRASADO';
              totalAtrasado += valorParcela;
            } else if (tempoVenc === hojeTempo) {
              statusTempo = 'HOJE';
              totalHoje += valorParcela;
            } else {
              totalFuturo += valorParcela;
            }

            devedoresMap[v.clienteId].totalDevido += valorParcela;
            devedoresMap[v.clienteId].parcelasPendentes.push({
               vendaId: v.id,
               produto: v.produto,
               numParcela: idx + 1,
               totalParcelas: numParcelas,
               valor: valorParcela,
               dataVenc: dataVenc,
               tempoVenc: tempoVenc,
               statusTempo: statusTempo
            });
         }
      });
    }
  });

  // Transforma em array, ordena quem deve mais e filtra buscas
  const listaDevedores = Object.values(devedoresMap)
    .filter(d => d.totalDevido > 0) // Garante que só mostra quem deve
    .filter(d => d.cliente.nome.toLowerCase().includes(termoBusca.toLowerCase()))
    .sort((a, b) => b.totalDevido - a.totalDevido); // Quem deve mais aparece primeiro

  // Ordena as parcelas dentro do cliente: Atrasadas primeiro
  listaDevedores.forEach(d => {
      d.parcelasPendentes.sort((a, b) => a.tempoVenc - b.tempoVenc);
  });

  const totalGeralAReceber = totalAtrasado + totalHoje + totalFuturo;

  // =========================================================================
  // INTEGRAÇÃO COM WHATSAPP
  // =========================================================================
  const gerarLinkWhatsApp = (telefone, parcela) => {
    const numeroLimpo = telefone.replace(/\D/g, ''); // Tira traços e parênteses
    if (!numeroLimpo) return '#';
    
    let saudacao = "";
    if (parcela.statusTempo === 'ATRASADO') {
        saudacao = `Olá! Passando para lembrar da parcela pendente de R$ ${parcela.valor.toFixed(2)} referente à compra de "${parcela.produto}". O vencimento foi em ${parcela.dataVenc}.`;
    } else if (parcela.statusTempo === 'HOJE') {
        saudacao = `Olá! Tudo bem? Passando para lembrar que sua parcela de R$ ${parcela.valor.toFixed(2)} ("${parcela.produto}") vence hoje (${parcela.dataVenc}).`;
    } else {
        saudacao = `Olá! Segue o lembrete da sua próxima parcela de R$ ${parcela.valor.toFixed(2)} ("${parcela.produto}") que vencerá no dia ${parcela.dataVenc}.`;
    }

    const mensagemFinal = `${saudacao} Qualquer dúvida, estamos à disposição aqui na ${nomeLoja}!`;
    return `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagemFinal)}`;
  };

  const toggleCliente = (id) => setClienteExpandido(clienteExpandido === id ? null : id);

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Central de Cobranças</h2>
          <p className="text-base text-gray-500 mt-1">Acompanhe vencimentos e cobre devedores via WhatsApp</p>
        </div>
      </div>

      {/* CARDS FINANCEIROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-red-200 shadow-md ring-1 ring-red-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full opacity-50 -z-0"></div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Em Atraso</p>
            <p className="text-3xl font-black text-red-700 mt-2">R$ {totalAtrasado.toFixed(2)}</p>
            <p className="text-xs text-red-500 font-bold mt-2">Urgente: Fazer cobranças</p>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-yellow-200 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-bl-full opacity-50 -z-0"></div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">Vencem Hoje</p>
            <p className="text-3xl font-black text-yellow-700 mt-2">R$ {totalHoje.toFixed(2)}</p>
            <p className="text-xs text-yellow-600 font-bold mt-2">Enviar lembretes hoje</p>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-blue-200 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-50 -z-0"></div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Total a Receber</p>
            <p className="text-3xl font-black text-blue-700 mt-2">R$ {totalGeralAReceber.toFixed(2)}</p>
            <p className="text-xs text-blue-500 font-bold mt-2">Atrasados + Hoje + Futuro</p>
          </div>
        </div>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
        <span className="text-gray-400 text-xl ml-2 mr-3">🔍</span>
        <input 
            type="text" 
            placeholder="Buscar devedor por nome..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full bg-transparent border-none focus:outline-none text-gray-800 font-medium placeholder-gray-400"
        />
      </div>

      {/* LISTA DE DEVEDORES */}
      <div className="space-y-4">
        {listaDevedores.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <span className="text-5xl mb-4 block">🏆</span>
            <p className="text-gray-800 font-bold text-xl">Carteira Limpa!</p>
            <p className="text-gray-500 mt-2">Nenhum cliente está devendo no momento.</p>
          </div>
        ) : (
          listaDevedores.map(({ cliente, totalDevido, parcelasPendentes }) => {
            const isExpanded = clienteExpandido === cliente.id;
            const atrasadas = parcelasPendentes.filter(p => p.statusTempo === 'ATRASADO').length;

            return (
              <div key={cliente.id} className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${atrasadas > 0 ? 'border-red-200' : 'border-gray-200'}`}>
                
                {/* CABEÇALHO DO CLIENTE */}
                <div onClick={() => toggleCliente(cliente.id)} className={`p-5 flex flex-col sm:flex-row justify-between sm:items-center cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-center gap-4 mb-3 sm:mb-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${atrasadas > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      {cliente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900">{cliente.nome}</h3>
                      <p className="text-sm font-medium text-gray-500">{cliente.telefone}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Dívida Total</p>
                      <p className={`text-2xl font-black ${atrasadas > 0 ? 'text-red-600' : 'text-gray-900'}`}>R$ {totalDevido.toFixed(2)}</p>
                    </div>
                    <div className="text-gray-400 font-bold text-xl transform transition-transform">
                      {isExpanded ? '▲' : '▼'}
                    </div>
                  </div>
                </div>

                {/* LISTA DE PARCELAS DO CLIENTE */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 p-5 animate-fade-in-down">
                    <div className="space-y-3">
                      {parcelasPendentes.map((parcela, idx) => {
                         let corBorda = 'border-blue-200';
                         let corFundo = 'bg-white';
                         let icone = '⏳';
                         let labelStatus = 'Futura';

                         if (parcela.statusTempo === 'ATRASADO') {
                            corBorda = 'border-red-300 ring-1 ring-red-100';
                            corFundo = 'bg-red-50/50';
                            icone = '🚨';
                            labelStatus = 'Atrasada';
                         } else if (parcela.statusTempo === 'HOJE') {
                            corBorda = 'border-yellow-300';
                            corFundo = 'bg-yellow-50/50';
                            icone = '⚠️';
                            labelStatus = 'Vence Hoje';
                         }

                         return (
                           <div key={idx} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between md:items-center gap-4 ${corBorda} ${corFundo}`}>
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-sm">{icone}</span>
                                  <span className="text-sm font-extrabold text-gray-800">Parcela {parcela.numParcela}/{parcela.totalParcelas}</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-200 text-gray-700">{labelStatus}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-600">Referente a: <strong className="text-gray-800">{parcela.produto}</strong></p>
                              </div>
                              
                              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                                <div className="text-left md:text-right">
                                  <p className="text-xs font-bold text-gray-500 mb-0.5">Vencimento: {parcela.dataVenc}</p>
                                  <p className="text-lg font-black text-gray-900">R$ {parcela.valor.toFixed(2)}</p>
                                </div>
                                
                                <a 
                                  href={gerarLinkWhatsApp(cliente.telefone, parcela)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                >
                                  Cobrar <span className="hidden sm:inline">via WhatsApp</span>
                                </a>
                              </div>
                           </div>
                         )
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}