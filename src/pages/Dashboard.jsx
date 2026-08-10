import { useContext, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { AppContext } from '../utils/AppProvider';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Area, AreaChart, PieChart, Pie, Cell
} from 'recharts';
import AlertaFlutuante from '../components/AlertaFlutuante';

export default function Dashboard() {
  const { tokenGoogle, nomeLoja, produtos, vendas, clientes, despesas } = useContext(AppContext);
  
  const hoje = new Date();
  const [abaAtiva, setAbaAtiva] = useState('geral');
  const [mesSelecionado, setMesSelecionado] = useState((hoje.getMonth() + 1).toString().padStart(2, '0'));
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear().toString());

  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });
  const fecharAlerta = () => setAlerta({ ...alerta, visivel: false });

  if (!tokenGoogle) {
    return <Navigate to="/" replace />;
  }

  // =========================================================================
  // MOTOR FINANCEIRO: Extrai datas reais de pagamento do Caixa
  // =========================================================================
  const getFluxosDeCaixa = (venda) => {
    const fluxos = [];
    const totalVenda = Number(venda.quantidade) * Number(venda.valorUnitario);

    if (venda.formaPagamento !== 'Crediário') {
      fluxos.push({ data: venda.data, valor: totalVenda });
    } else {
      const entrada = Number(venda.valorEntrada || 0);
      const parcelasTotais = Number(venda.parcelasCartao) || 1; 
      const valorDaParcela = (totalVenda - entrada) / parcelasTotais;

      if (entrada > 0) fluxos.push({ data: venda.data, valor: entrada });

      if (venda.statusPago === 'SIM') {
        fluxos.push({ data: venda.data, valor: totalVenda - entrada });
      } else if (venda.statusPago && venda.statusPago.includes('|')) {
        const pagamentos = venda.statusPago.split('|');
        pagamentos.forEach(status => {
          if (status !== 'NÃO') {
            fluxos.push({ data: status.includes('/') ? status : venda.data, valor: valorDaParcela });
          }
        });
      } else if (venda.statusPago && !isNaN(venda.statusPago)) {
        const pagas = Number(venda.statusPago);
        fluxos.push({ data: venda.data, valor: pagas * valorDaParcela });
      }
    }
    return fluxos;
  };

  const calcularValoresDaVenda = (venda) => {
    const totalVenda = Number(venda.quantidade) * Number(venda.valorUnitario);
    const fluxos = getFluxosDeCaixa(venda);
    const valorCaixa = fluxos.reduce((acc, f) => acc + f.valor, 0);
    const valorPendente = totalVenda - valorCaixa;
    return { valorCaixa, valorPendente, totalVenda };
  };

  const getNomeCliente = (id) => {
    const c = clientes.find(cli => cli.id == id);
    return c ? c.nome : 'Desconhecido';
  };

  // =========================================================================
  // PROCESSAMENTO GLOBAL
  // =========================================================================
  let totalEmCaixa = 0;
  let totalAReceber = 0;

  vendas.forEach(v => {
    const { valorCaixa, valorPendente } = calcularValoresDaVenda(v);
    totalEmCaixa += valorCaixa;
    totalAReceber += valorPendente;
  });

  const totalDespesas = despesas.reduce((acc, d) => d.status === 'PAGO' ? acc + d.valor : acc, 0);
  const lucroLiquido = totalEmCaixa - totalDespesas;
  
  const estoqueCritico = produtos.filter(p => p.quantidade <= 5).sort((a, b) => a.quantidade - b.quantidade).slice(0, 5);
  const contasPendentes = despesas.filter(d => d.status === 'PENDENTE').sort((a,b) => {
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
  }).slice(0, 5);

  const dataAtual = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const anosDisponiveis = [...new Set([
    ...vendas.flatMap(v => getFluxosDeCaixa(v).map(f => f.data?.split('/')[2])).filter(Boolean),
    ...despesas.map(d => d.data?.split('/')[2]).filter(Boolean),
    hoje.getFullYear().toString()
  ])].sort((a, b) => b - a);

  // =========================================================================
  // 3. PROCESSAMENTO PARA GRÁFICOS
  // =========================================================================
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  const diasNoMes = new Date(parseInt(anoSelecionado), parseInt(mesSelecionado), 0).getDate();
  const dadosMensais = Array.from({ length: diasNoMes }, (_, i) => ({ name: (i + 1).toString().padStart(2, '0'), Caixa: 0, Despesas: 0, Lucro: 0 }));
  const dadosAnuais = Array.from({ length: 12 }, (_, i) => {
    const mesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return { name: mesNomes[i], Caixa: 0, Despesas: 0, Lucro: 0 };
  });

  let faturamentoMes = 0;
  let faturamentoAno = 0;
  
  const produtosMap = {};
  const clientesMesMap = {};
  const formaPagamentoMap = {};

  vendas.forEach(v => {
    const fluxos = getFluxosDeCaixa(v);
    
    fluxos.forEach(fluxo => {
      if (!fluxo.data) return;
      const [fDia, fMes, fAno] = fluxo.data.split('/');

      if (fAno === anoSelecionado) {
        dadosAnuais[parseInt(fMes) - 1].Caixa += fluxo.valor;
        faturamentoAno += fluxo.valor;
        if (!formaPagamentoMap[v.formaPagamento]) formaPagamentoMap[v.formaPagamento] = 0;
        formaPagamentoMap[v.formaPagamento] += fluxo.valor;
      }
      if (fAno === anoSelecionado && fMes === mesSelecionado) {
        dadosMensais[parseInt(fDia) - 1].Caixa += fluxo.valor;
        faturamentoMes += fluxo.valor;
      }
    });

    if (!v.data) return;
    const [vDia, vMes, vAno] = v.data.split('/');
    if (vAno === anoSelecionado && vMes === mesSelecionado) {
      if (!produtosMap[v.produto]) produtosMap[v.produto] = 0;
      produtosMap[v.produto] += Number(v.quantidade);

      if (v.clienteId && v.clienteId !== 'AVULSO') {
        if (!clientesMesMap[v.clienteId]) clientesMesMap[v.clienteId] = { nome: getNomeCliente(v.clienteId), totalGasto: 0 };
        clientesMesMap[v.clienteId].totalGasto += (Number(v.quantidade) * Number(v.valorUnitario));
      }
    }
  });

  let despesasDoMesTotal = 0;
  let despesasDoAnoTotal = 0;
  const despesasCategoriaMesMap = {};
  const despesasCategoriaAnoMap = {};

  despesas.forEach(d => {
    if (d.status !== 'PAGO' || !d.data) return;
    const [dDia, dMes, dAno] = d.data.split('/');

    if (dAno === anoSelecionado) {
      dadosAnuais[parseInt(dMes) - 1].Despesas += d.valor;
      despesasDoAnoTotal += d.valor;
      if (!despesasCategoriaAnoMap[d.categoria]) despesasCategoriaAnoMap[d.categoria] = 0;
      despesasCategoriaAnoMap[d.categoria] += d.valor;
    }
    if (dAno === anoSelecionado && dMes === mesSelecionado) {
      dadosMensais[parseInt(dDia) - 1].Despesas += d.valor;
      despesasDoMesTotal += d.valor;
      if (!despesasCategoriaMesMap[d.categoria]) despesasCategoriaMesMap[d.categoria] = 0;
      despesasCategoriaMesMap[d.categoria] += d.valor;
    }
  });

  dadosMensais.forEach(d => d.Lucro = d.Caixa - d.Despesas);
  dadosAnuais.forEach(d => d.Lucro = d.Caixa - d.Despesas);

  const topProdutosMes = Object.keys(produtosMap).map(k => ({ name: k, Quantidade: produtosMap[k] })).sort((a, b) => b.Quantidade - a.Quantidade).slice(0, 5);
  const topClientesMes = Object.values(clientesMesMap).sort((a, b) => b.totalGasto - a.totalGasto).slice(0, 5);
  const despesasCategoriaMes = Object.keys(despesasCategoriaMesMap).map(k => ({ name: k, value: despesasCategoriaMesMap[k] }));
  const despesasCategoriaAno = Object.keys(despesasCategoriaAnoMap).map(k => ({ name: k, value: despesasCategoriaAnoMap[k] }));
  const pagamentosAno = Object.keys(formaPagamentoMap).map(k => ({ name: k, value: formaPagamentoMap[k] }));

  // =========================================================================
  // INTERFACE DO USUÁRIO
  // =========================================================================
  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      
      {alerta.visivel && (
        <AlertaFlutuante mensagem={alerta.mensagem} tipo={alerta.tipo} onClose={fecharAlerta} />
      )}

      {/* HEADER */}
      <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Painel de Inteligência</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1 capitalize">{dataAtual}</p>
        </div>
        <div className="px-5 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 flex items-center justify-center shadow-sm w-full md:w-auto">
          <span className="mr-2 text-xl">🏢</span> {nomeLoja}
        </div>
      </div>

      {/* CONTROLES / TABS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        
        {/* Menu de Abas (Rolável no Mobile) */}
        <div className="w-full lg:w-max overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
          <div className="flex space-x-2 bg-gray-100 p-1.5 rounded-xl min-w-max shadow-inner">
            <button onClick={() => setAbaAtiva('geral')} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'geral' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Resumo Geral</button>
            <button onClick={() => setAbaAtiva('mensal')} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'mensal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Visão Mensal</button>
            <button onClick={() => setAbaAtiva('anual')} className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${abaAtiva === 'anual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Visão Anual</button>
          </div>
        </div>

        {/* Filtros de Mês/Ano (Escondidos na visão Geral) */}
        {(abaAtiva === 'mensal' || abaAtiva === 'anual') && (
          <div className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm w-full lg:w-auto">
            <span className="hidden sm:inline-block text-gray-500 font-bold text-sm pl-2">Filtrar:</span>
            <div className="flex gap-2 w-full sm:w-auto">
              {abaAtiva === 'mensal' && (
                <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="flex-1 sm:flex-none bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 px-4 py-2 font-bold cursor-pointer transition-colors">
                  <option value="01">Janeiro</option><option value="02">Fevereiro</option><option value="03">Março</option>
                  <option value="04">Abril</option><option value="05">Maio</option><option value="06">Junho</option>
                  <option value="07">Julho</option><option value="08">Agosto</option><option value="09">Setembro</option>
                  <option value="10">Outubro</option><option value="11">Novembro</option><option value="12">Dezembro</option>
                </select>
              )}
              <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(e.target.value)} className="flex-1 sm:flex-none bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 px-4 py-2 font-bold cursor-pointer transition-colors">
                {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          ABA 1: RESUMO GERAL
      ========================================================================= */}
      {abaAtiva === 'geral' && (
        <div className="animate-fade-in space-y-6 sm:space-y-8">
          
          {/* Cards Superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 sm:p-8 rounded-2xl shadow-lg relative overflow-hidden text-white transition-transform sm:hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full opacity-10 -z-0"></div>
              <div className="relative z-10">
                <p className="text-xs sm:text-sm font-bold text-indigo-200 uppercase tracking-widest mb-1 sm:mb-2">Lucro Histórico</p>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-2 sm:mb-3">R$ {lucroLiquido.toFixed(2)}</p>
                <div className="inline-block px-3 py-1.5 bg-indigo-900/50 text-indigo-100 text-xs font-bold rounded-lg backdrop-blur-sm border border-indigo-500/30">
                  {lucroLiquido >= 0 ? 'Lucrativa' : 'Prejuízo'}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 rounded-bl-full opacity-50 -z-0 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Entradas Realizadas</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2 sm:mb-3">R$ {totalEmCaixa.toFixed(2)}</p>
                <div className="inline-block px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 text-xs font-bold rounded-lg">Faturamento</div>
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-100 to-red-50 rounded-bl-full opacity-50 -z-0 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Saídas Pagas</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2 sm:mb-3">R$ {totalDespesas.toFixed(2)}</p>
                <div className="inline-block px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 text-xs font-bold rounded-lg">Despesas</div>
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-bl-full opacity-50 -z-0 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">A Receber (Fiado)</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2 sm:mb-3">R$ {totalAReceber.toFixed(2)}</p>
                <div className="inline-block px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-100 text-xs font-bold rounded-lg">Capital na Rua</div>
              </div>
            </div>

          </div>

          {/* Cards de Alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Alerta de Estoque */}
            <div className="bg-white rounded-2xl p-5 sm:p-8 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-5 sm:mb-6 pb-4 border-b border-gray-50">
                <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center">
                  <span className="bg-orange-100 text-orange-600 p-2 rounded-xl mr-3">📦</span> Estoque Baixo
                </h3>
                <Link to="/estoque" className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg">Ver Todos</Link>
              </div>
              
              {estoqueCritico.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <span className="text-4xl mb-3">✅</span>
                  <p className="text-gray-800 font-bold text-base">Estoque Saudável</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {estoqueCritico.map(prod => (
                    <div key={prod.id} className="flex items-center justify-between p-4 sm:p-5 bg-orange-50/50 rounded-xl border border-orange-100">
                      <div className="pr-4">
                        <p className="font-extrabold text-gray-900 text-sm sm:text-base leading-tight truncate max-w-[150px] sm:max-w-xs">{prod.nome}</p>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">R$ {prod.preco.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-orange-600 text-xl sm:text-2xl">{prod.quantidade} <span className="text-xs font-bold">un</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contas a Pagar */}
            <div className="bg-white rounded-2xl p-5 sm:p-8 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-5 sm:mb-6 pb-4 border-b border-gray-50">
                <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center">
                  <span className="bg-red-100 text-red-600 p-2 rounded-xl mr-3">⚠️</span> A Pagar
                </h3>
                <Link to="/despesas" className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg">Ver Despesas</Link>
              </div>
              
              {contasPendentes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <span className="text-4xl mb-3">🎉</span>
                  <p className="text-gray-800 font-bold text-base">Tudo pago!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contasPendentes.map(conta => (
                    <div key={conta.id} className="flex items-center justify-between p-4 sm:p-5 bg-red-50/50 rounded-xl border border-red-100">
                      <div className="pr-4">
                        <p className="font-extrabold text-gray-900 text-sm sm:text-base leading-tight truncate max-w-[150px] sm:max-w-xs">{conta.descricao}</p>
                        <p className="text-xs font-medium text-gray-500 mt-1">Venc: {conta.data}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-red-600 text-lg sm:text-xl">R$ {conta.valor.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: VISÃO MENSAL
      ========================================================================= */}
      {abaAtiva === 'mensal' && (
        <div className="animate-fade-in space-y-6 sm:space-y-8">
          
          {/* Cards Mensais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Entradas no Mês</p>
                <p className="text-2xl sm:text-3xl font-black text-green-600 mt-1 sm:mt-2 tracking-tight">R$ {faturamentoMes.toFixed(2)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-green-50 rounded-xl sm:rounded-2xl"><span className="text-2xl sm:text-3xl">💵</span></div>
            </div>
            
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Saídas no Mês</p>
                <p className="text-2xl sm:text-3xl font-black text-red-600 mt-1 sm:mt-2 tracking-tight">R$ {despesasDoMesTotal.toFixed(2)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-red-50 rounded-xl sm:rounded-2xl"><span className="text-2xl sm:text-3xl">💸</span></div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Lucro do Mês</p>
                <p className={`text-2xl sm:text-3xl font-black mt-1 sm:mt-2 tracking-tight ${(faturamentoMes - despesasDoMesTotal) >= 0 ? 'text-indigo-600' : 'text-gray-900'}`}>
                  R$ {(faturamentoMes - despesasDoMesTotal).toFixed(2)}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-indigo-50 rounded-xl sm:rounded-2xl"><span className="text-2xl sm:text-3xl">📈</span></div>
            </div>
          </div>

          {/* Gráfico Principal */}
          <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
            <div className="mb-6 sm:mb-8 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">Fluxo Diário</h3>
              <p className="text-xs sm:text-base text-gray-500 mt-1">Acompanhamento de entradas, saídas e resultado</p>
            </div>
            {/* Altura reduzida no mobile para não ocupar a tela toda */}
            <div className="h-[250px] sm:h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosMensais} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCaixa" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} labelFormatter={(label) => `Dia ${label}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}/>
                  <Area type="monotone" dataKey="Caixa" name="Entradas" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorCaixa)" />
                  <Area type="monotone" dataKey="Despesas" name="Saídas" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                  <Area type="monotone" dataKey="Lucro" name="Lucro" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorLucro)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráficos Secundários */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-6 text-center lg:text-left">Top Produtos</h3>
              <div className="flex-1 w-full min-h-[250px] sm:min-h-[300px]">
                {topProdutosMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProdutosMes} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{fill: '#334155', fontSize: 11, fontWeight: 'bold'}} axisLine={false} tickLine={false} width={80} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey="Quantidade" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">Sem vendas.</div>}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2 text-center lg:text-left">Despesas por Categoria</h3>
              <div className="flex-1 w-full min-h-[250px] sm:min-h-[300px]">
                {despesasCategoriaMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={despesasCategoriaMes} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                        {despesasCategoriaMes.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                      <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">Sem despesas.</div>}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-6 text-center lg:text-left">Top Clientes</h3>
              {topClientesMes.length > 0 ? (
                <div className="flex flex-col space-y-3 flex-1 justify-center">
                  {topClientesMes.map((cli, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
                      <div className="flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-black mr-3 shadow-sm">{idx + 1}</span>
                        <span className="font-bold text-gray-800 text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{cli.nome}</span>
                      </div>
                      <span className="font-black text-green-600 text-base sm:text-lg">R$ {cli.totalGasto.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">Sem dados.</div>}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 3: VISÃO ANUAL
      ========================================================================= */}
      {abaAtiva === 'anual' && (
        <div className="animate-fade-in space-y-6 sm:space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Entradas do Ano</p>
                <p className="text-2xl sm:text-3xl font-black text-green-600 mt-1 sm:mt-2 tracking-tight">R$ {faturamentoAno.toFixed(2)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-green-50 rounded-xl sm:rounded-2xl"><span className="text-2xl sm:text-3xl">💵</span></div>
            </div>
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Saídas do Ano</p>
                <p className="text-2xl sm:text-3xl font-black text-red-600 mt-1 sm:mt-2 tracking-tight">R$ {despesasDoAnoTotal.toFixed(2)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-red-50 rounded-xl sm:rounded-2xl"><span className="text-2xl sm:text-3xl">💸</span></div>
            </div>
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Lucro Anual</p>
                <p className={`text-2xl sm:text-3xl font-black mt-1 sm:mt-2 tracking-tight ${(faturamentoAno - despesasDoAnoTotal) >= 0 ? 'text-indigo-600' : 'text-gray-900'}`}>
                  R$ {(faturamentoAno - despesasDoAnoTotal).toFixed(2)}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-indigo-50 rounded-xl sm:rounded-2xl"><span className="text-2xl sm:text-3xl">🏆</span></div>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
            <div className="mb-6 sm:mb-8 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">Balanço Anual</h3>
              <p className="text-xs sm:text-base text-gray-500 mt-1">Entradas vs Saídas e Margem de Lucro</p>
            </div>
            <div className="h-[250px] sm:h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosAnuais} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize:'12px' }} cursor={{fill: '#f8fafc'}} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}/>
                  <Bar dataKey="Caixa" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Despesas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line type="monotone" dataKey="Lucro" name="Lucro" stroke="#6366f1" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff', stroke: '#6366f1'}} activeDot={{r: 6}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2 sm:mb-6 self-center sm:self-start">Modalidade</h3>
              <div className="h-[250px] sm:h-[300px] w-full">
                {pagamentosAno.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pagamentosAno} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                        {pagamentosAno.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize:'12px' }} />
                      <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize:'11px', paddingTop:'10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">Sem entradas.</div>}
              </div>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
              <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2 sm:mb-6 self-center sm:self-start">Despesas Anuais</h3>
              <div className="h-[250px] sm:h-[300px] w-full">
                {despesasCategoriaAno.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={despesasCategoriaAno} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                        {despesasCategoriaAno.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize:'12px' }} />
                      <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize:'11px', paddingTop:'10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-400 font-medium text-sm">Sem despesas.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}