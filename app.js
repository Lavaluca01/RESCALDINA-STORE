const DEFAULT_EMPLOYEES = [
['BAGNO C.','CS'],['BARLOCCO F.','PC'],['BELLUSCIO M.','GE'],['BENLODI L.','CS'],['BOLDRINI E.','GE'],['BRANCATO R.','CS'],['CANDEO T.','CS'],['CIARAVOLO A.','GE'],['CIFARELLI G.','TLC'],['COZZI M.','PC'],['CREPALDI M.','GE'],['DALL ACQUA M.','GE'],['FORTUNA A.','TLC'],['GAZZO C.','CS'],['GHIDOTTI D.','MAG'],['MAGRO G.P.','TLC'],['MANISCALCO D.','PC'],['MARTELLOTTA F.','GE'],['ARESI C.','CS'],['MATANAY K.','GE'],['RANCILIO S.','TLC'],['TALLARICO L.','TLC'],['MARCONI M.','TV'],['ROMANO L.','TLC'],['SAPONARA M.','CS'],['SILVESTRI E.','GE'],['STEFAN M.','CS'],['STEFANETTI S.','TV'],['TARANTELLA A.','MAG'],['VARALLI F.','TLC'],['VINCI A.','MAG'],['ADARDI K.','TLC'],['MERLO A.','GE']
].map(([name,department],i)=>({id:'EMP'+String(i+1).padStart(3,'0'),name,department,active:true,pin:'0000',mustChangePin:true}));

const DEFAULT_MANAGER_PIN='2468';
let employees = JSON.parse(localStorage.getItem('employees')||'null') || DEFAULT_EMPLOYEES;
// Migrazione dalla v2: aggiunge PIN ai dipendenti già presenti.
employees = employees.map(e=>({...e,pin:e.pin||'0000',mustChangePin:typeof e.mustChangePin==='boolean'?e.mustChangePin:true}));
let requests = JSON.parse(localStorage.getItem('requests')||'[]');
let managerPin = localStorage.getItem('managerPin') || DEFAULT_MANAGER_PIN;
let currentSession=null;
let editingRequestId=null;
const $=id=>document.getElementById(id);
const years=Array.from({length:25},(_,i)=>new Date().getFullYear()+i);

