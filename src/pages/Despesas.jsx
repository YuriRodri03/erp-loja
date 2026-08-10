import { useState, useContext } from 'react';
import { AppContext } from '../utils/AppProvider';
import { adicionarLinha, editarLinha, deletarLinha } from '../services/googleSheets';
import AlertaFlutuante from '../components/AlertaFlutuante';

export default function Despesas() {
  const { despesas, setDespesas, tokenGoogle, idPlanilha, nomeLoja } = useContext(AppContext);
  
  const estadoInicial = { 
    descricao: '', 
    categoria: 'Contas Fixas', 
    valor: '', 
    status: 'PAGO', 
    data: new Date().toISOString().split('T')[0] 
  };
  
  const [novaDespesa, setNovaDespesa] = useState(estadoInicial);
  const [editandoId, setEditandoId] = useState(null);
  
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  
  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });

  const mostrarAlerta = (mensagem, tipo = 'sucesso') => {
    setAlerta({ visivel: true, mensagem, tipo });
  };

  const fecharAlerta = () => {
    setAlerta({ ...alerta, visivel: false });
  };

  const categorias = ["Contas Fixas", "Fornecedores", "Salários", "Impostos", "Marketing", "Manutenção", "Outros"];

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

  const handleChange = (e) => {
    setNovaDespesa({ ...novaDespesa, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    fecharAlerta();
    
    if (!novaDespesa.descricao || !novaDespesa.valor || !novaDespesa.data) {
      mostrarAlerta("Preencha Descrição, Valor e Data.", "erro"); return;
    }
    if (!tokenGoogle || !idPlanilha) {
      mostrarAlerta("Acesso negado: Faça login com o Google.", "erro"); return;
    }

    setSalvando(true);
    const valorNumerico = Number(novaDespesa.valor);
    const dataFormatada = formataDataBrasil(novaDespesa.data);

    const arrayDadosSheet = [
      editandoId || Date.now(), 
      dataFormatada, 
      novaDespesa.descricao, 
      novaDespesa.categoria, 
      valorNumerico, 
      novaDespesa.status
    ];

    if (editandoId) {
      const salvo = await editarLinha(tokenGoogle, idPlanilha, 'Despesas', editandoId, arrayDadosSheet);
      if (salvo) {
        setDespesas(despesas.map(d => d.id === editandoId ? { 
          ...novaDespesa, id: editandoId, valor: valorNumerico, data: dataFormatada 
        } : d));
        mostrarAlerta("Despesa atualizada com sucesso!");
        setEditandoId(null);
        setMostrarFormulario(false);
      } else {
        mostrarAlerta("Erro ao editar no Drive.", "erro");
      }
    } else {
      const salvo = await adicionarLinha(tokenGoogle, idPlanilha, 'Despesas', arrayDadosSheet);
      if (salvo) {
        setDespesas([...despesas, { ...novaDespesa, id: arrayDadosSheet[0], valor: valorNumerico, data: dataFormatada }]);
        mostrarAlerta("Despesa registrada com sucesso!");
        setMostrarFormulario(false);
      } else {
        mostrarAlerta("Erro ao salvar no Drive.", "erro");
      }
    }
    
    setNovaDespesa(estadoInicial);
    setSalvando(false);
  };

  const handleEditar = (despesa) => {
    setNovaDespesa({
        ...despesa,
        data: formataDataIso(despesa.data)
    });
    setEditandoId(despesa.id);
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = async (id) => {
    if (window.confirm("Atenção: Excluir esta despesa apagará seu registro financeiro. Continuar?")) {
      setProcessandoAcao(true);
      const sucesso = await deletarLinha(tokenGoogle, idPlanilha, 'Despesas', id);
      if (sucesso) {
        setDespesas(despesas.filter(d => d.id !== id));
        mostrarAlerta("Despesa removida do sistema.");
      } else {
        alert("Erro ao remover no Google Drive.");
      }
      setProcessandoAcao(false);
    }
  };

  const handlePagarPendente = async (despesa) => {
    if (window.confirm(`Confirmar o pagamento de R$ ${despesa.valor.toFixed(2)} para "${despesa.descricao}"?`)) {
      setProcessandoAcao(true);
      
      const arrayDadosSheet = [despesa.id, despesa.data, despesa.descricao, despesa.categoria, despesa.valor, 'PAGO'];
      const sucesso = await editarLinha(tokenGoogle, idPlanilha, 'Despesas', despesa.id, arrayDadosSheet);
      
      if(sucesso) {
        setDespesas(despesas.map(d => d.id === despesa.id ? { ...d, status: 'PAGO' } : d));
        mostrarAlerta("Pagamento registrado com sucesso!");
      } else {
        alert("Erro ao registrar pagamento no Drive.");
      }
      setProcessandoAcao(false);
    }
  };

  const totalPago = despesas.reduce((acc, d) => d.status === 'PAGO' ? acc + d.valor : acc, 0);
  const totalPendente = despesas.reduce((acc, d) => d.status === 'PENDENTE' ? acc + d.valor : acc, 0);

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      
      {alerta.visivel && (
        <AlertaFlutuante mensagem={alerta.mensagem} tipo={alerta.tipo} onClose={fecharAlerta} />
      )}

      {/* HEADER PAGE */}
      <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between xl:items-center gap-5 sm:gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Gestão de Despesas</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Controle de contas e saídas da {nomeLoja}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full xl:w-auto">
          <div className="bg-red-50 px-4 sm:px-5 py-3 rounded-xl border border-red-200 shadow-sm flex items-center w-full sm:w-auto">
            <span className="text-2xl sm:text-3xl mr-3 sm:mr-4">💸</span>
            <div>
              <p className="text-[10px] sm:text-xs text-red-800 font-bold uppercase tracking-widest">Total Pago</p>
              <p className="text-xl sm:text-2xl font-black text-red-700 truncate max-w-[120px] sm:max-w-none">R$ {totalPago.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-yellow-50 px-4 sm:px-5 py-3 rounded-xl border border-yellow-200 shadow-sm flex items-center w-full sm:w-auto">
            <span className="text-2xl sm:text-3xl mr-3 sm:mr-4">⚠️</span>
            <div>
              <p className="text-[10px] sm:text-xs text-yellow-800 font-bold uppercase tracking-widest">A Pagar</p>
              <p className="text-xl sm:text-2xl font-black text-yellow-700 truncate max-w-[120px] sm:max-w-none">R$ {totalPendente.toFixed(2)}</p>
            </div>
          </div>
          
          <button 
            onClick={() => { 
              setEditandoId(null); 
              setNovaDespesa(estadoInicial); 
              setMostrarFormulario(!mostrarFormulario); 
            }} 
            className={`w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold shadow-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${mostrarFormulario ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            {mostrarFormulario ? (
              <><span>✕</span> Fechar</>
            ) : (
              <><span>➕</span> Nova Despesa</>
            )}
          </button>
        </div>
      </div>

      {/* FORMULÁRIO DE DESPESA */}
      {mostrarFormulario && (
        <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-8 rounded-2xl border border-red-100 shadow-lg shadow-red-50 animate-fade-in-down">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 sm:mb-6 pb-3 border-b border-gray-100">
            {editandoId ? '✏️ Editando Despesa' : '💸 Lançar Nova Despesa'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
            <div className="flex flex-col lg:col-span-2">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Descrição <span className="text-red-500">*</span></label>
              <input type="text" name="descricao" value={novaDespesa.descricao} onChange={handleChange} placeholder="Ex: Conta de Luz" className="px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required />
            </div>
            
            <div className="flex flex-col">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Categoria</label>
              <select name="categoria" value={novaDespesa.categoria} onChange={handleChange} className="px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-medium text-gray-800">
                {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Valor (R$) <span className="text-red-500">*</span></label>
              <input type="number" name="valor" step="0.01" value={novaDespesa.valor} onChange={handleChange} placeholder="0.00" className="px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required />
            </div>
            
            <div className="flex flex-col">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Vencimento / Pagamento <span className="text-red-500">*</span></label>
              <input type="date" name="data" value={novaDespesa.data} onChange={handleChange} className="px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-medium text-gray-800" required />
            </div>
            
            <div className="flex flex-col lg:col-span-5 border-t border-gray-100 pt-4 sm:pt-5 mt-1 sm:mt-2">
              <label className="mb-1 sm:mb-2 text-xs sm:text-sm font-semibold text-gray-700">Status Financeiro</label>
              <select name="status" value={novaDespesa.status} onChange={handleChange} className="px-4 py-2.5 sm:py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all text-sm font-black text-gray-800 w-full sm:w-1/3">
                <option value="PAGO">✅ PAGO (Já saiu do caixa)</option>
                <option value="PENDENTE">⏳ PENDENTE (Contas a Pagar)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 pt-5 sm:pt-6 border-t border-gray-100">
            <button type="submit" disabled={salvando} className={`w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${salvando ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 hover:-translate-y-0.5'}`}>
              {salvando ? (
                <><span className="animate-spin">⏳</span> Salvando...</>
              ) : (
                editandoId ? 'Atualizar Despesa' : 'Registrar Despesa'
              )}
            </button>
          </div>
        </form>
      )}

      {/* TABELA DE DESPESAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">
                <th className="px-4 sm:px-6 py-4 sm:py-5 w-24 sm:w-32">Data</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5">Descrição</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 hidden md:table-cell">Categoria</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-right">Valor</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-center">Status</th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {despesas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 sm:p-12 text-center">
                    <p className="text-gray-400 text-sm sm:text-base font-medium">Nenhuma despesa registrada.</p>
                  </td>
                </tr>
              ) : (
                despesas.map((despesa) => (
                  <tr key={despesa.id} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-gray-500 text-xs sm:text-sm font-medium">{despesa.data}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-extrabold text-gray-900 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{despesa.descricao}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <span className="bg-gray-100 text-gray-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wide">{despesa.categoria}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 font-black text-red-600 text-right text-sm sm:text-base">R$ {despesa.valor.toFixed(2)}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                      <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black rounded-lg uppercase tracking-wider ${despesa.status === 'PAGO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {despesa.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                      <div className="flex justify-center items-center space-x-1 sm:space-x-2">
                        {despesa.status === 'PENDENTE' && (
                          <button onClick={() => handlePagarPendente(despesa)} disabled={processandoAcao} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white hover:bg-green-600 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50 shadow-sm">
                            <span className="hidden sm:inline">Dar Baixa</span><span className="sm:hidden">Baixa</span>
                          </button>
                        )}
                        <button onClick={() => handleEditar(despesa)} disabled={processandoAcao} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-50 text-gray-700 hover:bg-gray-200 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50">✏️ <span className="hidden sm:inline">Editar</span></button>
                        <button onClick={() => handleDeletar(despesa.id)} disabled={processandoAcao} className="px-2 sm:px-3 py-1.5 sm:py-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50">✕</button>
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