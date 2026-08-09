import { useState, useContext } from 'react';
import { AppContext } from '../utils/AppProvider';
import { adicionarLinha, editarLinha, deletarLinha } from '../services/googleSheets'; 
import AlertaFlutuante from '../components/AlertaFlutuante'; // IMPORTANDO O NOVO ALERTA

export default function Vendas() {
  const { vendas, setVendas, clientes, produtos, setProdutos, tokenGoogle, idPlanilha, nomeLoja } = useContext(AppContext);
  
  const formataDataBrasil = (dataIso) => {
    if (!dataIso) return '';
    if (dataIso.includes('/')) return dataIso;
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const formataDataIso = (dataBrasil) => {
    if (!dataBrasil || dataBrasil === '-') return '';
    if (dataBrasil.includes('-')) return dataBrasil;
    const [dia, mes, ano] = dataBrasil.split('/');
    return `${ano}-${mes}-${dia}`;
  };

  const hoje = new Date();
  
  const estadoInicial = {
    dataVenda: hoje.toISOString().split('T')[0],
    produto: '', quantidade: '', valorUnitario: '',
    clienteId: '', 
    formaPagamento: 'Dinheiro', 
    parcelasCartao: '1',
    parcelasCrediario: '1', 
    valorEntrada: '0',
    dataPrimeiraParcela: ''
  };
  const [novaVenda, setNovaVenda] = useState(estadoInicial);
  const [editandoId, setEditandoId] = useState(null);

  const [filtroMes, setFiltroMes] = useState((hoje.getMonth() + 1).toString().padStart(2, '0'));
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear().toString());

  const [termoBuscaCliente, setTermoBuscaCliente] = useState('');
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);

  const [termoBuscaProduto, setTermoBuscaProduto] = useState('');
  const [mostrarDropdownProduto, setMostrarDropdownProduto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  
  // ESTADOS DOS ALERTAS
  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });

  // =========================================================================
  // FUNÇÃO AUXILIAR PARA DISPARAR ALERTAS
  // =========================================================================
  const mostrarAlerta = (mensagem, tipo = 'sucesso') => {
    setAlerta({ visivel: true, mensagem, tipo });
  };

  const fecharAlerta = () => {
    setAlerta({ ...alerta, visivel: false });
  };

  // =========================================================================
  // MANIPULAÇÃO DE FORMULÁRIO E BUSCAS
  // =========================================================================
  const handleChange = (e) => {
    setNovaVenda({ ...novaVenda, [e.target.name]: e.target.value });
  };

  const clientesFiltrados = clientes.filter(c => {
    const buscaLimpa = termoBuscaCliente.toLowerCase().trim();
    const nomeBate = c.nome.toLowerCase().includes(buscaLimpa);
    const cpfBate = c.cpf && c.cpf.replace(/\D/g, '').includes(termoBuscaCliente.replace(/\D/g, ''));
    return nomeBate || cpfBate;
  });

  const selecionarCliente = (cliente) => {
    if (cliente) {
      setNovaVenda({ ...novaVenda, clienteId: cliente.id });
      setTermoBuscaCliente(`${cliente.nome} (CPF: ${cliente.cpf || 'N/A'})`);
    } else {
      setNovaVenda({ ...novaVenda, clienteId: '' });
      setTermoBuscaCliente('');
    }
    setMostrarDropdownCliente(false);
  };

  const produtosFiltrados = produtos.filter(p => 
    p.nome.toLowerCase().includes(termoBuscaProduto.toLowerCase().trim())
  );

  const selecionarProduto = (produto) => {
    if (produto) {
      setNovaVenda({ ...novaVenda, produto: produto.nome, valorUnitario: produto.preco.toString() });
      setTermoBuscaProduto(produto.nome);
    } else {
      setNovaVenda({ ...novaVenda, produto: termoBuscaProduto, valorUnitario: '' });
    }
    setMostrarDropdownProduto(false);
  };

  const atualizarEstoque = async (nomeProduto, diferencaQtd) => {
    if (diferencaQtd === 0) return;
    const prod = produtos.find(p => p.nome === nomeProduto);
    if (prod) {
      const novaQtd = Number(prod.quantidade) + diferencaQtd;
      const arrayEstoque = [prod.id, prod.dataCadastro, prod.nome, novaQtd, prod.preco];
      const sucesso = await editarLinha(tokenGoogle, idPlanilha, 'Estoque', prod.id, arrayEstoque);
      if (sucesso) {
        setProdutos(prev => prev.map(p => p.id === prod.id ? { ...p, quantidade: novaQtd } : p));
      }
    }
  };

  // =========================================================================
  // SALVAR / EDITAR / DELETAR
  // =========================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    fecharAlerta();
    
    if (!novaVenda.dataVenda || !novaVenda.produto || !novaVenda.quantidade || !novaVenda.valorUnitario) {
      mostrarAlerta("Preencha a Data, Produto, Quantidade e Valor.", "erro"); return;
    }

    const qtd = Number(novaVenda.quantidade);
    const valorUnit = Number(novaVenda.valorUnitario);
    const totalVendaCalc = qtd * valorUnit;
    
    if (qtd <= 0) { mostrarAlerta("A quantidade deve ser maior que zero!", "erro"); return; }
    if (valorUnit < 0) { mostrarAlerta("O valor unitário não pode ser negativo!", "erro"); return; }
    
    if (novaVenda.formaPagamento === 'Crediário') {
      if (!novaVenda.clienteId) { mostrarAlerta("Vendas no Crediário exigem um Cliente vinculado!", "erro"); return; }
      if (!novaVenda.dataPrimeiraParcela) { mostrarAlerta("Defina a data de vencimento da primeira parcela.", "erro"); return; }
      if (Number(novaVenda.valorEntrada) < 0) { mostrarAlerta("O valor de entrada não pode ser negativo!", "erro"); return; }
      if (Number(novaVenda.valorEntrada) >= totalVendaCalc) { mostrarAlerta("A entrada não pode ser maior ou igual ao total da venda.", "erro"); return; }
    }

    const prodNoEstoque = produtos.find(p => p.nome === novaVenda.produto);
    if (prodNoEstoque && !editandoId) {
       if (Number(prodNoEstoque.quantidade) < qtd) {
          if (!window.confirm(`Atenção: Só restam ${prodNoEstoque.quantidade}x deste item. Deseja prosseguir e negativar o estoque?`)) {
             return;
          }
       }
    }

    if (!tokenGoogle || !idPlanilha) { mostrarAlerta("Acesso negado: Faça login com o Google.", "erro"); return; }

    setSalvando(true);

    const idDaVenda = editandoId || Date.now();
    const dataConvertida = formataDataBrasil(novaVenda.dataVenda);
    const pago = novaVenda.formaPagamento === 'Crediário' ? 'NÃO' : 'SIM'; 
    const numParcelas = novaVenda.formaPagamento === 'Cartão' ? novaVenda.parcelasCartao : (novaVenda.formaPagamento === 'Crediário' ? novaVenda.parcelasCrediario : '-');

    const arrayDadosSheet = [
      idDaVenda, dataConvertida, novaVenda.produto, qtd, valorUnit, totalVendaCalc,
      novaVenda.clienteId || 'AVULSO', novaVenda.formaPagamento, numParcelas,
      novaVenda.formaPagamento === 'Crediário' ? Number(novaVenda.valorEntrada) : 0,
      novaVenda.formaPagamento === 'Crediário' ? formataDataBrasil(novaVenda.dataPrimeiraParcela) : '-',
      pago
    ];

    if (editandoId) {
      const vendaAntiga = vendas.find(v => v.id === editandoId);
      const salvo = await editarLinha(tokenGoogle, idPlanilha, 'Vendas', editandoId, arrayDadosSheet);
      
      if (salvo) {
        if (vendaAntiga.produto === novaVenda.produto) {
           const diferencaEstoque = Number(vendaAntiga.quantidade) - qtd; 
           await atualizarEstoque(novaVenda.produto, diferencaEstoque);
        } else {
           await atualizarEstoque(vendaAntiga.produto, Number(vendaAntiga.quantidade)); 
           await atualizarEstoque(novaVenda.produto, -qtd); 
        }

        setVendas(vendas.map(v => v.id === editandoId ? { 
          ...novaVenda, id: editandoId, data: dataConvertida, quantidade: qtd, valorUnitario: valorUnit, total: totalVendaCalc, 
          parcelasCartao: numParcelas, dataPrimeiraParcela: arrayDadosSheet[10], statusPago: pago 
        } : v));
        mostrarAlerta("Venda atualizada com sucesso!");
        cancelarEdicao();
      } else { mostrarAlerta("Erro ao editar no Drive.", "erro"); }

    } else {
      const salvo = await adicionarLinha(tokenGoogle, idPlanilha, 'Vendas', arrayDadosSheet);
      if (salvo) {
        await atualizarEstoque(novaVenda.produto, -qtd);

        setVendas([...vendas, { 
          ...novaVenda, id: idDaVenda, data: dataConvertida, quantidade: qtd, valorUnitario: valorUnit, total: totalVendaCalc, 
          parcelasCartao: numParcelas, dataPrimeiraParcela: arrayDadosSheet[10], statusPago: pago 
        }]);
        mostrarAlerta("Venda registrada e Estoque debitado!");
        cancelarEdicao();
      } else { mostrarAlerta("Erro ao registrar a venda.", "erro"); }
    }
    
    setSalvando(false);
  };

  const handleEditar = (venda) => {
    const clienteObj = clientes.find(c => c.id == venda.clienteId);
    setTermoBuscaCliente(clienteObj ? `${clienteObj.nome} (CPF: ${clienteObj.cpf || 'N/A'})` : '');
    setTermoBuscaProduto(venda.produto);

    setNovaVenda({
      dataVenda: formataDataIso(venda.data),
      produto: venda.produto,
      quantidade: venda.quantidade,
      valorUnitario: venda.valorUnitario,
      clienteId: venda.clienteId === 'AVULSO' ? '' : venda.clienteId,
      formaPagamento: venda.formaPagamento,
      parcelasCartao: venda.formaPagamento === 'Cartão' ? venda.parcelasCartao : '1',
      parcelasCrediario: venda.formaPagamento === 'Crediário' ? venda.parcelasCartao : '1',
      valorEntrada: venda.valorEntrada || '0',
      dataPrimeiraParcela: formataDataIso(venda.dataPrimeiraParcela)
    });
    setEditandoId(venda.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = async (id) => {
    if (window.confirm("Atenção: Excluir esta venda apagará seu registro financeiro. Continuar?")) {
      setProcessandoAcao(true);
      
      const vendaExcluida = vendas.find(v => v.id === id);
      const sucesso = await deletarLinha(tokenGoogle, idPlanilha, 'Vendas', id);
      
      if (sucesso) {
        setVendas(vendas.filter(v => v.id !== id));
        
        if (vendaExcluida && window.confirm(`Deseja devolver as ${vendaExcluida.quantidade} unidades de "${vendaExcluida.produto}" ao Estoque?`)) {
            await atualizarEstoque(vendaExcluida.produto, Number(vendaExcluida.quantidade));
            mostrarAlerta("Venda removida e itens devolvidos ao estoque!");
        } else {
            mostrarAlerta("Venda removida definitivamente.");
        }
      } else {
        alert("Erro ao remover no Google Drive.");
      }
      setProcessandoAcao(false);
    }
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNovaVenda(estadoInicial);
    setTermoBuscaCliente('');
    setTermoBuscaProduto('');
  };

  const getNomeCliente = (id) => {
    if (id === 'AVULSO' || !id) return 'Venda Avulsa';
    const c = clientes.find(cli => cli.id == id);
    return c ? c.nome : 'Desconhecido';
  };

  const anosDisponiveis = [...new Set([
    ...vendas.map(v => v.data?.split('/')[2]).filter(Boolean),
    hoje.getFullYear().toString()
  ])].sort((a, b) => b - a);

  const vendasFiltradasDaTabela = vendas.filter(v => {
    if (!v.data) return false;
    const [vDia, vMes, vAno] = v.data.split('/');
    return vMes === filtroMes && vAno === filtroAno;
  }).sort((a, b) => b.id - a.id);

  const totalArrecadadoMes = vendasFiltradasDaTabela.reduce((acc, v) => {
    if (v.statusPago === 'SIM' || v.formaPagamento !== 'Crediário') return acc + (v.quantidade * v.valorUnitario);
    if (v.formaPagamento === 'Crediário') return acc + Number(v.valorEntrada || 0); 
    return acc;
  }, 0);

  const qtdAtual = Number(novaVenda.quantidade) || 0;
  const valorUnitAtual = Number(novaVenda.valorUnitario) || 0;
  const totalVendaAtual = qtdAtual * valorUnitAtual;
  const entradaAtual = Number(novaVenda.valorEntrada) || 0;
  const parcelasCrediarioAtual = Number(novaVenda.parcelasCrediario) || 1;
  const valorParcelaAtual = (totalVendaAtual - entradaAtual) / parcelasCrediarioAtual;

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      
      {/* RENDERIZAÇÃO DO COMPONENTE FLUTUANTE DE ALERTA */}
      {alerta.visivel && (
        <AlertaFlutuante 
          mensagem={alerta.mensagem} 
          tipo={alerta.tipo} 
          onClose={fecharAlerta} 
        />
      )}

      {/* HEADER PAGE */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between xl:items-center gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">PDV / Lançamentos</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Registre as saídas da {nomeLoja}</p>
        </div>
      </div>

      {/* FORMULÁRIO DE CHECKOUT */}
      <form onSubmit={handleSubmit} className={`bg-white p-6 sm:p-8 rounded-2xl border shadow-lg transition-all duration-300 animate-fade-in-down ${editandoId ? 'border-yellow-300 ring-4 ring-yellow-50 shadow-yellow-100/50' : 'border-green-100 shadow-green-50/20'}`}>
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-3">
          <h3 className="text-xl font-bold text-gray-800">
            {editandoId ? '✏️ Modo de Edição de Venda' : '1. Detalhes do Item'}
          </h3>
          {editandoId && (
            <button type="button" onClick={cancelarEdicao} className="text-sm text-red-500 hover:text-red-700 hover:underline font-bold transition-colors">
              Cancelar Edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-semibold text-gray-700">Data da Venda <span className="text-red-500">*</span></label>
            <input type="date" name="dataVenda" value={novaVenda.dataVenda} onChange={handleChange} className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required />
          </div>
          
          <div className="flex flex-col md:col-span-2 relative">
            <label className="mb-2 text-sm font-semibold text-gray-700">Produto <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder="Buscar no estoque..."
              value={termoBuscaProduto}
              onChange={(e) => {
                setTermoBuscaProduto(e.target.value);
                setNovaVenda({ ...novaVenda, produto: e.target.value });
                setMostrarDropdownProduto(true);
              }}
              onFocus={() => setMostrarDropdownProduto(true)}
              className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400"
              required 
            />
            
            {mostrarDropdownProduto && <div className="fixed inset-0 z-10" onClick={() => setMostrarDropdownProduto(false)}></div>}

            {mostrarDropdownProduto && (
              <ul className="absolute z-20 w-full bg-white border border-gray-200 shadow-xl max-h-56 overflow-y-auto rounded-xl top-[75px] divide-y divide-gray-50">
                <li className="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-500 italic transition-colors text-sm" onClick={() => selecionarProduto(null)}>
                  -- Produto Avulso (Digitar Manualmente) --
                </li>
                {produtosFiltrados.map(p => (
                  <li key={p.id} className="px-5 py-3 hover:bg-green-50 cursor-pointer transition-colors flex justify-between items-center" onClick={() => selecionarProduto(p)}>
                    <span className="font-bold text-gray-800 text-sm">{p.nome}</span>
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      Estoque: {p.quantidade} | R$ {p.preco.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col">
            <label className="mb-2 text-sm font-semibold text-gray-700">Qtd. <span className="text-red-500">*</span></label>
            <input type="number" name="quantidade" min="1" value={novaVenda.quantidade} onChange={handleChange} placeholder="1" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required />
          </div>
          
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-semibold text-gray-700">Valor Unit. (R$) <span className="text-red-500">*</span></label>
            <input type="number" name="valorUnitario" step="0.01" min="0" value={novaVenda.valorUnitario} onChange={handleChange} placeholder="99.90" className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required />
          </div>
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-3">2. Pagamento e Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <div className="flex flex-col lg:col-span-2 relative">
            <label className="mb-2 text-sm font-semibold text-gray-700">Vincular Cliente (Opcional)</label>
            <input 
              type="text" 
              placeholder="Digite o nome ou CPF para buscar..."
              value={termoBuscaCliente}
              onChange={(e) => {
                setTermoBuscaCliente(e.target.value);
                setMostrarDropdownCliente(true);
                if(novaVenda.clienteId) setNovaVenda({ ...novaVenda, clienteId: '' }); 
              }}
              onFocus={() => setMostrarDropdownCliente(true)}
              className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400"
            />
            
            {mostrarDropdownCliente && <div className="fixed inset-0 z-10" onClick={() => setMostrarDropdownCliente(false)}></div>}

            {mostrarDropdownCliente && (
              <ul className="absolute z-20 w-full bg-white border border-gray-200 shadow-xl max-h-56 overflow-y-auto rounded-xl top-[75px] divide-y divide-gray-50">
                <li className="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-500 italic transition-colors text-sm" onClick={() => selecionarCliente(null)}>
                  -- Venda Avulsa (Sem Cliente) --
                </li>
                {clientesFiltrados.map(c => (
                  <li key={c.id} className="px-5 py-3 hover:bg-green-50 cursor-pointer transition-colors flex flex-col justify-center" onClick={() => selecionarCliente(c)}>
                    <div className="font-bold text-gray-800 text-sm">{c.nome}</div>
                    <div className="text-[11px] font-medium text-gray-500 mt-0.5">CPF: {c.cpf || 'Não cadastrado'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col">
            <label className="mb-2 text-sm font-semibold text-gray-700">Modalidade</label>
            <select name="formaPagamento" value={novaVenda.formaPagamento} onChange={handleChange} className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-extrabold text-green-700">
              <option value="Dinheiro">💵 Dinheiro</option>
              <option value="Pix">💠 Pix</option>
              <option value="Cartão">💳 Cartão</option>
              <option value="Crediário">📝 Crediário (Fiado)</option>
            </select>
          </div>

          {novaVenda.formaPagamento === 'Cartão' && (
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-semibold text-gray-700">Parcelas</label>
              <select name="parcelasCartao" value={novaVenda.parcelasCartao} onChange={handleChange} className="px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all text-sm font-medium text-gray-800">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num}x {num===1?'(À vista)':''}</option>)}
              </select>
            </div>
          )}

          {novaVenda.formaPagamento === 'Crediário' && (
            <>
              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-gray-700">Parcelas</label>
                <select name="parcelasCrediario" value={novaVenda.parcelasCrediario} onChange={handleChange} className="px-4 py-3 bg-yellow-50/50 rounded-xl border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-white transition-all text-sm font-medium text-gray-800">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num}x</option>)}
                </select>
              </div>
              <div className="flex flex-col lg:col-span-1">
                <label className="mb-2 text-sm font-semibold text-gray-700">Entrada (R$)</label>
                <input type="number" name="valorEntrada" step="0.01" min="0" value={novaVenda.valorEntrada} onChange={handleChange} className="px-4 py-3 bg-yellow-50/50 rounded-xl border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-white transition-all text-sm font-medium text-gray-800" />
              </div>
              <div className="flex flex-col lg:col-span-2">
                <label className="mb-2 text-sm font-semibold text-gray-700">Venc. 1ª Parcela <span className="text-red-500">*</span></label>
                <input type="date" name="dataPrimeiraParcela" value={novaVenda.dataPrimeiraParcela} onChange={handleChange} className="px-4 py-3 bg-yellow-50/50 rounded-xl border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-white transition-all text-sm font-medium text-gray-800" />
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-between border-t border-gray-100 pt-8 gap-6">
          <div className="text-base text-gray-500 text-center md:text-left font-semibold">
            Total a Cobrar: 
            <span className="font-black text-4xl text-gray-900 ml-3 block sm:inline-block">
              R$ {totalVendaAtual.toFixed(2)}
            </span>
            
            {novaVenda.formaPagamento === 'Crediário' && totalVendaAtual > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800 shadow-sm text-left">
                <p className="font-extrabold mb-2 uppercase tracking-widest text-[11px] text-yellow-700">🧾 Resumo do Fiado</p>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">Entrada recebida:</span>
                  <span className="font-black">R$ {entradaAtual.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Restante parcelado:</span>
                  <span className="font-black text-red-600">{parcelasCrediarioAtual}x de R$ {valorParcelaAtual > 0 ? valorParcelaAtual.toFixed(2) : '0.00'}</span>
                </div>
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={salvando} 
            className={`w-full md:w-auto px-12 py-4.5 text-white text-lg font-bold rounded-xl shadow-lg transition-all ${salvando ? 'bg-gray-400 cursor-wait' : (editandoId ? 'bg-yellow-500 hover:bg-yellow-600 hover:-translate-y-0.5' : 'bg-green-600 hover:bg-green-700 hover:-translate-y-0.5')}`}
          >
            {salvando ? (
              <><span className="animate-spin mr-2">⏳</span> Processando...</>
            ) : (
              editandoId ? 'Atualizar Venda' : 'Finalizar Venda'
            )}
          </button>
        </div>
      </form>

      {/* ========================================================================================= */}
      {/* HISTÓRICO DE VENDAS COM FILTRO */}
      {/* ========================================================================================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 mt-12 gap-4">
        <h3 className="text-2xl font-extrabold text-gray-900">Histórico de Saídas</h3>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <div className="flex items-center justify-between sm:justify-start space-x-3 bg-green-50 px-5 py-2.5 rounded-xl border border-green-200 shadow-sm w-full sm:w-auto">
            <span className="text-green-800 font-bold text-sm">Caixa Mensal:</span>
            <span className="text-green-700 font-black text-lg">R$ {totalArrecadadoMes.toFixed(2)}</span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full sm:w-auto bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 px-4 py-2.5 font-bold shadow-sm cursor-pointer">
              <option value="01">Jan</option><option value="02">Fev</option><option value="03">Mar</option>
              <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
              <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
              <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
            </select>
            <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full sm:w-auto bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 px-4 py-2.5 font-bold shadow-sm cursor-pointer">
              {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest text-gray-500 font-bold">
                <th className="p-5">Data</th>
                <th className="p-5">Produto</th>
                <th className="p-5 hidden md:table-cell">Cliente</th>
                <th className="p-5 text-center">Pagamento</th>
                <th className="p-5 text-right">Total</th>
                <th className="p-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendasFiltradasDaTabela.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400 font-medium text-base">
                    Nenhuma venda encontrada no filtro de {filtroMes}/{filtroAno}.
                  </td>
                </tr>
              ) : (
                vendasFiltradasDaTabela.map((venda) => (
                  <tr key={venda.id} className="hover:bg-green-50/40 transition-colors group">
                    <td className="p-5 text-gray-500 text-sm font-semibold">{venda.data}</td>
                    <td className="p-5">
                      <p className="font-extrabold text-gray-900 text-base">{venda.produto}</p>
                      <p className="text-xs font-semibold text-gray-500 mt-1">{venda.quantidade}x R$ {Number(venda.valorUnitario).toFixed(2)}</p>
                    </td>
                    <td className="p-5 text-gray-700 hidden md:table-cell font-medium">{getNomeCliente(venda.clienteId)}</td>
                    
                    <td className="p-5 text-center">
                      <span className={`px-3 py-1.5 text-xs font-bold rounded-lg tracking-wide ${venda.formaPagamento === 'Crediário' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {venda.formaPagamento} {(venda.formaPagamento === 'Cartão' || venda.formaPagamento === 'Crediário') ? `(${venda.parcelasCartao || 1}x)` : ''}
                      </span>
                      
                      {venda.statusPago === 'NÃO' && <span className="block mt-2 text-[10px] font-bold text-red-600 uppercase tracking-widest">PENDENTE</span>}
                      
                      {venda.formaPagamento === 'Crediário' && (
                        <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 w-full min-w-[140px] shadow-sm text-left">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-medium">Entrada:</span>
                            <span className="font-black text-gray-800">R$ {Number(venda.valorEntrada || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">1ª Parc:</span>
                            <span className="font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">{venda.dataPrimeiraParcela}</span>
                          </div>
                        </div>
                      )}
                    </td>
                    
                    <td className="p-5 font-black text-gray-900 text-right text-lg">
                      R$ {(venda.quantidade * venda.valorUnitario).toFixed(2)}
                    </td>
                    
                    <td className="p-5 text-center space-x-2">
                      <div className="flex justify-center items-center h-full pt-2">
                        <button onClick={() => handleEditar(venda)} disabled={processandoAcao} className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50" title="Editar Venda">✏️ Editar</button>
                        <button onClick={() => handleDeletar(venda.id)} disabled={processandoAcao} className="px-3 py-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ml-2" title="Excluir Venda">✕</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}