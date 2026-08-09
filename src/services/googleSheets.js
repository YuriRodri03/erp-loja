// src/services/googleSheets.js

export const criarPlanilhaBase = async (token, nomeDaLoja) => {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: `Base de Dados - ${nomeDaLoja}` },
        sheets: [
          { properties: { title: 'Estoque' } },
          { properties: { title: 'Vendas' } },
          { properties: { title: 'Clientes' } },
          { properties: { title: 'Despesas' } } // <-- ABA ADICIONADA AQUI!
        ]
      })
    });
    const data = await response.json();
    console.log("Planilha criada! Detalhes:", data);
    return data.spreadsheetId; 
  } catch (error) {
    console.error("Erro ao criar a planilha:", error);
    return null;
  }
};

export const adicionarLinha = async (token, idPlanilha, nomeAba, valores) => {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${nomeAba}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [valores] })
      }
    );
    return await response.json();
  } catch (error) {
    console.error(`Erro ao salvar na aba ${nomeAba}:`, error);
    return null;
  }
};

export const lerAba = async (token, idPlanilha, nomeAba) => {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${nomeAba}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    return data.values || []; 
  } catch (error) {
    console.error(`Erro ao ler a aba ${nomeAba}:`, error);
    return [];
  }
};

export const buscarPlanilhaExistente = async (token) => {
  try {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Base de Dados'",
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    if (data.files && data.files.length > 0) return data.files[0];
    return null; 
  } catch (error) {
    console.error("Erro ao buscar planilha no Drive:", error);
    return null;
  }
};

// ============================================================================
// NOVAS FUNÇÕES AVANÇADAS: EDITAR E DELETAR
// ============================================================================

// Função auxiliar 1: Acha qual é o número da linha na planilha buscando pelo ID
const encontrarIndiceDaLinha = async (token, idPlanilha, nomeAba, idBusca) => {
  const dados = await lerAba(token, idPlanilha, nomeAba);
  // Procura em qual posição do array o ID bate. Retorna o índice (0, 1, 2...)
  return dados.findIndex(linha => linha[0] == idBusca); 
};

// Função auxiliar 2: Para deletar de verdade, o Google exige o ID numérico da aba (sheetId), não o nome.
const obterIdDaAbaNumerico = async (token, idPlanilha, nomeAba) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  const aba = data.sheets.find(s => s.properties.title === nomeAba);
  return aba ? aba.properties.sheetId : null;
};

// NOVA FUNÇÃO: Substitui os dados de uma linha existente (Edição)
export const editarLinha = async (token, idPlanilha, nomeAba, idItem, novosValores) => {
  try {
    const indice = await encontrarIndiceDaLinha(token, idPlanilha, nomeAba, idItem);
    if (indice === -1) throw new Error("Item não encontrado na planilha.");

    const numeroDaLinha = indice + 1; // Se o índice é 0, é a linha 1 do Excel
    
    // Fazemos um PUT diretamente no intervalo exato (Ex: Clientes!A5)
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${nomeAba}!A${numeroDaLinha}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [novosValores] })
      }
    );
    return await response.json();
  } catch (error) {
    console.error(`Erro ao editar linha em ${nomeAba}:`, error);
    return null;
  }
};

// NOVA FUNÇÃO: Remove a linha fisicamente da planilha (Deleção)
export const deletarLinha = async (token, idPlanilha, nomeAba, idItem) => {
  try {
    const indice = await encontrarIndiceDaLinha(token, idPlanilha, nomeAba, idItem);
    if (indice === -1) throw new Error("Item não encontrado na planilha.");

    const sheetId = await obterIdDaAbaNumerico(token, idPlanilha, nomeAba);

    // O comando batchUpdate com deleteDimension apaga a linha e "puxa" os dados de baixo para cima
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: "ROWS",
                  startIndex: indice,       // A partir desta linha
                  endIndex: indice + 1      // Até a próxima linha (apaga apenas 1)
                }
              }
            }
          ]
        })
      }
    );
    return await response.json();
  } catch (error) {
    console.error(`Erro ao deletar linha em ${nomeAba}:`, error);
    return null;
  }
};