function save(){localStorage.setItem('employees',JSON.stringify(employees));localStorage.setItem('requests',JSON.stringify(requests));localStorage.setItem('managerPin',managerPin);}
function fillYears(){['yearSelect','filterYear'].forEach(id=>{$(id).innerHTML=years.map(y=>`<option>${y}</option>`).join('')});}
function fillLoginEmployees(){const cur=$('loginEmployeeSelect').value;$('loginEmployeeSelect').innerHTML=employees.filter(e=>e.active).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>`<option value="${e.id}">${e.name} · ${e.department}</option>`).join('');if(cur&&employees.some(e=>e.id===cur&&e.active))$('loginEmployeeSelect').value=cur;}
function fillDeptFilters(){const depts=[...new Set(employees.map(e=>e.department))].sort(); const cur=$('filterDept').value; $('filterDept').innerHTML='<option value="">Tutti i reparti</option>'+depts.map(d=>`<option>${d}</option>`).join(''); $('filterDept').value=cur;}
function fmt(d){if(!d)return''; return new Date(d+'T12:00:00').toLocaleDateString('it-IT');}
function statusClass(status){return status==='APPROVATA'?'approved':status==='RIFIUTATA'?'rejected':'pending';}
function escapeHtml(str){return String(str??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function validPin(pin){return /^\d{4,6}$/.test(pin);}
function sessionEmployee(){return currentSession?.role==='employee'?employees.find(e=>e.id===currentSession.employeeId):null;}

function showLogin(tab='employee'){
 currentSession=null;editingRequestId=null;
 $('loginArea').classList.remove('hidden');$('employeeArea').classList.add('hidden');$('managerArea').classList.add('hidden');$('sessionBox').classList.add('hidden');
 $('employeePin').value='';$('managerPin').value='';switchLoginTab(tab);
}
function setSessionUI(){
 $('loginArea').classList.add('hidden');$('sessionBox').classList.remove('hidden');
 if(currentSession.role==='employee'){
   const emp=sessionEmployee();$('sessionName').textContent=emp.name;$('sessionRole').textContent=`Dipendente · ${emp.department}`;
   $('employeeArea').classList.remove('hidden');$('managerArea').classList.add('hidden');
   $('employeeWelcome').textContent=`Ciao ${emp.name}`;$('employeeIdentity').textContent=emp.name;$('employeeDepartment').textContent=`Reparto ${emp.department}`;renderEmployeeHistory();
 }else{
   $('sessionName').textContent='Manager';$('sessionRole').textContent='Amministratore';$('employeeArea').classList.add('hidden');$('managerArea').classList.remove('hidden');renderManager();renderStaff();
 }
}
function switchLoginTab(tab){
 const employee=tab==='employee';$('employeeTab').classList.toggle('active',employee);$('managerTab').classList.toggle('active',!employee);$('employeeLogin').classList.toggle('hidden',!employee);$('managerLogin').classList.toggle('hidden',employee);
}
function employeeLogin(){
 const emp=employees.find(e=>e.id===$('loginEmployeeSelect').value&&e.active);const pin=$('employeePin').value.trim();
 if(!emp||pin!==String(emp.pin)){alert('PIN non corretto.');$('employeePin').value='';return;}
 currentSession={role:'employee',employeeId:emp.id};setSessionUI();resetRequestForm();
 if(emp.mustChangePin)setTimeout(()=>changeEmployeePin(true),250);
}
function managerLogin(){
 const pin=$('managerPin').value.trim();if(pin!==String(managerPin)){alert('PIN Manager non corretto.');$('managerPin').value='';return;}
 currentSession={role:'manager'};setSessionUI();
}
function changeEmployeePin(force=false){
 const emp=sessionEmployee();if(!emp)return;
 const message=force?'Primo accesso: crea ora il tuo nuovo PIN personale (4-6 cifre).':'Inserisci il nuovo PIN personale (4-6 cifre).';
 const newPin=prompt(message,'');if(newPin===null&&force){alert('Per continuare devi impostare il PIN personale.');return changeEmployeePin(true);}if(newPin===null)return;
 if(!validPin(newPin)){alert('Il PIN deve contenere solo 4-6 cifre.');return changeEmployeePin(force);}
 const confirmPin=prompt('Ripeti il nuovo PIN:','');if(confirmPin!==newPin){alert('I PIN non coincidono.');return changeEmployeePin(force);}
 emp.pin=newPin;emp.mustChangePin=false;save();alert('PIN personale aggiornato.');
}
function changeManagerPin(){
 if(currentSession?.role!=='manager')return;const old=prompt('Inserisci il PIN Manager attuale:','');if(old===null)return;if(old!==String(managerPin)){alert('PIN attuale non corretto.');return;}
 const next=prompt('Nuovo PIN Manager (4-6 cifre):','');if(next===null)return;if(!validPin(next)){alert('Il PIN deve contenere solo 4-6 cifre.');return;}
 const confirmPin=prompt('Ripeti il nuovo PIN Manager:','');if(confirmPin!==next){alert('I PIN non coincidono.');return;}
 managerPin=next;save();alert('PIN Manager aggiornato.');
}

function resetRequestForm(){editingRequestId=null;$('requestType').selectedIndex=0;$('dateFrom').value='';$('dateTo').value='';$('note').value='';$('yearSelect').value=String(new Date().getFullYear());$('sendBtn').textContent='Invia richiesta';$('cancelEditBtn').classList.add('hidden');}
function cancelEdit(rerender=true){resetRequestForm();if(rerender)renderEmployeeHistory();}
function renderEmployeeHistory(){
 const emp=sessionEmployee();if(!emp)return;
 const own=requests.filter(r=>r.employeeId===emp.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 $('employeeHistory').innerHTML='<h3>Le mie richieste</h3>'+(own.length?`<div class="history-list">${own.map(r=>`<div class="history-item">
   <div class="history-top"><div><strong>${r.type}</strong><br><span class="muted">${fmt(r.from)} - ${fmt(r.to)} · ${r.department}</span></div><span class="status-badge ${statusClass(r.status)}">${r.status}</span></div>
   ${r.note?`<div class="muted" style="margin-top:7px">Nota: ${escapeHtml(r.note)}</div>`:''}
   ${r.managerNote?`<div class="muted" style="margin-top:4px">Nota manager: ${escapeHtml(r.managerNote)}</div>`:''}
   ${r.status==='IN ATTESA'?`<div class="history-actions"><button class="edit" onclick="editRequest('${r.id}')">Modifica richiesta</button></div>`:''}
 </div>`).join('')}</div>`:'<p>Nessuna richiesta inviata.</p>');
}
function submitRequest(){
 const emp=sessionEmployee();if(!emp){alert('Sessione non valida. Effettua nuovamente l’accesso.');return;}
 const from=$('dateFrom').value,to=$('dateTo').value;
 if(!from||!to){alert('Compila le date.');return}if(to<from){alert('La data finale non può precedere quella iniziale.');return}
 if(editingRequestId){
   const r=requests.find(x=>x.id===editingRequestId);if(!r||r.employeeId!==emp.id){alert('Richiesta non disponibile.');resetRequestForm();return}
   if(r.status!=='IN ATTESA'){alert('La richiesta è già stata valutata e non può più essere modificata.');resetRequestForm();renderEmployeeHistory();return}
   r.type=$('requestType').value;r.year=Number($('yearSelect').value);r.from=from;r.to=to;r.note=$('note').value.trim();r.updatedAt=new Date().toISOString();save();resetRequestForm();renderEmployeeHistory();alert('Richiesta modificata correttamente.');return;
 }
 requests.push({id:crypto.randomUUID(),employeeId:emp.id,employeeName:emp.name,department:emp.department,type:$('requestType').value,year:Number($('yearSelect').value),from,to,note:$('note').value.trim(),status:'IN ATTESA',createdAt:new Date().toISOString(),updatedAt:null,decisionAt:null,managerNote:''});
 save();resetRequestForm();renderEmployeeHistory();alert('Richiesta inviata. Stato: IN ATTESA.');
}
window.editRequest=(id)=>{const emp=sessionEmployee();if(!emp)return;const r=requests.find(x=>x.id===id&&x.employeeId===emp.id);if(!r)return;if(r.status!=='IN ATTESA'){alert('Puoi modificare solamente le richieste ancora IN ATTESA.');return}editingRequestId=id;$('requestType').value=r.type;$('yearSelect').value=String(r.year);$('dateFrom').value=r.from;$('dateTo').value=r.to;$('note').value=r.note||'';$('sendBtn').textContent='Salva modifica';$('cancelEditBtn').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});};

function filtered(){if(currentSession?.role!=='manager')return[];return requests.filter(r=>(!$('filterDept').value||r.department===$('filterDept').value)&&(!$('filterStatus').value||r.status===$('filterStatus').value)&&Number(r.year)===Number($('filterYear').value));}
function renderManager(){
 if(currentSession?.role!=='manager')return;
 const rows=filtered().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 $('requestsTable').innerHTML=rows.map(r=>`<tr><td>${r.employeeName}</td><td>${r.department}</td><td>${r.type}</td><td>${fmt(r.from)} - ${fmt(r.to)}</td><td><span class="status-badge ${statusClass(r.status)}">${r.status}</span></td><td><div class="actions">${r.status==='IN ATTESA'?`<button class="ok" onclick="decide('${r.id}','APPROVATA')">Approva</button><button class="no" onclick="decide('${r.id}','RIFIUTATA')">Rifiuta</button>`:''}<button class="danger" onclick="deleteRequest('${r.id}')">Elimina</button></div></td></tr>`).join('')||'<tr><td colspan="6">Nessuna richiesta per i filtri selezionati.</td></tr>';
 const yr=Number($('filterYear').value);const all=requests.filter(r=>Number(r.year)===yr);const counts={pending:all.filter(r=>r.status==='IN ATTESA').length,approved:all.filter(r=>r.status==='APPROVATA').length,rejected:all.filter(r=>r.status==='RIFIUTATA').length,total:all.length};
 $('stats').innerHTML=`<div class="stat"><span>Totale</span><strong>${counts.total}</strong></div><div class="stat"><span>In attesa</span><strong>${counts.pending}</strong></div><div class="stat"><span>Approvate</span><strong>${counts.approved}</strong></div><div class="stat"><span>Rifiutate</span><strong>${counts.rejected}</strong></div>`;
}
window.decide=(id,status)=>{if(currentSession?.role!=='manager')return;const r=requests.find(x=>x.id===id);if(!r)return;if(r.status!=='IN ATTESA'){alert('La richiesta è già stata valutata.');return}const note=prompt(status==='APPROVATA'?'Nota di conferma (facoltativa):':'Motivo/nota (facoltativa):','')||'';r.status=status;r.managerNote=note;r.decisionAt=new Date().toISOString();save();renderManager();};
window.deleteRequest=(id)=>{if(currentSession?.role!=='manager')return;const r=requests.find(x=>x.id===id);if(!r)return;const ok=confirm(`Eliminare definitivamente la richiesta di ${r.employeeName} (${r.type}, ${fmt(r.from)} - ${fmt(r.to)})?\n\nIl dipendente potrà inserirla nuovamente in modo corretto.`);if(!ok)return;requests=requests.filter(x=>x.id!==id);save();renderManager();};
function renderStaff(){if(currentSession?.role!=='manager')return;const depts=[...new Set(employees.map(e=>e.department))].sort();$('staffByDept').innerHTML=depts.map(d=>`<div class="dept"><h4>${d} (${employees.filter(e=>e.department===d&&e.active).length})</h4><ul>${employees.filter(e=>e.department===d&&e.active).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>`<li>${e.name}<button class="mini" onclick="resetEmployeePin('${e.id}')">Reset PIN</button></li>`).join('')}</ul></div>`).join('');}
window.resetEmployeePin=(id)=>{if(currentSession?.role!=='manager')return;const emp=employees.find(e=>e.id===id);if(!emp)return;const pin=prompt(`Nuovo PIN temporaneo per ${emp.name} (4-6 cifre):`,'');if(pin===null)return;if(!validPin(pin)){alert('PIN non valido.');return;}emp.pin=pin;emp.mustChangePin=true;save();alert(`PIN temporaneo impostato per ${emp.name}. Al prossimo accesso dovrà cambiarlo.`);};
function addEmployee(){if(currentSession?.role!=='manager')return;const name=$('newName').value.trim().toUpperCase();const department=$('newDept').value;const pin=$('newPin').value.trim();if(!name||!validPin(pin)){alert('Inserisci nominativo e un PIN di 4-6 cifre.');return;}employees.push({id:'EMP'+Date.now(),name,department,active:true,pin,mustChangePin:true});save();fillLoginEmployees();fillDeptFilters();renderStaff();$('newName').value='';$('newPin').value='';}

$('employeeTab').addEventListener('click',()=>switchLoginTab('employee'));$('managerTab').addEventListener('click',()=>switchLoginTab('manager'));
$('employeeLoginBtn').addEventListener('click',employeeLogin);$('managerLoginBtn').addEventListener('click',managerLogin);
$('employeePin').addEventListener('keydown',e=>{if(e.key==='Enter')employeeLogin();});$('managerPin').addEventListener('keydown',e=>{if(e.key==='Enter')managerLogin();});
$('logoutBtn').addEventListener('click',()=>showLogin(currentSession?.role==='manager'?'manager':'employee'));
$('changePinBtn').addEventListener('click',()=>changeEmployeePin(false));$('managerPinBtn').addEventListener('click',changeManagerPin);
$('sendBtn').addEventListener('click',submitRequest);$('cancelEditBtn').addEventListener('click',()=>cancelEdit(true));
['filterDept','filterStatus','filterYear'].forEach(id=>$(id).addEventListener('change',renderManager));
$('addEmployeeBtn').addEventListener('click',()=>{if(currentSession?.role==='manager')$('employeeDialog').showModal();});$('employeeForm').addEventListener('submit',addEmployee);

fillYears();fillLoginEmployees();fillDeptFilters();resetRequestForm();save();showLogin('employee');
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
