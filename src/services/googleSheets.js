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
        properties: { 
          title: `Base de Dados - ${nomeDaLoja}`,
          locale: 'pt_BR'
        },
        sheets: [
          { properties: { title: 'Estoque' } },
          { properties: { title: 'Vendas' } },
          { properties: { title: 'Clientes' } },
          { properties: { title: 'Despesas' } }
        ]
      })
    });

    if (!response.ok) {
      console.error("Erro na resposta ao criar planilha:", await response.text());
      return null;
    }

    const data = await response.json();
    console.log("Planilha criada! Detalhes:", data);
    return data.spreadsheetId || null; 
  } catch (error) {
    console.error("Erro ao criar a planilha:", error);
    return null;
  }
};

export const adicionarLinha = async (token, idPlanilha, nomeAba, valores) => {
  try {
    // Usamos valueInputOption=RAW para que números (ex: 15.5) sejam salvos como números reais
    // sem sofrer interferência de ponto/vírgula do idioma da planilha
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${nomeAba}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [valores] })
      }
    );

    if (!response.ok) {
      console.error(`Erro na API ao salvar na aba ${nomeAba}:`, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao salvar na aba ${nomeAba}:`, error);
    return null;
  }
};

export const lerAba = async (token, idPlanilha, nomeAba) => {
  try {
    // UNFORMATTED_VALUE retorna os números puros (sem "R$" ou vírgula), evitando NaN no JavaScript
    // FORMATTED_STRING mantém as datas exatamente como string "DD/MM/AAAA"
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${nomeAba}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      console.error(`Erro na API ao ler a aba ${nomeAba}:`, await response.text());
      return [];
    }

    const data = await response.json();
    return data.values || []; 
  } catch (error) {
    console.error(`Erro ao ler a aba ${nomeAba}:`, error);
    return [];
  }
};

export const buscarPlanilhaExistente = async (token) => {
  try {
    // Filtra por planilha, pelo nome E garante que NÃO está na lixeira (trashed = false)
    const query = encodeURIComponent(
      "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Base de Dados - ' and trashed = false"
    );

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=createdTime desc`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      console.error("Erro na resposta da API do Drive:", await response.text());
      return null;
    }

    const data = await response.json();
    console.log("Planilhas encontradas no Drive:", data.files);

    if (data.files && data.files.length > 0) {
      return data.files[0]; // Retorna a planilha ativa mais recente
    }
    return null; 
  } catch (error) {
    console.error("Erro ao buscar planilha no Drive:", error);
    return null;
  }
};

// ============================================================================
// FUNÇÕES AVANÇADAS: EDITAR E DELETAR
// ============================================================================

// Função auxiliar 1: Acha qual é o número da linha na planilha buscando pelo ID
const encontrarIndiceDaLinha = async (token, idPlanilha, nomeAba, idBusca) => {
  const dados = await lerAba(token, idPlanilha, nomeAba);
  // Compara como String para evitar divergência entre número e texto
  return dados.findIndex(linha => String(linha[0]) === String(idBusca)); 
};

// Função auxiliar 2: Para deletar de verdade, o Google exige o ID numérico da aba (sheetId), não o nome.
const obterIdDaAbaNumerico = async (token, idPlanilha, nomeAba) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  const aba = data.sheets?.find(s => s.properties.title === nomeAba);
  return aba ? aba.properties.sheetId : null;
};

// Substitui os dados de uma linha existente (Edição)
export const editarLinha = async (token, idPlanilha, nomeAba, idItem, novosValores) => {
  try {
    const indice = await encontrarIndiceDaLinha(token, idPlanilha, nomeAba, idItem);
    if (indice === -1) throw new Error("Item não encontrado na planilha.");

    const numeroDaLinha = indice + 1; // Se o índice é 0, é a linha 1 do Sheets
    
    // Fazemos um PUT diretamente no intervalo exato com valueInputOption=RAW
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${nomeAba}!A${numeroDaLinha}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [novosValores] })
      }
    );

    if (!response.ok) {
      console.error(`Erro na API ao editar linha em ${nomeAba}:`, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao editar linha em ${nomeAba}:`, error);
    return null;
  }
};

// Remove a linha fisicamente da planilha (Deleção)
export const deletarLinha = async (token, idPlanilha, nomeAba, idItem) => {
  try {
    const indice = await encontrarIndiceDaLinha(token, idPlanilha, nomeAba, idItem);
    if (indice === -1) throw new Error("Item não encontrado na planilha.");

    const sheetId = await obterIdDaAbaNumerico(token, idPlanilha, nomeAba);
    if (sheetId === null) throw new Error("Aba não encontrada na planilha.");

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

    if (!response.ok) {
      console.error(`Erro na API ao deletar linha em ${nomeAba}:`, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao deletar linha em ${nomeAba}:`, error);
    return null;
  }
};