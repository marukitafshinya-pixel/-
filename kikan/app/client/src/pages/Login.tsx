import { useState } from "react";
import { api } from "../api";
import type { User } from "../main";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/api/login", { login, password });
      onLogin(await api.get<User>("/api/me"));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>丸北 基幹システム</h1>
        <label>
          ログインID
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
        </label>
        <label>
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <p className="err">{err}</p>}
        <button type="submit">ログイン</button>
      </form>
    </div>
  );
}
