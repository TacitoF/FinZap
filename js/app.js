// ================================================================
//  FINZAP — Estado Central e Inicialização (App)
// ================================================================

// Constante para as rotas de Auth
const APP_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxTTSsjsXUWidIsRUcRQGKLiHgYCALPex7fyXVY_e2ttVTwAjNHKvRb_tPYaIFjnPJWAg/exec";
const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

// ── Estado Global (Compartilhado com api.js e ui.js)
window.appState = {
  userId: localStorage.getItem('finzap_user') || "",
  userName: localStorage.getItem('finzap_nome') || "",
  salarioBase: parseFloat(localStorage.getItem('finzap_salario_base')) || 0,
  dataVisualizacao: new Date(),
  txns: [],
  fil: 'todos',
  memoriaCache: {}
};

window._syncTimer = null; 

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Utilitários Globais ──
window.gerarId = function() { return Date.now().toString(36) + Math.random().toString(36).slice(2); };
window.parseDinheiro = function(val) {
  const s = String(val).trim();
  return s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(',','.')) || 0 : parseFloat(s) || 0;
};
window.strMesBackend = function(d) { return String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); };
window.strMesVisual = function(d)  { return MESES[d.getMonth()]+'/'+d.getFullYear(); };
window.normTipo = function(t) {
  const s = String(t||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,'').trim();
  return ['debito','credito','pix'].includes(s) ? s : 'debito';
};
window.mesOffset = function(mesStr, offset) {
  const [m, a] = mesStr.split('/').map(Number);
  const d = new Date(a, m - 1 + offset, 1);
  return String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
};
window.getRendaExtra = function(mes) { return parseFloat(localStorage.getItem(`finzap_extra_${appState.userId}_${mes}`)) || 0; };
window.setRendaExtra = function(mes, v) { localStorage.setItem(`finzap_extra_${appState.userId}_${mes}`, v); };

// ── Navegação e Carregamento ──
window.mudarMes = function(offset) {
  appState.dataVisualizacao = new Date(appState.dataVisualizacao.getFullYear(), appState.dataVisualizacao.getMonth() + offset, 1);
  carregarMes(); // O carregarMes original que ficou no app.js precisava voltar pra cá!
};

window.iniciarApp = function() {
  carregarMes();
  setTimeout(verificarDiaFatura, 600); // UI.js
};

window.carregarMes = async function() {
  if (!appState.userId) return;
  const mesStr = strMesBackend(appState.dataVisualizacao);
  document.getElementById('cur-month-text').textContent = strMesVisual(appState.dataVisualizacao);

  if (appState.memoriaCache[mesStr]) {
    appState.txns = appState.memoriaCache[mesStr];
    renderizarTudo(); // UI.js
    document.getElementById('loading-state').style.display = 'none';
  } else {
    appState.txns = [];
    document.getElementById('txn-list').innerHTML = '';
    document.getElementById('empty').style.display = 'none';
    document.getElementById('loading-state').style.display = 'flex';
  }

  if (window._syncTimer) clearTimeout(window._syncTimer);
  
  window._syncTimer = setTimeout(async () => {
    if (strMesBackend(appState.dataVisualizacao) !== mesStr) return;
    document.getElementById('sync-icon').classList.add('on');
    await fetchPlanilha(mesStr); // API.js
    document.getElementById('sync-icon').classList.remove('on');
  }, 400);
};

// ── Autenticação e Telas (As funções que estavam dando erro) ──
window.irParaRegistro = function() { 
  document.getElementById('login-screen').style.display='none'; 
  document.getElementById('register-screen').style.display='flex'; 
};

window.irParaLogin = function() { 
  document.getElementById('register-screen').style.display='none'; 
  document.getElementById('login-screen').style.display='flex'; 
};

