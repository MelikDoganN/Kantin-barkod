import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('kantinPos', {
  appName: 'Kantin Barkod POS',
  version: '1.0.0',
  saveDatabasePassword: (password: string) =>
    ipcRenderer.invoke('db-credentials:save', password) as Promise<{ ok: boolean; error?: string }>,
})
