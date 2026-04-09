var exercises=[], cycles=[], activeCycleId=null, activeCycle=null;
var curDay=0, curFeeling=2;
var curDate=new Date().toISOString().slice(0,10);
var pickerDay=null, pickerSel=[];
var daysStruct=[];
var libFilter='Tous';
var progChart=null;
var calViewYear=new Date().getFullYear();
var calViewMonth=new Date().getMonth();

function todayISO(){return new Date().toISOString().slice(0,10);}
function yesterdayISO(){return new Date(Date.now()-86400000).toISOString().slice(0,10);}
function daysAgoISO(n){return new Date(Date.now()-n*86400000).toISOString().slice(0,10);}
function dateLabel(val){
  if(val===todayISO()) return "Aujourd'hui";
  if(val===yesterdayISO()) return 'Hier';
  var d=new Date(val+'T12:00:00');
  return d.toLocaleDateString('fr-BE',{weekday:'short',day:'numeric',month:'short'});
}

async function init(){
  var now=new Date();
  var df={weekday:'long',day:'numeric',month:'long'};
  document.getElementById('sb-date').textContent=now.toLocaleDateString('fr-BE',df);
  document.getElementById('tb-date').textContent=now.toLocaleDateString('fr-BE',Object.assign({},df,{year:'numeric'}));
  var lbl=document.getElementById('date-lbl');
  if(lbl) lbl.textContent=dateLabel(curDate);
  await loadExercises();
  await loadCycles();
  var saved=localStorage.getItem('gym_active');
  if(saved){
    var sel=document.getElementById('sel-cycle');
    if(sel) sel.value=saved;
    await setActiveCycle(saved);
  }
  buildDays();
  initHelpBubbles();
  document.addEventListener('click',function(e){
    var pop=document.getElementById('cal-popup');
    if(!pop) return;
    var btn=document.getElementById('cal-btn');
    if(!pop.contains(e.target)&&btn&&!btn.contains(e.target)) pop.classList.remove('open');
  });
}

function initHelpBubbles(){
  document.querySelectorAll('.help').forEach(function(h){
    h.addEventListener('mouseenter',function(){
      var bub=h.querySelector('.help-bubble');
      if(!bub) return;
      bub.style.display='block';
      var hr=h.getBoundingClientRect();
      var bw=bub.offsetWidth,bh=bub.offsetHeight;
      var left=hr.left+hr.width/2-bw/2;
      left=Math.max(10,Math.min(left,window.innerWidth-bw-10));
      var top=hr.top-bh-8;
      if(top<10) top=hr.bottom+8;
      bub.style.left=left+'px'; bub.style.top=top+'px';
    });
    h.addEventListener('mouseleave',function(){
      var bub=h.querySelector('.help-bubble');
      if(bub) bub.style.display='none';
    });
  });
}

var pgTitles={session:'Séance du jour',cycles:'Programmes',progress:'Progression',rapport:'Rapport Claude',mobile:'App Mobile',library:'Bibliothèque'};
function goPage(id,btn){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('on');});
  document.getElementById('page-'+id).classList.add('on');
  if(btn) btn.classList.add('on');
  document.getElementById('pg-title').textContent=pgTitles[id]||id;
  if(id==='library') renderLibrary();
  if(id==='cycles') renderCyclesList();
  if(id==='progress') loadProgress();
  if(id==='rapport') genReport();
}

