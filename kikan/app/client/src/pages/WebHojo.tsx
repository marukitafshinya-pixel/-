import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ブックマーク } from "./elixxiHojo";

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
        <div className="kk-title">elixxi 入力の補助（使い方）</div>
        <button onClick={() => nav(-1)}>閉じる</button>
      </div>
      <div className="sko-pad" style={{ lineHeight: 1.9, maxWidth: 900 }}>
        <b>はじめに 1 回だけ：ブックマークを登録する</b>
        <ol>
          <li>Edge のお気に入りバーを出しておきます（Ctrl＋Shift＋B）。</li>
          <li>
            下の「elixxi 入力」を、お気に入りバーまでマウスで引っぱって離します。
            <div style={{ margin: "8px 0" }}>
              <a ref={a} className="kk-btn" style={{ padding: "4px 14px", border: "1px solid #888", borderRadius: 4, background: "#fff" }} onClick={(e) => { e.preventDefault(); alert("このボタンは押さずに、お気に入りバーまで引っぱってください。"); }}>
                elixxi 入力
              </a>
            </div>
          </li>
        </ol>
        <b>毎回の使い方</b>
        <ol>
          <li>基幹システムの「elixxi 入庫依頼」または「elixxi 出庫依頼」で行（便）を選び、［elixxi 入力用にコピー］を押します。</li>
          <li>Edge で elixxi にログインし、「入庫依頼登録」または「出庫依頼登録」の画面を開きます。</li>
          <li>お気に入りバーの「elixxi 入力」を押します。はじめて使うときは「クリップボードを見てよいか」と聞かれるので、許可してください（許可しないときは、貼り付ける欄が出ます）。</li>
          <li>ボタンが拠点・日付・扱い便などを入れて［確定］まで進め、続けて明細を入れます。「明細の欄が出たら、もう一度押してください」と出たときは、明細の欄が出てからもう一度「elixxi 入力」を押してください。</li>
          <li>「入力が終わりました」と出たら、画面の中身を確かめて、<b>［登録］は人が押します</b>。</li>
        </ol>
        <div className="small">
          ・入れる欄と順番は、Access の自動入力と同じです。elixxi の画面が変わって欄が見つからないときは「入力を止めました」と出ます。<br />
          ・ID・パスワードはこのボタンには入っていません。ログインはいつもどおり人がします。<br />
          ・寄託者の切り替えは、「相手先サイトの設定」の elixxi の「寄託者など」に「11=…, 150=…, 629=…」（名義=寄託者コード）を入れた人だけ行います。
        </div>
      </div>
    </div>
  );
}
