import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('kantinPos', {
  appName: 'Kantin Barkod POS',
  version: '3.0.0',
})
