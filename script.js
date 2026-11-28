'use strict';
// RaceCore Lite | championship engine. Historical data lives in data.js.
const CATS = ['geral','sport','rookie'];
const LABELS = {geral:'Geral',sport:'Sport',rookie:'Rookie'};
const SEGMENTS = ['Algarve inicial','Algarve final','Brasília inicial','Brasília final','Interlagos inicial','Interlagos final'];
const GRIDS = {
  300: {geral:[26,23,21,19,17,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1], sub:[16,13,11,9,7,5,4,3,2,1]},
  500: {geral:[32,28,26,24,22,20,18,16,14,12,10,9,8,7,6,5,4,3,2,1], sub:[20,17,15,13,11,10,9,8,7,6]}
};
const KEY = 'racecore-lite-challenge-2026-beta01';
const initialState = () => ({distance:500,factors:[1,1],results:[{},{}],extras:[],cat:'geral'});
function load(){try{const saved=JSON.parse(localStorage.getItem(KEY));return saved && Array.isArray(saved.results) && Array.isArray(saved.extras) ? {...initialState(),...saved}:initialState();}catch{return initialState();}}
let state = load();
const roster = () => [...BASE,...state.extras];
const isPosition = v => Number.isInteger(Number(v)) && Number(v)>0;
const zero = status => ({points:0,eligible:!['DQ','SUS'].includes(status),rank:null,status});
const pending = () => ({points:null,eligible:false,rank:null,status:'—'});
function calculatePoints(distance,cat,segment,rank,factor=1){
  const grid=GRIDS[distance][cat==='geral'?'geral':'sub'];
  return (grid[rank-1]||0)*(segment===1?2:1)*factor;
}
function segmentResult(car,cat,segment,settings=state,cars=roster()){
  if(settings.factors[segment]===0) return pending(); // cancelled segment does not count or become a discard
  const vals=settings.results[segment], val=vals[car.id];
  if(!val) return pending();
  if(!isPosition(val)) return zero(val);
  const pos=Number(val);
  // Subclasses are ordered by the general result. A gap ahead means we cannot know the class position.
  const ahead=cars.filter(c=>isPosition(vals[c.id]) && Number(vals[c.id])<pos);
  if(cat!=='geral' && ahead.length!==pos-1) return pending();
  const rank=cat==='geral'?pos:1+ahead.filter(c=>Object.hasOwn(c.history,cat)).length;
  return {points:calculatePoints(settings.distance,cat,segment,rank,settings.factors[segment]),eligible:true,rank,status:'OK'};
}
function evaluate(car,cat,settings=state,cars=roster()){
  const segments=[...car.history[cat],segmentResult(car,cat,0,settings,cars),segmentResult(car,cat,1,settings,cars)];
  const gross=segments.reduce((sum,s)=>sum+(s.points??0),0);
  let discard=-1;
  segments.forEach((s,i)=>{if(s.eligible && s.points!==null && (discard<0 || s.points<segments[discard].points)) discard=i;});
  const drop=discard<0?0:segments[discard].points;
  return {car,segments,gross,drop,discard,net:gross-drop};
}
// Art. 161: all classified final results first; then classified initial results.
// Remaining criteria cannot be reconstructed from the source workbook.
function compare(a,b){
  if(a.net!==b.net) return b.net-a.net;
  for(const indices of [[1,3,5],[0,2,4]]){
    const max=Math.max(20,...indices.flatMap(i=>[a.segments[i].rank||0,b.segments[i].rank||0]));
    for(let pos=1;pos<=max;pos++){
      const count=r=>indices.filter(i=>r.segments[i].rank===pos).length;
      const diff=count(b)-count(a); if(diff) return diff;
    }
  }
  return 0;
}
function standings(cat,settings=state,cars=roster()){
  const rows=cars.filter(c=>Object.hasOwn(c.history,cat)).map(c=>evaluate(c,cat,settings,cars));
  rows.sort((a,b)=>compare(a,b)||Number(a.car.id)-Number(b.car.id));
  rows.forEach((r,i)=>{r.rank=i && compare(rows[i-1],r)===0?rows[i-1].rank:i+1;r.tie=(i>0&&compare(rows[i-1],r)===0)||(i<rows.length-1&&compare(r,rows[i+1])===0);r.gap=rows[0].net-r.net;});
  return rows;
}
function complete(segment){
  if(state.factors[segment]===0)return true;
  const values=roster().map(c=>state.results[segment][c.id]);
  const pos=values.filter(isPosition).map(Number).sort((a,b)=>a-b);
  return values.every(Boolean)&&pos.every((p,i)=>p===i+1);
}
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const carLabel=c=>`<strong>#${esc(c.id)}</strong><span class="driver">${esc(c.drivers.join(' / '))}</span>`;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* offline storage unavailable; app remains usable */}}
function hasSimulation(){return state.results.some(r=>Object.values(r).some(Boolean))||state.factors.some(f=>f!==1);}
function renderInputs(){
  $('inputs').innerHTML=roster().map(c=>`<tr class="${c.id==='100'?'focus':''}"><td>${carLabel(c)}</td><td>${Object.keys(c.history).filter(k=>k!=='geral').map(k=>LABELS[k]).join(' + ')||'Geral'}</td>${[0,1].map(seg=>`<td><select aria-label="Carro ${esc(c.id)} segmento ${seg===0?'inicial':'final'}" data-id="${esc(c.id)}" data-seg="${seg}"><option value="">—</option>${Array.from({length:roster().length},(_,i)=>`<option value="${i+1}">P${i+1}</option>`).join('')}${['NC','DNS','DQ','SUS'].map(s=>`<option value="${s}">${s}</option>`).join('')}</select></td>`).join('')}</tr>`).join('');
  $('inputs').querySelectorAll('select').forEach(el=>{el.value=state.results[Number(el.dataset.seg)][el.dataset.id]||'';el.disabled=state.factors[Number(el.dataset.seg)]===0||Boolean(state.liveLocks?.[Number(el.dataset.seg)]); });
}
function render(){
  [0,1].forEach(i=>$('factor'+i).disabled=Boolean(state.liveLocks?.[i]));$('distance').disabled=Boolean(state.liveLocks?.some(Boolean));
  const sim=hasSimulation(), final=complete(0)&&complete(1)&&sim;
  $('mode').textContent=(typeof autoChamp!=='undefined'&&autoChamp)?'Projeção ao vivo':final?'Projeção final':sim?'Simulação parcial':'Classificação atual';
  $('warning').textContent=sim&&!final?'Projeção parcial: preencha todos os carros e use posições consecutivas. Sport/Rookie ficam pendentes quando há posições gerais vazias à frente. Nenhum título é confirmado com dados incompletos.':final?'Cenário completo para a lista informada. Confirme os resultados oficiais, inscritos, elegibilidade e eventuais desempates.':'Aguardando os resultados de Interlagos. Nenhum segmento futuro entra no descarte.';
  const current = Object.fromEntries(CATS.map(cat=>[cat,standings(cat)]));
  $('cards').innerHTML=CATS.map(cat=>{
    const r=current[cat].find(x=>x.car.id==='100');const base=standings(cat,initialState(),BASE).find(x=>x.car.id==='100');
    const delta=r.net-base.net;
    const result=(typeof autoChamp!=='undefined'&&autoChamp)?'Projeção ao vivo · não oficial':final?(r.tie?'Empate a confirmar':r.rank===1?'Campeão no cenário':'P'+r.rank+' no cenário'):sim?'Projeção parcial · não oficial':'Classificação líquida';
    return `<article class="card"><div class="eyebrow">${LABELS[cat]}</div><div class="big">P${r.rank}${r.tie?'*':''}</div><div class="pts">${fmt(r.net)} pts</div><div class="sub">${r.gap===0?'Na liderança':'−'+fmt(r.gap)+' do líder'}</div><div class="sub">${sim?`Saldo ${delta>=0?'+':''}${fmt(delta)} pts · `:''}${result}</div></article>`;
  }).join('');
  $('standings').innerHTML=current[state.cat].map(r=>`<tr class="${r.car.id==='100'?'focus':''}"><td><strong>P${r.rank}${r.tie?'*':''}</strong></td><td>${carLabel(r.car)}</td>${r.segments.map((s,i)=>`<td class="${i===r.discard?'discard':''}" title="${SEGMENTS[i]}${i===r.discard?' — descartado':''}">${s.points===null?'—':s.status==='OK'||s.status==='0'?fmt(s.points):esc(s.status)}</td>`).join('')}<td>${fmt(r.gross)}</td><td>−${fmt(r.drop)}</td><td class="net">${fmt(r.net)}</td><td>${r.gap?'−'+fmt(r.gap):'—'}</td></tr>`).join('');
  $('tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.cat===state.cat);b.setAttribute('aria-pressed',String(b.dataset.cat===state.cat));});
  save();
  if(typeof renderRanges==='function')renderRanges();
}
function setPosition(id,seg,next){
  if(state.liveLocks?.[seg])return;
  const vals=state.results[seg],old=vals[id]||'';
  if(isPosition(next)){
    const other=Object.keys(vals).find(k=>k!==id&&Number(vals[k])===Number(next));
    if(other) vals[other]=isPosition(old)?old:'';
  }
  vals[id]=next;
}
function boot(){
  $('distance').value=state.distance;
  [0,1].forEach(i=>{$('factor'+i).value=state.factors[i];$('factor'+i).addEventListener('change',e=>{state.factors[i]=Number(e.target.value);renderInputs();render();});});
  $('distance').addEventListener('change',e=>{state.distance=Number(e.target.value);render();});
  $('inputs').addEventListener('change',e=>{const el=e.target;if(!el.matches('select'))return;setPosition(el.dataset.id,Number(el.dataset.seg),el.value);renderInputs();render();});
  $('tabs').addEventListener('click',e=>{const cat=e.target.dataset.cat;if(CATS.includes(cat)){state.cat=cat;render();}});
  $('fill').addEventListener('click',()=>{const order=standings('geral',initialState(),roster());state.results=[{},{}];order.forEach((r,i)=>[0,1].forEach(s=>state.results[s][r.car.id]=String(i+1)));renderInputs();render();});
  $('reset').addEventListener('click',()=>{const cat=state.cat,extras=state.extras;state=initialState();state.cat=cat;state.extras=extras;$('distance').value=state.distance;[0,1].forEach(i=>$('factor'+i).value=1);renderInputs();render();});
  $('add').addEventListener('submit',e=>{e.preventDefault();const id=String(Number($('newId').value)),name=$('newName').value.trim(),cat=$('newCat').value;if(!name||!Number.isInteger(Number(id))||Number(id)<1||roster().some(c=>c.id===id)){alert('Informe um número novo e um nome válido.');return;}const categories=['geral',...(cat==='both'?['sport','rookie']:cat==='geral'?[]:[cat])];state.extras.push({id,drivers:[name],history:Object.fromEntries(categories.map(c=>[c,Array.from({length:4},()=>zero('DNS'))]))});e.target.reset();renderInputs();render();});
  renderInputs();render();
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',boot);
