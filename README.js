// ==UserScript==
// @name         BR79 Grepolis – AutoStart (2s, sem reexecução, pausa, contador de refresh)
// @namespace    br79.grepolis.panel
// @version      2.3.2
// @description  Executa todos os scripts 1x (2s entre cada), sem log UI; pausa/retoma por script; contador até dar F5 automático
// @match        https://br79.grepolis.com/*
// @match        https://*.br79.grepolis.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  'use strict';

  // ===== CONFIG =====
  const RAW_BASE = 'https://raw.githubusercontent.com/imundstock/Grepolis-User79/main';

  // Contador até reload (F5) — ajuste aqui (em segundos)
  const REFRESH_SECONDS = 10 * 60; // 10min

  const SCRIPTS = [
    { key: 'auto_apagar',  label: 'Auto Apagar Notificações',    file: 'AutoApagarNotificações.js' },
    { key: 'auto_boot',    label: 'Auto Bootcamp',               file: 'AutoBootcamp.js' },
    { key: 'auto_unlock',  label: 'Auto Desbloquear Aldeias',    file: 'AutoDesbloquearAldeias.js' },
    { key: 'auto_farm',    label: 'Auto Farm',                   file: 'AutoFarm.js' },
    { key: 'auto_stop',    label: 'Auto Multi StopCast',         file: 'AutoMultiStopCast.js' },
    { key: 'auto_refresh', label: 'Auto Refresh Page',           file: 'AutoRefreshPage.js' },
    { key: 'gold_builder', label: 'Constructor Gold',            file: 'ConstructorGold.js' },
    { key: 'finish_free',  label: 'Finalizar Construção Grátis', file: 'FinalizarConstruçãoGratis.js' },
  ];

  // ===== CSS =====
  GM_addStyle(`
    #br79-panel-toggle{
      position:fixed;z-index:999999;left:12px;bottom:12px;
      padding:8px 12px;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      border-radius:10px;cursor:pointer;border:1px solid #2b2f3a;background:#0f1220;color:#e6e8ee;
      box-shadow:0 6px 20px rgba(0,0,0,.35)
    }
    #br79-panel{
      position:fixed;z-index:999999;left:12px;bottom:56px;width:320px;max-height:60vh;
      background:#0b0e19;color:#e6e8ee;border:1px solid #2b2f3a;border-radius:14px;
      box-shadow:0 20px 40px rgba(0,0,0,.45);display:none;overflow:hidden
    }
    #br79-panel.dragging{opacity:.85}
    .br79-head{
      display:flex;align-items:center;justify-content:center;
      padding:10px 12px;background:linear-gradient(180deg,#14182d,#0b0e19);
      border-bottom:1px solid #22273a;cursor:move;position:relative
    }
    .br79-title{font:700 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;flex-grow:1;text-align:center}
    .br79-actions{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;gap:8px}
    .br79-btn{background:#1b2140;border:1px solid #2b325a;color:#e6e8ee;border-radius:10px;padding:6px 10px;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;cursor:pointer}
    .br79-btn.small{padding:4px 8px;font-size:11px;border-radius:8px}
    .br79-btn:hover{filter:brightness(1.1)}
    .br79-body{padding:10px;overflow:auto;max-height:calc(60vh - 72px)}
    .br79-list{display:grid;grid-template-columns:1fr auto auto;gap:6px 6px}
    .br79-name{align-self:center;font-size:12px}
    .br79-status{align-self:center;justify-self:end;font-size:11px;opacity:.85}
    .br79-footer{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;border-top:1px solid #22273a;background:#0b0e19}
    .br79-counter{font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;opacity:.95}
  `);

  // ===== LOADER (sandbox TM + top-level await) =====
  window.__br79SoftStop = window.__br79SoftStop || {};

  function exportTrailer(url){
    return `
;try{ window.__br79Export = {
  run:(typeof run!=='undefined'?run:null),
  start:(typeof start!=='undefined'?start:null),
  init:(typeof init!=='undefined'?init:null),
  stop:(typeof stop!=='undefined'?stop:null),
  halt:(typeof halt!=='undefined'?halt:null),
  pause:(typeof pause!=='undefined'?pause:null)
}; }catch(_){} //# sourceURL=${url}`; }

  function runClassic(code, url){ const fn=new Function(code+exportTrailer(url)); fn(); return 'classic'; }
  function runAsyncIIFE(code, url){
    const wrapped=`(async()=>{\n${code}\n${exportTrailer(url)}})().catch(e=>console.error('BR79 async error:',e));`;
    const fn=new Function(wrapped+`\n//# sourceURL=${url}?wrapped=async`); fn(); return 'classic:async-iife';
  }
  function runAsModule(code, url){
    return new Promise((resolve,reject)=>{
      const blob=new Blob([code+`\n//# sourceURL=${url}`],{type:'text/javascript'});
      const blobUrl=URL.createObjectURL(blob);
      const s=document.createElement('script'); s.type='module'; s.src=blobUrl;
      s.onload=()=>{resolve('module'); URL.revokeObjectURL(blobUrl); s.remove();};
      s.onerror=(e)=>{reject(e); URL.revokeObjectURL(blobUrl); s.remove();};
      document.head.appendChild(s);
    });
  }
  const hasImportStatement = (src) => /^\s*(?:\/\/.*\n|\/*[\s\S]*?\*\/\s*)*import\s/m.test(src);
  const isTopLevelAwaitError = (err) => err instanceof SyntaxError && /await is only valid in async functions|top-level await/i.test(err.message||'');

  async function maybeAutoStart(){
    const ex = window.__br79Export || {};
    await new Promise(r => setTimeout(r, 800));
    const main = ex.run || ex.start || ex.init;
    if (typeof main === 'function') { try { await main(); } catch {} }
  }

  function fetchAndRun(url){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET', url, headers:{'Accept':'text/javascript'},
        onload: async (res)=>{
          if(res.status<200||res.status>=300){ reject(new Error(`HTTP ${res.status}`)); return; }
          const code=res.responseText;
          try{
            let mode='classic';
            if (hasImportStatement(code)) { mode=await runAsModule(code,url); }
            else { try{ mode=runClassic(code,url);}catch(e){ if(isTopLevelAwaitError(e)){ mode=runAsyncIIFE(code,url);} else throw e; } }
            await maybeAutoStart();
            resolve(mode);
          }catch(e){ reject(e); }
        },
        onerror:()=>reject(new Error('Erro de rede')),
        ontimeout:()=>reject(new Error('Timeout')),
        timeout:20000
      });
    });
  }

  // ===== CONTROLLER (1x, 2s entre cada) =====
  const controller = {
    items:new Map(),
    pause(key){
      const it=this.items.get(key); if(!it) return;
      if(it.status==='waiting'){ it.status='paused'; updateRow(key); return; }
      if(it.status==='running'){ window.__br79SoftStop[it.file]=true; it.status='paused'; updateRow(key); }
    },
    resume(key){
      const it=this.items.get(key); if(!it) return;
      if(it.status==='paused'){ it.status='waiting'; updateRow(key); }
    }
  };

  // ===== UI =====
  let statusCells={}, buttons={}, counterSpan;

  function updateRow(key){
    const it=controller.items.get(key); if(!it) return;
    const cell=statusCells[key], btn=buttons[key];
    if(cell) cell.textContent =
      it.status==='waiting'?'Aguardando':
      it.status==='running'?'Em execução':
      it.status==='paused'?'Pausado':'Concluído';
    if(btn) btn.textContent=(it.status==='paused')?'Retomar':'Pausar';
  }

  function formatSeconds(s){
    const m=Math.floor(s/60), ss=String(s%60).padStart(2,'0');
    return m>0? `${m}m ${ss}s` : `${ss}s`;
  }

  function createUI(){
    const toggle=document.createElement('button');
    toggle.id='br79-panel-toggle';
    toggle.textContent='BR79 – AutoStart (Ctrl+Alt+G)';
    document.body.appendChild(toggle);

    const panel=document.createElement('div');
    panel.id='br79-panel';
    panel.style.display='block';

    const head=document.createElement('div');
    head.className='br79-head';
    head.innerHTML=`
      <div class="br79-title">Painel Scripts BR79</div>
      <div class="br79-actions"><button class="br79-btn" id="br79-close">Fechar</button></div>`;
    panel.appendChild(head);

    const body=document.createElement('div'); body.className='br79-body'; panel.appendChild(body);

    const list=document.createElement('div'); list.className='br79-list'; body.appendChild(list);

    SCRIPTS.forEach(s=>{
      controller.items.set(s.key,{status:'waiting',label:s.label,file:s.file});
      const name=document.createElement('div'); name.className='br79-name'; name.textContent=s.label; list.appendChild(name);
      const status=document.createElement('div'); status.className='br79-status'; status.textContent='Aguardando'; list.appendChild(status); statusCells[s.key]=status;
      const btn=document.createElement('button'); btn.className='br79-btn small'; btn.textContent='Pausar';
      btn.addEventListener('click',()=>{
        const it=controller.items.get(s.key);
        if(it.status==='paused') controller.resume(s.key); else controller.pause(s.key);
        updateRow(s.key);
      });
      list.appendChild(btn); buttons[s.key]=btn;
    });

    // Footer com contador
    const footer=document.createElement('div'); footer.className='br79-footer';
    const left=document.createElement('span'); left.className='br79-counter'; left.textContent='Próximo refresh: —';
    counterSpan=left;
    footer.appendChild(left);
    panel.appendChild(footer);

    document.body.appendChild(panel);

    const setClosed=(c)=>{panel.style.display=c?'none':'block';};
    toggle.addEventListener('click',()=>setClosed(panel.style.display!=='none'));
    document.getElementById('br79-close').addEventListener('click',()=>setClosed(true));

    // Drag
    (function makeDraggable(){
      let sx=0, sy=0, sl=0, sb=0, dragging=false;
      head.addEventListener('mousedown',(e)=>{
        dragging=true; panel.classList.add('dragging');
        const r=panel.getBoundingClientRect();
        sx=e.clientX; sy=e.clientY; sl=r.left; sb=window.innerHeight-r.bottom; e.preventDefault();
      });
      window.addEventListener('mousemove',(e)=>{
        if(!dragging) return;
        let nl=sl+(e.clientX-sx), nb=sb-(e.clientY-sy);
        nl=Math.max(6,Math.min(nl,window.innerWidth-panel.offsetWidth-6));
        nb=Math.max(6,Math.min(nb,window.innerHeight-46));
        panel.style.left=`${Math.round(nl)}px`;
        panel.style.bottom=`${Math.round(nb)}px`;
      });
      window.addEventListener('mouseup',()=>{
        if(!dragging) return; dragging=false; panel.classList.remove('dragging');
      });
    })();
  }

  function dispatchAllOnce(){
    SCRIPTS.forEach((s,idx)=>{
      setTimeout(async()=>{
        const it=controller.items.get(s.key);
        if(!it||it.status==='paused'){ console.log(`[BR79] skip ${s.label}: pausado antes de iniciar`); return; }
        it.status='running'; updateRow(s.key);
        try{
          await fetchAndRun(`${RAW_BASE}/${encodeURIComponent(s.file)}`);
          it.status='done'; updateRow(s.key);
        }catch(e){
          console.error(`[BR79] erro ${s.label}:`, e);
          it.status='waiting'; updateRow(s.key);
        }
      }, idx*2000); // 2s de intervalo entre cada script
    });
  }

  // Contador de refresh -> F5
  function startRefreshCounter(){
    let remain = Math.max(1, REFRESH_SECONDS | 0);
    const tick = () => {
      if (counterSpan) counterSpan.textContent = `Próximo refresh: ${formatSeconds(remain)}`;
      if (remain <= 0) { location.reload(); return; }
      remain -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  }

  // ===== BOOT =====
  const ready=()=>document.readyState==='interactive'||document.readyState==='complete';
  if(ready()){ createUI(); dispatchAllOnce(); startRefreshCounter(); }
  else {
    document.addEventListener('readystatechange',()=>{
      if(ready()){ createUI(); dispatchAllOnce(); startRefreshCounter(); }
    });
  }
})();
