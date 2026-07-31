# Portable Node.js (müşteri makinesinde Node kurulumu gerekmez)

```bash
npm run download:node
```

Bu komut Node 20 LTS (win-x64) indirir ve şuraya açar:

```
resources/runtime/node/node.exe
```

`npm run dist` bunu otomatik çalıştırır ve electron-builder
`extraResources` ile `resources/runtime/node` → `runtime/node` olarak paketler.

Electron `resolveNodeBinary()` önce bu yolu kullanır.
