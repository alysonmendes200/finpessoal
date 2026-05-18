const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Categorias padrão ────────────────────────────────────────────
const CAT_RECEITAS_DEFAULT = [
  'Salário', 'Freelance / Bico', 'Aluguel recebido',
  'Investimentos', 'Pensão / Benefício', 'Presente / Doação', 'Outros'
];
const CAT_DESPESAS_DEFAULT = [
  'Moradia', 'Alimentação', 'Transporte', 'Saúde',
  'Educação', 'Lazer', 'Assinaturas', 'Fatura Cartão',
  'Serviços', 'Vestuário', 'Higiene / Beleza', 'Outros'
];
const TIPOS_DESPESAS_DEFAULT = [
  { nome: 'Fixa',     codigo: 'fixo' },
  { nome: 'Variável', codigo: 'variavel' },
  { nome: 'Fatura',   codigo: 'fatura' }
];

async function initDB() {
  const client = await pool.connect();
  try {
    // ── Tabelas principais ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id        SERIAL PRIMARY KEY,
        nome      VARCHAR(100) NOT NULL,
        email     VARCHAR(150) UNIQUE NOT NULL,
        senha     VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS receitas (
        id         SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao  VARCHAR(200) NOT NULL,
        valor      DECIMAL(10,2) NOT NULL,
        categoria  VARCHAR(100) NOT NULL,
        tipo       VARCHAR(20) NOT NULL DEFAULT 'unico',
        mes        INTEGER NOT NULL,
        ano        INTEGER NOT NULL,
        criado_em  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS receitas_parceladas (
        id              SERIAL PRIMARY KEY,
        usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao       VARCHAR(200) NOT NULL,
        valor_total     DECIMAL(10,2) NOT NULL,
        valor_parcela   DECIMAL(10,2) NOT NULL,
        total_parcelas  INTEGER NOT NULL,
        parcela_atual   INTEGER NOT NULL DEFAULT 1,
        mes_inicio      INTEGER NOT NULL,
        ano_inicio      INTEGER NOT NULL,
        categoria       VARCHAR(100) NOT NULL DEFAULT 'Outros',
        criado_em       TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS despesas (
        id         SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao  VARCHAR(200) NOT NULL,
        valor      DECIMAL(10,2) NOT NULL,
        categoria  VARCHAR(100) NOT NULL,
        tipo       VARCHAR(50) NOT NULL DEFAULT 'fixo',
        mes        INTEGER NOT NULL,
        ano        INTEGER NOT NULL,
        pago       BOOLEAN DEFAULT false,
        criado_em  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS parcelamentos (
        id              SERIAL PRIMARY KEY,
        usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        descricao       VARCHAR(200) NOT NULL,
        valor_total     DECIMAL(10,2) NOT NULL,
        valor_parcela   DECIMAL(10,2) NOT NULL,
        total_parcelas  INTEGER NOT NULL,
        parcela_atual   INTEGER NOT NULL DEFAULT 1,
        mes_inicio      INTEGER NOT NULL,
        ano_inicio      INTEGER NOT NULL,
        categoria       VARCHAR(100) NOT NULL DEFAULT 'Outros',
        criado_em       TIMESTAMP DEFAULT NOW()
      );

      -- ── Tabelas de parametrização ─────────────────────────────
      CREATE TABLE IF NOT EXISTS categorias_receitas (
        id         SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome       VARCHAR(100) NOT NULL,
        ativa      BOOLEAN DEFAULT true,
        criado_em  TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_id, nome)
      );

      CREATE TABLE IF NOT EXISTS categorias_despesas (
        id         SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome       VARCHAR(100) NOT NULL,
        ativa      BOOLEAN DEFAULT true,
        criado_em  TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_id, nome)
      );

      CREATE TABLE IF NOT EXISTS tipos_despesas (
        id         SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome       VARCHAR(100) NOT NULL,
        codigo     VARCHAR(50) NOT NULL,
        ativo      BOOLEAN DEFAULT true,
        criado_em  TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_id, codigo)
      );

      -- ── Log de backup ─────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS backup_log (
        id          SERIAL PRIMARY KEY,
        usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        status      VARCHAR(20) NOT NULL DEFAULT 'sucesso',
        detalhes    TEXT,
        realizado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    // ── Migrações seguras (colunas que podem não existir) ─────────
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

    // ── Seed de categorias padrão por usuário ─────────────────────
    // (executa apenas se o usuário ainda não tem categorias)
    const usuarios = await client.query('SELECT id FROM usuarios');
    for (const u of usuarios.rows) {
      const uid = u.id;

      const cntRec = await client.query(
        'SELECT COUNT(*) FROM categorias_receitas WHERE usuario_id=$1', [uid]
      );
      if (parseInt(cntRec.rows[0].count) === 0) {
        for (const nome of CAT_RECEITAS_DEFAULT) {
          await client.query(
            'INSERT INTO categorias_receitas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [uid, nome]
          );
        }
      }

      const cntDesp = await client.query(
        'SELECT COUNT(*) FROM categorias_despesas WHERE usuario_id=$1', [uid]
      );
      if (parseInt(cntDesp.rows[0].count) === 0) {
        for (const nome of CAT_DESPESAS_DEFAULT) {
          await client.query(
            'INSERT INTO categorias_despesas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [uid, nome]
          );
        }
      }

      const cntTipo = await client.query(
        'SELECT COUNT(*) FROM tipos_despesas WHERE usuario_id=$1', [uid]
      );
      if (parseInt(cntTipo.rows[0].count) === 0) {
        for (const t of TIPOS_DESPESAS_DEFAULT) {
          await client.query(
            'INSERT INTO tipos_despesas (usuario_id, nome, codigo) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [uid, t.nome, t.codigo]
          );
        }
      }
    }

    console.log('✅ Banco de dados inicializado com sucesso');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err.message);
  } finally {
    client.release();
  }
}

// ── Exporta também as listas padrão para uso no seed ao criar usuário
module.exports = {
  pool,
  initDB,
  CAT_RECEITAS_DEFAULT,
  CAT_DESPESAS_DEFAULT,
  TIPOS_DESPESAS_DEFAULT
};
