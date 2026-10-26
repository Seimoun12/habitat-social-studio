const channelLabels = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };
const channelShort = { instagram: "IG", facebook: "FB", tiktok: "TT" };
const demoData = {
  x: {
    instagram: { followers: 8240, delta: 3.8, likes: 2310, views: 18400, comments: 186, engagement: 5.7, gender: [62, 34, 4], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [22, 46, 21, 11], cities: [["Milano", 31], ["Roma", 24], ["Torino", 16], ["Bologna", 12]], line: [33, 38, 36, 47, 44, 58, 53, 64, 61, 74, 70, 82], best: ["Un dettaglio del processo", "Prima e dopo", "La domanda della community", "Dietro le quinte", "Guida in 3 passaggi"], avoid: ["Promo a freddo", "Visual senza contesto", "Post fuori orario", "Caption generica", "Formato ripetuto"], bestRates: ["8,4%", "7,9%", "7,2%", "6,8%", "6,3%"], avoidRates: ["1,1%", "1,4%", "1,6%", "1,8%", "2,0%"] },
    facebook: { followers: 4130, delta: 1.4, likes: 940, views: 12700, comments: 74, engagement: 3.2, gender: [55, 41, 4], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [12, 34, 32, 22], cities: [["Milano", 29], ["Roma", 27], ["Bergamo", 15], ["Torino", 11]], line: [37, 39, 41, 40, 46, 45, 51, 55, 53, 61, 64, 68], best: ["La storia del team", "Domanda aperta", "Foto dal laboratorio", "Consiglio pratico", "Evento in arrivo"], avoid: ["Link senza anteprima", "Testo troppo lungo", "Promo a freddo", "Immagine stock", "Post duplicato"], bestRates: ["5,8%", "5,1%", "4,9%", "4,5%", "4,2%"], avoidRates: ["0,8%", "1,0%", "1,2%", "1,4%", "1,5%"] },
    tiktok: { followers: 12600, delta: 6.2, likes: 4820, views: 52400, comments: 392, engagement: 7.4, gender: [58, 38, 4], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [42, 39, 13, 6], cities: [["Milano", 25], ["Roma", 22], ["Napoli", 17], ["Firenze", 10]], line: [24, 35, 32, 49, 54, 48, 62, 57, 74, 71, 88, 96], best: ["Un minuto di lavorazione", "Trend reinterpretato", "Risposta a un commento", "Errore da evitare", "Un giorno in studio"], avoid: ["Intro troppo lunga", "Audio non pertinente", "Solo testo a schermo", "Taglio poco chiaro", "Trend fuori tema"], bestRates: ["10,2%", "9,4%", "8,7%", "8,1%", "7,8%"], avoidRates: ["1,3%", "1,7%", "2,0%", "2,1%", "2,4%"] }
  },
  y: {
    instagram: { followers: 5630, delta: 2.1, likes: 1470, views: 11900, comments: 102, engagement: 4.9, gender: [48, 47, 5], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [18, 42, 27, 13], cities: [["Roma", 34], ["Napoli", 22], ["Milano", 18], ["Bari", 11]], line: [32, 34, 41, 39, 46, 44, 52, 55, 51, 60, 63, 70], best: ["Una scelta di materiali", "Il prima e dopo", "Domande frequenti", "Una giornata tipo", "Consiglio della settimana"], avoid: ["Post solo promozionale", "Copy poco specifico", "Foto scura", "Carosello denso", "Pubblicazione ripetuta"], bestRates: ["7,2%", "6,8%", "6,1%", "5,9%", "5,5%"], avoidRates: ["1,0%", "1,3%", "1,7%", "1,8%", "2,1%"] },
    facebook: { followers: 2870, delta: .8, likes: 650, views: 8400, comments: 56, engagement: 2.8, gender: [46, 49, 5], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [10, 31, 35, 24], cities: [["Roma", 31], ["Napoli", 26], ["Latina", 14], ["Milano", 10]], line: [42, 43, 44, 45, 47, 48, 49, 51, 50, 54, 55, 57], best: ["Dietro le quinte", "Una recensione", "Il team risponde", "Info pratiche", "Un progetto recente"], avoid: ["Immagine senza testo", "Post troppo frequente", "Link generico", "Promo ripetuta", "Testo impersonale"], bestRates: ["4,8%", "4,1%", "3,9%", "3,6%", "3,4%"], avoidRates: ["0,7%", "0,9%", "1,1%", "1,3%", "1,4%"] },
    tiktok: { followers: 7900, delta: 4.4, likes: 3260, views: 36800, comments: 244, engagement: 6.8, gender: [51, 44, 5], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [36, 43, 15, 6], cities: [["Roma", 27], ["Napoli", 25], ["Milano", 18], ["Bologna", 9]], line: [28, 31, 42, 38, 50, 56, 52, 65, 68, 73, 80, 90], best: ["Un consiglio rapido", "Il dettaglio che cambia", "Domanda in video", "Un piccolo tutorial", "Un giorno di lavoro"], avoid: ["Audio fuori contesto", "Montaggio lento", "Hook generico", "Titolo non leggibile", "Replica di un trend"], bestRates: ["9,1%", "8,5%", "7,9%", "7,4%", "7,0%"], avoidRates: ["1,2%", "1,4%", "1,7%", "1,9%", "2,2%"] }
  },
  w: {
    instagram: { followers: 10300, delta: -0.6, likes: 2760, views: 22100, comments: 219, engagement: 4.6, gender: [67, 29, 4], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [17, 43, 28, 12], cities: [["Firenze", 30], ["Milano", 22], ["Roma", 19], ["Verona", 10]], line: [80, 78, 79, 74, 73, 70, 69, 72, 71, 73, 72, 74], best: ["Un progetto raccontato", "Il dietro le quinte", "Un consiglio utile", "La scelta del colore", "Un prima e dopo"], avoid: ["Post con troppe idee", "Caption senza invito", "Visual ripetuto", "Trend non affine", "Promo diretta"], bestRates: ["7,5%", "6,9%", "6,5%", "6,1%", "5,7%"], avoidRates: ["1,2%", "1,4%", "1,6%", "1,8%", "2,1%"] },
    facebook: { followers: 5190, delta: -.2, likes: 1110, views: 14300, comments: 98, engagement: 3.4, gender: [61, 35, 4], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [9, 29, 38, 24], cities: [["Firenze", 32], ["Prato", 21], ["Milano", 16], ["Roma", 12]], line: [65, 64, 63, 64, 62, 63, 62, 63, 64, 63, 64, 64], best: ["Il racconto di un progetto", "Una domanda", "Cosa c'è dietro", "Consiglio concreto", "Evento locale"], avoid: ["Post senza immagine", "Link senza contesto", "Copy ripetitivo", "Promozione vaga", "Pubblicazione tardiva"], bestRates: ["5,3%", "4,9%", "4,5%", "4,3%", "4,0%"], avoidRates: ["0,9%", "1,1%", "1,3%", "1,5%", "1,7%"] },
    tiktok: { followers: 4820, delta: 1.9, likes: 1930, views: 24800, comments: 167, engagement: 5.9, gender: [63, 33, 4], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [38, 41, 15, 6], cities: [["Firenze", 27], ["Roma", 21], ["Milano", 18], ["Bologna", 12]], line: [33, 39, 37, 43, 45, 48, 46, 54, 57, 55, 62, 68], best: ["Un passaggio veloce", "Prima e dopo il progetto", "Una curiosità", "Risposta in video", "Un dettaglio insolito"], avoid: ["Intro senza contesto", "Audio poco chiaro", "Video troppo lungo", "Testo fitto", "Trend generico"], bestRates: ["8,3%", "7,7%", "7,2%", "6,9%", "6,4%"], avoidRates: ["1,2%", "1,6%", "1,8%", "2,0%", "2,3%"] }
  },
  z: {
    instagram: { followers: 3470, delta: 5.1, likes: 1210, views: 9800, comments: 114, engagement: 6.4, gender: [43, 52, 5], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [28, 48, 17, 7], cities: [["Bologna", 33], ["Milano", 21], ["Roma", 18], ["Modena", 12]], line: [25, 29, 32, 38, 35, 48, 52, 49, 60, 64, 68, 79], best: ["Un gesto quotidiano", "Il prodotto in uso", "Tre modi per usarlo", "Una scelta sostenibile", "Domanda alla community"], avoid: ["Still life ripetuto", "Offerta senza contesto", "Descrizione lunga", "Visual scuro", "Post duplicato"], bestRates: ["9,3%", "8,7%", "8,2%", "7,8%", "7,1%"], avoidRates: ["1,1%", "1,3%", "1,6%", "1,9%", "2,1%"] },
    facebook: { followers: 1620, delta: 1.2, likes: 440, views: 6100, comments: 49, engagement: 3.7, gender: [41, 54, 5], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [16, 37, 32, 15], cities: [["Bologna", 34], ["Modena", 24], ["Milano", 15], ["Roma", 9]], line: [31, 32, 34, 35, 34, 37, 39, 40, 41, 43, 44, 46], best: ["Il racconto del prodotto", "Una domanda semplice", "Un consiglio stagionale", "Il processo", "Il team"], avoid: ["Offerta poco chiara", "Immagine generica", "Post denso", "Link senza testo", "Ripubblicazione"], bestRates: ["5,0%", "4,4%", "4,0%", "3,8%", "3,5%"], avoidRates: ["0,8%", "1,0%", "1,2%", "1,4%", "1,6%"] },
    tiktok: { followers: 9150, delta: 7.8, likes: 4070, views: 45100, comments: 331, engagement: 8.1, gender: [45, 50, 5], ages: ["18–24", "25–34", "35–44", "45–54"], ageValues: [47, 38, 11, 4], cities: [["Bologna", 28], ["Milano", 22], ["Roma", 17], ["Modena", 13]], line: [22, 33, 39, 36, 50, 58, 55, 70, 74, 82, 89, 99], best: ["Un dettaglio sorprendente", "Il prodotto in movimento", "Risposta a una domanda", "Mini tutorial", "Una giornata reale"], avoid: ["Audio non coerente", "Apertura lenta", "Testo illeggibile", "Video promozionale", "Trend copiato"], bestRates: ["11,1%", "10,3%", "9,2%", "8,8%", "8,4%"], avoidRates: ["1,4%", "1,8%", "2,0%", "2,3%", "2,5%"] }
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clientSelect = $("#client-select");
let selectedClient = clientSelect.value;
let selectedChannel = "instagram";
let selectedPeriod = "7";
let analysisPeriod = "30";
const calendarOffsets = { appointments: { week: 0, month: 0 }, content: { week: 0, month: 0 } };
const calendarModes = { appointments: "week", content: "week" };
let toastTimer;

function formatNumber(value) { return new Intl.NumberFormat("it-IT").format(value); }
function formatDate(date, options = { day: "2-digit", month: "short" }) { return new Intl.DateTimeFormat("it-IT", options).format(date); }
function dateOnly(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function dateInputValue(date) {
  const localDate = dateOnly(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function currentDataset(channel = selectedChannel) { return demoData[selectedClient][channel]; }
function getRange(kind) {
  const custom = kind === "analysis" ? analysisPeriod === "custom" : selectedPeriod === "custom";
  const startInput = kind === "analysis" ? $("#analysis-start") : $("#overview-start");
  const endInput = kind === "analysis" ? $("#analysis-end") : $("#overview-end");
  const end = dateOnly(new Date());
  const days = Number(kind === "analysis" ? analysisPeriod : selectedPeriod) || 30;
  if (custom && startInput.value && endInput.value) return { start: new Date(`${startInput.value}T00:00:00`), end: new Date(`${endInput.value}T00:00:00`), custom: true };
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { start, end, custom: false };
}
function rangeText(kind) {
  const range = getRange(kind);
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
}
function getAppointmentStore() {
  try { return JSON.parse(localStorage.getItem("bynor-appointments") || "[]"); }
  catch { return []; }
}
function saveAppointments(appointments) {
  try {
    localStorage.setItem("bynor-appointments", JSON.stringify(appointments));
    return true;
  } catch {
    showToast("Il browser non ha potuto salvare l'appuntamento.");
    return false;
  }
}

function getScheduledContentStore() {
  try { return JSON.parse(localStorage.getItem("bynor-scheduled-content") || "[]"); }
  catch { return []; }
}
function saveScheduledContent(items) {
  try {
    localStorage.setItem("bynor-scheduled-content", JSON.stringify(items));
    return true;
  } catch {
    showToast("Il browser non ha potuto salvare il contenuto.");
    return false;
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeIcsText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\r\n|\n|\r/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldIcsLine(line) {
  let folded = "";
  let byteLength = 0;
  for (const character of line) {
    const characterLength = new TextEncoder().encode(character).length;
    if (byteLength + characterLength > 75) {
      folded += "\r\n ";
      byteLength = 1;
    }
    folded += character;
    byteLength += characterLength;
  }
  return folded;
}

function exportCalendar() {
  const appointments = getAppointmentStore().sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b));
  if (!appointments.length) {
    showToast("Aggiungi un appuntamento prima di esportare il calendario.");
    return;
  }
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = appointments.map((appointment) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.date) || !/^\d{2}:\d{2}$/.test(appointment.time || "")) return null;
    const start = `${appointment.date.replace(/-/g, "")}T${appointment.time.replace(":", "")}00`;
    const details = `Cliente: ${appointment.client || "Studio"}\nCanale: ${appointment.channel || "Studio"}`;
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(appointment.id)}@habitat.local`,
      `DTSTAMP:${timestamp}`,
      `DTSTART:${start}`,
      "DURATION:PT1H",
      `SUMMARY:${escapeIcsText(appointment.title)}`,
      `DESCRIPTION:${escapeIcsText(details)}`,
      "END:VEVENT"
    ];
  }).filter(Boolean);
  if (!events.length) {
    showToast("Non ci sono appuntamenti validi da esportare.");
    return;
  }
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Habitat//Social Studio//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Habitat - Appuntamenti",
    ...events.flat(),
    "END:VCALENDAR"
  ].map(foldIcsLine).join("\r\n");
  const download = document.createElement("a");
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  download.href = url;
  download.download = `habitat-appuntamenti-${dateInputValue(new Date()).replace(/-/g, "")}.ics`;
  document.body.append(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${events.length} appuntamenti esportati in formato .ics.`);
}

function calendarPeriod(type) {
  const mode = calendarModes[type];
  const today = dateOnly(new Date());
  if (mode === "week") {
    const first = mondayOfWeek(today);
    first.setDate(first.getDate() + calendarOffsets[type].week * 7);
    const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(first); day.setDate(first.getDate() + index); return day; });
    return { days, first, last: days[6], month: first };
  }
  const month = new Date(today.getFullYear(), today.getMonth() + calendarOffsets[type].month, 1);
  const first = mondayOfWeek(month);
  const finalMonthDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const last = mondayOfWeek(finalMonthDay);
  last.setDate(last.getDate() + 6);
  const days = [];
  for (const day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) days.push(new Date(day));
  return { days, first, last, month };
}

