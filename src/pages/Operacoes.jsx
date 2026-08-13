import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../utils/AppProvider';
import { useNavigate } from 'react-router-dom';
import AlertaFlutuante from '../components/AlertaFlutuante';

export default function Operacoes() {
  const navigate = useNavigate();
  const { tokenGoogle } = useContext(AppContext);

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  
  // Estados para o Modal de Edição
  const [editandoUsuario, setEditandoUsuario] = useState(null);
  const [formEdicao, setFormEdicao] = useState({ plano: '', status_pagamento: '', data_vencimento: '' });
  const [salvando, setSalvando] = useState(false);

  const [alerta, setAlerta] = useState({ visivel: false, mensagem: '', tipo: 'sucesso' });
  const mostrarAlerta = (mensagem, tipo = 'sucesso') => setAlerta({ visivel: true, mensagem, tipo });
  const fecharAlerta = () => setAlerta({ ...alerta, visivel: false });

  const API_URL = 'https://erp-loja.onrender.com/api';

  useEffect(() => {
    // Segurança básica: Se não estiver logado no Google, expulsa.
    if (!tokenGoogle) {
      navigate('/');
      return;
    }
    buscarUsuarios();
  }, [tokenGoogle, navigate]);

  const buscarUsuarios = async () => {
    setCarregando(true);
    try {
      const response = await fetch(`${API_URL}/admin/usuarios`);
      if (!response.ok) throw new Error('Erro ao buscar dados');
      const data = await response.json();
      setUsuarios(data);
    } catch (erro) {
      console.error(erro);
      mostrarAlerta('Erro ao conectar com o banco central.', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalEdicao = (usuario) => {
    setEditandoUsuario(usuario);
    setFormEdicao({
      plano: usuario.plano || 'Nenhum',
      status_pagamento: usuario.status_pagamento || 'inativo',
      // Formata a data se existir, caso contrário deixa vazio
      data_vencimento: usuario.data_vencimento || ''
    });
  };

  const handleMudancaForm = (e) => {
    setFormEdicao({ ...formEdicao, [e.target.name]: e.target.value });
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    setSalvando(true);
    fecharAlerta();

    try {
      const response = await fetch(`${API_URL}/admin/atualizar-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editandoUsuario.email,
          novoStatus: formEdicao.status_pagamento,
          novaData: formEdicao.data_vencimento || null,
          novoPlano: formEdicao.plano
        })
      });

      if (!response.ok) throw new Error('Falha ao atualizar');
      
      mostrarAlerta('Assinatura atualizada com sucesso!');
      setEditandoUsuario(null);
      buscarUsuarios(); // Recarrega a lista
    } catch (erro) {
      console.error(erro);
      mostrarAlerta('Erro ao salvar as alterações.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  // ==========================================================
  // NOVA FUNÇÃO: APAGAR USUÁRIO
  // ==========================================================
  const handleApagarUsuario = async (email) => {
    const confirmacao = window.confirm(`CUIDADO: Tem certeza que deseja APAGAR DEFINITIVAMENTE o cliente "${email}"? Isso removerá o acesso dele imediatamente e não pode ser desfeito.`);
    
    if (!confirmacao) return;

    setCarregando(true);
    fecharAlerta();

    try {
      const response = await fetch(`${API_URL}/admin/excluir-cliente`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) throw new Error('Falha ao excluir');
      
      mostrarAlerta('Cliente apagado com sucesso!');
      buscarUsuarios(); // Recarrega a lista sem o usuário excluído
    } catch (erro) {
      console.error(erro);
      mostrarAlerta('Erro ao apagar o cliente.', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  // Estatísticas Rápidas
  const totalUsuarios = usuarios.length;
  const ativos = usuarios.filter(u => u.status_pagamento === 'ativo').length;
  const inativos = totalUsuarios - ativos;

  const formatarData = (dataIso) => {
    if (!dataIso) return 'Sem validade';
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  return (
    <div className="font-sans relative max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 w-full overflow-hidden">
      
      {alerta.visivel && (
        <AlertaFlutuante mensagem={alerta.mensagem} tipo={alerta.tipo} onClose={fecharAlerta} />
      )}

      {/* HEADER PAGE */}
      <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-5 w-full">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <span>⚙️</span> Controle de Operações
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Gerencie as assinaturas e acessos do seu ERP SaaS.</p>
        </div>
        
        <button onClick={buscarUsuarios} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors shadow-sm text-sm flex items-center justify-center gap-2">
          🔄 Atualizar Dados
        </button>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">👥</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Cadastrados</p>
            <p className="text-2xl font-black text-gray-900">{totalUsuarios}</p>
          </div>
        </div>
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-2xl">✅</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lojistas Ativos</p>
            <p className="text-2xl font-black text-green-600">{ativos}</p>
          </div>
        </div>
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-2xl">⚠️</div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Inativos / Vencidos</p>
            <p className="text-2xl font-black text-orange-600">{inativos}</p>
          </div>
        </div>
      </div>

      {/* TABELA DE ASSINANTES */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
        <div className="overflow-x-auto hide-scrollbar w-full">
          <table className="min-w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 font-bold">
                <th className="p-4 sm:p-5">Conta / E-mail</th>
                <th className="p-4 sm:p-5 text-center">Plano</th>
                <th className="p-4 sm:p-5 text-center">Status</th>
                <th className="p-4 sm:p-5 text-center hidden sm:table-cell">Vencimento</th>
                <th className="p-4 sm:p-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {carregando ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">Carregando base de dados...</td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">Nenhum usuário registrado ainda.</td>
                </tr>
              ) : (
                usuarios.map((user) => (
                  <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 sm:p-5">
                      <p className="font-extrabold text-gray-900 text-sm">{user.email}</p>
                      {user.is_admin ? <span className="inline-block mt-1 bg-purple-100 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Administrador</span> : null}
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">{user.plano}</span>
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      <span className={`inline-block px-3 py-1 text-[10px] sm:text-xs font-bold rounded-lg tracking-wide uppercase ${user.status_pagamento === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.status_pagamento}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-center hidden sm:table-cell text-sm font-semibold text-gray-600">
                      {formatarData(user.data_vencimento)}
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => abrirModalEdicao(user)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] sm:text-xs font-bold transition-colors shadow-sm"
                        >
                          ✏️ Gerir
                        </button>
                        {/* Se for o admin logado, não deixa ele apagar a própria conta para evitar bloqueios acidentais */}
                        {!user.is_admin && (
                          <button 
                            onClick={() => handleApagarUsuario(user.email)}
                            className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] sm:text-xs font-bold transition-colors shadow-sm"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO DE ASSINATURA */}
      {editandoUsuario && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-down overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-900">Gerenciar Assinatura</h3>
              <p className="text-sm font-medium text-gray-500 mt-1 truncate">{editandoUsuario.email}</p>
            </div>
            
            <form onSubmit={handleSalvarEdicao} className="p-6 sm:p-8 space-y-5 bg-gray-50">
              
              <div className="flex flex-col w-full">
                <label className="mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Status da Conta</label>
                <select 
                  name="status_pagamento" 
                  value={formEdicao.status_pagamento} 
                  onChange={handleMudancaForm}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 transition-shadow shadow-sm outline-none"
                >
                  <option value="ativo">✅ Ativo (Liberado)</option>
                  <option value="inativo">🚫 Inativo (Bloqueado)</option>
                  <option value="vencido">⚠️ Vencido (Cobrar)</option>
                </select>
              </div>

              <div className="flex flex-col w-full">
                <label className="mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Plano Vigente</label>
                <select 
                  name="plano" 
                  value={formEdicao.plano} 
                  onChange={handleMudancaForm}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 transition-shadow shadow-sm outline-none"
                >
                  <option value="Teste">Plano de Teste</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Nenhum">Nenhum</option>
                </select>
              </div>

              <div className="flex flex-col w-full">
                <label className="mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Data de Vencimento</label>
                <input 
                  type="date" 
                  name="data_vencimento"
                  value={formEdicao.data_vencimento}
                  onChange={handleMudancaForm}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 transition-shadow shadow-sm outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <button type="button" onClick={() => setEditandoUsuario(null)} disabled={salvando} className="w-full sm:w-auto px-5 py-3 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-transform transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                  {salvando ? <><span className="animate-spin">⏳</span> Salvando...</> : 'Salvar Alterações'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}