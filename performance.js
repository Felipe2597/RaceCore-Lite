'use strict';
// Cronotracker snapshot reader. Only Challenge sessions/rows are accepted.
const PERF_KEY='racecore-lite-performance-v02';
let historyStore={};try{historyStore=JSON.parse(localStorage.getItem(PERF_KEY)||'{}')||{};}catch{}
let selectedSession='',latestSession='',timer=null,busy=false,storageFailed=false;
let lastRead=0,lastChange=0,lastFingerprint='',feedMode='idle',generation=0;
function updateFeed(){const badge=$('feedBadge');let mode=feedMode;if(mode==='live'&&Date.now()-lastRead>15000)mode='stale';const labels={idle:'OFFLINE',connecting:'CONECTANDO',live:'XML RECEBIDO',stale:'SEM ATUALIZAÇÃO',error:'SEM CONEXÃO',imported:'XML IMPORTADO',paused:'PAUSADO'};badge.dataset.state=mode;$('feedState').textContent=labels[mode]||labels.idle;$('readClock').textContent=lastRead?new Date(lastRead).toLocaleTimeString('pt-BR'):'—';if(mode==='live'&&Date.now()-lastChange>30000){$('feedState').textContent='XML SEM MUDANÇA';badge.dataset.state='stale';} }
function noteRead(xml,mode){const now=Date.now();lastRead=now;if(xml!==lastFingerprint){lastFingerprint=xml;lastChange=now;}feedMode=mode;updateFeed();}
const timeMs=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const s=String(v).trim().replace(',','.');if(!/^\d+(?::\d{1,2})*(?:\.\d{1,3})?$/.test(s))return null;const n=s.split(':').reduce((a,b)=>a*60+Number(b),0);return n>0&&Number.isFinite(n)?Math.round(n*1000):null;};
const seconds=v=>v==null?'—':(v/1000).toFixed(3);
const lapFmt=v=>v==null?'—':`${Math.floor(v/60000)}:${((v%60000)/1000).toFixed(3).padStart(6,'0')}`;
const deltaFmt=v=>v==null?'—':(v>0?'+':v<0?'−':'')+seconds(Math.abs(v));
const minValid=arr=>{const v=arr.filter(x=>x!=null);return v.length?Math.min(...v):null;};
const sumS=s=>s?.length===3&&s.every(v=>v!=null)?s.reduce((a,b)=>a+b,0):null;
const isChallenge=s=>/challenge/i.test(s||'');
const rejectOther=s=>/carrera|f4\s*br|formula\s*4/i.test(s||'')&&!isChallenge(s);
function savePerf(){try{localStorage.setItem(PERF_KEY,JSON.stringify(historyStore));storageFailed=false;}catch{storageFailed=true;}}
// A troca só é confirmada por um nome individual inequívoco do feed.
const normalizeName = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s*\([^)]*\)\s*/g,' ').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function driverNames(id){return roster().find(c=>c.id===id)?.drivers||[];}
function resolveDriver(id,fields){
 const names=driverNames(id), matches=new Set();
 for(const value of fields){const normalized=normalizeName(value);if(!normalized)continue;
  for(const name of names){const full=normalizeName(name), parts=full.split(' '),first=parts[0],last=parts.at(-1);
   const variants=[full,first+' '+last,first[0]+' '+last,first[0]+' '+parts.slice(1).join(' '),last,first];
   if(variants.includes(normalized))matches.add(name);
  }
 }
 return matches.size===1?[...matches][0]:null;
}
function driverStats(car,name){
 if(!car)return null;if(!name)return car;
 const laps=Object.fromEntries(Object.entries(car.laps||{}).filter(([,l])=>l.driver===name));const values=Object.values(laps);
 return {...car,name,best:minValid(values.map(l=>l.time)),bestS:[0,1,2].map(i=>minValid(values.map(l=>l.sectors?.[i]))),laps,maxLap:values.length};
}
function activeLabel(c){return c?.activeDriver||'Não identificado';}
function recordIdentity(car,driver,n,now){
 const prev=car.activeDriver||null, previousLap=car.maxLap||0;
 if(n<previousLap)return {assign:false,stale:true};
 // No primeiro snapshot, ou quando mudam nome/contador, não atribuir voltas retroativas.
 const assign=Boolean(car.identitySeen&&prev&&driver===prev&&n===previousLap+1);
 if(driver&&car.lastConfirmed&&car.lastConfirmed!==driver){(car.changes ||= []).push({from:car.lastConfirmed,to:driver,lap:n,at:now});}
 if(driver)car.lastConfirmed=driver;
 car.activeDriver=driver;car.identitySeen=true;
 return {assign,stale:false};
}
function consumeXML(xml){
 const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='resultspage')throw Error('XML inválido ou formato diferente de resultspage.');
 const label=name=>doc.querySelector(`label[type="${name}"]`)?.textContent.trim()||'';
 const group=label('groupname'),run=label('runname'),event=label('eventname'),track=label('trackname');
 if(!run)throw Error('Nome da sessão (runname) não informado no XML.');
 const raw=[...doc.querySelectorAll('results > result')];
 const rows=raw.filter(r=>{const cls=r.getAttribute('class')||'';return !rejectOther(cls)&&(isChallenge(cls)||(isChallenge(group)&&!rejectOther(group)&&!rejectOther(cls)));});
 if(!rows.length)throw Error(`Sessão não identificada como Challenge: ${group||'grupo desconhecido'} / ${run}. Nenhum dado misturado.`);
 const key=JSON.stringify([event,track,group,run]);const now=new Date().toISOString();
 const session=historyStore[key]||{name:run,group,event,track,cars:{},created:now,updated:now};
 for(const el of rows){const a=k=>el.getAttribute(k)||'',id=a('no').replace(/^#/,'').trim();if(!/^\d+$/.test(id))continue;
 const car=session.cars[id]||{id,name:a('fullname')||a('firstname')||'#'+id,cls:a('class'),best:null,bestS:[null,null,null],laps:{},maxLap:0};
 const n=Number(a('laps'));if(!a('laps').trim()||!Number.isInteger(n)||n<0)continue;
 const feedNames=[a('fullname'),[a('firstname'),a('lastname')].filter(Boolean).join(' '),a('additional2')];
 const identity=recordIdentity(car,resolveDriver(id,feedNames),n,now);if(identity.stale)continue;
 car.name=a('fullname')||car.name;car.feedName=feedNames.filter(Boolean).join(' / ');car.cls=a('class')||car.cls;
 // A stale snapshot must not overwrite a newer snapshot of the same session.
 car.best=minValid([car.best,timeMs(a('besttime'))]);
 car.bestS=car.bestS.map((v,i)=>minValid([v,timeMs(a('bestsection'+i))]));
 const times=['lasttime','secondlasttime','thirdlasttime'].map(k=>timeMs(a(k)));
 const sectors=[0,1,2].map(i=>timeMs(a('section'+i)));
 // The live fields may already describe the next lap. Only attach sectors if they sum to the completed lap.
 const validS=sumS(sectors)!=null&&times[0]!=null&&Math.abs(sumS(sectors)-times[0])<=5?sectors:[null,null,null];
 times.forEach((t,i)=>{
 const lap=n-i;if(lap<1||t==null)return;const old=car.laps[lap],s=i===0?validS:[null,null,null];
 const matched=old?.time===t;
 const assigned=matched?old.driver||null:(i===0&&identity.assign?car.activeDriver:null);
 car.laps[lap]={lap,time:t,sectors:sumS(s)!=null?s:matched?old.sectors:s,driver:old?.source==='manual'?old.driver:assigned,source:old?.source==='manual'?'manual':assigned?'observado':'indefinido'};
 car.best=minValid([car.best,t]);});
 if(n>=car.maxLap){car.maxLap=n;car.pos=Number(a('position'))||null;}
 if(sumS(validS)!=null)car.bestS=car.bestS.map((v,i)=>minValid([v,validS[i]]));
 session.cars[id]=car;
 }
 if(!Object.keys(session.cars).length)throw Error('Nenhum carro Challenge válido.');session.updated=now;historyStore[key]=session;const follow=!selectedSession||selectedSession===latestSession;latestSession=key;if(follow)selectedSession=key;savePerf();renderPerf();return `${group} · ${run} · ${Object.keys(session.cars).length} carros`;
}
function currentPerf(){return historyStore[selectedSession];}
function belongs(car,cat){if(cat==='geral')return true;const base=roster().find(c=>c.id===car.id);return base?Object.hasOwn(base.history,cat):cat==='sport'?/sport/i.test(car.cls):/rook/i.test(car.cls);}
function perfOrder(s,cat){return Object.values(s?.cars||{}).filter(c=>belongs(c,cat)).sort((a,b)=>(a.best??Infinity)-(b.best??Infinity)||Number(a.id)-Number(b.id));}
function renderPerf(){
 const keys=Object.keys(historyStore).sort((a,b)=>historyStore[b].updated.localeCompare(historyStore[a].updated));if(!historyStore[selectedSession])selectedSession=keys[0]||'';
 $('sessionSelect').innerHTML=keys.length?keys.map(k=>`<option value="${esc(k)}">${esc(historyStore[k].name)} · ${esc(historyStore[k].group)}</option>`).join(''):'<option value="">Sem sessões</option>';$('sessionSelect').value=selectedSession;
 const s=currentPerf(),cat=$('perfCat').value,rows=perfOrder(s,cat),car=s?.cars['100'],live=historyStore[latestSession]?.cars['100'];
 $('liveSession').textContent=latestSession?historyStore[latestSession].name:s?.name||'Aguardando sessão';
 $('sessionContext').textContent=s?`${s.name} · ${s.group}`:'Sem sessão registrada';$('coverage').textContent=s?`${Object.keys(s.cars).length} / ${Object.values(s.cars).reduce((n,c)=>n+Object.keys(c.laps).length,0)}`:'—';
 const active=latestSession?live:car;const change=active?.changes?.at(-1);
 $('activeDriver').textContent=activeLabel(active);$('activeFeed').textContent=active?.activeDriver?'Nome individual recebido da cronometragem':active?.feedName?'Nome recebido: '+active.feedName:'Aguardando identificação individual no XML';
 $('activeScope').textContent=latestSession?'ÚLTIMA LEITURA DO FEED':'HISTÓRICO / SEM LEITURA ATUAL';
 $('driverChange').textContent=change?`${change.from} → ${change.to} · contador ${change.lap}`:'Nenhuma troca confirmada';
 const prevDriver=$('driverSelect').value;
 $('driverSelect').innerHTML='<option value="">Carro #100 · consolidado</option>'+driverNames('100').map(n=>`<option value="${esc(n)}">${esc(n)} · individual</option>`).join('');$('driverSelect').value=prevDriver;
 const focusName=$('driverSelect').value,primary=driverStats(car,focusName);
 const previous=$('rivalSelect').value;
 $('rivalSelect').innerHTML='<option value="leader">Mais rápido da categoria (outro carro)</option>'+rows.filter(c=>c.id!=='100').map(c=>`<option value="${esc(c.id)}">#${esc(c.id)} · carro</option>`).join('')+rows.flatMap(c=>driverNames(c.id).filter(n=>!(c.id==='100'&&n===focusName)).map(n=>`<option value="${esc(c.id+'|'+n)}">#${esc(c.id)} · ${esc(n)}</option>`)).join('');if([...$('rivalSelect').options].some(o=>o.value===previous))$('rivalSelect').value=previous;
 const rivals=rows.filter(c=>c.id!=='100'),rv=$('rivalSelect').value,[rid,rname]=rv.split('|');const rival=rv==='leader'?rivals.find(c=>c.best!=null):driverStats(s?.cars[rid],rname);
 const best=primary?.best??null,ideal=sumS(primary?.bestS),gap=best!=null&&rival?.best!=null?best-rival.best:null;
 $('compareTitle').textContent=(focusName||'Carro #100')+' × '+(rival?(rname||'#'+rival.id):'referência');
 $('perfCards').innerHTML=[['Melhor volta',lapFmt(best)],['Última volta',lapFmt(primary?Object.values(primary.laps).sort((a,b)=>b.lap-a.lap)[0]?.time:null)],['Volta ideal',lapFmt(ideal)],['Delta melhor volta',deltaFmt(gap)]].map(([t,v])=>`<article class="card"><div class="eyebrow">${t}</div><div class="big">${v}</div></article>`).join('');
 const last=c=>c?Object.values(c.laps).sort((a,b)=>b.lap-a.lap)[0]:null;
 const mode=$('timeMode').value,cl=last(primary),rl=last(rival);const a=mode==='best'?primary?.bestS:cl?.sectors,b=mode==='best'?rival?.bestS:rl?.sectors;
 const comp=[...Array.from({length:3},(_,i)=>({label:'S'+(i+1),a:a?.[i]??null,b:b?.[i]??null,min:mode==='best'?minValid(rows.map(c=>c.bestS[i])):null,lap:false})),{label:mode==='best'?'Melhor volta':'Última volta',a:mode==='best'?best:cl?.time??null,b:mode==='best'?rival?.best??null:rl?.time??null,min:mode==='best'?minValid(rows.map(c=>c.best)):null,lap:true}];
 $('comparison').innerHTML=comp.map(x=>{const d=x.a!=null&&x.b!=null?x.a-x.b:null,f=x.lap?lapFmt:seconds;return `<tr><td>${x.label}</td><td class="${x.a!=null&&x.a===x.min?'absolute':''}">${f(x.a)}</td><td class="${x.b!=null&&x.b===x.min?'absolute':''}">${f(x.b)}</td><td class="${d==null||d===0?'':d<0?'faster':'slower'}">${deltaFmt(d)}</td></tr>`;}).join('');
 const deltas=comp.slice(0,3).map(x=>x.a!=null&&x.b!=null?x.a-x.b:null),scale=Math.max(100,...deltas.filter(x=>x!=null).map(Math.abs));
 $('sectorBars').innerHTML=deltas.map((d,i)=>`<div class="delta-row"><b>S${i+1}</b><div class="delta-track"><i class="${d<0?'gain':'loss'}" style="${d==null?'width:0':`width:${Math.abs(d)/scale*50}%;${d<0?'right':'left'}:50%`}"></i></div><strong class="${d==null||d===0?'':d<0?'faster':'slower'}">${deltaFmt(d)}</strong></div>`).join('');
 $('timingRows').innerHTML=rows.length?rows.map((c,i)=>`<tr class="${c.id==='100'?'focus':''}"><td>${c.best==null?'—':'P'+(i+1)}</td><td><strong>#${esc(c.id)}</strong><span class="driver ${c.activeDriver?'confirmed':''}">${esc(activeLabel(c))}</span><span class="crew">${esc(c.activeDriver?(driverNames(c.id).join(' / ')||c.name):(c.feedName||c.name))}</span></td><td>${c.maxLap}</td><td class="${c.best!=null&&c.best===rows[0]?.best?'absolute':''}">${lapFmt(c.best)}</td><td>${lapFmt(last(c)?.time)}</td><td>${deltaFmt(c.best!=null&&rows[0]?.best!=null?c.best-rows[0].best:null)}</td>${c.bestS.map((v,j)=>`<td class="${v!=null&&v===minValid(rows.map(x=>x.bestS[j]))?'absolute':''}">${seconds(v)}</td>`).join('')}<td>${lapFmt(sumS(c.bestS))}</td></tr>`).join(''):'<tr><td colspan="10" class="perf-empty">Aguardando dados reais da Challenge.</td></tr>';
 $('duoRows').innerHTML=driverNames('100').map(n=>{const d=driverStats(car,n);return `<tr><td>${esc(n)} ${car?.activeDriver===n?'<span class="active-pill">FEED</span>':''}</td><td>${d?.maxLap||0}</td><td>${lapFmt(d?.best)}</td>${[0,1,2].map(i=>`<td>${seconds(d?.bestS[i])}</td>`).join('')}<td>${lapFmt(sumS(d?.bestS))}</td></tr>`;}).join('');
 const prevLap=$('lapCar').value;$('lapCar').innerHTML=Object.values(s?.cars||{}).sort((a,b)=>Number(a.id)-Number(b.id)).map(c=>`<option value="${esc(c.id)}">#${esc(c.id)} — ${esc(c.name)}</option>`).join('');if(s?.cars[prevLap])$('lapCar').value=prevLap;else if(car)$('lapCar').value='100';
 const focus=s?.cars[$('lapCar').value];$('lapRows').innerHTML=focus?Object.values(focus.laps).sort((a,b)=>a.lap-b.lap).map(l=>`<tr><td>#${esc(focus.id)}</td><td>${l.lap}</td><td><select aria-label="Piloto volta ${l.lap}" data-lap="${l.lap}"><option value="">Indefinido</option>${driverNames(focus.id).map(n=>`<option value="${esc(n)}" ${n===l.driver?'selected':''}>${esc(n)}</option>`).join('')}</select><span class="crew">${l.source==='manual'?'Manual':l.driver?'Observado':'Sem confirmação'}</span></td>${l.sectors.map(v=>`<td>${seconds(v)}</td>`).join('')}<td>${lapFmt(l.time)}</td></tr>`).join(''):'<tr><td colspan="7" class="perf-empty">Nenhuma volta registrada.</td></tr>';
 $('captureNote').textContent=s?`Captura: ${Object.values(s.cars).reduce((n,c)=>n+Object.keys(c.laps).length,0)} voltas recuperadas. Tempos consolidados vêm do carro; individuais apenas de voltas atribuídas. ${storageFailed?'ATENÇÃO: armazenamento cheio; exporte agora.':''}`:'Sem dados registrados.';
 $('exportSession').disabled=!s;$('exportAll').disabled=!keys.length;
}
function sessionSheet(s){const rows=[['Carro','Piloto da volta','Identificação','Classe XML','Volta','S1 (s)','S2 (s)','S3 (s)','Tempo (s)','Melhor volta carro (s)','Melhor S1 carro (s)','Melhor S2 carro (s)','Melhor S3 carro (s)']];const v=n=>n==null?null:n/1000;for(const c of Object.values(s.cars).sort((a,b)=>Number(a.id)-Number(b.id))){const laps=Object.values(c.laps).sort((a,b)=>a.lap-b.lap);for(const l of laps.length?laps:[{lap:null,time:null,sectors:[null,null,null]}])rows.push([c.id,l.driver||'Indefinido',l.source||'indefinido',c.cls,l.lap,...l.sectors.map(v),v(l.time),v(c.best),...c.bestS.map(v)]);}return {name:s.name,rows};}
async function poll(){if(busy)return;busy=true;const token=generation;try{const url=new URL($('xmlUrl').value);if(!['http:','https:'].includes(url.protocol))throw Error('URL inválida.');const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('HTTP '+res.status);const xml=await res.text();if(token!==generation)return;noteRead(xml,'live');if(typeof receiveChampionship==='function')receiveChampionship(xml);const desc=consumeXML(xml);$('liveStatus').textContent='Recebido: '+desc+' · '+new Date().toLocaleTimeString('pt-BR');}catch(e){if(token!==generation)return;feedMode='error';updateFeed();$('liveStatus').textContent='Sem atualização: '+e.message+' (rede, CORS ou sessão indisponível). Dados anteriores preservados.';}finally{busy=false;}}
function perfBoot(){
 $('navPerformance').onclick=()=>switchTab(true);$('navChampionship').onclick=()=>switchTab(false);
 function switchTab(p){$('navPerformance').setAttribute('aria-pressed',String(p));$('navChampionship').setAttribute('aria-pressed',String(!p));$('performanceView').hidden=!p;$('championshipView').hidden=p;$('navPerformance').classList.toggle('active',p);$('navChampionship').classList.toggle('active',!p);}
 try{const u=localStorage.getItem('racecore-lite-xml-url');if(u)$('xmlUrl').value=u;}catch{}
 $('xmlUrl').addEventListener('change',()=>{try{localStorage.setItem('racecore-lite-xml-url',$('xmlUrl').value);}catch{}});
 $('connect').onclick=()=>{if(timer){generation++;clearInterval(timer);timer=null;feedMode='paused';updateFeed();$('connect').textContent='Conectar ao vivo';$('liveStatus').textContent='Captura pausada.';}else{feedMode='connecting';updateFeed();poll();timer=setInterval(poll,3000);$('connect').textContent='Pausar captura';}};
 $('xmlFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const xml=await f.text();$('liveStatus').textContent='Importado: '+consumeXML(xml);noteRead(xml,'imported');}catch(err){$('liveStatus').textContent=err.message;}finally{e.target.value='';}};
 $('sessionSelect').onchange=e=>{selectedSession=e.target.value;renderPerf();};['perfCat','rivalSelect','timeMode','lapCar','driverSelect'].forEach(id=>$(id).onchange=renderPerf);
 $('lapRows').onchange=e=>{const lap=e.target.dataset.lap,c=currentPerf()?.cars[$('lapCar').value];if(!lap||!c?.laps[lap])return;const val=e.target.value;if(val&&!driverNames(c.id).includes(val))return;c.laps[lap].driver=val||null;c.laps[lap].source='manual';savePerf();renderPerf();};
 $('exportSession').onclick=()=>{const s=currentPerf();if(s)RCExcel.download([sessionSheet(s)],'RaceCore Lite - '+s.name);};
 $('exportAll').onclick=()=>{const s=Object.values(historyStore).sort((a,b)=>a.created.localeCompare(b.created));if(s.length)RCExcel.download(s.map(sessionSheet),'RaceCore Lite - '+(currentPerf()?.name||'Sessões')+' - Histórico');};
 $('jumpTiming').onclick=()=>$('timingPanel').scrollIntoView({behavior:'smooth',block:'start'});switchTab(false);updateFeed();setInterval(updateFeed,1000);renderPerf();
}
document.addEventListener('DOMContentLoaded',perfBoot);