function renderCalendarItem(item, isContent) {
  const removeAttribute = isContent ? "data-remove-content" : "data-remove-appointment";
  const label = isContent ? `Contenuto ${item.format}, ${item.title}, ${item.client}. Premi per annullare` : `${item.time} ${item.title}, ${item.client}. Premi per rimuovere`;
  const details = isContent ? `${item.time} · ${item.client} · ${item.channels.map((channel) => channelLabels[channel]).join(", ")}` : `${item.time} · ${item.client}`;
  return `<button class="appointment-card ${isContent ? "scheduled-content-card" : ""}" ${removeAttribute}="${escapeHtml(item.id)}" aria-label="${escapeHtml(label)}" data-channel="${escapeHtml(item.channel || "")}">${isContent ? `<span class="event-kind">Contenuto · ${escapeHtml(item.format)}</span>` : ""}<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(details)}</span></button>`;
}

function setDemoState() {
  $("#today-label").textContent = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  $("#overview-kicker").textContent = `${clientSelect.selectedOptions[0].textContent.toUpperCase()} · PANORAMICA`;
  $("#analysis-kicker").textContent = `${clientSelect.selectedOptions[0].textContent.toUpperCase()} · ANALISI`;
  renderOverview();
  renderAnalysis();
  renderCalendar("appointments");
  renderCalendar("content");
}

