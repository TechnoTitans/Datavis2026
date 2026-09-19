import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { Moon, Sun } from 'lucide-react'
import { getCurrentTheme, setThemePreference } from '../lib/theme'

const navItems = [
  { to: '/team-data', label: 'Team', title: 'Team Data' },
  { to: '/qual-data', label: 'Qual', title: 'Qual Data' },
  { to: '/pit-scouting-data', label: 'Pit', title: 'Pit Scouting Data' },
  { to: '/prescouting-data', label: 'Pre', title: 'Prescouting Data' },
  { to: '/TBA-data', label: 'TBA', title: 'TBA Data' },
  { to: '/compare', label: 'Compare', title: 'Compare' },
  { to: '/defense', label: 'Defense', title: 'Defense' },
  { to: '/shooter', label: 'Shoot', title: 'Shooter / Ferrying' },
  { to: '/team-analysis', label: 'Analysis', title: 'Team Analysis' },
  { to: '/auto-paths', label: 'Autos', title: 'Auto Paths' },
  { to: '/picklist', label: 'Picklist', title: 'Picklist' },
  { to: '/upload', label: 'Upload', title: 'Upload' },
  { to: '/settings', label: 'Settings', title: 'Settings' },
]

function NavItem({ item, onNavigate, isOn }) {
  return (
    <NavLink
      to={item.to}
      title={item.title}
      onClick={onNavigate}
      className={() => ['nav-chip', isOn ? 'nav-chip-active' : ''].join(' ')}
    >
      {item.label}
    </NavLink>
  )
}

function Layout({ children }) {
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => getCurrentTheme() === 'dark')
  const location = useLocation()

  const isItemOn = (item) => {
    if (item.to === '/team-data') {
      return location.pathname === '/' || location.pathname === '/team-data'
    }
    return location.pathname === item.to
  }

  useEffect(() => {
    const syncTheme = () => setIsDark(getCurrentTheme() === 'dark')
    window.addEventListener('themechange', syncTheme)
    window.addEventListener('storage', syncTheme)
    return () => {
      window.removeEventListener('themechange', syncTheme)
      window.removeEventListener('storage', syncTheme)
    }
  }, [])

  const status = (
    <>
      {!isOnline ? <span className="glass-icon-btn">Offline</span> : null}
      {pendingCount > 0 ? (
        <button
          type="button"
          className="glass-icon-btn tabular-nums"
          onClick={syncNow}
          disabled={!isOnline || syncing}
          title="Sync queued changes"
        >
          Sync {pendingCount}
        </button>
      ) : null}
      <button
        type="button"
        className="glass-icon-btn h-8 w-8 px-0"
        onClick={() => setThemePreference(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </button>
    </>
  )

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="glass-grain" aria-hidden="true" />

      <header className="sticky top-0 z-40 flex justify-center px-3 pt-3">
        <div className="glass-nav flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-0.5 rounded-full py-1 pl-3 pr-1.5">
          <NavLink
            to="/"
            end
            onClick={() => setMenuOpen(false)}
            className="relative z-10 shrink-0 pr-2 text-[14px] font-semibold tracking-tight text-foreground"
          >
            DataVis
          </NavLink>

          <span className="nav-rule hidden md:block" aria-hidden="true" />

          <nav className="no-scrollbar relative z-10 hidden min-w-0 items-center overflow-x-auto md:flex">
            {navItems.map(item => (
              <NavItem key={item.to} item={item} isOn={isItemOn(item)} onNavigate={() => setMenuOpen(false)} />
            ))}
          </nav>

          <span className="nav-rule hidden md:block" aria-hidden="true" />

          <div className="relative z-10 hidden shrink-0 items-center gap-0.5 md:flex">{status}</div>

          <div className="relative z-10 flex items-center gap-0.5 md:hidden">
            {status}
            <button
              type="button"
              className="glass-icon-btn"
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="sticky top-[3.4rem] z-40 flex justify-center px-3 pt-2 md:hidden">
          <div className="glass-menu grid w-full max-w-sm gap-1 rounded-[22px] px-2 py-2">
            {navItems.map(item => (
              <NavItem key={item.to} item={item} isOn={isItemOn(item)} onNavigate={() => setMenuOpen(false)} />
            ))}
          </div>
        </div>
      ) : null}

      <main className="relative z-10 mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 md:px-6 md:py-7">
        {children}
      </main>
    </div>
  )
}

export default Layout
