import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ブックマーク } from "./webHojoScript";

/**
 * elixxi 入力の補助の使い方（ブックマークの登録のしかた）。
 * Access は Edge を自動で動かして elixxi に打ち込んでいた。Web 版は、利用者の Edge で開いた elixxi の画面でブックマークを押すと、同じ欄に入れる。
 */
export function WebHojo() {
  const nav = useNavigate();
  const a = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React は javascript: で始まる href を書かせないので、ここで入れる
    a.current?.setAttribute("href", ブックマーク);
  }, []);
  return (
    <div className="sz sko">
      <div className="kk-head">
        <div className="kk-title">相手先サイトへの入力の補助（使い方）</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad" style={{ lineHeight: 1.9, maxWidth: 900 }}>
        <b>はじめに 1 回だけ：ブックマークを登録する</b>
        <ol>
          <li>Edge のお気に入りバーを出しておきます（Ctrl＋Shift＋B）。</li>
          <li>
            下の「基幹 入力」を、お気に入りバーまでマウスで引っぱって離します。
            <div style={{ margin: "8px 0" }}>
              <a ref={a} className="kk-btn" style={{ padding: "4px 14px", border: "1px solid #888", borderRadius: 4, background: "#fff" }} onClick={(e) => { e.preventDefault(); alert("このボタンは押さずに、お気に入りバーまで引っぱってください。"); }}>
                基幹 入力
              </a>
            </div>
          </li>
        </ol>
        <b>毎回の使い方</b>
        <ol>
          <li>基幹システムの「elixxi 入庫依頼」「elixxi 出庫依頼」「ランテック輸送手配」で行（便）を選び、［… 入力用にコピー］を押します。</li>
          <li>Edge で相手のサイトにログインし、elixxi は「入庫依頼登録」または「出庫依頼登録」、ランテックは「新規発注」の画面を開きます。</li>
          <li>お気に入りバーの「基幹 入力」を押します。はじめて使うときは「クリップボードを見てよいか」と聞かれるので、許可してください（許可しないときは、貼り付ける欄が出ます）。</li>
          <li>ボタンが見出し（elixxi は拠点・日付・扱い便など、ランテックは発送元・出荷日・お届け先・お届け希望日・備考）を入れ、続けて明細を入れます。elixxi で「明細の欄が出たら、もう一度押してください」と出たときは、明細の欄が出てからもう一度「基幹 入力」を押してください。</li>
          <li>「入力が終わりました」（ランテックは「出力完了!」）と出たら、画面の中身を確かめて、<b>［登録］は人が押します</b>。</li>
        </ol>
        <div className="small">
          ・入れる欄と順番は、Access の自動入力と同じです。相手の画面が変わって欄が見つからないときは「入力を止めました」と出ます。ランテックは Access と同じく、入れたあとに読み返して、違っていれば「入力失敗」と出して止めます。<br />
          ・ID・パスワードはこのボタンには入っていません。ログインはいつもどおり人がします。<br />
          ・elixxi の入庫依頼の訂正（受付番号を変えずに明細を入れ直す）：「elixxi 入庫依頼」で受付番号のある行を選び［訂正用にコピー］→ elixxi の「入庫依頼一覧」の画面で「基幹 入力」を押す（受付番号で探して依頼修正を開きます）→ 依頼修正の画面でもう一度押す（今の行の品名を「削除」にし、新しい明細を足します）→ ［登録］を人が押す → 一覧に戻ってもう一度押す（品名が「削除」の行だけにチェックを付けます）→ ［依頼取消］を人が押す。<br />
          ・寄託者の切り替えは、「相手先サイトの設定」の elixxi の「寄託者など」に「11=…, 150=…, 629=…」（名義=寄託者コード）を入れた人だけ行います。
        </div>
      </div>
    </div>
  );
}