function toggleCal(e){
  e.stopPropagation();
  var pop=document.getElementById('cal-popup');
  if(!pop) return;
  if(pop.classList.contains('open')){pop.classList.remove('open');return;}
  var btn=document.getElementById('cal-btn');
  var br=btn.getBoundingClientRect();
  var top=br.bottom+6;
  if(top+300>window.innerHeight) top=br.top-310;
  pop.style.left=br.left+'px'; pop.style.top=top+'px';
  var parts=curDate.split('-');
  calViewYear=parseInt(parts[0]); calViewMonth=parseInt(parts[1])-1;
  renderCal(); pop.classList.add('open');
}
function calNav(dir){
  calViewMonth+=dir;
  if(calViewMonth>11){calViewMonth=0;calViewYear++;}
  if(calViewMonth<0){calViewMonth=11;calViewYear--;}
  renderCal();
}
function renderCal(){
  var lbl=document.getElementById('cal-month-label');
  if(!lbl) return;
  var mois=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  lbl.textContent=mois[calViewMonth]+' '+calViewYear;
  var today=todayISO();
  var first=new Date(calViewYear,calViewMonth,1);
  var dow=first.getDay();
  var startOff=(dow===0)?6:dow-1;
  var dim=new Date(calViewYear,calViewMonth+1,0).getDate();
  var dimPrev=new Date(calViewYear,calViewMonth,0).getDate();
  var html='';
  for(var i=startOff-1;i>=0;i--) html+='<div class="cal-day other-month">'+(dimPrev-i)+'</div>';
  for(var d=1;d<=dim;d++){
    var ds=calViewYear+'-'+String(calViewMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var cls='cal-day';
    if(ds===today) cls+=' today';
    if(ds===curDate) cls+=' selected';
    if(ds>today) cls+=' future';
    html+='<div class="'+cls+'" onclick="calSelectDate(\''+ds+'\')">'+d+'</div>';
  }
  var total=startOff+dim;
  var rem=(total%7===0)?0:7-(total%7);
  for(var n=1;n<=rem;n++) html+='<div class="cal-day other-month">'+n+'</div>';
  document.getElementById('cal-days').innerHTML=html;
}
async function calSelectDate(val){
  curDate=val;
  var lbl=document.getElementById('date-lbl');
  if(lbl) lbl.textContent=dateLabel(val);
  document.getElementById('cal-popup').classList.remove('open');
  if(activeCycleId){
    var r=await fetch('/api/sessions/by-date?cycle_id='+activeCycleId+'&date='+val);
    var sessions=await r.json();
    if(sessions&&sessions.length>0){
      var dayIdx=sessions[0].day_index;
      if(dayIdx!==curDay){
        curDay=dayIdx;
        document.querySelectorAll('.dpill').forEach(function(p,idx){p.classList.toggle('on',idx===dayIdx);});
      }
    }
  }
  loadSessionForm();
}

async function loadExercises(){var r=await fetch('/api/exercises');exercises=await r.json();}
async function addEx(){
  var n=document.getElementById('ex-name').value.trim();
  if(!n){toast("Entre un nom",'warn');return;}
  await fetch('/api/exercises',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,muscle_group:document.getElementById('ex-grp').value,type:document.getElementById('ex-type').value})});
  document.getElementById('ex-name').value='';
  await loadExercises(); renderLibrary(); toast('Exercice ajouté');
}
async function delEx(id){
  if(!confirm('Supprimer ?')) return;
  await fetch('/api/exercises/'+id,{method:'DELETE'});
  await loadExercises(); renderLibrary();
}
function renderLibrary(){
  var groups=['Tous'].concat(Array.from(new Set(exercises.map(function(e){return e.muscle_group;}))));
  document.getElementById('lib-filters').innerHTML=groups.map(function(g){return '<button class="tf'+(g===libFilter?' on':'')+'" onclick="libFilter=\''+g+'\';renderLibrary()">'+g+'</button>';}).join('');
  var filtered=libFilter==='Tous'?exercises:exercises.filter(function(e){return e.muscle_group===libFilter;});
  var tl={strength:'Muscu',cardio_z2:'Zone 2',hiit:'HIIT'};
  if(!filtered.length){document.getElementById('lib-list').innerHTML='<p style="color:var(--muted);font-size:13px;padding:8px 0">Aucun exercice.</p>';return;}
  document.getElementById('lib-list').innerHTML=filtered.map(function(e){
    var bt=e.type==='strength'?'b-s':e.type==='hiit'?'b-h':'b-c';
    return '<div class="ex-item"><div><div style="font-size:13px;font-weight:500;margin-bottom:2px">'+e.name+(e.is_compound?'<span class="badge b-p" style="margin-left:5px">&#9733;</span>':'')+'</div><div style="font-size:11px;color:var(--muted)">'+e.muscle_group+' &middot; <span class="badge '+bt+'">'+tl[e.type]+'</span></div></div><button class="btn sm danger" onclick="delEx('+e.id+')">Suppr.</button></div>';
  }).join('');
}