window.fazerLogin = async function() {
  const user = document.getElementById('log-user').value.trim().toLowerCase().replace(/\s/g,'');
  const pass = document.getElementById('log-pass').value.trim();
  if (!user || !pass) return showModal({title:"Erro", desc:"Preencha todos os campos."});
  
  const btn = document.getElementById('btn-login');
  btn.textContent = "Entrando..."; btn.disabled = true;
  
  try {
    const r = await fetch(`${APP_SHEETS_URL}?action=login&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`);
    const resLogin = await r.json();
    
    if (resLogin.ok) {
      appState.userId = user; 
      appState.userName = resLogin.nome; 
      appState.salarioBase = parseFloat(resLogin.salarioBase) || 0;
      
      localStorage.setItem('finzap_user', appState.userId);
      localStorage.setItem('finzap_nome', appState.userName);
      localStorage.setItem('finzap_salario_base', appState.salarioBase);
      
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      checkIOS();
      iniciarApp(); 
    } else {
      showModal({title:"Atenção", desc:resLogin.erro || "Erro ao entrar."});
    }
  } catch (err) { 
    showModal({title:"Erro de Conexão", desc:"Verifique sua internet."}); 
  }
  btn.textContent = "Entrar na Conta"; btn.disabled = false;
};

window.fazerRegistro = async function() {
  const nome = document.getElementById('reg-name').value.trim();
  const user = document.getElementById('reg-user').value.trim().toLowerCase().replace(/\s/g,'');
  const pass = document.getElementById('reg-pass').value.trim();
  const sal  = parseDinheiro(document.getElementById('reg-sal').value);
  
  if (!nome || !user || !pass) return showModal({title:"Erro", desc:"Preencha todos os campos."});
  
  const btn = document.getElementById('btn-register');
  btn.textContent = "Criando..."; btn.disabled = true;
  
  try {
    const r = await fetch(`${APP_SHEETS_URL}?action=register&nome=${encodeURIComponent(nome)}&username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&salarioBase=${encodeURIComponent(sal)}`);
    const res = await r.json();
    
    if (res.ok) {
      appState.userId = user; 
      appState.userName = res.nome; 
      appState.salarioBase = parseFloat(res.salarioBase) || 0;
      
      localStorage.setItem('finzap_user', appState.userId); 
      localStorage.setItem('finzap_nome', appState.userName); 
      localStorage.setItem('finzap_salario_base', appState.salarioBase);
      
      document.getElementById('register-screen').style.display = 'none'; 
      document.getElementById('app').style.display = 'flex';
      checkIOS(); 
      iniciarApp();
    } else {
      showModal({title:"Atenção", desc:res.erro || "Erro ao criar conta."});
    }
  } catch (err) { 
    showModal({title:"Erro de Conexão", desc:"Verifique sua internet."}); 
  }
  btn.textContent = "Criar Conta"; btn.disabled = false;
};

window.fazerLogout = function() {
  showModal({ title:"Sair", desc:"Tem certeza que deseja sair?", type:"confirm",
    onConfirm: () => {
      // Preserva preferências importantes no localstorage
      const keysToKeep = ['finzap_ios_prompt'];
      for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('finzap_fatura_dia_')) keysToKeep.push(k);
      }
      
      const savedVals = {};
      keysToKeep.forEach(k => savedVals[k] = localStorage.getItem(k));
      
      localStorage.clear();
      
      Object.keys(savedVals).forEach(k => {
          if (savedVals[k] !== null) localStorage.setItem(k, savedVals[k]);
      });
      
      location.reload();
    }
  });
};

// ── Eventos Visuais ao carregar a página ──
window.onload = () => {
  if (!appState.userId) {
    document.getElementById('login-screen').style.display = 'flex';
    checkIOS(); 
  } else {
    document.getElementById('app').style.display = 'flex';
    iniciarApp(); 
  }

  // Lógica da caixa de input de texto e enter
  document.getElementById('btn-send').onclick = () => {
    const m = document.getElementById('msg');
    if (m.value.trim()) { 
      processar(m.value.trim()); // Função de api.js
      m.value = ''; 
      m.style.height = ''; 
    }
  };

  document.getElementById('msg').onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      document.getElementById('btn-send').click(); 
    }
  };

  document.getElementById('msg').oninput = function() {
    this.style.height = ''; 
    this.style.height = Math.min(this.scrollHeight, 96) + 'px';
  };

  // Tabs Inferiores (Lista, Resumo, Config)
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      appState.fil = tab.dataset.f;

      document.getElementById('txn-list').style.display   = 'none';
      document.getElementById('empty').style.display      = 'none';
      document.getElementById('dashboard').classList.remove('active-panel');
      document.getElementById('config-panel').classList.remove('active-panel');

      if (appState.fil === 'resumo') {
        document.getElementById('dashboard').classList.add('active-panel');
      } else if (appState.fil === 'config') {
        document.getElementById('config-panel').classList.add('active-panel');
      } else {
        renderizarTudo(); 
      }
    });
  });
};