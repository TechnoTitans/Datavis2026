import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'sonner'
import { getCurrentTheme, initializeTheme } from './utils/frontend/theme'

const initialTheme = initializeTheme()

export function Root() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    const syncTheme = () => {
      setTheme(getCurrentTheme())
    }

    window.addEventListener('themechange', syncTheme)
    window.addEventListener('storage', syncTheme)

    return () => {
      window.removeEventListener('themechange', syncTheme)
      window.removeEventListener('storage', syncTheme)
    }
  }, [])

  return (
    <>
      <App />
      <Toaster richColors theme={theme === 'dark' ? 'dark' : 'light'} position="top-right" />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
