require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const { initDB, pool } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Arquivos estáticos ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Rotas da API ─────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/receitas',       require('./routes/receitas'));
app.use('/api/despesas',       require('./routes/despesas'));
app.use('/api/parcelamentos',  require('./routes/parcelamentos'));
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/previsao',       require('./routes/previsao'));
app.use('/api/configuracoes',  require('./routes/configuracoes'));

// ── Fallback SPA ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Backup automático a cada 12 horas ────────────────────────────
// '0 */12 * * *' = às 00:00 e 12:00 todos os dias
async function executarBackup() {
  const client = await pool.connect();
  try {
    // Busca todos os usuários
    const usuarios = await client.query('SELECT id FROM usuarios');

    for (const u of usuarios.rows) {
      const uid = u.id;

      // Exporta os dados principais em formato estruturado JSON
      const [receitas, despesas, parcelamentos, recParc] = await Promise.all([
        client.query('SELECT * FROM receitas WHERE usuario_id=$1', [uid]),
        client.query('SELECT * FROM despesas WHERE usuario_id=$1', [uid]),
        client.query('SELECT * FROM parcelamentos WHERE usuario_id=$1', [uid]),
        client.query('SELECT * FROM receitas_parceladas WHERE usuario_id=$1', [uid])
      ]);

      const resumo = {
        backup_em:         new Date().toISOString(),
        usuario_id:        uid,
        total_receitas:    receitas.rows.length,
        total_despesas:    despesas.rows.length,
        total_parcelamentos: parcelamentos.rows.length,
        total_rec_parceladas: recParc.rows.length
      };

      // Registra o log de sucesso no banco
      await client.query(
        `INSERT INTO backup_log (usuario_id, status, detalhes)
         VALUES ($1, 'sucesso', $2)`,
        [uid, JSON.stringify(resumo)]
      );
    }

    console.log(`✅ Backup automático realizado em ${new Date().toLocaleString('pt-BR')}`);
  } catch (err) {
    console.error('❌ Erro no backup automático:', err.message);
    // Tenta registrar falha (sem usuario_id específico)
    try {
      await client.query(
        `INSERT INTO backup_log (usuario_id, status, detalhes)
         VALUES (NULL, 'erro', $1)`,
        [err.message]
      );
    } catch (_) {}
  } finally {
    client.release();
  }
}

// ── Inicialização ─────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 FinPessoal rodando na porta ${PORT}`);
  });

  // Agenda backup a cada 12 horas
  cron.schedule('0 */12 * * *', executarBackup);
  console.log('⏰ Cron de backup agendado (a cada 12h)');

  // Executa um backup imediato na inicialização (opcional)
  setTimeout(executarBackup, 5000);

}).catch(err => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