async function loadCycles(){
  var r=await fetch('/api/cycles'); cycles=await r.json();
  var sel=document.getElementById('sel-cycle'); var prev=sel.value;
  sel.innerHTML='<option value="">— Aucun —</option>'+cycles.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  if(prev) sel.value=prev;
}
function buildDays(){
  var n=Math.min(7,Math.max(3,parseInt(document.getElementById('cy-days').value)||6));
  document.getElementById('cy-days').value=n;
  if(daysStruct.length!==n){daysStruct=[];for(var i=0;i<n;i++) daysStruct.push({name:'Jour '+(i+1),exercise_ids:[],is_rest:false});}
  renderDaysBuilder();
}
function resetBuilder(){daysStruct=[];document.getElementById('cy-name').value='';buildDays();}
function renderDaysBuilder(){
  document.getElementById('days-bld').innerHTML=daysStruct.map(function(d,i){
    var chips=d.exercise_ids.map(function(eid){var ex=exercises.find(function(e){return e.id===eid;});return ex?'<div class="chip"><span>'+ex.name+'</span><button class="chip-x" onclick="rmExDay('+i+','+eid+')">&#215;</button></div>':'';}).join('');
    return '<div class="day-bld"><div class="day-bld-head"><span class="day-num">J'+(i+1)+'</span><input type="text" value="'+d.name+'" onchange="daysStruct['+i+'].name=this.value" style="flex:1;min-width:0"><label class="tog"><input type="checkbox"'+(d.is_rest?' checked':'')+' onchange="togRest('+i+',this.checked)"><span class="tog-track"></span><span class="tog-thumb"></span><span style="margin-left:4px">Repos</span></label>'+(!d.is_rest?'<button class="btn sm" onclick="openPicker('+i+')">+ Exercices</button>':'')+
    '</div>'+(d.is_rest?'<span style="font-size:12px;color:var(--muted);font-style:italic">Repos / récupération active</span>':'<div class="chips">'+chips+(chips?'':'<span style="font-size:12px;color:var(--muted)">Aucun exercice</span>')+'</div>')+'</div>';
  }).join('');
}
function togRest(i,v){daysStruct[i].is_rest=v;if(v)daysStruct[i].exercise_ids=[];renderDaysBuilder();}
function rmExDay(i,eid){daysStruct[i].exercise_ids=daysStruct[i].exercise_ids.filter(function(e){return e!==eid;});renderDaysBuilder();}
async function saveCycle(){
  var name=document.getElementById('cy-name').value.trim();
  if(!name){toast('Entre un nom','warn');return;}
  var r=await fetch('/api/cycles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,days:daysStruct})});
  var data=await r.json();
  if(!data.ok){toast('Erreur sauvegarde','warn');return;}
  await loadCycles(); document.getElementById('sel-cycle').value=data.id;
  await setActiveCycle(data.id); renderCyclesList(); toast('Programme enregistré');
}
function renderCyclesList(){
  var el=document.getElementById('cy-list');
  if(!cycles.length){el.innerHTML='<div class="empty"><div class="empty-ico">&#8862;</div><p>Aucun programme.</p></div>';return;}
  el.innerHTML=cycles.map(function(c){
    return '<div class="cy-row"><div><div style="font-size:14px;font-weight:500">'+c.name+'</div><div style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace">'+c.created_at+'</div></div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm teal" onclick="showCompo('+c.id+')">Soumettre à Claude</button><button class="btn sm" onclick="editCycle('+c.id+')">Éditer</button><button class="btn sm danger" onclick="delCycle('+c.id+')">Suppr.</button></div></div>';
  }).join('');
}
async function editCycle(id){
  var r=await fetch('/api/cycles/'+id); var c=await r.json();
  document.getElementById('cy-name').value=c.name; document.getElementById('cy-days').value=c.days.length;
  daysStruct=c.days; renderDaysBuilder(); goPage('cycles',document.querySelectorAll('.nav-item')[1]);
}
async function delCycle(id){
  if(!confirm('Supprimer ce programme et toutes ses séances ?')) return;
  await fetch('/api/cycles/'+id,{method:'DELETE'});
  if(activeCycleId==id){activeCycleId=null;activeCycle=null;localStorage.removeItem('gym_active');}
  await loadCycles(); renderCyclesList();
}
async function setActiveCycle(id){
  activeCycleId=id?parseInt(id):null;
  if(!id){activeCycle=null;renderSession();return;}
  localStorage.setItem('gym_active',id);
  var r=await fetch('/api/cycles/'+id); activeCycle=await r.json();
  activeCycle.days=JSON.parse(activeCycle.days_json||'[]'); renderSession();
}
async function showCompo(cid){
  var r=await fetch('/api/cycles/'+cid+'/composition'); var d=await r.json();
  document.getElementById('co-text').value=d.composition||'Erreur';
  document.getElementById('co-overlay').classList.add('on');
}
async function copyCompo(){await navigator.clipboard.writeText(document.getElementById('co-text').value);toast('Copié — colle dans Claude');}

function openPicker(i){
  pickerDay=i; pickerSel=daysStruct[i].exercise_ids.slice();
  document.getElementById('pk-title').textContent='Exercices — '+daysStruct[i].name;
  document.getElementById('pk-search').value=''; renderPicker('');
  document.getElementById('pk-overlay').classList.add('on');
}
function closePicker(){document.getElementById('pk-overlay').classList.remove('on');}
function renderPicker(q){
  var fil=q?exercises.filter(function(e){return e.name.toLowerCase().indexOf(q.toLowerCase())>=0;}):exercises;
  var groups=Array.from(new Set(fil.map(function(e){return e.muscle_group;})));
  var tl={strength:'Muscu',cardio_z2:'Zone 2',hiit:'HIIT'}; var h='';
  groups.forEach(function(g){
    h+='<div class="grp-hdr">'+g+'</div>';
    fil.filter(function(e){return e.muscle_group===g;}).forEach(function(e){
      var s=pickerSel.indexOf(e.id)>=0; var bt=e.type==='strength'?'b-s':e.type==='hiit'?'b-h':'b-c';
      h+='<div class="pk-item'+(s?' sel':'')+'" onclick="togPick('+e.id+')"><input type="checkbox"'+(s?' checked':'')+' onclick="event.stopPropagation();togPick('+e.id+')"><span style="flex:1;font-size:13px">'+e.name+(e.is_compound?'<span class="badge b-p" style="margin-left:4px">&#9733;</span>':'')+'</span><span class="badge '+bt+'">'+tl[e.type]+'</span></div>';
    });
  });
  document.getElementById('pk-body').innerHTML=h;
}
function filterPicker(){renderPicker(document.getElementById('pk-search').value);}
function togPick(id){var idx=pickerSel.indexOf(id);if(idx>=0)pickerSel.splice(idx,1);else pickerSel.push(id);renderPicker(document.getElementById('pk-search').value);}
function confirmPicker(){daysStruct[pickerDay].exercise_ids=pickerSel.slice();closePicker();renderDaysBuilder();}

function renderSession(){
  var ne=document.getElementById('sess-empty'); var sm=document.getElementById('sess-main');
  if(!activeCycle){ne.style.display='block';sm.style.display='none';return;}
  ne.style.display='none'; sm.style.display='block';
  document.getElementById('day-pills').innerHTML=activeCycle.days.map(function(d,i){
    return '<div class="dpill'+(i===curDay?' on':'')+'" onclick="selDay('+i+')">'+d.name+'</div>';
  }).join('');
  loadSessionForm();
}
async function selDay(i){
  curDay=i;
  document.querySelectorAll('.dpill').forEach(function(p,idx){p.classList.toggle('on',idx===i);});
  loadSessionForm();
}

async function loadSessionForm(){
  if(!activeCycle) return;
  var isPast=curDate<todayISO();
  var form=document.getElementById('sess-form');

  // Vérifier séance existante pour cette date
  var rByDate=await fetch('/api/sessions/by-date?cycle_id='+activeCycleId+'&date='+curDate);
  var sessionsByDate=await rByDate.json();
  var hasSession=sessionsByDate&&sessionsByDate.length>0;

  // ── RÈGLE 4 : date passée sans séance ──────────────────────────────────────
  if(isPast&&!hasSession){
    document.querySelectorAll('.dpill').forEach(function(p){
      p.style.opacity='0.4'; p.style.pointerEvents='none'; p.style.cursor='default';
    });
    var dl=new Date(curDate+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    form.innerHTML='<div class="empty"><div class="empty-ico">📅</div><p style="color:var(--muted)">Pas de séance enregistrée<br>le '+dl+'</p></div>';
    return;
  }

  // Si séance existante → forcer le bon jour
  if(hasSession&&sessionsByDate[0].day_index!==curDay){
    curDay=sessionsByDate[0].day_index;
    document.querySelectorAll('.dpill').forEach(function(p,idx){p.classList.toggle('on',idx===curDay);});
  }

  var day=activeCycle.days[curDay];
  var rEx=await fetch('/api/sessions/exact?cycle_id='+activeCycleId+'&day_index='+curDay+'&date='+curDate);
  var exact=await rEx.json();
  var last=exact;
  if(!exact){var rL=await fetch('/api/sessions/last?cycle_id='+activeCycleId+'&day_index='+curDay);last=await rL.json();}
  curFeeling=last?last.feeling:2;
  var data=last?last.data:{};

  // ── RÈGLES 1/2/3 ──────────────────────────────────────────────────────────
  // Lecture seule si séance déjà enregistrée (règles 2 & 3)
  // Éditable si aujourd'hui sans séance (règle 1)
  var isReadOnly=hasSession;

  // Verrouillage pills
  document.querySelectorAll('.dpill').forEach(function(p,idx){
    if(isReadOnly){
      p.style.opacity=(idx===curDay)?'1':'0.3';
      p.style.pointerEvents='none'; p.style.cursor='default';
    } else {
      p.style.opacity='1'; p.style.pointerEvents='auto'; p.style.cursor='pointer';
    }
  });

  if(!day||!day.exercise_ids||!day.exercise_ids.length){
    form.innerHTML='<div class="empty"><div class="empty-ico">&#9711;</div><p>Repos — natation, sauna, récupération active.</p></div>';
    return;
  }

  var ro=isReadOnly?'readonly disabled':'';
  var roStyle=isReadOnly?'style="opacity:0.7;background:var(--bg5);cursor:default"':'';

  var html='<div class="feeling-row"><span>Forme du jour</span>';
  html+='<span class="help" style="margin-right:4px">?<span class="help-bubble">Evalue ta forme avant la séance.</span></span>';
  ['–','◎','+'].forEach(function(lbl,i){
    var v=i+1;
    html+='<button class="fb'+(curFeeling===v?' on':'')+'"'+(isReadOnly?' disabled style="opacity:0.6;cursor:default"':'')+' onclick="'+(isReadOnly?'':('setFeeling('+v+')'))+'">'+ lbl+'</button>';
  });
  if(exact) html+='<span style="font-size:11px;color:var(--teal);margin-left:auto;font-family:\'DM Mono\',monospace">&#128274; '+curDate+'</span>';
  else if(last) html+='<span style="font-size:11px;color:var(--muted);margin-left:auto;font-family:\'DM Mono\',monospace">Réf: '+last.date+'</span>';
  html+='</div>';

  day.exercise_ids.forEach(function(eid){
    var ex=exercises.find(function(e){return e.id===eid;});
    if(!ex) return;
    var isZ2=ex.type==='cardio_z2'; var isHiit=ex.type==='hiit';
    var prev=data[eid]||{};
    var bt=isZ2?'b-c':isHiit?'b-h':'b-s';
    html+='<div class="ex-sec"><div class="ex-sec-head"><span class="ex-sec-name">'+ex.name+'</span>'+(ex.is_compound?'<span class="badge b-p">&#9733; Poly</span>':'')+'<span class="badge '+bt+'">'+ex.muscle_group+'</span></div>';
    if(isZ2||isHiit){
      var d2=typeof prev==='object'&&prev.mode?prev:{};
      var mode=isHiit?'hiit':(d2.mode||'z2');
      html+='<div class="cmode-row">'+
        '<button class="cmode'+(mode==='z2'?' on':'')+'"'+(isReadOnly?' disabled style="opacity:0.6;cursor:default"':'')+' id="cm-z2-'+eid+'" onclick="'+(isReadOnly?'':('swCM('+eid+',\'z2\')'))+'">'+'Zone 2</button>'+
        '<button class="cmode'+(mode==='hiit'?' on':'')+'"'+(isReadOnly?' disabled style="opacity:0.6;cursor:default"':'')+' id="cm-hiit-'+eid+'" onclick="'+(isReadOnly?'':('swCM('+eid+',\'hiit\')'))+'">'+'HIIT</button></div>';
      if(mode==='z2'){
        var app2=(d2.appareil||'velo');
        html+='<div id="cm-body-'+eid+'">'+
          '<div class="cf-row"><label>Appareil</label><select id="c'+eid+'_app" style="width:160px" '+(isReadOnly?'disabled style="opacity:0.7"':'')+'>'+
          '<option value="velo"'+(app2==='velo'?' selected':'')+'>Vélo stationnaire</option>'+
          '<option value="elliptique"'+(app2==='elliptique'?' selected':'')+'>Elliptique</option>'+
          '<option value="rameur"'+(app2==='rameur'?' selected':'')+'>Rameur</option></select></div>'+
          '<div class="cf-row"><label>Durée totale</label><input type="number" id="c'+eid+'_dur" value="'+(d2.duree||'')+'" placeholder="40" '+ro+' '+roStyle+'><span class="unit">min</span></div>'+
          '<div class="cf-row"><label>FC moyenne</label><input type="number" id="c'+eid+'_fcm" value="'+(d2.fc_moy||'')+'" placeholder="110" '+ro+' '+roStyle+'><span class="unit">bpm</span></div>'+
          '<div class="cf-row"><label>FC max</label><input type="number" id="c'+eid+'_fcx" value="'+(d2.fc_max||'')+'" placeholder="118" '+ro+' '+roStyle+'><span class="unit">bpm</span></div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:5px">Zone 2 cible : 101–118 bpm</div></div>';
      } else {
        var ivs=d2.intervals||[{duree:3,bpm:90,bpm_reel:0},{duree:2,bpm:140,bpm_reel:0}];
        var rounds=d2.rounds||4;
        html+='<div id="cm-body-'+eid+'"><div class="cf-row"><label>Nombre de tours</label><input type="number" id="c'+eid+'_rounds" value="'+rounds+'" min="1" max="20" style="width:70px" '+ro+' '+roStyle+'></div>'+
          '<table class="set-tbl" style="margin-top:8px"><thead><tr><th style="text-align:left">Interv.</th><th>Durée min</th><th>BPM cible</th><th>BPM réel</th></tr></thead><tbody>';
        ivs.forEach(function(iv,i){
          html+='<tr><td class="sn">#'+(i+1)+'</td>'+
            '<td><input type="number" id="c'+eid+'_iv'+i+'_dur" value="'+(iv.duree||'')+'" min="0" step="0.5" '+ro+' '+roStyle+'></td>'+
            '<td><input type="number" id="c'+eid+'_iv'+i+'_bpm" value="'+(iv.bpm||'')+'" '+ro+' '+roStyle+'></td>'+
            '<td><input type="number" id="c'+eid+'_iv'+i+'_real" value="'+(iv.bpm_reel||'')+'" '+ro+' '+roStyle+'></td></tr>';
        });
        html+='</tbody></table></div>';
      }
    } else {
      html+='<table class="set-tbl"><thead><tr><th style="text-align:left">Série</th><th>Poids kg</th><th>Reps</th></tr></thead><tbody>';
      for(var s=1;s<=5;s++){
        var ps=Array.isArray(prev)?(prev[s-1]||{}):{};
        var heavy=(s===1);
        html+='<tr class="'+(heavy?'s1bg':'')+'">'+
          '<td class="sn" style="color:'+(heavy?'var(--amber)':'var(--muted)')+'">S'+s+(heavy?' &#9733;':'')+'</td>'+
          '<td class="'+(heavy?'s1bg':'')+'"><input type="number" id="ex'+eid+'_s'+s+'_w" value="'+(ps.weight||'')+'" min="0" step="0.5" placeholder="—" '+ro+' '+roStyle+'></td>'+
          '<td><input type="number" id="ex'+eid+'_s'+s+'_r" value="'+(ps.reps||'')+'" min="0" placeholder="'+(heavy?'5-6':'10')+'" '+ro+' '+roStyle+'></td></tr>';
      }
      html+='</tbody></table>';
    }
    html+='</div>';
  });

  html+='<div class="card" style="margin-top:10px">'+
    '<label class="lbl" style="font-size:13px;font-weight:500;margin-bottom:8px">Note de séance</label>'+
    '<input type="text" id="sess-note" value="'+(last&&last.note?last.note.replace(/"/g,'&quot;'):'')+'" placeholder="Douleur, variante, fatigue…" '+ro+' '+roStyle+'></div>';

  if(!isReadOnly){
    html+='<div class="btn-row"><button class="btn pri" onclick="saveSession()">&#10003; Enregistrer la séance</button></div>';
  } else {
    var dl2=new Date(curDate+'T12:00:00').toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    html+='<div style="margin-top:12px;padding:10px 16px;background:var(--adim);border:1px solid var(--amber);border-radius:9px;font-size:12px;color:var(--amber);display:flex;align-items:center;gap:8px">'+
      '<span>&#128274;</span><span>Séance du '+dl2+' — lecture seule</span></div>';
  }
  html+='<div id="sess-msg" style="font-size:12px;color:var(--teal);min-height:18px;margin-top:8px;font-family:\'DM Mono\',monospace"></div>';
  form.innerHTML=html;
  initHelpBubbles();
}

function swCM(eid,mode){
  var z2=document.getElementById('cm-z2-'+eid); var hiit=document.getElementById('cm-hiit-'+eid);
  if(z2) z2.classList.toggle('on',mode==='z2'); if(hiit) hiit.classList.toggle('on',mode==='hiit');
}
function setFeeling(v){
  curFeeling=v;
  document.querySelectorAll('.fb').forEach(function(b,i){b.classList.toggle('on',i+1===v);});
}
async function saveSession(){
  if(!activeCycle) return;
  var day=activeCycle.days[curDay]; var sessionData={};
  day.exercise_ids.forEach(function(eid){
    var ex=exercises.find(function(e){return e.id===eid;}); if(!ex) return;
    var isZ2=ex.type==='cardio_z2', isHiit=ex.type==='hiit';
    if(isZ2||isHiit){
      var z2btn=document.getElementById('cm-z2-'+eid);
      var mode=(z2btn&&z2btn.classList.contains('on'))?'z2':'hiit';
      if(mode==='z2'){
        sessionData[eid]={mode:'z2',appareil:(document.getElementById('c'+eid+'_app')||{value:'velo'}).value,duree:(document.getElementById('c'+eid+'_dur')||{value:0}).value,fc_moy:(document.getElementById('c'+eid+'_fcm')||{value:0}).value,fc_max:(document.getElementById('c'+eid+'_fcx')||{value:0}).value};
      } else {
        var rounds=parseInt((document.getElementById('c'+eid+'_rounds')||{value:4}).value)||4; var ivs=[];
        for(var i=0;i<2;i++) ivs.push({duree:parseFloat((document.getElementById('c'+eid+'_iv'+i+'_dur')||{value:0}).value)||0,bpm:parseInt((document.getElementById('c'+eid+'_iv'+i+'_bpm')||{value:0}).value)||0,bpm_reel:parseInt((document.getElementById('c'+eid+'_iv'+i+'_real')||{value:0}).value)||0});
        sessionData[eid]={mode:'hiit',rounds:rounds,intervals:ivs};
      }
    } else {
      var sets=[];
      for(var s=1;s<=5;s++){
        var w=parseFloat((document.getElementById('ex'+eid+'_s'+s+'_w')||{value:0}).value)||0;
        var rp=parseInt((document.getElementById('ex'+eid+'_s'+s+'_r')||{value:0}).value)||0;
        sets.push({weight:w,reps:rp});
      }
      sessionData[eid]=sets;
    }
  });
  var note=(document.getElementById('sess-note')||{value:''}).value||'';
  await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cycle_id:activeCycleId,day_index:curDay,date:curDate,feeling:curFeeling,note:note,data:sessionData})});
  toast('Séance enregistrée');
  await loadSessionForm();
}

