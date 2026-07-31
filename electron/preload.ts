import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('kantinPos', {
  appName: 'Kantin POS',
  version: '1.0.0',
})
