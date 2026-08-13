import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// CONEXÃO COM O BANCO DE DADOS (TURSO)
// ============================================================================
const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ============================================================================
// ROTA 1: VERIFICAR STATUS DA ASSINATURA 
// ============================================================================
app.post('/api/auth/status', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: 'E-mail é obrigatório.' });
  }

  const emailAtual = email.trim().toLowerCase();
  
  // Limpeza de cache e proteção do e-mail do Dono
  const emailDoDono = 'yurirodriguesp.lc10@gmail.com';
  let emailEnv = '';
  if (process.env.ADMIN_EMAIL) {
    emailEnv = process.env.ADMIN_EMAIL.replace(/['"]/g, '').trim().toLowerCase();
  }
  
  const ehAdmin = emailAtual === emailDoDono || emailAtual === emailEnv;

  // -------------------------------------------------------------
  // MÁQUINA DO TEMPO: Calcula a data de hoje e daqui a 30 dias
  // -------------------------------------------------------------
  const hoje = new Date();
  const hojeFormatado = hoje.toISOString().split('T')[0]; // Fica no formato: "2026-08-13"
  
  const dataVencimentoTeste = new Date();
  dataVencimentoTeste.setDate(hoje.getDate() + 30);
  const vencimentoTesteFormatado = dataVencimentoTeste.toISOString().split('T')[0]; 

  console.log(`\n--- NOVA TENTATIVA DE LOGIN ---`);
  console.log(`Usuário: "${emailAtual}"`);
  console.log(`É o Chefe? ${ehAdmin ? 'SIM ✅' : 'NÃO ❌'}`);
  console.log(`Data de Hoje do Servidor: ${hojeFormatado}`);

  try {
    if (ehAdmin) {
      await db.execute({
        sql: "UPDATE assinaturas SET is_admin = true, status_pagamento = 'ativo', plano = 'Dono', data_vencimento = '2099-12-31' WHERE email = ?",
        args: [emailAtual]
      });
    }

    const resultado = await db.execute({
      sql: 'SELECT * FROM assinaturas WHERE email = ?',
      args: [emailAtual]
    });

    let usuario = resultado.rows[0];

    // ==========================================================
    // 1. CLIENTE NOVO: GANHA O TESTE DE 30 DIAS AUTOMÁTICO
    // ==========================================================
    if (!usuario) {
      await db.execute({
        sql: 'INSERT INTO assinaturas (email, plano, status_pagamento, data_vencimento, is_admin) VALUES (?, ?, ?, ?, ?)',
        args: [
          emailAtual, 
          ehAdmin ? 'Dono' : 'Teste 30 Dias', 
          'ativo', // <--- O SEGREDO: Ele entra como ativo para usar o teste!
          ehAdmin ? '2099-12-31' : vencimentoTesteFormatado,
          ehAdmin
        ]
      });
      
      console.log(`🎉 Novo cliente! Vencimento programado para: ${vencimentoTesteFormatado}\n`);
      
      return res.json({ 
        status_pagamento: 'ativo', 
        is_admin: ehAdmin,
        mensagem: 'Teste de 30 dias iniciado!' 
      });
    }

    // ==========================================================
    // 2. CLIENTE EXISTENTE: VERIFICA SE O TEMPO ACABOU
    // ==========================================================
    let statusAtual = usuario.status_pagamento;
    
    // Compara se a data de hoje é maior que a data de vencimento gravada no banco
    if (!ehAdmin && usuario.data_vencimento && usuario.data_vencimento < hojeFormatado) {
       statusAtual = 'inativo'; // Corta o acesso agora mesmo
       
       // Atualiza a tabela do cliente derrubando ele
       await db.execute({
         sql: "UPDATE assinaturas SET status_pagamento = 'inativo' WHERE email = ?",
         args: [emailAtual]
       });
       console.log(`⛔ O teste/plano do cliente venceu! Acesso bloqueado.\n`);
    } else {
       console.log(`✅ Cliente em dia! Vence em: ${usuario.data_vencimento}\n`);
    }

    res.json({
      status_pagamento: statusAtual, 
      data_vencimento: usuario.data_vencimento,
      plano: usuario.plano,
      is_admin: usuario.is_admin === 1 || usuario.is_admin === true
    });

  } catch (erro) {
    console.error('Erro ao verificar status:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ============================================================================
// ROTA 2: PAINEL ADMIN - LISTAR TODOS OS USUÁRIOS
// ============================================================================
app.get('/api/admin/usuarios', async (req, res) => {
  try {
    const resultado = await db.execute('SELECT * FROM assinaturas ORDER BY data_vencimento DESC');
    res.json(resultado.rows);
  } catch (erro) {
    console.error('Erro ao buscar usuários:', erro);
    res.status(500).json({ erro: 'Erro ao acessar o banco de dados.' });
  }
});

// ============================================================================
// ROTA 3: PAINEL ADMIN - ATUALIZAR STATUS DE UM CLIENTE
// ============================================================================
app.post('/api/admin/atualizar-cliente', async (req, res) => {
  const { email, novoStatus, novaData, novoPlano } = req.body;
  if (!email) return res.status(400).json({ erro: 'Email necessário.' });

  try {
    await db.execute({
      sql: 'UPDATE assinaturas SET status_pagamento = ?, data_vencimento = ?, plano = ? WHERE email = ?',
      args: [novoStatus, novaData, novoPlano, email]
    });
    res.json({ sucesso: true, mensagem: 'Cliente atualizado com sucesso!' });
  } catch (erro) {
    console.error('Erro ao atualizar cliente:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// ============================================================================
// ROTA 4: PAINEL ADMIN - EXCLUIR CLIENTE DEFINITIVAMENTE
// ============================================================================
app.delete('/api/admin/excluir-cliente', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erro: 'Email necessário.' });

  try {
    await db.execute({
      sql: 'DELETE FROM assinaturas WHERE email = ?',
      args: [email]
    });
    res.json({ sucesso: true, mensagem: 'Cliente excluído com sucesso!' });
  } catch (erro) {
    console.error('Erro ao excluir cliente:', erro);
    res.status(500).json({ erro: 'Erro ao excluir do banco de dados.' });
  }
});