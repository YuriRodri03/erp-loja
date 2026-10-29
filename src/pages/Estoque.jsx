// src/pages/Estoque.jsx
import { useState, useContext } from 'react';
import { AppContext } from '../utils/AppProvider';
import { adicionarLinha, editarLinha, deletarLinha } from '../services/googleSheets';
import AlertaFlutuante from '../components/AlertaFlutuante';

export default function Estoque() {
  const { produtos, setProdutos, tokenGoogle, idPlanilha, nomeLoja } = useContext(AppContext);

  // Função auxiliar para garantir que qualquer preço (mesmo vindo com vírgula do Sheets) vire Number válido
  const sanitizarNumero = (val) => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let str = String(val).replace(/[R$\s]/g, '').trim();
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = Number(str);
    return isNaN(num) ? 0 : num;
  };

  // Função de Máscara de Moeda (Visual)
  const handleMascaraMoeda = (valor) => {
    const v = String(valor).replace(/\D/g, '');
    if (!v) return '';
    return (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Função para limpar a máscara antes de salvar no DB
  const converterMoedaParaNumero = (valorString) => {
    if (!valorString) return 0;
    const limpo = String(valorString).replace(/\./g, '').replace(',', '.');
    const numero = Number(limpo);
    return isNaN(numero) ? 0 : numero;
  };

  const estadoInicial = { nome: '', quantidade: '', precoStr: '' };
  const [novoProduto, setNovoProduto] = useState(estadoInicial);
  const [editandoId, setEditandoId] = useState(null);
  
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  
  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });

  const mostrarAlerta = (mensagem, tipo = 'sucesso') => {
    setAlerta({ visivel: true, mensagem, tipo });
  };

  const fecharAlerta = () => {
    setAlerta((prev) => ({ ...prev, visivel: false }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'precoStr') {
      setNovoProduto({ ...novoProduto, precoStr: handleMascaraMoeda(value) });
    } else {
      setNovoProduto({ ...novoProduto, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    fecharAlerta();
    
    const nomeLimpo = novoProduto.nome.trim();
    if (!nomeLimpo || novoProduto.quantidade === '' || !novoProduto.precoStr) {
      mostrarAlerta("Por favor, preencha todos os campos do produto.", "erro");
      return;
    }

    const qtd = Number(novoProduto.quantidade);
    const preco = converterMoedaParaNumero(novoProduto.precoStr);

    if (isNaN(qtd) || qtd < 0) {
      mostrarAlerta("A quantidade não pode ser negativa.", "erro");
      return;
    }

    if (preco <= 0) {
      mostrarAlerta("Informe um preço unitário maior que zero.", "erro");
      return;
    }

    if (!tokenGoogle || !idPlanilha) {
      mostrarAlerta("Acesso negado: Faça login com o Google para salvar.", "erro");
      return;
    }

    setSalvando(true);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const produtoOriginal = editandoId 
      ? produtos.find(p => String(p.id) === String(editandoId)) 
      : null;
    const dataCadastro = produtoOriginal?.dataCadastro || dataHoje;
    const idFinal = editandoId || Date.now().toString();

    const arrayDadosSheet = [
      idFinal, 
      dataCadastro, 
      nomeLimpo, 
      qtd, 
      preco
    ];

    if (editandoId) {
      const salvo = await editarLinha(tokenGoogle, idPlanilha, 'Estoque', editandoId, arrayDadosSheet);
      if (salvo && !salvo.error) {
        setProdutos(produtos.map(p => String(p.id) === String(editandoId) ? { 
          id: editandoId,
          nome: nomeLimpo,
          dataCadastro: dataCadastro,
          quantidade: qtd,
          preco: preco 
        } : p));
        mostrarAlerta("Produto atualizado com sucesso!");
        setEditandoId(null);
        setMostrarFormulario(false);
        setNovoProduto(estadoInicial);
      } else {
        mostrarAlerta("Erro ao editar o produto no Drive.", "erro");
      }
    } else {
      const salvo = await adicionarLinha(tokenGoogle, idPlanilha, 'Estoque', arrayDadosSheet);
      if (salvo && !salvo.error) {
        setProdutos([...produtos, { 
          id: idFinal,
          nome: nomeLimpo,
          dataCadastro: dataCadastro,
          quantidade: qtd,
          preco: preco 
        }]);
        mostrarAlerta("Produto adicionado ao estoque!");
        setMostrarFormulario(false);
        setNovoProduto(estadoInicial);
      } else {
        mostrarAlerta("Erro ao salvar o produto no Drive.", "erro");
      }
    }
    
    setSalvando(false);
  };

  const handleEditar = (produto) => {
    const precoSeguro = sanitizarNumero(produto.preco);
    const qtdSegura = sanitizarNumero(produto.quantidade);

    setNovoProduto({
      nome: produto.nome || '',
      quantidade: qtdSegura,
      precoStr: precoSeguro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    });
    setEditandoId(produto.id);
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = async (id) => {
    if (window.confirm("Atenção: Excluir este produto apagará seu registro do Estoque. Continuar?")) {
      setProcessandoAcao(true);
      const sucesso = await deletarLinha(tokenGoogle, idPlanilha, 'Estoque', id);
      
      if (sucesso && !sucesso.error) {
        setProdutos(produtos.filter(p => String(p.id) !== String(id)));
        mostrarAlerta("Produto removido do estoque.");
      } else {
        mostrarAlerta("Erro ao remover no Google Drive.", "erro");
      }
      setProcessandoAcao(false);
    }
  };

  // Cálculo blindado contra NaN
  const totalImobilizado = produtos.reduce((acc, p) => {
    const qtd = sanitizarNumero(p.quantidade);
    const preco = sanitizarNumero(p.preco);
    return acc + (qtd * preco);
  }, 0);
  
  const totalItens = produtos.length;

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 w-full overflow-hidden">
      
      {alerta.visivel && (
        <AlertaFlutuante mensagem={alerta.mensagem} tipo={alerta.tipo} onClose={fecharAlerta} />
      )}

      {/* HEADER PAGE */}
      <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between xl:items-center gap-5 sm:gap-6 w-full">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Gestão de Estoque</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Controle de inventário da {nomeLoja}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full xl:w-auto">
          <div className="bg-blue-50 px-4 sm:px-5 py-3 rounded-xl border border-blue-200 shadow-sm flex items-center w-full sm:w-auto">
            <span className="text-2xl sm:text-3xl mr-3 sm:mr-4">📦</span>
            <div>
              <p className="text-[10px] sm:text-xs text-blue-800 font-bold uppercase tracking-widest">Valor Imobilizado</p>
              <p className="text-xl sm:text-2xl font-black text-blue-700 truncate max-w-[140px] sm:max-w-none">
                R$ {totalImobilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] sm:text-xs text-blue-600 font-semibold">{totalItens} produtos únicos</p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              setEditandoId(null);
              setNovoProduto(estadoInicial);
              setMostrarFormulario(!mostrarFormulario);
            }} 
            className={`w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold shadow-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${mostrarFormulario ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {mostrarFormulario ? (
              <><span>✕</span> Fechar</>
            ) : (
              <><span>➕</span> Novo Produto</>
            )}
          </button>
        </div>
      </div>

      {/* FORMULÁRIO ESCONDIDO */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-8 rounded-2xl border border-blue-100 shadow-lg shadow-blue-50 animate-fade-in-down w-full overflow-hidden">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 sm:mb-6 pb-3 border-b border-gray-100">
            {editandoId ? '✏️ Editando Produto' : '📦 Adicionar Novo Produto'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
            <div className="flex flex-col lg:col-span-2">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Nome do Produto <span className="text-red-500">*</span></label>
              <input type="text" name="nome" value={novoProduto.nome} onChange={handleChange} placeholder="Ex: Caderno 10 matérias" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" required />
            </div>
            
            <div className="flex flex-col lg:col-span-1">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Quantidade <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="1" name="quantidade" value={novoProduto.quantidade} onChange={handleChange} placeholder="Ex: 50" className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" required />
            </div>

            <div className="flex flex-col lg:col-span-1">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Preço Unitário (R$) <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                inputMode="numeric"
                name="precoStr" 
                value={novoProduto.precoStr} 
                onChange={handleChange} 
                placeholder="0,00" 
                className="w-full px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm font-medium text-gray-800 placeholder-gray-400" 
                required 
              />
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 pt-5 sm:pt-6 border-t border-gray-100">
            <button type="submit" disabled={salvando} className={`w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${salvando ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5'}`}>
              {salvando ? (
                <><span className="animate-spin">⏳</span> Processando...</>
              ) : (
                editandoId ? 'Atualizar Produto' : 'Adicionar ao Estoque'
              )}
            </button>
          </div>
        </form>
      )}

      {/* TABELA DE ESTOQUE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
        <div className="overflow-x-auto hide-scrollbar w-full">
          <table className="min-w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">
                <th className="px-4 sm:px-6 py-4 sm:py-5">Produto</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-center w-24 sm:w-32">Estoque</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-right w-24 sm:w-40">Preço</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-right w-24 sm:w-40">Total</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-center w-24 sm:w-48">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {produtos.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 sm:p-12 text-center">
                    <p className="text-gray-400 text-sm sm:text-base font-medium">Seu estoque está vazio.</p>
                  </td>
                </tr>
              ) : (
                produtos.map((produto) => {
                  const qtdSegura = sanitizarNumero(produto.quantidade);
                  const precoSeguro = sanitizarNumero(produto.preco);
                  const totalProduto = qtdSegura * precoSeguro;

                  return (
                    <tr key={produto.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <span className="font-extrabold text-gray-900 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none block">{produto.nome}</span>
                        <span className="text-[10px] sm:text-xs font-medium text-gray-400 mt-0.5 sm:mt-1 block">Add em {produto.dataCadastro}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                        <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-black text-[10px] sm:text-sm ${qtdSegura <= 5 ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 'bg-gray-100 text-gray-700'}`}>
                          {qtdSegura} un
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-gray-600 text-right text-xs sm:text-base">
                        R$ {precoSeguro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 font-black text-blue-700 text-right text-sm sm:text-lg">
                        R$ {totalProduto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                        <div className="flex justify-center items-center space-x-1 sm:space-x-2">
                          <button 
                            onClick={() => handleEditar(produto)} 
                            disabled={processandoAcao} 
                            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-50 text-gray-700 hover:bg-gray-200 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50 border border-gray-200"
                            title="Editar Produto"
                          >
                            ✏️ <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button 
                            onClick={() => handleDeletar(produto.id)} 
                            disabled={processandoAcao} 
                            className="px-2 sm:px-3 py-1.5 sm:py-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50"
                            title="Excluir Produto"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}