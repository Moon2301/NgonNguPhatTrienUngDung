import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import BookingPage from './pages/BookingPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import SuccessPage from './pages/SuccessPage.jsx'
import MyTicketsPage from './pages/MyTicketsPage.jsx'
import TicketViewPage from './pages/TicketViewPage.jsx'
import { useAuth } from './context/useAuth.js'

const navClass = ({ isActive }) => (isActive ? 'active' : '')

function AppShell() {
  const { user, logout } = useAuth()
  return (
    <div className="app">
      <div className="pele-topbar">
        <strong>PELE Cinema</strong> — đặt vé nhanh, trải nghiệm mượt.
      </div>

      <nav className="pele-navbar">
        <div className="pele-navbar-inner">
          <a href="/" className="pele-logo">
            <span className="pele-logo-mark">
              <i className="fa-solid fa-film" />
            </span>
            <span className="pele-logo-text">
              PELE<span>Cinema</span>
            </span>
          </a>

          <div className="pele-nav-links">
            <NavLink to="/" end className={navClass}>
              Trang chủ
            </NavLink>
            {!user ? (
              <>
                <NavLink to="/login" className={navClass}>
                  Đăng nhập
                </NavLink>
                <NavLink to="/register" className={navClass}>
                  Đăng ký
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/my-tickets" className={navClass}>
                  Vé của tôi
                </NavLink>
                <button
                  type="button"
                  className="btn-clear"
                  onClick={() => logout()}
                  style={{ padding: '8px 14px', borderRadius: 8 }}
                >
                  Đăng xuất
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/booking/:showtimeId" element={<BookingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/booking/success" element={<SuccessPage />} />
        <Route path="/my-tickets" element={<MyTicketsPage />} />
        <Route path="/ticket/view/:bookingId" element={<TicketViewPage />} />
      </Routes>
    </div>
  )
}


export default function App() {
  return <AppShell />
}
