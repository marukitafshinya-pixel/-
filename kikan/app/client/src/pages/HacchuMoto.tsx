import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { FindDialog } from "../formParts";

type Moto = { 取引先ID: number; 取引先名: string };

/** 発注依頼の受注元選択（Access の F_受注元選択） */
export default function HacchuMoto() {
  const nav = useNavigate();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const load = () => api.get<Moto[]>("/api/hacchu/moto").then(setMotos);
  useEffect(() => {
    load();
  }, []);

  // ボタンは 3 列 × 10 段。上から下へ、左の列から順に並べる
  const cells: (Moto | null)[] = Array.from({ length: 30 }, (_, i) => motos[i] ?? null);
  const byRow = Array.from({ length: 10 }, (_, r) => [cells[r], cells[10 + r], cells[20 + r]]);

  async function 削除(m: Moto) {
    setRemoving(false);
    const pass = prompt(`パスワードを入力してください。\n${m.取引先名} を条件から削除しますがよろしいですか？`);
    if (pass === null) return;
    try {
      await api.post("/api/hacchu/moto/delete", { 取引先ID: m.取引先ID, 合言葉: pass });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div className="hacchu-moto">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">F_受注元選択</span>
        <button className="close" onClick={() => nav("/")}>
          閉じる
        </button>
      </div>
      <div className="hm-btns">
        <button className="add" onClick={() => setAdding(true)}>
          ユーザー追加
        </button>
        <button className={"del" + (removing ? " on" : "")} onClick={() => setRemoving(!removing)}>
          ユーザー削除
        </button>
        {removing && <span className="note">削除する受注元のボタンを押してください</span>}
      </div>
      <div className="groups moto3">
        {byRow.map((row, r) => (
          <div key={r} className="grow">
            {row.map((m, c) =>
              m ? (
                <button key={c} onClick={() => (removing ? 削除(m) : nav(`/hacchu/${m.取引先ID}`))}>
                  {m.取引先名}
                </button>
              ) : (
                <button key={c} disabled />
              ),
            )}
          </div>
        ))}
      </div>
      {adding && (
        <FindDialog
          kind="tokui"
          onClose={() => setAdding(false)}
          onPick={async (code) => {
            setAdding(false);
            const name = (await api.get<any>(`/api/hacchu/name/${code}`)).短縮名;
            if (!confirm(`${name} を条件に加えますがよろしいですか？`)) return;
            try {
              await api.post("/api/hacchu/moto/add", { 取引先ID: code });
              await load();
            } catch (e) {
              alert(e instanceof ApiError ? e.message : String(e));
            }
          }}
        />
      )}
    </div>
  );
}
