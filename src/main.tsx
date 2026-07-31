import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { ShiftProvider } from '@/context/ShiftContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { applyDocumentTheme, readStoredTheme } from '@/theme/theme'
import './index.css'

applyDocumentTheme(readStoredTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <ShiftProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </ShiftProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
