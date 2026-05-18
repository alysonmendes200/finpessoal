const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      -- Receitas normais (único ou fixo mensal)
      CREATE TABLE IF NOT EXISTS receitas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao VARCHAR(200) NOT NULL,
        valor DECIMAL(10,2) NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'unico',
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      -- Receitas parceladas (ex: venda parcelada, recebimento parcelado)
      CREATE TABLE IF NOT EXISTS receitas_parceladas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao VARCHAR(200) NOT NULL,
        valor_total DECIMAL(10,2) NOT NULL,
        valor_parcela DECIMAL(10,2) NOT NULL,
        total_parcelas INTEGER NOT NULL,
        parcela_atual INTEGER NOT NULL DEFAULT 1,
        mes_inicio INTEGER NOT NULL,
        ano_inicio INTEGER NOT NULL,
        categoria VARCHAR(100) NOT NULL DEFAULT 'outros',
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS despesas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao VARCHAR(200) NOT NULL,
        valor DECIMAL(10,2) NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        tipo VARCHAR(50) NOT NULL DEFAULT 'fixo',
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        pago BOOLEAN DEFAULT false,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS parcelamentos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao VARCHAR(200) NOT NULL,
        valor_total DECIMAL(10,2) NOT NULL,
        valor_parcela DECIMAL(10,2) NOT NULL,
        total_parcelas INTEGER NOT NULL,
        parcela_atual INTEGER NOT NULL DEFAULT 1,
        mes_inicio INTEGER NOT NULL,
        ano_inicio INTEGER NOT NULL,
        categoria VARCHAR(100) NOT NULL DEFAULT 'outros',
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    // Migração: adiciona coluna tipo em receitas se não existir
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='receitas' AND column_name='tipo'
        ) THEN
          ALTER TABLE receitas ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'unico';
        END IF;
      END $$;
    `);

    console.log('✅ Banco de dados inicializado com sucesso');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
