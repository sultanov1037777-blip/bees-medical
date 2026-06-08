const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");
const form = document.querySelector("#appointmentForm");
const queueBoard = document.querySelector("#queueBoard");
const queueUpdated = document.querySelector("#queueUpdated");
const queueTotal = document.querySelector("#queueTotal");
const queueWaiting = document.querySelector("#queueWaiting");
const queueScheduled = document.querySelector("#queueScheduled");

const storageKey = "beesMedicalRequests";

const doctorNames = {
  sultanov: "Sultanov Zaxiriddin Faxriddinovich",
  zokirov: "Botir Zokirov",
  nomonjonov: "Baxodirjon Nomonjonov",
};

function loadRequests() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch (error) {
    return [];
  }
}

function saveRequests(requests) {
  localStorage.setItem(storageKey, JSON.stringify(requests));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function nextQueueNumber(requests) {
  const today = todayKey();
  const todayRequests = requests.filter((item) => item.queueDate === today);
  return todayRequests.length + 1;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function renderQueue() {
  if (!queueBoard) return;

  let state;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    state = await response.json();
  } catch (error) {
    queueBoard.innerHTML = '<div class="queue-empty">Online navbat serveri bilan aloqa yo\'q.</div>';
    return;
  }

  const rows = state.rows || [];
  const waiting = rows.filter((item) => item.status === "Kutilmoqda");
  const scheduled = rows.filter((item) => item.estimatedTime);

  queueTotal.textContent = String(rows.length);
  queueWaiting.textContent = String(waiting.length);
  queueScheduled.textContent = String(scheduled.length);
  queueUpdated.textContent = new Date().toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!rows.length) {
    queueBoard.innerHTML = '<div class="queue-empty">Hozircha bugungi navbatda ariza yo\'q.</div>';
    return;
  }

  queueBoard.innerHTML = `
    <article class="queue-doctor">
      <div class="queue-doctor-top">
        <div>
          <span>${escapeHtml(state.room)}</span>
          <h3>${escapeHtml(state.doctor)}</h3>
        </div>
        <strong>${escapeHtml(state.currentPatient?.number || state.number)}</strong>
      </div>
      <div class="queue-list">
        ${rows
          .slice(0, 12)
          .map(
            (item) => `
              <div class="queue-row">
                <span>${escapeHtml(item.number)}</span>
                <strong>${escapeHtml(item.surname)}</strong>
                <em>${escapeHtml(item.estimatedTime)} | ${escapeHtml(item.status)}</em>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

menuButton.addEventListener("click", () => {
  const isOpen = header.classList.toggle("nav-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("nav-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".doctor-card[data-doctor]").forEach((card) => {
  const selectDoctor = () => {
    const doctorSelect = form.querySelector('select[name="doctor"]');
    doctorSelect.value = card.dataset.doctor;
    document.querySelector("#appointment").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => form.querySelector('input[name="name"]').focus(), 450);
  };

  card.addEventListener("click", selectDoctor);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDoctor();
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const doctorId = data.get("doctor").toString();
  const requests = loadRequests();
  const queueNumber = nextQueueNumber(requests);
  const request = {
    id: `BM-${Date.now()}`,
    createdAt: new Date().toISOString(),
    queueDate: todayKey(),
    queueNumber,
    name: data.get("name").toString().trim(),
    phone: data.get("phone").toString().trim(),
    jshshir: data.get("jshshir").toString().trim(),
    misConsent: data.get("misConsent") === "on",
    service: data.get("service").toString(),
    doctorId,
    doctorName: doctorNames[doctorId],
    status: "Yangi",
    misStatus: "MIS tekshiruv kutilyapti",
    paymentStatus: "To'lov kutilyapti",
    appointmentTime: "",
  };
  requests.unshift(request);
  saveRequests(requests);

  const status = form.querySelector(".form-status");
  const name = request.name.split(" ")[0] || "Mijoz";
  status.textContent = `${name}, arizangiz qabul qilindi. Tez orada bog'lanamiz.`;
  form.reset();
  renderQueue();
});

renderQueue();
setInterval(renderQueue, 60000);
if (queueBoard) {
  const queueEvents = new EventSource("/api/events");
  queueEvents.onmessage = () => renderQueue();
}
