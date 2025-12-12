import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { BLEProvider } from './contexts/BLEContext'
import { GameProvider } from './contexts/GameContext'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BLEProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </BLEProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
