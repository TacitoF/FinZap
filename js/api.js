// ================================================================
//  FINZAP — Camada de API (Google Sheets & Claude AI)
// ================================================================

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const SHEETS_URL   = "https://script.google.com/macros/s/AKfycbxTTSsjsXUWidIsRUcRQGKLiHgYCALPex7fyXVY_e2ttVTwAjNHKvRb_tPYaIFjnPJWAg/exec";
const CLAUDE_URL   = "/api/claude";

// --- REQUISIÇÕES AO GOOGLE SHEETS ---

async function fetchPlanilha(mesStr) {
  try {
    const r = await fetch(`${SHEETS_URL}?action=get&user=${appState.userId}&mes=${encodeURIComponent(mesStr)}&_=${Date.now()}`);
    const data = await r.json();

    if (data.ok) {
      const transacoesFrescas = (data.transacoes||[]).map(t => ({ ...t, tipo: normTipo(t.tipo) }));
      
      appState.memoriaCache[mesStr] = transacoesFrescas;

      // Só atualiza a tela se o usuário AINDA estiver olhando para o mesmo mês que pedimos
      if (strMesBackend(appState.dataVisualizacao) === mesStr) {
        appState.txns = transacoesFrescas;

        if (data.nomeExibicao) { appState.userName = data.nomeExibicao; localStorage.setItem('finzap_nome', appState.userName); }
        if (data.salarioBase !== undefined) { appState.salarioBase = parseFloat(data.salarioBase)||0; localStorage.setItem('finzap_salario_base', appState.salarioBase); }
        if (data.rendaExtra  !== undefined) { setRendaExtra(mesStr, parseFloat(data.rendaExtra)||0); }

        document.getElementById('loading-state').style.display = 'none';
        renderizarTudo();
      }
    }
  } catch (e) {
    console.error('Erro de sincronização:', e);
  }
}

