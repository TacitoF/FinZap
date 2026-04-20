// ================================================================
//  FINZAP — Camada de Interface do Usuário (UI)
// ================================================================

let _modalCb = null;
let _modalAnoSelecionado = new Date().getFullYear();

// Formata valores para R$
function fmt(v) { 
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); 
}

// ── Modais e Toasts ──────────────────────────────────────────────

function showModal(opts) {
  const m = document.getElementById('custom-modal');
  document.getElementById('modal-title').textContent = opts.title || 'Aviso';
  document.getElementById('modal-desc').innerHTML = opts.desc || '';
  const inp = document.getElementById('modal-input');
  
  if (opts.type === 'prompt') {
    inp.style.display = 'block'; 
    inp.value = opts.val || '';
    
    if (opts.inpType === 'decimal') {
      inp.type = 'text';
      inp.inputMode = 'decimal';
    } else if (opts.inpType === 'number') {
      inp.type = 'number';
      inp.inputMode = 'numeric';
    } else {
      inp.type = opts.inpType || 'text';
      inp.removeAttribute('inputmode');
    }
    setTimeout(() => inp.focus(), 120);
  } else { 
    inp.style.display = 'none'; 
  }
  
  const ac = document.getElementById('modal-actions-container');
  ac.innerHTML = '';
  ac.className = (opts.customButtons && opts.customButtons.length > 2) ? 'modal-actions col' : 'modal-actions row';
  
  if (opts.customButtons) {
    opts.customButtons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `modal-btn ${b.class}`; btn.textContent = b.text;
      btn.onclick = () => {
        if (b.onClick) b.onClick(inp.style.display === 'block' ? inp.value : true);
        if (b.close !== false) closeModal();
      };
      ac.appendChild(btn);
    });
  } else {
    if (opts.type === 'confirm' || opts.type === 'prompt') {
      const c = document.createElement('button');
      c.className = 'modal-btn cancel'; c.textContent = 'Cancelar'; c.onclick = closeModal;
      ac.appendChild(c);
    }
    const ok = document.createElement('button');
    ok.className = 'modal-btn confirm'; ok.textContent = 'OK';
    ok.onclick = () => {
      if (_modalCb) _modalCb(inp.style.display === 'block' ? inp.value : true);
      closeModal();
    };
    ac.appendChild(ok);
  }
  _modalCb = opts.onConfirm || null;
  m.classList.add('active');
}

function closeModal() {
  document.getElementById('custom-modal').classList.remove('active');
  document.getElementById('modal-input').blur();
}

function toast(msg, err = false) {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.className = 'toast' + (err ? ' err' : '') + ' on';
  setTimeout(() => el.classList.remove('on'), 2800);
}

// ── Instalação iOS ───────────────────────────────────────────────

function checkIOS() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && !window.navigator.standalone && !localStorage.getItem('finzap_ios_prompt'))
    document.getElementById('ios-prompt').style.display = 'block';
}

function closeIOSPrompt() {
  document.getElementById('ios-prompt').style.display = 'none';
  localStorage.setItem('finzap_ios_prompt', '1');
}

// ── Seletor de Mês Interativo ────────────────────────────────────

function abrirSeletorMes() {
  _modalAnoSelecionado = appState.dataVisualizacao.getFullYear();
  renderSeletorMes();
}

