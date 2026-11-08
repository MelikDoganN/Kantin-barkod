import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('kantinPos', {
  appName: 'Kantin Barkod POS',
  version: '2.0.0',
})
