import { useNavigate, useParams } from "react-router-dom";

export default function NotYet() {
  const { name } = useParams();
  const nav = useNavigate();
  return (
    <div className="notyet">
      <p>「{name}」の画面は準備中です。</p>
      <button onClick={() => nav(-1)}>戻る</button>
    </div>
  );
}