function renderMetricMarkup(data, includeViews = true) {
  const items = [
    { label: "Follower", value: formatNumber(data.followers), change: `${data.delta > 0 ? "+" : ""}${data.delta}%`, foot: "variazione nel periodo", negative: data.delta < 0 },
    { label: "Interazioni", value: formatNumber(data.likes + data.comments), change: "+8,2%", foot: "like e commenti" },
    ...(includeViews ? [{ label: "Visualizzazioni", value: formatNumber(data.views), change: "+12,6%", foot: "nel periodo selezionato" }] : []),
    { label: "Coinvolgimento", value: `${data.engagement}%`, change: "+0,4 pt", foot: "tasso di coinvolgimento" }
  ];
  return items.map((item) => `<div class="metric-item"><span class="metric-label">${item.label}</span><div class="metric-value-row"><strong class="metric-value">${item.value}</strong><span class="metric-change ${item.negative ? "negative" : ""}">${item.change}</span></div><div class="metric-foot">${item.foot}</div></div>`).join("");
}

function renderLineChart(data, prefix = "chart") {
  const line = $(`#${prefix}-line`);
  const area = $(`#${prefix}-area`);
  const point = $(`#${prefix}-point`);
  const width = 720;
  const height = prefix === "analysis-chart" ? 210 : 190;
  const top = 12;
  const bottom = height - 12;
  const min = Math.min(...data.line) - 8;
  const max = Math.max(...data.line) + 8;
  const points = data.line.map((value, index) => {
    const x = (index / (data.line.length - 1)) * width;
    const y = bottom - ((value - min) / (max - min)) * (bottom - top);
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  line.setAttribute("d", path);
  area.setAttribute("d", `${path} L${width} ${height} L0 ${height} Z`);
  const [lastX, lastY] = points.at(-1);
  point.setAttribute("cx", lastX);
  point.setAttribute("cy", lastY);
}

function renderGender(data, barSelector, legendSelector) {
  const labels = ["Donne", "Uomini", "Altro / non indicato"];
  $(barSelector).innerHTML = data.gender.map((value) => `<span style="width:${value}%"></span>`).join("");
  $(legendSelector).innerHTML = data.gender.map((value, index) => `<span class="legend-item"><i class="legend-swatch" aria-hidden="true"></i>${labels[index]} ${value}%</span>`).join("");
}

function renderContentList(target, titles, values, kind) {
  $(target).innerHTML = titles.map((title, index) => `<div class="content-row"><span class="content-rank">0${index + 1}</span><div class="content-copy"><strong>${title}</strong><span>${kind === "best" ? "Tasso di coinvolgimento" : "Tasso di coinvolgimento"}</span></div><span class="content-result">${values[index]}</span></div>`).join("");
}

function renderOverview() {
  const channel = $("#overview-channel").value;
  selectedChannel = channel;
  const data = currentDataset(channel);
  $("#overview-metrics").innerHTML = renderMetricMarkup(data);
  $("#overview-channel-stamp").textContent = channelShort[channel];
  $("#chart-total").textContent = formatNumber(data.followers);
  $("#chart-change").textContent = `${data.delta > 0 ? "+" : ""}${data.delta}% nel periodo`;
  $("#chart-change").classList.toggle("negative", data.delta < 0);
  $("#chart-start-label").textContent = formatDate(getRange("overview").start);
  $("#chart-end-label").textContent = formatDate(getRange("overview").end);
  renderLineChart(data);
  $("#audience-total").textContent = formatNumber(data.followers);
  renderGender(data, "#gender-bar", "#gender-legend");
  $("#top-age").textContent = data.ages[data.ageValues.indexOf(Math.max(...data.ageValues))];
  $("#top-city").textContent = data.cities[0][0];
  renderContentList("#best-content-list", data.best, data.bestRates, "best");
  renderContentList("#avoid-content-list", data.avoid, data.avoidRates, "avoid");
}

function renderAnalysis() {
  const channel = $("#analysis-channel").value;
  const data = currentDataset(channel);
  $("#analysis-metrics").innerHTML = renderMetricMarkup(data, true).replace("Interazioni", "Mi piace e commenti");
  $("#analysis-channel-stamp").textContent = channelShort[channel];
  $("#analysis-chart-total").textContent = formatNumber(data.followers);
  $("#analysis-chart-change").textContent = `${data.delta > 0 ? "+" : ""}${data.delta}% nel periodo`;
  $("#analysis-chart-change").classList.toggle("negative", data.delta < 0);
  $("#analysis-chart-start").textContent = formatDate(getRange("analysis").start);
  $("#analysis-chart-end").textContent = formatDate(getRange("analysis").end);
  $("#analysis-period-label").textContent = rangeText("analysis");
  $("#analysis-content-period").textContent = rangeText("analysis");
  renderLineChart(data, "analysis-chart");
  renderGender(data, "#analysis-gender-bar", "#analysis-gender-legend");
  $("#age-bars").innerHTML = data.ages.map((age, index) => `<div class="age-row"><span>${age}</span><div class="age-track"><div class="age-fill" style="width:${data.ageValues[index]}%"></div></div><strong>${data.ageValues[index]}%</strong></div>`).join("");
  $("#location-list").innerHTML = data.cities.map(([city, share]) => `<div class="location-item"><span>${city}</span><strong>${share}%</strong></div>`).join("");
  renderContentList("#analysis-best-list", data.best, data.bestRates, "best");
  renderContentList("#analysis-avoid-list", data.avoid, data.avoidRates, "avoid");
}

function mondayOfWeek(date) {
  const monday = dateOnly(date);
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday);
  return monday;
}
function appointmentDateTime(appointment) { return new Date(`${appointment.date}T${appointment.time || "09:00"}:00`); }
function renderCalendar(type) {
  const isContent = type === "content";
  const prefix = isContent ? "content" : "appointments";
  const mode = calendarModes[type];
  $$(`[data-calendar-shift][data-calendar-target="${type}"]`).forEach((button) => {
    const direction = button.dataset.calendarShift === "-1" ? "precedente" : "successivo";
    button.setAttribute("aria-label", `${mode === "month" ? "Mese" : "Settimana"} ${direction}`);
  });
  const { days, first, last, month } = calendarPeriod(type);
  const periodLabel = mode === "month"
    ? formatDate(month, { month: "long", year: "numeric" })
    : `${formatDate(first, { day: "numeric", month: "long" })} – ${formatDate(last, { day: "numeric", month: "long", year: "numeric" })}`;
  $(`#${prefix}-week-label`).textContent = periodLabel;
  const all = (isContent ? getScheduledContentStore() : getAppointmentStore()).sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b));
  $(`#${isContent ? "content" : "appointment"}-count`).textContent = formatNumber(all.length);
  const weekGrid = $(`#${prefix}-week-grid`);
  const monthScroll = $(`#${prefix}-month-scroll`);
  const monthGrid = $(`#${prefix}-month-grid`);
  const monthEmpty = $(`#${prefix}-month-empty`);
  const today = dateOnly(new Date());
  const dayNames = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  const itemsForDay = (day) => all.filter((item) => item.date === dateInputValue(day));
  if (!all.length) {
    const emptyTitle = isContent ? "Nessun contenuto programmato." : "Nessun appuntamento.";
    const emptyText = isContent ? "I contenuti che programmi appariranno qui." : "Gli appuntamenti dello studio appariranno qui.";
    weekGrid.innerHTML = `<div class="empty-calendar"><strong>${emptyTitle}</strong>${emptyText}</div>`;
  } else {
    weekGrid.innerHTML = days.slice(0, 7).map((day, index) => {
      const items = itemsForDay(day);
      return `<section class="day-column ${day.getTime() === today.getTime() ? "is-today" : ""}"><header class="day-header"><span>${dayNames[index]}</span><strong>${day.getDate()}</strong></header><div class="day-events">${items.length ? items.map((item) => renderCalendarItem(item, isContent)).join("") : `<span class="empty-day">Libero</span>`}</div></section>`;
    }).join("");
  }
  const monthHeaders = dayNames.map((day) => `<div class="month-weekday">${day.slice(0, 3)}</div>`).join("");
  const monthDays = days.map((day) => {
    const items = itemsForDay(day);
    const outsideMonth = day.getMonth() !== month.getMonth();
    const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(day);
    return `<section class="month-day ${day.getTime() === today.getTime() ? "is-today" : ""} ${outsideMonth ? "is-outside-month" : ""}" aria-label="${dayLabel}"><header class="month-day-header"><time datetime="${dateInputValue(day)}">${day.getDate()}</time></header><div class="month-day-events">${items.map((item) => renderCalendarItem(item, isContent)).join("")}</div></section>`;
  }).join("");
  monthGrid.innerHTML = `${monthHeaders}${monthDays}`;
  const monthHasItems = days.some((day) => day.getMonth() === month.getMonth() && itemsForDay(day).length);
  monthEmpty.textContent = isContent ? "Nessun contenuto programmato in questo mese." : "Nessun appuntamento in questo mese.";
  monthEmpty.hidden = mode !== "month" || monthHasItems;
  weekGrid.hidden = mode !== "week";
  monthScroll.hidden = mode !== "month";
}

