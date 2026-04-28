const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("portManager", {
  list: () => ipcRenderer.invoke("projects:list"),
  save: (project) => ipcRenderer.invoke("projects:save", project),
  remove: (id) => ipcRenderer.invoke("projects:remove", id),
  start: (id) => ipcRenderer.invoke("projects:start", id),
  stop: (id) => ipcRenderer.invoke("projects:stop", id),
  restart: (id) => ipcRenderer.invoke("projects:restart-real", id),
  kill: (pid) => ipcRenderer.invoke("ports:kill", pid),
  setLanguage: (language) => ipcRenderer.invoke("settings:language", language),
  chooseFolder: () => ipcRenderer.invoke("dialog:folder"),
  openUrl: (url) => ipcRenderer.invoke("open:url", url),
  openFolder: (folder) => ipcRenderer.invoke("open:folder", folder),
  onLog: (callback) => ipcRenderer.on("project-log", (_event, payload) => callback(payload)),
  onStatusChanged: (callback) => ipcRenderer.on("status-changed", callback)
});
