import { useState } from "react";
import { Link } from "react-router-dom";

import { apiPost } from "../lib/api.js";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });

  async function onSubmit(e) {
    e.preventDefault();
    setStatus({ type: "loading", message: "" });
    try {
      const data = await apiPost("/auth/register", { email, password });
      localStorage.setItem("token", data.token);
      setStatus({ type: "ok", message: "Đăng ký thành công. Token đã lưu." });
    } catch (err) {
      setStatus({ type: "error", message: err?.message ?? "Lỗi" });
    }
  }

  return (
    <section className="card">
      <h1>Đăng ký</h1>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          <span>Mật khẩu</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={6}
            placeholder="******"
          />
        </label>
        <button className="btn" disabled={status.type === "loading"}>
          {status.type === "loading" ? "Đang xử lý..." : "Tạo tài khoản"}
        </button>
      </form>

      {status.type !== "idle" ? (
        <p className={status.type === "error" ? "msg msg--error" : "msg msg--ok"}>
          {status.message}
        </p>
      ) : null}

      <p className="muted">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </section>
  );
}

