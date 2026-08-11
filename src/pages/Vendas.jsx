import { useState, useContext } from 'react';
import { AppContext } from '../utils/AppProvider';
import { adicionarLinha, editarLinha, deletarLinha } from '../services/googleSheets'; 
import AlertaFlutuante from '../components/AlertaFlutuante';

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

  // MÁSCARAS DE VISUALIZAÇÃO
  const mascaraCPF = (cpf) => {
    if (!cpf) return '';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length === 11) {
      return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  const handleMascaraMoeda = (valor) => {
    const v = valor.replace(/\D/g, '');
    if (!v) return '';
    return (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const converterMoedaParaNumero = (valorString) => {
    if (!valorString) return 0;
    return Number(valorString.replace(/\./g, '').replace(',', '.'));
  };

  const hoje = new Date();
  
  // =========================================================================
  // ESTADOS DO PDV / CARRINHO
  // =========================================================================
  const [editandoId, setEditandoId] = useState(null);
  
  // Cliente
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [termoBuscaCliente, setTermoBuscaCliente] = useState('');
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);

  // Carrinho
  const [carrinho, setCarrinho] = useState([]);
  const [prodAtual, setProdAtual] = useState('');
  const [qtdAtual, setQtdAtual] = useState('1');
  const [precoAtual, setPrecoAtual] = useState(''); 
  const [termoBuscaProduto, setTermoBuscaProduto] = useState('');
  const [mostrarDropdownProduto, setMostrarDropdownProduto] = useState(false);

  // Pagamento
  const [dataVenda, setDataVenda] = useState(hoje.toISOString().split('T')[0]);
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro');
  const [parcelasCartao, setParcelasCartao] = useState('1');
  const [parcelasCrediario, setParcelasCrediario] = useState('1');
  const [valorEntrada, setValorEntrada] = useState(''); 
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState('');

  // Filtros da Tabela de Histórico
  const [filtroMes, setFiltroMes] = useState((hoje.getMonth() + 1).toString().padStart(2, '0'));
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear().toString());

  // Controles de Tela
  const [salvando, setSalvando] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });

  const mostrarAlerta = (mensagem, tipo = 'sucesso') => setAlerta({ visivel: true, mensagem, tipo });
  const fecharAlerta = () => setAlerta({ ...alerta, visivel: false });

  // =========================================================================
  // LÓGICA DE CLIENTES E PRODUTOS (DROPDOWNS)
  // =========================================================================
  const clientesFiltrados = clientes.filter(c => {
    const buscaLimpa = termoBuscaCliente.toLowerCase().trim();
    return c.nome.toLowerCase().includes(buscaLimpa) || (c.cpf && c.cpf.replace(/\D/g, '').includes(termoBuscaCliente.replace(/\D/g, '')));
  });

  const selecionarCliente = (cliente) => {
    if (cliente) {
      setClienteSelecionado(cliente);
      setTermoBuscaCliente(`${cliente.nome} (CPF: ${mascaraCPF(cliente.cpf) || 'N/A'})`);
    } else {
      setClienteSelecionado(null);
      setTermoBuscaCliente('');
    }
    setMostrarDropdownCliente(false);
  };

  const produtosFiltrados = produtos.filter(p => 
    p.nome.toLowerCase().includes(termoBuscaProduto.toLowerCase().trim())
  );

  const selecionarProduto = (produto) => {
    if (produto) {
      setProdAtual(produto.nome);
      setPrecoAtual(Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setTermoBuscaProduto(produto.nome);
    } else {
      setProdAtual(termoBuscaProduto);
      setPrecoAtual('');
    }
    setMostrarDropdownProduto(false);
  };

  // =========================================================================
  // LÓGICA DO CARRINHO
  // =========================================================================
  const adicionarAoCarrinho = () => {
    if (!prodAtual || !qtdAtual || !precoAtual) {
      mostrarAlerta("Preencha o Nome, Qtd e Valor do produto para adicionar.", "erro"); return;
    }
    const q = Number(qtdAtual);
    const p = converterMoedaParaNumero(precoAtual);
    
    if (q <= 0 || p < 0) {
      mostrarAlerta("Quantidade ou preço inválidos.", "erro"); return;
    }

    // Verifica se já existe o mesmo produto com o mesmo preço no carrinho
    const indexExistente = carrinho.findIndex(item => item.produto === prodAtual && item.valorUnitario === p);

    if (indexExistente >= 0) {
      // Apenas soma a quantidade no item já existente
      const novoCarrinho = [...carrinho];
      novoCarrinho[indexExistente].quantidade += q;
      novoCarrinho[indexExistente].total = novoCarrinho[indexExistente].quantidade * p;
      setCarrinho(novoCarrinho);
    } else {
      // Adiciona como nova linha no carrinho
      setCarrinho([...carrinho, {
        idTemp: Date.now() + Math.random(),
        produto: prodAtual,
        quantidade: q,
        valorUnitario: p,
        total: q * p
      }]);
    }

    setProdAtual('');
    setQtdAtual('1');
    setPrecoAtual('');
    setTermoBuscaProduto('');
  };

  const removerDoCarrinho = (idTemp) => {
    setCarrinho(carrinho.filter(item => item.idTemp !== idTemp));
  };

  const totalVendaAtual = carrinho.reduce((acc, item) => acc + item.total, 0);

  // =========================================================================
  // SALVAR / EDITAR NO DRIVE
  // =========================================================================
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    fecharAlerta();
    
    if (carrinho.length === 0) {
      mostrarAlerta("O carrinho está vazio! Adicione produtos antes de finalizar.", "erro"); return;
    }
    if (!dataVenda) {
      mostrarAlerta("A data da venda é obrigatória.", "erro"); return;
    }
    
    const valorEntradaNumerico = converterMoedaParaNumero(valorEntrada);

    if (formaPagamento === 'Crediário') {
      if (!clienteSelecionado) { mostrarAlerta("Vendas no Crediário exigem um Cliente vinculado!", "erro"); return; }
      if (!dataPrimeiraParcela) { mostrarAlerta("Defina a data de vencimento da 1ª parcela.", "erro"); return; }
      if (valorEntradaNumerico < 0) { mostrarAlerta("O valor de entrada não pode ser negativo!", "erro"); return; }
      if (valorEntradaNumerico >= totalVendaAtual) { mostrarAlerta("A entrada não pode quitar 100% da venda.", "erro"); return; }
    }

    if (!tokenGoogle || !idPlanilha) { mostrarAlerta("Acesso negado: Faça login com o Google.", "erro"); return; }

    setSalvando(true);

    // Agrupa a quantidade total que será abatida por Produto (Evita erro de Closure do React)
    const resumoEstoqueParaAbater = {};
    carrinho.forEach(item => {
        if(!resumoEstoqueParaAbater[item.produto]) resumoEstoqueParaAbater[item.produto] = 0;
        resumoEstoqueParaAbater[item.produto] += item.quantidade;
    });

    if (!editandoId) {
        for (let nomeProd in resumoEstoqueParaAbater) {
            const prodEstoque = produtos.find(p => p.nome === nomeProd);
            const qtdRequerida = resumoEstoqueParaAbater[nomeProd];
            
            if (prodEstoque && Number(prodEstoque.quantidade) < qtdRequerida) {
                if (!window.confirm(`Atenção: Só restam ${prodEstoque.quantidade}x de "${nomeProd}". Prosseguir e negativar o estoque?`)) {
                    setSalvando(false);
                    return;
                }
            }
        }
    }

    if (editandoId) {
      const vendaAntiga = vendas.find(v => v.id === editandoId);
      if (vendaAntiga) {
          console.warn("Aviso: Edição de venda agrupada não ajusta automaticamente o estoque antigo.");
      }
    }

    // ==========================================
    // MAGIA DO AGRUPAMENTO (CARRINHO UNIFICADO)
    // ==========================================
    const nomeProdutoAgrupado = carrinho.map(item => `${item.quantidade}x ${item.produto}`).join(' | ');
    const quantidadeAgrupada = carrinho.length === 1 ? carrinho[0].quantidade : 1; 
    const valorUnitarioAgrupado = carrinho.length === 1 ? carrinho[0].valorUnitario : totalVendaAtual;
    const totalAgrupado = totalVendaAtual;

    const numParcelas = formaPagamento === 'Cartão' ? parcelasCartao : (formaPagamento === 'Crediário' ? parcelasCrediario : '-');
    const pago = formaPagamento === 'Crediário' ? 'NÃO' : 'SIM';
    
    const idParaSalvar = editandoId || Date.now();

    const arrayDadosSheet = [
        idParaSalvar,
        formataDataBrasil(dataVenda),
        nomeProdutoAgrupado,
        quantidadeAgrupada,
        valorUnitarioAgrupado,
        totalAgrupado,
        clienteSelecionado ? clienteSelecionado.id : 'AVULSO',
        formaPagamento,
        numParcelas,
        formaPagamento === 'Crediário' ? valorEntradaNumerico : 0,
        formaPagamento === 'Crediário' ? formataDataBrasil(dataPrimeiraParcela) : '-',
        pago
    ];

    if (editandoId) {
        await editarLinha(tokenGoogle, idPlanilha, 'Vendas', idParaSalvar, arrayDadosSheet);
    } else {
        await adicionarLinha(tokenGoogle, idPlanilha, 'Vendas', arrayDadosSheet);
    }
    
    // Agora debita o estoque de forma agrupada e segura (1 request por produto total)
    if (!editandoId) {
        for (let nomeProd in resumoEstoqueParaAbater) {
            await atualizarEstoque(nomeProd, -resumoEstoqueParaAbater[nomeProd]);
        }
    }

    const novoRegistro = {
        id: idParaSalvar,
        data: formataDataBrasil(dataVenda),
        produto: nomeProdutoAgrupado,
        quantidade: quantidadeAgrupada,
        valorUnitario: valorUnitarioAgrupado,
        total: totalAgrupado,
        clienteId: clienteSelecionado ? clienteSelecionado.id : 'AVULSO',
        formaPagamento,
        parcelasCartao: numParcelas,
        valorEntrada: formaPagamento === 'Crediário' ? valorEntradaNumerico : 0,
        dataPrimeiraParcela: formaPagamento === 'Crediário' ? formataDataBrasil(dataPrimeiraParcela) : '-',
        statusPago: pago
    };

    if (editandoId) {
        setVendas([...vendas.filter(v => v.id !== editandoId), novoRegistro]);
        mostrarAlerta("Venda atualizada com sucesso!");
    } else {
        setVendas([...vendas, novoRegistro]);
        mostrarAlerta("Venda registrada e estoque atualizado!");
    }
    
    cancelarEdicao();
    setSalvando(false);
  };

  const handleEditar = (venda) => {
    const clienteObj = clientes.find(c => c.id == venda.clienteId);
    setClienteSelecionado(clienteObj || null);
    setTermoBuscaCliente(clienteObj ? `${clienteObj.nome} (CPF: ${mascaraCPF(clienteObj.cpf) || 'N/A'})` : '');
    
    const isAgrupada = venda.produto.includes('|');
    if (isAgrupada) {
       setCarrinho([{
         idTemp: venda.id,
         produto: "Pacote Agrupado (Não editável unitariamente)",
         quantidade: 1,
         valorUnitario: Number(venda.total),
         total: Number(venda.total)
       }]);
    } else {
       const nomeLimpo = venda.produto.replace(/^\d+x\s/, '');
       setCarrinho([{
         idTemp: venda.id,
         produto: nomeLimpo,
         quantidade: Number(venda.quantidade),
         valorUnitario: Number(venda.valorUnitario),
         total: Number(venda.quantidade) * Number(venda.valorUnitario)
       }]);
    }

    setDataVenda(formataDataIso(venda.data));
    setFormaPagamento(venda.formaPagamento);
    setParcelasCartao(venda.formaPagamento === 'Cartão' ? venda.parcelasCartao : '1');
    setParcelasCrediario(venda.formaPagamento === 'Crediário' ? venda.parcelasCartao : '1');
    
    setValorEntrada(venda.valorEntrada ? Number(venda.valorEntrada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    setDataPrimeiraParcela(formataDataIso(venda.dataPrimeiraParcela));
    
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
        if (vendaExcluida && !vendaExcluida.produto.includes('|') && window.confirm(`Deseja devolver as ${vendaExcluida.quantidade} unidades ao Estoque?`)) {
            const nomeLimpo = vendaExcluida.produto.replace(/^\d+x\s/, '');
            await atualizarEstoque(nomeLimpo, Number(vendaExcluida.quantidade));
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
    setClienteSelecionado(null);
    setTermoBuscaCliente('');
    setCarrinho([]);
    setProdAtual('');
    setQtdAtual('1');
    setPrecoAtual('');
    setTermoBuscaProduto('');
    setDataVenda(hoje.toISOString().split('T')[0]);
    setFormaPagamento('Dinheiro');
    setParcelasCartao('1');
    setParcelasCrediario('1');
    setValorEntrada('');
    setDataPrimeiraParcela('');
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

  // Variáveis para resumo do Crediário
  const entradaAtual = converterMoedaParaNumero(valorEntrada);
  const parcelasCrediarioAtual = Number(parcelasCrediario) || 1;
  const valorParcelaAtual = totalVendaAtual > entradaAtual 
    ? Math.round(((totalVendaAtual - entradaAtual) / parcelasCrediarioAtual) * 100) / 100 
    : 0;

  // FORMATADOR DE APRESENTAÇÃO DA STRING DO BANCO
  const formatarVisualizacaoProduto = (produtoString, quantidade, valorUnit) => {
      if (produtoString.includes('|')) {
          const itens = produtoString.split('|').map(i => i.trim());
          return (
              <div className="flex flex-col">
                  <span className="font-extrabold text-gray-900 text-sm">Venda Agrupada</span>
                  <div className="mt-1 flex flex-col gap-0.5">
                      {itens.map((item, idx) => (
                          <span key={idx} className="text-[11px] text-gray-500 font-medium">↳ {item}</span>
                      ))}
                  </div>
              </div>
          );
      }
      
      const nomeLimpo = produtoString.replace(/^\d+x\s/, '');
      return (
          <div className="flex flex-col">
              <span className="font-extrabold text-gray-900 text-sm sm:text-base truncate max-w-[200px]">{nomeLimpo}</span>
              <span className="text-[10px] sm:text-xs font-semibold text-gray-500 mt-0.5">
                  Qtd: {quantidade} • Unit: R$ {Number(valorUnit).toFixed(2)}
              </span>
          </div>
      );
  };

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 w-full overflow-hidden">
      
      {alerta.visivel && (
        <AlertaFlutuante mensagem={alerta.mensagem} tipo={alerta.tipo} onClose={fecharAlerta} />
      )}

      {/* HEADER PAGE */}
      <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between xl:items-center gap-4 w-full">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">PDV / Lançamentos</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Registre as saídas da {nomeLoja}</p>
        </div>
      </div>

      {/* FORMULÁRIO DE CHECKOUT (CARRINHO) */}
      <form onSubmit={handleSubmit} className={`bg-white p-5 sm:p-8 rounded-2xl border shadow-lg transition-all duration-300 w-full overflow-hidden ${editandoId ? 'border-yellow-300 ring-4 ring-yellow-50' : 'border-blue-100 shadow-blue-50/20'}`}>
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-3">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {editandoId ? '✏️ Modo de Edição de Venda' : '🛒 Novo Checkout'}
          </h3>
          {editandoId && (
            <button type="button" onClick={cancelarEdicao} className="text-sm text-red-500 hover:text-red-700 hover:underline font-bold transition-colors">
              Cancelar Edição
            </button>
          )}
        </div>

        {/* SEÇÃO 1: CLIENTE */}
        <h4 className="text-sm sm:text-base font-bold text-gray-800 mb-3 bg-gray-50 p-2 rounded-lg inline-block px-4">1. Identificação do Cliente</h4>
        <div className="mb-8 w-full">
          {clienteSelecionado ? (
            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100 w-full sm:w-1/2">
               <div>
                  <p className="font-extrabold text-blue-900">{clienteSelecionado.nome}</p>
                  <p className="text-xs font-medium text-blue-700 mt-1">CPF: {mascaraCPF(clienteSelecionado.cpf) || 'Não informado'}</p>
               </div>
               <button type="button" onClick={() => setClienteSelecionado(null)} className="text-xs font-bold px-3 py-1.5 bg-white border border-blue-200 text-red-500 rounded-lg shadow-sm hover:bg-red-50 transition-colors">
                  Remover
               </button>
            </div>
          ) : (
            <div className="relative w-full sm:w-1/2">
              <input 
                type="text" 
                placeholder="Buscar cliente por Nome ou CPF (Opcional)..."
                value={termoBuscaCliente}
                onChange={(e) => {
                  setTermoBuscaCliente(e.target.value);
                  setMostrarDropdownCliente(true);
                }}
                onFocus={() => setMostrarDropdownCliente(true)}
                className="w-full px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium placeholder-gray-400"
              />
              {mostrarDropdownCliente && <div className="fixed inset-0 z-10" onClick={() => setMostrarDropdownCliente(false)}></div>}
              {mostrarDropdownCliente && (
                <ul className="absolute z-20 w-full bg-white border border-gray-200 shadow-xl max-h-56 overflow-y-auto rounded-xl mt-1 divide-y divide-gray-50">
                  <li className="px-5 py-3 hover:bg-gray-50 cursor-pointer text-gray-500 italic text-sm" onClick={() => selecionarCliente(null)}>
                    -- Venda Avulsa (Sem Cadastro) --
                  </li>
                  {clientesFiltrados.map(c => (
                    <li key={c.id} className="px-5 py-3 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => selecionarCliente(c)}>
                      <div className="font-bold text-gray-800 text-sm truncate">{c.nome}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">CPF: {mascaraCPF(c.cpf) || 'N/A'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* SEÇÃO 2: CARRINHO */}
        <h4 className="text-sm sm:text-base font-bold text-gray-800 mb-3 bg-gray-50 p-2 rounded-lg inline-block px-4">2. Produtos do Carrinho</h4>
        
        {!editandoId && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4 w-full bg-blue-50/30 p-4 rounded-xl border border-blue-50">
            <div className="sm:col-span-6 relative w-full">
                <label className="mb-1 text-xs font-semibold text-gray-600">Produto</label>
                <input 
                type="text" 
                placeholder="Buscar produto..."
                value={termoBuscaProduto}
                onChange={(e) => {
                    setTermoBuscaProduto(e.target.value);
                    setProdAtual(e.target.value);
                    setMostrarDropdownProduto(true);
                }}
                onFocus={() => setMostrarDropdownProduto(true)}
                className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium placeholder-gray-400"
                />
                {mostrarDropdownProduto && <div className="fixed inset-0 z-10" onClick={() => setMostrarDropdownProduto(false)}></div>}
                {mostrarDropdownProduto && (
                <ul className="absolute z-20 w-full bg-white border border-gray-200 shadow-xl max-h-56 overflow-y-auto rounded-xl mt-1 divide-y divide-gray-50">
                    <li className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-gray-500 italic text-xs" onClick={() => selecionarProduto(null)}>
                    -- Digitar Manualmente --
                    </li>
                    {produtosFiltrados.map(p => (
                    <li key={p.id} className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center" onClick={() => selecionarProduto(p)}>
                        <span className="font-bold text-gray-800 text-xs sm:text-sm truncate">{p.nome}</span>
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                        Qtd: {p.quantidade} | R$ {p.preco.toFixed(2)}
                        </span>
                    </li>
                    ))}
                </ul>
                )}
            </div>

            <div className="sm:col-span-2 w-full">
                <label className="mb-1 text-xs font-semibold text-gray-600">Qtd.</label>
                <input type="number" min="1" value={qtdAtual} onChange={(e)=>setQtdAtual(e.target.value)} className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
            </div>
            
            <div className="sm:col-span-2 w-full">
                <label className="mb-1 text-xs font-semibold text-gray-600">Unit. (R$)</label>
                <input 
                  type="text" 
                  value={precoAtual} 
                  onChange={(e)=>setPrecoAtual(handleMascaraMoeda(e.target.value))} 
                  placeholder="0,00"
                  className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium" 
                />
            </div>

            <div className="sm:col-span-2 flex items-end w-full">
                <button type="button" onClick={adicionarAoCarrinho} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all hover:-translate-y-0.5">
                ➕ Add
                </button>
            </div>
            </div>
        )}

        <div className="mb-8 w-full">
          {carrinho.length === 0 ? (
             <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                 <span className="text-3xl opacity-50 block mb-2">🛒</span>
                 <p className="text-gray-400 font-medium text-sm">O carrinho está vazio.</p>
             </div>
          ) : (
             <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                 <ul className="divide-y divide-gray-100">
                    {carrinho.map(item => (
                        <li key={item.idTemp} className="p-3 sm:p-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center gap-3 w-[60%]">
                                <span className="bg-blue-100 text-blue-700 font-black text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-lg">{item.quantidade}x</span>
                                <div className="truncate">
                                    <p className="font-extrabold text-gray-900 text-sm sm:text-base truncate">{item.produto}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium">R$ {item.valorUnitario.toFixed(2)} un.</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 sm:gap-4 w-[40%]">
                                <span className="font-black text-gray-900 text-sm sm:text-lg truncate">R$ {item.total.toFixed(2)}</span>
                                <button type="button" onClick={() => removerDoCarrinho(item.idTemp)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0">
                                    ✕
                                </button>
                            </div>
                        </li>
                    ))}
                 </ul>
                 <div className="bg-gray-50 p-3 sm:p-4 flex justify-between items-center border-t border-gray-200">
                    <span className="font-bold text-gray-500 uppercase tracking-widest text-[10px] sm:text-xs">Subtotal do Carrinho</span>
                    <span className="font-black text-blue-700 text-xl sm:text-2xl">R$ {totalVendaAtual.toFixed(2)}</span>
                 </div>
             </div>
          )}
        </div>

        {/* SEÇÃO 3: PAGAMENTO */}
        <h4 className="text-sm sm:text-base font-bold text-gray-800 mb-3 bg-gray-50 p-2 rounded-lg inline-block px-4">3. Condições de Pagamento</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full">
          
          <div className="flex flex-col w-full">
            <label className="mb-2 text-xs sm:text-sm font-semibold text-gray-700">Data da Venda <span className="text-red-500">*</span></label>
            <input type="date" name="dataVenda" value={dataVenda} onChange={(e)=>setDataVenda(e.target.value)} className="w-full px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 text-sm font-medium" required />
          </div>

          <div className="flex flex-col w-full">
            <label className="mb-2 text-xs sm:text-sm font-semibold text-gray-700">Modalidade</label>
            <select value={formaPagamento} onChange={(e)=>setFormaPagamento(e.target.value)} className="w-full px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 text-sm font-extrabold text-green-700">
              <option value="Dinheiro">💵 Dinheiro</option>
              <option value="Pix">💠 Pix</option>
              <option value="Cartão">💳 Cartão</option>
              <option value="Crediário">📝 Crediário (Fiado)</option>
            </select>
          </div>

          {formaPagamento === 'Cartão' && (
            <div className="flex flex-col w-full">
              <label className="mb-2 text-xs sm:text-sm font-semibold text-gray-700">Parcelas</label>
              <select value={parcelasCartao} onChange={(e)=>setParcelasCartao(e.target.value)} className="w-full px-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 text-sm font-medium">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num}x {num===1?'(À vista)':''}</option>)}
              </select>
            </div>
          )}

          {formaPagamento === 'Crediário' && (
            <>
              <div className="flex flex-col w-full">
                <label className="mb-2 text-xs sm:text-sm font-semibold text-gray-700">Parcelas</label>
                <select value={parcelasCrediario} onChange={(e)=>setParcelasCrediario(e.target.value)} className="w-full px-4 py-3 bg-yellow-50/50 rounded-xl border border-yellow-200 focus:ring-2 focus:ring-yellow-500 text-sm font-medium">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>{num}x</option>)}
                </select>
              </div>
              <div className="flex flex-col w-full">
                <label className="mb-2 text-xs sm:text-sm font-semibold text-gray-700">Entrada (R$)</label>
                <input 
                  type="text" 
                  value={valorEntrada} 
                  onChange={(e)=>setValorEntrada(handleMascaraMoeda(e.target.value))} 
                  placeholder="0,00" 
                  className="w-full px-4 py-3 bg-yellow-50/50 rounded-xl border border-yellow-200 text-sm font-medium" 
                />
              </div>
              <div className="flex flex-col sm:col-span-2 lg:col-span-1 w-full">
                <label className="mb-2 text-xs sm:text-sm font-semibold text-gray-700">Venc. 1ª Parcela <span className="text-red-500">*</span></label>
                <input type="date" value={dataPrimeiraParcela} onChange={(e)=>setDataPrimeiraParcela(e.target.value)} className="w-full px-4 py-3 bg-yellow-50/50 rounded-xl border border-yellow-200 text-sm font-medium" />
              </div>
            </>
          )}
        </div>

        {/* RODAPÉ DO FORMULÁRIO */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between border-t border-gray-100 pt-6 sm:pt-8 gap-4 sm:gap-6 w-full">
          <div className="text-base text-gray-500 text-center md:text-left font-semibold w-full md:w-auto">
            {formaPagamento === 'Crediário' && totalVendaAtual > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800 shadow-sm text-left w-full overflow-hidden">
                <p className="font-extrabold mb-2 uppercase tracking-widest text-[11px] text-yellow-700">🧾 Resumo do Fiado</p>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">Entrada recebida:</span>
                  <span className="font-black">R$ {entradaAtual.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Restante parcelado:</span>
                  <span className="font-black text-red-600 truncate ml-2">{parcelasCrediarioAtual}x de R$ {valorParcelaAtual > 0 ? valorParcelaAtual.toFixed(2) : '0.00'}</span>
                </div>
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={salvando || carrinho.length === 0} 
            className={`w-full md:w-auto px-8 sm:px-12 py-4 text-white text-base sm:text-lg font-bold rounded-xl shadow-lg transition-all ${salvando ? 'bg-gray-400 cursor-wait' : (carrinho.length === 0 ? 'bg-gray-300 cursor-not-allowed shadow-none' : (editandoId ? 'bg-yellow-500 hover:bg-yellow-600 sm:hover:-translate-y-0.5' : 'bg-green-600 hover:bg-green-700 sm:hover:-translate-y-0.5'))}`}
          >
            {salvando ? (
              <><span className="animate-spin mr-2 inline-block">⏳</span> Processando...</>
            ) : (
              editandoId ? 'Atualizar Venda' : 'Concluir Venda'
            )}
          </button>
        </div>
      </form>

      {/* HISTÓRICO DE VENDAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 mt-10 sm:mt-12 gap-4 w-full">
        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">Histórico de Saídas</h3>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <div className="flex items-center justify-between sm:justify-start space-x-3 bg-green-50 px-4 sm:px-5 py-2.5 rounded-xl border border-green-200 shadow-sm w-full sm:w-auto">
            <span className="text-green-800 font-bold text-xs sm:text-sm">Caixa Mensal:</span>
            <span className="text-green-700 font-black text-base sm:text-lg">R$ {totalArrecadadoMes.toFixed(2)}</span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full sm:w-auto flex-1 bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 sm:px-4 py-2.5 font-bold shadow-sm cursor-pointer">
              <option value="01">Jan</option><option value="02">Fev</option><option value="03">Mar</option>
              <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
              <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
              <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
            </select>
            <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full sm:w-auto flex-1 bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 sm:px-4 py-2.5 font-bold shadow-sm cursor-pointer">
              {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
        <div className="overflow-x-auto hide-scrollbar w-full">
          <table className="min-w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">
                <th className="p-4 sm:p-6 w-24">Data</th>
                <th className="p-4 sm:p-6">Detalhes do Pedido</th>
                <th className="p-4 sm:p-6 hidden md:table-cell">Cliente</th>
                <th className="p-4 sm:p-6 text-center">Forma de Pag.</th>
                <th className="p-4 sm:p-6 text-right w-32">Total</th>
                <th className="p-4 sm:p-6 text-center w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendasFiltradasDaTabela.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 sm:p-12 text-center text-gray-400 font-medium text-sm sm:text-base">
                    Nenhuma venda encontrada no filtro selecionado.
                  </td>
                </tr>
              ) : (
                vendasFiltradasDaTabela.map((venda) => (
                  <tr key={venda.id} className="hover:bg-green-50/40 transition-colors group align-top">
                    <td className="p-4 sm:p-6 text-gray-500 text-xs sm:text-sm font-semibold pt-5">{venda.data}</td>
                    
                    <td className="p-4 sm:p-6">
                      {formatarVisualizacaoProduto(venda.produto, venda.quantidade, venda.valorUnitario)}
                    </td>
                    
                    <td className="p-4 sm:p-6 text-gray-700 hidden md:table-cell font-medium text-sm truncate max-w-[150px] pt-5">
                      {getNomeCliente(venda.clienteId)}
                    </td>
                    
                    <td className="p-4 sm:p-6 text-center pt-5">
                      <span className={`inline-block px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg tracking-wide ${venda.formaPagamento === 'Crediário' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {venda.formaPagamento} {(venda.formaPagamento === 'Cartão' || venda.formaPagamento === 'Crediário') ? `(${venda.parcelasCartao || 1}x)` : ''}
                      </span>
                      
                      {venda.formaPagamento === 'Crediário' && (
                        <div className="mt-2 text-[10px] text-gray-500 font-medium">
                          Entrada: <strong className="text-gray-800">R$ {Number(venda.valorEntrada || 0).toFixed(2)}</strong><br/>
                          Venc. 1ª: <strong className="text-gray-800">{venda.dataPrimeiraParcela}</strong>
                        </div>
                      )}
                      {venda.statusPago === 'NÃO' && <span className="inline-block mt-2 text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase tracking-widest">A Receber</span>}
                    </td>
                    
                    <td className="p-4 sm:p-6 font-black text-gray-900 text-right text-base sm:text-lg pt-5">
                      R$ {Number(venda.total).toFixed(2)}
                    </td>
                    
                    <td className="p-4 sm:p-6 text-center space-x-1 sm:space-x-2 pt-4">
                      <div className="flex justify-center items-center h-full">
                        <button onClick={() => handleEditar(venda)} disabled={processandoAcao} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50" title="Editar Venda">✏️ <span className="hidden lg:inline">Editar</span></button>
                        <button onClick={() => handleDeletar(venda.id)} disabled={processandoAcao} className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ml-1 sm:ml-2" title="Excluir Venda">✕</button>
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