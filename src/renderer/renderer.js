const translations = {
  ru: {
    subtitle: "Управление локальными сайтами, портами и dev-серверами.",
    language: "Язык",
    scanPorts: "Найти порты",
    refresh: "Обновить",
    newProject: "Новый проект",
    editProject: "Редактирование",
    name: "Название",
    namePlaceholder: "Например, React сайт",
    port: "Порт",
    folder: "Папка проекта",
    chooseFolder: "Выбрать папку",
    command: "Команда запуска",
    save: "Сохранить",
    clear: "Очистить",
    hint: "Для Vite часто подходит команда <code>npm run dev -- --host 127.0.0.1 --port {port}</code>. Значение <code>{port}</code> подставится автоматически.",
    projects: "Проекты",
    foundPorts: "Найденные порты",
    open: "Открыть",
    start: "Вкл",
    restart: "Перезагрузить",
    stop: "Выкл",
    edit: "Редактировать",
    folderBtn: "Папка",
    kill: "Убить порт",
    killProcess: "Остановить",
    remove: "Удалить",
    running: "Запущен",
    starting: "Запуск",
    busy: "Занят",
    stopped: "Остановлен",
    emptyProjects: "Добавьте первый проект слева: название, порт, папку и команду запуска.",
    emptyPorts: "Занятые локальные порты не найдены.",
    summary: (total, running) => `${total} проектов, ${running} запущено`,
    portsSummary: (total) => `${total} найдено`,
    portMeta: (project) => `Порт ${project.port} · ${project.cwd}${project.status.pid ? ` · PID ${project.status.pid}` : ""}${project.status.processName ? ` · ${project.status.processName}` : ""}`,
    discoveredMeta: (port) => `${port.address || "127.0.0.1"} · PID ${port.pid || "?"}${port.processName ? ` · ${port.processName}` : ""}`,
    saved: "Проект сохранен.",
    started: "Сервер запущен.",
    stoppedToast: "Сервер остановлен.",
    restarted: "Сервер перезапущен.",
    killed: "Процесс на порту остановлен.",
    removed: "Проект удален.",
    refreshed: "Список обновлен.",
    unknownError: "Что-то пошло не так."
  },
  en: {
    subtitle: "Manage local sites, ports, and development servers.",
    language: "Language",
    scanPorts: "Scan ports",
    refresh: "Refresh",
    newProject: "New project",
    editProject: "Editing",
    name: "Name",
    namePlaceholder: "For example, React site",
    port: "Port",
    folder: "Project folder",
    chooseFolder: "Choose folder",
    command: "Start command",
    save: "Save",
    clear: "Clear",
    hint: "For Vite, this often works: <code>npm run dev -- --host 127.0.0.1 --port {port}</code>. The <code>{port}</code> value is inserted automatically.",
    projects: "Projects",
    foundPorts: "Found ports",
    open: "Open",
    start: "Start",
    restart: "Restart",
    stop: "Stop",
    edit: "Edit",
    folderBtn: "Folder",
    kill: "Kill port",
    killProcess: "Stop",
    remove: "Remove",
    running: "Running",
    starting: "Starting",
    busy: "Busy",
    stopped: "Stopped",
    emptyProjects: "Add the first project on the left: name, port, folder, and start command.",
    emptyPorts: "No occupied local ports found.",
    summary: (total, running) => `${total} projects, ${running} running`,
    portsSummary: (total) => `${total} found`,
    portMeta: (project) => `Port ${project.port} · ${project.cwd}${project.status.pid ? ` · PID ${project.status.pid}` : ""}${project.status.processName ? ` · ${project.status.processName}` : ""}`,
    discoveredMeta: (port) => `${port.address || "127.0.0.1"} · PID ${port.pid || "?"}${port.processName ? ` · ${port.processName}` : ""}`,
    saved: "Project saved.",
    started: "Server started.",
    stoppedToast: "Server stopped.",
    restarted: "Server restarted.",
    killed: "Port process stopped.",
    removed: "Project removed.",
    refreshed: "List refreshed.",
    unknownError: "Something went wrong."
  }
};

let language = "ru";
let projects = [];
let ports = [];
let editingId = null;

const els = {
  list: document.querySelector("#projectList"),
  portsList: document.querySelector("#portsList"),
  summary: document.querySelector("#summary"),
  portsSummary: document.querySelector("#portsSummary"),
  template: document.querySelector("#projectTemplate"),
  portTemplate: document.querySelector("#portTemplate"),
  toast: document.querySelector("#toast"),
  formTitle: document.querySelector("#formTitle"),
  language: document.querySelector("#languageSelect"),
  name: document.querySelector("#nameInput"),
  port: document.querySelector("#portInput"),
  cwd: document.querySelector("#cwdInput"),
  command: document.querySelector("#commandInput"),
  save: document.querySelector("#saveBtn"),
  clear: document.querySelector("#clearBtn"),
  folder: document.querySelector("#folderBtn"),
  refresh: document.querySelector("#refreshBtn"),
  scan: document.querySelector("#scanBtn")
};

function t(key, ...args) {
  const value = translations[language][key] ?? translations.ru[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function applyLanguage() {
  document.documentElement.lang = language;
  els.language.value = language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.placeholder);
  });
  document.querySelectorAll("[data-title]").forEach((node) => {
    node.title = t(node.dataset.title);
  });
  els.formTitle.textContent = editingId ? t("editProject") : t("newProject");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("visible"), 3600);
}

function setBusy(isBusy) {
  document.querySelectorAll("button, select").forEach((control) => {
    control.disabled = isBusy;
  });
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  language = snapshot.language || "ru";
  projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  ports = Array.isArray(snapshot.ports) ? snapshot.ports : [];
  applyLanguage();
  render();
}

