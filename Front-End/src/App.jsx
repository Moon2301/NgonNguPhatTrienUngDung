import { Route, Routes } from 'react-router-dom'
import './App.css'
import Layout from './layout/Layout.jsx'
import { RequireAdmin, RequireAuth } from './components/RequireAuth.jsx'

import HomePage from './pages/HomePage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import UpcomingPage from './pages/UpcomingPage.jsx'
import NewsPage from './pages/NewsPage.jsx'
import NewsDetailPage from './pages/NewsDetailPage.jsx'
import PromotionsPage from './pages/PromotionsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import CinemaPage from './pages/CinemaPage.jsx'
import { useAuth } from './context/useAuth.js'

const navClass = ({ isActive }) => (isActive ? 'active' : '')
import MovieDetailPage from './pages/MovieDetailPage.jsx'
import BookingPage from './pages/BookingPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import VnpayReturnPage from './pages/VnpayReturnPage.jsx'
import BookingSuccessPage from './pages/BookingSuccessPage.jsx'
import MyTicketsPage from './pages/MyTicketsPage.jsx'
import TicketMarketPage from './pages/TicketMarketPage.jsx'
import TicketPostPage from './pages/TicketPostPage.jsx'
import TicketDetailPage from './pages/TicketDetailPage.jsx'
import MyPassesPage from './pages/MyPassesPage.jsx'
import DatingProfilePage from './pages/DatingProfilePage.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminMovies from './pages/AdminMovies.jsx'
import AdminShowtimes from './pages/AdminShowtimes.jsx'
import AdminBookings from './pages/AdminBookings.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="upcoming" element={<UpcomingPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="news/:id" element={<NewsDetailPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="movie/:id" element={<MovieDetailPage />} />
        <Route path="booking/:showtimeId" element={<BookingPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="payment/vnpay-return" element={<VnpayReturnPage />} />
        <Route path="booking/success" element={<BookingSuccessPage />} />

        <Route
          path="my-tickets"
          element={
            <RequireAuth>
              <MyTicketsPage />
            </RequireAuth>
          }
        />
        <Route path="ticket-market" element={<TicketMarketPage />} />
        <Route
          path="ticket/post"
          element={
            <RequireAuth>
              <TicketPostPage />
            </RequireAuth>
          }
        />
        <Route path="ticket/:id" element={<TicketDetailPage />} />
        <Route
          path="my-passes"
          element={
            <RequireAuth>
              <MyPassesPage />
            </RequireAuth>
          }
        />

          <div className="pele-nav-links">
            <NavLink to="/" end className={navClass}>
              Trang chủ
            </NavLink>
            <NavLink to="/cinema" className={navClass}>
              Rạp & Suất chiếu
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
              <button
                type="button"
                className="btn-clear"
                onClick={() => logout()}
                style={{ padding: '8px 14px', borderRadius: 8 }}
              >
                Đăng xuất
              </button>
            )}
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cinema" element={<CinemaPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </div>
  )
}
        <Route
          path="dating-profile"
          element={
            <RequireAuth>
              <DatingProfilePage />
            </RequireAuth>
          }
        />

        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/movies"
          element={
            <RequireAdmin>
              <AdminMovies />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/showtimes"
          element={
            <RequireAdmin>
              <AdminShowtimes />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/bookings"
          element={
            <RequireAdmin>
              <AdminBookings />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAdmin>
              <AdminUsers />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