function changePage(pageName) {
  $("#client-control").hidden = pageName === "appointments";
  $$(".page-view").forEach((page) => {
    const active = page.id === `page-${pageName}`;
    page.hidden = !active;
    page.classList.toggle("is-visible", active);
  });
  $$(".nav-link").forEach((button) => {
    const active = button.dataset.page === pageName;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (pageName === "appointments") renderCalendar("appointments");
  if (pageName === "content-calendar") renderCalendar("content");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function openReportDialog() {
  const range = getRange("overview");
  $("#report-start").value = dateInputValue(range.start);
  $("#report-end").value = dateInputValue(range.end);
  $$("input[name='channels']").forEach((input) => { input.checked = input.value === selectedChannel; });
  $("#report-error").hidden = true;
  $("#report-dialog").showModal();
}

function prepareReport(formData) {
  const channels = formData.getAll("channels");
  const sections = formData.getAll("data");
  const start = $("#report-start").value;
  const end = $("#report-end").value;
  if (!channels.length || !sections.length) {
    $("#report-error").textContent = "Seleziona almeno un canale e una sezione.";
    $("#report-error").hidden = false;
    return false;
  }
  if (!start || !end || start > end) {
    $("#report-error").textContent = "Controlla l'intervallo: la data iniziale deve precedere quella finale.";
    $("#report-error").hidden = false;
    return false;
  }
  const sectionLabels = { audience: "Pubblico e follower", interactions: "Interazioni", content: "Rendimento contenuti", demographics: "Genere, età e luoghi" };
  const channelRows = channels.map((channel) => {
    const data = demoData[selectedClient][channel];
    const metrics = [];
    if (sections.includes("audience")) metrics.push(["Follower", formatNumber(data.followers)], ["Variazione follower", `${data.delta > 0 ? "+" : ""}${data.delta}%`]);
    if (sections.includes("interactions")) metrics.push(["Mi piace", formatNumber(data.likes)], ["Visualizzazioni", formatNumber(data.views)], ["Commenti", formatNumber(data.comments)], ["Tasso di coinvolgimento", `${data.engagement}%`]);
    if (sections.includes("demographics")) metrics.push(["Genere", `Donne ${data.gender[0]}%, uomini ${data.gender[1]}%, altro / non indicato ${data.gender[2]}%`], ["Fascia d'età principale", data.ages[data.ageValues.indexOf(Math.max(...data.ageValues))]], ["Città principale", data.cities[0][0]]);
    if (sections.includes("content")) metrics.push(["Contenuto da replicare", `${data.best[0]} (${data.bestRates[0]})`], ["Contenuto da rivedere", `${data.avoid[0]} (${data.avoidRates[0]})`]);
    return `<h2>${channelLabels[channel]}</h2><table><thead><tr><th>Indicatore</th><th>Risultato dimostrativo</th></tr></thead><tbody>${metrics.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</tbody></table>`;
  }).join("");
  $("#print-report").innerHTML = `<p class="eyebrow">HABITAT · SOCIAL STUDIO</p><h1>${clientSelect.selectedOptions[0].textContent}</h1><p>Report dal ${formatDate(new Date(`${start}T00:00:00`), { day: "numeric", month: "long", year: "numeric" })} al ${formatDate(new Date(`${end}T00:00:00`), { day: "numeric", month: "long", year: "numeric" })}</p><p>Canali: ${channels.map((channel) => channelLabels[channel]).join(", ")}</p><p>Sezioni: ${sections.map((section) => sectionLabels[section]).join(", ")}</p><p class="report-demo-note">Report dimostrativo. I dati non provengono da account social collegati.</p>${channelRows}`;
  $("#report-dialog").close();
  window.setTimeout(() => window.print(), 80);
  return true;
}

function openAppointmentDialog() {
  const now = new Date();
  $("#appointment-date").value = dateInputValue(now);
  $("#appointment-time").value = "10:00";
  $("#appointment-client").value = clientSelect.selectedOptions[0].textContent;
  $("#appointment-error").hidden = true;
  $("#appointment-dialog").showModal();
  $("#appointment-name").focus();
}

function openContentDialog() {
  const tomorrow = dateOnly(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const form = $("#content-form");
  form.reset();
  $("#content-client").value = clientSelect.selectedOptions[0].textContent;
  $("#content-date").min = dateInputValue(new Date());
  $("#content-date").value = dateInputValue(tomorrow);
  $("#content-time").value = "10:00";
  $$('input[name="content-channels"]').forEach((input) => { input.checked = input.value === selectedChannel; });
  $("#content-error").hidden = true;
  $("#content-dialog").showModal();
  $("#content-name").focus();
}

function handleContentSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const title = String(form.get("title")).trim();
  const channels = form.getAll("content-channels");
  const date = String(form.get("date"));
  const time = String(form.get("time"));
  const media = String(form.get("media")).trim();
  const error = $("#content-error");
  if (!title || !date || !time || !channels.length) {
    error.textContent = "Inserisci un titolo, data e ora e seleziona almeno un canale.";
    error.hidden = false;
    return;
  }
  if (appointmentDateTime({ date, time }) <= new Date()) {
    error.textContent = "Scegli un orario futuro per programmare il contenuto.";
    error.hidden = false;
    return;
  }
  if (media && !/^https?:\/\//i.test(media)) {
    error.textContent = "Il link al media deve iniziare con http:// o https://.";
    error.hidden = false;
    return;
  }
  const items = getScheduledContentStore();
  items.push({
    id: crypto.randomUUID(),
    title,
    caption: String(form.get("caption")).trim(),
    media,
    format: String(form.get("format")),
    channels,
    date,
    time,
    client: String(form.get("client"))
  });
  if (!saveScheduledContent(items)) return;
  $("#content-dialog").close();
  event.currentTarget.reset();
  renderCalendar("content");
  showToast("Contenuto salvato nel calendario. Pubblicazione automatica non attiva.");
}

function handleAppointmentSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const title = String(form.get("title")).trim();
  const date = String(form.get("date"));
  const time = String(form.get("time"));
  const error = $("#appointment-error");
  if (!title || !date || !time) {
    error.textContent = "Inserisci titolo, data e ora.";
    error.hidden = false;
    return;
  }
  const appointments = getAppointmentStore();
  appointments.push({ id: crypto.randomUUID(), title, date, time, client: form.get("client"), channel: form.get("channel") });
  if (!saveAppointments(appointments)) return;
  $("#appointment-dialog").close();
  event.currentTarget.reset();
  renderCalendar("appointments");
  showToast("Appuntamento aggiunto al calendario dello studio.");
}

function removeAppointment(id) {
  if (!window.confirm("Rimuovere questo appuntamento dal calendario?")) return;
  const appointments = getAppointmentStore().filter((item) => item.id !== id);
  if (saveAppointments(appointments)) {
    renderCalendar("appointments");
    showToast("Appuntamento rimosso.");
  }
}

function removeScheduledContent(id) {
  if (!window.confirm("Annullare questo contenuto programmato?")) return;
  const items = getScheduledContentStore().filter((item) => item.id !== id);
  if (saveScheduledContent(items)) {
    renderCalendar("content");
    showToast("Contenuto rimosso dal calendario.");
  }
}

function metaStatusMessage(connection) {
  const pages = connection.pages || [];
  const instagram = connection.instagram || [];
  return `Meta collegato · ${pages.length} Pagine, ${instagram.length} account Instagram`;
}

async function refreshMetaConnection() {
  const status = $("#meta-status");
  const connect = $("#meta-connect");
  const disconnect = $("#meta-disconnect");
  try {
    const response = await fetch("/api/meta/connection", { cache: "no-store" });
    if (!response.ok) throw new Error("status_unavailable");
    const connection = await response.json();
    status.textContent = connection.connected ? metaStatusMessage(connection) : "Meta non collegato";
    connect.textContent = connection.connected ? "Ricollega Meta" : "Collega Meta";
    disconnect.hidden = !connection.connected;
    if (connection.errorCode) showToast("Meta non ha completato il collegamento. Verifica i permessi e riprova.");
  } catch {
    status.textContent = "Backend OAuth non raggiungibile";
    connect.textContent = "Collega Meta";
    disconnect.hidden = true;
  }
}

function handleMetaRedirect() {
  const result = new URLSearchParams(window.location.search).get("meta");
  const messages = {
    connected: "Account Meta collegato. Metriche e report restano dati demo.",
    denied: "Autorizzazione Meta annullata.",
    failed: "Collegamento Meta non riuscito. Controlla configurazione e permessi.",
    "not-configured": "Configura le credenziali Meta nel file .env del server.",
    "state-error": "Verifica OAuth non valida. Avvia di nuovo il collegamento."
  };
  if (!messages[result]) return;
  showToast(messages[result]);
  window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
}

function bindEvents() {
  clientSelect.addEventListener("change", () => {
    selectedClient = clientSelect.value;
    setDemoState();
  });
  $$(".nav-link").forEach((button) => button.addEventListener("click", () => changePage(button.dataset.page)));
  $$("[data-go-page]").forEach((button) => button.addEventListener("click", () => changePage(button.dataset.goPage)));
  $$(".period-tab").forEach((button) => button.addEventListener("click", () => {
    selectedPeriod = button.dataset.period;
    $$(".period-tab").forEach((tab) => tab.classList.toggle("is-selected", tab === button));
    $("#overview-custom-dates").hidden = selectedPeriod !== "custom";
    if (selectedPeriod === "custom") setDefaultRange("overview");
    renderOverview();
  }));
  $("#overview-channel").addEventListener("change", renderOverview);
  $("#analysis-channel").addEventListener("change", renderAnalysis);
  $("#analysis-period").addEventListener("change", (event) => {
    analysisPeriod = event.currentTarget.value;
    $("#analysis-custom-dates").hidden = analysisPeriod !== "custom";
    if (analysisPeriod === "custom") setDefaultRange("analysis");
    renderAnalysis();
  });
  ["#overview-start", "#overview-end"].forEach((selector) => $(selector).addEventListener("change", renderOverview));
  ["#analysis-start", "#analysis-end"].forEach((selector) => $(selector).addEventListener("change", renderAnalysis));
  $("#open-report").addEventListener("click", openReportDialog);
  $("#meta-connect").addEventListener("click", () => {
    window.location.assign("/oauth/meta/start");
  });
  $("#meta-disconnect").addEventListener("click", async () => {
    const button = $("#meta-disconnect");
    button.disabled = true;
    try {
      const response = await fetch("/api/meta/disconnect", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("disconnect_failed");
      await refreshMetaConnection();
      showToast("Account Meta scollegato.");
    } catch {
      showToast("Non è stato possibile scollegare l'account Meta.");
    } finally {
      button.disabled = false;
    }
  });
  $$('[data-open-report]').forEach((button) => button.addEventListener("click", openReportDialog));
  $("#report-form").addEventListener("submit", (event) => {
    event.preventDefault();
    prepareReport(new FormData(event.currentTarget));
  });
  $("#export-calendar").addEventListener("click", exportCalendar);
  $("#add-appointment").addEventListener("click", openAppointmentDialog);
  $("#appointment-form").addEventListener("submit", handleAppointmentSubmit);
  $("#add-scheduled-content").addEventListener("click", openContentDialog);
  $("#content-form").addEventListener("submit", handleContentSubmit);
  $$(".close-dialog").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $$('[data-calendar-shift]').forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.calendarTarget;
    const mode = calendarModes[type];
    calendarOffsets[type][mode] += Number(button.dataset.calendarShift);
    renderCalendar(type);
  }));
  $$('[data-calendar-today]').forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.calendarToday;
    calendarOffsets[type] = { week: 0, month: 0 };
    renderCalendar(type);
  }));
  $$(".calendar-view-button").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.calendarTarget;
    calendarModes[type] = button.dataset.calendarView;
    $$(`.calendar-view-button[data-calendar-target="${type}"]`).forEach((view) => view.classList.toggle("is-selected", view === button));
    renderCalendar(type);
  }));
  document.addEventListener("click", (event) => {
    const appointmentButton = event.target.closest("[data-remove-appointment]");
    if (appointmentButton) removeAppointment(appointmentButton.dataset.removeAppointment);
    const contentButton = event.target.closest("[data-remove-content]");
    if (contentButton) removeScheduledContent(contentButton.dataset.removeContent);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") $$("dialog[open]").forEach((dialog) => dialog.close());
  });
  window.addEventListener("afterprint", () => showToast("Il report è pronto per essere salvato in PDF."));
}