async function run(action, successText) {
  try {
    setBusy(true);
    applySnapshot(await action());
    if (successText) toast(successText);
  } catch (error) {
    toast(error.message || t("unknownError"));
  } finally {
    setBusy(false);
    render();
  }
}

async function refresh(successText = "") {
  await run(async () => window.portManager.list(), successText);
}

function clearForm() {
  editingId = null;
  els.formTitle.textContent = t("newProject");
  els.name.value = "";
  els.port.value = "";
  els.cwd.value = "";
  els.command.value = "";
}

function fillForm(project) {
  editingId = project.id;
  els.formTitle.textContent = t("editProject");
  els.name.value = project.name;
  els.port.value = project.port;
  els.cwd.value = project.cwd;
  els.command.value = project.command;
}

function projectFromForm() {
  return {
    id: editingId,
    name: els.name.value,
    port: Number(els.port.value),
    cwd: els.cwd.value,
    command: els.command.value
  };
}

function renderProjects() {
  els.list.innerHTML = "";
  const running = projects.filter((project) => project.status.state === "running").length;
  els.summary.textContent = projects.length ? t("summary", projects.length, running) : "";

  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("emptyProjects");
    els.list.append(empty);
    return;
  }

  for (const project of projects) {
    const card = els.template.content.firstElementChild.cloneNode(true);
    const status = project.status;
    card.dataset.id = project.id;
    card.querySelector("h3").textContent = project.name;

    card.querySelectorAll("[data-action-label]").forEach((node) => {
      node.textContent = t(node.dataset.actionLabel);
    });

    const badge = card.querySelector(".status");
    badge.textContent = t(status.state);
    badge.classList.add(status.state);

    card.querySelector(".meta").textContent = t("portMeta", project);
    card.querySelector(".command").textContent = project.command;
    card.querySelector(".logs").textContent = (status.logs || []).join("").slice(-12000);

    const isRunning = status.state === "running" || status.state === "starting";
    const isBusy = status.state === "busy";
    card.querySelector('[data-action="open"]').disabled = !(isRunning || isBusy);
    card.querySelector('[data-action="start"]').disabled = isRunning || isBusy;
    card.querySelector('[data-action="restart"]').disabled = !isRunning;
    card.querySelector('[data-action="stop"]').disabled = !isRunning;
    card.querySelector('[data-action="kill"]').disabled = !status.pid;

    els.list.append(card);
  }
}

function renderPorts() {
  els.portsList.innerHTML = "";
  const projectPorts = new Set(projects.map((project) => Number(project.port)));
  const discovered = ports.filter((port) => !projectPorts.has(Number(port.port)));
  els.portsSummary.textContent = discovered.length ? t("portsSummary", discovered.length) : "";

  if (!discovered.length) {
    const empty = document.createElement("div");
    empty.className = "empty compact";
    empty.textContent = t("emptyPorts");
    els.portsList.append(empty);
    return;
  }

  for (const port of discovered) {
    const card = els.portTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.pid = port.pid;
    card.dataset.port = port.port;
    card.querySelectorAll("[data-action-label]").forEach((node) => {
      node.textContent = t(node.dataset.actionLabel);
    });
    card.querySelector(".port-title").textContent = `:${port.port}`;
    card.querySelector(".port-meta").textContent = t("discoveredMeta", port);
    els.portsList.append(card);
  }
}

function render() {
  applyLanguage();
  renderProjects();
  renderPorts();
}

els.save.addEventListener("click", () => {
  run(async () => {
    const result = await window.portManager.save(projectFromForm());
    clearForm();
    return result;
  }, t("saved"));
});

els.clear.addEventListener("click", clearForm);
els.refresh.addEventListener("click", () => refresh(t("refreshed")));
els.scan.addEventListener("click", () => refresh(t("refreshed")));

els.language.addEventListener("change", () => {
  run(() => window.portManager.setLanguage(els.language.value));
});

els.folder.addEventListener("click", async () => {
  const folder = await window.portManager.chooseFolder();
  if (folder) els.cwd.value = folder;
});

els.list.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const card = event.target.closest(".project-card");
  if (!button || !card) return;

  const project = projects.find((item) => item.id === card.dataset.id);
  if (!project) return;

  const action = button.dataset.action;
  if (action === "edit") fillForm(project);
  if (action === "open") window.portManager.openUrl(`http://127.0.0.1:${project.port}`);
  if (action === "folder") window.portManager.openFolder(project.cwd);
  if (action === "start") run(() => window.portManager.start(project.id), t("started"));
  if (action === "stop") run(() => window.portManager.stop(project.id), t("stoppedToast"));
  if (action === "restart") run(() => window.portManager.restart(project.id), t("restarted"));
  if (action === "kill") run(() => window.portManager.kill(project.status.pid), t("killed"));
  if (action === "remove") run(() => window.portManager.remove(project.id), t("removed"));
});

els.portsList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const card = event.target.closest(".port-card");
  if (!button || !card) return;

  const port = Number(card.dataset.port);
  const pid = Number(card.dataset.pid);
  const action = button.dataset.portAction;
  if (action === "open") window.portManager.openUrl(`http://127.0.0.1:${port}`);
  if (action === "kill") run(() => window.portManager.kill(pid), t("killed"));
});

window.portManager.onLog(({ id, text }) => {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  project.status.logs = project.status.logs || [];
  project.status.logs.push(text);
  render();
});

window.portManager.onStatusChanged(() => refresh());

refresh();
setInterval(refresh, 5000);
