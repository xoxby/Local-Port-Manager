const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

const managed = new Map();
let mainWindow;
let configPath;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#101418",
    title: "Local Port Manager",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function ensureConfig() {
  configPath = path.join(app.getPath("userData"), "projects.json");
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ language: "ru", projects: [] }, null, 2));
  }
}

function readConfig() {
  ensureConfig();
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      language: parsed.language === "en" ? "en" : "ru",
      projects: Array.isArray(parsed.projects) ? parsed.projects : []
    };
  } catch {
    return { language: "ru", projects: [] };
  }
}

function writeConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProject(project) {
  return {
    id: project.id || uid(),
    name: String(project.name || "").trim(),
    port: Number(project.port),
    cwd: String(project.cwd || "").trim(),
    command: String(project.command || "").trim()
  };
}

function isValidProject(project) {
  return project.name && Number.isInteger(project.port) && project.port > 0 && project.port < 65536 && project.cwd && project.command;
}

function runPowerShell(args) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], { windowsHide: true }, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

async function getPortInfo(port) {
  const script = `Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 LocalPort,OwningProcess | ConvertTo-Json -Compress`;
  const result = await runPowerShell(["-Command", script]);
  const raw = result.stdout.trim();
  if (!raw) return null;

  try {
    const connection = JSON.parse(raw);
    const pid = Number(connection.OwningProcess);
    let processName = "";
    if (pid) {
      const proc = await runPowerShell(["-Command", `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -First 1 ProcessName | ConvertTo-Json -Compress`]);
      if (proc.stdout.trim()) {
        processName = JSON.parse(proc.stdout.trim()).ProcessName || "";
      }
    }
    return { port: Number(port), pid, processName };
  } catch {
    return null;
  }
}

async function scanPorts() {
  const script = `
$connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::', '::1') } |
  Sort-Object LocalPort, OwningProcess |
  Select-Object LocalAddress, LocalPort, OwningProcess -Unique

$connections | ForEach-Object {
  $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  $commandLine = ''
  try {
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" -ErrorAction Stop).CommandLine
  } catch {}

  [PSCustomObject]@{
    address = $_.LocalAddress
    port = $_.LocalPort
    pid = $_.OwningProcess
    processName = if ($process) { $process.ProcessName } else { '' }
    path = if ($process) { $process.Path } else { '' }
    commandLine = if ($commandLine) { $commandLine } else { '' }
  }
} | ConvertTo-Json -Compress
`;
  const result = await runPowerShell(["-Command", script]);
  const raw = result.stdout.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => ({
        address: String(row.address || ""),
        port: Number(row.port),
        pid: Number(row.pid),
        processName: String(row.processName || ""),
        path: String(row.path || ""),
        commandLine: String(row.commandLine || "")
      }))
      .filter((row) => Number.isInteger(row.port) && row.port > 0)
      .sort((a, b) => a.port - b.port);
  } catch {
    return [];
  }
}

function waitForPort(port, timeout = 10000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const probe = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeout) resolve(false);
        else setTimeout(probe, 350);
      });
    };
    probe();
  });
}

function commandFor(project) {
  return project.command.replaceAll("{port}", String(project.port));
}

function appendLog(id, chunk) {
  const entry = managed.get(id);
  if (!entry) return;
  entry.logs.push(chunk.toString());
  if (entry.logs.length > 220) entry.logs.splice(0, entry.logs.length - 220);
  mainWindow?.webContents.send("project-log", { id, text: chunk.toString() });
}

async function projectStatus(project) {
  const tracked = managed.get(project.id);
  const portInfo = await getPortInfo(project.port);
  if (tracked?.process && !tracked.process.killed) {
    return {
      state: portInfo ? "running" : "starting",
      pid: tracked.process.pid,
      processName: portInfo?.processName || "managed",
      logs: tracked.logs
    };
  }

  if (portInfo) {
    return {
      state: "busy",
      pid: portInfo.pid,
      processName: portInfo.processName,
      logs: tracked?.logs || []
    };
  }

  return { state: "stopped", pid: null, processName: "", logs: tracked?.logs || [] };
}

async function snapshot() {
  const config = readConfig();
  const projects = [];
  for (const project of config.projects) {
    projects.push({ ...project, status: await projectStatus(project) });
  }
  return {
    language: config.language,
    projects,
    ports: await scanPorts()
  };
}

