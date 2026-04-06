import { Link, Route, Routes } from "react-router-dom";

import { HomePage } from "./pages/HomePage.jsx";

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
          <span className="nav__muted">(Auth sẽ ở branch)</span>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}