async function loadProgress(){
  if(!activeCycleId) return;
  var rh=await fetch('/api/sessions/history?cycle_id='+activeCycleId); var hist=await rh.json();
  var total=hist.length; var avgF=total?(hist.reduce(function(a,s){return a+(s.feeling||2);},0)/total).toFixed(1):'—';
  document.getElementById('stats3').innerHTML=
    '<div class="stat"><div class="stat-v">'+total+'</div><div class="stat-l">Séances enregistrées</div></div>'+
    '<div class="stat"><div class="stat-v">'+avgF+'/3</div><div class="stat-l">Forme moyenne</div></div>'+
    '<div class="stat"><div class="stat-v">'+hist.filter(function(s){return s.note;}).length+'</div><div class="stat-l">Avec notes</div></div>';
  var rp=await fetch('/api/sessions/progression?cycle_id='+activeCycleId); var prog=await rp.json();
  var sel=document.getElementById('prog-ex');
  sel.innerHTML='<option value="">— Choisir un exercice —</option>'+Object.keys(prog).map(function(k){return '<option value="'+k+'">'+prog[k].name+'</option>';}).join('');
  if(sel.value) drawChart();
}
async function drawChart(){
  var key=document.getElementById('prog-ex').value; if(!key) return;
  var r=await fetch('/api/sessions/progression?cycle_id='+activeCycleId); var prog=await r.json();
  var ex=prog[key]; if(!ex||!ex.points.length){toast('Pas encore de données','warn');return;}
  var labels=ex.points.map(function(p){return p.date;});
  var dataForce=ex.points.map(function(p){return p.max_w;});
  var dataTonnage=ex.points.map(function(p){return p.tonnage;});
  if(progChart) progChart.destroy();
  progChart=new Chart(document.getElementById('prog-chart'),{
    type:'line',
    data:{labels:labels,datasets:[
      {label:'Charge max S1 (kg)',data:dataForce,borderColor:'#8b7cf8',backgroundColor:'rgba(139,124,248,0.08)',tension:.35,fill:false,pointBackgroundColor:'#8b7cf8',pointRadius:5,pointHoverRadius:7,yAxisID:'yForce'},
      {label:'Tonnage total (kg)',data:dataTonnage,borderColor:'#4ecba4',backgroundColor:'rgba(78,203,164,0.08)',tension:.35,fill:false,borderDash:[4,3],pointBackgroundColor:'#4ecba4',pointRadius:4,pointHoverRadius:6,yAxisID:'yTonnage'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,labels:{color:'#8888a0',font:{family:'DM Mono',size:11},boxWidth:12,padding:16}},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y+'kg';}}}},
      scales:{
        x:{ticks:{color:'#8888a0',font:{family:'DM Mono',size:11}},grid:{color:'rgba(255,255,255,0.04)'}},
        yForce:{type:'linear',position:'left',ticks:{color:'#8b7cf8',font:{family:'DM Mono',size:11},callback:function(v){return v+'kg';}},grid:{color:'rgba(139,124,248,0.08)'},title:{display:true,text:'Force S1',color:'#8b7cf8',font:{size:11}}},
        yTonnage:{type:'linear',position:'right',ticks:{color:'#4ecba4',font:{family:'DM Mono',size:11},callback:function(v){return v+'kg';}},grid:{drawOnChartArea:false},title:{display:true,text:'Tonnage',color:'#4ecba4',font:{size:11}}}
      }
    }
  });
}

