// ================================================================
//  FINZAP — Estado Central e Inicialização (App)
// ================================================================

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

// Variável global de controle de debounce
window._syncTimer = null; 

// Inicializa o Service Worker do PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Inicialização do App ao carregar a página
window.onload = () => {
  // Verifica se o usuário está logado
  if (!appState.userId) {
    document.getElementById('login-screen').style.display = 'flex';
    checkIOS(); // Função que está em ui.js
  } else {
    document.getElementById('app').style.display = 'flex';
    iniciarApp(); // Função que está em ui.js
  }

  // ── Eventos de Chat e Input
  document.getElementById('btn-send').onclick = () => {
    const m = document.getElementById('msg');
    if (m.value.trim()) { 
      processar(m.value.trim()); // Função que está em api.js
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

  // ── Controle das Tabs (Navegação Inferior)
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
        renderizarTudo(); // Função que está em ui.js
      }
    });
  });
};