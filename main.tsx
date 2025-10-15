import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { BLEProvider } from './contexts/BLEContext'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BLEProvider>
      <App />
    </BLEProvider>
  </React.StrictMode>,
)
