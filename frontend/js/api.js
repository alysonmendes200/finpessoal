// ===== FINPESSOAL - API HELPER =====

// Detecta se está em subpasta pages/ ou na raiz
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('fp_token');
}

function getUsuario() {
  const u = localStorage.getItem('fp_usuario');
  return u ? JSON.parse(u) : null;
}

async function apiFetch(url, opcoes = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...opcoes.headers
  };

  try {
    const resp = await fetch(API_BASE + url, { ...opcoes, headers });
    const data = await resp.json();

    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem('fp_token');
      localStorage.removeItem('fp_usuario');
      window.location.href = '/';
      return null;
    }

    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    console.error('Erro de rede:', err);
    return { ok: false, data: { erro: 'Erro de conexão com o servidor.' } };
  }
}

// Funções de conveniência
async function apiGet(url) {
  return apiFetch(url, { method: 'GET' });
}

async function apiPost(url, corpo) {
  return apiFetch(url, { method: 'POST', body: JSON.stringify(corpo) });
}

async function apiDelete(url) {
  return apiFetch(url, { method: 'DELETE' });
}

async function apiPatch(url, corpo) {
  return apiFetch(url, { method: 'PATCH', body: JSON.stringify(corpo) });
}
