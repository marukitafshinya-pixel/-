#!/usr/bin/env python3
"""見本版のデータ（data.sql）を作る。

- 取引先・商品・受注・便・出荷・在庫・生産計画は、すべて作り物（本物のデータは使わない）。
- 区分などの一覧表（地区コード・商品区分・輸送区分 など、取引先名を含まないもの）だけ、いまのデータベースから写す。
- 日付は demo_day(n)（見本版を開いた日から n 日後）で書く。
- 書かない項目は、Access の表と同じく 数＝0、真偽＝false、文字・日付＝空 にする。

使い方: PGURL=... python3 make_data.py > data.sql
"""
import os
import subprocess
import sys

PGURL = os.environ.get("PGURL", "postgresql://postgres@/kikan?host=/tmp")


def psql(sql):
    r = subprocess.run(["psql", PGURL, "-At", "-F", "\t", "-c", sql], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)
    return [line.split("\t") for line in r.stdout.splitlines() if line]


_types = {}


def types(table):
    if table not in _types:
        s, t = table.split(".", 1)
        _types[table] = {c: ty for c, ty in psql(
            f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='{s}' AND table_name='{t}' ORDER BY ordinal_position")}
        if not _types[table]:
            sys.exit(f"表がありません: {table}")
    return _types[table]


class Raw(str):
    """SQL の式をそのまま書く"""


def day(n, time=None):
    return Raw(f"(demo_day({n}) + time '{time}')" if time else f"demo_day({n})")


def lit(v, ty):
    if isinstance(v, Raw):
        return v
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def default(ty):
    if ty == "boolean":
        return False
    if ty in ("integer", "smallint", "bigint", "double precision", "numeric", "real"):
        return 0
    return None


out = []


def ins(table, **v):
    ty = types(table)
    for k in v:
        if k not in ty:
            sys.exit(f"{table} に {k} がありません")
    cols = list(ty)
    vals = [lit(v[c], ty[c]) if c in v else lit(default(ty[c]), ty[c]) for c in cols]
    s, t = table.split(".", 1)
    out.append(f'INSERT INTO "{s}"."{t}" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({", ".join(vals)});')


def copy_table(table):
    """区分などの一覧表を、いまのデータベースからそのまま写す"""
    s, t = table.split(".", 1)
    cols = list(types(table))
    sel = ", ".join(f'quote_nullable("{c}"::text)' for c in cols)
    for row in psql(f'SELECT concat_ws(\',\', {sel}) FROM "{s}"."{t}"'):
        out.append(f'INSERT INTO "{s}"."{t}" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({row[0]});')


# ---------------- 区分などの一覧表（写す） ----------------
for tb in [
    "juchu_fe.TM_イベントスケジュール", "juchu_fe.TM_単位マスタ", "juchu_fe.TM_受注区分",
    "juchu_fe.TM_商品区分", "juchu_fe.TM_地区コード", "juchu_fe.TM_得意先区分", "juchu_fe.TM_枝処理マスタ",
    "juchu_fe.TD_商品分類",
    "ws_fe.TM_イベントスケジュール", "ws_fe.TM_エリアコード", "ws_fe.TM_パレット調整区分", "ws_fe.TM_冷凍区分",
    "ws_fe.TM_合否判定", "ws_fe.TM_商品区分", "ws_fe.TM_商品状態マスタ", "ws_fe.TM_商品輸送区分", "ws_fe.TM_地区コード",
    "ws_fe.TM_得意先区分", "ws_fe.TM_混載区分", "ws_fe.TM_訂正科目マスタ", "ws_fe.TM_車両区分", "ws_fe.TM_輸送区分", "ws_fe.TM_運賃分類マスタ",
    "ws_fe.TM_運賃輸送区分", "ws_fe.TM_配達区分",
    "ws_fe.TD_商品分類", "ws_fe.TM_原料マスタ",
    # マスタ管理の選択肢
    "master_fe.TM_商品区分", "master_fe.TM_テープマスタ", "master_fe.TM_ハイ積みマスタ", "master_fe.TM_産地マスタ",
    "master_fe.TM_得意先区分", "master_fe.TM_web出力判別区分", "master_fe.TM_地区コード", "master_fe.TM_配達区分", "master.TM_運賃扱いマスタ",
]:
    copy_table(tb)
# マスタ管理の資材（段ボール・計量袋・パット）は仕入先の名前が入るので、作り物にする
for i, (bunrui, hinban, name, shiki) in enumerate([(10, "A-1", "見本段ボール 小", "A"), (10, "A-7", "見本段ボール 大", "A"), (10, "パット大", "見本パット", "P"),
                                                   (11, "白10kg", "見本袋 10kg", "白"), (11, "白5kg", "見本袋 5kg", "白")], 1):
    ins("master_fe.TM_仕入マスタ", ID=i, 取引先コード=1, 仕入コード=str(i), 品番=hinban, 商品名=name, 分類ID=bunrui, 識別条件=shiki, 資材コード=str(i))

# 取引先名の入る一覧表は、作り物にする
for sc in ["juchu_fe", "ws_fe"]:
    for i, (bunrui, kid, name) in enumerate([("見本食品", 4, "ミックス"), ("見本農協", 1, "ソース"), ("見本農協", 2, "ドラム")], 1):
        ins(f"{sc}.TM_取り扱い区分マスタ", ID=i, 分類=bunrui, 取扱い区分ID=kid, 区分名=name)
    for i, (mid, name, msg, n1) in enumerate([(1, "見本食品専用", "受注先を選択して下さい。", 0), (2, "特定ユーザー", "ユーザーを選択して下さい。", 11),
                                               (3, "その他ユーザー", "ユーザーを選択して下さい。", 21), (4, "年間ID", "ユーザーの発注Noを入力してください。", 31),
                                               (5, "受注ID", "受注IDを入力してください。", 41)], 1):
        ins(f"{sc}.TM_受注検索方法", ID=i, 検索方法ID=mid, 選択方法=name, コメント=msg, 順番No1=n1, 順番No2=n1 + 1, 順番No3=n1 + 2, 順番No4=n1 + 3)
for i, (k, name) in enumerate([(1, "丸北　北海道"), (629, "大阪丸北"), (9990, "その他(請求なし)"), (9991, "資材(請求なし)"), (9992, "ｻﾝﾌﾟﾙ(請求なし)")]):
    ins("ws_fe.TM_運賃振分区分マスタ", **{list(types("ws_fe.TM_運賃振分区分マスタ"))[0]: k, list(types("ws_fe.TM_運賃振分区分マスタ"))[1]: name})
for k, name in [(1, "選果場"), (2, "冷蔵倉庫"), (3, "食品メーカー")]:
    ins("ws_fe.TM_グループマスタ", グループID=k, グループ名=name)

# ---------------- 取引先（作り物） ----------------
得意先 = [
    # 短縮コード, 短縮名, 短縮名2, ｶﾅ, 地区, 倉庫, 出荷元, 受付時間
    (11, "丸北　北海道", "丸北　北海道", "ﾏ", 1, True, True, None),
    (191, "丸北　ふらの工場", "ふらの工場", "ﾏ", 1, True, True, None),
    (629, "大阪丸北", "大阪丸北", "ｵ", 6, False, False, None),
    (1254, "丸北　北海道デポ", "北海道デポ", "ﾏ", 1, True, False, None),
    (1095, "丸北　原料", "原料", "ﾏ", 1, False, False, None),
    (360, "見本食品", "見本食品", "ﾐ", 3, False, False, None),
    (812, "見本食品　札幌工場", "札幌工場", "ﾐ", 1, False, False, "8:00～12:00 受付"),
    (824, "見本食品　東京工場", "東京工場", "ﾐ", 3, False, False, "9:00～15:00 受付"),
    (949, "見本食品　九州DC", "九州DC", "ﾐ", 9, False, False, None),
    (343, "見本冷蔵　船橋", "見本冷蔵　船橋", "ﾐ", 3, True, False, "AM 必着"),
    (826, "見本冷蔵　高松", "見本冷蔵　高松", "ﾐ", 8, True, False, None),
    (164, "見本冷蔵　札幌", "見本冷蔵　札幌", "ﾐ", 1, True, True, None),
    (350, "見本商事", "見本商事", "ﾐ", 1, False, False, None),
    (1237, "見本食品工業", "見本食品工業", "ﾐ", 1, False, False, None),
    (150, "見本農協", "見本農協", "ﾐ", 1, False, False, None),
]
for i, (code, name, name2, kana, chiku, soko, moto, uke) in enumerate(得意先, 1):
    ins("kyotsu.TM_得意先マスタ", ID=i, 短縮コード=code, 得意先名=name, 短縮名=name, 短縮名2=name2, **{"ｶﾅ分類": kana}, 地区コード=chiku,
        住所=f"見本県見本市{i}番地", 電話番号=f"000-000-{i:04d}", 倉庫区分=soko, 出荷元区分=moto, 入庫フラグ=False, 受付時間=uke, 入庫区分=soko or code in (812, 824),
        十二地区="北海道" if chiku == 1 else "本州", パレット積載許容数=3 if code == 343 else 0)

# ---------------- 商品（作り物） ----------------
商品 = [
    # コード, 短縮名, 商品名, 規格, 入数, 分類, パレット
    (48, "ﾉﾝｵｲﾙｿﾃｰ50", "ﾉﾝｵｲﾙｿﾃｰｵﾆｵﾝ50（見本）", "6×3", 18, 1, 45),
    (55, "生姜ﾍﾟｰｽﾄN", "生姜ﾍﾟｰｽﾄN（見本）", "5×4", 20, 2, 40),
    (91, "ｵﾆｵﾝﾍﾟｰｽﾄN", "ｵﾆｵﾝﾍﾟｰｽﾄN（見本）", "10×2", 20, 2, 50),
    (97, "ｿﾃｰｵﾆｵﾝ4.8", "4.8mmソテーオニオン（見本）", "10×2", 20, 1, 50),
    (633, "冷凍生姜ﾀﾞｲｽ", "冷凍生姜ダイス（見本）", "5×4", 20, 3, 40),
    (736, "生姜おろし300g", "生姜おろし300g冷凍（見本）", "3×6袋", 3.6, 2, 60),
]
for i, (code, short, name, kikaku, irisu, bunrui, pal) in enumerate(商品, 1):
    ins("kyotsu.TM_商品マスタ", ID=i, 商品コード=code, グループ商品コード=code, 分類ID=bunrui, **{"ｶﾅ分類": "ｿ" if bunrui == 1 else "ﾍ"},
        短縮名=short, 商品名=name, 規格=kikaku, 入数=irisu, 品質保持期間=2, 賞味期限日付差=-1, パレット単位1=pal, パレット単位2=pal, 製造場所ID=11,
        製造場所="丸北　北海道", 使用可能chk=True, 本社コード=f"D{code:04d}")
商品名 = {c: (n, k, i) for c, _, n, k, i, _, _ in 商品}
名前 = {c: n for c, n, *_ in 得意先}

# ---------------- 運送会社（作り物） ----------------
# 運送会社マスタは kyotsu に 1 つ（各スキーマの同じ名前はビュー）
for i, (code, name, kana) in enumerate([(630, "丸北　北海道", "ﾏ"), (4, "見本物流", "ﾐ"), (5, "見本運輸", "ﾐ"), (6, "見本通運", "ﾐ"), (7, "見本急便", "ﾐ")], 1):
    ins("kyotsu.TM_運送会社マスタ", ID=i, 運送会社ID=code, 短縮名=name, 運送会社名=name + "株式会社" if code != 630 else name, カナ分類=kana,
        住所=f"見本県見本市運送{i}番地", 電話番号=f"000-111-{i:04d}", 使用不可フラグ=False, 運賃扱い区分=1)

# ---------------- 名義・出荷場所の条件（作り物） ----------------
for i, (soko, name) in enumerate([(11, "丸北　北海道"), (191, "丸北　ふらの工場"), (164, "見本冷蔵　札幌")], 1):
    ins("ws_fe.TM_出荷場所条件", ID=i, 倉庫ID=soko, 倉庫名=name, 手配元ID=soko, 手配元=name, 手配帳合ID=soko, 手配帳合=name, 名義ID=soko)
ins("ws_fe.TD_倉庫詳細設定", ID=1, 短縮コード=343, 倉庫名="見本冷蔵　船橋", 名義コード=11, 名義名="丸北　北海道")
ins("ws_fe.TD_倉庫詳細設定", ID=2, 短縮コード=826, 倉庫名="見本冷蔵　高松", 名義コード=11, 名義名="丸北　北海道")
n = 0
for todoke in [812, 824, 949]:
    for code in [48, 55, 91, 97, 633]:
        n += 1
        ins("kyotsu.TM_入庫先商品別名義条件", ID=n, 受注元ID=360, 受注元名="見本食品", 取引先グループID=360, 取引先グループ名="見本食品", 受注先ID=todoke,
            受注先=名前[todoke], 届け先コード=todoke, 届け先=名前[todoke], 商品コード=code, 商品名=商品名[code][0], 入庫名義ID=todoke,
            入庫名義名=名前[todoke], 運賃請求ID=1, 運賃請求先="丸北　北海道", 運賃振分区分=1, 運賃振分区分名="丸北　北海道", 倉庫ID=11, 倉庫名="丸北　北海道",
            未完了chk=False, 重複=False, 特定条件=False, 指定冷蔵庫=False, 取扱区分=False, 横持区分=False, 新ダンボール初回案内=False)
# ユーザーマスタの取引先グループ（作り物）
for i, (code, name, kubun) in enumerate([(11, "丸北　北海道", 1), (360, "見本食品", 1), (150, "見本農協", 1), (629, "大阪丸北", 629)], 1):
    ins("master_fe.TMU_取引先グループマスタ", ID=i, 取引先ID=code, 取引先名=name, 受注区分=kubun)
# 受注先マスタ（取引先ごとの受注先）
受注先 = [
    # 取引先, 受注先, 本社受注
    (360, 812, False), (360, 824, False), (360, 949, False), (350, 350, False), (1237, 1237, False), (11, 343, False), (11, 1254, False),
    (629, 343, True), (629, 826, True),
]
for sc in ["ws_fe", "juchu_fe"]:
    for i, (tid, saki, honsha) in enumerate(受注先, 1):
        ins(f"{sc}.TM_受注先マスタ", ID=i, 取引先ID=tid, 取引先名=名前[tid], 受注元ID=tid, 受注元名=名前[tid], 受注先ID=saki, 受注先名=名前[saki],
            本社受注=honsha, 指定届け先コード=saki, 指定届け先=名前[saki])
# 発注依頼の受注元・相手先の届け先と商品
for tid in [360, 350]:
    ins("juchu_fe.TM_出荷依頼先選択", 取引先ID=tid, 取引先名=名前[tid], 本社受注=False)
for i, todoke in enumerate([812, 824, 949], 1):
    ins("juchu_fe.TM_相手先届け先マスタ", ID=i, 相手方届け先コード=f"T{todoke}", 自社コード=todoke, 届け先=名前[todoke], 相手先コード=360, 相手先名="見本食品")
for code in [48, 55, 91, 97, 633]:
    ins("juchu.TM_相手先商品マスタ", 受注元コード=360, 受注元="見本食品", 相手先商品コード=f"G{code:06d}", 相手先商品名=商品名[code][0], 商品コード=code,
        商品名=商品名[code][0])
ins("juchu_fe.TM_受注特定項目", ID=1, 商品コード=55, 商品名=商品名[55][0], 届け先コード=812, 届け先=名前[812], 備考="見本：午前中に納品", 入力時間="2026/01/01 9:00:00")

# ---------------- 受注（作り物）：受注登録と WorkStation の写しの両方に入れる ----------------
受注 = [
    # 受注ID, 受注元, 受注先, 届け先, 商品, ケース, 納品日(日後), 残ケース
    (1, 360, 812, 812, 91, 50, 1, 50),
    (2, 360, 812, 812, 55, 30, 2, 30),
    (3, 360, 824, 824, 48, 40, 3, 40),
    (4, 360, 824, 824, 97, 60, 3, 60),
    (5, 360, 949, 949, 633, 20, 4, 20),
    (6, 360, 812, 812, 91, 25, 0, 0),
    (7, 360, 824, 824, 55, 20, 0, 0),
    (8, 350, 350, 350, 736, 30, 2, 30),
    (9, 1237, 1237, 1237, 55, 15, 5, 15),
    (10, 360, 812, 812, 633, 10, 6, 10),
]
for jid, moto, saki, todoke, code, cs, nd, zan in 受注:
    name, kikaku, irisu = 商品名[code]
    for sc in ["juchu", "ws"]:
        ins(f"{sc}.TD_受注", 受注ID=jid, 受注番号=f"D{jid:07d}", 受注元ID=moto, 受注元名=名前[moto], 受注日=day(-3), 商品コード=code, 商品名=name,
            規格=kikaku, 入数=irisu, ケース=cs, 残ケース=zan, 商品kg=cs * irisu, 残kg=zan * irisu, 納品日=day(nd), 受注先ID=saki,
            受注先名=名前[saki], 届け先コード=todoke, 届け先=名前[todoke], 倉庫ID=11, 倉庫名="丸北　北海道", 入力日=day(-3),
            統一受注ID=f"{500000 + jid}", 出荷予定日=day(nd - 1), 登録時間="2026/01/01 9:00:00")

# ---------------- 便（作り物） ----------------
便 = [
    # 輸送ID, 日, 運送会社, 車番
    (1001, 0, 4, "１２３４"), (1002, 0, 5, "５６７８"), (1003, 1, 6, "２４６８"), (1004, 1, 4, "１３５７"), (1005, 2, 7, "９９９９"),
]
運送名 = {630: "丸北　北海道", 4: "見本物流", 5: "見本運輸", 6: "見本通運", 7: "見本急便"}
for yid, d, unso, car in 便:
    ins("ws.TD_輸送計画", 輸送ID=yid, 出荷計画日=day(d), 運送会社ID=unso, 運送会社名=運送名[unso], 車番=car, 集荷日=day(d),
        手配運送会社コード=630, 手配運送会社名="丸北　北海道", 帳合運送会社コード=unso, 帳合運送会社名=運送名[unso],
        輸送区分ID=1, 輸送区分="陸", 車両区分ID=2, 車両区分="4t", 冷凍区分ID=1, 配達区分ID=1, 運賃区分ID=1, セット温度=-22,
        最大積載重量kg=4000, 担当者="見本：納品日前日までに配車受付をお願いします。",
        パレット輸送区分=1 if yid == 1005 else 0)

# ---------------- 在庫（作り物） ----------------
在庫 = [
    # 在庫ID, 商品, 元数, 入庫日(日前), タグ, 出荷止め
    (70001, 55, 120, -6, "①", False), (70002, 55, 80, -6, "②", False), (70003, 91, 200, -5, "①", False),
    (70004, 48, 150, -4, "①", False), (70005, 48, 60, -4, "②", True), (70006, 633, 60, -8, "①", False), (70007, 97, 100, -3, "①", False),
    (70009, 97, 150, -7, "②", False),  # 日別の在庫の作り直しの見本：前の日に出荷して減った在庫
]
出庫 = {70004: 20, 70009: 70}  # 積込確認済み・登録済みの出荷の分
for zid, code, moto, d, tag, tome in 在庫:
    name, kikaku, irisu = 商品名[code]
    out_cs = 出庫.get(zid, 0)
    ins("ws.TD_在庫", 在庫ID=zid, 倉庫ID=11, 倉庫名="丸北　北海道", 入庫後名義ID=11, 商品コード=code, 分類ID=1, 商品名=name, 規格=kikaku, 入数=irisu,
        入庫日=day(d), 製造日=day(d - 1), 賞味期限=day(d - 2 + 730), 入庫元数=moto, 製造ケース=moto, 製造kg=moto * irisu, 出庫ケース=out_cs,
        出荷kg=out_cs * irisu, 在庫ケース=moto - out_cs, 在庫kg=(moto - out_cs) * irisu, タグ=tag, 商品区分=1, 出荷止め区分=tome,
        管理備考="見本：検査待ち" if tome else None, 最終出庫日=day(d + 1800), 製造工場ID=11, 製造工場名="丸北　北海道", 認識ID=str(zid))
# 積込確認済みの出荷で、届け先（見本冷蔵 船橋）に入った在庫
ins("ws.TD_在庫", 在庫ID=70008, 倉庫ID=343, 倉庫名="見本冷蔵　船橋", 入庫後名義ID=11, 商品コード=48, 商品名=商品名[48][0], 規格="6×3", 入数=18,
    入庫日=day(0), 製造日=day(-5), 賞味期限=day(724), 入庫元数=20, 製造ケース=20, 製造kg=360, 在庫ケース=20, 在庫kg=360, タグ="①", 商品区分=1,
    出庫ID=5003, 最終出庫日=day(1825), 製造工場ID=11, 製造工場名="丸北　北海道")

# ---------------- 生産計画（作り物）：製造管理の入庫 ----------------
for nid, code, cs, d, tag in [(90006, 48, 50, 0, "②"), (90001, 55, 100, 2, "①"), (90002, 91, 150, 3, "①"), (90003, 97, 80, 1, "①"), (90004, 633, 60, 4, "①"), (90005, 91, 120, 6, "②")]:
    name, kikaku, irisu = 商品名[code]
    ins("seizo.TD_入庫", 入庫ID=nid, 入庫日=day(d), 商品コード=code, 商品名=name, 規格=kikaku, 入数=irisu, ケース=cs, 商品kg=cs * irisu, 製造日=day(d - 1),
        chk=False, 倉庫ID=11, 倉庫名="丸北　北海道", 商品区分=1, タグ=tag, 数量確定フラグ=-1 if d == 0 else 0, 入庫元数=cs, 製造ケース=cs, 製造kg=cs * irisu, 在庫ケース=cs, 在庫kg=cs * irisu)

# ---------------- 出荷（作り物） ----------------
既定 = dict(商品輸送区分=629, 運賃請求ID=1, 運賃振分区分=1, 運賃振分区分名="丸北　北海道", 入庫前名義ID=11, 手配元ID=11, 手配元="丸北　北海道",
          手配帳合ID=11, 手配帳合="丸北　北海道", 倉庫ID=11, 倉庫名="丸北　北海道", 製造工場ID=11, 製造工場名="丸北　北海道")
出荷 = [
    # 出庫ID, 輸送ID, 日, 届け先, 商品, ケース, 在庫ID, 順, chk, 受注ID, 取引元
    (5001, 1001, 0, 343, 55, 40, 70001, 1, False, 0, 11),
    (5002, 1001, 0, 343, 91, 30, 70003, 2, False, 0, 11),
    (5003, 1001, 0, 343, 48, 20, 70004, 3, True, 0, 11),
    (5004, 1002, 0, 812, 91, 25, 70003, 1, False, 6, 360),
    (5005, 1002, 0, 824, 55, 20, 70002, 2, False, 7, 360),
    (5006, 0, 0, 826, 633, 15, 70006, 0, False, 0, 11),
    (5007, 0, 0, 826, 97, 20, 70007, 0, False, 0, 11),
    (5008, 1003, 1, 343, 97, 30, 70007, 1, False, 0, 11),
    (5009, 1003, 1, 1254, 55, 10, 70002, 2, False, 0, 11),
    # パレット輸送の便（見本冷蔵 札幌＝164 行き）
    (5010, 1005, 2, 164, 91, 90, 70003, 1, False, 0, 11),
    (5011, 1005, 2, 164, 55, 50, 70001, 2, False, 0, 11),
    # 前の日に出して、在庫更新で登録した出荷（日別の在庫の作り直しの見本）
    (5012, 0, -5, 826, 97, 40, 70009, 0, True, 0, 11),
    (5013, 0, -2, 826, 97, 30, 70009, 0, True, 0, 11),
]
for sid, yid, d, todoke, code, cs, zid, jun, chk, jid, moto in 出荷:
    name, kikaku, irisu = 商品名[code]
    z = next(x for x in 在庫 if x[0] == zid)
    v = dict(既定)
    v.update(出庫ID=sid, 輸送ID=yid, 出荷日=day(d), 届け先コード=todoke, 届け先=名前[todoke], 商品コード=code, 商品名=name, 規格=kikaku, 入数=irisu,
             ケース=cs, 商品kg=cs * irisu, 製造日=day(z[3] - 1), 賞味期限=day(z[3] - 2 + 730), 納品日=day(d + 2), 入庫日=day(z[3]), タグ=z[4],
             在庫ID=zid, 認識ID=str(zid), 通知="確認OK!", 商品積込順=jun, chk=chk, 積込確認=chk, 受注ID=jid, 取引元ID=moto, 取引元=名前[moto],
             入庫後名義ID=11 if todoke in (343, 826, 1254) else todoke, 届け先区分=3 if todoke in (343, 826, 1254) else 0, 商品区分=1,
             パレット使用枚数=-(-cs // 40))
    if sid == 5002:
        v.update(計画変更chk=True, 変更通知="製造日が変わりました（見本）")
    ins("ws.TD_出荷", **v)

# ---------------- 年間受注割振りの月の表（作り物）：見本版を開いた月と、その前の月 ----------------
月初 = Raw("date_trunc('month', demo_day(0))")
月末 = Raw("(date_trunc('month', demo_day(0)) + interval '1 month' - interval '1 day')")
前月初 = Raw("(date_trunc('month', demo_day(0)) - interval '1 month')")
前月末 = Raw("(date_trunc('month', demo_day(0)) - interval '1 day')")
年月 = Raw("to_char(demo_day(0), 'YYMM')")
前年月 = Raw("to_char(date_trunc('month', demo_day(0)) - interval '1 month', 'YYMM')")
name, kikaku, irisu = 商品名[91]
for kid, todoke, start, end, ym, moto_cs, zan, biko in [
    (19001, 812, 月初, 月末, 年月, 100, 0, "見本：優先"),
    (19002, 824, 月初, 月末, 年月, 80, 0, None),
    (19003, 343, 月初, 月末, 年月, 60, 0, "見本：40個確保"),
    (18001, 824, 前月初, 前月末, 前年月, 90, 20, None),
]:
    ins("ws.TMS_本社依頼受注_製造", 個別受注ID=kid, 年月=ym, 統一受注ID=Raw(f"{ym} || '-91'"), 集計開始日=start, 集計終了日=end, 運賃振分区分=1,
        届け先コード=todoke, 届け先=名前[todoke], 商品コード=91, グループ商品コード=91, 商品名=name, 規格=kikaku, 入数=irisu,
        受注元数=moto_cs, 受注残数=zan, 取引元ID=360, 取引帳合ID=todoke, 入庫後名義ID=todoke, 備考=biko)

# ---------------- 取り込み元（倉庫管理・転売品管理・原料管理）の出荷（作り物） ----------------
for sc, base in [("soko", 8001), ("tenbai", 8101)]:
    for i, (code, cs) in enumerate([(55, 12), (91, 8)]):
        name, kikaku, irisu = 商品名[code]
        ins(f"{sc}.TD_出荷", 出庫ID=base + i, 輸送ID=0, 出荷日=day(0), 届け先コード=343, 届け先="見本冷蔵　船橋", 倉庫ID=164, 倉庫名="見本冷蔵　札幌",
            商品コード=code, 商品名=name, 規格=kikaku, 入数=irisu, ケース=cs, 商品kg=cs * irisu, 製造日=day(-10), 賞味期限=day(719), 納品日=day(1),
            タグ="①", 在庫ID=9000 + i)
for i, (code, cs) in enumerate([(633, 5)]):
    name, kikaku, irisu = 商品名[code]
    ins("genryo.TD_出荷", 出庫ID=8201 + i, 出荷日=day(0), 届け先コード=343, 届け先="見本冷蔵　船橋", 倉庫ID=164, 倉庫名="見本冷蔵　札幌",
        商品コード=code, 商品名=name, ケース=cs, 商品kg=cs * irisu, 在庫ID=9100 + i)

# ---------------- プログラムの決めごと（server/schema.sql）の取引先名を、見本の名前にする ----------------
out.append('DELETE FROM app."受注検索_受注元ボタン";')
for i, (name, v) in enumerate([("見本食品", 360), ("見本商事", 350), ("見本食品工業", 1237), ("見本農協", 150), ("冷凍原料", 1095), ("丸北デポ", 1254), ("大阪", 629), ("その他", -2)], 1):
    out.append(f'INSERT INTO app."受注検索_受注元ボタン" (並び, 表示名, 値, 要確認) VALUES ({i}, {lit(name, "text")}, {v}, false);')
out.append('DELETE FROM app."発注依頼書_宛先";')
out.append('INSERT INTO app."発注依頼書_宛先" ("商品コード", "手配依頼先", "仕入先名", "仕入先コード", "返信コメント2", "返信コメント3", "納品指定時間") '
           "VALUES (0, '見本商事株式会社', '見本商事株式会社　様', '0000000', '尚、出庫手配の返信をFAXお願いします。', '', 'AM必着');")
out.append('UPDATE app."帳票_差出人" SET "住所" = \'見本県見本町1番地\', "TEL" = \'000-000-0000\', "FAX" = \'000-000-0001\';')
out.append('UPDATE app."帳票_差出人" SET "社名" = \'見本農協\', "店舗" = \'販売部\' WHERE "区分" = \'ふらの\';')
out.append('UPDATE app."帳票_差出人" SET "社名" = \'見本商事（大阪）\' WHERE "区分" = \'大阪丸北\';')
out.append('UPDATE app."発注依頼書_発行元" SET "会社名" = \'丸北（見本）\', "住所" = \'見本県見本市1番地\', "TEL" = \'000-000-0000\', "FAX" = \'000-000-0001\';')

print("-- 見本版のデータ（make_data.py で作ったもの。作り物のデータ）")
print("\n".join(out))
