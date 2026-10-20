import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import JuchuSakiSelect from "./pages/JuchuSakiSelect";
import JuchuSearch from "./pages/JuchuSearch";
import JuchuTodokeForm from "./pages/JuchuTodokeForm";
import JuchuTeisei from "./pages/JuchuTeisei";
import NotYet from "./pages/NotYet";
import "./styles.css";

export type User = { login: string; name: string; is_admin: boolean };

function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    api.get<User>("/api/me").then(setUser, () => setUser(null));
  }, []);
  if (user === undefined) return null;
  if (!user) return <Login onLogin={(u) => setUser(u)} />;
  return (
    <Routes>
      <Route path="/" element={<Menu user={user} onLogout={() => setUser(null)} />} />
      <Route path="/juchu/select" element={<JuchuSakiSelect />} />
      <Route path="/juchu/search" element={<JuchuSearch />} />
      <Route path="/form/FM_受注登録_届け先指定" element={<JuchuTodokeForm />} />
      <Route path="/juchu/teisei/:jid" element={<JuchuTeisei />} />
      <Route path="/form/:name" element={<NotYet />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

export function useClose() {
  const nav = useNavigate();
  return () => nav("/");
}