function processarExclusao(t, deleteAll) {
  const mesAtual = strMesBackend(appState.dataVisualizacao);

  // 1. Atualização Otimista na Memória
  if (deleteAll) {
    Object.keys(appState.memoriaCache).forEach(m => {
      appState.memoriaCache[m] = appState.memoriaCache[m].filter(x => x.idTransacao !== t.idTransacao);
    });
  } else {
    if (appState.memoriaCache[mesAtual]) {
      appState.memoriaCache[mesAtual] = appState.memoriaCache[mesAtual].filter(x => !(x.idTransacao === t.idTransacao && x.parcelaNum === t.parcelaNum));
    }
  }
  
  // Atualiza visão imediatamente
  appState.txns = appState.memoriaCache[mesAtual] || [];
  renderizarTudo();

  // 2. Envia para o backend de forma assíncrona
  const payload = {
    action: deleteAll ? 'delete_all' : 'delete',
    user: appState.userId, mesAno: mesAtual, produto: t.produto, valor: t.valor,
    valorTotal: t.valorTotal || t.valor, tipo: t.tipo, parcelas: t.parcelas,
    parcelaNum: t.parcelaNum, idTransacao: t.idTransacao
  };

  fetch(SHEETS_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(() => {
        toast(deleteAll ? "Parcelamento excluído!" : "Compra excluída!");
        
        if (strMesBackend(appState.dataVisualizacao) === mesAtual) {
            fetchPlanilha(mesAtual);
        }
    })
    .catch(() => toast("Erro de conexão", true));
}

// --- INTELIGÊNCIA ARTIFICIAL (CLAUDE) ---

async function processar(txt) {
  const w  = document.querySelector('.chat-area');
  const ub = document.createElement('div');
  ub.className = 'bubble bubble-user'; ub.textContent = txt;
  w.insertBefore(ub, document.getElementById('dots'));
  setTimeout(() => ub.remove(), 6000);
  document.getElementById('dots').classList.add('on');

  const mesAtualVisivel = strMesBackend(appState.dataVisualizacao);
  const mesNum = appState.dataVisualizacao.getMonth() + 1;

  // LÓGICA DO FECHAMENTO DO CARTÃO
  const diaAtual = new Date().getDate();
  const diaFatura = parseInt(localStorage.getItem(`finzap_fatura_dia_${appState.userId}`)) || 31;
  
  let mesCreditoPadrao = mesAtualVisivel;
  if (diaAtual >= diaFatura) {
    mesCreditoPadrao = mesOffset(mesAtualVisivel, 1);
  }

  const prompt = `Você é um assistente financeiro. Extraia os dados da compra do texto.
Responda APENAS com um JSON válido, sem NENHUM markdown (sem \`\`\`json).

Formato OBRIGATÓRIO:
{"produto":"Nome", "valor_total": 120.00, "valor_parcela": 40.00, "tipo":"debito|credito|pix", "categoria":"Alimentação|Transporte|Lazer|Contas|Outros", "parcelas": 3, "quantidade": 1, "mesAno":"MM/YYYY", "descricao":"Contexto extra se houver (ex: cartao de lu, minha mae vai pagar), senao vazio"}

REGRAS:
1. "valor_parcela": valor de CADA mensalidade (ou valor à vista).
2. "valor_total": valor_parcela × parcelas.
3. "quantidade": repeticoes da compra (NUNCA multiplique valores).
- Hoje visualizamos a aba de ${mesAtualVisivel}. Use este mês para 'debito'/'pix' caso o usuário não especifique a data.
- ATENÇÃO CRÉDITO: A fatura do cartão fecha dia ${diaFatura} e hoje é dia ${diaAtual}. Por padrão, você DEVE lançar compras no 'credito' no mês ${mesCreditoPadrao} (pois a fatura atual já fechou ou está no ciclo normal).`;

  try {
    const r    = await fetch(CLAUDE_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ model:CLAUDE_MODEL, max_tokens:300, system:prompt, messages:[{role:'user', content:txt}] }) });
    const data = await r.json();
    document.getElementById('dots').classList.remove('on');

    const raw   = data.content?.[0]?.text || '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : '{}');

    if (!['debito','credito','pix'].includes(parsed.tipo)) parsed.tipo = 'debito';
    parsed.tipo = normTipo(parsed.tipo);

    if (!parsed.valor_parcela && !parsed.valor) {
      setBubble(`Não entendi. Tente: <b>"paguei 200 no pix na padaria"</b>`); return;
    }

    const parcelas     = parsed.parcelas     || 1;
    const quantidade   = parsed.quantidade   || 1;
    const valorParcela = parsed.valor_parcela || parsed.valor || 0;
    const valorTotal   = parsed.valor_total   || (valorParcela * parcelas);
    const mesAlvo      = parsed.mesAno        || (parsed.tipo === 'credito' ? mesCreditoPadrao : mesAtualVisivel);

    for (let q = 0; q < quantidade; q++) {
      const idTx = gerarId();
      const hoje = new Date();
      const dataHoje = String(hoje.getDate()).padStart(2,'0') + '/' + mesAlvo;

      const txnBase = {
        produto: parsed.produto || 'Compra', valor: valorParcela, valorTotal: valorTotal,
        tipo: parsed.tipo, categoria: parsed.categoria || 'Outros', parcelas,
        parcelaNum: 1, mesAno: mesAlvo, data: dataHoje, idTransacao: idTx,
        mensagem: parsed.descricao || "" 
      };

      // 1. Injeta otimisticamente na memória
      for (let p = 0; p < parcelas; p++) {
        const mesP = mesOffset(mesAlvo, p);
        if (!appState.memoriaCache[mesP]) appState.memoriaCache[mesP] = [];
        appState.memoriaCache[mesP].push({
          ...txnBase, parcelaNum: p + 1, mesAno: mesP, data: p === 0 ? dataHoje : ('01/' + mesP)
        });
      }

      if (appState.memoriaCache[mesAtualVisivel]) {
        appState.txns = appState.memoriaCache[mesAtualVisivel];
        if (appState.fil === 'resumo' || appState.fil === 'config') document.querySelector('[data-f="todos"]').click();
        else renderizarTudo();
      }

      // 2. Dispara pra planilha assincronamente e sincroniza o mês atual ao finalizar
      fetch(SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'save', user: appState.userId, produto: txnBase.produto, valor: valorParcela,
          valorTotal, tipo: txnBase.tipo, categoria: txnBase.categoria, parcelas,
          mesAno: mesAlvo, mensagem: txnBase.mensagem, idTransacao: idTx
        })
      }).then(() => {
        if (strMesBackend(appState.dataVisualizacao) === mesAtualVisivel) {
           fetchPlanilha(mesAtualVisivel);
        }
      }).catch(e => console.error(e));
    }

    const pm = parcelas > 1 ? `, em <b>${parcelas}x</b>` : '';
    const qm = quantidade > 1 ? ` (${quantidade}× neste mês)` : '';
    setBubble(`Anotado. <b>${parsed.produto}</b> — <b>${fmt(valorParcela)}</b>${pm}${qm}.`);

  } catch (e) {
    console.error('processar erro:', e);
    document.getElementById('dots').classList.remove('on');
    setBubble('Erro ao processar. Verifique sua conexão.');
  }
}