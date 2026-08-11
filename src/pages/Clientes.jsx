import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../utils/AppProvider';
import { adicionarLinha, editarLinha, deletarLinha } from '../services/googleSheets';
import AlertaFlutuante from '../components/AlertaFlutuante';

// =========================================================================
// MOTOR DE GERAÇÃO DE PIX (BRCODE)
// =========================================================================
const calcularCRC16 = (str) => {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
      crc ^= str.charCodeAt(c) << 8;
      for (let i = 0; i < 8; i++) {
          if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
          else crc = crc << 1;
      }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

const gerarPayloadPix = (chave, valorStr, nomeLoja) => {
  if (!chave) return '';
  const nomeLimpo = nomeLoja.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() || 'LOJA';
  
  const format = (id, valor) => {
      const v = String(valor);
      return id + v.length.toString().padStart(2, '0') + v;
  };

  const payloadIndicator = format('00', '01');
  const merchantAccountInfo = format('26', format('00', 'br.gov.bcb.pix') + format('01', chave));
  const merchantCategoryCode = format('52', '0000');
  const transactionCurrency = format('53', '986');
  const transactionAmount = format('54', Number(valorStr).toFixed(2));
  const countryCode = format('58', 'BR');
  const merchantName = format('59', nomeLimpo);
  const merchantCity = format('60', 'FORTALEZA'); 
  const additionalDataField = format('62', format('05', '***'));

  const payloadBase = payloadIndicator + merchantAccountInfo + merchantCategoryCode + transactionCurrency + transactionAmount + countryCode + merchantName + merchantCity + additionalDataField + "6304";
  
  return payloadBase + calcularCRC16(payloadBase);
};

export default function Clientes() {
  // Importando também produtos e setProdutos para poder devolver ao estoque ao excluir a venda
  const { clientes, setClientes, vendas, setVendas, produtos, setProdutos, tokenGoogle, idPlanilha, nomeLoja } = useContext(AppContext);
  
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
  
  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });

  const mostrarAlerta = (mensagem, tipo = 'sucesso') => setAlerta({ visivel: true, mensagem, tipo });
  const fecharAlerta = () => setAlerta({ ...alerta, visivel: false });
  
  const [clienteHistorico, setClienteHistorico] = useState(null); 
  const [parcelaEmPagamento, setParcelaEmPagamento] = useState(null);
  const [dataPagamentoParcela, setDataPagamentoParcela] = useState(new Date().toISOString().split('T')[0]);
  const [compraExpandida, setCompraExpandida] = useState(null);
  
  // Estado para impressão e PIX
  const [carneParaImprimir, setCarneParaImprimir] = useState(null);
  const [chavePix, setChavePix] = useState(localStorage.getItem('chavePix') || '');

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

  // =========================================================================
  // MÁSCARAS DE INPUT (CPF E TELEFONE)
  // =========================================================================
  const aplicarMascaraCPF = (valor) => {
    let v = valor.replace(/\D/g, ""); 
    if (v.length > 11) v = v.slice(0, 11); 
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return v;
  };

  const aplicarMascaraTelefone = (valor) => {
    let v = valor.replace(/\D/g, ""); 
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
  };

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'cpf') value = aplicarMascaraCPF(value);
    if (name === 'telefone') value = aplicarMascaraTelefone(value);
    setNovoCliente({ ...novoCliente, [name]: value });
  };

  const handleSalvarChavePix = (valor) => {
    setChavePix(valor);
    localStorage.setItem('chavePix', valor);
  };

  // =========================================================================
  // FUNÇÕES DE CRUD DO CLIENTE
  // =========================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    fecharAlerta();
    
    if (!novoCliente.nome || !novoCliente.telefone || !novoCliente.estado || !novoCliente.cidade) {
      mostrarAlerta("Preencha os campos obrigatórios (*).", "erro"); return;
    }
    if (!tokenGoogle || !idPlanilha) {
      mostrarAlerta("Acesso negado: Faça login com o Google.", "erro"); return;
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
        mostrarAlerta("Cliente atualizado com sucesso!");
        setEditandoId(null);
        setMostrarFormulario(false); 
      } else {
        mostrarAlerta("Erro ao editar no Google Drive.", "erro");
      }
    } else {
      const salvo = await adicionarLinha(tokenGoogle, idPlanilha, 'Clientes', arrayDadosSheet);
      if (salvo) {
        setClientes([...clientes, { ...novoCliente, id: arrayDadosSheet[0], dataCadastro: dataAtual }]);
        mostrarAlerta("Cliente cadastrado com sucesso!");
        setMostrarFormulario(false); 
      } else {
        mostrarAlerta("Erro ao salvar no Google Drive.", "erro");
      }
    }

    setNovoCliente(estadoInicial);
    setSalvando(false);
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
        mostrarAlerta("Cliente removido com sucesso!");
      } else {
        alert("Erro ao remover no Google Drive.");
      }
      setProcessandoAcao(false);
    }
  };

  // =========================================================================
  // LÓGICA DE EXCLUSÃO DE VENDA PELO EXTRATO DO CLIENTE
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

  const handleDeletarVenda = async (idVenda) => {
    if (window.confirm("Atenção: Excluir esta venda apagará o registro financeiro deste extrato. Continuar?")) {
      setProcessandoAcao(true);
      const vendaExcluida = vendas.find(v => v.id === idVenda);
      const sucesso = await deletarLinha(tokenGoogle, idPlanilha, 'Vendas', idVenda);
      
      if (sucesso) {
        setVendas(vendas.filter(v => v.id !== idVenda));
        
        // Verifica se a venda era unitária (não pacote agrupado) para sugerir devolução ao estoque
        if (vendaExcluida && !vendaExcluida.produto.includes('|') && window.confirm(`Deseja devolver as ${vendaExcluida.quantidade} unidades ao Estoque?`)) {
            const nomeLimpo = vendaExcluida.produto.replace(/^\d+x\s/, '');
            await atualizarEstoque(nomeLimpo, Number(vendaExcluida.quantidade));
            mostrarAlerta("Venda removida e itens devolvidos ao estoque!");
        } else {
            mostrarAlerta("Venda removida definitivamente do histórico.");
        }
      } else {
        alert("Erro ao remover a venda no Google Drive.");
      }
      setProcessandoAcao(false);
    }
  };

  // =========================================================================
  // LÓGICA DE CARNÊS E PARCELAS
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
        mostrarAlerta("Quitação realizada com sucesso!");
      } else {
        alert("Erro ao atualizar o banco de dados.");
      }
      setProcessandoAcao(false);
    }
  };

  const toggleParcelas = (compraId) => setCompraExpandida(compraExpandida === compraId ? null : compraId);

  const formataTelefone = (tel) => {
    if(!tel) return '';
    if(tel.includes('(')) return tel; 
    return aplicarMascaraTelefone(tel);
  }
  const formataCPF = (cpf) => {
      if(!cpf || cpf === '-') return '';
      if(cpf.includes('.')) return cpf;
      return aplicarMascaraCPF(cpf);
  }

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

  // Função para acionar a impressão
  const handleImprimirCarne = (compra) => {
    setCarneParaImprimir(compra);
    setTimeout(() => {
        window.print();
    }, 150);
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body { 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important; 
            -webkit-print-color-adjust: exact; 
          }
          
          /* Oculta a Navbar global e o espaço fantasma na hora de imprimir */
          nav, header, .h-20 { 
            display: none !important; 
          }

          .print-area {
            width: 210mm;
            padding: 10mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
        }
      `}</style>

      {/* TELA PRINCIPAL (Oculta na Impressão) */}
      <div className="font-sans relative max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 w-full overflow-hidden print:hidden">
        
        {alerta.visivel && (
          <AlertaFlutuante mensagem={alerta.mensagem} tipo={alerta.tipo} onClose={fecharAlerta} />
        )}

        {/* HEADER PAGE */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4 w-full">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Gestão de Clientes</h2>
            <p className="text-sm sm:text-base text-gray-500 mt-1">Gerencie a carteira e os recebimentos da {nomeLoja}</p>
          </div>
          <button 
            onClick={() => { setEditandoId(null); setNovoCliente(estadoInicial); setMostrarFormulario(!mostrarFormulario); }} 
            className={`w-full md:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold shadow-sm transition-all duration-200 flex items-center justify-center gap-2 ${mostrarFormulario ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {mostrarFormulario ? (
              <><span>✕</span> Fechar Formulário</>
            ) : (
              <><span>➕</span> Novo Cliente</>
            )}
          </button>
        </div>

        {/* FORMULÁRIO DE CLIENTE */}
        {mostrarFormulario && (
          <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-8 rounded-2xl border border-blue-100 shadow-lg shadow-blue-50 animate-fade-in-down w-full overflow-hidden">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 sm:mb-6 pb-3 border-b border-gray-100">
              {editandoId ? '✏️ Atualizar Dados do Cliente' : '👤 Cadastro de Novo Cliente'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
              <div className="flex flex-col lg:col-span-2 w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Nome Completo <span className="text-red-500">*</span></label>
                <input type="text" name="nome" value={novoCliente.nome} onChange={handleChange} placeholder="Ex: João da Silva" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" required />
              </div>
              
              <div className="flex flex-col w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">CPF</label>
                <input type="text" name="cpf" value={novoCliente.cpf} onChange={handleChange} placeholder="000.000.000-00" maxLength="14" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" />
              </div>
              
              <div className="flex flex-col w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Data de Nascimento</label>
                <input type="date" name="dataNascimento" value={novoCliente.dataNascimento} onChange={handleChange} className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800" />
              </div>

              <div className="flex flex-col w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Telefone <span className="text-red-500">*</span></label>
                <input type="tel" name="telefone" value={novoCliente.telefone} onChange={handleChange} placeholder="(00) 00000-0000" maxLength="15" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" required />
              </div>
              
              <div className="flex flex-col w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">E-mail</label>
                <input type="email" name="email" value={novoCliente.email} onChange={handleChange} placeholder="email@exemplo.com" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" />
              </div>
              
              <div className="flex flex-col w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Estado (UF) <span className="text-red-500">*</span></label>
                <select name="estado" value={novoCliente.estado} onChange={handleChange} className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required>
                  <option value="">Selecione...</option>
                  {listaEstados.map(uf => <option key={uf.id} value={uf.sigla}>{uf.nome}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Cidade <span className="text-red-500">*</span></label>
                <select name="cidade" value={novoCliente.cidade} onChange={handleChange} disabled={!novoCliente.estado || carregandoIBGE} className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:opacity-50 transition-all text-sm font-medium text-gray-800" required>
                  <option value="">{carregandoIBGE ? 'Carregando...' : 'Selecione...'}</option>
                  {listaCidades.map(cid => <option key={cid.id} value={cid.nome}>{cid.nome}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col lg:col-span-4 w-full">
                <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Endereço Completo</label>
                <input type="text" name="endereco" value={novoCliente.endereco} onChange={handleChange} placeholder="Rua, Número, Bairro, Complemento" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" />
              </div>
            </div>
            
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 pt-5 sm:pt-6 border-t border-gray-100 w-full">
              <button type="submit" disabled={salvando} className={`w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${salvando ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5'}`}>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
          <div className="overflow-x-auto hide-scrollbar w-full">
            <table className="min-w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">
                  <th className="px-4 sm:px-6 py-4 sm:py-5">Cliente</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 hidden md:table-cell">Contato</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 hidden lg:table-cell">Localidade</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-8 sm:p-12 text-center">
                      <p className="text-gray-400 text-sm sm:text-base font-medium">Nenhum cliente cadastrado na base.</p>
                      <p className="text-gray-400 text-[10px] sm:text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <p className="font-extrabold text-gray-900 text-sm sm:text-base truncate max-w-[150px] sm:max-w-[250px] group-hover:text-blue-700 transition-colors">{cliente.nome}</p>
                        {cliente.cpf && <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 font-medium bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded inline-block">CPF: {formataCPF(cliente.cpf)}</p>}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">{formataTelefone(cliente.telefone)}</p>
                        {cliente.email && <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate max-w-[200px]">{cliente.email}</p>}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                        <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{cliente.cidade}</p>
                        <p className="text-xs text-gray-500 mt-1 truncate">{cliente.estado}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                        <div className="flex justify-center items-center space-x-1 sm:space-x-2">
                          <button onClick={() => setClienteHistorico(cliente)} disabled={processandoAcao} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50" title="Extrato / Recebimentos">
                            <span className="hidden sm:inline">📖 Extrato</span><span className="sm:hidden">📖</span>
                          </button>
                          <button onClick={() => handleEditar(cliente)} disabled={processandoAcao} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-50 text-gray-700 hover:bg-gray-200 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50" title="Editar">
                            ✏️ <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button onClick={() => handleDeletar(cliente.id)} disabled={processandoAcao} className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50" title="Excluir">✕</button>
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
              <div className="p-4 sm:p-6 lg:p-8 border-b border-gray-100 flex justify-between items-center bg-white z-10 shadow-sm w-full">
                <div className="w-full truncate pr-4">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight truncate">{clienteHistorico.nome}</h2>
                  <p className="text-gray-500 text-[10px] sm:text-sm font-medium mt-0.5 sm:mt-1 truncate">Extrato de Movimentações</p>
                </div>
                <button onClick={() => setClienteHistorico(null)} className="text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 p-2 sm:p-2.5 rounded-xl transition-all flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 bg-gray-50/50 w-full">
                
                {/* Saldo Devedor Card */}
                <div className="bg-white border border-gray-200 p-5 sm:p-6 lg:p-8 rounded-2xl mb-6 sm:mb-8 flex flex-col md:flex-row justify-between items-center shadow-sm w-full overflow-hidden">
                  <div className="mb-4 md:mb-0 text-center md:text-left w-full truncate">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 sm:mb-2 truncate">Saldo Devedor Ativo</p>
                    <p className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight truncate ${saldoDevedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      R$ {saldoDevedor.toFixed(2)}
                    </p>
                  </div>
                  <button 
                    onClick={handleQuitarTudo}
                    disabled={processandoAcao || saldoDevedor <= 0}
                    className={`w-full md:w-auto px-6 sm:px-8 py-3 sm:py-4 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 flex-shrink-0 ${processandoAcao ? 'bg-green-400 text-white cursor-wait' : saldoDevedor > 0 ? 'bg-green-600 hover:bg-green-700 hover:-translate-y-0.5 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    {processandoAcao ? (
                      <><span className="animate-spin">⏳</span> Processando...</>
                    ) : saldoDevedor > 0 ? (
                      <><span>💰</span> Quitar Toda a Dívida</>
                    ) : (
                      <><span>✅</span> Sem Pendências</>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-4 sm:mb-6 px-1 w-full">
                  <h4 className="font-extrabold text-base sm:text-lg text-gray-800 whitespace-nowrap">Extrato de Movimentações</h4>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>
                
                {historicoCompras.length === 0 ? (
                  <div className="text-center py-10 sm:py-12 bg-white rounded-2xl border border-dashed border-gray-200 w-full">
                    <p className="text-gray-400 font-medium text-sm sm:text-base">Nenhum registro encontrado para este cliente.</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 w-full">
                    {historicoCompras.map(compra => {
                      const isCrediario = compra.formaPagamento === 'Crediário';
                      const numParcelas = Number(compra.parcelasCartao) || 1;
                      const arrayStatus = parseStatusParcelas(compra.statusPago, numParcelas);
                      const parcelasPagas = arrayStatus.filter(s => s !== 'NÃO').length;
                      const valorParcela = (Number(compra.total) - Number(compra.valorEntrada || 0)) / numParcelas;
                      const vencimentos = isCrediario ? calcularVencimentos(compra.dataPrimeiraParcela, numParcelas) : [];
                      const isExpanded = compraExpandida === compra.id;

                      return (
                        <div key={compra.id} className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden w-full ${isCrediario && compra.statusPago !== 'SIM' ? 'border-orange-200 shadow-md ring-1 ring-orange-50' : 'border-gray-200 shadow-sm'}`}>
                          
                          {/* Linha Resumo da Venda */}
                          <div className="p-4 sm:p-5 lg:p-6 flex flex-col md:flex-row justify-between md:items-center gap-4 sm:gap-5 w-full">
                            <div className="flex-1 w-full overflow-hidden">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold tracking-wide">{compra.data}</span>
                                <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold tracking-wide ${isCrediario ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                                  {compra.formaPagamento}
                                </span>
                              </div>
                              
                              {formatarVisualizacaoProduto(compra.produto, compra.quantidade, compra.valorUnitario)}

                            </div>
                            
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-0 border-gray-100 pt-3 md:pt-0 w-full md:w-auto flex-shrink-0">
                              <p className="font-black text-gray-900 text-xl sm:text-2xl mb-0 md:mb-1 truncate">R$ {Number(compra.total).toFixed(2)}</p>
                              
                              <div className="flex flex-col md:items-end gap-1.5 sm:gap-2">
                                {!isCrediario ? (
                                  <span className="text-green-700 bg-green-50 border border-green-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold uppercase tracking-wider">
                                    Totalmente Pago
                                  </span>
                                ) : compra.statusPago === 'SIM' ? (
                                  <span className="text-green-700 bg-green-50 border border-green-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold uppercase tracking-wider">
                                    Dívida Quitada
                                  </span>
                                ) : (
                                  <span className="text-red-700 bg-red-50 border border-red-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold uppercase tracking-wider">
                                    Faltam {numParcelas - parcelasPagas} Parc.
                                  </span>
                                )}
                                
                                <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                                  {isCrediario && (
                                      <button onClick={() => toggleParcelas(compra.id)} className="text-[10px] sm:text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-transparent p-0">
                                        {isExpanded ? 'Ocultar Detalhes ⬆' : 'Ver Carnê ⬇'}
                                      </button>
                                  )}
                                  <button onClick={() => handleDeletarVenda(compra.id)} disabled={processandoAcao} className="text-[10px] sm:text-xs font-bold text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 bg-transparent p-0">
                                    🗑️ Excluir
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Detalhes do Carnê Expandido */}
                          {isCrediario && isExpanded && (
                            <div className="p-4 sm:p-5 lg:p-6 bg-gray-50 border-t border-gray-100 animate-fade-in-down w-full">
                              
                              {/* CABEÇALHO DO CARNÊ: Info da Entrada + Botão Imprimir */}
                              <div className="mb-4 sm:mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-start sm:items-center">
                                  {Number(compra.valorEntrada) > 0 && (
                                    <div className="flex items-center">
                                      <span className="text-green-600 mr-2 text-base">💵</span>
                                      <span className="text-gray-600 text-xs font-medium mr-2">Entrada recebida:</span> 
                                      <span className="font-black text-gray-900 text-xs">R$ {Number(compra.valorEntrada).toFixed(2)}</span>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center w-full sm:w-64 border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0 sm:pl-4">
                                      <input 
                                        type="text" 
                                        placeholder="Sua Chave PIX (Opcional)" 
                                        value={chavePix}
                                        onChange={(e) => handleSalvarChavePix(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        title="Insira sua chave para gerar o QR Code no carnê"
                                      />
                                  </div>
                                </div>

                                <button 
                                  onClick={() => handleImprimirCarne(compra)}
                                  className="w-full md:w-auto px-4 py-2 bg-gray-800 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors flex-shrink-0"
                                >
                                  🖨️ Imprimir Carnê
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
                                {vencimentos.map((dataVenc, index) => {
                                  const statusDestaParcela = arrayStatus[index];
                                  const isPaga = statusDestaParcela !== 'NÃO';
                                  const isProxima = !isPaga && (index === 0 || arrayStatus[index - 1] !== 'NÃO');

                                  return (
                                    <div key={index} className={`bg-white p-4 sm:p-5 rounded-xl border shadow-sm transition-all duration-200 relative overflow-hidden w-full ${isPaga ? 'border-green-200 bg-green-50/50' : (isProxima ? 'border-blue-300 ring-2 ring-blue-50 transform hover:-translate-y-1' : 'border-gray-200 opacity-60')}`}>
                                      <div className={`absolute top-0 left-0 w-full h-1 ${isPaga ? 'bg-green-400' : (isProxima ? 'bg-blue-400' : 'bg-gray-200')}`}></div>
                                      
                                      <div className="flex justify-between items-center mb-3 sm:mb-4 mt-1 w-full">
                                        <span className="text-xs sm:text-sm font-extrabold text-gray-800 truncate">Parcela {index + 1}</span>
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">Venc: {dataVenc}</span>
                                      </div>
                                      
                                      <div className="flex justify-between items-end w-full">
                                        <span className="font-black text-gray-900 text-lg sm:text-xl truncate">R$ {valorParcela.toFixed(2)}</span>
                                        
                                        {isPaga ? (
                                          <div className="flex flex-col items-end flex-shrink-0">
                                              <span className="text-[10px] sm:text-xs font-bold text-green-700 bg-green-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md mb-1 sm:mb-1.5 flex items-center gap-1">
                                                <span>✅</span> {statusDestaParcela === 'SIM' ? 'Paga' : statusDestaParcela}
                                              </span>
                                              <button onClick={() => handleEstornarParcela(compra, index)} disabled={processandoAcao} className="text-[9px] sm:text-[11px] text-gray-400 hover:text-red-600 font-bold transition-colors">
                                                Desfazer
                                              </button>
                                          </div>
                                        ) : isProxima ? (
                                          <button onClick={() => handleAbrirModalPagamento(compra, index, valorParcela)} disabled={processandoAcao} className="text-[10px] sm:text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg shadow-sm transition-colors w-full sm:w-auto ml-3 sm:ml-0 flex-shrink-0">
                                            Pagar Agora
                                          </button>
                                        ) : (
                                          <span className="text-[10px] sm:text-xs font-bold text-gray-400 flex-shrink-0">Aguardando</span>
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
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm animate-fade-in-down border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
                  
                  <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-1">Registrar Recebimento</h3>
                  <p className="text-gray-500 text-xs sm:text-sm font-medium mb-5 sm:mb-6">
                      Parcela {parcelaEmPagamento.indice + 1}
                  </p>

                  <div className="bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100 mb-5 sm:mb-6 flex justify-between items-center w-full">
                    <span className="text-xs sm:text-sm font-bold text-gray-600">Valor Cobrado:</span>
                    <span className="font-black text-green-600 text-xl sm:text-2xl truncate">R$ {parcelaEmPagamento.valor.toFixed(2)}</span>
                  </div>

                  <form onSubmit={handleConfirmarPagamento} className="w-full">
                      <div className="mb-6 sm:mb-8 w-full">
                          <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Data exata do pagamento:</label>
                          <input 
                              type="date" 
                              required
                              value={dataPagamentoParcela}
                              onChange={(e) => setDataPagamentoParcela(e.target.value)}
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 transition-shadow shadow-inner"
                          />
                      </div>
                      
                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-2 w-full">
                          <button type="button" onClick={() => setParcelaEmPagamento(null)} disabled={processandoAcao} className="w-full sm:w-auto px-5 py-2.5 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-xl transition-colors">
                              Cancelar
                          </button>
                          <button type="submit" disabled={processandoAcao} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
                              {processandoAcao ? (
                                <><span className="animate-spin">⏳</span> Salvando...</>
                              ) : (
                                'Confirmar'
                              )}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO EXCLUSIVO PARA IMPRESSÃO (Oculto na tela, Visível no papel) */}
      {/* ========================================================================= */}
      <div className="hidden print:block print-area">
        {carneParaImprimir && clienteHistorico && (() => {
          const numParcelas = Number(carneParaImprimir.parcelasCartao) || 1;
          const valorParcela = (Number(carneParaImprimir.total) - Number(carneParaImprimir.valorEntrada || 0)) / numParcelas;
          const vencimentos = calcularVencimentos(carneParaImprimir.dataPrimeiraParcela, numParcelas);

          return (
            <div className="space-y-[4mm] pt-2">
              <h2 className="text-center font-bold text-lg uppercase mb-4 border-b border-black pb-1">
                Carnê de Pagamento - {nomeLoja}
              </h2>
              
              {vencimentos.map((vencimento, idx) => {
                const payloadPix = chavePix ? gerarPayloadPix(chavePix, valorParcela, nomeLoja) : '';
                const qrCodeUrl = payloadPix ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(payloadPix)}` : '';

                return (
                  <div key={idx} className="flex w-full border border-black rounded-lg break-inside-avoid relative" style={{ height: '70mm' }}>
                    
                    {/* Ícone de Tesoura para Corte */}
                    <div className="absolute -top-3 left-1/3 bg-white px-1 text-sm text-gray-600">✂️</div>

                    {/* CANHOTO DA LOJA */}
                    <div className="w-[33%] border-r border-dashed border-gray-400 p-3 flex flex-col justify-between">
                      <div>
                        <h3 className="font-black text-[10px] uppercase mb-2 truncate">{nomeLoja}</h3>
                        <div className="text-[9px] leading-relaxed">
                          <p className="truncate"><strong>Cliente:</strong> {clienteHistorico.nome}</p>
                          <p><strong>Nº Doc:</strong> {carneParaImprimir.id}</p>
                          <p><strong>Vencimento:</strong> <span className="font-bold text-[10px]">{vencimento}</span></p>
                          <p><strong>Valor:</strong> R$ {valorParcela.toFixed(2)}</p>
                          <p><strong>Parcela:</strong> {idx + 1}/{numParcelas}</p>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-black pt-1 text-[7px] text-center text-gray-600 uppercase">
                        Visto Recebedor
                      </div>
                    </div>

                    {/* VIA DO CLIENTE */}
                    <div className="w-[67%] p-3 flex flex-col justify-between">
                      
                      <div className="flex justify-between items-start border-b border-gray-300 pb-2 mb-2">
                        <div>
                          <h3 className="font-black text-sm uppercase tracking-wider">{nomeLoja}</h3>
                          <p className="text-[8px] text-gray-500 uppercase mt-0.5">Via do Cliente</p>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-lg leading-none">R$ {valorParcela.toFixed(2)}</div>
                          <div className="text-[10px] mt-1">Vencimento: <span className="font-bold">{vencimento}</span></div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center gap-2">
                        <div className="grid grid-cols-1 gap-y-1 text-[9px] flex-1">
                          <p className="truncate"><strong>Sacado:</strong> {clienteHistorico.nome}</p>
                          <p><strong>CPF:</strong> {aplicarMascaraCPF(clienteHistorico.cpf)}</p>
                          <p><strong>Data de Emissão:</strong> {carneParaImprimir.data}</p>
                          <p><strong>Parcela:</strong> {idx + 1} de {numParcelas}</p>
                          <p className="mt-1 bg-gray-100 p-1 rounded text-[8px] leading-tight">
                            <strong>Referente a:</strong> {carneParaImprimir.produto.replace(/ \| /g, ', ')}
                          </p>
                        </div>

                        {/* ÁREA DO QR CODE PIX */}
                        {chavePix && (
                          <div className="flex flex-col items-center justify-center p-1 border border-gray-200 rounded">
                            <img src={qrCodeUrl} alt="QR Code Pix" className="w-[18mm] h-[18mm] object-contain" />
                            <span className="text-[6px] font-bold mt-0.5">PAGUE COM PIX</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-[7px] text-gray-500 text-center uppercase tracking-widest border-t border-dashed border-gray-200 pt-1">
                        Pagamento sujeito a juros e multa após o vencimento
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
      
    </>
  );
}