async function stopProject(id) {
  const entry = managed.get(id);
  if (!entry?.process || entry.process.killed) return;

  await new Promise((resolve) => {
    const child = entry.process;
    const done = () => resolve();
    child.once("exit", done);
    execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {
      setTimeout(resolve, 250);
    });
    setTimeout(resolve, 3500);
  });
}

ipcMain.handle("projects:list", snapshot);

ipcMain.handle("settings:language", async (_event, language) => {
  const config = readConfig();
  config.language = language === "en" ? "en" : "ru";
  writeConfig(config);
  return snapshot();
});

ipcMain.handle("projects:save", async (_event, project) => {
  const normalized = normalizeProject(project);
  if (!isValidProject(normalized)) throw new Error("Заполните название, порт, папку и команду запуска.");
  if (!fs.existsSync(normalized.cwd)) throw new Error("Папка проекта не найдена.");

  const config = readConfig();
  const index = config.projects.findIndex((item) => item.id === normalized.id);
  if (index >= 0) config.projects[index] = normalized;
  else config.projects.push(normalized);
  writeConfig(config);
  return snapshot();
});

ipcMain.handle("projects:remove", async (_event, id) => {
  await stopProject(id);
  managed.delete(id);
  const config = readConfig();
  config.projects = config.projects.filter((project) => project.id !== id);
  writeConfig(config);
  return snapshot();
});

ipcMain.handle("projects:start", async (_event, id) => {
  const project = readConfig().projects.find((item) => item.id === id);
  if (!project) throw new Error("Проект не найден.");

  const current = await getPortInfo(project.port);
  if (current) throw new Error(`Порт ${project.port} уже занят процессом ${current.pid}.`);

  const command = commandFor(project);
  const child = spawn(command, {
    cwd: project.cwd,
    shell: true,
    windowsHide: true,
    env: { ...process.env, PORT: String(project.port) }
  });

  managed.set(id, { process: child, logs: [] });
  appendLog(id, `> ${command}\r\n`);
  child.stdout.on("data", (chunk) => appendLog(id, chunk));
  child.stderr.on("data", (chunk) => appendLog(id, chunk));
  child.on("exit", (code) => {
    appendLog(id, `\r\nProcess exited with code ${code ?? "unknown"}\r\n`);
    mainWindow?.webContents.send("status-changed");
  });

  await waitForPort(project.port, 9000);
  return snapshot();
});

ipcMain.handle("projects:stop", async (_event, id) => {
  await stopProject(id);
  return snapshot();
});

ipcMain.handle("projects:restart-real", async (_event, id) => {
  await stopProject(id);
  const project = readConfig().projects.find((item) => item.id === id);
  if (!project) throw new Error("Проект не найден.");
  const current = await getPortInfo(project.port);
  if (current) throw new Error(`Порт ${project.port} занят процессом ${current.pid}.`);
  const command = commandFor(project);
  const child = spawn(command, {
    cwd: project.cwd,
    shell: true,
    windowsHide: true,
    env: { ...process.env, PORT: String(project.port) }
  });
  managed.set(id, { process: child, logs: [] });
  appendLog(id, `> ${command}\r\n`);
  child.stdout.on("data", (chunk) => appendLog(id, chunk));
  child.stderr.on("data", (chunk) => appendLog(id, chunk));
  child.on("exit", (code) => {
    appendLog(id, `\r\nProcess exited with code ${code ?? "unknown"}\r\n`);
    mainWindow?.webContents.send("status-changed");
  });
  await waitForPort(project.port, 9000);
  return snapshot();
});

ipcMain.handle("ports:kill", async (_event, pid) => {
  if (!pid) throw new Error("PID не найден.");
  await new Promise((resolve) => {
    execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => resolve());
  });
  return snapshot();
});

ipcMain.handle("dialog:folder", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return result.canceled ? "" : result.filePaths[0];
});

ipcMain.handle("open:url", async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("open:folder", async (_event, folder) => {
  await shell.openPath(folder);
});

app.whenReady().then(() => {
  ensureConfig();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", async (event) => {
  if (managed.size === 0) return;
  event.preventDefault();
  for (const id of managed.keys()) await stopProject(id);
  managed.clear();
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
