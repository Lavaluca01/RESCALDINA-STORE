const firebaseConfig = {
  apiKey: "AIzaSyD8vzrP5O3aPa1DetSzmWYMWDjV-VpdgHc",
  authDomain: "gestione-personale-rescaldina.firebaseapp.com",
  projectId: "gestione-personale-rescaldina",
  storageBucket: "gestione-personale-rescaldina.firebasestorage.app",
  messagingSenderId: "144918771825",
  appId: "1:144918771825:web:31145a82da3ea2144743d0"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.app().functions("europe-west8");

const MANAGER_EMAIL = "manager.rescaldina@gestione.local";
const DEPARTMENTS = ["CS", "PC", "GE", "TLC", "MAG", "TV"];
const DEFAULT_EMPLOYEES = [
  ["BAGNO C.","CS"],["BARLOCCO F.","PC"],["BELLUSCIO M.","GE"],["BENLODI L.","CS"],
  ["BOLDRINI E.","GE"],["BRANCATO R.","CS"],["CANDEO T.","CS"],["CIARAVOLO A.","GE"],
  ["CIFARELLI G.","TLC"],["COZZI M.","PC"],["CREPALDI M.","GE"],["DALL ACQUA M.","GE"],
  ["FORTUNA A.","TLC"],["GAZZO C.","CS"],["GHIDOTTI D.","MAG"],["MAGRO G.P.","TLC"],
  ["MANISCALCO D.","PC"],["MARTELLOTTA F.","GE"],["ARESI C.","CS"],["MATANAY K.","GE"],
  ["RANCILIO S.","TLC"],["TALLARICO L.","TLC"],["MARCONI M.","TV"],["ROMANO L.","TLC"],
  ["SAPONARA M.","CS"],["SILVESTRI E.","GE"],["STEFAN M.","CS"],["STEFANETTI S.","TV"],
  ["TARANTELLA A.","MAG"],["VARALLI F.","TLC"],["VINCI A.","MAG"],["ADARDI K.","TLC"],
  ["MERLO A.","GE"]
];

const $ = id => document.getElementById(id);
const years = Array.from({length: 25}, (_, i) => new Date().getFullYear() + i);
let directory = [];
let staff = [];
let requests = [];
let currentProfile = null;
let editingRequestId = null;
let requestsUnsub = null;

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function fmt(d) {
  if (!d) return "";
  return new Date(`${d}T12:00:00`).toLocaleDateString("it-IT");
}
function statusLabel(s) {
  return s === "approved" ? "APPROVATA" : s === "rejected" ? "RIFIUTATA" : "IN ATTESA";
}
function statusClass(s) {
  return s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending";
}
function validEmployeePin(pin) { return /^\d{6}$/.test(pin); }
function randomPin() { return String(Math.floor(100000 + Math.random() * 900000)); }
function normalizeName(v) { return String(v || "").trim().toUpperCase().replace(/\s+/g, " "); }
function firebaseMessage(err) {
  const code = err?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "PIN non corretto.";
  if (code.includes("user-disabled")) return "Account disattivato. Rivolgiti al Manager.";
  if (code.includes("too-many-requests")) return "Troppi tentativi. Riprova tra qualche minuto.";
  if (code.includes("network-request-failed")) return "Connessione non disponibile.";
  return err?.message?.replace(/^Firebase:\s*/i, "") || "Operazione non riuscita.";
}

function fillYears() {
  ["yearSelect", "filterYear"].forEach(id => {
    $(id).innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  });
  $("yearSelect").value = String(new Date().getFullYear());
  $("filterYear").value = String(new Date().getFullYear());
}
function fillDeptFilters() {
  const current = $("filterDept").value;
  $("filterDept").innerHTML = '<option value="">Tutti i reparti</option>' + DEPARTMENTS.map(d => `<option>${d}</option>`).join("");
  $("filterDept").value = current;
}
async function loadDirectory() {
  try {
    const snap = await db.collection("directory").where("active", "==", true).get();
    directory = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.error("Directory", e);
    directory = [];
  }
  const select = $("loginEmployeeSelect");
  if (!directory.length) {
    select.innerHTML = '<option value="">Organico non ancora inizializzato</option>';
    return;
  }
  select.innerHTML = '<option value="">Seleziona il tuo nominativo</option>' + directory.map(e =>
    `<option value="${esc(e.employeeCode)}">${esc(e.name)} · ${esc(e.department)}</option>`).join("");
}

function switchLoginTab(tab) {
  const employee = tab === "employee";
  $("employeeTab").classList.toggle("active", employee);
  $("managerTab").classList.toggle("active", !employee);
  $("employeeLogin").classList.toggle("hidden", !employee);
  $("managerLogin").classList.toggle("hidden", employee);
}
function clearArea() {
  if (requestsUnsub) { requestsUnsub(); requestsUnsub = null; }
  currentProfile = null;
  requests = [];
  editingRequestId = null;
  $("employeeArea").classList.add("hidden");
  $("managerArea").classList.add("hidden");
  $("sessionBox").classList.add("hidden");
}
function showLogin(tab = "employee") {
  clearArea();
  $("loginArea").classList.remove("hidden");
  $("employeePin").value = "";
  $("managerPin").value = "";
  switchLoginTab(tab);
}

async function employeeLogin() {
  const code = $("loginEmployeeSelect").value;
  const pin = $("employeePin").value.trim();
  if (!code) return alert("Seleziona il tuo nominativo.");
  if (!validEmployeePin(pin)) return alert("Il PIN deve contenere 6 cifre.");
  const employee = directory.find(e => e.employeeCode === code);
  if (!employee) return alert("Dipendente non disponibile.");
  try {
    await auth.signInWithEmailAndPassword(`${code.toLowerCase()}@gestione.local`, pin);
  } catch (e) {
    $("employeePin").value = "";
    alert(firebaseMessage(e));
  }
}
async function managerLogin() {
  const pin = $("managerPin").value.trim();
  if (!/^\d{6,12}$/.test(pin)) return alert("Inserisci il PIN Manager.");
  try {
    await auth.signInWithEmailAndPassword(MANAGER_EMAIL, pin);
  } catch (e) {
    $("managerPin").value = "";
    alert(firebaseMessage(e));
  }
}
async function openAuthenticatedArea() {
  const user = auth.currentUser;
  if (!user) return showLogin();
  const doc = await db.collection("users").doc(user.uid).get();
  if (!doc.exists) {
    await auth.signOut();
    return alert("Profilo utente non configurato.");
  }
  currentProfile = {uid: user.uid, ...doc.data()};
  if (currentProfile.active !== true) {
    await auth.signOut();
    return alert("Account disattivato.");
  }
  $("loginArea").classList.add("hidden");
  $("sessionBox").classList.remove("hidden");
  $("sessionName").textContent = currentProfile.name || "Utente";
  if (currentProfile.role === "manager") {
    $("sessionRole").textContent = "Manager · Amministratore";
    $("employeeArea").classList.add("hidden");
    $("managerArea").classList.remove("hidden");
    await loadStaff();
    watchManagerRequests();
  } else if (currentProfile.role === "employee") {
    $("sessionRole").textContent = `Dipendente · ${currentProfile.department}`;
    $("managerArea").classList.add("hidden");
    $("employeeArea").classList.remove("hidden");
    $("employeeWelcome").textContent = `Ciao ${currentProfile.name}`;
    $("employeeIdentity").textContent = currentProfile.name;
    $("employeeDepartment").textContent = `Reparto ${currentProfile.department}`;
    resetRequestForm();
    watchEmployeeRequests();
    if (currentProfile.mustChangePin === true) setTimeout(() => changeEmployeePin(true), 300);
  } else {
    await auth.signOut();
    showLogin();
  }
}

function watchEmployeeRequests() {
  requestsUnsub = db.collection("requests").where("userId", "==", currentProfile.uid)
    .onSnapshot(snap => {
      requests = snap.docs.map(d => ({id: d.id, ...d.data()}));
      renderEmployeeHistory();
    }, e => alert(firebaseMessage(e)));
}
function renderEmployeeHistory() {
  const own = [...requests].sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  $("employeeHistory").innerHTML = '<h3>Le mie richieste</h3>' + (own.length ?
    `<div class="history-list">${own.map(r => `<div class="history-item">
      <div class="history-top"><div><strong>${esc(r.type)}</strong><br><span class="muted">${fmt(r.from)} - ${fmt(r.to)} · ${esc(r.department)}</span></div><span class="status-badge ${statusClass(r.status)}">${statusLabel(r.status)}</span></div>
      ${r.note ? `<div class="muted" style="margin-top:7px">Nota: ${esc(r.note)}</div>` : ""}
      ${r.managerNote ? `<div class="muted" style="margin-top:4px">Nota manager: ${esc(r.managerNote)}</div>` : ""}
      ${r.status === "pending" ? `<div class="history-actions"><button class="edit" onclick="editRequest('${r.id}')">Modifica richiesta</button></div>` : ""}
    </div>`).join("")}</div>` : '<p>Nessuna richiesta inviata.</p>');
}
function resetRequestForm() {
  editingRequestId = null;
  $("requestType").selectedIndex = 0;
  $("dateFrom").value = "";
  $("dateTo").value = "";
  $("note").value = "";
  $("yearSelect").value = String(new Date().getFullYear());
  $("sendBtn").textContent = "Invia richiesta";
  $("cancelEditBtn").classList.add("hidden");
}
async function submitRequest() {
  if (currentProfile?.role !== "employee") return;
  const from = $("dateFrom").value;
  const to = $("dateTo").value;
  if (!from || !to) return alert("Compila le date.");
  if (to < from) return alert("La data finale non può precedere quella iniziale.");
  const payload = {
    type: $("requestType").value,
    year: Number($("yearSelect").value),
    from, to,
    note: $("note").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    if (editingRequestId) {
      const r = requests.find(x => x.id === editingRequestId);
      if (!r || r.status !== "pending") return alert("La richiesta non è più modificabile.");
      await db.collection("requests").doc(editingRequestId).update(payload);
      resetRequestForm();
      alert("Richiesta modificata correttamente.");
    } else {
      await db.collection("requests").add({
        ...payload,
        userId: currentProfile.uid,
        employeeName: currentProfile.name,
        department: currentProfile.department,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        decisionAt: null,
        managerNote: ""
      });
      resetRequestForm();
      alert("Richiesta inviata. Stato: IN ATTESA.");
    }
  } catch (e) { alert(firebaseMessage(e)); }
}
window.editRequest = id => {
  if (currentProfile?.role !== "employee") return;
  const r = requests.find(x => x.id === id);
  if (!r || r.status !== "pending") return alert("Puoi modificare solo richieste ancora IN ATTESA.");
  editingRequestId = id;
  $("requestType").value = r.type;
  $("yearSelect").value = String(r.year);
  $("dateFrom").value = r.from;
  $("dateTo").value = r.to;
  $("note").value = r.note || "";
  $("sendBtn").textContent = "Salva modifica";
  $("cancelEditBtn").classList.remove("hidden");
  window.scrollTo({top: 0, behavior: "smooth"});
};

async function changeEmployeePin(force = false) {
  if (currentProfile?.role !== "employee") return;
  const pin = prompt(force ? "Primo accesso: crea il tuo PIN personale di 6 cifre." : "Nuovo PIN personale (6 cifre):", "");
  if (pin === null) {
    if (force) setTimeout(() => changeEmployeePin(true), 250);
    return;
  }
  if (!validEmployeePin(pin)) return alert("Il PIN deve contenere esattamente 6 cifre."), changeEmployeePin(force);
  const confirmPin = prompt("Ripeti il nuovo PIN:", "");
  if (confirmPin !== pin) return alert("I PIN non coincidono."), changeEmployeePin(force);
  try {
    await auth.currentUser.updatePassword(pin);
    await db.collection("users").doc(currentProfile.uid).update({mustChangePin: false});
    currentProfile.mustChangePin = false;
    alert("PIN personale aggiornato.");
  } catch (e) { alert(firebaseMessage(e)); }
}
async function changeManagerPin() {
  if (currentProfile?.role !== "manager") return;
  const pin = prompt("Nuovo PIN Manager (6 cifre):", "");
  if (pin === null) return;
  if (!validEmployeePin(pin)) return alert("Il PIN deve contenere esattamente 6 cifre.");
  const confirmPin = prompt("Ripeti il nuovo PIN Manager:", "");
  if (confirmPin !== pin) return alert("I PIN non coincidono.");
  try {
    await auth.currentUser.updatePassword(pin);
    alert("PIN Manager aggiornato. Da ora usa il nuovo PIN.");
  } catch (e) { alert(firebaseMessage(e)); }
}

async function loadStaff() {
  if (currentProfile?.role !== "manager") return;
  try {
    const snap = await db.collection("users").where("role", "==", "employee").get();
    staff = snap.docs.map(d => ({uid: d.id, ...d.data()})).sort((a,b) => a.name.localeCompare(b.name));
    renderStaff();
  } catch (e) { alert(firebaseMessage(e)); }
}
function renderStaff() {
  if (currentProfile?.role !== "manager") return;
  $("staffByDept").innerHTML = DEPARTMENTS.map(d => {
    const people = staff.filter(e => e.department === d);
    const activeCount = people.filter(e => e.active).length;
    return `<div class="dept"><h4>${d} (${activeCount}/${people.length})</h4><ul>${people.map(e => `<li class="${e.active ? "" : "inactive-row"}"><span>${esc(e.name)}${e.active ? "" : " · DISATTIVO"}</span><div class="staff-actions"><button class="mini" onclick="resetEmployeePin('${e.uid}','${esc(e.name)}')">Reset PIN</button><button class="mini ${e.active ? "danger" : "ok"}" onclick="toggleEmployee('${e.uid}',${!e.active})">${e.active ? "Disattiva" : "Attiva"}</button></div></li>`).join("") || "<li>Nessun dipendente</li>"}</ul></div>`;
  }).join("");
}

function watchManagerRequests() {
  requestsUnsub = db.collection("requests").onSnapshot(snap => {
    requests = snap.docs.map(d => ({id: d.id, ...d.data()}));
    renderManager();
  }, e => alert(firebaseMessage(e)));
}
function filteredRequests() {
  const dept = $("filterDept").value;
  const status = $("filterStatus").value;
  const year = Number($("filterYear").value);
  return requests.filter(r => (!dept || r.department === dept) && (!status || r.status === status) && Number(r.year) === year);
}
function renderManager() {
  if (currentProfile?.role !== "manager") return;
  const rows = filteredRequests().sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  $("requestsTable").innerHTML = rows.map(r => `<tr><td>${esc(r.employeeName)}</td><td>${esc(r.department)}</td><td>${esc(r.type)}</td><td>${fmt(r.from)} - ${fmt(r.to)}</td><td><span class="status-badge ${statusClass(r.status)}">${statusLabel(r.status)}</span></td><td><div class="actions">${r.status === "pending" ? `<button class="ok" onclick="decide('${r.id}','approved')">Approva</button><button class="no" onclick="decide('${r.id}','rejected')">Rifiuta</button>` : ""}<button class="danger" onclick="deleteRequest('${r.id}')">Elimina</button></div></td></tr>`).join("") || '<tr><td colspan="6">Nessuna richiesta per i filtri selezionati.</td></tr>';
  const yr = Number($("filterYear").value);
  const all = requests.filter(r => Number(r.year) === yr);
  const counts = {total: all.length, pending: all.filter(r => r.status === "pending").length, approved: all.filter(r => r.status === "approved").length, rejected: all.filter(r => r.status === "rejected").length};
  $("stats").innerHTML = `<div class="stat"><span>Totale</span><strong>${counts.total}</strong></div><div class="stat"><span>In attesa</span><strong>${counts.pending}</strong></div><div class="stat"><span>Approvate</span><strong>${counts.approved}</strong></div><div class="stat"><span>Rifiutate</span><strong>${counts.rejected}</strong></div>`;
}
window.decide = async (id, status) => {
  if (currentProfile?.role !== "manager") return;
  const r = requests.find(x => x.id === id);
  if (!r || r.status !== "pending") return alert("La richiesta è già stata valutata.");
  const note = prompt(status === "approved" ? "Nota di conferma (facoltativa):" : "Motivo/nota (facoltativa):", "") || "";
  try {
    await db.collection("requests").doc(id).update({status, managerNote: note, decisionAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
  } catch (e) { alert(firebaseMessage(e)); }
};
window.deleteRequest = async id => {
  if (currentProfile?.role !== "manager") return;
  const r = requests.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Eliminare definitivamente la richiesta di ${r.employeeName} (${r.type}, ${fmt(r.from)} - ${fmt(r.to)})?\n\nIl dipendente potrà inserirla nuovamente in modo corretto.`)) return;
  try { await db.collection("requests").doc(id).delete(); } catch (e) { alert(firebaseMessage(e)); }
};

async function addEmployee(evt) {
  evt?.preventDefault?.();

  if (currentProfile?.role !== "manager") return;

  const name = normalizeName($("newName").value);
  const department = $("newDept").value;

  if (!name) {
    return alert("Inserisci nome e cognome del dipendente.");
  }

  const pin = randomPin();

  try {
    const call = functions.httpsCallable("createEmployee");

    await call({
      name,
      department,
      pin
    });

    $("employeeDialog").close();
    $("newName").value = "";
    $("newDept").selectedIndex = 0;

    await Promise.all([
      loadStaff(),
      loadDirectory()
    ]);

    alert(
      `Dipendente ${name} creato correttamente.\n\n` +
      `PIN TEMPORANEO: ${pin}\n\n` +
      `Comunicalo al dipendente.\n` +
      `Al primo accesso sarà obbligato a cambiarlo.`
    );

  } catch (e) {
    alert(firebaseMessage(e));
  }
}
window.resetEmployeePin = async (uid, name) => {
  if (currentProfile?.role !== "manager") return;

  if (!confirm(`Generare un nuovo PIN temporaneo per ${name}?`)) return;

  const pin = randomPin();

  try {
    await functions.httpsCallable("resetEmployeePin")({uid, pin});

    alert(
      `PIN temporaneo generato per ${name}:\n\n` +
      `${pin}\n\n` +
      `Comunicalo al dipendente.\n` +
      `Al primo accesso sarà obbligato a cambiarlo.`
    );

  } catch (e) {
    alert(firebaseMessage(e));
  }
};
window.toggleEmployee = async (uid, active) => {
  if (currentProfile?.role !== "manager") return;
  if (!confirm(active ? "Riattivare questo dipendente?" : "Disattivare questo dipendente? Non potrà più accedere finché non verrà riattivato.")) return;
  try {
    await functions.httpsCallable("setEmployeeActive")({uid, active});
    await Promise.all([loadStaff(), loadDirectory()]);
  } catch (e) { alert(firebaseMessage(e)); }
};

async function seedInitialEmployees() {
  if (currentProfile?.role !== "manager") return;
  if (!confirm("Creare in Firebase i dipendenti dell'organico iniziale non ancora presenti? Verrà generato un PIN temporaneo diverso per ciascuno.")) return;
  $("seedEmployeesBtn").disabled = true;
  $("seedEmployeesBtn").textContent = "Importazione in corso...";
  const existing = new Set(staff.map(e => `${normalizeName(e.name)}|${e.department}`));
  const report = [];
  let created = 0;
  try {
    for (const [rawName, department] of DEFAULT_EMPLOYEES) {
      const name = normalizeName(rawName);
      const key = `${name}|${department}`;
      if (existing.has(key)) { report.push(`${name} · ${department} · già presente`); continue; }
      const pin = randomPin();
      try {
        await functions.httpsCallable("createEmployee")({name, department, pin});
        report.push(`${name} · ${department} · PIN TEMPORANEO ${pin}`);
        created++;
      } catch (e) {
        report.push(`${name} · ${department} · ERRORE: ${firebaseMessage(e)}`);
      }
    }
    $("importReport").value = report.join("\n");
    $("importReportDialog").showModal();
    await Promise.all([loadStaff(), loadDirectory()]);
    alert(`Importazione terminata. Nuovi dipendenti creati: ${created}. Conserva il report dei PIN temporanei.`);
  } finally {
    $("seedEmployeesBtn").disabled = false;
    $("seedEmployeesBtn").textContent = "Importa organico iniziale";
  }
}
async function copyImportReport() {
  try { await navigator.clipboard.writeText($("importReport").value); alert("Report copiato."); }
  catch { $("importReport").select(); document.execCommand("copy"); alert("Report copiato."); }
}

$("employeeTab").addEventListener("click", () => switchLoginTab("employee"));
$("managerTab").addEventListener("click", () => switchLoginTab("manager"));
$("employeeLoginBtn").addEventListener("click", employeeLogin);
$("managerLoginBtn").addEventListener("click", managerLogin);
$("employeePin").addEventListener("keydown", e => { if (e.key === "Enter") employeeLogin(); });
$("managerPin").addEventListener("keydown", e => { if (e.key === "Enter") managerLogin(); });
$("logoutBtn").addEventListener("click", async () => { const tab = currentProfile?.role === "manager" ? "manager" : "employee"; await auth.signOut(); showLogin(tab); });
$("changePinBtn").addEventListener("click", () => changeEmployeePin(false));
$("managerPinBtn").addEventListener("click", changeManagerPin);
$("sendBtn").addEventListener("click", submitRequest);
$("cancelEditBtn").addEventListener("click", resetRequestForm);
["filterDept", "filterStatus", "filterYear"].forEach(id => $(id).addEventListener("change", renderManager));
$("addEmployeeBtn").addEventListener("click", () => {
  if (currentProfile?.role !== "manager") return;

  $("newName").value = "";
  $("newDept").selectedIndex = 0;
  

  $("employeeDialog").showModal();
});
$("employeeForm").addEventListener("submit", addEmployee);
$("seedEmployeesBtn").addEventListener("click", seedInitialEmployees);
$("copyImportReportBtn").addEventListener("click", copyImportReport);

fillYears();
fillDeptFilters();
loadDirectory();
auth.onAuthStateChanged(async user => {
  if (user && !currentProfile) {
    try { await openAuthenticatedArea(); } catch (e) { console.error(e); showLogin(); }
  } else if (!user) {
    showLogin();
  }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

// =====================================================
// ESPORTAZIONE EXCEL RICHIESTE - AREA MANAGER
// =====================================================

async function exportRequestsToExcel() {
  try {
    if (!currentProfile || currentProfile.role !== "manager") {
      alert("Funzione disponibile solo per il Manager.");
      return;
    }

    const dateFrom = $("exportDateFrom").value;
    const dateTo = $("exportDateTo").value;

    if (!dateFrom || !dateTo) {
      alert("Seleziona sia la data DAL che la data AL.");
      return;
    }

    if (dateFrom > dateTo) {
      alert("La data iniziale non può essere successiva alla data finale.");
      return;
    }

    // Filtra le richieste in base al periodo selezionato
    const filteredRequests = requests.filter(r => {
      const start = r.dateFrom || r.from || r.startDate || "";
      const end = r.dateTo || r.to || r.endDate || start;

      if (!start) return false;

      // Include anche richieste che si sovrappongono al periodo scelto
      return start <= dateTo && end >= dateFrom;
    });

    if (filteredRequests.length === 0) {
      alert("Nessuna richiesta trovata nel periodo selezionato.");
      return;
    }

    const excelData = filteredRequests.map(r => ({
      "Dipendente": r.employeeName || r.name || "",
      "Reparto": r.department || r.dept || "",
      "Tipo richiesta": r.type || r.requestType || "",
      "Dal": r.dateFrom || r.from || r.startDate || "",
      "Al": r.dateTo || r.to || r.endDate || "",
      "Stato": statusLabel(r.status),
      "Note": r.note || r.notes || ""
    }));

    // Crea foglio Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Larghezza colonne
    worksheet["!cols"] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 45 }
    ];

    // Crea cartella Excel
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Richieste");

    const filename =
      `Richieste_Personale_${dateFrom}_${dateTo}.xlsx`;

    XLSX.writeFile(workbook, filename);

  } catch (error) {
    console.error("Errore esportazione Excel:", error);
    alert("Errore durante la creazione del file Excel.");
  }
}

// Collega il pulsante Esporta Excel
const exportExcelBtn = $("exportExcelBtn");

if (exportExcelBtn) {
  exportExcelBtn.addEventListener("click", exportRequestsToExcel);
}
