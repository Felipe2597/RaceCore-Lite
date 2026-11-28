'use strict';
// Live championship projection. Never converts a timing snapshot into an official result.
let champAccepted=false;
let autoChamp=false, lastChampAt=0, lastChampChanged=0, lastChampFingerprint='', champMessage='Modo manual. Ative a projeção ao vivo.', champSession='';
const liveLocks=()=>state.liveLocks ||= [false,false];
const liveStage=()=>liveLocks()[0]?1:0;
function liveStatus(){
 const el=$('champLiveStatus');if(!el)return;
 const age=lastChampAt?Math.floor((Date.now()-lastChampAt)/1000):null;
 const stale=autoChamp&&(!champAccepted||age===null||age>15||feedMode==='error'||feedMode==='paused'||Date.now()-lastChampChanged>30000);
 el.textContent=champMessage+(age===null?'':` · Última classificação aceita há ${age}s`)+(stale?' · ATENÇÃO: dados sem atualização; não trate como atuais.':'');
 el.classList.toggle('stale',stale);
 const banner=$('champFreshness');
 const missing=roster().filter(c=>!state.results[liveStage()][c.id]).length;
 banner.textContent=liveLocks()[1]?'SEGMENTOS FECHADOS • confira a homologação oficial.':!autoChamp?'MODO MANUAL / SALVO • os pontos não se atualizam sozinhos.':stale?'ATENÇÃO • sem classificação válida recente. Último cenário preservado; não use como posição atual.':`PROJEÇÃO AO VIVO • ordem de pista, não resultado oficial${missing?' • '+missing+' carro(s) sem posição informada':''}.`;
 banner.classList.toggle('stale',stale);
 $('champAuto').textContent=autoChamp?'Pausar projeção ao vivo':'Ativar projeção ao vivo';
 $('champStage').textContent=liveLocks()[1]?'FINAL FECHADO':liveLocks()[0]?'SEGMENTO FINAL':'SEGMENTO INICIAL';
 $('lockInitial').disabled=liveLocks()[0];$('lockFinal').disabled=!liveLocks()[0]||liveLocks()[1];
 $('unlockChamp').disabled=!liveLocks().some(Boolean);
}
function stopChamp(reason){autoChamp=false;champAccepted=false;champMessage=reason;liveStatus();render();}
function receiveChampionship(xml){
 if(!autoChamp||liveLocks()[1])return false;
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 const label=n=>doc.querySelector(`label[type="${n}"]`)?.textContent.trim()||'';
 const run=label('runname'),group=label('groupname'),track=label('trackname'),type=label('runtype');
 const fail=msg=>{champAccepted=false;champMessage=msg+' · Última projeção preservada.';liveStatus();return false;};
 if(doc.querySelector('parsererror')||doc.documentElement.localName!=='resultspage')return fail('XML inválido');
 if(!/interlagos|jos[eé] carlos pace/i.test(track))return fail('Autódromo não confirmado como Interlagos');
 if(/treino|practice|qual|warm.?up|opcional|classifica/i.test(run)||(!/^(R|RACE)$/i.test(type)&&!/corrida|race|500\s*km/i.test(run)))return fail('Aguardando sessão de corrida');
 const raw=[...doc.querySelectorAll('results > result')];
 const rows=raw.filter(r=>{const cls=r.getAttribute('class')||'';return !rejectOther(cls)&&(isChallenge(cls)||(isChallenge(group)&&!rejectOther(group)&&!rejectOther(cls)));});
 if(!rows.length)return fail('Challenge não identificada no XML');
 if(!isChallenge(group)&&raw.some(r=>!r.getAttribute('class')?.trim()))return fail('Feed misto com carros sem categoria; não é seguro separar Challenge');
 const parsed=rows.map(r=>({id:r.getAttribute('no')?.replace(/^#/,'').trim(),pos:Number(r.getAttribute('position'))}));
 const ids=new Set(roster().map(c=>c.id));
 if(parsed.some(r=>!r.id||!ids.has(r.id)))return fail('Carro não cadastrado: '+parsed.filter(r=>!ids.has(r.id)).map(r=>'#'+r.id).join(', ')+'. Confirme a inscrição e adicione em Championship');
 if(!parsed.some(r=>r.id==='100'))return fail('#100 não consta no snapshot');
 if(parsed.some(r=>!Number.isInteger(r.pos)||r.pos<1)||new Set(parsed.map(r=>r.pos)).size!==parsed.length||new Set(parsed.map(r=>r.id)).size!==parsed.length)return fail('Posições ausentes ou duplicadas');
 // A dedicated group must provide a contiguous order. For a mixed feed, filter explicitly tagged Challenge rows,
 // then re-rank their overall positions. Reject mixed/ambiguous rows instead of assuming class membership.
 if(!isChallenge(group)&&rows.some(r=>!isChallenge(r.getAttribute('class'))))return fail('Categoria ambígua');
 const allPositions=raw.map(r=>Number(r.getAttribute('position'))).filter(p=>Number.isInteger(p)&&p>0).sort((a,b)=>a-b);
 if(new Set(allPositions).size!==allPositions.length||allPositions.some((p,i)=>p!==i+1))return fail('Classificação XML incompleta ou não sequencial');
 const session=JSON.stringify([label('eventname'),track,group,run]);
 if(champSession&&champSession!==session)return fail('Sessão mudou. Pause e reative após conferir');
 champSession=session;
 const seg=liveStage();
 if(state.factors[seg]===0)return fail('Segmento cancelado; ajuste manualmente');
 const next=Object.fromEntries(parsed.sort((a,b)=>a.pos-b.pos).map((r,i)=>[r.id,String(i+1)]));
 // Full replacement: never keep outdated positions of missing cars or insert DNS/NC automatically.
 state.results[seg]=next;
 const now=Date.now(),fingerprint=JSON.stringify(next)+'|'+label('timeofday')+'|'+label('racetime')+'|'+label('laps');
 if(fingerprint!==lastChampFingerprint){lastChampFingerprint=fingerprint;lastChampChanged=now;}
 lastChampAt=now;champAccepted=true;champMessage=`${run} · ${parsed.length}/${roster().length} carros históricos/inscritos no feed · projeção por ordem de pista, NÃO oficial`;
 renderInputs();render();liveStatus();return true;
}
function closeChamp(seg){
 if(autoChamp&&(!champAccepted||!lastChampAt||Date.now()-lastChampAt>15000||feedMode!=='live'||Date.now()-lastChampChanged>30000)){alert('Não há classificação ao vivo recente e válida. Pause a projeção, confira e corrija os resultados manualmente antes de fechar.');return;}
 if(autoChamp&&seg!==liveStage())return;
 if(!complete(seg)&&!confirm('Há carros sem resultado ou posições incompletas. Fechar mesmo assim? A projeção permanecerá parcial.'))return;
 if(!confirm(`Confirme o resultado do segmento ${seg?'final':'inicial'}, incluindo regra de 75%, penalidades e ausências. A ordem atual será congelada. Prosseguir?`))return;
 liveLocks()[seg]=true;state.liveClosedAt ||= [];state.liveClosedAt[seg]=new Date().toISOString();
 if(seg===0){state.results[1]={};champAccepted=false;champMessage='Inicial congelado. Projeção final será atualizada na próxima leitura se o modo ao vivo estiver ativo.';}else stopChamp('Final congelado. Confira a classificação oficial.');
 renderInputs();render();liveStatus();
}
function liveChampBoot(){
 $('champAuto').onclick=()=>{if(autoChamp){stopChamp('Projeção pausada. Edição manual disponível.');return;}if(liveLocks()[1])return alert('Final fechado. Reabra se necessário.');
 if(!confirm('Ativar projeção pela ordem de pista da Challenge em Interlagos? As posições do segmento aberto serão substituídas. Nenhuma pontuação será considerada oficial automaticamente.'))return;
 autoChamp=true;champAccepted=false;champSession='';lastChampAt=0;lastChampChanged=0;lastChampFingerprint='';champMessage='Aguardando XML válido de corrida.';liveStatus();render();if(!timer)$('connect').click();else poll();};
 $('champSource').onclick=()=>{$('navPerformance').click();$('xmlUrl').closest('details').open=true;$('xmlUrl').focus();};
 $('lockInitial').onclick=()=>closeChamp(0);$('lockFinal').onclick=()=>closeChamp(1);
 $('unlockChamp').onclick=()=>{if(!confirm('Reabrir os segmentos fechados? As posições poderão ser alteradas novamente.'))return;stopChamp('Segmentos reabertos. Confira antes de reativar.');state.liveLocks=[false,false];state.liveClosedAt=[];renderInputs();render();liveStatus();};
 // All manual mutations stop live writes. The frozen segment stays immutable until explicitly reopened.
 $('championshipView').addEventListener('change',e=>{if(e.target.closest('#inputs')||['factor0','factor1','distance'].includes(e.target.id)){if(autoChamp)stopChamp('Edição manual: projeção automática pausada.');}},true);
 ['fill','reset'].forEach(id=>$(id).addEventListener('click',e=>{if(liveLocks().some(Boolean)){e.stopImmediatePropagation();alert('Reabra os segmentos antes de alterar o cenário.');return;}if(autoChamp)stopChamp('Simulação manual.');},true));
 $('add').addEventListener('submit',()=>{if(autoChamp)stopChamp('Cadastro alterado. Confira e reative a projeção.');},true);
 $('applyKosmi').addEventListener('click',e=>{const seg=Number($('kosmiSegment').value);if(liveLocks()[seg]){e.stopImmediatePropagation();alert('Segmento fechado. Reabra para alterar.');return;}if(autoChamp)stopChamp('Contingência manual Kosmi.');},true);
 liveStatus();setInterval(liveStatus,1000);
}
document.addEventListener('DOMContentLoaded',liveChampBoot);
