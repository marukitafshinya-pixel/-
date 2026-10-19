import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type Group = { 取引先ID: number; 取引先名: string };
type Saki = { ID: number; 受注先ID: number; 受注先名: string; 取引先ID: number; 入力画面: string };

/** 受注先選択画面（Access の FM_受注先選択画面） */
export default function JuchuSakiSelect() {
  const nav = useNavigate();
  const [shiire, setShiire] = useState(false); // 通常／仕入
  const [honsha, setHonsha] = useState(false); // 丸北 北海道／大阪丸北
  const [groups, setGroups] = useState<Group[]>([]);
  const [torihiki, setTorihiki] = useState<number | null>(null);
  const [saki, setSaki] = useState<Saki[]>([]);

  useEffect(() => {
    setTorihiki(null);
    setSaki([]);
    api.get<Group[]>("/api/juchu/groups", { honsha: honsha ? 1 : 0 }).then(setGroups);
  }, [honsha]);

  useEffect(() => {
    if (torihiki === null) return;
    api
      .get<Saki[]>("/api/juchu/saki", { torihiki, honsha: honsha ? 1 : 0, shiire: shiire ? 1 : 0 })
      .then(setSaki);
  }, [torihiki, honsha, shiire]);

  // ボタンは 3 列 × 10 段。Access と同じく、上から下へ、左の列から順に並べる。
  const cells: (Group | null)[] = Array.from({ length: 30 }, (_, i) => groups[i] ?? null);
  const byRow = Array.from({ length: 10 }, (_, r) => [cells[r], cells[10 + r], cells[20 + r]]);

  return (
    <div className="sakisel">
      <div className="tabs">
        <span>受注管理</span>
        <span className="active">受注選択画面</span>
        <button className="close" onClick={() => nav("/")}>
          閉じる
        </button>
      </div>
      <div className="sakisel-head">
        <div>
          <button className="btn-red" onClick={() => nav("/form/F_新規マスタ選択")}>
            新規追加
          </button>
          <input className="cyan" readOnly />
        </div>
        <div className="toggle2">
          <button className={!shiire ? "on" : ""} onClick={() => setShiire(false)}>
            通常
          </button>
          <button className={shiire ? "on" : ""} onClick={() => setShiire(true)}>
            仕入
          </button>
        </div>
      </div>
      <div className="sakisel-body">
        <div className="left">
          <div className="title-row">
            <span className="title">受注グループ選択</span>
            <div className="toggle2 boxed">
              <button className={!honsha ? "on" : ""} onClick={() => setHonsha(false)}>
                丸北 北海道
              </button>
              <button className={honsha ? "on" : ""} onClick={() => setHonsha(true)}>
                大阪丸北
              </button>
            </div>
          </div>
          <div className="groups">
            {byRow.map((row, r) => (
              <div key={r} className="grow">
                {row.map((g, c) =>
                  g && g.取引先ID !== 0 ? (
                    <button
                      key={c}
                      className={torihiki === g.取引先ID ? "on" : ""}
                      onClick={() => setTorihiki(g.取引先ID)}
                    >
                      {g.取引先名}
                    </button>
                  ) : (
                    <button key={c} disabled />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="right">
          <span className="title">受注先選択</span>
          <div className="list">
            <table>
              <tbody>
                {saki.map((s) => (
                  <tr
                    key={s.ID}
                    onClick={() => nav(`/form/${s.入力画面}?id=${s.ID}`)}
                    title={`開く画面：${s.入力画面}`}
                  >
                    <td className="num">{s.受注先ID}</td>
                    <td>{s.受注先名}</td>
                  </tr>
                ))}
                {saki.length === 0 && (
                  <tr className="empty">
                    <td></td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
