import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../utils/AppProvider';
import { adicionarLinha, editarLinha, deletarLinha } from '../services/googleSheets';

export default function Clientes() {
  const { clientes, setClientes, vendas, setVendas, tokenGoogle, idPlanilha, nomeLoja } = useContext(AppContext);
  
  const estadoInicial = {
    nome: '', cpf: '', dataNascimento: '', 
    telefone: '', email: '', 
    estado: '', cidade: '', endereco: ''
  };
  const [novoCliente, setNovoCliente] = useState(estadoInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [listaEstados, setListaEstados] = useState([]);
  const [listaCidades, setListaCidades] = useState([]);
  const [carregandoIBGE, setCarregandoIBGE] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false); 
  const [mensagemErro, setMensagemErro] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  
  const [clienteHistorico, setClienteHistorico] = useState(null); 
  const [parcelaEmPagamento, setParcelaEmPagamento] = useState(null);
  const [dataPagamentoParcela, setDataPagamentoParcela] = useState(new Date().toISOString().split('T')[0]);
  const [compraExpandida, setCompraExpandida] = useState(null);

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setListaEstados(data))
      .catch(err => console.error("Erro IBGE:", err));
  }, []);

  useEffect(() => {
    if (novoCliente.estado) {
      setCarregandoIBGE(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${novoCliente.estado}/municipios`)
        .then(res => res.json())
        .then(data => {
          setListaCidades(data);
          setCarregandoIBGE(false);
        });
    } else {
      setListaCidades([]);
    }
  }, [novoCliente.estado]);

  const handleChange = (e) => {
    setNovoCliente({ ...novoCliente, [e.target.name]: e.target.value });
    if (mensagemErro) setMensagemErro('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagemErro(''); setMensagemSucesso('');
    
    if (!novoCliente.nome || !novoCliente.telefone || !novoCliente.estado || !novoCliente.cidade) {
      setMensagemErro("Preencha os campos obrigatórios (*)."); return;
    }
    if (!tokenGoogle || !idPlanilha) {
      setMensagemErro("Acesso negado: Faça login com o Google."); return;
    }

    setSalvando(true);
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    const arrayDadosSheet = [
      editandoId || Date.now(), 
      editandoId ? novoCliente.dataCadastro : dataAtual, 
      novoCliente.nome, novoCliente.cpf || '-', 
      novoCliente.dataNascimento || '-', novoCliente.telefone, novoCliente.email || '-',
      novoCliente.estado, novoCliente.cidade, novoCliente.endereco || '-'
    ];

    if (editandoId) {
      const salvo = await editarLinha(tokenGoogle, idPlanilha, 'Clientes', editandoId, arrayDadosSheet);
      if (salvo) {
        setClientes(clientes.map(c => c.id === editandoId ? { ...novoCliente, id: editandoId, dataCadastro: c.dataCadastro } : c));
        setMensagemSucesso("Cliente atualizado com sucesso!");
        setEditandoId(null);
        setMostrarFormulario(false); 
      } else {
        setMensagemErro("Erro ao editar no Google Drive.");
      }
    } else {
      const salvo = await adicionarLinha(tokenGoogle, idPlanilha, 'Clientes', arrayDadosSheet);
      if (salvo) {
        setClientes([...clientes, { ...novoCliente, id: arrayDadosSheet[0], dataCadastro: dataAtual }]);
        setMensagemSucesso("Cliente cadastrado com sucesso!");
        setMostrarFormulario(false); 
      } else {
        setMensagemErro("Erro ao salvar no Google Drive.");
      }
    }

    setNovoCliente(estadoInicial);
    setSalvando(false);
    setTimeout(() => setMensagemSucesso(''), 3000);
  };

  const handleEditar = (cliente) => {
    setNovoCliente(cliente);
    setEditandoId(cliente.id);
    setMostrarFormulario(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleDeletar = async (id) => {
    if (window.confirm("Atenção: Tem certeza que deseja excluir este cliente definitivamente?")) {
      setProcessandoAcao(true);
      const sucesso = await deletarLinha(tokenGoogle, idPlanilha, 'Clientes', id);
      if (sucesso) {
        setClientes(clientes.filter(c => c.id !== id));
        setMensagemSucesso("Cliente removido com sucesso!");
        setTimeout(() => setMensagemSucesso(''), 3000);
      } else {
        alert("Erro ao remover no Google Drive.");
      }
      setProcessandoAcao(false);
    }
  };

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

  const historicoCompras = clienteHistorico 
    ? vendas.filter(v => v.clienteId == clienteHistorico.id).sort((a,b) => b.id - a.id) 
    : [];
  
  const saldoDevedor = historicoCompras.reduce((acc, v) => {
    if (v.formaPagamento === 'Crediário' && v.statusPago !== 'SIM') {
      const numParcelas = Number(v.parcelasCartao) || 1;
      const arrayStatus = parseStatusParcelas(v.statusPago, numParcelas);
      const qtdPagas = arrayStatus.filter(s => s !== 'NÃO').length;
      const valorParcela = (Number(v.total) - Number(v.valorEntrada || 0)) / numParcelas;
      const parcelasRestantes = numParcelas - qtdPagas;
      return acc + (parcelasRestantes * valorParcela);
    }
    return acc;
  }, 0);

  const processarAcaoParcela = async (compra, indice, novaData) => {
    setProcessandoAcao(true);
    const numParcelas = Number(compra.parcelasCartao) || 1;
    let arrayStatus = parseStatusParcelas(compra.statusPago, numParcelas);
    
    arrayStatus[indice] = novaData ? novaData : 'NÃO';
    let novoStatusString = arrayStatus.join('|');
    
    if (arrayStatus.every(s => s !== 'NÃO')) novoStatusString = 'SIM';
    else if (arrayStatus.every(s => s === 'NÃO')) novoStatusString = 'NÃO';

    const valoresAtualizados = [
      compra.id, compra.data, compra.produto, compra.quantidade, compra.valorUnitario, compra.total,
      compra.clienteId, compra.formaPagamento, compra.parcelasCartao, compra.valorEntrada, compra.dataPrimeiraParcela,
      novoStatusString 
    ];
    
    const salvo = await editarLinha(tokenGoogle, idPlanilha, 'Vendas', compra.id, valoresAtualizados);
    
    if (salvo) {
      setVendas(vendas.map(v => v.id === compra.id ? { ...v, statusPago: novoStatusString } : v));
      setParcelaEmPagamento(null); 
    } else {
      alert("Erro ao atualizar a parcela no banco de dados.");
    }
    setProcessandoAcao(false);
  };

  const handleAbrirModalPagamento = (compra, indice, valor) => {
    setParcelaEmPagamento({ compra, indice, valor });
    setDataPagamentoParcela(new Date().toISOString().split('T')[0]); 
  };

  const handleConfirmarPagamento = (e) => {
    e.preventDefault();
    if (!dataPagamentoParcela) return;
    const [ano, mes, dia] = dataPagamentoParcela.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;
    processarAcaoParcela(parcelaEmPagamento.compra, parcelaEmPagamento.indice, dataFormatada);
  };

  const handleEstornarParcela = (compra, indice) => {
    if (window.confirm("Confirma o estorno desta parcela? O saldo devedor irá aumentar.")) {
        processarAcaoParcela(compra, indice, null);
    }
  };

  const handleQuitarTudo = async () => {
    if(!clienteHistorico) return;
    if(saldoDevedor <= 0) { alert("Este cliente não tem saldo devedor."); return; }
    
    if (window.confirm(`Confirma a quitação total (R$ ${saldoDevedor.toFixed(2)})?`)) {
      setProcessandoAcao(true);
      const comprasPendentes = historicoCompras.filter(v => v.formaPagamento === 'Crediário' && v.statusPago !== 'SIM');
      let sucessoGeral = true;

      for (let compra of comprasPendentes) {
        const valoresAtualizados = [
          compra.id, compra.data, compra.produto, compra.quantidade, compra.valorUnitario, compra.total,
          compra.clienteId, compra.formaPagamento, compra.parcelasCartao, compra.valorEntrada, compra.dataPrimeiraParcela,
          'SIM' 
        ];
        const salvo = await editarLinha(tokenGoogle, idPlanilha, 'Vendas', compra.id, valoresAtualizados);
        if(!salvo) sucessoGeral = false;
      }

      if (sucessoGeral) {
        setVendas(vendas.map(v => (v.clienteId == clienteHistorico.id && v.formaPagamento === 'Crediário') ? { ...v, statusPago: 'SIM' } : v));
        alert("Quitação realizada com sucesso!");
      } else {
        alert("Erro ao atualizar o banco de dados.");
      }
      setProcessandoAcao(false);
    }
  };

  const toggleParcelas = (compraId) => setCompraExpandida(compraExpandida === compraId ? null : compraId);

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6">
      
      {/* HEADER PAGE */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Gestão de Clientes</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Gerencie a carteira e os recebimentos da {nomeLoja}</p>
        </div>
        <button 
          onClick={() => { setEditandoId(null); setNovoCliente(estadoInicial); setMostrarFormulario(!mostrarFormulario); }} 
          className={`w-full md:w-auto px-6 py-3 rounded-xl font-bold shadow-sm transition-all duration-200 flex items-center justify-center gap-2 ${mostrarFormulario ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          {mostrarFormulario ? (
            <><span>✕</span> Fechar Formulário</>
          ) : (
            <><span>➕</span> Novo Cliente</>
          )}
        </button>
      </div>
      
      {/* FEEDBACK MESSAGES */}
      {mensagemErro && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm text-sm font-medium flex items-center gap-3">
          <span className="text-lg">⚠️</span> {mensagemErro}
        </div>
      )}
      {mensagemSucesso && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl shadow-sm text-sm font-medium flex items-center gap-3">
          <span className="text-lg">✅</span> {mensagemSucesso}
        </div>
      )}

      {/* FORMULÁRIO DE CLIENTE */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-blue-100 shadow-lg shadow-blue-50 animate-fade-in-down">
          <h3 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-100">
            {editandoId ? '✏️ Atualizar Dados do Cliente' : '👤 Cadastro de Novo Cliente'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col lg:col-span-2">
              <label className="mb-2 text-sm font-semibold text-gray-700">Nome Completo <span className="text-red-500">*</span></label>
              <input type="text" name="nome" value={novoCliente.nome} onChange={handleChange} placeholder="Ex: João da Silva" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" required />
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">CPF</label>
              <input type="text" name="cpf" value={novoCliente.cpf} onChange={handleChange} placeholder="000.000.000-00" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" />
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">Data de Nascimento</label>
              <input type="date" name="dataNascimento" value={novoCliente.dataNascimento} onChange={handleChange} className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800" />
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">Telefone <span className="text-red-500">*</span></label>
              <input type="tel" name="telefone" value={novoCliente.telefone} onChange={handleChange} placeholder="(00) 00000-0000" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" required />
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">E-mail</label>
              <input type="email" name="email" value={novoCliente.email} onChange={handleChange} placeholder="email@exemplo.com" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" />
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">Estado (UF) <span className="text-red-500">*</span></label>
              <select name="estado" value={novoCliente.estado} onChange={handleChange} className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required>
                <option value="">Selecione...</option>
                {listaEstados.map(uf => <option key={uf.id} value={uf.sigla}>{uf.nome}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">Cidade <span className="text-red-500">*</span></label>
              <select name="cidade" value={novoCliente.cidade} onChange={handleChange} disabled={!novoCliente.estado || carregandoIBGE} className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50 transition-all text-sm font-medium text-gray-800" required>
                <option value="">{carregandoIBGE ? 'Carregando...' : 'Selecione...'}</option>
                {listaCidades.map(cid => <option key={cid.id} value={cid.nome}>{cid.nome}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col lg:col-span-4">
              <label className="mb-2 text-sm font-semibold text-gray-700">Endereço Completo</label>
              <input type="text" name="endereco" value={novoCliente.endereco} onChange={handleChange} placeholder="Rua, Número, Bairro, Complemento" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" />
            </div>
          </div>
          
          <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="submit" disabled={salvando} className={`w-full sm:w-auto px-10 py-3.5 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${salvando ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5'}`}>
              {salvando ? (
                <><span className="animate-spin">⏳</span> Salvando...</>
              ) : (
                editandoId ? 'Atualizar Cliente' : 'Salvar Cadastro'
              )}
            </button>
          </div>
        </form>
      )}

      {/* TABELA DE CLIENTES */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest text-gray-500 font-bold">
                <th className="px-6 py-5">Cliente</th>
                <th className="px-6 py-5 hidden md:table-cell">Contato</th>
                <th className="px-6 py-5 hidden lg:table-cell">Localidade</th>
                <th className="px-6 py-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center">
                    <p className="text-gray-400 text-base font-medium">Nenhum cliente cadastrado na base.</p>
                    <p className="text-gray-400 text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
                  </td>
                </tr>
              ) : (
                clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-extrabold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">{cliente.nome}</p>
                      {cliente.cpf && <p className="text-xs text-gray-500 mt-1 font-medium bg-gray-100 px-2 py-0.5 rounded inline-block">CPF: {cliente.cpf}</p>}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-sm font-medium text-gray-700">{cliente.telefone}</p>
                      {cliente.email && <p className="text-xs text-gray-500 mt-1">{cliente.email}</p>}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <p className="text-sm font-medium text-gray-700">{cliente.cidade}</p>
                      <p className="text-xs text-gray-500 mt-1">{cliente.estado}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        <button onClick={() => setClienteHistorico(cliente)} disabled={processandoAcao} className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">💵 Recebimentos</button>
                        <button onClick={() => handleEditar(cliente)} disabled={processandoAcao} className="px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">✏️ Editar</button>
                        <button onClick={() => handleDeletar(cliente.id)} disabled={processandoAcao} className="px-3 py-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">✕</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PRINCIPAL: HISTÓRICO E CARNÊ */}
      {clienteHistorico && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-40 p-3 sm:p-6">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-down border border-gray-100">
            
            {/* Modal Header */}
            <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-white z-10 shadow-sm">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{clienteHistorico.nome}</h2>
                <p className="text-gray-500 text-sm font-medium mt-1">Gestão de Carnês e Histórico</p>
              </div>
              <button onClick={() => setClienteHistorico(null)} className="text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 p-2.5 rounded-xl transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-gray-50/50">
              
              {/* Saldo Devedor Card */}
              <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl mb-8 flex flex-col sm:flex-row justify-between items-center shadow-sm">
                <div className="mb-6 sm:mb-0 text-center sm:text-left">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Saldo Devedor Ativo</p>
                  <p className={`text-4xl sm:text-5xl font-black tracking-tight ${saldoDevedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    R$ {saldoDevedor.toFixed(2)}
                  </p>
                </div>
                <button 
                  onClick={handleQuitarTudo}
                  disabled={processandoAcao || saldoDevedor <= 0}
                  className={`w-full sm:w-auto px-8 py-4 font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${processandoAcao ? 'bg-green-400 text-white cursor-wait' : saldoDevedor > 0 ? 'bg-green-600 hover:bg-green-700 hover:-translate-y-0.5 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  {processandoAcao ? (
                    <><span className="animate-spin">⏳</span> Processando...</>
                  ) : saldoDevedor > 0 ? (
                    <><span>💰</span> Quitar Toda a Dívida</>
                  ) : (
                    <><span>✅</span> Cliente sem Pendências</>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6 px-1">
                <h4 className="font-extrabold text-lg text-gray-800">Extrato de Movimentações</h4>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>
              
              {historicoCompras.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium">Nenhum registro encontrado para este cliente.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historicoCompras.map(compra => {
                    const isCrediario = compra.formaPagamento === 'Crediário';
                    const numParcelas = Number(compra.parcelasCartao) || 1;
                    const arrayStatus = parseStatusParcelas(compra.statusPago, numParcelas);
                    const parcelasPagas = arrayStatus.filter(s => s !== 'NÃO').length;
                    const valorParcela = (Number(compra.total) - Number(compra.valorEntrada || 0)) / numParcelas;
                    const vencimentos = isCrediario ? calcularVencimentos(compra.dataPrimeiraParcela, numParcelas) : [];
                    const isExpanded = compraExpandida === compra.id;

                    return (
                      <div key={compra.id} className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${isCrediario && compra.statusPago !== 'SIM' ? 'border-orange-200 shadow-md ring-1 ring-orange-50' : 'border-gray-200 shadow-sm'}`}>
                        
                        {/* Linha Resumo da Venda */}
                        <div className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-5">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">{compra.data}</span>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${isCrediario ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                                {compra.formaPagamento}
                              </span>
                            </div>
                            <p className="font-extrabold text-gray-900 text-lg leading-tight">{compra.quantidade}x {compra.produto}</p>
                          </div>
                          
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-0 border-gray-100 pt-4 sm:pt-0">
                            <p className="font-black text-gray-900 text-2xl mb-1">R$ {Number(compra.total).toFixed(2)}</p>
                            
                            <div className="flex flex-col sm:items-end gap-2">
                              {compra.statusPago === 'SIM' 
                                ? <span className="text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Totalmente Pago</span> 
                                : <span className="text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Faltam {numParcelas - parcelasPagas} Parc.</span>
                              }
                              
                              {isCrediario && (
                                  <button onClick={() => toggleParcelas(compra.id)} className="text-xs font-bold mt-1 text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-transparent p-0">
                                    {isExpanded ? 'Ocultar Detalhes ⬆' : 'Ver Carnê ⬇'}
                                  </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Detalhes do Carnê */}
                        {isCrediario && isExpanded && (
                          <div className="p-5 sm:p-6 bg-gray-50 border-t border-gray-100 animate-fade-in-down">
                            {Number(compra.valorEntrada) > 0 && (
                              <div className="mb-6 flex items-center bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm w-max max-w-full">
                                <span className="text-green-600 mr-3 text-lg">💵</span>
                                <span className="text-gray-600 text-sm font-medium mr-2">Entrada recebida:</span> 
                                <span className="font-black text-gray-900 text-sm">R$ {Number(compra.valorEntrada).toFixed(2)}</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {vencimentos.map((dataVenc, index) => {
                                const statusDestaParcela = arrayStatus[index];
                                const isPaga = statusDestaParcela !== 'NÃO';
                                const isProxima = !isPaga && (index === 0 || arrayStatus[index - 1] !== 'NÃO');

                                return (
                                  <div key={index} className={`bg-white p-5 rounded-xl border shadow-sm transition-all duration-200 relative overflow-hidden ${isPaga ? 'border-green-200 bg-green-50/50' : (isProxima ? 'border-blue-300 ring-2 ring-blue-50 transform hover:-translate-y-1' : 'border-gray-200 opacity-60')}`}>
                                    {/* Linha indicadora de status no topo do card */}
                                    <div className={`absolute top-0 left-0 w-full h-1 ${isPaga ? 'bg-green-400' : (isProxima ? 'bg-blue-400' : 'bg-gray-200')}`}></div>
                                    
                                    <div className="flex justify-between items-center mb-4 mt-1">
                                      <span className="text-sm font-extrabold text-gray-800">Parcela {index + 1}</span>
                                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Venc: {dataVenc}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                      <span className="font-black text-gray-900 text-xl">R$ {valorParcela.toFixed(2)}</span>
                                      
                                      {isPaga ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-md mb-1.5 flex items-center gap-1">
                                              <span>✅</span> {statusDestaParcela === 'SIM' ? 'Paga' : statusDestaParcela}
                                            </span>
                                            <button onClick={() => handleEstornarParcela(compra, index)} disabled={processandoAcao} className="text-[11px] text-gray-400 hover:text-red-600 font-bold transition-colors">
                                              Desfazer pagamento
                                            </button>
                                        </div>
                                      ) : isProxima ? (
                                        <button onClick={() => handleAbrirModalPagamento(compra, index, valorParcela)} disabled={processandoAcao} className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-lg shadow-sm transition-colors">
                                          Pagar Agora
                                        </button>
                                      ) : (
                                        <span className="text-xs font-bold text-gray-400">Aguardando</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: DATA DE RECEBIMENTO */}
      {parcelaEmPagamento && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm animate-fade-in-down border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
                
                <h3 className="text-xl font-extrabold text-gray-900 mb-1">Registrar Recebimento</h3>
                <p className="text-gray-500 text-sm font-medium mb-6">
                    Parcela {parcelaEmPagamento.indice + 1}
                </p>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-600">Valor Cobrado:</span>
                  <span className="font-black text-green-600 text-2xl">R$ {parcelaEmPagamento.valor.toFixed(2)}</span>
                </div>

                <form onSubmit={handleConfirmarPagamento}>
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Data exata do pagamento:</label>
                        <input 
                            type="date" 
                            required
                            value={dataPagamentoParcela}
                            onChange={(e) => setDataPagamentoParcela(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 transition-shadow shadow-inner"
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setParcelaEmPagamento(null)} disabled={processandoAcao} className="px-5 py-2.5 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={processandoAcao} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors flex items-center gap-2">
                            {processandoAcao ? (
                              <><span className="animate-spin">⏳</span> Salvando...</>
                            ) : (
                              'Confirmar Pagamento'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}