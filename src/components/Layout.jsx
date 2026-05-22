import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { path: '/projects', label: 'Projects', icon: 'ti-plant' },
  { path: '/transactions', label: 'Transactions', icon: 'ti-arrows-exchange' },
  { path: '/reports', label: 'Reports', icon: 'ti-chart-bar' },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
    : '?'

  function handleNav(path) {
    navigate(path)
    setSidebarOpen(false)
  }

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:99}}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="icon-wrap"><i className="ti ti-plant"></i></div>
            <div>
              <div className="app-name">Farm Ledger</div>
              <div className="app-sub">Finance Tracker</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Menu</div>
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <i className={`ti ${item.icon}`}></i>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{profile?.full_name || 'User'}</div>
            <div className="user-role">{profile?.role || 'member'}</div>
          </div>
          <button className="btn-logout" onClick={signOut} title="Sign out">
            <i className="ti ti-logout" style={{fontSize:'16px'}}></i>
          </button>
        </div>
      </aside>

      <main className="main">
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <i className="ti ti-menu-2"></i>
          </button>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'24px',height:'24px',background:'var(--green-mid)',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <i className="ti ti-plant" style={{color:'#fff',fontSize:'13px'}}></i>
            </div>
            <span style={{fontWeight:'600',fontSize:'15px'}}>Farm Ledger</span>
          </div>
          <div className="user-avatar" style={{width:'28px',height:'28px',fontSize:'11px'}}>{initials}</div>
        </div>

        <Outlet />
      </main>
    </div>
  )
}