async function genReport(){
  if(!activeCycleId){document.getElementById('rep-area').value='Sélectionne un programme actif.';return;}
  var r=await fetch('/api/report?cycle_id='+activeCycleId); var d=await r.json();
  document.getElementById('rep-area').value=d.report||'';
}
async function copyReport(){await navigator.clipboard.writeText(document.getElementById('rep-area').value);toast('Rapport copié');}

async function exportMobile(){
  var msg=document.getElementById('mob-exp-msg');
  if(msg) msg.textContent='Génération en cours…';
  try{
    var r=await fetch('/api/export-mobile'); if(!r.ok) throw new Error('Erreur serveur');
    var blob=await r.blob(); var cd=r.headers.get('Content-Disposition')||'';
    var match=cd.match(/filename=([^\s;]+)/); var filename=match?match[1]:'config_mobile.json';
    var url=URL.createObjectURL(blob); var a=document.createElement('a');
    a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
    if(msg){msg.textContent='Fichier généré : '+filename;setTimeout(function(){msg.textContent='';},5000);}
    toast('Config mobile générée');
  }catch(e){if(msg) msg.textContent='Erreur : '+e.message;toast('Erreur export','warn');}
}
async function importSession(evt){
  var file=evt.target.files[0]; if(!file) return;
  var msg=document.getElementById('mob-imp-msg');
  if(msg){msg.textContent='Import en cours…';msg.style.color='var(--muted)';}
  var form=new FormData(); form.append('file',file);
  try{
    var r=await fetch('/api/import-session',{method:'POST',body:form}); var data=await r.json();
    if(data.ok){
      var txt=data.message||'Import OK';
      if(data.errors&&data.errors.length) txt+=' ('+data.errors.length+' erreur(s))';
      if(msg){msg.textContent=txt;msg.style.color='var(--teal)';}
      toast('Import terminé');
      if(activeCycle) await setActiveCycle(activeCycleId);
    } else {
      if(msg){msg.textContent='Erreur : '+data.error;msg.style.color='var(--red)';}
      toast('Erreur import','warn');
    }
  }catch(e){if(msg){msg.textContent='Erreur : '+e.message;msg.style.color='var(--red)';}toast('Erreur import','warn');}
  evt.target.value='';
}

function toast(msg,type){
  var t=document.getElementById('toast');
  t.style.borderColor=type==='warn'?'var(--amber)':'var(--teal)';
  t.style.color=type==='warn'?'var(--amber)':'var(--teal)';
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2800);
}

init();
