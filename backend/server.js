require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const { initDB, pool } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' })); // base64 de foto pode ser grande

// Uploads (caso ainda haja arquivos legados)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Frontend estático
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Rotas da API ─────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/admin',          require('./routes/admin'));
app.use('/api/receitas',       require('./routes/receitas'));
app.use('/api/despesas',       require('./routes/despesas'));
app.use('/api/parcelamentos',  require('./routes/parcelamentos'));
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/previsao',       require('./routes/previsao'));
app.use('/api/configuracoes',  require('./routes/configuracoes'));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Backup automático 12h ─────────────────────────────────────────
async function executarBackup() {
  const client = await pool.connect();
  try {
    const usuarios = await client.query('SELECT id FROM usuarios');
    for (const u of usuarios.rows) {
      const uid = u.id;
      const [r1, r2, r3, r4] = await Promise.all([
        client.query('SELECT COUNT(*) FROM receitas       WHERE usuario_id=$1', [uid]),
        client.query('SELECT COUNT(*) FROM despesas       WHERE usuario_id=$1', [uid]),
        client.query('SELECT COUNT(*) FROM parcelamentos  WHERE usuario_id=$1', [uid]),
        client.query('SELECT COUNT(*) FROM receitas_parceladas WHERE usuario_id=$1', [uid])
      ]);
      await client.query(
        `INSERT INTO backup_log (usuario_id, status, detalhes) VALUES ($1, 'sucesso', $2)`,
        [uid, JSON.stringify({
          backup_em: new Date().toISOString(),
          receitas: r1.rows[0].count, despesas: r2.rows[0].count,
          parcelamentos: r3.rows[0].count, rec_parceladas: r4.rows[0].count
        })]
      );
    }
    console.log(`✅ Backup em ${new Date().toLocaleString('pt-BR')}`);
  } catch (err) {
    console.error('❌ Erro no backup:', err.message);
  } finally { client.release(); }
}

initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 FinPessoal na porta ${PORT}`));
  cron.schedule('0 */12 * * *', executarBackup);
  setTimeout(executarBackup, 5000);
}).catch(err => { console.error(err); process.exit(1); });
