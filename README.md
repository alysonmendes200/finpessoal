# 💰 FinPessoal – Sistema de Finanças Pessoais

Sistema web completo para controle de finanças pessoais com receitas, despesas, parcelamentos e gráficos.

---

## 📁 ESTRUTURA DE ARQUIVOS

```
finpessoal/
├── backend/
│   ├── routes/
│   │   ├── auth.js          ← Login e cadastro
│   │   ├── receitas.js      ← Gerenciar receitas
│   │   ├── despesas.js      ← Gerenciar despesas
│   │   ├── parcelamentos.js ← Parcelamentos
│   │   └── dashboard.js     ← Resumo e gráficos
│   ├── db.js                ← Banco de dados
│   ├── middleware.js         ← Autenticação JWT
│   ├── server.js            ← Servidor principal
│   ├── package.json         ← Dependências
│   └── .env.example         ← Modelo do .env
├── frontend/
│   ├── index.html           ← Página de login
│   ├── pages/
│   │   ├── dashboard.html   ← Dashboard com gráficos
│   │   ├── receitas.html    ← Receitas
│   │   ├── despesas.html    ← Despesas
│   │   └── parcelamentos.html ← Parcelamentos
│   ├── css/
│   │   └── style.css        ← Estilos
│   └── js/
│       ├── api.js           ← Chamadas para API
│       ├── app.js           ← Funções comuns
│       ├── auth.js          ← Login/Cadastro
│       ├── dashboard.js     ← Gráficos
│       ├── receitas.js      ← Receitas
│       ├── despesas.js      ← Despesas
│       └── parcelamentos.js ← Parcelamentos
├── render.yaml              ← Config do Render
└── .gitignore
```

---

## 🚀 PASSO A PASSO PARA COLOCAR NO AR

### PASSO 1 – Criar conta no GitHub
1. Acesse https://github.com e crie uma conta (gratuita)
2. Clique em **"New repository"** (botão verde)
3. Nome: `finpessoal`
4. Deixe **Public** e clique **Create repository**

### PASSO 2 – Subir os arquivos no GitHub
1. Na página do repositório criado, clique em **"uploading an existing file"**
2. Arraste **todos os arquivos e pastas** do projeto (respeitando a estrutura)
3. Clique em **Commit changes**

> ⚠️ **IMPORTANTE**: Suba a pasta `backend` e a pasta `frontend` juntas, na raiz do repositório.

### PASSO 3 – Criar banco de dados no Neon (PostgreSQL gratuito)
1. Acesse https://neon.tech e crie uma conta (gratuita com Google)
2. Clique em **"New Project"**
3. Nome: `finpessoal`
4. Selecione a região mais próxima (ex: **São Paulo** ou **US East**)
5. Clique em **Create Project**
6. Na página do projeto, copie a **Connection string** (começa com `postgresql://...`)
   - Guarde esse texto! Você vai precisar no próximo passo.

### PASSO 4 – Criar o servidor no Render
1. Acesse https://render.com e crie uma conta (gratuita com GitHub)
2. Clique em **"New +"** → **"Web Service"**
3. Conecte sua conta GitHub e selecione o repositório `finpessoal`
4. Configure:
   - **Name**: finpessoal
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free (gratuito)
5. Role até **Environment Variables** e adicione:
   
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | (cole a connection string do Neon) |
   | `JWT_SECRET` | (invente uma senha longa, ex: `minha-chave-super-secreta-2024-finpessoal`) |
   | `NODE_ENV` | `production` |

6. Clique em **Create Web Service**
7. Aguarde o deploy (2-5 minutos). Você verá `Build successful` e `Live` ✅

### PASSO 5 – Acessar o sistema
1. O Render vai gerar uma URL tipo: `https://finpessoal.onrender.com`
2. Acesse essa URL no navegador
3. Clique em **"Criar conta"**, cadastre seu usuário e senha
4. Pronto! 🎉

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

**Plano gratuito do Render**: O servidor "dorme" após 15 minutos sem uso. Na primeira vez que acessar, pode demorar 30-60 segundos para acordar. É normal!

**Plano gratuito do Neon**: Oferece 3GB de armazenamento, mais que suficiente para uso pessoal.

**Segurança**: 
- Nunca suba o arquivo `.env` para o GitHub (já está no `.gitignore`)
- Escolha uma senha forte para o JWT_SECRET

---

## 🛠️ TESTANDO LOCALMENTE (opcional)

Se quiser testar no computador antes de subir:

```bash
# 1. Instalar Node.js em nodejs.org

# 2. Entrar na pasta backend
cd backend

# 3. Copiar o .env de exemplo
cp .env.example .env
# Edite o .env com sua DATABASE_URL do Neon

# 4. Instalar dependências
npm install

# 5. Rodar o servidor
node server.js

# 6. Abrir no navegador
# http://localhost:3000
```

---

## 📞 FUNCIONALIDADES

- ✅ Login e cadastro com senha criptografada
- ✅ Dashboard com resumo do mês
- ✅ Gráfico "onde está indo seu dinheiro" (por categoria)
- ✅ Gráfico receitas vs gastos (evolução anual)
- ✅ Barra de comprometimento da renda
- ✅ Cadastro de receitas por categoria/origem
- ✅ Cadastro de despesas (fixas, variáveis, faturas)
- ✅ Marcar despesas como pagas
- ✅ Parcelamentos com progresso visual
- ✅ Filtro por mês/ano
- ✅ Responsivo para celular
- ✅ Dados salvos no banco (persistem para sempre)
