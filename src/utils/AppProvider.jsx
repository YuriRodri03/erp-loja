import { createContext, useState, useEffect } from 'react';
import { lerAba } from '../services/googleSheets';

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [tokenGoogle, setTokenGoogle] = useState(localStorage.getItem('tokenGoogle'));
  const [idPlanilha, setIdPlanilha] = useState(localStorage.getItem('idPlanilha'));
  const [nomeLoja, setNomeLoja] = useState(localStorage.getItem('nomeLoja') || 'Minha Loja');

  // NOVO: Estado para saber se o e-mail logado é do dono do SaaS
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');

  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [despesas, setDespesas] = useState([]);

  // =========================================================================
  // SINCRONIZAÇÃO AUTOMÁTICA DO GOOGLE SHEETS
  // =========================================================================
  useEffect(() => {
    if (tokenGoogle && idPlanilha) {
      const carregarDadosDoGoogle = async () => {
        try {
          console.log("Iniciando download dos dados do Google Drive...");
          
          // Agora buscamos 4 abas ao mesmo tempo
          const [linhasEstoque, linhasVendas, linhasClientes, linhasDespesas] = await Promise.all([
            lerAba(tokenGoogle, idPlanilha, 'Estoque'),
            lerAba(tokenGoogle, idPlanilha, 'Vendas'),
            lerAba(tokenGoogle, idPlanilha, 'Clientes'),
            lerAba(tokenGoogle, idPlanilha, 'Despesas')
          ]);

          // 1. Processa o Estoque
          if (linhasEstoque && linhasEstoque.length > 0) {
            const estoqueFormatado = linhasEstoque.map(linha => ({
              id: linha[0],
              dataCadastro: linha[1],
              nome: linha[2],
              quantidade: Number(linha[3]),
              preco: Number(linha[4])
            }));
            setProdutos(estoqueFormatado);
          }

          // 2. Processa as Vendas
          if (linhasVendas && linhasVendas.length > 0) {
            const vendasFormatadas = linhasVendas.map(linha => ({
              id: linha[0],
              data: linha[1],
              produto: linha[2],
              quantidade: Number(linha[3]),
              valorUnitario: Number(linha[4]),
              total: Number(linha[5]),
              clienteId: linha[6],
              formaPagamento: linha[7],
              parcelasCartao: linha[8],
              valorEntrada: Number(linha[9]),
              dataPrimeiraParcela: linha[10],
              statusPago: linha[11]
            }));
            setVendas(vendasFormatadas);
          }

          // 3. Processa os Clientes
          if (linhasClientes && linhasClientes.length > 0) {
            const clientesFormatados = linhasClientes.map(linha => ({
              id: linha[0],
              dataCadastro: linha[1],
              nome: linha[2],
              cpf: linha[3],
              dataNascimento: linha[4],
              telefone: linha[5],
              email: linha[6],
              estado: linha[7],
              cidade: linha[8],
              endereco: linha[9]
            }));
            setClientes(clientesFormatados);
          }

          // 4. Processa as Despesas
          // Colunas: 0:ID, 1:Data, 2:Descricao, 3:Categoria, 4:Valor, 5:Status
          if (linhasDespesas && linhasDespesas.length > 0) {
            const despesasFormatadas = linhasDespesas.map(linha => ({
              id: linha[0],
              data: linha[1],
              descricao: linha[2],
              categoria: linha[3],
              valor: Number(linha[4]),
              status: linha[5]
            }));
            setDespesas(despesasFormatadas);
          }

          console.log("Sincronização concluída com sucesso!");
        } catch (error) {
          console.error("Falha ao sincronizar dados:", error);
        }
      };

      carregarDadosDoGoogle();
    } else {
      // Limpa tudo ao deslogar
      setProdutos([]);
      setVendas([]);
      setClientes([]);
      setDespesas([]);
      setIsAdmin(false); // Também removemos o status de Admin por segurança ao sair
    }
  }, [tokenGoogle, idPlanilha]);

  return (
    <AppContext.Provider value={{ 
      tokenGoogle, setTokenGoogle, 
      idPlanilha, setIdPlanilha,
      nomeLoja, setNomeLoja, 
      isAdmin, setIsAdmin,
      produtos, setProdutos,
      vendas, setVendas,
      clientes, setClientes,
      despesas, setDespesas
    }}>
      {children}
    </AppContext.Provider>
  );
}