function renderSeletorMes() {
  const mesAtual = appState.dataVisualizacao.getMonth();
  const anoAtual = appState.dataVisualizacao.getFullYear();

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; color:var(--t1);">
      <button onclick="mudarAnoModal(-1)" style="background:var(--s2); border:1px solid var(--b1); color:var(--vi); border-radius:8px; padding:6px 12px; cursor:pointer;">◀</button>
      <span style="font-size:16px; font-weight:bold; font-family:'DM Mono',monospace">${_modalAnoSelecionado}</span>
      <button onclick="mudarAnoModal(1)" style="background:var(--s2); border:1px solid var(--b1); color:var(--vi); border-radius:8px; padding:6px 12px; cursor:pointer;">▶</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
  `;

  const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  MESES.forEach((m, i) => {
    const isSelected = (_modalAnoSelecionado === anoAtual && i === mesAtual);
    const bg = isSelected ? 'var(--vi)' : 'var(--s2)';
    const color = isSelected ? '#fff' : 'var(--t2)';
    const border = isSelected ? 'var(--vi)' : 'var(--b1)';
    
    html += `<button onclick="selecionarMesModal(${i})" style="background:${bg}; color:${color}; border:1px solid ${border}; border-radius:10px; padding:12px 0; font-size:13px; font-weight:500; cursor:pointer; transition:0.2s;">${m}</button>`;
  });

  html += `</div>`;

  showModal({
    title: "Selecionar Mês",
    desc: html,
    customButtons: [{ text: "Cancelar", class: "cancel" }]
  });
}

function mudarAnoModal(offset) {
  _modalAnoSelecionado += offset;
  renderSeletorMes();
}

function selecionarMesModal(mesIndex) {
  appState.dataVisualizacao = new Date(_modalAnoSelecionado, mesIndex, 1);
  closeModal();
  carregarMes(); // Vem do app.js
}

// ── Configurações e Interações de Entrada ────────────────────────

function verificarDiaFatura() {
  const fatKey = `finzap_fatura_dia_${appState.userId}`;
  if (!localStorage.getItem(fatKey)) {
    showModal({
      title: "Configuração Rápida",
      desc: "Que dia a fatura do seu cartão de crédito fecha?\n(Compras no crédito a partir desse dia irão para o mês seguinte)",
      type: "prompt",
      inpType: "number",
      val: "31",
      onConfirm: (v) => {
        let dia = parseInt(v);
        if (isNaN(dia) || dia < 1 || dia > 31) dia = 31;
        localStorage.setItem(fatKey, dia);
        renderizarTudo();
        toast("Configurado com sucesso!");
      }
    });
  }
}

function editFatura() {
  const fatKey = `finzap_fatura_dia_${appState.userId}`;
  const atual = localStorage.getItem(fatKey) || "31";
  showModal({
    title: "Fechamento da Fatura",
    desc: "Que dia o seu cartão de crédito fecha?",
    type: "prompt",
    inpType: "number",
    val: atual,
    onConfirm: (v) => {
      let dia = parseInt(v);
      if (!isNaN(dia) && dia >= 1 && dia <= 31) {
        localStorage.setItem(fatKey, dia);
        renderizarTudo();
        toast("Dia de fechamento salvo!");
      }
    }
  });
}

function editBase() {
  showModal({ 
    title: "Salário Base", 
    desc: "Novo salário base fixo (todos os meses):", 
    type: "prompt", 
    inpType: "decimal", 
    val: appState.salarioBase > 0 ? appState.salarioBase : "",
    onConfirm: (v) => {
      if (v && v.trim()) {
        appState.salarioBase = parseDinheiro(v);
        localStorage.setItem('finzap_salario_base', appState.salarioBase);
        renderizarTudo();
        atualizarBaseBackend(appState.salarioBase); // Vem do api.js
      }
    }
  });
}

function editExtra() {
  const mes = strMesBackend(appState.dataVisualizacao);
  const atual = getRendaExtra(mes);
  const msg = atual > 0
    ? `Você já tem ${fmt(atual)} de extra neste mês.\nDigite o novo valor para SOMAR (ou 0 para zerar):`
    : `Renda extra em ${strMesVisual(appState.dataVisualizacao)}:`;
  showModal({ 
    title: "Renda Extra", 
    desc: msg, 
    type: "prompt", 
    inpType: "decimal", 
    val: "",
    onConfirm: (v) => {
      if (v && v.trim() !== "") {
        const novo = v.trim() === "0" ? 0 : atual + parseDinheiro(v);
        setRendaExtra(mes, novo);
        renderizarTudo();
        atualizarExtraBackend(mes, novo); // Vem do api.js
      }
    }
  });
}

function excluirTxn(idTransacao) {
  const t = appState.txns.find(x => x.idTransacao === idTransacao);
  if (!t) return;

  if (t.parcelas > 1) {
    showModal({
      title: "Excluir Parcelamento",
      desc: `"${t.produto}" é parcelada em ${t.parcelas}x.\nO que deseja fazer?`,
      customButtons: [
        { text: "Excluir Todas", class: "danger",  onClick: () => processarExclusao(t, true)  },
        { text: "Só Esta",       class: "confirm", onClick: () => processarExclusao(t, false) },
        { text: "Cancelar",      class: "cancel" }
      ]
    });
  } else {
    showModal({
      title: "Excluir Compra", desc: "Deseja excluir esta compra?", type: "confirm",
      onConfirm: () => processarExclusao(t, false)
    });
  }
}

// ── Renderização Principal ───────────────────────────────────────

function renderizarTudo() {
  if (!appState.userId) return;
  const mes = strMesBackend(appState.dataVisualizacao);
  const extra = getRendaExtra(mes);

  document.getElementById('cfg-user').textContent = `${appState.userName} (@${appState.userId})`;
  document.getElementById('cfg-base').textContent  = fmt(appState.salarioBase);
  document.getElementById('cfg-extra').textContent = '+ ' + fmt(extra);
  
  const fatDia = localStorage.getItem(`finzap_fatura_dia_${appState.userId}`) || "31";
  document.getElementById('cfg-fatura').textContent = `Dia ${fatDia}`;

  const btnEx = document.getElementById('btn-main-extra');
  if (extra > 0) { btnEx.textContent = `+ ${fmt(extra)} Extra`; btnEx.classList.add('has-extra'); }
  else           { btnEx.textContent = '+ Renda Extra';          btnEx.classList.remove('has-extra'); }

  let tots = { debito:0, credito:0, pix:0 };
  let catTots = {}, maiorCompra = { produto:'Nenhuma', valor:0 }, parceladasAtivas = 0;
  
  appState.txns.forEach(t => {
    tots[t.tipo] = (tots[t.tipo]||0) + t.valor;
    catTots[t.categoria||'Outros'] = (catTots[t.categoria||'Outros']||0) + t.valor;
    if (t.valor > maiorCompra.valor) maiorCompra = t;
    if (t.parcelas > 1) parceladasAtivas++;
  });
  
  const gastos = tots.debito + tots.credito + tots.pix;
  const renda  = appState.salarioBase + extra;
  const saldo  = renda - gastos;

  const elTotal = document.getElementById('total');
  elTotal.textContent = fmt(saldo);
  elTotal.className   = 'balance-amount' + (saldo < 0 ? ' neg' : '');
  document.getElementById('tot-deb').textContent  = fmt(tots.debito);
  document.getElementById('tot-cred').textContent = fmt(tots.credito);
  document.getElementById('tot-pix').textContent  = fmt(tots.pix);

  let perc = renda > 0 ? Math.min(100, Math.round((gastos/renda)*100)) : 0;
  document.getElementById('dash-perc').textContent = perc + '%';
  const arco = (perc/100)*251.2;
  document.getElementById('chart-prog').setAttribute('stroke-dasharray', `${arco} 251.2`);
  document.getElementById('chart-prog').setAttribute('stroke', perc>=90?'#f04060':(perc>=70?'#e8a020':'#5b5ef4'));

  const diasMes = new Date(appState.dataVisualizacao.getFullYear(), appState.dataVisualizacao.getMonth()+1, 0).getDate();
  let diaAtual = diasMes;
  const hoje = new Date();
  if (appState.dataVisualizacao.getMonth()===hoje.getMonth() && appState.dataVisualizacao.getFullYear()===hoje.getFullYear())
    diaAtual = Math.max(1, hoje.getDate());
  
  const media  = gastos / diaAtual;
  const proj   = media * diasMes;
  
  let maiorCat = 'Nenhuma', maiorCatV = 0;
  for (let c in catTots) { if (catTots[c] > maiorCatV) { maiorCatV = catTots[c]; maiorCat = c; } }

  document.getElementById('kpi-gasto').textContent    = fmt(gastos);
  document.getElementById('kpi-tot-cred').textContent = fmt(tots.credito);
  document.getElementById('kpi-tot-deb').textContent  = fmt(tots.debito);
  document.getElementById('kpi-tot-pix').textContent  = fmt(tots.pix);
  
  document.getElementById('kpi-cat').textContent      = maiorCatV > 0 ? maiorCat : 'Nenhuma';
  document.getElementById('kpi-cat').style.color      = maiorCatV > 0 ? 'var(--t1)' : 'var(--t2)';
  document.getElementById('kpi-proj').textContent     = fmt(proj);
  document.getElementById('kpi-proj').style.color     = proj > renda ? 'var(--re)' : 'var(--t1)';
  document.getElementById('kpi-vol').textContent      = appState.txns.length;
  document.getElementById('kpi-parc').textContent     = parceladasAtivas;

  if (appState.fil === 'resumo' || appState.fil === 'config') return;
  const list  = document.getElementById('txn-list');
  const empty = document.getElementById('empty');
  document.getElementById('loading-state').style.display = 'none';

  const vis = appState.fil === 'todos' ? appState.txns : appState.txns.filter(t => t.tipo === appState.fil);
  if (!vis.length) {
    list.style.display = 'none'; empty.style.display = 'flex'; return;
  }
  empty.style.display = 'none'; list.style.display = 'block';
  list.innerHTML = '';

  [...vis].reverse().forEach(t => {
    const c  = {debito:'#1db87a', credito:'#f04060', pix:'#08b8d8'}[t.tipo]||'#9090b0';
    const bg = {debito:'ic-bg-g',  credito:'ic-bg-r',  pix:'ic-bg-c'}[t.tipo]||'ic-bg-g';
    const svgs = {
      debito:  `<path d="M10 4v8M7 9l3 3 3-3M7 7l3-3 3 3" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      credito: `<rect x="3" y="5" width="14" height="10" rx="2" stroke="${c}" stroke-width="1.4" fill="none"/><path d="M3 8.5h14" stroke="${c}" stroke-width="1.4"/><rect x="5" y="10.5" width="3.5" height="1.8" rx=".9" fill="${c}"/>`,
      pix:     `<path d="M11 3.5L8 10h3.5L9 16.5" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    };
    const bdgs = {debito:['Débito','bdg-g'], credito:['Crédito','bdg-r'], pix:['Pix','bdg-c']}[t.tipo]||['Outro','bdg-g'];
    const sub  = t.parcelas>1 ? `Parcela ${t.parcelaNum||1}/${t.parcelas} · ${t.data||t.mesAno}` : (t.data||t.mesAno);
    const catB = t.categoria && t.categoria!=='Outros' ? `<span class="bdg bdg-cat">${t.categoria}</span>` : '';
    const descHtml = t.mensagem && t.mensagem.trim() !== '' ? `<span class="txn-desc">${t.mensagem}</span>` : '';

    const el = document.createElement('div');
    el.className = 'txn';
    el.innerHTML = `
      <div class="txn-ic ${bg}"><svg width="20" height="20" viewBox="0 0 20 20" fill="none">${svgs[t.tipo]||svgs.debito}</svg></div>
      <div class="txn-body">
        <div class="txn-name">${t.produto}</div>
        <div class="txn-sub">${sub}</div>
        ${descHtml}
      </div>
      <div class="txn-right">
        <div class="txn-val">-${fmt(t.valor)}</div>
        <div class="badges">${catB}<span class="bdg ${bdgs[1]}">${bdgs[0]}</span>${t.parcelas>1?`<span class="bdg bdg-a">${t.parcelas}x</span>`:''}</div>
      </div>
      <button class="btn-del" onclick="excluirTxn('${t.idTransacao}')" aria-label="Excluir">
        <svg width="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>`;
    list.appendChild(el);
  });
}

function setBubble(html) { 
  document.getElementById('ai-bubble').innerHTML = html; 
}