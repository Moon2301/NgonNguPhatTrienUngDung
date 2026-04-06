import { Link, Route, Routes } from "react-router-dom";

import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <div className="brand">
          <span className="brand__dot" />
          <span>NNPUD</span>
        </div>
        <nav className="nav">
          <Link to="/">Trang chủ</Link>
          <Link to="/register">Đăng ký</Link>
          <Link to="/login">Đăng nhập</Link>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  );
}

