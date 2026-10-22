import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import JuchuSakiSelect from "./pages/JuchuSakiSelect";
import JuchuSearch from "./pages/JuchuSearch";
import JuchuTodokeForm from "./pages/JuchuTodokeForm";
import JuchuTeisei from "./pages/JuchuTeisei";
import HanmoriJuchu from "./pages/HanmoriJuchu";
import HanmoriUriage from "./pages/HanmoriUriage";
import HanmoriTanka from "./pages/HanmoriTanka";
import SbImport from "./pages/SbImport";
import HacchuMoto from "./pages/HacchuMoto";
import HacchuForm from "./pages/HacchuForm";
import HacchuPrint from "./pages/HacchuPrint";
import Tokutei from "./pages/Tokutei";
import JuchuMaster from "./pages/JuchuMaster";
import WsMain from "./pages/WsMain";
import WsDetail from "./pages/WsDetail";
import { WsImportMenu, WsImportSelect, WsYomikomi } from "./pages/WsImport";
import WsJuchu from "./pages/WsJuchu";
import { WsHokan, WsZaikoHyo } from "./pages/WsZaikoHyo";
import WsNenkan from "./pages/WsNenkan";
import WsHoukoku from "./pages/WsHoukoku";
import WsPallet from "./pages/WsPallet";
import WsKoshin from "./pages/WsKoshin";
import WsHibetsu from "./pages/WsHibetsu";
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
      <Route path="/form/F_販盛インポート" element={<HanmoriJuchu />} />
      <Route path="/form/F_販盛インポート売上" element={<HanmoriUriage />} />
      <Route path="/form/F_販盛単価確認" element={<HanmoriTanka />} />
      <Route path="/form/F_エスビー受注インポート" element={<SbImport />} />
      <Route path="/form/F_受注元選択" element={<HacchuMoto />} />
      <Route path="/hacchu/:moto" element={<HacchuForm />} />
      <Route path="/print/hacchu" element={<HacchuPrint />} />
      <Route path="/form/FM_特定商品表示" element={<Tokutei />} />
      <Route path="/form/FM_受注先マスタ登録" element={<JuchuMaster />} />
      <Route path="/ws" element={<WsMain />} />
      <Route path="/ws/detail/:id" element={<WsDetail />} />
      <Route path="/ws/import" element={<WsImportMenu />} />
      <Route path="/ws/import/:src" element={<WsImportSelect />} />
      <Route path="/ws/yomikomi" element={<WsYomikomi />} />
      <Route path="/ws/juchu" element={<WsJuchu />} />
      <Route path="/ws/nenkan" element={<WsNenkan />} />
      <Route path="/ws/houkoku" element={<WsHoukoku />} />
      <Route path="/ws/pallet" element={<WsPallet />} />
      <Route path="/ws/koshin" element={<WsKoshin />} />
      <Route path="/ws/hibetsu" element={<WsHibetsu />} />
      <Route path="/ws/zaikohyo" element={<WsZaikoHyo />} />
      <Route path="/ws/hokan" element={<WsHokan />} />
      <Route path="/form/:name" element={<NotYet />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

// 見本版（Artifacts で開くもの）は、ページの住所が変えられないので、画面の切り替えをページの中だけで持つ
const Router = import.meta.env.VITE_DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);

export function useClose() {
  const nav = useNavigate();
  return () => nav("/");
}
