/* Delivery — minimal output mode */

const STORAGE_KEYS = {
  streets: "delivery_streets_v2",
  deliveries: "delivery_items_v2",
  day: "delivery_day_v2",
};

const DEFAULT_STREETS = [];
const STREETS_REMOTE_URL = "./streets.json";

const TYPE_OPTIONS = [
  { value: "Magazine", label: "Magazine" },
  { value: "Letter", label: "Letter" },
  { value: "Parcel", label: "Parcel" },
  { value: "Other", label: "Other" },
];

const $ = (id) => document.getElementById(id);

const todayEl = $("today");
const countInfo = $("countInfo");
const addedInfo = $("addedInfo");

const streetDD = $("streetDD");
const streetBtn = $("streetBtn");
const streetBtnLabel = $("streetBtnLabel");
const streetMenu = $("streetMenu");

const typeDD = $("typeDD");
const typeBtn = $("typeBtn");
const typeBtnLabel = $("typeBtnLabel");
const typeMenu = $("typeMenu");

const houseNumber = $("houseNumber");
const note = $("note");
const addForm = $("addForm");

const resetBtn = $("resetBtn");
const manageStreetsBtn = $("manageStreetsBtn");
const undoBtn = $("undoBtn");

const output = $("output");
const copyBtn = $("copyBtn");


const streetsDialog = $("streetsDialog");
const newStreet = $("newStreet");
const addStreetBtn = $("addStreetBtn");
const sortStreetsBtn = $("sortStreetsBtn");
const exportBtn = $("exportBtn");
const importBtn = $("importBtn");
const streetsJson = $("streetsJson");
const streetsList = $("streetsList");

let selectedStreet = "";
let selectedType = TYPE_OPTIONS[0]?.value || "Magazine";

function isoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function uniqueMergeCaseInsensitive(listA = [], listB = []) {
  const out = [];
  const seen = new Set();
  for (const raw of [...listA, ...listB]) {
    const s = normalizeText(raw);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function openDD(dd, btn) { dd.classList.add("dd--open"); btn.setAttribute("aria-expanded","true"); }
function closeDD(dd, btn) { dd.classList.remove("dd--open"); btn.setAttribute("aria-expanded","false"); }
function toggleDD(dd, btn) { dd.classList.contains("dd--open") ? closeDD(dd, btn) : openDD(dd, btn); }
function closeAllDD(){ closeDD(streetDD, streetBtn); closeDD(typeDD, typeBtn); }

function openDialogSafe(dlg){
  if (dlg && typeof dlg.showModal === "function") { try { dlg.showModal(); return; } catch {} }
  if (!dlg) return;
  dlg.classList.add("dialog--fallback","is-open");
}
function closeDialogSafe(dlg){
  if (!dlg) return;
  if (typeof dlg.close === "function") { try { dlg.close(); return; } catch {} }
  dlg.classList.remove("is-open");
}

let streetsLocal = loadJSON(STORAGE_KEYS.streets, []);
if (!Array.isArray(streetsLocal)) streetsLocal = [];
let streets = uniqueMergeCaseInsensitive(DEFAULT_STREETS, streetsLocal);

let deliveries = loadJSON(STORAGE_KEYS.deliveries, []);
if (!Array.isArray(deliveries)) deliveries = [];

async function loadRemoteStreetsAndMerge() {
  try {
    const url = `${STREETS_REMOTE_URL}?v=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const remoteList = Array.isArray(data?.streets) ? data.streets : [];
    const merged = uniqueMergeCaseInsensitive(remoteList, streets);
    const changed = merged.length !== streets.length;
    streets = merged;
    if (changed) saveJSON(STORAGE_KEYS.streets, streets);
    renderStreetOptions();
    ensureStreetSelected();
    if (streetsDialog?.open || streetsDialog?.classList?.contains("is-open")) renderStreetsManager();
  } catch {}
}

function dailyResetIfNeeded() {
  const today = isoDay();
  const storedDay = localStorage.getItem(STORAGE_KEYS.day);
  todayEl.textContent = `Today: ${today}`;
  if (storedDay !== today) {
    deliveries = [];
    saveJSON(STORAGE_KEYS.deliveries, deliveries);
    localStorage.setItem(STORAGE_KEYS.day, today);
  }
}

function formatLine(item){
  const base = `${item.street}, ${item.number}`;
  return item.note ? `${base} (${item.note})` : base;
}

function generateCopyText() {
  const order = ["Magazine", "Letter", "Parcel", "Other"];
  const groups = new Map();
  for (const it of deliveries) {
    const t = it.type || "Other";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(it);
  }

  let out = "";
  for (const t of order) {
    const items = groups.get(t);
    if (!items || items.length === 0) continue;
    out += `${t}:\n`;
    for (const it of items) out += `- ${formatLine(it)}\n`;
    out += `\n`;
  }
  return out.trim();
}

function renderOutput() {
  const total = deliveries.length;
  countInfo.textContent = total ? `${total} added` : "0 added";
  output.value = generateCopyText();
  addedInfo.textContent = total ? `Last: ${formatLine(deliveries[deliveries.length - 1])}` : "";
}

function ensureStreetSelected() {
  if (selectedStreet && streets.some(s => s.toLowerCase() === selectedStreet.toLowerCase())) {
  } else {
    selectedStreet = streets[0] || "";
  }
  streetBtnLabel.textContent = selectedStreet ? selectedStreet : "(Select)";
}

function setSelectedStreet(street) {
  selectedStreet = street;
  streetBtnLabel.textContent = selectedStreet || "(Select)";
  closeDD(streetDD, streetBtn);
}

function renderStreetOptions() {
  streetMenu.innerHTML = "";
  if (!streets.length) {
    const div = document.createElement("div");
    div.className = "dd__empty";
    div.textContent = "(No streets yet)";
    streetMenu.appendChild(div);
    return;
  }
  for (const s of streets) {
    const opt = document.createElement("div");
    opt.className = "dd__opt";
    opt.setAttribute("role","option");
    opt.setAttribute("tabindex","0");
    const isSel = selectedStreet && s.toLowerCase() === selectedStreet.toLowerCase();
    opt.setAttribute("aria-selected", isSel ? "true" : "false");
    opt.textContent = s;
    opt.addEventListener("click", () => setSelectedStreet(s));
    opt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedStreet(s); }
    });
    streetMenu.appendChild(opt);
  }
}

function setSelectedType(value) {
  selectedType = value;
  const found = TYPE_OPTIONS.find(o => o.value === value);
  typeBtnLabel.textContent = found ? found.label : "—";
  closeDD(typeDD, typeBtn);
}

function renderTypeOptions() {
  typeMenu.innerHTML = "";
  for (const o of TYPE_OPTIONS) {
    const opt = document.createElement("div");
    opt.className = "dd__opt";
    opt.setAttribute("role","option");
    opt.setAttribute("tabindex","0");
    opt.setAttribute("aria-selected", (o.value === selectedType) ? "true" : "false");
    opt.textContent = o.label;
    opt.addEventListener("click", () => setSelectedType(o.value));
    opt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedType(o.value); }
    });
    typeMenu.appendChild(opt);
  }
}

function renderStreetsManager() {
  streetsList.innerHTML = "";
  const list = streets.slice();
  for (const s of list) {
    const li = document.createElement("li");
    li.className = "streetRow";
    const name = document.createElement("div");
    name.className = "streetName";
    name.textContent = s;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn--danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      streets = streets.filter((x) => x !== s);
      saveJSON(STORAGE_KEYS.streets, streets);
      renderStreetsManager();
      renderStreetOptions();
      ensureStreetSelected();
    });

    li.appendChild(name);
    li.appendChild(del);
    streetsList.appendChild(li);
  }
}

function addStreet(value) {
  const v = normalizeText(value);
  if (!v) return;
  const exists = streets.some((s) => s.toLowerCase() === v.toLowerCase());
  if (exists) return;
  streets.push(v);
  saveJSON(STORAGE_KEYS.streets, streets);
  renderStreetOptions();
  renderStreetsManager();
  ensureStreetSelected();
}

function addDelivery({ street, number, type, note }) {
  const s = normalizeText(street);
  const n = normalizeText(number);
  if (!s || !n) return;

  deliveries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    street: s,
    number: n,
    type: normalizeText(type) || "Other",
    note: normalizeText(note),
    createdAt: Date.now(),
  });

  saveJSON(STORAGE_KEYS.deliveries, deliveries);
  renderOutput();
}

function undoLast() {
  if (!deliveries.length) return;
  deliveries.pop();
  saveJSON(STORAGE_KEYS.deliveries, deliveries);
  renderOutput();
}

function clearAll() {
  deliveries = [];
  saveJSON(STORAGE_KEYS.deliveries, deliveries);
  renderOutput();
}

/* Events */
streetBtn.addEventListener("click", () => { renderStreetOptions(); toggleDD(streetDD, streetBtn); closeDD(typeDD, typeBtn); });
typeBtn.addEventListener("click", () => { renderTypeOptions(); toggleDD(typeDD, typeBtn); closeDD(streetDD, streetBtn); });

document.addEventListener("click", (e) => {
  const inStreet = streetDD.contains(e.target);
  const inType = typeDD.contains(e.target);
  if (!inStreet && !inType) closeAllDD();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllDD(); });

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addDelivery({ street: selectedStreet, number: houseNumber.value, type: selectedType, note: note.value });
  houseNumber.value = "";
  note.value = "";
  houseNumber.focus();
});

undoBtn.addEventListener("click", () => undoLast());
resetBtn.addEventListener("click", () => clearAll());


copyBtn.addEventListener("click", async () => {
  const text = output.value || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy"), 900);
  } catch {
    output.focus(); output.select(); document.execCommand("copy");
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy"), 900);
  }
});

manageStreetsBtn.addEventListener("click", () => {
  renderStreetsManager();
  streetsJson.value = "";
  openDialogSafe(streetsDialog);
});

addStreetBtn.addEventListener("click", () => { addStreet(newStreet.value); newStreet.value = ""; newStreet.focus(); });
newStreet.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addStreetBtn.click(); } });

sortStreetsBtn.addEventListener("click", () => {
  streets = streets.slice().sort((a,b) => a.localeCompare(b,"en"));
  saveJSON(STORAGE_KEYS.streets, streets);
  renderStreetOptions(); renderStreetsManager(); ensureStreetSelected();
});

exportBtn.addEventListener("click", () => {
  streetsJson.value = JSON.stringify({ streets }, null, 2);
  streetsJson.focus(); streetsJson.select();
});

importBtn.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(streetsJson.value || "{}");
    if (!parsed || !Array.isArray(parsed.streets)) return;
    const cleaned = parsed.streets.map(normalizeText).filter(Boolean);
    streets = uniqueMergeCaseInsensitive(streets, cleaned);
    saveJSON(STORAGE_KEYS.streets, streets);
    renderStreetOptions(); renderStreetsManager(); ensureStreetSelected();
  } catch {}
});

if (streetsDialog) {
  streetsDialog.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('[value="close"]')) closeDialogSafe(streetsDialog);
    if (streetsDialog.classList.contains("dialog--fallback") && t === streetsDialog) closeDialogSafe(streetsDialog);
  });
}

/* PWA */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* Init */
dailyResetIfNeeded();
renderTypeOptions();
setSelectedType(selectedType);
renderStreetOptions();
ensureStreetSelected();
renderOutput();
loadRemoteStreetsAndMerge();