function setDefaultRange(kind) {
  const end = dateOnly(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const startSelector = kind === "analysis" ? "#analysis-start" : "#overview-start";
  const endSelector = kind === "analysis" ? "#analysis-end" : "#overview-end";
  if (!$(startSelector).value) $(startSelector).value = dateInputValue(start);
  if (!$(endSelector).value) $(endSelector).value = dateInputValue(end);
}

function seedAppointments() {
  const existing = getAppointmentStore();
  if (existing.length) return;
  const today = dateOnly(new Date());
  const monday = mondayOfWeek(today);
  const samples = [
    { day: 0, time: "10:30", title: "Piano editoriale", client: "Cliente X", channel: "Instagram" },
    { day: 1, time: "12:00", title: "Revisione reel", client: "Cliente Y", channel: "TikTok" },
    { day: 2, time: "09:30", title: "Call mensile", client: "Cliente W", channel: "Studio" },
    { day: 3, time: "15:00", title: "Report performance", client: "Cliente Z", channel: "Facebook" },
    { day: 4, time: "11:00", title: "Shooting contenuti", client: "Cliente X", channel: "Instagram" }
  ];
  const demo = samples.map((item) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + item.day);
    return { ...item, id: crypto.randomUUID(), date: dateInputValue(date) };
  });
  try { localStorage.setItem("bynor-appointments", JSON.stringify(demo)); }
  catch { /* Calendar remains available for this session. */ }
}

seedAppointments();
bindEvents();
setDemoState();
refreshMetaConnection();
handleMetaRedirect();