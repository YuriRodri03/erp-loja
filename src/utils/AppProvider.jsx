// src/utils/AppProvider.jsx
import { createContext, useState, useEffect } from 'react';
import { lerAba, buscarPlanilhaExistente } from '../services/googleSheets';

export const AppContext = createContext();

// Função auxiliar ultra-segura para converter qualquer dado numérico/moeda do Sheets em número real
const limparNumero = (val) => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).replace(/[R$\s]/g, '').trim();
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.'); // Ex: 1.250,50 -> 1250.50
  } else if (str.includes(',')) {
    str = str.replace(',', '.'); // Ex: 15,50 -> 15.50
  }
  const num = Number(str);
  return isNaN(num) ? 0 : num;
};

export function AppProvider({ children }) {
  const [tokenGoogle, setTokenGoogle] = useState(() => localStorage.getItem('tokenGoogle') || null);
  const [idPlanilha, setIdPlanilha] = useState(() => localStorage.getItem('idPlanilha') || null);
  const [nomeLoja, setNomeLoja] = useState(() => localStorage.getItem('nomeLoja') || 'Minha Loja');

  // Estado para saber se o e-mail logado é do dono do SaaS
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');

  // Estado opcional para saber se ainda está buscando a planilha/dados no Drive
  const [carregandoDados, setCarregandoDados] = useState(false);

  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [despesas, setDespesas] = useState([]);

  // =========================================================================
  // SINCRONIZAÇÃO AUTOMÁTICA DO GOOGLE SHEETS + RECUPERAÇÃO DE PLANILHA
  // =========================================================================
  useEffect(() => {
    // 1. Se deslogou (sem token), limpa todos os dados da memória
    if (!tokenGoogle) {
      setProdutos([]);
      setVendas([]);
      setClientes([]);
      setDespesas([]);
      setIsAdmin(false);
      return;
    }

    // 2. Se for Admin, não precisa buscar planilha de loja
    if (isAdmin || localStorage.getItem('isAdmin') === 'true') {
      return;
    }

    const sincronizarAmbiente = async () => {
      setCarregandoDados(true);
      try {
        let planilhaAtualId = idPlanilha || localStorage.getItem('idPlanilha');

        // Se tem token mas não tem idPlanilha em mãos, busca no Drive automaticamente!
        if (!planilhaAtualId) {
          console.log("ID da planilha ausente. Buscando planilha existente no Google Drive...");
          const planilhaEncontrada = await buscarPlanilhaExistente(tokenGoogle);
          
          if (planilhaEncontrada && planilhaEncontrada.id) {
            planilhaAtualId = planilhaEncontrada.id;
            const nomeExtraido = planilhaEncontrada.name.replace('Base de Dados - ', '').trim();
            
            localStorage.setItem('idPlanilha', planilhaAtualId);
            localStorage.setItem('nomeLoja', nomeExtraido);
            
            setIdPlanilha(planilhaAtualId);
            setNomeLoja(nomeExtraido);
          } else {
            console.log("Nenhuma planilha encontrada no Drive para este usuário.");
            setCarregandoDados(false);
            return; // Realmente é um usuário novo sem loja criada
          }
        }

        // 3. Com o ID da planilha garantido, baixa as 4 abas simultaneamente
        console.log("Iniciando download dos dados do Google Drive...");
        const [linhasEstoque, linhasVendas, linhasClientes, linhasDespesas] = await Promise.all([
          lerAba(tokenGoogle, planilhaAtualId, 'Estoque'),
          lerAba(tokenGoogle, planilhaAtualId, 'Vendas'),
          lerAba(tokenGoogle, planilhaAtualId, 'Clientes'),
          lerAba(tokenGoogle, planilhaAtualId, 'Despesas')
        ]);

        // Processa o Estoque com conversão segura
        if (linhasEstoque && linhasEstoque.length > 0) {
          const estoqueFormatado = linhasEstoque.map(linha => ({
            id: linha[0],
            dataCadastro: linha[1],
            nome: linha[2],
            quantidade: limparNumero(linha[3]),
            preco: limparNumero(linha[4])
          }));
          setProdutos(estoqueFormatado);
        } else {
          setProdutos([]);
        }

        // Processa as Vendas com conversão segura
        if (linhasVendas && linhasVendas.length > 0) {
          const vendasFormatadas = linhasVendas.map(linha => ({
            id: linha[0],
            data: linha[1],
            produto: linha[2],
            quantidade: limparNumero(linha[3]),
            valorUnitario: limparNumero(linha[4]),
            total: limparNumero(linha[5]),
            clienteId: linha[6],
            formaPagamento: linha[7],
            parcelasCartao: linha[8],
            valorEntrada: limparNumero(linha[9]),
            dataPrimeiraParcela: linha[10],
            statusPago: linha[11]
          }));
          setVendas(vendasFormatadas);
        } else {
          setVendas([]);
        }

        // Processa os Clientes
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
        } else {
          setClientes([]);
        }

        // Processa as Despesas com conversão segura
        if (linhasDespesas && linhasDespesas.length > 0) {
          const despesasFormatadas = linhasDespesas.map(linha => ({
            id: linha[0],
            data: linha[1],
            descricao: linha[2],
            categoria: linha[3],
            valor: limparNumero(linha[4]),
            status: linha[5]
          }));
          setDespesas(despesasFormatadas);
        } else {
          setDespesas([]);
        }

        console.log("Sincronização concluída com sucesso!");
      } catch (error) {
        console.error("Falha ao sincronizar dados:", error);
      } finally {
        setCarregandoDados(false);
      }
    };

    sincronizarAmbiente();
  }, [tokenGoogle, idPlanilha, isAdmin]);

  return (
    <AppContext.Provider value={{ 
      tokenGoogle, setTokenGoogle, 
      idPlanilha, setIdPlanilha,
      nomeLoja, setNomeLoja, 
      isAdmin, setIsAdmin,
      carregandoDados,
      produtos, setProdutos,
      vendas, setVendas,
      clientes, setClientes,
      despesas, setDespesas
    }}>
      {children}
    </AppContext.Provider>
  );
}