import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import './layout.css'

const navClass = ({ isActive }) => (isActive ? 'active' : '')

export default function Layout() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [navScrolled, setNavScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const lastScrollYRef = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0
      setNavScrolled(y > 8)

      const last = lastScrollYRef.current
      const dy = y - last
      lastScrollYRef.current = y

      // Ở gần top thì luôn hiện
      if (y < 40) {
        setNavHidden(false)
        return
      }

      // Cuộn xuống đủ ngưỡng → ẩn; cuộn lên → hiện
      if (dy > 10) setNavHidden(true)
      else if (dy < -8) setNavHidden(false)
    }
    window.addEventListener('scroll', onScroll)
    // init
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
  }, [sidebarOpen])

  function submitSearch(e) {
    e.preventDefault()
    const q = searchQ.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}`)
    setSidebarOpen(false)
  }

  return (
    <div className="layout-root">
      <nav className={`pele-navbar ${navScrolled ? 'scrolled' : ''} ${navHidden ? 'hidden' : ''}`}>
        <div className="pele-navbar-inner">
          <div className="pele-navbar-left">
            <button
              type="button"
              className="btn-menu-hamburger"
              aria-label="Mở menu"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="fa-solid fa-bars" />
            </button>

            <Link to="/" className="pele-logo">
              <span className="pele-logo-mark">
                <i className="fa-solid fa-film" />
              </span>
              <span className="pele-logo-text">
                PELE<span>Cinema</span>
              </span>
            </Link>

            <form className="pele-search-form pele-search-desktop" onSubmit={submitSearch}>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Tìm phim..."
                aria-label="Tìm phim"
              />
              <button type="submit" className="btn-search" aria-label="Tìm">
                <i className="fa-solid fa-magnifying-glass" />
              </button>
            </form>
          </div>

          <div className="pele-navbar-center pele-nav-center">
            <ul className="pele-nav-links">
              <li>
                <NavLink to="/" end className={navClass}>
                  <i className="fa-solid fa-house" />
                  Trang Chủ
                </NavLink>
              </li>
              <li>
                <NavLink to="/upcoming" className={navClass}>
                  <i className="fa-solid fa-calendar-days" />
                  Phim Sắp Chiếu
                </NavLink>
              </li>
              <li>
                <NavLink to="/news" className={navClass}>
                  <i className="fa-solid fa-newspaper" />
                  Tin Tức
                </NavLink>
              </li>
              <li className="nav-sep" aria-hidden="true" />
              <li>
                <NavLink to="/promotions" className={({ isActive }) => `text-warn ${isActive ? 'active' : ''}`}>
                  <i className="fa-solid fa-gift" />
                  Khuyến Mãi
                </NavLink>
              </li>
              {user && (
                <li>
                  <NavLink to="/my-tickets" className={navClass}>
                    <i className="fa-solid fa-ticket-simple" />
                    Vé Của Tôi
                  </NavLink>
                </li>
              )}
              {user?.role === 'ADMIN' && (
                <li>
                  <NavLink to="/admin" className={({ isActive }) => `text-admin ${isActive ? 'active' : ''}`}>
                    <i className="fa-solid fa-user-shield" />
                    Quản Trị
                  </NavLink>
                </li>
              )}
            </ul>
          </div>

          <div className="pele-navbar-right">
            {!user && (
              <Link className="btn-login-nav" to="/login">
                <i className="fa-solid fa-right-to-bracket" />
                ĐĂNG NHẬP
              </Link>
            )}

            {user && (
              <>
                <div className="user-mini">
                  <div className="user-avatar-nav">{(user.fullName || user.username || '?').charAt(0)}</div>
                  <span className="user-name-nav hide-xs">{user.fullName || user.username}</span>
                  <span className="user-name-nav hide-xs" style={{ opacity: 0.9, fontWeight: 800 }}>
                    · {Number(user.wallet || 0).toLocaleString('vi-VN')}đ
                  </span>
                  <div className={`dropdown-wrap ${dropdownOpen ? 'open' : ''}`}>
                    <button type="button" onClick={() => setDropdownOpen((v) => !v)} aria-expanded={dropdownOpen}>
                      <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.65rem' }} />
                    </button>
                    <div className="dropdown-menu-pele">
                      <Link to="/profile" onClick={() => setDropdownOpen(false)}>
                        <i className="fa-solid fa-user-pen" style={{ color: '#ff6b6b' }} />
                        Hồ sơ
                      </Link>
                      <Link to="/my-tickets" onClick={() => setDropdownOpen(false)}>
                        <i className="fa-solid fa-ticket" style={{ color: '#5ce08a' }} />
                        Vé Đã Đặt
                      </Link>
                      <Link to="/my-passes" onClick={() => setDropdownOpen(false)}>
                        <i className="fa-solid fa-tag" style={{ color: '#ffc107' }} />
                        Vé Đang Bán Của Tôi
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false)
                          logout()
                          navigate('/')
                        }}
                      >
                        <i className="fa-solid fa-power-off" style={{ color: '#ff6b6b' }} />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
        role="presentation"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`pele-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h5>
              <i className="fa-solid fa-clapperboard" /> MENU
            </h5>
            {user && <small style={{ color: '#888', fontSize: '0.7rem' }}>{user.fullName}</small>}
          </div>
          <button type="button" className="btn-close-side" onClick={() => setSidebarOpen(false)} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="sidebar-body">
          <div className="sidebar-heading">Trải nghiệm đặc biệt</div>
          <Link className="sidebar-nav-link accent-gold" to="/ticket-market" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-tags" />
            Chợ Pass Vé
          </Link>

          <div className="sidebar-heading">Khám phá</div>
          <Link className="sidebar-nav-link" to="/" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-house" />
            Trang Chủ
          </Link>
          <Link className="sidebar-nav-link" to="/upcoming" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-calendar-days" />
            Phim Sắp Chiếu
          </Link>
          <Link className="sidebar-nav-link" to="/news" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-newspaper" />
            Tin Tức
          </Link>
          <Link className="sidebar-nav-link" to="/promotions" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-gift" style={{ color: '#ffc107' }} />
            Khuyến Mãi
          </Link>

          {user && (
            <>
              <div className="sidebar-heading">Tài khoản</div>
              <Link className="sidebar-nav-link" to="/my-tickets" onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-ticket-simple" />
                Vé Đã Đặt
              </Link>
              <Link className="sidebar-nav-link" to="/my-passes" onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-tag" />
                Vé Đang Bán
              </Link>
              <Link className="sidebar-nav-link" to="/profile" onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-user-pen" />
                Hồ Sơ
              </Link>
              {user.role === 'ADMIN' && (
                <>
                  <div className="sidebar-heading">Quản trị</div>
                  <Link className="sidebar-nav-link accent-admin" to="/admin" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-user-shield" />
                    Trang Quản Trị
                  </Link>
                  <Link className="sidebar-nav-link accent-admin" to="/admin/movies" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-film" />
                    Quản Lý Phim
                  </Link>
                  <Link className="sidebar-nav-link accent-admin" to="/admin/showtimes" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-clock" />
                    Quản Lý Suất Chiếu
                  </Link>
                  <Link className="sidebar-nav-link accent-admin" to="/admin/seat" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-border-all" />
                    Sơ Đồ Ghế
                  </Link>
                  <Link className="sidebar-nav-link accent-admin" to="/admin/products" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-burger" />
                    Quản Lý Dịch Vụ
                  </Link>
                  <Link className="sidebar-nav-link accent-admin" to="/admin/bookings" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-receipt" />
                    Quản Lý Hóa Đơn
                  </Link>
                  <Link className="sidebar-nav-link accent-admin" to="/admin/users" onClick={() => setSidebarOpen(false)}>
                    <i className="fa-solid fa-users" />
                    Quản Lý Người Dùng
                  </Link>
                </>
              )}
            </>
          )}
        </div>

        {user ? (
          <div className="sidebar-auth">
            <div className="sidebar-user-card">
              <div className="avatar-lg">{(user.fullName || user.username || '?').charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                <div className="uname">@{user.username}</div>
                <div className="uname" style={{ marginTop: 2, color: 'rgba(255,255,255,0.85)' }}>
                  Số dư: {Number(user.wallet || 0).toLocaleString('vi-VN')}đ
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-logout-full"
              onClick={() => {
                setSidebarOpen(false)
                logout()
                navigate('/')
              }}
            >
              <i className="fa-solid fa-power-off" /> ĐĂNG XUẤT
            </button>
          </div>
        ) : (
          <div className="sidebar-auth">
            <Link className="btn-side-primary" to="/login" onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-right-to-bracket" />
              ĐĂNG NHẬP
            </Link>
            <Link className="btn-side-secondary" to="/register" onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-user-plus" />
              ĐĂNG KÝ
            </Link>
          </div>
        )}
      </aside>

      <Outlet />
    </div>
  )
}
