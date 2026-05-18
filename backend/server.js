require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/receitas', require('./routes/receitas'));
app.use('/api/despesas', require('./routes/despesas'));
app.use('/api/parcelamentos', require('./routes/parcelamentos'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Rota raiz - serve o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Inicializar banco e subir servidor
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 FinPessoal rodando na porta ${PORT}`);
  });
}).catch(err => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
