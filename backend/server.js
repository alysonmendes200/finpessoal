require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const { initDB, pool } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globais ───────────────────────────────────────────
app.use(cors());
// limit como número (bytes) — mais compatível que string em Node 14/16/18
app.use(express.json({ limit: 2 * 1024 * 1024 })); // 2 MB
app.use(express.urlencoded({ extended: false }));

// Arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Rotas da API ─────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/receitas',      require('./routes/receitas'));
app.use('/api/despesas',      require('./routes/despesas'));
app.use('/api/parcelamentos', require('./routes/parcelamentos'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/previsao',      require('./routes/previsao'));
app.use('/api/configuracoes', require('./routes/configuracoes'));

// Fallback SPA — deve ser o último
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Handler global de erros ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err.message);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// ── Backup automático a cada 12 horas ────────────────────────────
async function executarBackup() {
  let client;
  try {
    client = await pool.connect();
    const usuarios = await client.query('SELECT id FROM usuarios');
    for (const u of usuarios.rows) {
      const uid = u.id;
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          client.query('SELECT COUNT(*) FROM receitas            WHERE usuario_id = $1', [uid]),
          client.query('SELECT COUNT(*) FROM despesas            WHERE usuario_id = $1', [uid]),
          client.query('SELECT COUNT(*) FROM parcelamentos       WHERE usuario_id = $1', [uid]),
          client.query('SELECT COUNT(*) FROM receitas_parceladas WHERE usuario_id = $1', [uid])
        ]);
        await client.query(
          "INSERT INTO backup_log (usuario_id, status, detalhes) VALUES ($1, 'sucesso', $2)",
          [uid, JSON.stringify({
            backup_em:       new Date().toISOString(),
            receitas:        r1.rows[0].count,
            despesas:        r2.rows[0].count,
            parcelamentos:   r3.rows[0].count,
            rec_parceladas:  r4.rows[0].count
          })]
        );
      } catch (errU) {
        console.error('Erro no backup do usuário', uid, ':', errU.message);
      }
    }
    console.log('Backup realizado em', new Date().toLocaleString('pt-BR'));
  } catch (err) {
    console.error('Erro no backup:', err.message);
  } finally {
    if (client) client.release();
  }
}

// ── Inicialização ─────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('FinPessoal rodando na porta', PORT);
    });
    // Backup a cada 12h
    cron.schedule('0 */12 * * *', executarBackup);
    // Backup inicial após 10s (dá tempo do banco estabilizar)
    setTimeout(executarBackup, 10000);
  })
  .catch((err) => {
    console.error('Falha ao inicializar banco:', err.message);
    process.exit(1);
  });
