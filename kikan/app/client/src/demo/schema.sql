
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA app;

CREATE SCHEMA genryo;

CREATE SCHEMA housou;

CREATE SCHEMA housou_fe;

CREATE SCHEMA juchu;

CREATE SCHEMA juchu_fe;

CREATE SCHEMA keikaku;

CREATE SCHEMA kyotsu;

CREATE SCHEMA kyoyu;

CREATE SCHEMA seizo;

CREATE SCHEMA seizo_fe;

CREATE SCHEMA soko;

CREATE SCHEMA soko_fe;

CREATE SCHEMA tehai_fe;

CREATE SCHEMA tenbai;

CREATE SCHEMA web_fe;

CREATE SCHEMA ws;

CREATE SCHEMA ws_fe;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE app.sessions (
    token text NOT NULL,
    login text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE app.users (
    login text NOT NULL,
    name text NOT NULL,
    pass_hash text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE app."受注検索_受注元ボタン" (
    "並び" integer NOT NULL,
    "表示名" text NOT NULL,
    "値" integer NOT NULL,
    "要確認" boolean DEFAULT false NOT NULL
);

CREATE TABLE app."発注依頼書_宛先" (
    "商品コード" integer NOT NULL,
    "手配依頼先" text DEFAULT ''::text NOT NULL,
    "仕入先名" text DEFAULT ''::text NOT NULL,
    "仕入先コード" text DEFAULT ''::text NOT NULL,
    "返信コメント2" text DEFAULT ''::text NOT NULL,
    "返信コメント3" text DEFAULT ''::text NOT NULL,
    "納品指定時間" text DEFAULT ''::text NOT NULL
);

CREATE TABLE app."発注依頼書_発行元" (
    "番号" integer DEFAULT 1 NOT NULL,
    "会社名" text DEFAULT ''::text NOT NULL,
    "住所" text DEFAULT ''::text NOT NULL,
    "TEL" text DEFAULT ''::text NOT NULL,
    "FAX" text DEFAULT ''::text NOT NULL,
    CONSTRAINT "発注依頼書_発行元_番号_check" CHECK (("番号" = 1))
);

CREATE TABLE app."設定" (
    "名前" text NOT NULL,
    "値" text DEFAULT ''::text NOT NULL
);

CREATE TABLE genryo."TD_出荷" (
    "出庫ID" integer,
    "輸送ID" integer,
    "入庫ID" integer,
    "出荷日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(50),
    "社内連絡" character varying(255),
    "サンプル区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean,
    "賞味期限通知" text,
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" character varying(255),
    "個別運賃" numeric(19,4),
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "買取単価コード" integer,
    "買取chk" boolean,
    "買取金額" double precision,
    "出荷期数" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "ユーザー伝票No" character varying(255),
    "受注確認" boolean,
    "出荷元数" integer,
    "破損個数" integer,
    "入力時間" timestamp without time zone,
    "受注グループ" integer,
    "輸送履歴読込chk" boolean,
    "ユーザーchk" boolean,
    "帳票グループ化" integer,
    "受注表題" text,
    "積込確認" boolean,
    "送り状No" text,
    "締切時間" text,
    "破損出庫ID" integer,
    "商品区分" integer,
    "出荷元kg" integer,
    "訂正kg" integer,
    "入庫備考" boolean,
    "タグ" character varying(50),
    "受注ID" integer,
    "タグ2" text,
    "商品輸送区分" integer,
    "商品輸送区分名" text,
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行指令No" character varying(255),
    "本社受注" boolean,
    "運賃請求ID" integer,
    "伝票No確認用" character varying(50),
    "商品状態隠語" character varying(50),
    "届け先区分" integer,
    "運賃扱い区分" integer,
    "インポート場所ID" integer,
    "パレット使用枚数" integer,
    "倉庫受注ID" text,
    "印刷前検査待ちフラグ" boolean,
    "運賃分類ID" text,
    "運賃" text,
    "割返単価" text,
    "運賃除外" boolean,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "インポート先出庫ID" integer,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "売上科目コード" integer,
    "売上科目" character varying(255)
);

CREATE TABLE housou."TD_ロボットPrgNo_製造別" (
    "ID" integer,
    "入庫ID" integer,
    "ロボットPrgNo" integer,
    "使用パレット" character varying(255),
    "一段積載" character varying(255),
    "積み段数" integer,
    "積み付け数" integer,
    "スピード" integer,
    "長さ㎜" integer,
    "幅㎜" integer,
    "高さ㎜" integer,
    "積み付け備考" character varying(255),
    "パレット枚数" integer,
    "ニチレイ積載数" integer,
    "プログラム名" character varying(255)
);

CREATE TABLE housou."TD_予定" (
    "ID" integer,
    "日付" timestamp without time zone,
    "開始時間" timestamp without time zone,
    "終了時間" timestamp without time zone,
    "項目" character varying(50),
    "備考" character varying(255),
    "件数" integer,
    "完了チェック" boolean,
    "抽出区分" boolean,
    "工場分類" character varying(50),
    "区分" integer,
    "区分名" character varying(50),
    "担当者名" character varying(255),
    "読込元" character varying(255),
    "読込元ID" integer,
    "登録時間" character varying(255)
);

CREATE TABLE housou."TM_ロボット積み付けマスタ" (
    "ID" integer,
    "商品コード" integer,
    "段ボール品番" character varying(255),
    "ロボットプログラムNo" integer,
    "パレット" character varying(255),
    "品番" character varying(255),
    "一段積載" character varying(255),
    "最大段数" integer,
    "段数" integer,
    "積み付け数" integer,
    "箱重量" integer,
    "スピード" integer,
    "高さ㎜" integer,
    "幅㎜" integer,
    "長さ㎜" integer,
    "品番記号" character varying(255),
    "品番No" character varying(255),
    "備考" character varying(255),
    "低圧設定" boolean,
    "一段積載数" integer
);

CREATE TABLE housou_fe."TDS_出荷案内書作成" (
    "輸送ID" integer,
    "商品コード" integer,
    "本社コード" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "備考" character varying(50),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "入庫後名義" character varying(50),
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "出荷日" timestamp without time zone,
    "サービス区分" boolean,
    "商品積込順" integer,
    "リンクコード1" character varying(50),
    "抽出区分" boolean,
    "パレット単位" character varying(50),
    "印刷区分" integer,
    "備考2" character varying(50),
    "ユーザー伝票No" character varying(255)
);

CREATE TABLE housou_fe."TD_パレット在庫" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "グループコード" integer,
    "商品区分" integer,
    "変更前在庫ID" integer,
    "入庫区分" boolean,
    "最終出庫日" timestamp without time zone,
    "ストック数" integer,
    "訂正chk" boolean,
    "買取金額" double precision,
    "買取単価コード" integer,
    "買取chk" boolean,
    "支払区分" integer,
    "検査結果" integer,
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50)
);

CREATE TABLE housou_fe."TD_予想在庫" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer
);

CREATE TABLE housou_fe."TD_包装作業" (
    "ID" integer,
    "日付" timestamp without time zone,
    "出荷担当者" character varying(255),
    "休" boolean,
    "包装担当者" character varying(255),
    "包装開始時間" character varying(255),
    "出荷開始時間1" character varying(255),
    "出荷終了時間1" character varying(255),
    "出荷開始時間2" character varying(255),
    "出荷終了時間2" character varying(255),
    "出荷開始時間3" character varying(255),
    "出荷終了時間3" character varying(255),
    "出荷開始時間4" character varying(255),
    "出荷終了時間4" character varying(255),
    "包装終了時間" character varying(255),
    "退社時間" character varying(255)
);

CREATE TABLE housou_fe."TD_印刷確認" (
    "ID" integer,
    "確認項目" character varying(50),
    "オブジェクト" character varying(50),
    "完了日" timestamp without time zone,
    chk boolean,
    "グループ科目" character varying(50),
    "印刷グループ1" character varying(50),
    "印刷グループ2" character varying(50),
    "印刷グループ3" character varying(50),
    "印刷グループ4" character varying(50),
    "印刷グループ5" character varying(50),
    "印刷グループ6" character varying(50),
    "印刷グループ7" character varying(50),
    "印刷グループ8" character varying(50),
    "印刷グループ9" character varying(50),
    "印刷グループ10" character varying(50)
);

CREATE TABLE housou_fe."TD_商品分類" (
    "ID" integer,
    "分類ID" integer,
    "分類名" character varying(50)
);

CREATE TABLE housou_fe."TD_物品入庫予定" (
    "ID" integer,
    "日付" timestamp without time zone,
    "物品" character varying(255)
);

CREATE TABLE housou_fe."TD_資材入庫登録" (
    "ID" integer,
    "登録日" timestamp without time zone,
    "品番" character varying(50),
    "商品名" character varying(50),
    "数量" integer,
    "納品予定日" timestamp without time zone,
    "取引先コード" integer,
    "取引先名" character varying(50),
    chk boolean
);

CREATE TABLE housou_fe."TD_資材在庫" (
    "ID" integer,
    "使用区分" integer,
    "資材ID" integer,
    "品番" character varying(50),
    "商品名" character varying(50),
    "繰越数" integer,
    "入庫数" integer,
    "使用数" integer,
    "破損数" integer,
    "返品数" integer,
    "その他" integer,
    "在庫数" integer
);

CREATE TABLE housou_fe."TD_資材登録" (
    "ID" integer,
    "使用区分" integer,
    "日付" timestamp without time zone,
    "資材ID" integer,
    "品番" character varying(50),
    "商品名" character varying(50),
    "入庫数" integer,
    "使用数" integer,
    "破損数" integer,
    "返品数" integer,
    "その他" integer,
    "備考" character varying(255),
    "残数" integer,
    chk boolean
);

CREATE TABLE housou_fe."TMS_作業確認オブジェクト" (
    "作業ID" integer,
    "作業名" character varying(50),
    "オブジェクト名" character varying(50),
    "オブジェクトタイプ" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE housou_fe."TM_X線マスタ" (
    "ID" integer,
    "X線ID" integer,
    "カテゴリ" character varying(255),
    "登録名" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE housou_fe."TM_イベントスケジュール" (
    "ID" integer,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean,
    "使用不可" boolean,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE TABLE housou_fe."TM_カレンダー特定商品" (
    "商品コード" integer,
    "商品名" character varying(50),
    "備考" character varying(255),
    "1工備考" character varying(255),
    "2工備考" character varying(255),
    "包装備考" character varying(255)
);

CREATE TABLE housou_fe."TM_ダンボール寸法マスタ" (
    "資材ID" integer,
    "品番コード" character varying(255),
    "品番" character varying(255),
    "品名" character varying(255),
    "寸法（内寸）" character varying(255),
    "長さ" integer,
    "幅" integer,
    "高さ" integer,
    "備考" character varying(255)
);

CREATE TABLE housou_fe."TM_テープマスタ" (
    "テープID" integer,
    "テープ上" character varying(50),
    "テープ下" character varying(50)
);

CREATE TABLE housou_fe."TM_ハイ積みマスタ" (
    "ハイ積みID" integer,
    "パレットコード" integer,
    "パレット名" character varying(50),
    "総数" integer,
    "区分" character varying(50),
    "ハイ" integer,
    "パレット段数" integer,
    "備考" character varying(50),
    "ハイ積み備考" character varying(50),
    "SPID2" integer,
    "SPID3" integer,
    "SPID4" integer,
    "SPID5" integer,
    "SPID6" integer
);

CREATE TABLE housou_fe."TM_ロボット積み付けマスタold" (
    "ID" integer NOT NULL,
    "商品コード" integer,
    "段ボール品番" character varying(255),
    "ロボットプログラムNo" integer NOT NULL,
    "パレット" character varying(255),
    "品番" character varying(255),
    "一段積載" character varying(255),
    "最大段数" integer,
    "段数" integer,
    "積み付け数" integer,
    "箱重量" integer,
    "スピード" integer,
    "高さ㎜" integer,
    "幅㎜" integer,
    "長さ㎜" integer,
    "品番記号" character varying(255),
    "品番No" character varying(255),
    "備考" character varying(255),
    "低圧設定" boolean NOT NULL,
    "一段積載数" integer
);

CREATE SEQUENCE housou_fe."TM_ロボット積み付けマスタold_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE housou_fe."TM_ロボット積み付けマスタold_ID_seq" OWNED BY housou_fe."TM_ロボット積み付けマスタold"."ID";

CREATE TABLE housou_fe."TM_人員" (
    "ID" integer,
    "基本担当" character varying(255),
    "区分" character varying(255),
    "人員" character varying(255),
    "基本退社時間" timestamp without time zone
);

CREATE TABLE housou_fe."TM_仕入マスタ" (
    "ID" integer,
    "取引先コード" integer,
    "資材会社名" character varying(50),
    "会社名" character varying(255),
    "仕入コード" character varying(50),
    "品番" character varying(50),
    "資材コード" character varying(50),
    "識別条件" character varying(50),
    "本社コード" character varying(255),
    "商品名" character varying(255),
    "単位ID" integer,
    "単位" character varying(255),
    "単価" double precision,
    "商品コード" integer,
    "原料コード" integer,
    "分類ID" integer,
    "入庫分類" integer,
    "材質" character varying(50),
    "到着日数" character varying(50),
    "生産地コード" integer,
    "生産地" character varying(50)
);

CREATE TABLE housou_fe."TM_作業確認" (
    "作業ID" integer,
    "作業名" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE housou_fe."TM_作業項目" (
    "ID" integer,
    "作業項目" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE housou_fe."TM_入庫先商品別名義条件" (
    "ID" integer,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean,
    "特定条件" boolean,
    "指定冷蔵庫" boolean,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean,
    "取扱名" character varying(255),
    "横持区分" boolean,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean
);

CREATE TABLE housou_fe."TM_包装時間" (
    "ID" integer,
    "製造日" timestamp without time zone,
    "商品コード" integer,
    "品名" character varying(255),
    "台数" double precision,
    "段数" double precision,
    "1台あたり（秒）" double precision,
    "包装個数" double precision,
    "実働時間分" double precision,
    "人員" double precision,
    "備品" character varying(255),
    "不凍結A" double precision,
    "不凍結B" double precision,
    "不凍結C" double precision,
    "不凍結D" double precision,
    "備考" character varying(255),
    "ケース_秒" double precision,
    "開始時間" timestamp without time zone,
    "終了時間" timestamp without time zone
);

CREATE TABLE housou_fe."TM_区分マスタ" (
    "区分ID" integer,
    "区分名" character varying(50),
    "表現名" character varying(255)
);

CREATE TABLE housou_fe."TM_原料マスタ" (
    "原料分類ID" integer,
    "原料分類" character varying(50)
);

CREATE TABLE housou_fe."TM_参照アドレス" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE kyotsu."TM_商品マスタ" (
    "ID" integer,
    "商品コード" integer,
    "同一商品chk" boolean,
    "グループ商品コード" integer,
    "分類ID" integer,
    "短縮コード" integer,
    "本社コード" character varying(50),
    "ｶﾅ分類" character varying(1),
    "短縮名" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "非加熱品" boolean,
    "DB品番CD" character varying(50),
    "DBパットCD" character varying(255),
    "パット使用数" integer,
    "品質保持期間" double precision,
    "特別検査区分" boolean,
    "歩留" integer,
    "商品区分" integer,
    "主用原料コード" integer,
    "計量袋ID" integer,
    "取引先ID" integer,
    "取引先名" character varying(50),
    "ダンボールID" integer,
    "テープID" integer,
    "自社原料区分" integer,
    "旧コード" integer,
    "賞味期限日付差" integer,
    "標準単価" double precision,
    "売価" integer,
    "変更通知" boolean,
    "規格枚数" integer,
    "規格kg" double precision,
    "原料コード" integer,
    "等級" character varying(50),
    "サイズ" character varying(50),
    "パレット単位1" integer,
    "パレット単位2" integer,
    "特記事項" character varying(50),
    "作業工程" integer,
    "登録時間" character varying(50),
    "ロット表示区分" integer,
    "冷凍パン入数" integer,
    "現場ID" integer,
    "パレットID" integer,
    "賞味期限追記" character varying(50),
    "製造場所ID" integer,
    "製造場所" character varying(255),
    "取引先重複有無" boolean,
    "使用中止" boolean,
    "表示単位" character varying(255),
    "産地コード" integer,
    "産地通称" character varying(255),
    "特定運賃取扱区分" integer,
    "旧会社コード区分" boolean,
    "使用可能chk" boolean,
    "抽出フラグ" boolean,
    "取扱い区分" integer,
    "取扱い区分名" character varying(255),
    "積込時注意項目" character varying(255),
    "マスタ登録日" timestamp without time zone,
    "訂正区分" boolean,
    "USER賞味残日数" integer,
    "繁盛商品コード" character varying(255),
    "資材ダンボールID" integer,
    "資材計量袋ID" integer,
    "資材その他ID" integer,
    "寸法L" integer,
    "寸法H" integer,
    "寸法W" integer,
    "ロボットプログラムNo" integer
);

CREATE VIEW housou_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE housou_fe."TM_商品ラベル" (
    "ID" integer,
    "ラベル名称" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "ラベル枚数" character varying(50),
    "ラベル色" integer,
    "ラベルタイプ" integer
);

CREATE TABLE housou_fe."TM_商品分割数" (
    "ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "分割回数" integer,
    "パレット数" integer,
    "段数" integer
);

CREATE TABLE housou_fe."TM_商品区分" (
    "区分ID" integer,
    "区分名" character varying(50),
    "区分隠語" character varying(255),
    "検査日数" integer
);

CREATE TABLE housou_fe."TM_商品規格別予定時間" (
    "規格kg" integer,
    "予定時間" integer
);

CREATE TABLE housou_fe."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer
);

CREATE TABLE kyotsu."TM_得意先マスタ" (
    "ID" integer,
    "取引元ID" integer,
    "取引元" character varying(255),
    "短縮コード" integer,
    "得意先コード" character varying(255),
    "ｶﾅ分類" character varying(1),
    "得意先名" character varying(50),
    "短縮名" character varying(50),
    "地区コード" integer,
    "郵便番号" character varying(50),
    "都道府県" character varying(50),
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "倉庫区分" boolean,
    "出荷元区分" boolean,
    "入庫区分" boolean,
    "仕入帳区分" integer,
    "通常保管料" integer,
    "入出庫料" integer,
    "グループコード" integer,
    "グループコード2" integer,
    "十二地区" character varying(50),
    "受付時間" character varying(50),
    "備考" character varying(255),
    "入庫フラグ" boolean,
    "地区名" character varying(50),
    "グループコード3" integer,
    "登録時間" character varying(50),
    "必着時間" character varying(50),
    "保管区分" integer,
    "短縮名2" character varying(255),
    "隠語" character varying(20),
    "ユーザー区分" integer,
    "ユーザー区分名" character varying(255),
    "抽出フラグ" boolean,
    "丸北契約冷蔵庫区分" boolean,
    "使用不可フラグ" boolean,
    "パレット積載許容数" integer,
    "正式電話番号" character varying(255),
    "訂正区分" boolean,
    chk boolean,
    "最終使用日" timestamp without time zone,
    "繁盛取引先コード" character varying(255),
    "繁盛納入先コード" character varying(255)
);

CREATE VIEW housou_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE housou_fe."TM_本社商品マスタ" (
    "No" integer,
    "本社コード" character varying(255),
    "本社商品名" character varying(255),
    "自社本社コード" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "主仕入先ｺｰﾄﾞ" double precision,
    "主仕入先名" character varying(255),
    "入数" double precision,
    "標準価格" double precision,
    "主要取引先ID" integer,
    "取引先名" character varying(255)
);

CREATE TABLE housou_fe."TM_本社得意先マスタ" (
    "ID" integer,
    "本社届け先コード" character varying(255),
    "得意先名" character varying(255),
    "得意先名２" character varying(255),
    "郵便番号" character varying(255),
    "住所" character varying(255),
    "住所2" character varying(255),
    "本社電話番号" character varying(255),
    "本社FAX番号" character varying(255),
    "請求先コード" character varying(255),
    "請求先" character varying(255),
    "地区コード" integer,
    "都道府県" character varying(50),
    "十二地区" character varying(50),
    "地区名" character varying(50),
    "電話番号" character varying(255),
    "FAX番号" character varying(255)
);

CREATE TABLE housou_fe."TM_札色設定" (
    "ID" integer,
    "札の色" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE housou_fe."TM_用紙タイプ" (
    "ID" integer,
    "用紙タイプ" character varying(50),
    "幅" integer,
    "高さ" integer,
    "Key" integer
);

CREATE TABLE housou_fe."TM_積み付けパターン" (
    "積み付けID" integer,
    "積み付けパターン" character varying(255),
    "一段積数" integer,
    "備考" character varying(255)
);

CREATE TABLE housou_fe."TM_自動予定読込" (
    "ID" integer,
    "自動項目" character varying(50),
    "読込" boolean,
    "備考" character varying(50)
);

CREATE TABLE housou_fe."TM_資材マスタ" (
    "ID" integer,
    "取引先コード" integer,
    "資材会社名" character varying(50),
    "会社名" character varying(255),
    "仕入コード" character varying(50),
    "品番" character varying(50),
    "資材コード" character varying(50),
    "識別条件" character varying(50),
    "本社コード" character varying(255),
    "商品名" character varying(255),
    "単位ID" integer,
    "単位" character varying(255),
    "単価" double precision,
    "商品コード" integer,
    "原料コード" integer,
    "分類ID" integer,
    "入庫分類" integer,
    "材質" character varying(50),
    "到着日数" character varying(50),
    "生産地コード" integer,
    "生産地" character varying(50)
);

CREATE TABLE housou_fe."TM_資材会社マスタ" (
    "コード" integer,
    "資材会社名" character varying(50),
    "短縮名" character varying(50)
);

CREATE TABLE housou_fe."TM_車両区分" (
    "車両区分ID" integer,
    "車両区分" character varying(50),
    "積載量" integer
);

CREATE TABLE housou_fe."TM_運送会社マスタ" (
    "ID" integer,
    "小口配送区分" boolean,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean,
    "eLixxi扱い便CD" character varying(255)
);

CREATE TABLE housou_fe."TM_集荷先別パレット設定" (
    "ID" integer,
    "集荷先ID" integer,
    "集荷先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "パレット単位" integer,
    "特定パレット単位" integer,
    "段数" integer
);

CREATE TABLE housou_fe."T_Googleカレンダー出力" (
    "Subject" character varying(255),
    "Start Date" character varying(255),
    "Start Time" character varying(255),
    "End Date" character varying(255),
    "End Time" character varying(255),
    "All Day Event" boolean,
    "Description" character varying(255),
    "Location" character varying(255),
    "Private" boolean
);

CREATE TABLE housou_fe."T_Oxpa出力データ" (
    "F1" character varying(255),
    "プログラム" character varying(255),
    "プログラムNo" integer,
    "出力項目" character varying(255),
    "値" integer,
    "箱重量" integer,
    "ID" integer
);

CREATE TABLE housou_fe."T_パレット在庫管理" (
    "ID" integer,
    "倉庫ID" integer,
    "パレット先コード" integer,
    "日付" timestamp without time zone,
    "繰越" integer,
    "空入庫" integer,
    "原料入庫" integer,
    "出庫" integer,
    "在庫" integer,
    "備考" character varying(255),
    "輸送ID" integer
);

CREATE TABLE housou_fe."T_パレット在庫管理 のコピー" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "パレット先コード" integer,
    "日付" timestamp without time zone,
    "繰越" integer,
    "入庫" integer,
    "出庫" integer,
    "在庫" integer,
    "備考" character varying(255),
    "出庫ID入庫" integer,
    "輸送ID出荷" integer
);

CREATE SEQUENCE housou_fe."T_パレット在庫管理 のコピー_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE housou_fe."T_パレット在庫管理 のコピー_ID_seq" OWNED BY housou_fe."T_パレット在庫管理 のコピー"."ID";

CREATE TABLE housou_fe."T_入荷スケジュール" (
    "ID" integer,
    "月" character varying(255),
    "日付" timestamp without time zone,
    "曜日" character varying(10),
    "品名" character varying(255)
);

CREATE TABLE housou_fe."T_包装数量チェック表" (
    "ID" integer,
    "カードの色" character varying(255),
    "検査区分" character varying(255),
    "札の色" character varying(255),
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(255),
    "ケース" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "管理備考" character varying(255),
    "計量元数" integer,
    "箱詰枚数" character varying(255),
    "仕掛枚数" integer,
    "開始No" integer,
    "終了No" integer,
    "段数" integer,
    "タグ" character varying(255),
    "規格枚数" integer,
    "DB枚数" integer
);

CREATE TABLE housou_fe."T_包装札作成" (
    "包装順" integer,
    "No" integer,
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "ケース" integer,
    "テープID" integer,
    "検査区分" character varying(50),
    "タグ" character varying(50),
    "カードカラー" integer,
    "出荷停止" character varying(255),
    "パレットID" integer,
    "使用パレット" character varying(255),
    "入庫ID" integer,
    "ロケーションNo" character varying(255),
    "未包装区分" boolean,
    "検体区分" boolean,
    "出荷数" integer,
    "残数" integer,
    "短縮商品名" character varying(255)
);

CREATE TABLE housou_fe."T_日別予想kg" (
    "ID" integer,
    "日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "在庫ケース" integer,
    "入庫ケース" integer,
    "入庫kg" integer,
    "出庫ケース" integer,
    "製造kg" integer,
    "出荷kg" integer,
    "在庫kg" integer,
    "作成日" character varying(255),
    "在庫パレット数" integer,
    "繰越パレット数" integer,
    "包装使用パレット数" integer,
    "出荷戻りパレット数" integer
);

CREATE TABLE housou_fe."T_本社売上転記テーブル" (
    "ID" integer,
    "本社コード" character varying(255),
    "商品コード" integer,
    "本社商品コード" character varying(255),
    "商品名" character varying(255),
    "売上個数" character varying(255),
    "売上金額" character varying(255),
    "入数" character varying(255),
    "商品kg" character varying(255),
    "売上日" character varying(255),
    "10" character varying(255),
    "本社届け先コード" character varying(255),
    "本社得意先名" character varying(255),
    "本社得意先名2" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "取引元コード" integer,
    "取引元名" character varying(255),
    "フィールド1" character varying(255)
);

CREATE TABLE housou_fe."T_生産計画予定表" (
    "製造日" timestamp without time zone,
    "商品名1工" character varying(50),
    "ケース1工" integer,
    "商品kg1工" integer,
    "DB品番1工" character varying(50),
    "DB数量1工" integer,
    "冷凍パン1工" integer,
    "DB会社1工" character varying(50),
    "商品名2工" character varying(50),
    "ケース2工" integer,
    "商品kg2工" integer,
    "DB品番2工" character varying(50),
    "DB数量2工" integer,
    "冷凍パン2工" integer,
    "DB会社2工" character varying(50),
    "ラベル1工" character varying(50),
    "ラベル2工" character varying(50),
    "パット1工" character varying(50),
    "パット2工" character varying(50),
    "パレット数1工" integer,
    "パレット数2工" integer,
    chk boolean,
    "休日フラグ" boolean,
    "日付項目" character varying(50),
    "備考" character varying(255),
    "包装予定時間" integer,
    "入庫日" timestamp without time zone,
    "出勤時間" character varying(255)
);

CREATE TABLE housou_fe."T_生産計画予定表ver2" (
    "製造日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "ケース" integer,
    "商品kg" integer,
    "DB品番" character varying(50),
    "DB数量" integer,
    "DB予定数量" integer,
    "冷凍パン" integer,
    "DB会社" character varying(50),
    "ラベル" character varying(50),
    "パット" character varying(50),
    "パレット数" integer,
    chk boolean,
    "休日フラグ" boolean,
    "日付項目" character varying(50),
    "備考" character varying(255),
    "包装予定時間" integer,
    "入庫日" timestamp without time zone,
    "資材ID" integer,
    "グループ商品コード" integer,
    "製造現場" character varying(255),
    "積み付け数" integer,
    "当日出荷数" integer,
    "ニチレイ大谷地行き数" integer,
    "ニチレイ十勝行き数" integer,
    "出勤時間" character varying(255),
    "大谷地パレット使用数" integer,
    "十勝パレット使用数" integer,
    "倉庫ID" integer
);

CREATE TABLE juchu."TD_受注" (
    "受注受付ID" integer,
    "受注ID" integer,
    "受注日" timestamp without time zone,
    "受注番号" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(50),
    "受注帳合ID" integer,
    "受注帳合名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "残ケース" integer,
    "商品kg" double precision,
    "残kg" double precision,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "正式届け先名" character varying(255),
    "単価" double precision,
    "請求金額" integer,
    "備考" character varying(255),
    "社内連絡" character varying(255),
    chk boolean,
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" smallint,
    "枝番1" character varying(50),
    "枝番2" character varying(50),
    "枝番3" character varying(50),
    "登録時間" character varying(255),
    "更新時間" character varying(255),
    "受注番号1" character varying(255),
    "商品コード1" integer,
    "ケース1" integer,
    "商品kg1" double precision,
    "届け先コード1" integer,
    "納品日1" timestamp without time zone,
    "相手届け先コード" integer,
    "入力日" timestamp without time zone,
    "入庫名義ID" integer,
    "出荷予定日" timestamp without time zone,
    "送り状No" character varying(255),
    "手配DataChk" boolean,
    "入力確認チェック" boolean,
    "受注手配確認" boolean,
    "受注出庫確認" boolean,
    "出庫返信FAX確認" boolean,
    "受注グループID" integer,
    "輸送手配返信確認" boolean,
    "受領書確認" boolean,
    "受注返信FAX" boolean,
    "取引元ID" integer,
    "取引元" character varying(255),
    "取引帳合ID" character varying(255),
    "取引帳合" character varying(255),
    "受注区分" integer,
    "賞味期限送信" boolean,
    "本社受注" boolean,
    "消費税" integer,
    "税込請求金額" integer,
    "送品案内" boolean,
    "出力用chk" boolean,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "伝票作成" boolean,
    "伝票送付" boolean,
    "本社受注ID" integer,
    "初回登録chk" boolean,
    "受注ユーザーID" integer,
    "受注ユーザー名" character varying(255),
    "伝票FAX" boolean,
    "完了消込" boolean,
    "丸北出荷数" integer,
    "倉庫出荷数" integer,
    "転売出荷数" integer,
    "統一受注ID" character varying(255),
    "年間受注ID" integer,
    "月間カウンタ" integer,
    "月間No" integer,
    "隠語" character varying(255),
    "運賃振分区分" integer,
    "運賃請求ID" integer,
    "変更前ケース" integer,
    "変更前商品kg" double precision,
    "少量残連絡chk" boolean,
    "少量残連絡備考" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "蔵前区分" boolean,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "販盛売上行" character varying(255),
    "販盛売上番号" character varying(255),
    "販盛伝票番号" character varying(255),
    "手配出庫番号" character varying(255),
    "手配輸送番号" character varying(255)
);

CREATE TABLE juchu."TD_受注受付" (
    "受注受付ID" integer,
    "受注番号" character varying(255),
    "受注元ID" integer,
    "受注先ID" integer,
    "受注先名" character varying(50),
    "備考" character varying(255),
    "登録時間" character varying(255),
    "発注日" character varying(255),
    "納品指定日" character varying(255),
    "納品場所コード" character varying(255),
    "納品場所" character varying(255),
    "電話番号" character varying(255),
    "相手先登録日" character varying(255),
    "相手先登録時間" character varying(255),
    chk boolean,
    "受注カウンタ" integer,
    "受注帳合ID" integer,
    "受注帳合名" character varying(255)
);

CREATE TABLE juchu."TM_相手先商品マスタ" (
    "受注元コード" integer,
    "受注元" character varying(255),
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "相手先商品コード" character varying(255),
    "相手先商品名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "帳合先コード1" character varying(255),
    "帳合先1" character varying(255),
    "相手先商品コード1" character varying(255),
    "相手先商品名1" character varying(50),
    "帳合先コード2" character varying(255),
    "帳合先2" character varying(255),
    "相手先商品コード2" character varying(255),
    "相手先商品名2" character varying(50),
    "本社商品コード" character varying(255),
    chk boolean,
    "備考" character varying(255),
    "製造場所ID" integer,
    "指定倉庫ID" integer,
    "使用不可" boolean
);

CREATE TABLE juchu_fe."M_Webアドレス操作" (
    "ID" integer,
    "実行名" character varying(255),
    "実行グループ名" character varying(255),
    "指定サイト" text,
    "検索ワード" character varying(255),
    "備考" character varying(255),
    "動作1" character varying(255),
    "動作2" character varying(255),
    "動作3" character varying(255),
    "動作4" character varying(255),
    "動作5" character varying(255),
    "動作6" character varying(255),
    "動作7" character varying(255),
    "動作8" character varying(255),
    "動作9" character varying(255),
    "動作10" character varying(255)
);

CREATE TABLE juchu_fe."TD_USER" (
    "ID" integer,
    "使用者コード" integer,
    "使用者名" character varying(50),
    "パスワード" integer,
    "前回更新日" timestamp without time zone,
    "更新時間" character varying(50),
    "確認時間" timestamp without time zone,
    "最終読込日" character varying(50),
    "リンクアドレス" character varying(255),
    "税率設定" real,
    "データ保持区分" smallint,
    "初期起動" boolean,
    "日時更新日" timestamp without time zone,
    "仮アドレス" character varying(255),
    "指定アドレス" character varying(255),
    "集計終了日" timestamp without time zone,
    "チェック期間" integer,
    "受注ファイルアドレス" character varying(255),
    "受注ファイル仮アドレス" character varying(255),
    "販盛単価マスタ取得日" character varying(255)
);

CREATE TABLE juchu_fe."TD_商品分類" (
    "ID" integer,
    "分類ID" integer,
    "分類名" character varying(50)
);

CREATE TABLE juchu_fe."TM_ふらのソース受注マスタ" (
    "ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "規格" character varying(255),
    "入数" double precision,
    "入力順番" integer,
    chk boolean,
    "旧　入力順番" character varying(255),
    "フィールド1" integer
);

CREATE TABLE juchu_fe."TM_イベントスケジュール" (
    "ID" integer,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean,
    "使用不可" boolean,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE TABLE juchu_fe."TM_丸北商品届け先別売上単価マスタ" (
    "取引元コード" integer,
    "取引元名" character varying(255),
    "請求先ID" integer,
    "請求先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "kg販売単価" double precision,
    "本社コード" character varying(255),
    "商品コード" integer,
    "品名" character varying(255),
    "商品名" character varying(255),
    "規格" character varying(255),
    "開始日" timestamp without time zone,
    "終了日" timestamp without time zone,
    "計算単位ID" integer,
    "単位" character varying(255),
    "備考" character varying(255),
    "扱い" double precision
);

CREATE TABLE juchu_fe."TM_備考欄" (
    "ID" integer,
    "分類" character varying(50),
    "作業分類" character varying(50),
    "備考欄" character varying(255),
    "リンクID" integer,
    "得意先名" character varying(50),
    "使用頻度" integer,
    "登録日" character varying(50)
);

CREATE TABLE juchu_fe."TM_入庫先商品別名義条件" (
    "ID" integer NOT NULL,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean NOT NULL,
    "特定条件" boolean NOT NULL,
    "指定冷蔵庫" boolean NOT NULL,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean NOT NULL,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean NOT NULL,
    "取扱名" character varying(255),
    "横持区分" boolean NOT NULL,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean NOT NULL,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean NOT NULL
);

CREATE SEQUENCE juchu_fe."TM_入庫先商品別名義条件_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE juchu_fe."TM_入庫先商品別名義条件_ID_seq" OWNED BY juchu_fe."TM_入庫先商品別名義条件"."ID";

CREATE TABLE juchu_fe."TM_出荷依頼先選択" (
    "取引先ID" integer,
    "取引先名" character varying(255),
    "本社受注" boolean
);

CREATE TABLE juchu_fe."TM_単位マスタ" (
    "ID" integer,
    "単位コード" integer,
    "単位" character varying(50)
);

CREATE TABLE juchu_fe."TM_原料マスタ" (
    "原料分類ID" integer,
    "原料分類" character varying(50)
);

CREATE TABLE juchu_fe."TM_参照アドレス" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE juchu_fe."TM_参照アドレスHOUSOU" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE juchu_fe."TM_取り扱い区分マスタ" (
    "ID" integer,
    "分類" character varying(255),
    "取扱い区分ID" integer,
    "区分名" character varying(255)
);

CREATE TABLE juchu_fe."TM_受注グループ" (
    "ID" integer,
    "受注先マスタID" integer,
    "製造区分" integer,
    "取引先ID" integer,
    "取引先名" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(255),
    "受注帳合ID" integer,
    "受注帳合名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "請求先コード" integer,
    "請求先名" character varying(255),
    "備考" character varying(50),
    "道内区分" boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "本社コード" character varying(255),
    "本社売上コード" integer,
    "本社売上先" character varying(255),
    "受注フォーム選択" character varying(255),
    "単価" double precision
);

CREATE TABLE juchu_fe."TM_受注先マスタ" (
    "本社受注" boolean,
    "ID" integer,
    "受注区分" integer,
    "取引先ID" integer,
    "取引先名" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(255),
    "受注帳合ID" integer,
    "受注帳合先名" character varying(255),
    "指定届け先コード" integer,
    "指定届け先" character varying(255),
    "ユーザー区分" character varying(255),
    "指定入庫名義ID" integer,
    "指定入庫後名義名" character varying(255),
    "最終使用日" timestamp without time zone,
    "指定倉庫ID" integer,
    "指定倉庫名" character varying(255),
    "備考" character varying(50),
    "道内区分" boolean,
    "転売区分" boolean,
    "一般ユーザー" boolean,
    "仕入区分" boolean,
    "伝票送付" boolean,
    "デポ区分" boolean,
    "使用不可" boolean,
    "取扱い区分" integer
);

CREATE TABLE juchu_fe."TM_受注区分" (
    "ID" integer,
    "受注区分" integer,
    "受注区分名" character varying(255)
);

CREATE TABLE juchu_fe."TM_受注検索方法" (
    "ID" integer,
    "検索方法ID" integer,
    "選択方法" character varying(255),
    "コメント" character varying(255),
    "備考" character varying(255),
    "順番No1" integer,
    "順番No2" integer,
    "順番No3" integer,
    "順番No4" integer
);

CREATE TABLE juchu_fe."TM_受注特定項目" (
    "ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "備考" character varying(255),
    "入力時間" character varying(255)
);

CREATE VIEW juchu_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE juchu_fe."TM_商品区分" (
    "区分ID" integer,
    "区分名" character varying(50)
);

CREATE TABLE juchu_fe."TM_商品隠語マスタ" (
    "ID" integer,
    "隠語" character varying(255),
    "隠語グループ" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ストックユーザーコード" integer,
    "ストックユーザー名" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "備考" character varying(255),
    "フィールド1" text
);

CREATE TABLE juchu_fe."TM_営業冷蔵庫倉庫商品マスタ" (
    "ID" integer,
    "取引元ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "倉庫商品名" character varying(255),
    "倉庫商品コード" integer,
    "本社コード" character varying(255)
);

CREATE TABLE juchu_fe."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer,
    "着地日数" integer
);

CREATE TABLE juchu_fe."TM_売上単価マスタ" (
    "ID" integer,
    "受注元ID" integer,
    "受注元" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "単価" double precision,
    "計算単位ID" integer,
    "計算単位" character varying(255),
    "開始期間" timestamp without time zone,
    "終了期間" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "備考" character varying(255),
    "特別単価区分" integer,
    "年度" integer,
    "計算区分" integer
);

CREATE VIEW juchu_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE juchu_fe."TM_得意先区分" (
    "得意先区分コード" integer,
    "区分名" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE juchu_fe."TM_枝処理マスタ" (
    "ID" integer,
    "枝番" character varying(255),
    "枝処理名" character varying(255)
);

CREATE TABLE juchu_fe."TM_産地マスタ" (
    "産地コード" integer,
    "生産地" character varying(50),
    "区分" character varying(50)
);

CREATE TABLE juchu_fe."TM_相手先届け先マスタ" (
    "ID" integer,
    "相手方届け先コード" character varying(50),
    "自社コード" integer,
    "届け先" character varying(50),
    "相手先コード" integer,
    "相手先名" character varying(50),
    "区分名" character varying(255),
    "相手先名称" character varying(255)
);

CREATE TABLE juchu_fe."TM_製造場所" (
    "製造場所ID" integer,
    "製造場所" character varying(255),
    "短縮名" character varying(255),
    "倉庫ID" integer
);

CREATE TABLE juchu_fe."TM_運送会社マスタ" (
    "ID" integer,
    "小口配送区分" boolean,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean,
    "eLixxi扱い便CD" character varying(255)
);

CREATE TABLE juchu_fe."T_エスビーweb受注" (
    "ID" integer,
    "オーダーNo" double precision,
    "進捗状況" character varying(255),
    "依頼元" character varying(255),
    "納入先" character varying(255),
    "工場品目" character varying(255),
    "品目名称" character varying(255),
    "今回納期" timestamp without time zone,
    "前回納期" timestamp without time zone,
    "今回依頼数" double precision,
    "前回依頼数" double precision,
    "単位" character varying(255),
    "備考" character varying(255),
    "依頼書No" double precision,
    "行No" double precision,
    "受信日" timestamp without time zone,
    "納期回答" timestamp without time zone,
    "数量回答" double precision,
    "補足" character varying(255),
    "納期分割" character varying(255),
    "分割納期" character varying(255),
    "分割数量" double precision,
    "確認日" timestamp without time zone,
    "確認者" character varying(255),
    "回答送信日" timestamp without time zone,
    "回答送信者" character varying(255),
    "SB担当者" character varying(255),
    "電話番号" character varying(255),
    "E-Mail" character varying(255),
    "取込みチェック" boolean,
    "取込み備考" character varying(255),
    "選択chk" boolean,
    "丸北受注ID" integer
);

CREATE TABLE juchu_fe."T_本社売上転記テーブル" (
    "ID" integer,
    "本社コード" character varying(255),
    "商品コード" character varying(255),
    "本社商品コード" character varying(255),
    "商品名" character varying(255),
    "売上個数" integer,
    "売上金額" double precision,
    "入数" double precision,
    "商品kg" double precision,
    "売上日" character varying(255),
    "10" character varying(255),
    "本社届け先コード" character varying(255),
    "本社得意先名" character varying(255),
    "本社得意先名2" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "取引元コード" integer,
    "取引元名" character varying(255),
    "フィールド1" character varying(255),
    "売上単価" double precision
);

CREATE TABLE juchu_fe."T_販盛単価マスタ" (
    "ID" integer,
    "取引先コード" double precision,
    "取引先名" character varying(255),
    "納入先コード" double precision,
    "納入先名" character varying(255),
    "期間開始日" timestamp without time zone,
    "期間終了日" timestamp without time zone,
    "商品コード" double precision,
    "商品名" character varying(255),
    "単位コード" double precision,
    "単位名" character varying(255),
    "特売区分" double precision,
    "特売区分名" character varying(255),
    "単価" double precision
);

CREATE TABLE juchu_fe."T_販盛受注" (
    "ID" integer,
    "得意先コード" character varying(255),
    "取引先短縮コード" character varying(255),
    "得意先名" character varying(255),
    "受注日" character varying(255),
    "伝票番号" character varying(255),
    "出荷予定日" character varying(255),
    "支店コード" character varying(255),
    "支店名" character varying(255),
    "部門コード" character varying(255),
    "部門名" character varying(255),
    "担当者名" character varying(255),
    "摘要" character varying(255),
    "消費税計算" character varying(255),
    "行" character varying(255),
    "区分" character varying(255),
    "品目コード" character varying(50),
    "品目短縮コード" character varying(255),
    "品名" character varying(255),
    "産地コード" character varying(255),
    "産地名" character varying(255),
    "規格" character varying(255),
    "入数" character varying(255),
    "合数" character varying(255),
    "箱数" character varying(255),
    "単位" character varying(255),
    "数量" character varying(255),
    "受注残数量" character varying(255),
    "重量(kg)" character varying(255),
    "原価" character varying(255),
    "単価" character varying(255),
    "受注額" character varying(255),
    "粗利" character varying(255),
    "消費税課税" character varying(255),
    "消費税額" character varying(255),
    "納品予定日" character varying(255),
    "明細摘要" character varying(255),
    "納入先コード" character varying(255),
    "納入先短縮コード" character varying(255),
    "納入先名" character varying(255),
    "外部番号" character varying(255),
    "ハッシュ" text,
    "取込みチェック" boolean,
    "取込み備考" character varying(255),
    "選択chk" boolean,
    "丸北受注ID" integer,
    "変換丸北届け先コード" integer
);

CREATE TABLE juchu_fe."T_販盛売上" (
    "ID" integer,
    "得意先コード" character varying(255),
    "取引先短縮コード" integer,
    "得意先名" character varying(255),
    "納入先コード" integer,
    "納入先短縮コード" integer,
    "納入先名" character varying(255),
    "売上日" timestamp without time zone,
    "伝票番号" integer,
    "請求日" timestamp without time zone,
    "支店コード" integer,
    "支店名" character varying(255),
    "部門コード" integer,
    "部門名" character varying(255),
    "担当者コード" integer,
    "担当者名" character varying(255),
    "摘要" character varying(255),
    "消費税計算" character varying(255),
    "行" integer,
    "区分" character varying(255),
    "大分類コード" integer,
    "大分類" character varying(255),
    "中分類コード" integer,
    "中分類" character varying(255),
    "小分類コード" integer,
    "小分類" character varying(255),
    "品目コード" character varying(255),
    "品目短縮コード" integer,
    "品名" character varying(255),
    "規格" character varying(255),
    "産地コード" character varying(255),
    "産地名" character varying(255),
    "入数" double precision,
    "合数" integer,
    "箱数" integer,
    "数量" integer,
    "単位" character varying(255),
    "重量(kg)" double precision,
    "原価" double precision,
    "単価" integer,
    "売上額" integer,
    "Kg単価" double precision,
    "税率" character varying(255),
    "消費税課税" character varying(255),
    "粗利" integer,
    "納品予定日" timestamp without time zone,
    "明細摘要" character varying(255),
    "受注伝票番号" integer,
    "受注行番号" integer,
    "受注伝票日" timestamp without time zone,
    "直送" character varying(255),
    "仕入先コード" character varying(255),
    "仕入先短縮コード" integer,
    "仕入先名" character varying(255),
    "区分コード" integer,
    "単位コード" integer,
    "軽減税率区分" integer,
    "消費税率" integer,
    "消費税区分" integer,
    "返品元日付" character varying(255),
    "運送会社コード" character varying(255),
    "運送会社名" character varying(255),
    "メモ１" character varying(255),
    "メモ２" character varying(255),
    "メモ３" character varying(255),
    "メモ数量１" integer,
    "メモ数量２" integer,
    "メモ数量３" integer,
    "譲渡人負担日" character varying(255),
    "譲受人負担日" character varying(255),
    "メモ日付１" character varying(255),
    "メモ日付２" character varying(255),
    "外部番号" character varying(255),
    "予定賞味期限" character varying(255),
    "取込みチェック" boolean,
    "取込み備考" character varying(255),
    "選択chk" boolean,
    "丸北受注ID" integer,
    "アンマッチフラグ" boolean,
    "参照Kg単価" double precision
);

CREATE TABLE juchu_fe."T_販盛売上出力確認用_出荷" (
    "販盛伝票番号" character varying(255),
    "枝番3" character varying(255),
    "輸送ID" integer,
    "出庫ID" integer,
    "出荷日" timestamp without time zone,
    "届け先" character varying(255),
    "届け先コード" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "ﾀｸﾞ" character varying(255),
    "入庫No" character varying(255),
    "ケース" integer,
    "商品kg" double precision,
    "納品日" timestamp without time zone,
    "受注ID" integer
);

CREATE TABLE juchu_fe."名前の自動修正保存エラー" (
    "オブジェクト名" character varying(255),
    "オブジェクトの種類" character varying(255),
    "エラーの原因" character varying(255),
    "時刻" timestamp without time zone
);

CREATE TABLE juchu_fe."貼り付けエラー" (
    "cmb_取引元" text,
    "テキスト78" text,
    "得意先短縮コード" integer,
    "得意先名" character varying(255),
    "テキスト52" character varying(255),
    "本社商品コード" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "製造場所ID" character varying(255),
    "帳合先コード1" character varying(255),
    "相手先商品名" character varying(255),
    "指定倉庫ID" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE keikaku."TD_入庫_訂正" (
    "入庫ID" integer,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "原料コード" integer,
    "原料" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "未包装kg" double precision,
    "原料kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "未包装区分" boolean,
    "備考" character varying(50),
    chk boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "抽出区分" boolean,
    "出荷止め" boolean,
    "DB枚数" integer,
    "DB破損" integer,
    "DB異物" integer,
    "袋破損" integer,
    "確認者" character varying(50),
    "更新日" timestamp without time zone,
    "分類ID" integer,
    "食味" boolean,
    "未包装時ID" integer,
    "管理備考" character varying(50),
    "更新時間" character varying(50),
    "仕掛chk" boolean,
    "ユーザーchk" boolean,
    "作業場" character varying(50),
    "受注読込" boolean,
    "作業開始時間" timestamp without time zone,
    "作業終了時間" timestamp without time zone,
    "段ボールID" integer,
    "袋ID" integer,
    "検査区分" character varying(50),
    "変更通知" character varying(50),
    "再生数" integer,
    "再生備考" character varying(50),
    "数量確定フラグ" integer,
    "製造表記" character varying(50),
    "商品区分" integer,
    "検査予定日" timestamp without time zone,
    "計量元数" integer,
    "箱詰枚数" character varying(50),
    "仕掛枚数" integer,
    "再生枚数" integer,
    "廃棄枚数" integer,
    "製造予定枚数" integer,
    "入庫元数" integer,
    "開始No" integer,
    "終了No" integer,
    "段数" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "製造ID" integer,
    "製造識別コード" character varying(255)
);

CREATE TABLE keikaku."TD_前回生産計画" (
    "製造ID" integer,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "原料コード" integer,
    "原料" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "原料kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "備考" character varying(50),
    chk boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "抽出区分" boolean,
    "更新日" timestamp without time zone,
    "分類ID" integer,
    "冷凍原料手配区分" boolean,
    "未包装時ID" integer,
    "管理備考" character varying(50),
    "更新時間" character varying(50),
    "ストック数" integer,
    "ユーザーchk" boolean,
    "作業場" character varying(50),
    "受注読込" boolean,
    "作業開始時間" timestamp without time zone,
    "作業終了時間" timestamp without time zone,
    "段ボールID" integer,
    "袋ID" integer,
    "検査区分" character varying(50),
    "袋破損備考" character varying(50),
    "再生数" integer,
    "再生備考" character varying(50),
    "数量確定フラグ" integer,
    "製造表記" character varying(50),
    "商品区分" integer,
    "検査予定日" timestamp without time zone,
    "計量元数" integer,
    "箱詰枚数" character varying(50),
    "仕掛枚数" integer,
    "再生枚数" integer,
    "廃棄枚数" integer,
    "製造予定枚数" integer,
    "入庫元数" integer,
    "開始No" integer,
    "終了No" integer,
    "段数" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "製造識別コード" character varying(255),
    "通知" character varying(255),
    "作成日" character varying(50),
    "変更記録" character varying(255),
    "確認済みチェック" boolean,
    "繁盛商品コード" character varying(255)
);

CREATE TABLE keikaku."TD_商品分類" (
    "ID" integer,
    "分類ID" integer,
    "分類名" character varying(50)
);

CREATE TABLE keikaku."TD_架空在庫" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer
);

CREATE TABLE keikaku."TD_架空在庫ver2" (
    "作成日付" timestamp without time zone,
    "架空ID" integer,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" integer,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "仮想ID" text
);

CREATE TABLE keikaku."TD_物品入庫予定" (
    "ID" integer,
    "日付" timestamp without time zone,
    "物品" character varying(255)
);

CREATE TABLE keikaku."TD_生産計画変更案内" (
    "製造ID" integer,
    "入庫ID" integer,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "原料コード" integer,
    "原料" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "未包装kg" double precision,
    "原料kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "未包装区分" boolean,
    "備考" character varying(50),
    chk boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "抽出区分" boolean,
    "出荷止め" boolean,
    "DB枚数" integer,
    "DB破損" integer,
    "DB異物" integer,
    "袋破損" integer,
    "確認者" character varying(50),
    "更新日" timestamp without time zone,
    "分類ID" integer,
    "食味" boolean,
    "未包装時ID" integer,
    "管理備考" character varying(50),
    "更新時間" character varying(50),
    "ストック数" integer,
    "ユーザーchk" boolean,
    "作業場" character varying(50),
    "受注読込" boolean,
    "作業開始時間" timestamp without time zone,
    "作業終了時間" timestamp without time zone,
    "段ボールID" integer,
    "袋ID" integer,
    "検査区分" character varying(50),
    "袋破損備考" character varying(50),
    "再生数" integer,
    "再生備考" character varying(50),
    "数量確定フラグ" integer,
    "製造表記" character varying(50),
    "商品区分" integer,
    "検査予定日" timestamp without time zone,
    "計量元数" integer,
    "箱詰枚数" character varying(50),
    "仕掛枚数" integer,
    "再生枚数" integer,
    "廃棄枚数" integer,
    "製造予定枚数" integer,
    "入庫元数" integer,
    "開始No" integer,
    "終了No" integer,
    "段数" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "製造識別コード" character varying(255),
    "通知" character varying(255),
    "作成日" character varying(50),
    "変更記録" character varying(255),
    "確認済みチェック" boolean,
    "繁盛商品コード" character varying(255)
);

CREATE TABLE keikaku."TD_計量総数" (
    "商品コード" integer,
    "計量総数" integer,
    "カード台数" integer,
    "端数1" integer,
    "端数2" integer,
    "端数3" integer,
    "端数4" integer,
    "端数5" integer,
    "端数6" integer,
    "端数7" integer,
    "端数8" integer,
    "端数9" integer,
    "端数10" integer
);

CREATE TABLE keikaku."TD_資材入庫登録" (
    "ID" integer,
    "変更chk" boolean,
    "製造識別コード" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "製造予定日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "DBパットCD" character varying(255),
    "DBパット発注数" integer,
    "DB品番CD" character varying(50),
    "製造予定数" integer,
    "DB発注数" integer,
    "納品予定日" timestamp without time zone,
    "取引先コード" integer,
    "取引先名" character varying(50),
    chk boolean,
    "通知" character varying(255),
    "発注日" timestamp without time zone,
    "発注時間" timestamp without time zone,
    "登録日" timestamp without time zone,
    "予測在庫D" integer,
    "予測在庫P" integer,
    "備考" character varying(255)
);

CREATE TABLE keikaku."TD_資材在庫" (
    "ID" integer,
    "使用区分" integer,
    "倉庫ID" real,
    "倉庫名" character varying(255),
    "DB品番CD" character varying(50),
    "繰越数" integer,
    "入庫数" integer,
    "使用数" integer,
    "破損数" integer,
    "返品数" integer,
    "その他" integer,
    "在庫数" integer
);

CREATE TABLE keikaku."TD_資材登録" (
    "ID" integer,
    "使用区分" integer,
    "日付" timestamp without time zone,
    "資材ID" integer,
    "品番" character varying(50),
    "商品名" character varying(50),
    "入庫数" integer,
    "使用数" integer,
    "破損数" integer,
    "返品数" integer,
    "その他" integer,
    "備考" character varying(255),
    "残数" integer,
    chk boolean
);

CREATE TABLE keikaku."TM_イベントスケジュール" (
    "ID" integer,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean,
    "使用不可" boolean,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE TABLE keikaku."TM_エリアコード" (
    "地区コード" integer,
    "地区名" character varying(50)
);

CREATE TABLE keikaku."TM_グループマスタ" (
    "グループID" integer,
    "グループ名" character varying(50)
);

CREATE TABLE keikaku."TM_サービス設定" (
    "ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "サービス範囲" integer,
    "備考" character varying(50)
);

CREATE TABLE keikaku."TM_テープマスタ" (
    "テープID" integer,
    "テープ上" character varying(50),
    "テープ下" character varying(50)
);

CREATE TABLE keikaku."TM_ハイ積みマスタ" (
    "ハイ積みID" integer,
    "パレットコード" integer,
    "パレット名" character varying(50),
    "総数" integer,
    "区分" character varying(50),
    "ハイ" integer,
    "パレット段数" integer,
    "備考" character varying(50),
    "ハイ積み備考" character varying(50),
    "SPID2" integer,
    "SPID3" integer,
    "SPID4" integer,
    "SPID5" integer,
    "SPID6" integer
);

CREATE TABLE keikaku."TM_パレットマスタ" (
    "パレットコード" integer,
    "パレット名" character varying(50),
    "区分" character varying(50),
    "元数" integer,
    "繰越数" integer,
    "入庫数" integer,
    "使用数" integer,
    "在庫数" integer
);

CREATE TABLE keikaku."TM_レポート作成" (
    "ID" integer,
    "表題" character varying(50),
    "宛名" character varying(50),
    "出荷日1" character varying(50),
    "出荷日2" character varying(50),
    "製造日1" character varying(50),
    "製造日2" character varying(50),
    "納品日1" character varying(50),
    "納品日2" character varying(50),
    "届け先コード" integer,
    "倉庫ID" integer,
    "取引元ID" integer,
    "運送会社ID" integer,
    "商品コード" integer,
    "入庫前名義" integer,
    "入庫後名義" integer,
    "商品分類" integer,
    "商品分類等号" character varying(50),
    "レポートタイプ" integer,
    "作成日時" timestamp without time zone,
    "ヘッダー" integer,
    "フッダー" integer,
    "並び順" character varying(50),
    "出荷グループ" integer,
    "届けグループ" integer,
    "No1" smallint,
    "No2" smallint,
    "No3" smallint,
    "No4" smallint,
    "No5" smallint,
    "No6" smallint,
    "No7" smallint,
    "No8" smallint,
    "No9" smallint,
    "No10" smallint,
    "No11" smallint,
    "抽出品名" character varying(50)
);

CREATE TABLE keikaku."TM_仕入マスタ" (
    "ID" integer,
    "取引先コード" integer,
    "資材会社名" character varying(50),
    "会社名" character varying(255),
    "仕入コード" character varying(50),
    "品番" character varying(50),
    "資材コード" character varying(50),
    "識別条件" character varying(50),
    "本社コード" character varying(255),
    "商品名" character varying(255),
    "単位ID" integer,
    "単位" character varying(255),
    "単価" double precision,
    "商品コード" integer,
    "原料コード" integer,
    "分類ID" integer,
    "入庫分類" integer,
    "材質" character varying(50),
    "到着日数" character varying(50),
    "生産地コード" integer,
    "生産地" character varying(50)
);

CREATE TABLE keikaku."TM_仕掛区分" (
    "仕掛区分コード" integer,
    "仕掛区分名" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE keikaku."TM_備考欄" (
    "ID" integer,
    "分類" character varying(50),
    "作業分類" character varying(50),
    "備考欄" character varying(255),
    "リンクID" integer,
    "得意先名" character varying(50),
    "使用頻度" integer,
    "登録日" character varying(50)
);

CREATE TABLE keikaku."TM_入庫先商品別名義条件" (
    "ID" integer,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean,
    "特定条件" boolean,
    "指定冷蔵庫" boolean,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean,
    "取扱名" character varying(255),
    "横持区分" boolean,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean
);

CREATE TABLE keikaku."TM_冷凍区分" (
    "冷凍ID" integer,
    "冷凍区分" character varying(50)
);

CREATE TABLE keikaku."TM_印刷管理" (
    "抽出区分" boolean,
    "レポート名" character varying(50),
    "オブジェクト名" character varying(50),
    "日付フィールド" character varying(50),
    "印刷時間" character varying(50),
    "登録時間" character varying(50),
    "登録日" timestamp without time zone,
    "表示On" boolean,
    "日報有無" character varying(50),
    "オブジェクト" character varying(50),
    "実行コード" character varying(50)
);

CREATE TABLE keikaku."TM_原料マスタ" (
    "原料分類ID" integer,
    "原料分類" character varying(50)
);

CREATE TABLE keikaku."TM_参照アドレス" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE keikaku."TM_参照アドレスHOUSOU" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE keikaku."TM_受注グループ" (
    "受注区分" integer,
    "区分名" character varying(50),
    "備考" character varying(50),
    "手配元ID" integer,
    "手配帳合ID" integer,
    "取引元ID" integer,
    "取引帳合ID" integer,
    "請求先コード区分" integer
);

CREATE VIEW keikaku."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE keikaku."TM_商品ラベル" (
    "ID" integer,
    "ラベル名称" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "ラベル枚数" character varying(50),
    "ラベル色" integer,
    "ラベルタイプ" integer
);

CREATE TABLE keikaku."TM_商品別冷凍パン使用マスタ" (
    "ID" integer,
    "商品コード" integer,
    "段数" integer,
    "資材コード" integer,
    "資材名" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE keikaku."TM_商品区分" (
    "区分ID" integer,
    "区分名" character varying(50)
);

CREATE TABLE keikaku."TM_商品在庫ストックマスタ" (
    "区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "ストック数" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE keikaku."TM_商品検査区分作成" (
    "ID" integer,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "区分No" integer,
    "区分記号" character varying(255),
    "予想kg" double precision,
    "開始時間" character varying(255),
    "予想ケース" integer,
    "終了時間" character varying(255),
    "倉庫ID" integer,
    "作業場" character varying(255),
    "区分記号2" character varying(255)
);

CREATE TABLE keikaku."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer
);

CREATE VIEW keikaku."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE keikaku."TM_得意先区分" (
    "得意先区分コード" integer,
    "区分名" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE keikaku."TM_札色設定" (
    "ID" integer,
    "札の色" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE keikaku."TM_産地マスタ" (
    "産地コード" integer,
    "生産地" character varying(50),
    "区分" character varying(50)
);

CREATE TABLE keikaku."TM_用紙タイプ" (
    "ID" integer,
    "用紙タイプ" character varying(50),
    "幅" integer,
    "高さ" integer,
    "Key" integer
);

CREATE TABLE keikaku."TM_相手先商品マスタ" (
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "相手先商品コード" character varying(255),
    "相手先商品名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50)
);

CREATE TABLE keikaku."TM_相手先届け先マスタ" (
    "ID" integer,
    "相手方届け先コード" character varying(50),
    "自社コード" integer,
    "届け先" character varying(50),
    "相手先コード" integer,
    "相手先名" character varying(50)
);

CREATE TABLE keikaku."TM_読込コードマスタ" (
    "ID" integer,
    "取引先コード" integer,
    "取引先" character varying(50),
    "相手商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "備考" character varying(50),
    "枚数管理chk" boolean,
    "セットアップ商品" boolean
);

CREATE TABLE keikaku."TM_買取単価マスタ" (
    "ID" integer,
    "計算区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "単価" double precision,
    "開始日" timestamp without time zone,
    "終了日" timestamp without time zone,
    "買取先コード" integer,
    "買取先" character varying(50),
    "備考" character varying(50),
    "年度" integer
);

CREATE TABLE keikaku."TM_車両区分" (
    "車両区分ID" integer,
    "車両区分" character varying(50),
    "積載量" integer
);

CREATE TABLE keikaku."TM_輸送区分" (
    "輸送区分ID" integer,
    "輸送区分" character varying(50)
);

CREATE TABLE keikaku."TM_通常運賃マスタ" (
    "運賃ID" integer,
    "運賃区分" integer,
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "最低運賃" double precision,
    "商品区分" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "計算ID" smallint,
    "計算方法" character varying(50),
    "車両ID" integer,
    "車両" character varying(50),
    "配達ID" integer,
    "配達" character varying(50),
    "冷凍ID" integer,
    "冷凍" character varying(50),
    "北海道" double precision,
    "東北" double precision,
    "関東" double precision,
    "東海中部" double precision,
    "北陸" double precision,
    "近畿" double precision,
    "中国" double precision,
    "四国" double precision,
    "九州" double precision,
    "その他" double precision,
    "Min" double precision,
    "Max" double precision
);

CREATE TABLE keikaku."TM_運送会社マスタ" (
    "ID" integer,
    "小口配送区分" boolean,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean,
    "eLixxi扱い便CD" character varying(255)
);

CREATE TABLE keikaku."TM_配達区分" (
    "ID" integer,
    "配達区分ID" integer,
    "配達区分" character varying(50)
);

CREATE TABLE keikaku."TM_集荷先別パレット設定" (
    "ID" integer,
    "集荷先ID" integer,
    "集荷先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "パレット単位" integer,
    "特定パレット単位" integer,
    "段数" integer,
    "備考" character varying(50)
);

CREATE TABLE keikaku."TM_集計用レポートクエリ" (
    "ID" integer,
    "作成日" character varying(50),
    "グループ集計" boolean,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "表題" character varying(255),
    "W_0" character varying(50),
    "W_0_1" character varying(50),
    "W_1_1" character varying(50),
    "W_1" character varying(50),
    "W_2" character varying(50),
    "W_3" character varying(50),
    "W_4" character varying(50),
    "W_5" character varying(50),
    "W_6" character varying(50),
    "W_7" character varying(50),
    "W_8" character varying(50),
    "W_9" character varying(50),
    "W_10_1" character varying(50),
    "W_10_2" character varying(50),
    "W_10_3" character varying(50),
    "W_10_4" character varying(50),
    "W_11" character varying(50),
    "W_12" character varying(50),
    "W_like" character varying(50),
    "V_0" boolean,
    "V_1" boolean,
    "V_2" boolean,
    "V_3" boolean,
    "V_4" boolean,
    "V_5" boolean,
    "V_6" boolean,
    "V_7" boolean,
    "V_8" boolean,
    "V_9" boolean,
    "V_10" boolean,
    "V_11" boolean,
    "V_12" boolean,
    "ヘッダー" character varying(50),
    "フッダー" character varying(50)
);

CREATE TABLE keikaku."T_生産計画変更案内" (
    "生産計画変更日" timestamp without time zone,
    "追加件数" integer,
    "削除件数" integer,
    "変更日" timestamp without time zone,
    "変更日時" timestamp without time zone
);

CREATE TABLE keikaku."T_生産計画変更案内old" (
    "生産計画変更日" timestamp without time zone,
    "追加件数" integer,
    "削除件数" integer,
    "変更日" timestamp without time zone,
    "変更日時" timestamp without time zone
);

CREATE TABLE keikaku."T_生産計画表" (
    "ID" integer,
    "製造日" timestamp without time zone,
    "包装予定" timestamp without time zone,
    "曜日" character varying(255),
    "コード" double precision,
    "第一工場" character varying(255),
    "出来高" double precision,
    "原料" character varying(255),
    "入庫先" character varying(255),
    "F9" character varying(255),
    "コード1" double precision,
    "第二工場" character varying(255),
    "出来高1" double precision,
    "原料1" character varying(255),
    "入庫先1" character varying(255),
    "備考" character varying(255),
    "その他" character varying(255),
    "F17" character varying(255),
    "コード2" double precision,
    "ふらのｿﾃｰ工場" character varying(255),
    "出来高2" double precision,
    "F21" character varying(255),
    "コード3" character varying(255),
    "えんゆう野菜加工施設" character varying(255),
    "出来高3" character varying(255),
    "コード4" double precision,
    "遠軽食品" character varying(255),
    "出来高4" double precision
);

CREATE TABLE keikaku."T_製造変更ログ" (
    "ID" integer,
    "製造変更日" timestamp without time zone,
    "新規件数" integer,
    "製造変更件数" integer,
    "包装日変更件数" integer,
    "kg変更件数" integer,
    "合計件数" integer,
    "出荷変更件数" integer,
    "訂正開始時間" timestamp without time zone,
    "訂正終了時間" timestamp without time zone
);

CREATE TABLE keikaku."物流用生産計画パレット単位表記" (
    "製造日" timestamp without time zone,
    "包装予定" timestamp without time zone,
    "曜日" character varying(255),
    "コード" character varying(255),
    "第一工場" character varying(255),
    "出来高" double precision,
    "ケース" integer,
    "パレット単位" integer,
    "パレット枚数" integer,
    "コード1" character varying(255),
    "第二工場" character varying(255),
    "出来高1" double precision,
    "ケース1" integer,
    "パレット単位1" integer,
    "パレット枚数1" integer,
    "F17" character varying(255),
    "コード2" character varying(255),
    "ふらのｿﾃｰ工場" character varying(255),
    "出来高2" integer,
    "ケース2" integer,
    "パレット単位2" integer,
    "パレット枚数2" integer,
    "F21" character varying(255),
    "コード3" character varying(255),
    "えんゆう野菜加工施設" character varying(255),
    "出来高3" integer,
    "ケース3" integer,
    "パレット単位3" integer,
    "パレット枚数3" integer,
    "コード4" character varying(255),
    "遠軽食品" character varying(255),
    "出来高4" integer,
    "ケース4" integer,
    "パレット単位4" integer,
    "パレット枚数4" integer
);

CREATE TABLE keikaku."生産計画繁盛コード切替" (
    "製造日" timestamp without time zone,
    "包装予定" timestamp without time zone,
    "曜日" character varying(255),
    "コード" character varying(255),
    "第一工場" character varying(255),
    "出来高" double precision,
    "原料" character varying(255),
    "入庫先" character varying(255),
    "F9" character varying(255),
    "コード1" character varying(255),
    "第二工場" character varying(255),
    "出来高1" double precision,
    "原料1" character varying(255),
    "入庫先1" character varying(255),
    "備考" character varying(255),
    "その他" character varying(255),
    "F17" character varying(255),
    "コード2" character varying(255),
    "ふらのｿﾃｰ工場" character varying(255),
    "出来高2" integer,
    "F21" character varying(255),
    "コード3" character varying(255),
    "えんゆう野菜加工施設" character varying(255),
    "出来高3" integer,
    "コード4" character varying(255),
    "遠軽食品" character varying(255),
    "出来高4" integer
);

CREATE TABLE keikaku."販盛テーブル用生産計画" (
    "製造日" timestamp without time zone,
    "包装予定" timestamp without time zone,
    "曜日" character varying(255),
    "コード" character varying(255),
    "1 第一工場" character varying(255),
    "出来高" double precision,
    "原料" character varying(255),
    "入庫先" character varying(255),
    "F9" character varying(255),
    "コード1" character varying(255),
    "2 第二工場" character varying(255),
    "出来高1" double precision,
    "原料1" character varying(255),
    "入庫先1" character varying(255),
    "備考" character varying(255),
    "その他" character varying(255),
    "F17" character varying(255),
    "コード2" character varying(255),
    "3 ふらのｿﾃｰ工場" character varying(255),
    "出来高2" integer,
    "F21" character varying(255),
    "コード3" character varying(255),
    "4 えんゆう野菜加工施設" character varying(255),
    "出来高3" integer,
    "コード4" character varying(255),
    "5 遠軽食品" character varying(255),
    "出来高4" integer
);

CREATE TABLE kyoyu."TD_新規生産計画" (
    "製造ID" integer,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "原料コード" integer,
    "原料" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "原料kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "備考" character varying(50),
    chk boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "抽出区分" boolean,
    "更新時間" character varying(50),
    "ストック数" integer,
    "ユーザーchk" boolean,
    "作業場" character varying(50),
    "製造識別コード" character varying(255),
    "通知" character varying(255),
    "作成日" character varying(50),
    "変更記録" character varying(255),
    "確認済みチェック" boolean,
    "冷凍原料手配区分" boolean,
    "関連受注ID" integer
);

CREATE TABLE kyoyu."大阪丸北生産計画" (
    "製造ID" integer,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "原料コード" integer,
    "原料" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "原料kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "備考" character varying(50),
    chk boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "抽出区分" boolean,
    "更新時間" character varying(50),
    "ストック数" integer,
    "ユーザーchk" boolean,
    "作業場" character varying(50),
    "製造識別コード" character varying(255),
    "通知" character varying(255),
    "作成日" timestamp without time zone,
    "変更記録" character varying(255),
    "確認済みチェック" boolean,
    "冷凍原料手配区分" boolean,
    "関連受注ID" integer
);

CREATE TABLE seizo."TD_入庫" (
    "入庫ID" integer,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "原料コード" integer,
    "原料" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "未包装kg" double precision,
    "原料kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "未包装区分" boolean,
    "備考" character varying(50),
    chk boolean,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "抽出区分" boolean,
    "出荷止め" boolean,
    "DB枚数" integer,
    "DB破損" integer,
    "DB異物" integer,
    "袋破損" integer,
    "確認者" character varying(50),
    "更新日" timestamp without time zone,
    "分類ID" integer,
    "製造変更chk" boolean,
    "未包装時ID" integer,
    "管理備考" character varying(50),
    "更新時間" character varying(50),
    "仕掛chk" boolean,
    "ユーザーchk" boolean,
    "作業場" character varying(50),
    "受注読込" boolean,
    "作業開始時間" timestamp without time zone,
    "作業終了時間" timestamp without time zone,
    "段ボールID" integer,
    "ロボットPrgNo" integer,
    "検査区分" character varying(50),
    "変更通知" character varying(50),
    "再生数" integer,
    "再生備考" character varying(50),
    "数量確定フラグ" integer,
    "製造表記" character varying(50),
    "商品区分" integer,
    "検査予定日" timestamp without time zone,
    "計量元数" integer,
    "箱詰枚数" character varying(50),
    "仕掛枚数" integer,
    "検体枚数" integer,
    "再生枚数" integer,
    "廃棄枚数" integer,
    "製造予定枚数" integer,
    "入庫元数" integer,
    "開始No" integer,
    "終了No" integer,
    "段数" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "製造ID" integer,
    "製造識別コード" character varying(255),
    "登録時間" character varying(255),
    "未包装枚数" integer,
    "印刷時非表示" boolean,
    "パレット使用枚数" integer,
    "大阪発注確認chk" boolean,
    "産地コード" integer,
    "商品状態隠語" character varying(50),
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "最終出庫日" timestamp without time zone,
    "包装順" integer,
    "検体取得" boolean,
    "変更前商品kg" double precision,
    "検体区分" boolean,
    "販盛製造番号" integer,
    "販盛製造番号行" integer,
    "穴あき枚数" integer,
    "印字不良" integer,
    "シール不良枚数" integer,
    "箱詰め数" integer,
    "箱詰め数合わせ" integer,
    "合わせ枚数" integer,
    "製造予定入力chk" boolean,
    "出来高入力chk" boolean,
    "計画kg" double precision,
    "計画枚数" integer,
    "計画ケース" integer,
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "検査結果chk" boolean,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE seizo_fe."M_Webアドレス操作" (
    "ID" integer,
    "実行名" character varying(255),
    "実行グループ名" character varying(255),
    "指定サイト" text,
    "検索ワード" character varying(255),
    "備考" character varying(255),
    "動作1" character varying(255),
    "動作2" character varying(255),
    "動作3" character varying(255),
    "動作4" character varying(255),
    "動作5" character varying(255),
    "動作6" character varying(255),
    "動作7" character varying(255),
    "動作8" character varying(255),
    "動作9" character varying(255),
    "動作10" character varying(255)
);

CREATE TABLE seizo_fe."TD_商品分類" (
    "ID" integer,
    "分類ID" integer,
    "分類名" character varying(50)
);

CREATE TABLE seizo_fe."TM_イベントスケジュール" (
    "ID" integer NOT NULL,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean NOT NULL,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean NOT NULL,
    "使用不可" boolean NOT NULL,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE SEQUENCE seizo_fe."TM_イベントスケジュール_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE seizo_fe."TM_イベントスケジュール_ID_seq" OWNED BY seizo_fe."TM_イベントスケジュール"."ID";

CREATE TABLE seizo_fe."TM_ダンボール寸法マスタ" (
    "資材ID" integer,
    "品番コード" character varying(255),
    "品番" character varying(255),
    "品名" character varying(255),
    "寸法（内寸）" character varying(255),
    "長さ" integer,
    "幅" integer,
    "高さ" integer,
    "備考" character varying(255),
    "更新日" timestamp without time zone
);

CREATE TABLE seizo_fe."TM_テープマスタ" (
    "テープID" integer NOT NULL,
    "テープ上" character varying(50),
    "テープ下" character varying(50)
);

CREATE SEQUENCE seizo_fe."TM_テープマスタ_テープID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE seizo_fe."TM_テープマスタ_テープID_seq" OWNED BY seizo_fe."TM_テープマスタ"."テープID";

CREATE TABLE seizo_fe."TM_入庫先商品別名義条件" (
    "ID" integer,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean,
    "特定条件" boolean,
    "指定冷蔵庫" boolean,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean,
    "取扱名" character varying(255),
    "横持区分" boolean,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean
);

CREATE TABLE seizo_fe."TM_原料マスタ" (
    "原料分類ID" integer NOT NULL,
    "原料分類" character varying(50)
);

CREATE SEQUENCE seizo_fe."TM_原料マスタ_原料分類ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE seizo_fe."TM_原料マスタ_原料分類ID_seq" OWNED BY seizo_fe."TM_原料マスタ"."原料分類ID";

CREATE TABLE seizo_fe."TM_参照アドレス" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE VIEW seizo_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE seizo_fe."TM_商品区分" (
    "区分ID" integer NOT NULL,
    "区分名" character varying(50),
    "区分隠語" character varying(255),
    "検査日数" integer
);

CREATE TABLE seizo_fe."TM_商品状態マスタ" (
    "ID" integer NOT NULL,
    "隠語" character varying(255),
    "状態" character varying(255),
    "区分" character varying(255)
);

CREATE TABLE seizo_fe."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer
);

CREATE VIEW seizo_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE seizo_fe."TM_得意先区分" (
    "得意先区分コード" integer,
    "区分名" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE seizo_fe."TM_札色設定" (
    "ID" integer NOT NULL,
    "札の色" character varying(255),
    "備考" character varying(255)
);

CREATE SEQUENCE seizo_fe."TM_札色設定_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE seizo_fe."TM_札色設定_ID_seq" OWNED BY seizo_fe."TM_札色設定"."ID";

CREATE TABLE seizo_fe."TM_産地マスタ" (
    "産地コード" integer,
    "通称" character varying(50),
    "国籍" character varying(50),
    "都道府県" character varying(255),
    "市町村" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE seizo_fe."TM_製造商品頻度マスタ2025" (
    "ID" integer NOT NULL,
    "商品コード" integer,
    "商品名" character varying(255),
    "件数" integer,
    "フィールド1" numeric(15,2)
);

CREATE SEQUENCE seizo_fe."TM_製造商品頻度マスタ2025_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE seizo_fe."TM_製造商品頻度マスタ2025_ID_seq" OWNED BY seizo_fe."TM_製造商品頻度マスタ2025"."ID";

CREATE TABLE seizo_fe."TM_製造工場マスタ" (
    "短縮コード" integer,
    "短縮名" character varying(50),
    "製造工場No" character varying(255),
    "製造工場運賃区分" character varying(255)
);

CREATE TABLE seizo_fe."TM_運送会社マスタ" (
    "ID" integer NOT NULL,
    "小口配送区分" boolean NOT NULL,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean NOT NULL,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean NOT NULL,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean NOT NULL,
    "eLixxi扱い便CD" character varying(255)
);

CREATE SEQUENCE seizo_fe."TM_運送会社マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE seizo_fe."TM_運送会社マスタ_ID_seq" OWNED BY seizo_fe."TM_運送会社マスタ"."ID";

CREATE TABLE seizo_fe."T_画面一覧" (
    "ID" integer,
    "分類" character varying(50),
    "名称" character varying(255),
    "区分" smallint,
    "実行名" character varying(255),
    "ソース名" character varying(255),
    "対象フィールド" character varying(50),
    "解説" character varying(50),
    "引数" character varying(255)
);

CREATE TABLE soko."TD_USER" (
    "ID" integer,
    "使用者コード" integer,
    "使用者名" character varying(50),
    "パスワード" integer,
    "前回更新日" timestamp without time zone,
    "更新時間" character varying(50),
    "確認時間" timestamp without time zone,
    "最終読込日" character varying(50),
    "リンクアドレス" character varying(255),
    "税率設定" real,
    "データ保持区分" smallint,
    "初期起動" boolean,
    "日時更新日" timestamp without time zone,
    "仮アドレス" character varying(255),
    "指定アドレス" character varying(255),
    "集計終了日" timestamp without time zone,
    "チェック期間" integer,
    "受注ファイルアドレス" character varying(255),
    "受注ファイル仮アドレス" character varying(255),
    "出荷登録中chk" boolean,
    "オフラインモード" boolean,
    "保管賃集計日" timestamp without time zone
);

CREATE TABLE soko."TD_倉庫詳細設定" (
    "ID" integer,
    "短縮コード" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "名義コード" integer,
    "名義名" character varying(50),
    "入出庫料" double precision,
    "保管料" double precision,
    "名義変更料" integer,
    "休日入出庫料" double precision,
    "最低入出庫料" double precision,
    "最低保管料" double precision,
    "最低入出庫kg" double precision,
    "最低保管kg" double precision,
    "小数点区分" integer,
    "丸め計算" integer,
    "名変料発生区分" integer,
    "荷役料" double precision,
    "小口出庫割増" double precision,
    "業務代行料" double precision,
    "分割手数料" double precision,
    "証明書料金" double precision,
    "自動名変" boolean,
    "自動変更後名義ID" integer,
    "終了日" timestamp without time zone,
    "一桁目繰上" integer,
    "初回最低保管料のみ適用" boolean,
    "終了chk" boolean,
    "備考" character varying(255),
    "入力日" timestamp without time zone,
    "計算単位" integer,
    "契約入庫日開始" timestamp without time zone,
    "契約入庫日終了" timestamp without time zone,
    "税区分" integer,
    "賞味期限管理手数料kg" integer,
    "賞味期限管理手数料dm3" double precision,
    "検品手数料" integer,
    "画像報告手数料" double precision,
    "経由出庫手数料" integer,
    "共通名称" character varying(255)
);

CREATE TABLE soko."TD_入庫" (
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "備考" character varying(50),
    "社内連絡" character varying(50),
    "ｻﾝﾌﾟﾙ区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "入力日付" timestamp without time zone,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "輸送備考" character varying(50),
    "入庫ID" integer,
    "更新時間" character varying(50),
    "出庫ID" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "入庫No" character varying(50),
    "買取単価コード" integer,
    "インポートアドレス" character varying(255),
    "読込方法" character varying(50),
    "商品区分" integer,
    "タグ" character varying(50),
    "仮入庫フラグ" boolean,
    "タグ2" character varying(255),
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫時輸送ID" integer,
    "産地コード" integer
);

CREATE TABLE soko."TD_出荷" (
    "出庫ID" integer,
    "輸送ID" integer,
    "出荷日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(50),
    "社内連絡" character varying(255),
    "ｻﾝﾌﾟﾙ区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean,
    "輸送備考" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "個別運賃" numeric(19,4),
    "入庫ID" integer,
    "積順" integer,
    "届け順" smallint,
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "保管料" double precision,
    "入出庫料" double precision,
    "割増出庫料" integer,
    "買取単価コード" integer,
    "支払区分" character varying(255),
    "買取金額" double precision,
    "出荷期数" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "保管費用支払日" timestamp without time zone,
    "受注確認" boolean,
    "買取chk" boolean,
    "ユーザーchk" boolean,
    "受注No" character varying(50),
    "ユーザー伝票No" character varying(255),
    "タグ" character varying(50),
    "買取区分" integer,
    "受注ID" integer,
    "輸送履歴読込chk" boolean,
    "登録時間" timestamp without time zone,
    "出庫確認" boolean,
    "配車確認" boolean,
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行指令No" character varying(255),
    "出庫済み" boolean,
    "本社受注" boolean,
    "運賃請求ID" integer,
    "商品区分" integer,
    "伝票No確認用" character varying(50),
    "商品状態隠語" character varying(50),
    "届け先区分" integer,
    "運賃扱い区分" integer,
    "請求先名" character varying(255),
    "輸送手段" character varying(255),
    "運賃扱い先" character varying(255),
    "産地コード" integer,
    "丸北輸送ID" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "インポート先出庫ID" integer,
    "Newクロップ区分" boolean,
    "他工場伝票No" character varying(255),
    "参照受注番号" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "蔵前区分" boolean,
    "空き予定パレット数" integer,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "売上科目コード" integer,
    "売上科目" character varying(255)
);

CREATE TABLE soko."TD_受注" (
    "受注受付ID" integer,
    "受注ID" integer,
    "受注日" timestamp without time zone,
    "受注番号" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(50),
    "受注帳合ID" integer,
    "受注帳合名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "残ケース" integer,
    "商品kg" double precision,
    "残kg" double precision,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "正式届け先名" character varying(255),
    "単価" double precision,
    "請求金額" integer,
    "備考" character varying(255),
    "社内連絡" character varying(255),
    chk boolean,
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" smallint,
    "枝番1" character varying(50),
    "枝番2" character varying(50),
    "枝番3" character varying(50),
    "登録時間" character varying(255),
    "更新時間" character varying(255),
    "受注番号1" character varying(255),
    "商品コード1" integer,
    "ケース1" integer,
    "商品kg1" double precision,
    "届け先コード1" integer,
    "納品日1" timestamp without time zone,
    "相手届け先コード" integer,
    "入力日" timestamp without time zone,
    "入庫名義ID" integer,
    "出荷予定日" timestamp without time zone,
    "送り状No" character varying(255),
    "手配DataChk" boolean,
    "入力確認チェック" boolean,
    "受注手配確認" boolean,
    "受注出庫確認" boolean,
    "出庫返信FAX確認" boolean,
    "受注グループID" integer,
    "輸送手配返信確認" boolean,
    "受領書確認" boolean,
    "受注返信FAX" boolean,
    "取引元ID" integer,
    "取引元" character varying(255),
    "取引帳合ID" character varying(255),
    "取引帳合" character varying(255),
    "受注区分" integer,
    "賞味期限送信" boolean,
    "本社受注" boolean,
    "消費税" integer,
    "税込請求金額" integer,
    "送品案内" boolean,
    "出力用chk" boolean,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "伝票作成" boolean,
    "伝票送付" boolean,
    "本社受注ID" integer,
    "初回登録chk" boolean,
    "受注ユーザーID" integer,
    "受注ユーザー名" character varying(255),
    "伝票FAX" boolean,
    "完了消込" boolean,
    "丸北出荷数" integer,
    "倉庫出荷数" integer,
    "転売出荷数" integer,
    "統一受注ID" character varying(255),
    "年間受注ID" integer,
    "月間カウンタ" integer,
    "月間No" integer,
    "隠語" character varying(255),
    "運賃振分区分" integer,
    "運賃請求ID" integer,
    "変更前ケース" integer,
    "変更前商品kg" double precision,
    "少量残連絡chk" boolean,
    "少量残連絡備考" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "蔵前区分" boolean,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "販盛売上行" character varying(255),
    "販盛売上番号" character varying(255),
    "販盛伝票番号" character varying(255),
    "手配出庫番号" character varying(255),
    "手配輸送番号" character varying(255)
);

CREATE TABLE soko."TD_在庫" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "グループ商品コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" text,
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "振替ケース" integer,
    "グループコード" integer,
    "商品区分" integer,
    "入出庫料" integer,
    "保管料" integer,
    "前期保管料" integer,
    "後期保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "変更前在庫ID" integer,
    "確定フラグ" boolean,
    "最終出庫日" timestamp without time zone,
    "不一致フラグ" boolean,
    "不一致備考" character varying(255),
    "買取単価コード" integer,
    "請求年度" integer,
    "ユーザーchk" boolean,
    "インポートアドレス" character varying(255),
    "名変回数" integer,
    "名変前在庫ID" integer,
    "保管料負担日" timestamp without time zone,
    "タグ" character varying(50),
    "課税区分" integer,
    "登録時間" timestamp without time zone,
    "入出庫料固定" boolean,
    "産地コード" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "商品状態隠語" character varying(50),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫時輸送ID" integer,
    "タグ2" character varying(255),
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "仮入庫フラグ" boolean,
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "User賞味通知区分" integer,
    "User賞味残日数" integer,
    "通知" character varying(255)
);

CREATE TABLE soko."TD_在庫変更" (
    "変更No" integer,
    "在庫No" integer,
    "変更日" timestamp without time zone,
    "取引元ID" integer,
    "取引元" character varying(255),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "変更前名義ID" integer,
    "変更後名義ID" integer,
    "変更区分" integer,
    "備考" character varying(255),
    "買取単価コード" integer,
    "支払区分" integer,
    "買取金額" double precision,
    "買取chk" boolean,
    "保管庫ID" integer,
    "保管庫名" character varying(50),
    "変更Check" boolean,
    "入庫No" character varying(50),
    "変更前在庫数" integer,
    "移動先ID" integer,
    "移動先名" character varying(50),
    "出荷期数" integer,
    "保管料" double precision,
    "入出庫料" double precision,
    "出荷伝票No" integer,
    "抽出区分" boolean,
    "譲渡人負担日" timestamp without time zone,
    "譲受人負担日" timestamp without time zone,
    "登録日" timestamp without time zone,
    "受注ID" integer,
    "ユーザー伝票No" character varying(255),
    "確認chk" boolean,
    "産地コード" integer,
    "Newクロップ区分" boolean
);

CREATE TABLE soko."TD_在庫費用月別集計" (
    "ID" integer,
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "期" integer,
    "倉庫No" integer,
    "倉庫名" character varying(50),
    "入庫No" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "ケース" integer,
    "商品kg" double precision,
    "入出庫料" double precision,
    "保管料" double precision,
    "サービス料" double precision,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "認識ID" character varying(50),
    "出庫ID" integer,
    "備考" character varying(255),
    "開始期間" timestamp without time zone,
    "終了期間" timestamp without time zone
);

CREATE TABLE soko."TD_諸経費" (
    "ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "在庫ID" integer,
    "入庫No" character varying(50),
    "経費ID" integer,
    "経費名" character varying(50),
    "諸経費" double precision,
    "備考" character varying(255),
    "登録日" timestamp without time zone,
    "発生日" timestamp without time zone,
    chk boolean,
    "請求先ID" integer,
    "請求先" character varying(50),
    "集計月" character varying(50),
    "税区分" integer
);

CREATE TABLE soko."TD_輸送計画" (
    "伝票日付No" integer,
    "輸送ID" integer,
    "出荷計画日" timestamp without time zone,
    "運送会社ID" smallint,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "乗務員" character varying(50),
    "携帯番号" character varying(50),
    "集荷日" timestamp without time zone,
    "担当者" character varying(50),
    "冷凍区分ID" integer,
    "冷凍区分名" character varying(20),
    "運賃区分ID" integer,
    "輸送区分ID" integer,
    "輸送区分" character varying(20),
    "車両区分ID" integer,
    "車両区分" character varying(20),
    "配達区分ID" integer,
    "配達区分" character varying(20),
    "セット温度" integer,
    "セット温度2" integer,
    "web輸送送り状No" text,
    "受領印チェック" boolean,
    "支払運賃" numeric(19,4),
    "もらい運賃" numeric(19,4),
    "運送収入" numeric(19,4),
    "付帯料金" numeric(19,4),
    "総重量" integer,
    "最終納品日" timestamp without time zone,
    "船名" character varying(50),
    "航路" character varying(50),
    "発港" character varying(50),
    "着港" character varying(50),
    "乗船日" timestamp without time zone,
    "下船日" timestamp without time zone,
    "締切時間" timestamp without time zone,
    "乗船時間" timestamp without time zone,
    "下船時間" timestamp without time zone,
    "仲介運送会社コード" integer,
    "仲介運送会社" character varying(50),
    "仲介車番" character varying(50),
    "仲介乗務員" character varying(50),
    "仲介携帯番号" character varying(50),
    "集荷時間" timestamp without time zone,
    "引取日" timestamp without time zone,
    "引取時間" timestamp without time zone,
    "シャーシ車番" character varying(50),
    "集荷時備考" character varying(255),
    "引取備考" character varying(255),
    chk boolean,
    "運賃読込" boolean,
    "帳合運送会社コード" integer,
    "帳合運送会社名" character varying(50),
    "手配運送会社コード" integer,
    "手配運送会社名" character varying(50),
    "更新時間" character varying(50),
    "車型" character varying(50),
    "車号" character varying(50),
    "冷凍区分" character varying(50),
    "抽出区分" boolean,
    "運賃chk" boolean,
    "出庫No" integer,
    "出庫場所ID" integer,
    "出庫場所" character varying(255),
    "印刷カウント" character varying(255),
    "納品日コメント" character varying(255),
    "運行指令No" integer,
    "受付時間" timestamp without time zone,
    "接車時間" timestamp without time zone,
    "出発時間" timestamp without time zone,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "運賃計算区分" integer
);

CREATE TABLE soko."TM_丸め計算マスタ" (
    "ID" integer,
    "丸め計算ID" integer,
    "計算名" character varying(255)
);

CREATE TABLE soko."TM_経費項目マスタ" (
    "経費ID" integer,
    "経費項目" character varying(50),
    "備考" character varying(50),
    "税区分" integer
);

CREATE TABLE soko_fe."M_Webアドレス操作" (
    "ID" integer NOT NULL,
    "実行名" character varying(255),
    "実行グループ名" character varying(255),
    "指定サイト" text,
    "検索ワード" character varying(255),
    "備考" character varying(255),
    "動作1" character varying(255),
    "動作2" character varying(255),
    "動作3" character varying(255),
    "動作4" character varying(255),
    "動作5" character varying(255),
    "動作6" character varying(255),
    "動作7" character varying(255),
    "動作8" character varying(255),
    "動作9" character varying(255),
    "動作10" character varying(255)
);

CREATE SEQUENCE soko_fe."M_Webアドレス操作_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."M_Webアドレス操作_ID_seq" OWNED BY soko_fe."M_Webアドレス操作"."ID";

CREATE TABLE soko_fe."TDS_出荷案内書作成" (
    "輸送ID" integer,
    "商品コード" integer,
    "本社コード" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "備考" character varying(50),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "入庫後名義" character varying(50),
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "出荷日" timestamp without time zone,
    "サービス区分" boolean,
    "商品積込順" integer,
    "リンクコード1" character varying(50),
    "抽出区分" boolean,
    "パレット単位" character varying(50),
    "印刷区分" integer,
    "備考2" character varying(50),
    "ユーザー伝票No" character varying(255),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "タグ" character varying(50),
    "在庫ID" integer,
    "検査区分" character varying(255),
    "商品区分" integer,
    "運賃振分区分" integer
);

CREATE TABLE soko_fe."TD_クローン" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean NOT NULL,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean NOT NULL,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "振替ケース" integer,
    "グループコード" integer,
    "商品区分" integer,
    "入出庫料" integer,
    "保管料" integer,
    "前期保管料" integer,
    "後期保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "変更前在庫ID" integer,
    "確定フラグ" boolean NOT NULL,
    "最終出庫日" timestamp without time zone,
    "不一致フラグ" boolean NOT NULL,
    "不一致備考" character varying(255),
    "買取単価コード" integer,
    "請求年度" integer,
    "ユーザーchk" boolean NOT NULL,
    "インポートアドレス" character varying(255),
    "名変回数" integer,
    "名変前在庫ID" integer,
    "保管料負担日" timestamp without time zone,
    "タグ" character varying(50),
    "課税区分" integer,
    "登録時間" timestamp without time zone
);

CREATE TABLE soko_fe."TD_スケジュール" (
    "ID" integer NOT NULL,
    "日付" timestamp without time zone,
    "備考" character varying(255),
    "項目" character varying(50),
    "時間" character varying(50)
);

CREATE SEQUENCE soko_fe."TD_スケジュール_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_スケジュール_ID_seq" OWNED BY soko_fe."TD_スケジュール"."ID";

CREATE TABLE soko_fe."TD_保管料買取集計" (
    "年月" character varying(50),
    "買取日" timestamp without time zone,
    "在庫ID" integer,
    "買取区分" integer,
    "入庫後名義ID" integer,
    "入庫後名義" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "出荷期数" integer,
    "保管料" double precision,
    "入出庫料" double precision,
    "買取金額" double precision,
    "買取コード" integer,
    "サービス料" double precision,
    "棚卸確定フラグ" boolean NOT NULL,
    "買取先" character varying(50)
);

CREATE TABLE soko_fe."TD_倉庫請求書" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "期" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫No" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入数" integer,
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "ケース" integer,
    "商品kg" integer,
    "入出庫料s" integer,
    "保管料s" integer,
    "サービス料s" integer,
    "情報手数料s" integer,
    "諸経費1s" integer,
    "諸経費2s" integer,
    "諸経費3s" integer,
    "訂正金額s" integer,
    "認識ID" character varying(50),
    "出庫ID" integer,
    "備考" character varying(255),
    "在庫残数" integer,
    "在庫残kg" integer,
    "買取金額" integer
);

CREATE TABLE soko_fe."TD_出荷予定日" (
    "伝票日付No" integer NOT NULL,
    "出荷日" timestamp without time zone NOT NULL
);

CREATE SEQUENCE soko_fe."TD_出荷予定日_伝票日付No_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_出荷予定日_伝票日付No_seq" OWNED BY soko_fe."TD_出荷予定日"."伝票日付No";

CREATE TABLE soko_fe."TD_商品分類" (
    "ID" integer NOT NULL,
    "分類ID" integer,
    "分類名" character varying(50),
    "冷凍保管区分" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."TD_商品分類_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_商品分類_ID_seq" OWNED BY soko_fe."TD_商品分類"."ID";

CREATE TABLE soko_fe."TD_在庫_名変" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "振替ケース" integer,
    "グループコード" integer,
    "商品区分" integer,
    "入出庫料" integer,
    "保管料" integer,
    "前期保管料" integer,
    "後期保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "変更前在庫ID" integer,
    "確定フラグ" boolean,
    "最終出庫日" timestamp without time zone,
    "不一致フラグ" boolean,
    "不一致備考" character varying(255),
    "買取単価コード" integer,
    "請求年度" integer,
    "ユーザーchk" boolean,
    "インポートアドレス" character varying(255),
    "名変回数" integer,
    "名変前在庫ID" integer
);

CREATE TABLE soko_fe."TD_在庫パレット" (
    "在庫ID" integer,
    "01A" integer,
    "02A" integer,
    "03A" integer,
    "04A" integer,
    "05A" integer,
    "06A" integer,
    "07A" integer,
    "08A" integer,
    "09A" integer,
    "10A" integer,
    "11A" integer,
    "12A" integer,
    "13A" integer,
    "14A" integer,
    "15A" integer,
    "01B" integer,
    "02B" integer,
    "03B" integer,
    "04B" integer,
    "05B" integer,
    "06B" integer,
    "07B" integer,
    "08B" integer,
    "09B" integer,
    "10B" integer,
    "11B" integer,
    "12B" integer,
    "13B" integer,
    "14B" integer,
    "15B" integer,
    "01C" integer,
    "02C" integer,
    "03C" integer,
    "04C" integer,
    "05C" integer,
    "06C" integer,
    "07C" integer,
    "08C" integer,
    "09C" integer,
    "10C" integer,
    "11C" integer,
    "12C" integer,
    "13C" integer,
    "14C" integer,
    "15C" integer
);

CREATE TABLE soko_fe."TD_在庫更新前" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "グループ商品コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" text,
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "振替ケース" integer,
    "グループコード" integer,
    "商品区分" integer,
    "入出庫料" integer,
    "保管料" integer,
    "前期保管料" integer,
    "後期保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "変更前在庫ID" integer,
    "確定フラグ" boolean,
    "最終出庫日" timestamp without time zone,
    "不一致フラグ" boolean,
    "不一致備考" character varying(255),
    "買取単価コード" integer,
    "請求年度" integer,
    "ユーザーchk" boolean,
    "インポートアドレス" character varying(255),
    "名変回数" integer,
    "名変前在庫ID" integer,
    "保管料負担日" timestamp without time zone,
    "タグ" character varying(50),
    "課税区分" integer,
    "登録時間" timestamp without time zone,
    "入出庫料固定" boolean,
    "産地コード" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "商品状態隠語" character varying(50),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫時輸送ID" integer,
    "タグ2" character varying(255),
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "仮入庫フラグ" boolean,
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "User賞味通知区分" integer,
    "User賞味残日数" integer,
    "通知" character varying(255)
);

CREATE TABLE soko_fe."TD_当日在庫" (
    "ID" integer NOT NULL,
    "作成日付" timestamp without time zone,
    "包装日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" real,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" integer,
    "製造kg" integer,
    "出荷kg" integer,
    "在庫kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(255),
    "入庫後名義ID" integer,
    "入庫No" character varying(50),
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "補助入庫No" integer,
    "入出庫料" integer,
    "保管料" integer,
    "期" integer,
    "出庫回数" integer,
    "サービス区分" boolean NOT NULL,
    "名変料" integer,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "倉庫区分" boolean NOT NULL,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean NOT NULL,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出来高ID" integer,
    "輸送ID" integer,
    "運送会社ID" integer,
    "車番" character varying(50),
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "入庫名義ID" integer,
    "届け先コード" integer,
    "届け先" character varying(50),
    "在庫ID" integer,
    "タグ" character varying(50),
    "商品積込順" integer
);

CREATE SEQUENCE soko_fe."TD_当日在庫_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_当日在庫_ID_seq" OWNED BY soko_fe."TD_当日在庫"."ID";

CREATE TABLE soko_fe."TD_月別倉庫保管経費" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "集計年月" character varying(50),
    "入出庫料" double precision,
    "保管料" double precision,
    "名変手数料" double precision,
    "諸経費1" double precision,
    "諸経費2" double precision,
    "諸経費3" double precision,
    "保管料税" double precision,
    "入出庫料税" double precision,
    "名変手数料税" double precision,
    "入庫後名義ID" integer,
    "名義名" character varying(50)
);

CREATE SEQUENCE soko_fe."TD_月別倉庫保管経費_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_月別倉庫保管経費_ID_seq" OWNED BY soko_fe."TD_月別倉庫保管経費"."ID";

CREATE TABLE soko_fe."TD_月別倉庫支払経費" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "集計年月" character varying(50),
    "入出庫料" double precision,
    "保管料" double precision,
    "名変手数料" double precision,
    "諸経費1" double precision,
    "諸経費2" double precision,
    "諸経費3" double precision,
    "保管料税" double precision,
    "入出庫料税" double precision,
    "名変手数料税" double precision,
    "入庫後名義ID" integer,
    "名義名" character varying(50)
);

CREATE SEQUENCE soko_fe."TD_月別倉庫支払経費_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_月別倉庫支払経費_ID_seq" OWNED BY soko_fe."TD_月別倉庫支払経費"."ID";

CREATE TABLE soko_fe."TD_架空在庫" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "User賞味通知区分" integer,
    "User賞味残日数" integer
);

CREATE TABLE soko_fe."TD_架空在庫_IN" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "作成日付" timestamp without time zone,
    "名変前在庫ID" integer,
    "タグ" character varying(50),
    "グループ商品コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255)
);

CREATE TABLE soko_fe."TD_架空在庫_パレット集計" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer
);

CREATE TABLE soko_fe."TD_架空在庫_パレット集計_当日" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer
);

CREATE TABLE soko_fe."TD_架空在庫_パレット集計_画面用" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer
);

CREATE TABLE soko_fe."TD_架空在庫ver2" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "作成日付" timestamp without time zone,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255)
);

CREATE TABLE soko_fe."TD_棚卸在庫" (
    "在庫ID" integer,
    "棚卸確定フラグ" boolean NOT NULL,
    "年月" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" real,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "累計出庫ケース" integer,
    "累計出庫kg" double precision,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "請求個数" integer,
    "請求kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean NOT NULL,
    "認識ID" character varying(50),
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean NOT NULL,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "商品区分" integer,
    "入出庫料" integer,
    "保管料" integer,
    "前期保管料" integer,
    "後期保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "変更前在庫ID" integer,
    "確定フラグ" boolean NOT NULL,
    "最終出庫日" timestamp without time zone,
    "不一致フラグ" boolean NOT NULL,
    "不一致備考" character varying(255),
    "買取単価コード" integer,
    "請求年度" integer,
    "ユーザーchk" boolean NOT NULL,
    "インポートアドレス" character varying(255),
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "支払区分" integer,
    "諸経費" double precision,
    "当月入出庫料" double precision,
    "当月保管料" double precision
);

CREATE TABLE soko_fe."TD_直送買取" (
    "出庫ID" integer,
    "出荷日" timestamp without time zone,
    "出荷年" character varying(50),
    "出荷月" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" real,
    "ケース" integer,
    "商品kg" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "備考" character varying(50),
    chk boolean NOT NULL,
    "入庫日" timestamp without time zone,
    "売り日" timestamp without time zone,
    "支払区分" integer,
    "買取単価コード" integer,
    "買取金額" double precision,
    "買取chk" boolean NOT NULL,
    "出荷期数" integer
);

CREATE TABLE soko_fe."TD_積込順" (
    "ID" integer NOT NULL,
    "輸送ID" integer,
    "積込順" integer,
    "積込順届け先" integer,
    "積込順出荷元" integer,
    "積込備考" character varying(255),
    "積込指定No" integer,
    "積込指定外No" integer,
    "届け順" integer
);

CREATE SEQUENCE soko_fe."TD_積込順_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_積込順_ID_seq" OWNED BY soko_fe."TD_積込順"."ID";

CREATE TABLE soko_fe."TD_訂正履歴" (
    "ID" integer NOT NULL,
    "出庫ID" integer,
    "テーブル名" character varying(50),
    "訂正日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "ケース" integer,
    "商品kg" integer,
    "入庫前名義" integer,
    "入庫後名義" integer,
    "備考" character varying(255),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "在庫ID" integer,
    "保管料" double precision,
    "入出庫料" double precision,
    "訂正日時" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer
);

CREATE SEQUENCE soko_fe."TD_訂正履歴_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TD_訂正履歴_ID_seq" OWNED BY soko_fe."TD_訂正履歴"."ID";

CREATE TABLE soko_fe."TM_イベントスケジュール" (
    "ID" integer NOT NULL,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean NOT NULL,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean NOT NULL,
    "使用不可" boolean NOT NULL,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE SEQUENCE soko_fe."TM_イベントスケジュール_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_イベントスケジュール_ID_seq" OWNED BY soko_fe."TM_イベントスケジュール"."ID";

CREATE TABLE soko_fe."TM_カレンダー" (
    "ID" integer NOT NULL,
    "日付" timestamp without time zone,
    "年" character varying(50),
    "月" character varying(50),
    "日" character varying(50),
    "備考" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_カレンダー_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_カレンダー_ID_seq" OWNED BY soko_fe."TM_カレンダー"."ID";

CREATE TABLE soko_fe."TM_サービス設定" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "サービス範囲" integer,
    "備考" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_サービス設定_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_サービス設定_ID_seq" OWNED BY soko_fe."TM_サービス設定"."ID";

CREATE TABLE soko_fe."TM_ニチレイパレット積載マスタ" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "パレット積載数" integer,
    "短縮名" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_ニチレイパレット積載マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_ニチレイパレット積載マスタ_ID_seq" OWNED BY soko_fe."TM_ニチレイパレット積載マスタ"."ID";

CREATE TABLE soko_fe."TM_ニチレイパレット積載マスタ_印刷用" (
    "ID" integer NOT NULL,
    "商品コード" integer,
    "商品名" character varying(255),
    "パレット積載数" integer,
    "短縮名" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_ニチレイパレット積載マスタ_印刷用_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_ニチレイパレット積載マスタ_印刷用_ID_seq" OWNED BY soko_fe."TM_ニチレイパレット積載マスタ_印刷用"."ID";

CREATE TABLE soko_fe."TM_レポート作成" (
    "ID" integer NOT NULL,
    "表題" character varying(50),
    "宛名" character varying(50),
    "出荷日1" character varying(50),
    "出荷日2" character varying(50),
    "製造日1" character varying(50),
    "製造日2" character varying(50),
    "納品日1" character varying(50),
    "納品日2" character varying(50),
    "届け先コード" integer,
    "倉庫ID" integer,
    "運送会社ID" integer,
    "商品コード" integer,
    "入庫前名義" integer,
    "入庫後名義" integer,
    "商品分類" integer,
    "商品分類等号" character varying(50),
    "レポートタイプ" integer,
    "作成日時" timestamp without time zone,
    "ヘッダー" integer,
    "フッダー" integer,
    "並び順" character varying(50),
    "出荷グループ" integer,
    "届けグループ" integer,
    "No1" integer,
    "No2" integer,
    "No3" integer,
    "No4" integer,
    "No5" integer,
    "No6" integer,
    "No7" integer,
    "No8" integer,
    "No9" integer,
    "No10" integer,
    "No11" integer,
    "抽出品名" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_レポート作成_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_レポート作成_ID_seq" OWNED BY soko_fe."TM_レポート作成"."ID";

CREATE TABLE soko_fe."TM_備考欄" (
    "ID" integer NOT NULL,
    "分類" character varying(50),
    "作業分類" character varying(50),
    "備考欄" character varying(255),
    "リンクID" integer,
    "得意先名" character varying(50),
    "使用頻度" integer,
    "登録日" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_備考欄_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_備考欄_ID_seq" OWNED BY soko_fe."TM_備考欄"."ID";

CREATE TABLE soko_fe."TM_入庫先商品別名義条件" (
    "ID" integer NOT NULL,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean NOT NULL,
    "特定条件" boolean NOT NULL,
    "指定冷蔵庫" boolean NOT NULL,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean NOT NULL,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean NOT NULL,
    "取扱名" character varying(255),
    "横持区分" boolean NOT NULL,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean NOT NULL,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."TM_入庫先商品別名義条件_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_入庫先商品別名義条件_ID_seq" OWNED BY soko_fe."TM_入庫先商品別名義条件"."ID";

CREATE TABLE soko_fe."TM_冷凍区分" (
    "冷凍ID" integer NOT NULL,
    "冷凍区分" character varying(50),
    "コメント" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_冷凍区分_冷凍ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_冷凍区分_冷凍ID_seq" OWNED BY soko_fe."TM_冷凍区分"."冷凍ID";

CREATE TABLE soko_fe."TM_出荷場所条件" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "名義ID" integer
);

CREATE SEQUENCE soko_fe."TM_出荷場所条件_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_出荷場所条件_ID_seq" OWNED BY soko_fe."TM_出荷場所条件"."ID";

CREATE TABLE soko_fe."TM_原料マスタ" (
    "原料分類ID" integer NOT NULL,
    "原料分類" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_原料マスタ_原料分類ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_原料マスタ_原料分類ID_seq" OWNED BY soko_fe."TM_原料マスタ"."原料分類ID";

CREATE TABLE soko_fe."TM_参照アドレス" (
    "ID" integer NOT NULL,
    "BackUpPC名" character varying(255),
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE soko_fe."TM_参照アドレスHOUSOU" (
    "ID" integer NOT NULL,
    "BackUpPC名" character varying(255),
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE SEQUENCE soko_fe."TM_参照アドレスHOUSOU_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_参照アドレスHOUSOU_ID_seq" OWNED BY soko_fe."TM_参照アドレスHOUSOU"."ID";

CREATE SEQUENCE soko_fe."TM_参照アドレス_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_参照アドレス_ID_seq" OWNED BY soko_fe."TM_参照アドレス"."ID";

CREATE TABLE soko_fe."TM_取り扱い商品マスタ" (
    "商品コード" integer NOT NULL,
    "商品名" character varying(255),
    "取り扱い区分" character varying(255),
    "取り扱い区分名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255)
);

CREATE TABLE soko_fe."TM_受注先マスタ" (
    "ID" integer NOT NULL,
    "受注区分" integer,
    "取引先ID" integer,
    "取引先名" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(255),
    "受注帳合ID" integer,
    "受注帳合先名" character varying(255),
    "指定倉庫ID" integer,
    "指定倉庫名" character varying(255),
    "指定届け先コード" integer,
    "指定届け先" character varying(255),
    "指定入庫名義ID" integer,
    "備考" character varying(50),
    "道内区分" boolean NOT NULL,
    "転売区分" boolean NOT NULL,
    "一般ユーザー" boolean NOT NULL,
    "仕入区分" boolean NOT NULL,
    "本社受注" boolean NOT NULL,
    "伝票送付" boolean NOT NULL,
    "デポ区分" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."TM_受注先マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_受注先マスタ_ID_seq" OWNED BY soko_fe."TM_受注先マスタ"."ID";

CREATE TABLE soko_fe."TM_受注検索方法" (
    "ID" integer NOT NULL,
    "検索方法ID" integer,
    "選択方法" character varying(255),
    "コメント" character varying(255),
    "備考" character varying(255),
    "順番No1" integer,
    "順番No2" integer,
    "順番No3" integer,
    "順番No4" integer
);

CREATE SEQUENCE soko_fe."TM_受注検索方法_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_受注検索方法_ID_seq" OWNED BY soko_fe."TM_受注検索方法"."ID";

CREATE VIEW soko_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE soko_fe."TM_商品区分" (
    "区分ID" integer NOT NULL,
    "区分名" character varying(50),
    "区分隠語" character varying(255),
    "検査日数" integer
);

CREATE TABLE soko_fe."TM_商品在庫ストックマスタ" (
    "区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "ストック数" character varying(255),
    "備考" character varying(255),
    "倉庫ID除外コード" integer,
    "更新時間" character varying(255),
    "通知区分" boolean NOT NULL
);

CREATE TABLE soko_fe."TM_商品状態マスタ" (
    "ID" integer NOT NULL,
    "隠語" character varying(255),
    "状態" character varying(255),
    "区分" character varying(255)
);

CREATE TABLE soko_fe."TM_商品隠語マスタ" (
    "ID" integer NOT NULL,
    "隠語" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ストックユーザーコード" integer,
    "ストックユーザー名" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "備考" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_商品隠語マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_商品隠語マスタ_ID_seq" OWNED BY soko_fe."TM_商品隠語マスタ"."ID";

CREATE TABLE soko_fe."TM_営業冷蔵庫倉庫商品マスタ" (
    "ID" integer NOT NULL,
    "取引元ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "倉庫商品名" character varying(255),
    "倉庫商品コード" integer,
    "本社コード" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_営業冷蔵庫倉庫商品マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_営業冷蔵庫倉庫商品マスタ_ID_seq" OWNED BY soko_fe."TM_営業冷蔵庫倉庫商品マスタ"."ID";

CREATE TABLE soko_fe."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer
);

CREATE TABLE soko_fe."TM_履歴選択" (
    "履歴コード" integer,
    "日付項目名" character varying(50),
    "日付表題" character varying(50),
    "倉庫項目名" character varying(50),
    "倉庫表題" character varying(50),
    "届け先項目名" character varying(50),
    "届け先表題" character varying(50),
    "商品名項目名" character varying(50),
    "商品名表題" character varying(50),
    "製造日項目名" character varying(50),
    "製造日表題" character varying(50),
    "入庫前名義項目名" character varying(50),
    "入庫前名義表題" character varying(50),
    "入庫後名義項目名" character varying(50),
    "入庫後名義表題" character varying(50)
);

CREATE VIEW soko_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE soko_fe."TM_本社扱い振分マスタ" (
    "取引元ID" integer,
    "取引元" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "運賃請求ID" integer,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "特定条件" boolean NOT NULL,
    "指定冷蔵庫" boolean NOT NULL,
    "備考" character varying(255),
    "取扱区分" boolean NOT NULL,
    "取扱名" character varying(255)
);

CREATE TABLE soko_fe."TM_産地マスタ" (
    "産地コード" integer NOT NULL,
    "通称" character varying(50),
    "国籍" character varying(50),
    "都道府県" character varying(255),
    "市町村" character varying(255),
    "備考" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_産地マスタ_産地コード_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_産地マスタ_産地コード_seq" OWNED BY soko_fe."TM_産地マスタ"."産地コード";

CREATE TABLE soko_fe."TM_相手先商品マスタ" (
    "受注元コード" integer,
    "受注元" character varying(255),
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "相手先商品コード" character varying(255),
    "相手先商品名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "帳合先コード1" character varying(255),
    "帳合先1" character varying(255),
    "相手先商品コード1" character varying(255),
    "相手先商品名1" character varying(50),
    "帳合先コード2" character varying(255),
    "帳合先2" character varying(255),
    "相手先商品コード2" character varying(255),
    "相手先商品名2" character varying(50),
    "本社商品コード" character varying(255),
    chk boolean NOT NULL,
    "備考" character varying(255),
    "製造場所ID" integer,
    "指定倉庫ID" integer,
    "使用不可" boolean NOT NULL
);

CREATE TABLE soko_fe."TM_読込コードマスタ" (
    "ID" integer NOT NULL,
    "取引先コード" integer,
    "取引先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "備考" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_読込コードマスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_読込コードマスタ_ID_seq" OWNED BY soko_fe."TM_読込コードマスタ"."ID";

CREATE TABLE soko_fe."TM_買取単価マスタ" (
    "ID" integer NOT NULL,
    "計算区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "単価" double precision,
    "開始日" timestamp without time zone,
    "終了日" timestamp without time zone,
    "買取先コード" integer,
    "買取先" character varying(50),
    "備考" character varying(50),
    "年度" character varying(255),
    "新会社コード" integer,
    "特定産地コード" integer,
    "産地名" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_買取単価マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_買取単価マスタ_ID_seq" OWNED BY soko_fe."TM_買取単価マスタ"."ID";

CREATE TABLE soko_fe."TM_買取単価マスタ_加工賃" (
    "ID" integer NOT NULL,
    "計算区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "単価" double precision,
    "開始日" timestamp without time zone,
    "終了日" timestamp without time zone,
    "買取先コード" integer,
    "買取先" character varying(50),
    "備考" character varying(50),
    "年度" character varying(255),
    "新会社コード" integer,
    "特定産地コード" integer,
    "産地名" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_買取単価マスタ_加工賃_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_買取単価マスタ_加工賃_ID_seq" OWNED BY soko_fe."TM_買取単価マスタ_加工賃"."ID";

CREATE TABLE soko_fe."TM_車両区分" (
    "車両区分ID" integer NOT NULL,
    "車両区分" character varying(50),
    "積載量" integer
);

CREATE SEQUENCE soko_fe."TM_車両区分_車両区分ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_車両区分_車両区分ID_seq" OWNED BY soko_fe."TM_車両区分"."車両区分ID";

CREATE TABLE soko_fe."TM_輸送区分" (
    "輸送区分ID" integer NOT NULL,
    "輸送区分" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_輸送区分_輸送区分ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_輸送区分_輸送区分ID_seq" OWNED BY soko_fe."TM_輸送区分"."輸送区分ID";

CREATE TABLE soko_fe."TM_週間予定表マスタ" (
    "ID" integer NOT NULL,
    "届け先コード" integer,
    "届け先名" character varying(255),
    "カウンター数" integer,
    "使用不可" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."TM_週間予定表マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_週間予定表マスタ_ID_seq" OWNED BY soko_fe."TM_週間予定表マスタ"."ID";

CREATE TABLE soko_fe."TM_運賃分類マスタ" (
    "運賃計算ID" integer NOT NULL,
    "運賃計算名" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_運賃分類マスタ_運賃計算ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_運賃分類マスタ_運賃計算ID_seq" OWNED BY soko_fe."TM_運賃分類マスタ"."運賃計算ID";

CREATE TABLE soko_fe."TM_運賃扱いマスタ" (
    "運賃扱い区分" integer NOT NULL,
    "扱い区分" character varying(255),
    "扱い区分名" character varying(255),
    "備考" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_運賃扱いマスタ_運賃扱い区分_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_運賃扱いマスタ_運賃扱い区分_seq" OWNED BY soko_fe."TM_運賃扱いマスタ"."運賃扱い区分";

CREATE TABLE soko_fe."TM_運賃振分区分マスタ" (
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255)
);

CREATE TABLE soko_fe."TM_運賃輸送区分" (
    "運賃輸送区分" integer NOT NULL,
    "運賃輸送区分名" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_運賃輸送区分_運賃輸送区分_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_運賃輸送区分_運賃輸送区分_seq" OWNED BY soko_fe."TM_運賃輸送区分"."運賃輸送区分";

CREATE TABLE soko_fe."TM_運送会社マスタ" (
    "ID" integer NOT NULL,
    "小口配送区分" boolean NOT NULL,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean NOT NULL,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean NOT NULL,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean NOT NULL,
    "eLixxi扱い便CD" character varying(255)
);

CREATE SEQUENCE soko_fe."TM_運送会社マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_運送会社マスタ_ID_seq" OWNED BY soko_fe."TM_運送会社マスタ"."ID";

CREATE TABLE soko_fe."TM_運送会社別サイズ別係数" (
    "ID" integer NOT NULL,
    "運賃改定ID" integer,
    "サイズ" character varying(255),
    "重量" double precision,
    "運賃係数" double precision
);

CREATE SEQUENCE soko_fe."TM_運送会社別サイズ別係数_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_運送会社別サイズ別係数_ID_seq" OWNED BY soko_fe."TM_運送会社別サイズ別係数"."ID";

CREATE TABLE soko_fe."TM_配達区分" (
    "ID" integer NOT NULL,
    "配達区分ID" integer,
    "配達区分" character varying(50)
);

CREATE SEQUENCE soko_fe."TM_配達区分_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."TM_配達区分_ID_seq" OWNED BY soko_fe."TM_配達区分"."ID";

CREATE TABLE soko_fe."T_ユーザー別商品推移" (
    "ID" integer NOT NULL,
    "集計日付" timestamp without time zone,
    "取引先コード" double precision,
    "取引先名" double precision,
    "届け先コード" integer,
    "届け先" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "入数" double precision,
    "備考" character varying(255),
    "一日kg" double precision,
    "一週kg" double precision,
    "一月kg" double precision,
    "三ヶ月kg" double precision,
    "半年kg" double precision,
    "年間kg" double precision,
    "平均kg" double precision,
    "一日ケース" double precision,
    "一週ケース" double precision,
    "一月ケース" double precision,
    "三ヶ月ケース" double precision,
    "半年ケース" double precision,
    "年間ケース" double precision,
    "平均一日kg" double precision,
    "平均一週kg" double precision,
    "平均一月kg" double precision,
    "平均三ヶ月kg" double precision,
    "平均半年kg" double precision,
    "平均年間kg" double precision,
    "平均平均kg" double precision,
    "平均一日ケース" double precision,
    "平均一週ケース" double precision,
    "平均一月ケース" double precision,
    "平均三ヶ月ケース" double precision,
    "平均半年ケース" double precision,
    "平均年間ケース" double precision,
    "現在在庫ケース" integer,
    "現在在庫kg" double precision,
    "受注込在庫ケース" integer,
    "受注込在庫kg" double precision,
    "受注予定ケース" integer,
    "受注予定kg" double precision
);

CREATE SEQUENCE soko_fe."T_ユーザー別商品推移_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_ユーザー別商品推移_ID_seq" OWNED BY soko_fe."T_ユーザー別商品推移"."ID";

CREATE TABLE soko_fe."T_仮入庫" (
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "出荷区分" boolean NOT NULL,
    chk boolean NOT NULL,
    "入力日付" timestamp without time zone,
    "サービス区分" boolean NOT NULL,
    "認識ID" character varying(50),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "輸送備考" character varying(50),
    "入庫ID" integer,
    "更新時間" character varying(50),
    "出庫ID" integer,
    "入庫フラグ" boolean NOT NULL,
    "完了フラグ" boolean NOT NULL,
    "抽出区分" boolean NOT NULL,
    "買取単価コード" integer,
    "インポートアドレス" character varying(255),
    "仮入庫済みフラグ" boolean NOT NULL,
    "通知" character varying(255),
    "タグ" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫時輸送ID" integer,
    "産地コード" integer
);

CREATE TABLE soko_fe."T_仮入庫_仮想在庫用" (
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "出荷区分" boolean NOT NULL,
    chk boolean NOT NULL,
    "入力日付" timestamp without time zone,
    "サービス区分" boolean NOT NULL,
    "認識ID" character varying(50),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "輸送備考" character varying(50),
    "入庫ID" integer,
    "更新時間" character varying(50),
    "出庫ID" integer,
    "入庫フラグ" boolean NOT NULL,
    "完了フラグ" boolean NOT NULL,
    "抽出区分" boolean NOT NULL,
    "買取単価コード" integer,
    "インポートアドレス" character varying(255),
    "仮入庫済みフラグ" boolean NOT NULL,
    "通知" character varying(255),
    "タグ" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫時輸送ID" integer,
    "産地コード" integer,
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer
);

CREATE TABLE soko_fe."T_倉庫請求書" (
    "ページNo" integer,
    "締切日" timestamp without time zone,
    "在庫ID" integer NOT NULL,
    "作成日付" character varying(50),
    "出荷元ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" real,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" integer,
    "上期在庫" integer,
    "下期在庫" integer,
    "入庫No" character varying(50),
    "入出庫料" integer,
    "保管料" integer
);

CREATE SEQUENCE soko_fe."T_倉庫請求書_在庫ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_倉庫請求書_在庫ID_seq" OWNED BY soko_fe."T_倉庫請求書"."在庫ID";

CREATE TABLE soko_fe."T_倉庫集計表" (
    "集計閉め日" timestamp without time zone,
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "期" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫No" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入数" integer,
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "ケース" integer,
    "商品kg" integer,
    "入出庫料" integer,
    "保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "諸経費1" integer,
    "訂正金額" integer,
    "備考" character varying(255),
    "在庫残数" integer,
    "在庫残kg" integer,
    "買取金額" integer,
    "UniqeCode" character varying(50)
);

CREATE TABLE soko_fe."T_入庫依頼書確認用" (
    "ID" integer NOT NULL,
    "出荷計画日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(255),
    "入庫後名義ID" integer,
    "入庫後名義名" character varying(255),
    "ケース" integer,
    "商品kg" double precision,
    "リンクコード1" character varying(255),
    "輸送ID" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(255),
    "車番" character varying(255),
    "キャンセル確認" boolean NOT NULL,
    "入庫依頼書送付chk" boolean NOT NULL,
    "送品案内送付chk" boolean NOT NULL,
    "変更chk" boolean NOT NULL,
    "通知" character varying(255),
    "地区コード" integer,
    "倉庫区分" boolean NOT NULL,
    "冷凍区分ID" integer,
    "入庫済みchk" boolean NOT NULL,
    "入庫依頼書コメント" character varying(255),
    "未データchk" boolean NOT NULL,
    "FAX送信カウント" integer,
    "入庫依頼書確認chk" boolean NOT NULL,
    "送品案内書確認chk" boolean NOT NULL,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "積込完了件数" integer,
    "出荷件数" integer,
    "ユーザー区分名" character varying(255),
    "入庫区分" boolean NOT NULL,
    "積込完了chk" boolean NOT NULL,
    "抽出区分" boolean NOT NULL,
    "扱い区分" integer,
    "扱い区分名" character varying(255),
    "仮入庫通知" boolean NOT NULL,
    "確認用chk" boolean NOT NULL,
    "仮FAX" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."T_入庫依頼書確認用_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_入庫依頼書確認用_ID_seq" OWNED BY soko_fe."T_入庫依頼書確認用"."ID";

CREATE TABLE soko_fe."T_出庫" (
    "出庫ID" integer,
    "輸送ID" integer,
    "出荷日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(50),
    "社内連絡" character varying(255),
    "ｻﾝﾌﾟﾙ区分" boolean NOT NULL,
    "出荷区分" boolean NOT NULL,
    chk boolean NOT NULL,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean NOT NULL,
    "認識ID" character varying(50),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean NOT NULL,
    "輸送備考" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "個別運賃" numeric(15,2),
    "入庫ID" integer,
    "積順" integer,
    "届け順" integer,
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "保管料" double precision,
    "入出庫料" double precision,
    "サービス料" integer,
    "買取単価コード" integer,
    "支払区分" integer,
    "買取金額" double precision,
    "出荷期数" integer,
    "入庫フラグ" boolean NOT NULL,
    "完了フラグ" boolean NOT NULL,
    "抽出区分" boolean NOT NULL,
    "保管費用支払日" timestamp without time zone,
    "受注確認" boolean NOT NULL,
    "買取chk" boolean NOT NULL,
    "ユーザーchk" boolean NOT NULL,
    "受注No" character varying(50),
    "ユーザー伝票No" character varying(255),
    "タグ" character varying(50),
    "買取区分" integer,
    "受注ID" integer,
    "輸送履歴読込chk" boolean NOT NULL,
    "登録時間" timestamp without time zone,
    "出庫確認" boolean NOT NULL,
    "配車確認" boolean NOT NULL,
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行指令No" character varying(255),
    "出庫済み" boolean NOT NULL,
    "製造工場ID" integer,
    "製造工場名" character varying(255)
);

CREATE TABLE soko_fe."T_在庫計算表" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "支払区分" integer,
    "集計月" character varying(50),
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "請求期" integer,
    "期" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫No" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "ケース" integer,
    "商品kg" double precision,
    "入出庫料" double precision,
    "保管料" double precision,
    "サービス料" double precision,
    "情報手数料" integer,
    "訂正金額" integer,
    "認識ID" character varying(50),
    "出庫ID" integer,
    "備考" character varying(255),
    "在庫残数" integer,
    "在庫残kg" double precision,
    "買取金額" integer,
    "経費ID" integer,
    "諸経費" double precision,
    chk boolean NOT NULL,
    "買取単価コード" integer,
    "請求個数" integer,
    "請求kg" double precision,
    "当月入出庫料" double precision,
    "当月保管料" double precision,
    "名変区分" character varying(50),
    "タグ" character varying(255),
    "当月入出庫料補正" double precision,
    "当月保管料補正" double precision,
    "税区分" integer,
    "荷役料" integer,
    "名変料" integer,
    "割増料" integer
);

CREATE TABLE soko_fe."T_在庫計算表_1期毎集計" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "支払区分" integer,
    "集計月" character varying(50),
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "請求期" integer,
    "期" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫No" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "ケース" integer,
    "商品kg" double precision,
    "入出庫料" double precision,
    "保管料" double precision,
    "サービス料" double precision,
    "情報手数料" integer,
    "訂正金額" integer,
    "認識ID" character varying(50),
    "出庫ID" integer,
    "備考" character varying(255),
    "在庫残数" integer,
    "在庫残kg" double precision,
    "買取金額" integer,
    "経費ID" integer,
    "諸経費" double precision,
    chk boolean NOT NULL,
    "買取単価コード" integer,
    "請求個数" integer,
    "請求kg" double precision,
    "当月入出庫料" double precision,
    "当月保管料" double precision,
    "名変区分" character varying(50),
    "タグ" character varying(255),
    "当月入出庫料補正" double precision,
    "当月保管料補正" double precision,
    "税区分" integer,
    "荷役料" integer,
    "名変料" integer,
    "割増料" integer,
    "冷蔵庫商品コード" integer,
    "上期ケース" integer,
    "下期ケース" integer,
    "上期保管料" integer,
    "下期保管料" integer,
    "上期入出庫料" integer,
    "下期入出庫料" integer
);

CREATE TABLE soko_fe."T_在庫計算表_参照用" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "期" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫No" character varying(50),
    "入庫後名義ID" integer,
    "名義名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "ケース" integer,
    "商品kg" double precision,
    "入出庫料" integer,
    "保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "訂正金額" integer,
    "認識ID" character varying(50),
    "出庫ID" integer,
    "備考" character varying(255),
    "在庫残数" integer,
    "在庫残kg" double precision,
    "買取金額" integer,
    "集計月" character varying(50),
    "諸経費" double precision,
    chk boolean NOT NULL,
    "経費ID" integer,
    "タグ" character varying(255)
);

CREATE TABLE soko_fe."T_寿Exel出庫" (
    "ID" integer NOT NULL,
    "出庫報告検索結果" character varying(255),
    "入庫NO" character varying(255),
    "商品コード" character varying(255),
    "入庫日" character varying(255),
    "賞味期限" character varying(255),
    "品名" character varying(255),
    "規格" character varying(255),
    "荷姿" character varying(255),
    "単量" character varying(255),
    "出庫数" character varying(255),
    "端数" character varying(255),
    "内外税" character varying(255),
    "摘要" character varying(255)
);

CREATE SEQUENCE soko_fe."T_寿Exel出庫_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_寿Exel出庫_ID_seq" OWNED BY soko_fe."T_寿Exel出庫"."ID";

CREATE TABLE soko_fe."T_寿Exel在庫" (
    "ID" integer NOT NULL,
    "CSVダウンロード" character varying(255),
    "寄託者名" character varying(255),
    "指定区分" character varying(255),
    "指定日" character varying(255),
    "荷口ロット" character varying(255),
    "入庫NO" character varying(255),
    "入庫日" character varying(255),
    "賞味期限" character varying(255),
    "商品コード" integer,
    "品名" character varying(255),
    "荷印" character varying(255),
    "規格" character varying(255),
    "単量" character varying(255),
    "入庫数" character varying(255),
    "在庫数" character varying(255),
    "端数" character varying(255),
    "重量" character varying(255)
);

CREATE SEQUENCE soko_fe."T_寿Exel在庫_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_寿Exel在庫_ID_seq" OWNED BY soko_fe."T_寿Exel在庫"."ID";

CREATE TABLE soko_fe."T_寿Exel在庫_TypeB" (
    "ID" integer NOT NULL,
    "商品によるロット検査結果" character varying(255),
    "商品コード" character varying(255),
    "入庫NO" character varying(255),
    "品名" character varying(255),
    "入庫日" character varying(255),
    "賞味期限" character varying(255),
    "単量" double precision,
    "入庫数" double precision,
    "在庫数" double precision,
    "端数" double precision,
    "重量" double precision,
    "最終出庫日" character varying(255),
    "出庫止" character varying(255)
);

CREATE SEQUENCE soko_fe."T_寿Exel在庫_TypeB_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_寿Exel在庫_TypeB_ID_seq" OWNED BY soko_fe."T_寿Exel在庫_TypeB"."ID";

CREATE TABLE soko_fe."T_寿出庫データ" (
    "出庫報告検索" character varying(255),
    "入庫No" character varying(255),
    "商品コード" character varying(255),
    "入庫日" character varying(255),
    "賞味期限" character varying(255),
    "品名" character varying(255),
    "規格/荷印" character varying(255),
    "荷姿" character varying(255),
    "重量" character varying(255),
    "出庫数" character varying(255),
    "端数" character varying(255),
    "内外税項目" character varying(255),
    "摘要" character varying(255),
    "出荷日" timestamp without time zone
);

CREATE TABLE soko_fe."T_画面一覧" (
    "ID" integer NOT NULL,
    "分類" integer,
    "名称" character varying(255),
    "区分" integer,
    "優先順位" integer,
    "実行名" character varying(255),
    "ソース名" character varying(255),
    "対象フィールド" character varying(50),
    "解説" character varying(50),
    "生産計画" boolean NOT NULL,
    "輸送計画" boolean NOT NULL,
    "経理事務" boolean NOT NULL,
    "品質管理" boolean NOT NULL,
    "在庫管理" boolean NOT NULL,
    "マスタ管理" boolean NOT NULL,
    "引数" character varying(255)
);

CREATE TABLE soko_fe."T_自動名変在庫リスト" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "グループ商品コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean NOT NULL,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean NOT NULL,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "振替ケース" integer,
    "グループコード" integer,
    "商品区分" integer,
    "入出庫料" integer,
    "保管料" integer,
    "前期保管料" integer,
    "後期保管料" integer,
    "サービス料" integer,
    "情報手数料" integer,
    "その他費用" integer,
    "訂正金額" integer,
    "変更前在庫ID" integer,
    "確定フラグ" boolean NOT NULL,
    "最終出庫日" timestamp without time zone,
    "不一致フラグ" boolean NOT NULL,
    "不一致備考" character varying(255),
    "買取単価コード" integer,
    "請求年度" integer,
    "ユーザーchk" boolean NOT NULL,
    "インポートアドレス" character varying(255),
    "名変回数" integer,
    "名変前在庫ID" integer,
    "保管料負担日" timestamp without time zone,
    "タグ" character varying(50),
    "課税区分" integer,
    "登録時間" timestamp without time zone,
    "入出庫料固定" boolean NOT NULL,
    "産地コード" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "商品状態隠語" character varying(50),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫時輸送ID" integer,
    "タグ2" character varying(255),
    "大阪名変chk" boolean NOT NULL,
    "名変予定日" timestamp without time zone
);

CREATE TABLE soko_fe."T_車種区分" (
    "ID" integer NOT NULL,
    "区分" integer,
    "輸送ルート" character varying(50),
    "重量kg" integer
);

CREATE SEQUENCE soko_fe."T_車種区分_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_車種区分_ID_seq" OWNED BY soko_fe."T_車種区分"."ID";

CREATE TABLE soko_fe."T_輸送履歴" (
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "売り日" timestamp without time zone,
    "帳合運送会社コード" integer,
    "帳合運送会社名" character varying(50),
    "手配運送会社コード" integer,
    "手配運送会社名" character varying(50),
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "輸送区分ID" integer,
    "輸送区分" character varying(20),
    "車両区分ID" integer,
    "車両区分" character varying(20),
    "配達区分ID" integer,
    "配達区分" character varying(20),
    "冷凍区分ID" integer,
    "冷凍区分" character varying(20),
    "輸送ID" integer,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "規格" character varying(50),
    "入数" real,
    "ケース" integer,
    "商品kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "地区コード" integer,
    "地区名" character varying(50),
    "十二地区" character varying(50),
    "都道府県" character varying(50),
    "原料コード" integer,
    "入庫名義" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE soko_fe."T_週間予定表_入庫" (
    "ID" integer NOT NULL,
    "出荷計画日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(255),
    "入庫後名義ID" integer,
    "入庫後名義名" character varying(255),
    "ケース" integer,
    "商品kg" double precision,
    "リンクコード1" character varying(255),
    "キャンセル確認" boolean NOT NULL,
    "変更chk" boolean NOT NULL,
    "通知" character varying(255),
    "確認chk" boolean NOT NULL,
    "名義短縮表示" character varying(255)
);

CREATE SEQUENCE soko_fe."T_週間予定表_入庫_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_週間予定表_入庫_ID_seq" OWNED BY soko_fe."T_週間予定表_入庫"."ID";

CREATE TABLE soko_fe."T_週間予定表_出庫" (
    "ID" integer NOT NULL,
    "出荷計画日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "入庫後名義ID" integer,
    "入庫後名義名" character varying(255),
    "ケース" integer,
    "商品kg" double precision,
    "リンクコード1" character varying(255),
    "輸送ID" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(255),
    "車番" character varying(255),
    "キャンセル確認" boolean NOT NULL,
    "出庫済みchk" boolean NOT NULL,
    "送品案内送付chk" boolean NOT NULL,
    "変更chk" boolean NOT NULL,
    "通知" character varying(255),
    "地区コード" integer,
    "倉庫区分" boolean NOT NULL,
    "冷凍区分ID" integer,
    "入庫済みchk" boolean NOT NULL,
    "入庫依頼書コメント" character varying(255),
    "未データchk" boolean NOT NULL,
    "FAX送信カウント" integer,
    "入庫依頼書確認chk" boolean NOT NULL,
    "送品案内書確認chk" boolean NOT NULL,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "積込完了件数" integer,
    "出荷件数" integer,
    "ユーザー区分名" character varying(255),
    "入庫区分" boolean NOT NULL,
    "積込完了chk" boolean NOT NULL,
    "抽出区分" boolean NOT NULL,
    "扱い区分" integer,
    "扱い区分名" character varying(255),
    "仮入庫通知" boolean NOT NULL,
    "確認用chk" boolean NOT NULL,
    "仮FAX" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."T_週間予定表_出庫_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_週間予定表_出庫_ID_seq" OWNED BY soko_fe."T_週間予定表_出庫"."ID";

CREATE TABLE soko_fe."T_配車表" (
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "輸送ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" integer,
    "ケース" integer,
    "商品kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "備考" character varying(255),
    "商品積込順" integer,
    "届け先順" integer,
    "集荷順" integer,
    "受付時間" character varying(50),
    "売り日" timestamp without time zone,
    "積順" integer
);

CREATE TABLE soko_fe."T_配送料明細" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "日付" integer,
    "出庫日" timestamp without time zone,
    "締切日" timestamp without time zone,
    "出庫ケース" integer,
    "出庫kg" integer,
    "単価" real,
    "届け先コード" integer,
    "届け先" character varying(50),
    "配送料" integer,
    "入庫後名義ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "入庫No" character varying(50),
    "賞味期限" timestamp without time zone
);

CREATE SEQUENCE soko_fe."T_配送料明細_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."T_配送料明細_ID_seq" OWNED BY soko_fe."T_配送料明細"."ID";

CREATE TABLE soko_fe."エクセル用出荷履歴" (
    "ID" integer NOT NULL,
    "出荷日" timestamp without time zone,
    "曜日" character varying(50),
    "出荷元" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "ケース" integer,
    "商品kg" integer,
    "納品日" timestamp without time zone,
    "届け先" character varying(50),
    "入庫名義" character varying(50),
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "日数" integer
);

CREATE SEQUENCE soko_fe."エクセル用出荷履歴_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."エクセル用出荷履歴_ID_seq" OWNED BY soko_fe."エクセル用出荷履歴"."ID";

CREATE TABLE soko_fe."オブジェクト一覧" (
    "ID" integer NOT NULL,
    "テーブル" character varying(50),
    "日付項目" character varying(50),
    "月末処理" boolean NOT NULL,
    "オブジェクト名" character varying(50),
    "担当ID" integer,
    "担当" character varying(50),
    "ユーザー関数" character varying(50),
    "名称" character varying(50),
    "印刷区分" character varying(50),
    "備考" character varying(50),
    "ユーザー印刷" boolean NOT NULL,
    "本社報告印刷" boolean NOT NULL,
    "処理区分" character varying(255),
    "非表示" boolean NOT NULL
);

CREATE SEQUENCE soko_fe."オブジェクト一覧_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."オブジェクト一覧_ID_seq" OWNED BY soko_fe."オブジェクト一覧"."ID";

CREATE TABLE soko_fe."テーブル1" (
    "ID" integer NOT NULL,
    "フォームタイプ" character varying(255),
    "請求書No" integer,
    "送付先名" character varying(255),
    "送付先郵便番号" character varying(255),
    "送付先住所" character varying(255),
    "送付先住所２" character varying(255),
    "送付先CD" integer,
    "債権部署名" character varying(255),
    "債権郵便番号" timestamp without time zone,
    "債権住所" character varying(255),
    "債権住所２" character varying(255),
    "債権電話番号" character varying(255),
    "債権ＦＡＸ番号" character varying(255),
    "締日年" integer,
    "締日月" integer,
    "締日日" integer,
    "課税" integer,
    "免税" integer,
    "立替" integer,
    "消費税" integer,
    "ご請求額" integer,
    "支払方法" character varying(255),
    "支払年" integer,
    "支払月" integer,
    "支払日" integer,
    "銀行支店名" character varying(255),
    "預金種" character varying(255),
    "口座番号" integer,
    "口座名義" character varying(255),
    "明細請求No" integer,
    "明細ハイフン" character varying(255),
    "明細子No" integer,
    "明細課税" integer,
    "明細免税" integer,
    "明細立替" integer,
    "明細消費税" integer,
    "明細合計" integer,
    "取引部署" character varying(255),
    "お取引先名" character varying(255),
    "発行年" integer,
    "発行月" integer,
    "発行日" integer,
    "ページ数" integer,
    "ロゴ" character varying(255),
    "社印" character varying(255),
    "子No" integer,
    "荷主名" character varying(255),
    "郵便番号" character varying(255),
    "住所" character varying(255),
    "住所２" character varying(255),
    "荷主CD" integer,
    "センター名" character varying(255),
    "入庫日" character varying(255),
    "コード" character varying(255),
    "品名規格" character varying(255),
    "諸掛名" character varying(255),
    "請求個数" integer,
    "請求重量" double precision,
    "単位" character varying(255),
    "料率アスタリスク" character varying(255),
    "料率" double precision,
    "金額アスタリスク" character varying(255),
    "小計" integer,
    "金額" integer,
    "備考" character varying(255),
    "期数" integer,
    "保管単位" character varying(255),
    "保管入庫数量" integer,
    "保管入庫重量" character varying(255),
    "期首日" timestamp without time zone,
    "保管数量" integer,
    "保管重量" character varying(255),
    "車輌CD" character varying(255),
    "配送先名" character varying(255),
    "請求No" character varying(255),
    "積地名称" character varying(255),
    "降地名称" character varying(255),
    "区分" character varying(255),
    "受注No" character varying(255),
    "受注Noハイフン" character varying(255),
    "受注行" character varying(255),
    "商品名" character varying(255),
    "規格ブランド" character varying(255),
    "その他" character varying(255),
    "最大ページ" integer,
    "現在ページ" integer,
    "小計免税保管" integer,
    "小計免税入出庫" integer,
    "小計免税その他" integer,
    "小計免税合計" integer,
    "小計課税保管" integer,
    "小計課税入出庫" integer,
    "小計課税その他" integer,
    "小計課税合計" integer,
    "合計免税保管" integer,
    "合計免税入出庫" integer,
    "合計免税その他" integer,
    "合計免税合計" integer,
    "合計課税保管" integer,
    "合計課税入出庫" integer,
    "合計課税その他" integer,
    "合計課税合計" integer,
    "一貫明細括弧料率" character varying(255),
    "一貫明細括弧定額" character varying(255),
    "会社名" character varying(255),
    "諸掛名２" character varying(255),
    "摘要" character varying(255),
    "登録番号" character varying(255)
);

CREATE SEQUENCE soko_fe."テーブル1_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE soko_fe."テーブル1_ID_seq" OWNED BY soko_fe."テーブル1"."ID";

CREATE TABLE tehai_fe."TD_架空在庫" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean NOT NULL,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean NOT NULL,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean NOT NULL,
    "管理備考" text,
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "インポート場所ID" integer,
    "産地コード" integer,
    "産地通称" character varying(255),
    "商品状態隠語" character varying(50),
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean NOT NULL,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean NOT NULL,
    "検査予定日" timestamp without time zone,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE tehai_fe."TM_イベントスケジュール" (
    "ID" integer NOT NULL,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean NOT NULL,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean NOT NULL,
    "使用不可" boolean NOT NULL,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE SEQUENCE tehai_fe."TM_イベントスケジュール_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_イベントスケジュール_ID_seq" OWNED BY tehai_fe."TM_イベントスケジュール"."ID";

CREATE TABLE tehai_fe."TM_入庫先商品別名義条件" (
    "ID" integer NOT NULL,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean NOT NULL,
    "特定条件" boolean NOT NULL,
    "指定冷蔵庫" boolean NOT NULL,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean NOT NULL,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean NOT NULL,
    "取扱名" character varying(255),
    "横持区分" boolean NOT NULL,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean NOT NULL,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean NOT NULL
);

CREATE SEQUENCE tehai_fe."TM_入庫先商品別名義条件_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_入庫先商品別名義条件_ID_seq" OWNED BY tehai_fe."TM_入庫先商品別名義条件"."ID";

CREATE TABLE tehai_fe."TM_冷凍区分" (
    "冷凍ID" integer NOT NULL,
    "冷凍区分" character varying(50),
    "区分名2" character varying(255),
    "コメント" character varying(255)
);

CREATE SEQUENCE tehai_fe."TM_冷凍区分_冷凍ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_冷凍区分_冷凍ID_seq" OWNED BY tehai_fe."TM_冷凍区分"."冷凍ID";

CREATE TABLE tehai_fe."TM_出荷場所条件" (
    "ID" integer NOT NULL,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "名義ID" integer
);

CREATE SEQUENCE tehai_fe."TM_出荷場所条件_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_出荷場所条件_ID_seq" OWNED BY tehai_fe."TM_出荷場所条件"."ID";

CREATE TABLE tehai_fe."TM_参照アドレス" (
    "ID" integer NOT NULL,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE SEQUENCE tehai_fe."TM_参照アドレス_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_参照アドレス_ID_seq" OWNED BY tehai_fe."TM_参照アドレス"."ID";

CREATE VIEW tehai_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE tehai_fe."TM_定形メールマスタ" (
    "ID" integer NOT NULL,
    "実行名" character varying(255),
    "件名" character varying(255),
    "本文" text,
    "宛先" character varying(255),
    "CC1" character varying(255),
    "CC2" character varying(255),
    "CC3" character varying(255),
    "CC4" character varying(255),
    "添付アドレス" character varying(255),
    "作成者" character varying(255),
    "作成日" character varying(255),
    "自動送信有無" boolean NOT NULL
);

CREATE SEQUENCE tehai_fe."TM_定形メールマスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_定形メールマスタ_ID_seq" OWNED BY tehai_fe."TM_定形メールマスタ"."ID";

CREATE VIEW tehai_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE tehai_fe."TM_相手先届け先マスタ" (
    "ID" integer NOT NULL,
    "相手方届け先コード" character varying(50),
    "自社コード" integer,
    "届け先" character varying(50),
    "相手先コード" integer,
    "相手先名" character varying(50),
    "区分名" character varying(255),
    "備考" character varying(255),
    chk boolean NOT NULL
);

CREATE SEQUENCE tehai_fe."TM_相手先届け先マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_相手先届け先マスタ_ID_seq" OWNED BY tehai_fe."TM_相手先届け先マスタ"."ID";

CREATE TABLE tehai_fe."TM_相手運送会社マスタ" (
    "ID" integer NOT NULL,
    "相手方運送会社コード" character varying(50),
    "自社運送会社コード" integer,
    "運送会社名" character varying(50),
    "相手先コード" integer,
    "相手先名" character varying(50),
    "区分名" character varying(255),
    "備考" character varying(255),
    chk boolean NOT NULL
);

CREATE SEQUENCE tehai_fe."TM_相手運送会社マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_相手運送会社マスタ_ID_seq" OWNED BY tehai_fe."TM_相手運送会社マスタ"."ID";

CREATE TABLE tehai_fe."TM_製造場所" (
    "製造場所ID" integer NOT NULL,
    "製造場所" character varying(255),
    "短縮名" character varying(255),
    "倉庫ID" integer
);

CREATE SEQUENCE tehai_fe."TM_製造場所_製造場所ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_製造場所_製造場所ID_seq" OWNED BY tehai_fe."TM_製造場所"."製造場所ID";

CREATE TABLE tehai_fe."TM_車両区分" (
    "車両区分ID" integer NOT NULL,
    "車両区分" character varying(50),
    "積載量" integer
);

CREATE SEQUENCE tehai_fe."TM_車両区分_車両区分ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_車両区分_車両区分ID_seq" OWNED BY tehai_fe."TM_車両区分"."車両区分ID";

CREATE TABLE tehai_fe."TM_輸送区分" (
    "輸送区分ID" integer NOT NULL,
    "輸送区分" character varying(50)
);

CREATE SEQUENCE tehai_fe."TM_輸送区分_輸送区分ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_輸送区分_輸送区分ID_seq" OWNED BY tehai_fe."TM_輸送区分"."輸送区分ID";

CREATE TABLE tehai_fe."TM_運賃輸送区分" (
    "運賃輸送区分" integer NOT NULL,
    "運賃輸送区分名" character varying(255)
);

CREATE SEQUENCE tehai_fe."TM_運賃輸送区分_運賃輸送区分_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_運賃輸送区分_運賃輸送区分_seq" OWNED BY tehai_fe."TM_運賃輸送区分"."運賃輸送区分";

CREATE TABLE tehai_fe."TM_運送会社マスタ" (
    "ID" integer NOT NULL,
    "小口配送区分" boolean NOT NULL,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean NOT NULL,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean NOT NULL,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean NOT NULL,
    "eLixxi扱い便CD" character varying(255)
);

CREATE SEQUENCE tehai_fe."TM_運送会社マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_運送会社マスタ_ID_seq" OWNED BY tehai_fe."TM_運送会社マスタ"."ID";

CREATE TABLE tehai_fe."TM_配達区分" (
    "ID" integer NOT NULL,
    "配達区分ID" integer,
    "配達区分" character varying(50)
);

CREATE SEQUENCE tehai_fe."TM_配達区分_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."TM_配達区分_ID_seq" OWNED BY tehai_fe."TM_配達区分"."ID";

CREATE TABLE tehai_fe."T_ニチレイ輸送手配詳細データ" (
    "輸送ID" integer,
    "出荷計画日" timestamp without time zone,
    "運行No" character varying(255),
    "運送CD" character varying(255),
    "実運送会社" character varying(255),
    "車番" character varying(255),
    "集荷時間" timestamp without time zone,
    "集荷先CD" character varying(255),
    "倉庫名" character varying(255),
    "届け先CD" character varying(255),
    "届け先" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "個数" double precision,
    "KG" double precision,
    "納品日" timestamp without time zone,
    "航路" character varying(255),
    "集荷" text,
    "配達" character varying(255),
    "ID" integer NOT NULL,
    "備考" character varying(255),
    "elixxi受付No" character varying(255),
    "車種" character varying(255)
);

CREATE SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データ_ID_seq" OWNED BY tehai_fe."T_ニチレイ輸送手配詳細データ"."ID";

CREATE TABLE tehai_fe."T_ニチレイ輸送手配詳細データ_前回" (
    "輸送ID" integer,
    "出荷計画日" timestamp without time zone,
    "運行No" character varying(255),
    "運送CD" character varying(255),
    "車種" character varying(255),
    "実運送会社" character varying(255),
    "車番" character varying(255),
    "集荷時間" timestamp without time zone,
    "集荷先CD" character varying(255),
    "倉庫名" character varying(255),
    "届け先CD" character varying(255),
    "届け先" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "個数" double precision,
    "KG" double precision,
    "納品日" timestamp without time zone,
    "航路" character varying(255),
    "集荷" text,
    "配達" character varying(255),
    "備考" character varying(255),
    "elixxi受付No" character varying(255),
    "ID" integer NOT NULL
);

CREATE SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データ_前回_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データ_前回_ID_seq" OWNED BY tehai_fe."T_ニチレイ輸送手配詳細データ_前回"."ID";

CREATE TABLE tehai_fe."T_ニチレイ輸送手配詳細データver2" (
    "輸送ID" integer,
    "運行No" character varying(255),
    "運送CD" character varying(255),
    "実運送会社" character varying(255),
    "車番" character varying(255),
    "集荷時間" timestamp without time zone,
    "集荷先CD" character varying(255),
    "倉庫名" character varying(255),
    "届け先CD" character varying(255),
    "届け先" character varying(255),
    "KG" double precision,
    "航路" character varying(255),
    "集荷" text,
    "配達" character varying(255),
    "備考" character varying(255),
    "elixxi受付No" character varying(255),
    "ID" integer NOT NULL,
    "CRUD区分" character varying(255),
    "車種" character varying(255),
    "出荷計画日" character varying(255),
    "納品日" character varying(255)
);

CREATE SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データver2_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データver2_ID_seq" OWNED BY tehai_fe."T_ニチレイ輸送手配詳細データver2"."ID";

CREATE TABLE tehai_fe."T_ニチレイ輸送手配詳細データver2_前回" (
    "輸送ID" integer,
    "CRUD区分" character varying(255),
    "運行No" character varying(255),
    "運送CD" character varying(255),
    "実運送会社" character varying(255),
    "車番" character varying(255),
    "集荷時間" timestamp without time zone,
    "集荷先CD" character varying(255),
    "倉庫名" character varying(255),
    "届け先CD" character varying(255),
    "届け先" character varying(255),
    "KG" double precision,
    "航路" character varying(255),
    "集荷" text,
    "配達" character varying(255),
    "備考" character varying(255),
    "elixxi受付No" character varying(255),
    "ID" integer NOT NULL,
    "車種" character varying(255),
    "出荷計画日" character varying(255),
    "納品日" character varying(255)
);

CREATE SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データver2_前回_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."T_ニチレイ輸送手配詳細データver2_前回_ID_seq" OWNED BY tehai_fe."T_ニチレイ輸送手配詳細データver2_前回"."ID";

CREATE TABLE tehai_fe."T_前回輸送手配" (
    "輸送ID" integer,
    "新規・訂正・削除" character varying(255),
    "集荷日" character varying(255),
    "着日" character varying(255),
    "運送会社名" character varying(255),
    "適用" timestamp without time zone,
    "積込時間" timestamp without time zone,
    "集荷場所" character varying(255),
    "集荷場所2" bytea,
    "集荷場所3" bytea,
    "届け先" character varying(255),
    "届け先2" bytea,
    "届け先3" bytea,
    "道内外区分" character varying(255),
    "パレット輸送区分" integer,
    "運送会社ID" integer,
    "作成時間" character varying(255),
    "集荷日変更" boolean NOT NULL,
    "着日変更" boolean NOT NULL,
    "運送会社名変更" boolean NOT NULL,
    "積込み時間変更" boolean NOT NULL,
    "集荷場所変更" boolean NOT NULL,
    "届け先変更" boolean NOT NULL
);

CREATE TABLE tehai_fe."T_日別予想kg" (
    "ID" integer NOT NULL,
    "日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "在庫ケース" integer,
    "入庫ケース" integer,
    "入庫kg" integer,
    "出庫ケース" integer,
    "製造kg" integer,
    "出荷kg" integer,
    "在庫kg" integer,
    "作成日" character varying(255),
    "在庫パレット数" integer,
    "繰越パレット数" integer,
    "包装使用パレット数" integer,
    "出荷戻りパレット数" integer
);

CREATE SEQUENCE tehai_fe."T_日別予想kg_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE tehai_fe."T_日別予想kg_ID_seq" OWNED BY tehai_fe."T_日別予想kg"."ID";

CREATE TABLE tehai_fe."貼り付けエラー" (
    "輸送ID" double precision,
    "CRUD区分" character varying(255),
    "出荷計画日" character varying(255),
    "運行No" character varying(255),
    "運送CD" character varying(255),
    "車種" character varying(255),
    "実運送会社" character varying(255),
    "車番" character varying(255),
    "集荷時間" timestamp without time zone,
    "集荷先CD" character varying(255),
    "倉庫名" character varying(255),
    "届け先CD" character varying(255),
    "届け先" character varying(255),
    "KG" double precision,
    "納品日" character varying(255),
    "航路" character varying(255),
    "集荷" character varying(255),
    "配達" character varying(255),
    "備考" character varying(255),
    "elixxi受付No" character varying(255),
    "ID" double precision
);

CREATE TABLE tenbai."TD_出荷" (
    "出庫ID" integer,
    "輸送ID" integer,
    "入庫ID" integer,
    "出荷日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(255),
    "社内連絡" character varying(150),
    "サンプル区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean,
    "賞味期限通知" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" character varying(255),
    "個別運賃" numeric(19,4),
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "買取単価コード" integer,
    "買取chk" boolean,
    "買取金額" double precision,
    "出荷期数" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "ユーザー伝票No" character varying(50),
    "受注確認" boolean,
    "出荷元数" integer,
    "破損個数" integer,
    "入力時間" timestamp without time zone,
    "受注グループ" integer,
    "輸送履歴読込chk" boolean,
    "ユーザーchk" boolean,
    "帳票グループ化" integer,
    "受注表題" text,
    "積込確認" boolean,
    "送り状No" character varying(50),
    "締切時間" character varying(50),
    "破損出庫ID" integer,
    "商品区分" integer,
    "出荷元kg" double precision,
    "訂正kg" double precision,
    "入庫備考" boolean,
    "タグ" character varying(50),
    "受注ID" integer,
    "タグ2" character varying(50),
    "商品輸送区分" integer,
    "商品輸送区分名" character varying(255),
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行指令No" character varying(255),
    "本社受注" boolean,
    "運賃請求ID" integer,
    "伝票No確認用" character varying(50),
    "商品状態隠語" character varying(50),
    "届け先区分" integer,
    "運賃扱い区分" integer,
    "インポート場所ID" integer,
    "パレット使用枚数" integer,
    "倉庫受注ID" integer,
    "印刷前検査待ちフラグ" boolean,
    "丸北出庫ID" integer,
    "他工場ロットNo" character varying(255),
    "他工場伝票No" character varying(255),
    "丸北輸送ID" integer,
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "年間受注ID" character varying(255),
    "Newクロップ区分" boolean,
    "取扱い区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "蔵前区分" boolean,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "売上科目コード" integer,
    "売上科目" character varying(255)
);

CREATE TABLE tenbai."TD_受注" (
    "受注受付ID" integer,
    "受注ID" integer,
    "受注番号" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "受注日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "残ケース" integer,
    "商品kg" double precision,
    "残kg" double precision,
    "納品日" timestamp without time zone,
    "受注先ID" integer,
    "受注先名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "正式届け先名" character varying(255),
    "単価" double precision,
    "請求金額" integer,
    "備考" character varying(255),
    "社内連絡" character varying(255),
    chk boolean,
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" smallint,
    "枝番1" character varying(50),
    "枝番2" character varying(50),
    "枝番3" character varying(50),
    "登録時間" character varying(255),
    "更新時間" character varying(255),
    "受注番号1" character varying(255),
    "商品コード1" integer,
    "ケース1" integer,
    "商品kg1" double precision,
    "届け先コード1" integer,
    "納品日1" timestamp without time zone,
    "相手届け先コード" integer,
    "入力日" timestamp without time zone,
    "入庫名義ID" integer,
    "出荷予定日" timestamp without time zone,
    "送り状No" character varying(255),
    "手配DataChk" boolean,
    "入力確認チェック" boolean,
    "受注手配確認" boolean,
    "受注出庫確認" boolean,
    "出庫返信FAX確認" boolean,
    "受注グループID" integer,
    "輸送手配返信確認" boolean,
    "受領書確認" boolean,
    "受注返信FAX" boolean,
    "受注帳合ID" integer,
    "受注帳合名" character varying(255),
    "取引元ID" integer,
    "取引元" character varying(255),
    "取引帳合ID" character varying(255),
    "取引帳合" character varying(255),
    "受注区分" integer,
    "賞味期限送信" boolean,
    "本社受注" boolean,
    "消費税" integer,
    "税込請求金額" integer,
    "送品案内" boolean,
    "出力用chk" boolean,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "伝票作成" boolean,
    "伝票送付" boolean,
    "本社受注ID" integer,
    "初回登録chk" boolean,
    "受注ユーザーID" integer,
    "受注ユーザー名" character varying(255),
    "伝票FAX" boolean,
    "完了消込" boolean,
    "丸北出荷数" integer,
    "倉庫出荷数" integer,
    "転売出荷数" integer,
    "統一受注ID" character varying(255),
    "年間受注ID" integer,
    "月間カウンタ" integer,
    "月間No" integer,
    "隠語" character varying(255),
    "運賃振分区分" integer,
    "運賃請求ID" integer,
    "変更前ケース" integer,
    "変更前商品kg" double precision,
    "少量残連絡chk" boolean,
    "少量残連絡備考" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "蔵前区分" boolean,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "販盛売上行" character varying(255),
    "販盛売上番号" character varying(255),
    "販盛伝票番号" character varying(255)
);

CREATE TABLE web_fe."MQ_取込" (
    "注文番号" character varying(30),
    "枝番" integer,
    "発注元コード" character varying(20),
    "納入数量" double precision,
    "納入予定日" character varying(10),
    "出荷日" character varying(10),
    "ロット番号" character varying(30),
    "賞味期限" character varying(10),
    "完納" boolean NOT NULL,
    "無効" boolean NOT NULL,
    "取込日時" timestamp without time zone
);

CREATE TABLE web_fe."MQ_枝番" (
    "出庫ID" integer,
    "注文番号" character varying(30),
    "枝番" integer,
    "状態" character varying(30),
    "差異" character varying(255),
    "確認日時" timestamp without time zone
);

CREATE TABLE web_fe."MQ_発注元対応" (
    "取引元ID" integer,
    "WebEDIコード" character varying(20),
    "発注元名" character varying(100)
);

CREATE TABLE web_fe."M_Webアドレス操作" (
    "ID" integer NOT NULL,
    "実行名" character varying(255),
    "実行グループ名" character varying(255),
    "指定サイト" text,
    "検索ワード" character varying(255),
    "備考" character varying(255),
    "動作1" character varying(255),
    "動作2" character varying(255),
    "動作3" character varying(255),
    "動作4" character varying(255),
    "動作5" character varying(255),
    "動作6" character varying(255),
    "動作7" character varying(255),
    "動作8" character varying(255),
    "動作9" character varying(255),
    "動作10" character varying(255)
);

CREATE SEQUENCE web_fe."M_Webアドレス操作_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."M_Webアドレス操作_ID_seq" OWNED BY web_fe."M_Webアドレス操作"."ID";

CREATE TABLE web_fe."TM_WebM" (
    "ID" integer NOT NULL,
    "WebG" character varying(255),
    "担当者" character varying(255),
    "UN" character varying(255),
    "PW" character varying(255),
    "PCN" character varying(255),
    "備考" character varying(255)
);

CREATE SEQUENCE web_fe."TM_WebM_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_WebM_ID_seq" OWNED BY web_fe."TM_WebM"."ID";

CREATE TABLE web_fe."TM_elixxi倉庫コードマスタ" (
    "ID" integer NOT NULL,
    "相手方届け先コード" character varying(50),
    "自社コード" integer,
    "届け先" character varying(50),
    "備考" character varying(255)
);

CREATE SEQUENCE web_fe."TM_elixxi倉庫コードマスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_elixxi倉庫コードマスタ_ID_seq" OWNED BY web_fe."TM_elixxi倉庫コードマスタ"."ID";

CREATE TABLE web_fe."TM_イベントスケジュール" (
    "ID" integer NOT NULL,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean NOT NULL,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean NOT NULL,
    "使用不可" boolean NOT NULL,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE SEQUENCE web_fe."TM_イベントスケジュール_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_イベントスケジュール_ID_seq" OWNED BY web_fe."TM_イベントスケジュール"."ID";

CREATE TABLE web_fe."TM_ニチレイ大谷地積み日指定表示マスタ" (
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "備考" character varying(255)
);

CREATE TABLE web_fe."TM_ランテック賞味期限表示マスタ" (
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "備考" character varying(255),
    "社内コメント" text
);

CREATE TABLE web_fe."TM_入庫先商品別名義条件" (
    "ID" integer NOT NULL,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean NOT NULL,
    "特定条件" boolean NOT NULL,
    "指定冷蔵庫" boolean NOT NULL,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean NOT NULL,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean NOT NULL,
    "取扱名" character varying(255),
    "横持区分" boolean NOT NULL,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean NOT NULL,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean NOT NULL
);

CREATE SEQUENCE web_fe."TM_入庫先商品別名義条件_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_入庫先商品別名義条件_ID_seq" OWNED BY web_fe."TM_入庫先商品別名義条件"."ID";

CREATE TABLE web_fe."TM_参照アドレス" (
    "ID" integer NOT NULL,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE web_fe."TM_参照アドレスHOUSOU" (
    "ID" integer NOT NULL,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE SEQUENCE web_fe."TM_参照アドレスHOUSOU_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_参照アドレスHOUSOU_ID_seq" OWNED BY web_fe."TM_参照アドレスHOUSOU"."ID";

CREATE SEQUENCE web_fe."TM_参照アドレス_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_参照アドレス_ID_seq" OWNED BY web_fe."TM_参照アドレス"."ID";

CREATE VIEW web_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE web_fe."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer
);

CREATE VIEW web_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE web_fe."TM_相手先商品マスタ" (
    "受注元コード" integer,
    "受注元" character varying(255),
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "相手先商品コード" character varying(255),
    "相手先商品名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "帳合先コード1" character varying(255),
    "帳合先1" character varying(255),
    "相手先商品コード1" character varying(255),
    "相手先商品名1" character varying(50),
    "帳合先コード2" character varying(255),
    "帳合先2" character varying(255),
    "相手先商品コード2" character varying(255),
    "相手先商品名2" character varying(50),
    "本社商品コード" character varying(255),
    chk boolean NOT NULL,
    "備考" character varying(255),
    "製造場所ID" integer,
    "指定倉庫ID" integer,
    "使用不可" boolean NOT NULL
);

CREATE TABLE web_fe."TM_運送会社マスタ" (
    "ID" integer NOT NULL,
    "小口配送区分" boolean NOT NULL,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean NOT NULL,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean NOT NULL,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean NOT NULL,
    "eLixxi扱い便CD" character varying(255)
);

CREATE SEQUENCE web_fe."TM_運送会社マスタ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."TM_運送会社マスタ_ID_seq" OWNED BY web_fe."TM_運送会社マスタ"."ID";

CREATE TABLE web_fe."T_elixxi一時入庫データ" (
    "拠点名称" character varying(255),
    "依頼No" character varying(255),
    "入庫予定日" timestamp without time zone,
    "商品CD" double precision,
    "入庫No" character varying(255),
    "品名" character varying(255),
    "規格・ブランド" character varying(255),
    "入庫予定個数" double precision,
    "入庫予定端数" double precision,
    "入数" double precision,
    "定貫区分" character varying(255),
    "単量" double precision,
    "総重量" double precision,
    "重量単位" character varying(255),
    "入庫状態" character varying(255),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入荷元名称" character varying(255),
    "扱い便名称" character varying(255),
    "寄託者名称" character varying(255),
    "登録ユーザID" character varying(255),
    "登録日時" timestamp without time zone,
    "更新ユーザID" character varying(255),
    "更新日時" timestamp without time zone,
    "ID" integer NOT NULL,
    "受付No" integer,
    "受付行No" integer,
    "マーク" character varying(255),
    "入庫実績個数" integer,
    "入庫実績端数" integer
);

CREATE SEQUENCE web_fe."T_elixxi一時入庫データ_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."T_elixxi一時入庫データ_ID_seq" OWNED BY web_fe."T_elixxi一時入庫データ"."ID";

CREATE TABLE web_fe."T_ランテック詳細" (
    "ID" integer NOT NULL,
    "発送日" double precision,
    "お届希望日" double precision,
    "発送元CD" double precision,
    "発送元" character varying(255),
    "発送先住所" character varying(255),
    "お届け先CD" double precision,
    "お届け先" character varying(255),
    "お届け先住所" character varying(255),
    "送り状No" double precision,
    "ケース(トータル)" double precision,
    "貨物保険" character varying(255),
    "商品金額計" double precision,
    "送り状印刷" character varying(255),
    "荷札印刷" character varying(255),
    "予定料金" double precision,
    "状況" character varying(255),
    "持込支店" character varying(255),
    "止め支店" character varying(255),
    "明細No" double precision,
    "商品CD" double precision,
    "商品名" character varying(255),
    "規格" character varying(255),
    "温度" character varying(255),
    "サイズ" character varying(255),
    "ケース" double precision,
    "出庫日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "アンマッチchk" boolean NOT NULL,
    "通知" character varying(255)
);

CREATE SEQUENCE web_fe."T_ランテック詳細_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."T_ランテック詳細_ID_seq" OWNED BY web_fe."T_ランテック詳細"."ID";

CREATE TABLE web_fe."テーブル1" (
    "ID" integer NOT NULL,
    "受付No" integer,
    "受付行No" integer,
    "依頼No" character varying(255),
    "入庫予定日" timestamp without time zone,
    "商品CD" integer,
    "入庫No" character varying(255),
    "品名" character varying(255),
    "規格・ブランド" character varying(255),
    "マーク" character varying(255),
    "入庫予定個数" integer,
    "入庫予定端数" integer,
    "入数" integer,
    "定貫区分" character varying(255),
    "単量" integer,
    "総重量" integer,
    "重量単位" character varying(255),
    "入庫状態" character varying(255),
    "入庫実績個数" character varying(255),
    "入庫実績端数" character varying(255),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入荷元名称" character varying(255),
    "扱い便名称" character varying(255),
    "寄託者名称" character varying(255),
    "登録ユーザID" character varying(255),
    "登録日時" timestamp without time zone,
    "更新ユーザID" character varying(255),
    "更新日時" timestamp without time zone
);

CREATE SEQUENCE web_fe."テーブル1_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."テーブル1_ID_seq" OWNED BY web_fe."テーブル1"."ID";

CREATE TABLE web_fe."テーブル2" (
    "ID" integer NOT NULL,
    "拠点名称" character varying(255),
    "受付No" integer,
    "受付行No" integer,
    "依頼No" character varying(255),
    "入庫予定日" timestamp without time zone,
    "商品CD" integer,
    "入庫No" character varying(255),
    "品名" character varying(255),
    "規格・ブランド" character varying(255),
    "マーク" character varying(255),
    "入庫予定個数" integer,
    "入庫予定端数" integer,
    "入数" integer,
    "定貫区分" character varying(255),
    "単量" integer,
    "総重量" integer,
    "重量単位" character varying(255),
    "入庫状態" character varying(255),
    "入庫実績個数" integer,
    "入庫実績端数" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入荷元名称" character varying(255),
    "扱い便名称" character varying(255),
    "寄託者名称" character varying(255),
    "登録ユーザID" character varying(255),
    "登録日時" timestamp without time zone,
    "更新ユーザID" character varying(255),
    "更新日時" timestamp without time zone
);

CREATE SEQUENCE web_fe."テーブル2_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE web_fe."テーブル2_ID_seq" OWNED BY web_fe."テーブル2"."ID";

CREATE TABLE ws."TD_出荷" (
    "出庫ID" integer,
    "輸送ID" integer,
    "入庫ID" integer,
    "出荷日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(255),
    "社内連絡" character varying(150),
    "サンプル区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean,
    "賞味期限通知" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" character varying(255),
    "個別運賃" numeric(19,4),
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "買取単価コード" integer,
    "買取chk" boolean,
    "買取金額" double precision,
    "パレット枚数" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "ユーザー伝票No" character varying(50),
    "受注確認" boolean,
    "出荷元数" integer,
    "破損個数" integer,
    "入力時間" timestamp without time zone,
    "受注グループ" integer,
    "輸送履歴読込chk" boolean,
    "ユーザーchk" boolean,
    "帳票グループ化" integer,
    "受注表題" character varying(255),
    "積込確認" boolean,
    "送り状No" character varying(50),
    "積載時間" character varying(50),
    "破損出庫ID" integer,
    "商品区分" integer,
    "出荷元kg" double precision,
    "訂正kg" double precision,
    "入庫備考" boolean,
    "タグ" character varying(50),
    "受注ID" integer,
    "タグ2" character varying(50),
    "商品輸送区分" integer,
    "商品輸送区分名" character varying(255),
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行関連No" character varying(255),
    "本社受注" boolean,
    "運賃請求ID" integer,
    "伝票No確認用" character varying(50),
    "商品状態隠語" character varying(50),
    "届け先区分" integer,
    "運賃扱い区分" integer,
    "インポート場所ID" integer,
    "パレット使用枚数" integer,
    "倉庫受注ID" integer,
    "特別検査区分" boolean,
    "他工場ロットNo" character varying(255),
    "他工場伝票No" character varying(255),
    "産地コード" integer,
    "インポート場所出庫ID" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "年間受注ID" character varying(255),
    "Newクロップ区分" boolean,
    "取扱い区分" boolean,
    "参照受注番号" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "蔵前区分" boolean,
    "パレット区分" integer,
    "混載区分" integer,
    "混載No" integer,
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "売上科目コード" integer,
    "売上科目" character varying(255)
);

CREATE TABLE ws."TD_受注" (
    "受注受付ID" integer,
    "受注ID" integer,
    "受注番号" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "受注日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "残ケース" integer,
    "商品kg" double precision,
    "残kg" double precision,
    "納品日" timestamp without time zone,
    "受注先ID" integer,
    "受注先名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "正式届け先名" character varying(255),
    "単価" double precision,
    "請求金額" integer,
    "備考" character varying(255),
    "社内連絡" character varying(255),
    chk boolean,
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" smallint,
    "枝番1" character varying(50),
    "枝番2" character varying(50),
    "枝番3" character varying(50),
    "登録時間" character varying(255),
    "更新時間" character varying(255),
    "受注番号1" character varying(255),
    "商品コード1" integer,
    "ケース1" integer,
    "商品kg1" double precision,
    "届け先コード1" integer,
    "納品日1" timestamp without time zone,
    "相手届け先コード" integer,
    "入力日" timestamp without time zone,
    "入庫名義ID" integer,
    "出荷予定日" timestamp without time zone,
    "送り状No" character varying(255),
    "手配DataChk" boolean,
    "入力確認チェック" boolean,
    "受注手配確認" boolean,
    "受注出庫確認" boolean,
    "出庫返信FAX確認" boolean,
    "受注グループID" integer,
    "輸送手配返信確認" boolean,
    "受領書確認" boolean,
    "受注返信FAX" boolean,
    "受注帳合ID" integer,
    "受注帳合名" character varying(255),
    "取引元ID" integer,
    "取引元" character varying(255),
    "取引帳合ID" character varying(255),
    "取引帳合" character varying(255),
    "受注区分" integer,
    "賞味期限送信" boolean,
    "本社受注" boolean,
    "消費税" integer,
    "税込請求金額" integer,
    "送品案内" boolean,
    "出力用chk" boolean,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "伝票作成" boolean,
    "伝票送付" boolean,
    "本社受注ID" integer,
    "初回登録chk" boolean,
    "受注ユーザーID" integer,
    "受注ユーザー名" character varying(255),
    "伝票FAX" boolean,
    "完了消込" boolean,
    "丸北出荷数" integer,
    "倉庫出荷数" integer,
    "転売出荷数" integer,
    "統一受注ID" character varying(255),
    "年間受注ID" integer,
    "月間カウンタ" integer,
    "月間No" integer,
    "隠語" character varying(255),
    "運賃振分区分" integer,
    "運賃請求ID" integer,
    "変更前ケース" integer,
    "変更前商品kg" double precision,
    "少量残連絡chk" boolean,
    "少量残連絡備考" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "蔵前区分" boolean,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "販盛売上行" character varying(255),
    "販盛売上番号" character varying(255),
    "販盛伝票番号" character varying(255),
    "手配出庫番号" character varying(255),
    "手配輸送番号" character varying(255)
);

CREATE TABLE ws."TD_在庫" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "グループコード" integer,
    "商品区分" integer,
    "変更前在庫ID" integer,
    "入庫区分" boolean,
    "最終出庫日" timestamp without time zone,
    "ストック数" integer,
    "訂正chk" boolean,
    "買取金額" double precision,
    "買取単価コード" integer,
    "買取chk" boolean,
    "支払区分" integer,
    "検査結果" integer,
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "パレットコード" integer,
    "パレット使用枚数" integer,
    "登録時間" timestamp without time zone,
    "産地コード" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "商品状態隠語" character varying(50),
    "大阪発注確認chk" boolean,
    "検査予定日" timestamp without time zone,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean,
    "パレット積載数" integer,
    "合否判定ID" integer,
    "合否判定" character varying(255),
    "PCName保存" character varying(255)
);

CREATE TABLE ws."TD_在庫商品数パレット" (
    "在庫ID" integer,
    "パレット単位" integer,
    "パレット数" integer,
    "01A" integer,
    "02A" integer,
    "03A" integer,
    "04A" integer,
    "05A" integer,
    "06A" integer,
    "07A" integer,
    "08A" integer,
    "09A" integer,
    "10A" integer,
    "11A" integer,
    "12A" integer,
    "13A" integer,
    "14A" integer,
    "15A" integer,
    "16A" integer,
    "17A" integer,
    "18A" integer,
    "19A" integer,
    "20A" integer,
    "21A" integer,
    "22A" integer,
    "23A" integer,
    "24A" integer,
    "25A" integer,
    "入力時間" character varying(255)
);

CREATE TABLE ws."TD_在庫変更" (
    "変更No" integer,
    "在庫No" integer,
    "Set_ID" integer,
    "変更日" timestamp without time zone,
    "保管庫ID" integer,
    "保管庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "移動先ID" integer,
    "移動先名" character varying(50),
    "備考" character varying(255),
    "変更前名義ID" integer,
    "変更後名義ID" integer,
    "変更区分" integer,
    "変更Check" boolean,
    "入庫No" character varying(50),
    "変更前在庫数" integer,
    "出荷期数" integer,
    "保管料" double precision,
    "入出庫料" double precision,
    "出荷伝票No" integer,
    "抽出区分" boolean,
    "支払区分" integer,
    "買取単価コード" integer,
    "買取金額" integer,
    "買取chk" boolean
);

CREATE TABLE ws."TD_積込順" (
    "ID" integer,
    "輸送ID" integer,
    "積込順" smallint,
    "積込順届け先" integer,
    "積込順出荷元" integer,
    "積込備考" character varying(255),
    "積込指定No" integer,
    "積込指定外No" integer,
    "届け順" integer,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean
);

CREATE TABLE ws."TD_輸送計画" (
    "伝票日付No" integer,
    "輸送ID" integer,
    "出荷計画日" timestamp without time zone,
    "着地コード" integer,
    "着地エリア" character varying(50),
    "運送会社ID" smallint,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "乗務員" character varying(50),
    "携帯番号" character varying(50),
    "集荷日" timestamp without time zone,
    "担当者" character varying(50),
    "冷凍区分ID" integer,
    "冷凍区分名" character varying(20),
    "運賃区分ID" integer,
    "輸送区分ID" integer,
    "輸送区分" character varying(20),
    "車両区分ID" integer,
    "車両区分" character varying(20),
    "配達区分ID" integer,
    "配達区分" character varying(20),
    "セット温度" integer,
    "セット温度2" integer,
    "セット温度3" integer,
    "受領印チェック" boolean,
    "支払運賃" numeric(19,4),
    "もらい運賃" numeric(19,4),
    "重量エラーchk" boolean,
    "最大積載重量kg" integer,
    "総重量" integer,
    "最終納品日" timestamp without time zone,
    "船名" character varying(50),
    "航路" character varying(50),
    "発港" character varying(50),
    "着港" character varying(50),
    "乗船日" timestamp without time zone,
    "下船日" timestamp without time zone,
    "締切時間" timestamp without time zone,
    "乗船時間" timestamp without time zone,
    "下船時間" timestamp without time zone,
    "仲介運送会社コード" integer,
    "仲介運送会社" character varying(50),
    "仲介車番" character varying(50),
    "仲介乗務員" character varying(50),
    "仲介携帯番号" character varying(50),
    "集荷時間" timestamp without time zone,
    "引取日" timestamp without time zone,
    "引取時間" timestamp without time zone,
    "シャーシ車番" character varying(50),
    "集荷時備考" character varying(255),
    "引取備考" character varying(255),
    chk boolean,
    "運賃読込" boolean,
    "帳合運送会社コード" integer,
    "帳合運送会社名" character varying(50),
    "手配運送会社コード" integer,
    "手配運送会社名" character varying(50),
    "更新時間" character varying(50),
    "伝票番号" character varying(50),
    "抽出区分" boolean,
    "運賃chk" boolean,
    "車号" character varying(255),
    "車型" character varying(50),
    "積込開始時間" timestamp without time zone,
    "積込終了時間" timestamp without time zone,
    "丸北開始時間" timestamp without time zone,
    "丸北終了時間" timestamp without time zone,
    "運行指令No" text,
    "着地地区コード" integer,
    "印刷カウント" character varying(255),
    "納品日コメント" character varying(255),
    "到着時間" timestamp without time zone,
    "積込作業開始時間" timestamp without time zone,
    "積込作業終了時間" timestamp without time zone,
    "丸北指定時間" timestamp without time zone,
    "パレット輸送区分" integer,
    "パレット積載数" integer,
    "総数量" integer,
    "PCName保存" character varying(255),
    "OneDriveChk" boolean,
    "運行日数" integer,
    "運賃計算区分" integer
);

CREATE TABLE ws."TMS_本社依頼受注_製造" (
    "個別受注ID" integer,
    "大阪受注ID" integer,
    "統一受注ID" character varying(255),
    "年月" character varying(255),
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "年間受注区分" boolean,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫後名義ID" integer,
    "取引元ID" integer,
    "取引帳合ID" integer,
    "グループ商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "規格" character varying(255),
    "入数" integer,
    "届け先コード" integer,
    "届け先" character varying(255),
    "製造分割数" integer,
    "製造分割kg" integer,
    "前月繰越数" integer,
    "前月繰越kg" integer,
    "出荷ケース" integer,
    "出荷kg" integer,
    "残ケース" integer,
    "残kg" integer,
    "商品kg" integer,
    "備考" character varying(255),
    "摘要" character varying(255),
    "作成日" timestamp without time zone,
    "受注作成済みchk" boolean,
    "本社識別受注ID" character varying(255),
    "ふらの商品" boolean,
    "本社商品コード" integer,
    "仕入先商品コード" integer,
    "終了chk" boolean,
    "受注元ID" integer,
    "受注元" character varying(255),
    "確認chk" boolean,
    chk boolean,
    "丸北出荷済みケース" integer,
    "丸北出荷済みkg" integer,
    "倉庫出荷済みケース" integer,
    "倉庫出荷済みkg" integer,
    "丸北出荷見込ケース" integer,
    "丸北出荷見込kg" integer,
    "倉庫出荷見込ケース" integer,
    "倉庫出荷見込kg" integer,
    "出荷済みケース" integer,
    "出荷済みkg" integer,
    "出荷見込ケース" integer,
    "出荷見込kg" integer,
    "丸北出荷ケース" integer,
    "丸北出荷kg" integer,
    "倉庫出荷ケース" integer,
    "倉庫出荷kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "現在庫数" integer,
    "予定在庫数" integer,
    "一回発注数" integer,
    "月間発注回数" integer,
    "発注曜日" character varying(255),
    "年間在庫率" double precision,
    "現在在庫率" double precision,
    "予定在庫率" double precision,
    "作成日時" character varying(255),
    "調整ケース" integer,
    "在庫出荷予定数" integer,
    "納品日" timestamp without time zone,
    "月平均出荷数" double precision,
    "受注元数" integer,
    "合算予定数" integer,
    "受注出荷済み数" integer,
    "受注出荷見込み数" integer,
    "受注残数" integer,
    "個別受注合算数" integer,
    "前月繰越出荷済み数" integer,
    "前月繰越出荷見込み数" integer,
    "前月繰越残数" integer,
    "受注元KG" integer,
    "年間前月繰越数" integer,
    "年間調整数" integer,
    "次月出荷予定数" integer
);

CREATE TABLE ws."TM_備考欄" (
    "ID" integer,
    "分類" character varying(50),
    "作業分類" character varying(50),
    "備考欄" character varying(255),
    "リンクID" integer,
    "得意先名" character varying(50),
    "使用頻度" integer,
    "登録日" character varying(50)
);

CREATE TABLE ws."TM_商品在庫ストックマスタ" (
    "区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "ストック数" character varying(255),
    "備考" character varying(255),
    "倉庫ID除外コード" integer,
    "更新時間" character varying(255),
    "通知区分" boolean
);

CREATE TABLE ws_fe."M_Webアドレス操作" (
    "ID" integer,
    "実行名" character varying(255),
    "実行グループ名" character varying(255),
    "指定サイト" text,
    "検索ワード" character varying(255),
    "備考" character varying(255),
    "動作1" character varying(255),
    "動作2" character varying(255),
    "動作3" character varying(255),
    "動作4" character varying(255),
    "動作5" character varying(255),
    "動作6" character varying(255),
    "動作7" character varying(255),
    "動作8" character varying(255),
    "動作9" character varying(255),
    "動作10" character varying(255)
);

CREATE TABLE ws_fe."TDS_出荷インポート_売上用" (
    "ID" integer,
    "出荷日" timestamp without time zone,
    "地区コード" integer,
    "都道府県" character varying(50),
    "依頼主コード" integer,
    "依頼主" character varying(50),
    "本社商品コード" character varying(255),
    "商品コード" integer,
    "商品名" character varying(50),
    "ケース" integer,
    "商品kg" integer,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "抽出区分" boolean,
    "ユーザー伝票No" character varying(50),
    "売上日" timestamp without time zone,
    "発注No" character varying(50),
    "受注ID" integer,
    "単価" double precision,
    "請求金額" double precision,
    "取引元ID" integer,
    "取引元" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(255),
    "請求先コード" integer,
    "請求先名" character varying(255),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "受注グループID" integer,
    "自社販売コード" integer,
    "自社販売名" character varying(255),
    "区分" character varying(255),
    "積込確認" boolean,
    "ユーザー区分" integer,
    "ユーザー区分名" character varying(255),
    "大阪名義備考" character varying(255),
    "区分順番" integer,
    "Newクロップ区分" boolean,
    "入庫名義" character varying(255),
    "蔵前区分" boolean
);

CREATE TABLE ws_fe."TDS_出荷案内書作成" (
    "輸送ID" integer,
    "商品コード" integer,
    "本社コード" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "備考" character varying(255),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "入庫後名義" character varying(50),
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "出荷日" timestamp without time zone,
    "サービス区分" boolean,
    "商品積込順" integer,
    "リンクコード1" character varying(50),
    "抽出区分" boolean,
    "パレット単位" character varying(50),
    "印刷区分" integer,
    "備考2" character varying(50),
    "ユーザー伝票No" character varying(255),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "タグ" character varying(50),
    "在庫ID" integer,
    "検査区分" character varying(255),
    "商品区分" integer,
    "運賃振分区分" integer,
    "寿検査待ちフラグ" boolean,
    "タグ2" character varying(50)
);

CREATE TABLE ws_fe."TDS_積込確認書" (
    "輸送ID" integer,
    "商品コード" integer,
    "本社コード" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫元数" integer,
    "在庫ケース" integer,
    "出庫ケース" integer,
    "認識ID" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(50),
    "備考" character varying(255),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "入庫後名義" character varying(50),
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "出荷日" timestamp without time zone,
    "サービス区分" boolean,
    "商品積込順" integer,
    "リンクコード1" character varying(50),
    "抽出区分" boolean,
    "パレット単位" character varying(50),
    "印刷区分" integer,
    "備考2" character varying(50),
    "ユーザー伝票No" character varying(255),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "タグ" character varying(50),
    "在庫ID" integer,
    "検査区分" character varying(255),
    "商品区分" integer,
    "運賃振分区分" integer,
    "寿検査待ちフラグ" boolean,
    "丸北開始時間" timestamp without time zone,
    "丸北終了時間" timestamp without time zone,
    "在庫残数" integer,
    "検体有無" boolean,
    "入庫ID" integer,
    "検体出荷ケース" integer,
    "検体抜き出荷ケース" integer
);

CREATE TABLE ws_fe."TD_Newクロップ初回チェック" (
    "ID" integer,
    "生産年度" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "新規出荷日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "取引元ID" integer,
    "取引元" character varying(255)
);

CREATE TABLE ws_fe."TD_USER" (
    "ID" integer,
    "使用者コード" integer,
    "使用者名" character varying(50),
    "パスワード" integer,
    "更新区分" boolean,
    "制御区分" boolean,
    "出荷更新" boolean,
    "前回更新日" timestamp without time zone,
    "出荷変更通知" character varying(255),
    "更新時間" character varying(50),
    "確認時間" timestamp without time zone,
    "更新中フラグ" boolean,
    "日時更新日" timestamp without time zone,
    "終日更新" timestamp without time zone,
    "倉庫読込" boolean,
    "ホストアドレス" character varying(255),
    "出力先アドレス" character varying(255),
    "出力フラグ" integer,
    "倉庫ファイルアドレス" character varying(50),
    "倉庫ファイル名" character varying(50),
    "出荷登録中chk" boolean,
    "倉庫出力日" timestamp without time zone,
    "前回出来高インポート日" timestamp without time zone,
    "寿カウンタ" integer
);

CREATE TABLE ws_fe."TD_しらい用運賃表" (
    "送り状No" character varying(50),
    "出荷日" timestamp without time zone,
    "輸送ID" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "納品日" timestamp without time zone,
    "個数" integer,
    "総重量" double precision,
    "運賃" numeric(19,4)
);

CREATE TABLE ws_fe."TD_ふらの報告書" (
    "在庫ID" integer,
    "出荷日" timestamp without time zone,
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "ケース" character varying(50),
    "商品kg" double precision,
    "納品日" timestamp without time zone,
    "入庫名義" character varying(50),
    "備考" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "区分" integer,
    "区分表題" character varying(50),
    "区分備考" character varying(50)
);

CREATE TABLE ws_fe."TD_クローン" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "グループコード" integer,
    "商品区分" integer,
    "変更前在庫ID" integer,
    "入庫区分" boolean,
    "最終出庫日" timestamp without time zone,
    "ストック数" integer,
    "訂正chk" boolean,
    "買取金額" double precision,
    "買取単価コード" integer,
    "買取chk" boolean,
    "支払区分" integer,
    "検査結果" integer,
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "パレットコード" integer,
    "パレット使用枚数" integer,
    "登録時間" timestamp without time zone,
    "産地コード" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "商品状態隠語" character varying(50),
    "大阪発注確認chk" boolean,
    "検査予定日" timestamp without time zone,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean
);

CREATE TABLE ws_fe."TD_ドラムNo" (
    "ID" integer,
    "輸送ID" integer,
    txt_1 character varying(255),
    txt_2 character varying(255),
    txt_3 character varying(255),
    txt_4 character varying(255),
    txt_5 character varying(255),
    txt_6 character varying(255),
    txt_7 character varying(255),
    txt_8 character varying(255),
    txt_9 character varying(255),
    txt_10 character varying(255),
    txt_11 character varying(255),
    txt_12 character varying(255),
    txt_13 character varying(255),
    txt_14 character varying(255),
    txt_15 character varying(255),
    txt_16 character varying(255),
    txt_17 character varying(255),
    txt_18 character varying(255),
    txt_19 character varying(255),
    txt_20 character varying(255),
    txt_21 character varying(255),
    txt_22 character varying(255),
    txt_23 character varying(255),
    txt_24 character varying(255),
    txt_25 character varying(255),
    txt_26 character varying(255),
    txt_27 character varying(255),
    txt_28 character varying(255),
    txt_29 character varying(255),
    txt_30 character varying(255),
    txt_31 character varying(255),
    txt_32 character varying(255),
    txt_33 character varying(255),
    txt_34 character varying(255),
    txt_35 character varying(255),
    txt_36 character varying(255),
    txt_37 character varying(255),
    txt_38 character varying(255),
    txt_39 character varying(255),
    txt_40 character varying(255),
    txt_41 character varying(255),
    txt_42 character varying(255),
    txt_43 character varying(255),
    txt_44 character varying(255),
    txt_45 character varying(255),
    txt_46 character varying(255),
    txt_47 character varying(255),
    txt_48 character varying(255),
    txt_49 character varying(255),
    txt_50 character varying(255),
    txt_51 character varying(255),
    txt_52 character varying(255),
    txt_53 character varying(255),
    txt_54 character varying(255),
    txt_55 character varying(255),
    txt_56 character varying(255),
    txt_57 character varying(255),
    txt_58 character varying(255),
    txt_59 character varying(255),
    txt_60 character varying(255),
    txt_61 character varying(255),
    txt_62 character varying(255),
    txt_63 character varying(255),
    txt_64 character varying(255),
    txt_65 character varying(255),
    txt_66 character varying(255),
    txt_67 character varying(255),
    txt_68 character varying(255),
    txt_69 character varying(255),
    txt_70 character varying(255),
    txt_71 character varying(255),
    txt_72 character varying(255),
    txt_73 character varying(255),
    txt_74 character varying(255),
    txt_75 character varying(255),
    txt_76 character varying(255),
    txt_77 character varying(255),
    txt_78 character varying(255),
    txt_79 character varying(255),
    txt_80 character varying(255),
    txt_81 character varying(255),
    txt_82 character varying(255),
    txt_83 character varying(255),
    txt_84 character varying(255),
    txt_85 character varying(255),
    txt_86 character varying(255),
    txt_87 character varying(255),
    txt_88 character varying(255),
    txt_89 character varying(255),
    txt_90 character varying(255),
    "入庫連絡備考欄" character varying(255)
);

CREATE TABLE ws_fe."TD_パレット入出庫" (
    "ID" integer,
    "パレットID" integer,
    "パレット名" character varying(255),
    "枚数" integer
);

CREATE TABLE ws_fe."TD_倉庫" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "作成日付" timestamp without time zone,
    "名変前在庫ID" integer,
    "在庫ID" integer,
    "タグ" character varying(50),
    "グループ商品コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255)
);

CREATE TABLE ws_fe."TD_倉庫詳細設定" (
    "ID" integer,
    "短縮コード" integer,
    "倉庫名" character varying(50),
    "入出庫料" double precision,
    "保管料" double precision,
    "商品コード" integer,
    "商品名" character varying(50),
    "名義コード" integer,
    "名義名" character varying(50),
    "名義変更料" integer
);

CREATE TABLE ws_fe."TD_出荷停止チェック" (
    "ID" integer,
    "在庫ID" integer,
    "確認日" timestamp without time zone,
    "備考" character varying(255),
    chk boolean
);

CREATE TABLE ws_fe."TD_単位" (
    "ID" integer,
    "単位コード" integer,
    "単位" character varying(50)
);

CREATE TABLE ws_fe."TD_印刷chk" (
    "ID" integer,
    "出庫ID" integer,
    "印刷区分" integer,
    "印刷回数" integer,
    "送信回数" integer,
    "FAX送信完了chk" boolean
);

CREATE TABLE ws_fe."TD_商品分類" (
    "ID" integer,
    "分類ID" integer,
    "分類名" character varying(50)
);

CREATE TABLE ws_fe."TD_在庫BackUp" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "グループコード" integer,
    "商品区分" integer,
    "変更前在庫ID" integer,
    "入庫区分" boolean,
    "最終出庫日" timestamp without time zone,
    "ストック数" integer,
    "訂正chk" boolean,
    "買取金額" double precision,
    "買取単価コード" integer,
    "買取chk" boolean,
    "支払区分" integer,
    "検査結果" integer,
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "パレットコード" integer,
    "パレット使用枚数" integer,
    "登録時間" timestamp without time zone,
    "産地コード" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "商品状態隠語" character varying(50),
    "大阪発注確認chk" boolean,
    "検査予定日" timestamp without time zone,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean,
    "パレット積載数" integer,
    "合否判定ID" integer,
    "合否判定" character varying(255),
    "PCName保存" character varying(255)
);

CREATE TABLE ws_fe."TD_在庫_確認" (
    "在庫ID" integer,
    "作成日付" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫後名義ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "分類ID" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫日" timestamp without time zone,
    "期" integer,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "備考在庫" character varying(255),
    "入庫No" character varying(50),
    "包装日" timestamp without time zone,
    "仮入庫No" character varying(50),
    "出庫回数" integer,
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "グループコード" integer,
    "商品区分" integer,
    "変更前在庫ID" integer,
    "入庫区分" boolean,
    "最終出庫日" timestamp without time zone,
    "ストック数" integer,
    "訂正chk" boolean,
    "買取金額" double precision,
    "買取単価コード" integer,
    "買取chk" boolean,
    "支払区分" integer,
    "検査結果" integer,
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "パレットコード" integer,
    "パレット使用枚数" integer,
    "登録時間" timestamp without time zone,
    "産地コード" integer,
    "商品状態隠語" character varying(50),
    "大阪発注確認chk" boolean,
    "検査予定日" timestamp without time zone,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    chk boolean
);

CREATE TABLE ws_fe."TD_在庫パレット" (
    "在庫ID" integer,
    "製造日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "パレットコード" integer,
    "パレット名" character varying(50),
    "番号" integer,
    "ケース" integer,
    "出荷数" integer
);

CREATE TABLE ws_fe."TD_在庫変更old" (
    "変更No" integer NOT NULL,
    "在庫No" integer,
    "Set_ID" integer,
    "変更日" timestamp without time zone,
    "保管庫ID" integer,
    "保管庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "移動先ID" integer,
    "移動先名" character varying(50),
    "備考" character varying(255),
    "変更前名義ID" integer,
    "変更後名義ID" integer,
    "変更区分" integer,
    "変更Check" boolean NOT NULL,
    "入庫No" character varying(50),
    "変更前在庫数" integer,
    "出荷期数" integer,
    "保管料" double precision,
    "入出庫料" double precision,
    "出荷伝票No" integer,
    "抽出区分" boolean NOT NULL,
    "支払区分" integer,
    "買取単価コード" integer,
    "買取金額" integer,
    "買取chk" boolean NOT NULL
);

CREATE SEQUENCE ws_fe."TD_在庫変更old_変更No_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE ws_fe."TD_在庫変更old_変更No_seq" OWNED BY ws_fe."TD_在庫変更old"."変更No";

CREATE TABLE ws_fe."TD_当日在庫" (
    "ID" integer,
    "作成日付" timestamp without time zone,
    "包装日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "短縮コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" real,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" integer,
    "製造kg" integer,
    "出荷kg" integer,
    "在庫kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(255),
    "入庫後名義ID" integer,
    "入庫No" character varying(50),
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "補助入庫No" integer,
    "入出庫料" integer,
    "保管料" integer,
    "期" integer,
    "出庫回数" integer,
    "サービス区分" boolean,
    "名変料" integer,
    "認識ID" character varying(50),
    "未包装kg" integer,
    "倉庫区分" boolean,
    "賞味期限通知" character varying(20),
    "出庫ID" integer,
    "抽出区分" boolean,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "入庫ID" integer,
    "輸送ID" integer,
    "運送会社ID" integer,
    "車番" character varying(50),
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "入庫名義ID" integer,
    "届け先コード" integer,
    "届け先" character varying(50)
);

CREATE TABLE ws_fe."TD_架空在庫" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" text,
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "インポート場所ID" integer,
    "産地コード" integer,
    "産地通称" character varying(255),
    "商品状態隠語" character varying(50),
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean,
    "検査予定日" timestamp without time zone,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫_パレット集計" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "インポート場所ID" integer
);

CREATE TABLE ws_fe."TD_架空在庫_パレット集計_当日" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "インポート場所ID" integer
);

CREATE TABLE ws_fe."TD_架空在庫_パレット集計_画面用" (
    "架空ID" integer,
    "認識ID" character varying(50),
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "入庫No" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫元数" integer,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "出庫ケース" integer,
    "出荷kg" double precision,
    "製造ケース" integer,
    "製造kg" double precision,
    "繰越ケース" integer,
    "繰越kg" double precision,
    "原料kg" integer,
    "備考在庫" character varying(100),
    "運送会社ID" integer,
    "車番" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "入庫後名義ID" integer,
    "抽出区分" boolean,
    "検索コード" integer,
    "補助入庫No" integer,
    "未包装kg" integer,
    "輸送ID" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" integer,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "出庫ID" integer,
    "入庫ID" integer,
    "包装日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "原料コード" integer,
    "原料" character varying(50),
    "作成日付" timestamp without time zone,
    "最終出庫日" timestamp without time zone,
    "名変前在庫ID" integer,
    "期" integer,
    "タグ" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "商品区分" integer,
    "商品状態隠語" character varying(50),
    "グループ商品コード" integer,
    "新箱表示" character varying(255),
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "パレット積載数" integer,
    "空き予定パレット数" integer,
    "パレット積載元数" integer,
    "インポート場所ID" integer
);

CREATE TABLE ws_fe."TD_架空在庫_受注割付" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "インポート場所ID" integer,
    "産地コード" integer,
    "産地通称" character varying(255),
    "商品状態隠語" character varying(50),
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検査予定日" timestamp without time zone,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫_大阪発注割振り" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "在庫ID" integer,
    "範囲出庫ケース" integer,
    "範囲出庫kg" double precision,
    "範囲入庫ケース" integer,
    "範囲入庫kg" double precision,
    "商品状態隠語" character varying(50),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫_大阪発注割振りG" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "在庫ID" integer,
    "範囲出庫ケース" integer,
    "範囲出庫kg" double precision,
    "範囲入庫ケース" integer,
    "範囲入庫kg" double precision,
    "商品状態隠語" character varying(50),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫_新" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "在庫ID" integer,
    "範囲出庫ケース" integer,
    "範囲出庫kg" double precision,
    "範囲入庫ケース" integer,
    "範囲入庫kg" double precision,
    "インポート場所ID" integer,
    "商品状態隠語" character varying(50),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検査予定日" timestamp without time zone,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫_新G" (
    "作成日付" timestamp without time zone,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "架空ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" double precision,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "ストック数" character varying(50),
    "パレット数" real,
    "名変前在庫ID" integer,
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "受注グループ" integer,
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "在庫ID" integer,
    "範囲出庫ケース" integer,
    "範囲出庫kg" double precision,
    "範囲入庫ケース" integer,
    "範囲入庫kg" double precision,
    "インポート場所ID" integer,
    "商品状態隠語" character varying(50),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫ver2" (
    "作成日付" timestamp without time zone,
    "架空ID" integer,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" integer,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "仮想ID" text,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "インポート場所ID" integer,
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean,
    "検査予定日" timestamp without time zone,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE ws_fe."TD_架空在庫ver3" (
    "作成日付" timestamp without time zone,
    "架空ID" integer,
    "認識ID" character varying(50),
    "輸送ID" integer,
    "運送会社ID" integer,
    "入庫ID" integer,
    "出庫ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "備考在庫" character varying(100),
    "車番" character varying(50),
    "抽出区分" boolean,
    "検索コード" integer,
    "入庫No" character varying(50),
    "補助入庫No" integer,
    "未包装kg" integer,
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "架空実物" boolean,
    "通知" character varying(20),
    "賞味期限通知" character varying(20),
    "実算ケース" integer,
    "実算kg" double precision,
    "出荷止め区分" boolean,
    "管理備考" character varying(50),
    "商品区分" integer,
    "商品区分名" character varying(50),
    "検査区分" character varying(255),
    "タグ" character varying(50),
    "カードカラーコード" integer,
    "仮想ID" text,
    "タグ2" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "グループ商品コード" integer,
    "当日出荷ケース" integer,
    "当日出荷kg" double precision,
    "産地コード" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "検体区分" boolean,
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "検体取得" boolean,
    "検査予定日" timestamp without time zone,
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE TABLE ws_fe."TD_積荷商品" (
    "ID" integer,
    "輸送ID" integer,
    "届け順" integer,
    "積順" integer,
    "商品順" integer,
    "番号" smallint,
    "商品名" character varying(50),
    "ロット" timestamp without time zone,
    "ケース" integer,
    "集荷先ID" integer,
    "集荷先名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "タグ" character varying(255)
);

CREATE TABLE ws_fe."TD_積荷情報" (
    "ID" integer,
    "輸送ID" integer,
    "届け先コード" integer,
    "届け先" character varying(50),
    "届け先数量" integer,
    "積順" integer,
    "何番積み" character varying(50),
    "納品日" character varying(50),
    "売り日" character varying(50),
    "届け順" integer,
    "何番届け" character varying(50),
    "入力時間" timestamp without time zone,
    "売り日案内" character varying(50),
    "納品日案内" character varying(50)
);

CREATE TABLE ws_fe."TD_積込パレット" (
    "出庫ID" integer,
    "パレット単位" integer,
    "パレット数" integer,
    "01A" integer,
    "02A" integer,
    "03A" integer,
    "04A" integer,
    "05A" integer,
    "06A" integer,
    "07A" integer,
    "08A" integer,
    "09A" integer,
    "10A" integer,
    "11A" integer,
    "12A" integer,
    "13A" integer,
    "14A" integer,
    "15A" integer,
    "16A" integer,
    "17A" integer,
    "18A" integer,
    "19A" integer,
    "20A" integer,
    "21A" integer,
    "22A" integer,
    "23A" integer,
    "24A" integer,
    "25A" integer
);

CREATE TABLE ws_fe."TD_訂正履歴" (
    "ID" integer,
    "出庫ID" integer,
    "訂正日" timestamp without time zone,
    "出荷日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "元数" integer,
    "ケース" integer,
    "訂正前ケース" integer,
    "訂正前kg" double precision,
    "訂正後ケース" integer,
    "訂正後kg" double precision,
    "商品kg" double precision,
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "備考" character varying(255),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "在庫ID" integer,
    "訂正区分ID" integer,
    "訂正区分" character varying(50),
    "送り状No" character varying(50),
    "ユーザー伝票No" character varying(50),
    "訂正回数" integer,
    "訂正日時" character varying(50)
);

CREATE TABLE ws_fe."TD_訂正履歴管理" (
    "訂正ID" integer,
    "訂正科目ID" integer,
    "訂正科目名" character varying(255),
    "訂正フォーム名" character varying(255),
    "訂正テーブル名" character varying(255),
    "訂正IndexField名" character varying(255),
    "訂正Index" character varying(255),
    "訂正フィールド" character varying(255),
    "訂正フィールド別名" character varying(255),
    "訂正前フィールド値" character varying(255),
    "訂正後フィールド値" character varying(255),
    "訂正時間" character varying(255),
    "訂正IndexFieldType" character varying(255),
    "訂正フィールドType" character varying(255),
    "特記事項" character varying(255)
);

CREATE TABLE ws_fe."TD_輸送抽出データ" (
    "ID" integer,
    "日付" character varying(50),
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "地区" character varying(50),
    "総重量kg" integer
);

CREATE TABLE ws_fe."TD_運送会社" (
    "ID" integer,
    "手配コード" integer,
    "運送会社名" character varying(50),
    "手配運送会社コード" integer,
    "手配運送会社名" character varying(50),
    "配送運送会社コード" integer,
    "配送運送会社名" character varying(50),
    "旧コード" integer
);

CREATE TABLE ws_fe."TD_集荷情報" (
    "ID" integer,
    "輸送ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先数量" integer,
    "積順" integer,
    "何番積み" character varying(50),
    "集荷日" timestamp without time zone,
    "入力時間" timestamp without time zone
);

CREATE TABLE ws_fe."TMS_受注_年間集計" (
    "個別受注ID" integer,
    "大阪受注ID" integer,
    "年間受注区分" boolean,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫後名義ID" integer,
    "取引元ID" integer,
    "取引帳合ID" integer,
    "グループ商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "規格" character varying(255),
    "入数" integer,
    "届け先コード" integer,
    "届け先" character varying(255),
    "製造分割数" integer,
    "製造分割kg" integer,
    "前月繰越数" integer,
    "前月繰越kg" integer,
    "出荷ケース" integer,
    "出荷kg" integer,
    "残ケース" integer,
    "残kg" integer,
    "商品kg" integer,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "備考" character varying(255),
    "摘要" character varying(255),
    "作成日" timestamp without time zone,
    "受注作成済みchk" boolean,
    "本社識別受注ID" character varying(255),
    "ふらの商品" boolean,
    "本社商品コード" integer,
    "仕入先商品コード" integer,
    "終了chk" boolean,
    "受注元ID" integer,
    "受注元" character varying(255),
    "確認chk" boolean,
    chk boolean,
    "丸北出荷済みケース" integer,
    "丸北出荷済みkg" integer,
    "倉庫出荷済みケース" integer,
    "倉庫出荷済みkg" integer,
    "丸北出荷見込ケース" integer,
    "丸北出荷見込kg" integer,
    "倉庫出荷見込ケース" integer,
    "倉庫出荷見込kg" integer,
    "出荷済みケース" integer,
    "出荷済みkg" integer,
    "出荷見込ケース" integer,
    "出荷見込kg" integer,
    "丸北出荷ケース" integer,
    "丸北出荷kg" integer,
    "倉庫出荷ケース" integer,
    "倉庫出荷kg" integer,
    "年月" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "現在庫数" integer,
    "予定在庫数" integer,
    "一回発注数" integer,
    "月間発注回数" integer,
    "発注曜日" character varying(255),
    "年間在庫率" double precision,
    "現在在庫率" double precision,
    "予定在庫率" double precision,
    "作成日時" character varying(255),
    "調整ケース" integer,
    "在庫出荷予定数" integer,
    "納品日" timestamp without time zone,
    "統一受注ID" character varying(255),
    "月平均出荷数" double precision,
    "受注元数" integer,
    "合算予定数" integer,
    "受注出荷済み数" integer,
    "受注出荷見込み数" integer,
    "受注残数" integer,
    "個別受注合算数" integer,
    "前月繰越出荷済み数" integer,
    "前月繰越出荷見込み数" integer,
    "前月繰越残数" integer,
    "受注元KG" integer,
    "年間前月繰越数" integer,
    "年間調整数" integer,
    "次月出荷予定数" integer
);

CREATE TABLE ws_fe."TMS_商品別年間集計日" (
    "ID" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "年度" character varying(255),
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TMS_本社依頼受注" (
    "個別受注ID" integer,
    "大阪受注ID" integer,
    "年間受注区分" boolean,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫後名義ID" integer,
    "取引元ID" integer,
    "取引帳合ID" integer,
    "グループ商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "規格" character varying(255),
    "入数" integer,
    "届け先コード" integer,
    "届け先" character varying(255),
    "元ケース" integer,
    "元数kg" integer,
    "出荷ケース" integer,
    "出荷kg" integer,
    "残ケース" integer,
    "残kg" integer,
    "商品kg" integer,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "備考" character varying(255),
    "摘要" character varying(255),
    "作成日" timestamp without time zone,
    "受注作成済みchk" boolean,
    "本社識別受注ID" character varying(255),
    "ふらの商品" boolean,
    "本社商品コード" integer,
    "仕入先商品コード" integer,
    "終了chk" boolean,
    "受注元ID" integer,
    "受注元" character varying(255),
    "確認chk" boolean,
    chk boolean,
    "丸北出荷済みケース" integer,
    "丸北出荷済みkg" integer,
    "倉庫出荷済みケース" integer,
    "倉庫出荷済みkg" integer,
    "丸北出荷見込ケース" integer,
    "丸北出荷見込kg" integer,
    "倉庫出荷見込ケース" integer,
    "倉庫出荷見込kg" integer,
    "出荷済みケース" integer,
    "出荷済みkg" integer,
    "出荷見込ケース" integer,
    "出荷見込kg" integer,
    "丸北出荷ケース" integer,
    "丸北出荷kg" integer,
    "倉庫出荷ケース" integer,
    "倉庫出荷kg" integer,
    "年月" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "現在庫数" integer,
    "予定在庫数" integer,
    "一回発注数" integer,
    "月間発注回数" integer,
    "発注曜日" character varying(255),
    "年間在庫率" double precision,
    "現在在庫率" double precision,
    "予定在庫率" double precision,
    "作成日時" character varying(255),
    "調整ケース" integer,
    "在庫出荷予定数" integer,
    "納品日" timestamp without time zone,
    "統一受注ID" character varying(255),
    "月平均出荷数" double precision,
    "受注元数" integer,
    "合算予定数" integer
);

CREATE TABLE ws_fe."TM_もらい運賃マスタ仮" (
    "ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "もらい運賃" integer,
    "No" integer
);

CREATE TABLE ws_fe."TM_イベントスケジュール" (
    "ID" integer,
    "件名" character varying(50),
    "開始日" character varying(50),
    "期間" integer,
    "分類項目" character varying(50),
    "改正祝日法" boolean,
    "特定月" integer,
    "特定週" integer,
    "特定曜日" character varying(50),
    "区分" boolean,
    "使用不可" boolean,
    "日付" timestamp without time zone,
    "特定年度" integer
);

CREATE TABLE ws_fe."TM_エリアコード" (
    "地区コード" integer,
    "地区名" character varying(50)
);

CREATE TABLE ws_fe."TM_グループマスタ" (
    "グループID" integer,
    "グループ名" character varying(50)
);

CREATE TABLE ws_fe."TM_サービス設定" (
    "ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "サービス範囲" integer,
    "備考" character varying(50)
);

CREATE TABLE ws_fe."TM_ダンボール寸法マスタ" (
    "資材ID" integer,
    "品番コード" character varying(255),
    "品番" character varying(255),
    "品名" character varying(255),
    "寸法（内寸）" character varying(255),
    "長さ" integer,
    "幅" integer,
    "高さ" integer,
    "備考" character varying(255),
    "更新日" timestamp without time zone
);

CREATE TABLE ws_fe."TM_テープマスタ" (
    "テープID" integer,
    "テープ上" character varying(50),
    "テープ下" character varying(50),
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TM_ハイ積みマスタ" (
    "ハイ積みID" integer,
    "パレットコード" integer,
    "パレット名" character varying(50),
    "総数" integer,
    "区分" character varying(50),
    "ハイ" integer,
    "パレット段数" integer,
    "備考" character varying(50),
    "ハイ積み備考" character varying(50),
    "SPID2" integer,
    "SPID3" integer,
    "SPID4" integer,
    "SPID5" integer,
    "SPID6" integer
);

CREATE TABLE ws_fe."TM_パレットマスタ" (
    "パレットコード" integer,
    "パレット名" character varying(50),
    "区分" character varying(50),
    "元数" integer,
    "繰越数" integer,
    "入庫数" integer,
    "使用数" integer,
    "在庫数" integer
);

CREATE TABLE ws_fe."TM_パレット調整区分" (
    "ID" integer NOT NULL,
    "パレット区分調整ID" integer,
    "パレット区分調整" character varying(255)
);

CREATE SEQUENCE ws_fe."TM_パレット調整区分_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE ws_fe."TM_パレット調整区分_ID_seq" OWNED BY ws_fe."TM_パレット調整区分"."ID";

CREATE TABLE ws_fe."TM_レポート作成" (
    "ID" integer,
    "表題" character varying(50),
    "宛名" character varying(50),
    "出荷日1" character varying(50),
    "出荷日2" character varying(50),
    "製造日1" character varying(50),
    "製造日2" character varying(50),
    "納品日1" character varying(50),
    "納品日2" character varying(50),
    "届け先コード" integer,
    "倉庫ID" integer,
    "取引元ID" integer,
    "運送会社ID" integer,
    "商品コード" integer,
    "入庫前名義" integer,
    "入庫後名義" integer,
    "商品分類" integer,
    "商品分類等号" character varying(50),
    "レポートタイプ" integer,
    "作成日時" timestamp without time zone,
    "ヘッダー" integer,
    "フッダー" integer,
    "並び順" character varying(50),
    "出荷グループ" integer,
    "届けグループ" integer,
    "No1" smallint,
    "No2" smallint,
    "No3" smallint,
    "No4" smallint,
    "No5" smallint,
    "No6" smallint,
    "No7" smallint,
    "No8" smallint,
    "No9" smallint,
    "No10" smallint,
    "No11" smallint,
    "抽出品名" character varying(50)
);

CREATE TABLE ws_fe."TM_仕入マスタ" (
    "ID" integer,
    "取引先コード" integer,
    "資材会社名" character varying(50),
    "会社名" character varying(255),
    "仕入コード" character varying(50),
    "品番" character varying(50),
    "資材コード" character varying(50),
    "識別条件" character varying(50),
    "本社コード" character varying(255),
    "商品名" character varying(255),
    "単位ID" integer,
    "単位" character varying(255),
    "単価" double precision,
    "商品コード" integer,
    "原料コード" integer,
    "分類ID" integer,
    "入庫分類" integer,
    "材質" character varying(50),
    "到着日数" character varying(50),
    "生産地コード" integer,
    "生産地" character varying(50)
);

CREATE TABLE ws_fe."TM_入庫先商品別名義条件" (
    "ID" integer,
    "受注元ID" integer,
    "受注元名" character varying(255),
    "取引先グループID" integer,
    "取引先グループ名" character varying(255),
    "取引先ID" integer,
    "取引先" character varying(255),
    "受注先ID" integer,
    "受注先" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ユーザー区分" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "商品分類ID" integer,
    "商品分類名" character varying(255),
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "運賃請求ID" integer,
    "運賃請求先" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "入庫名義ID" integer,
    "入庫名義名" character varying(255),
    "備考" character varying(255),
    "重複" boolean,
    "特定条件" boolean,
    "指定冷蔵庫" boolean,
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "もい運賃単位" integer,
    "もらい運賃" double precision,
    "もらい運賃個建" integer,
    "キロ立替運賃" integer,
    "新ダンボール初回案内" boolean,
    "新ダンボール備考" character varying(255),
    "取扱区分" boolean,
    "取扱名" character varying(255),
    "横持区分" boolean,
    "売上請求先ID" integer,
    "売上請求先名" character varying(255),
    "届け先件数" integer,
    "未完了chk" boolean,
    "登録日" timestamp without time zone,
    "更新日" timestamp without time zone,
    "最終出荷日" timestamp without time zone,
    "インポート場所ID" integer,
    "訂正区分" boolean
);

CREATE TABLE ws_fe."TM_冷凍区分" (
    "冷凍ID" integer,
    "冷凍区分" character varying(50),
    "区分名2" character varying(255),
    "コメント" character varying(255)
);

CREATE TABLE ws_fe."TM_出荷場所条件" (
    "ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "名義ID" integer
);

CREATE TABLE ws_fe."TM_前年在庫実績" (
    "作成日付" timestamp without time zone,
    "グループ商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "入庫後名義ID" integer,
    "規格" character varying(50),
    "入数" double precision,
    "繰越ケース" integer,
    "製造ケース" integer,
    "出庫ケース" integer,
    "在庫ケース" integer,
    "繰越kg" double precision,
    "製造kg" double precision,
    "出荷kg" double precision,
    "在庫kg" double precision,
    "原料kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "入庫元数" integer,
    "入庫日" timestamp without time zone,
    "範囲出庫ケース" integer,
    "範囲出庫kg" double precision,
    "範囲入庫ケース" integer,
    "範囲入庫kg" double precision,
    "インポート場所ID" integer,
    "半年ケース" double precision,
    "年間ケース" integer,
    "平均年間ケース" integer,
    "現在在庫率" character varying(255),
    "出庫予定込在庫率" character varying(255),
    "年間在庫率" character varying(255),
    "製造工場No" character varying(255),
    "製造工場運賃区分" character varying(255)
);

CREATE TABLE ws_fe."TM_印刷管理" (
    "抽出区分" boolean,
    "レポート名" character varying(50),
    "オブジェクト名" character varying(50),
    "日付フィールド" character varying(50),
    "印刷時間" character varying(50),
    "登録時間" character varying(50),
    "登録日" timestamp without time zone,
    "表示On" boolean,
    "日報有無" character varying(50),
    "オブジェクト" character varying(50),
    "実行コード" character varying(50),
    "製造分割表印刷日" timestamp without time zone
);

CREATE TABLE ws_fe."TM_原料マスタ" (
    "原料分類ID" integer,
    "原料分類" character varying(50)
);

CREATE TABLE ws_fe."TM_参照アドレス" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE ws_fe."TM_参照アドレスhousou" (
    "ID" integer,
    "名称" character varying(255),
    "ファイル名" character varying(255),
    "拡張子" character varying(50),
    "アドレス" character varying(255),
    "備考" character varying(255),
    "参照アドレス" text
);

CREATE TABLE ws_fe."TM_取り扱い区分マスタ" (
    "ID" integer,
    "分類" character varying(255),
    "取扱い区分ID" integer,
    "区分名" character varying(255)
);

CREATE TABLE ws_fe."TM_受注先マスタ" (
    "本社受注" boolean,
    "ID" integer,
    "受注区分" integer,
    "取引先ID" integer,
    "取引先名" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "受注先ID" integer,
    "受注先名" character varying(255),
    "受注帳合ID" integer,
    "受注帳合先名" character varying(255),
    "指定届け先コード" integer,
    "指定届け先" character varying(255),
    "ユーザー区分" character varying(255),
    "指定入庫名義ID" integer,
    "指定入庫後名義名" character varying(255),
    "最終使用日" timestamp without time zone,
    "指定倉庫ID" integer,
    "指定倉庫名" character varying(255),
    "備考" character varying(50),
    "道内区分" boolean,
    "転売区分" boolean,
    "一般ユーザー" boolean,
    "仕入区分" boolean,
    "伝票送付" boolean,
    "デポ区分" boolean,
    "使用不可" boolean,
    "取扱い区分" integer
);

CREATE TABLE ws_fe."TM_受注検索方法" (
    "ID" integer,
    "検索方法ID" integer,
    "選択方法" character varying(255),
    "コメント" character varying(255),
    "備考" character varying(255),
    "順番No1" integer,
    "順番No2" integer,
    "順番No3" integer,
    "順番No4" integer
);

CREATE TABLE ws_fe."TM_合否判定" (
    "合否判定ID" integer,
    "合否判定" character varying(255)
);

CREATE VIEW ws_fe."TM_商品マスタ" AS
 SELECT "ID",
    "商品コード",
    "同一商品chk",
    "グループ商品コード",
    "分類ID",
    "短縮コード",
    "本社コード",
    "ｶﾅ分類",
    "短縮名",
    "商品名",
    "規格",
    "入数",
    "非加熱品",
    "DB品番CD",
    "DBパットCD",
    "パット使用数",
    "品質保持期間",
    "特別検査区分",
    "歩留",
    "商品区分",
    "主用原料コード",
    "計量袋ID",
    "取引先ID",
    "取引先名",
    "ダンボールID",
    "テープID",
    "自社原料区分",
    "旧コード",
    "賞味期限日付差",
    "標準単価",
    "売価",
    "変更通知",
    "規格枚数",
    "規格kg",
    "原料コード",
    "等級",
    "サイズ",
    "パレット単位1",
    "パレット単位2",
    "特記事項",
    "作業工程",
    "登録時間",
    "ロット表示区分",
    "冷凍パン入数",
    "現場ID",
    "パレットID",
    "賞味期限追記",
    "製造場所ID",
    "製造場所",
    "取引先重複有無",
    "使用中止",
    "表示単位",
    "産地コード",
    "産地通称",
    "特定運賃取扱区分",
    "旧会社コード区分",
    "使用可能chk",
    "抽出フラグ",
    "取扱い区分",
    "取扱い区分名",
    "積込時注意項目",
    "マスタ登録日",
    "訂正区分",
    "USER賞味残日数",
    "繁盛商品コード",
    "資材ダンボールID",
    "資材計量袋ID",
    "資材その他ID",
    "寸法L",
    "寸法H",
    "寸法W",
    "ロボットプログラムNo"
   FROM kyotsu."TM_商品マスタ";

CREATE TABLE ws_fe."TM_商品マスタ_変更前" (
    "商品コード" integer,
    "同一商品chk" boolean,
    "グループ商品コード" integer,
    "分類ID" integer,
    "短縮コード" integer,
    "本社コード" character varying(50),
    "ｶﾅ分類" character varying(1),
    "短縮名" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "単価" integer,
    "品質保持期間" double precision,
    "歩留" integer,
    "商品区分" integer,
    "ロボットプログラムNo" integer,
    "主用原料コード" integer,
    "計量袋ID" integer,
    "取引先ID" integer,
    "取引先名" character varying(50),
    "ダンボールID" integer,
    "テープID" smallint,
    "自社原料区分" integer,
    "旧コード" integer,
    "賞味期限日付差" integer,
    "標準単価" double precision,
    "売価" integer,
    "変更通知" boolean,
    "規格枚数" integer,
    "規格kg" double precision,
    "原料コード" integer,
    "等級" character varying(50),
    "サイズ" character varying(50),
    "パレット単位1" smallint,
    "パレット単位2" smallint,
    "特記事項" character varying(50),
    "作業工程" integer,
    "登録時間" character varying(50),
    "ロット表示区分" integer,
    "資材ダンボールID" integer,
    "資材計量袋ID" integer,
    "資材その他ID" integer,
    "冷凍パン入数" integer,
    "現場ID" integer,
    "パット使用数" smallint,
    "パレットID" integer,
    "道内在庫" character varying(50),
    "DB品番CD" character varying(50),
    "製造場所ID" integer,
    "製造場所" character varying(255),
    "取引先重複有無" boolean,
    "使用中止" boolean,
    "表示単位" character varying(255),
    "産地コード" integer,
    "産地通称" character varying(255),
    "特定運賃取扱区分" integer,
    "旧会社コード区分" boolean,
    "使用可能chk" boolean,
    "抽出フラグ" boolean
);

CREATE TABLE ws_fe."TM_商品ラベル" (
    "ID" integer,
    "ラベル名称" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "ラベル枚数" character varying(50),
    "ラベル色" integer,
    "ラベルタイプ" integer
);

CREATE TABLE ws_fe."TM_商品区分" (
    "区分ID" integer,
    "区分名" character varying(50),
    "区分隠語" character varying(255),
    "検査日数" integer
);

CREATE TABLE ws_fe."TM_商品振替" (
    "ID" integer,
    "振替先" character varying(255),
    "振替後商品区分" integer,
    "振替後商品区分名" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TM_商品状態マスタ" (
    "ID" integer,
    "隠語" character varying(255),
    "状態" character varying(255),
    "区分" character varying(255)
);

CREATE TABLE ws_fe."TM_商品輸送区分" (
    "商品輸送区分" integer,
    "区分名" character varying(255)
);

CREATE TABLE ws_fe."TM_商品隠語マスタ" (
    "ID" integer,
    "隠語" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "ストックユーザーコード" integer,
    "ストックユーザー名" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TM_地区コード" (
    "地区コード" integer,
    "地区名" character varying(50),
    "十二コード" integer,
    "十二地区" character varying(50),
    "都道府県名" character varying(50),
    "都道府県コード" integer
);

CREATE TABLE ws_fe."TM_大阪月間受注商品マスタ" (
    "商品コード" integer,
    "商品名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "規格" character varying(255),
    "入数" integer,
    "歩留" integer,
    "本社識別受注ID" character varying(255)
);

CREATE TABLE ws_fe."TM_専務専用住所録" (
    "ID" integer,
    "ｶﾅ分類" character varying(1),
    "得意先名" character varying(50),
    "担当者名" character varying(50),
    "郵便番号" character varying(50),
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "携帯番号" character varying(50),
    "入力日" character varying(50)
);

CREATE VIEW ws_fe."TM_得意先マスタ" AS
 SELECT "ID",
    "取引元ID",
    "取引元",
    "短縮コード",
    "得意先コード",
    "ｶﾅ分類",
    "得意先名",
    "短縮名",
    "地区コード",
    "郵便番号",
    "都道府県",
    "住所",
    "電話番号",
    "FAX番号",
    "倉庫区分",
    "出荷元区分",
    "入庫区分",
    "仕入帳区分",
    "通常保管料",
    "入出庫料",
    "グループコード",
    "グループコード2",
    "十二地区",
    "受付時間",
    "備考",
    "入庫フラグ",
    "地区名",
    "グループコード3",
    "登録時間",
    "必着時間",
    "保管区分",
    "短縮名2",
    "隠語",
    "ユーザー区分",
    "ユーザー区分名",
    "抽出フラグ",
    "丸北契約冷蔵庫区分",
    "使用不可フラグ",
    "パレット積載許容数",
    "正式電話番号",
    "訂正区分",
    chk,
    "最終使用日",
    "繁盛取引先コード",
    "繁盛納入先コード"
   FROM kyotsu."TM_得意先マスタ";

CREATE TABLE ws_fe."TM_得意先区分" (
    "得意先区分コード" integer,
    "区分名" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE ws_fe."TM_本社依頼受注" (
    "大阪受注ID" integer,
    "グループ商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "規格" character varying(255),
    "入数" integer,
    "届け先コード" integer,
    "届け先" character varying(255),
    "元ケース" integer,
    "元数kg" integer,
    "出荷ケース" integer,
    "出荷kg" integer,
    "残ケース" integer,
    "残kg" integer,
    "商品kg" integer,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "備考" character varying(255),
    "摘要" character varying(255),
    "作成日" timestamp without time zone,
    "受注作成済みchk" boolean,
    "本社識別受注ID" character varying(255),
    "ふらの商品" boolean,
    "本社商品コード" integer,
    "仕入先商品コード" integer,
    "終了chk" boolean,
    "受注元ID" integer,
    "受注元" character varying(255),
    "確認chk" boolean,
    chk boolean,
    "丸北出荷済みケース" integer,
    "丸北出荷済みkg" integer,
    "倉庫出荷済みケース" integer,
    "倉庫出荷済みkg" integer,
    "丸北出荷見込ケース" integer,
    "丸北出荷見込kg" integer,
    "倉庫出荷見込ケース" integer,
    "倉庫出荷見込kg" integer,
    "出荷済みケース" integer,
    "出荷済みkg" integer,
    "出荷見込ケース" integer,
    "出荷見込kg" integer,
    "丸北出荷ケース" integer,
    "丸北出荷kg" integer,
    "倉庫出荷ケース" integer,
    "倉庫出荷kg" integer,
    "年月" character varying(255),
    "前月繰越ケース" integer,
    "前月繰越kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(255)
);

CREATE TABLE ws_fe."TM_本社依頼受注_前年度" (
    "本社受注ID" integer,
    "作成日" timestamp without time zone,
    "受注作成済みchk" boolean,
    "本社識別受注ID" character varying(255),
    "ふらの商品" boolean,
    "商品コード" integer,
    "商品名" character varying(255),
    "規格" character varying(255),
    "入数" integer,
    "本社商品コード" integer,
    "仕入先商品コード" integer,
    "ケース" integer,
    "残ケース" integer,
    "出荷kg" integer,
    "元数kg" integer,
    "商品kg" integer,
    "残kg" integer,
    "終了chk" boolean,
    "受注元ID" integer,
    "受注元" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "備考" character varying(255),
    "摘要" character varying(255),
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "確認chk" boolean,
    chk boolean
);

CREATE TABLE ws_fe."TM_本社扱い振分マスタ" (
    "取引元ID" integer,
    "取引元" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "運賃請求ID" integer,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "特定条件" boolean,
    "指定冷蔵庫" boolean,
    "備考" character varying(255),
    "取扱区分" boolean,
    "取扱名" character varying(255)
);

CREATE TABLE ws_fe."TM_本社請求先マスタ" (
    "ID" integer,
    "得意先コード" double precision,
    "得意先名１" character varying(255),
    "得意先名２" character varying(255),
    "郵便番号" character varying(255),
    "住所１" character varying(255),
    "住所２" character varying(255),
    "電話番号" character varying(255),
    "FAX番号" character varying(255),
    "請求先ｺｰﾄﾞ" double precision,
    "請求先名" character varying(255)
);

CREATE TABLE ws_fe."TM_札色設定" (
    "ID" integer,
    "札の色" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TM_混載区分" (
    "ID" integer,
    "混載区分" integer,
    "区分名" character varying(255)
);

CREATE TABLE ws_fe."TM_産地マスタ" (
    "産地コード" integer,
    "通称" character varying(50),
    "国籍" character varying(50),
    "都道府県" character varying(255),
    "市町村" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TM_用紙タイプ" (
    "ID" integer,
    "用紙タイプ" character varying(50),
    "幅" integer,
    "高さ" integer,
    "Key" integer
);

CREATE TABLE ws_fe."TM_相手先商品マスタ" (
    "受注元コード" integer,
    "受注元" character varying(255),
    "得意先短縮コード" integer,
    "得意先名" character varying(50),
    "相手先商品コード" character varying(255),
    "相手先商品名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "帳合先コード1" character varying(255),
    "帳合先1" character varying(255),
    "相手先商品コード1" character varying(255),
    "相手先商品名1" character varying(50),
    "帳合先コード2" character varying(255),
    "帳合先2" character varying(255),
    "相手先商品コード2" character varying(255),
    "相手先商品名2" character varying(50),
    "本社商品コード" character varying(255),
    chk boolean,
    "備考" character varying(255),
    "製造場所ID" integer,
    "指定倉庫ID" integer,
    "使用不可" boolean
);

CREATE TABLE ws_fe."TM_相手先届け先マスタ" (
    "ID" integer,
    "相手方届け先コード" character varying(50),
    "自社コード" integer,
    "届け先" character varying(50),
    "相手先コード" integer,
    "相手先名" character varying(50)
);

CREATE TABLE ws_fe."TM_製造場所" (
    "製造場所ID" integer,
    "製造場所" character varying(255),
    "短縮名" character varying(255),
    "倉庫ID" integer
);

CREATE TABLE ws_fe."TM_製造工場マスタ" (
    "短縮コード" integer,
    "短縮名" character varying(50),
    "製造工場No" character varying(255),
    "製造工場運賃区分" character varying(255)
);

CREATE TABLE ws_fe."TM_訂正科目マスタ" (
    "訂正科目ID" integer,
    "訂正科目名" character varying(255)
);

CREATE TABLE ws_fe."TM_読込コードマスタ" (
    "ID" integer,
    "取引先コード" integer,
    "取引先" character varying(50),
    "相手商品コード" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "備考" character varying(50),
    "枚数管理chk" boolean,
    "セットアップ商品" boolean
);

CREATE TABLE ws_fe."TM_買取単価マスタ" (
    "ID" integer,
    "計算区分" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "単価" double precision,
    "開始日" timestamp without time zone,
    "終了日" timestamp without time zone,
    "買取先コード" integer,
    "買取先" character varying(50),
    "備考" character varying(50),
    "年度" character varying(255),
    "新会社コード" integer,
    "特定産地コード" integer,
    "産地名" character varying(255)
);

CREATE TABLE ws_fe."TM_車両区分" (
    "車両区分ID" integer,
    "車両区分" character varying(50),
    "積載量" integer
);

CREATE TABLE ws_fe."TM_輸送区分" (
    "輸送区分ID" integer,
    "輸送区分" character varying(50)
);

CREATE TABLE ws_fe."TM_輸送扱いマスタ" (
    "輸送扱い区分" integer,
    "輸送扱い区分名" character varying(255),
    "備考" character varying(255)
);

CREATE TABLE ws_fe."TM_通常運賃マスタ" (
    "運賃ID" integer,
    "運賃区分" integer,
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "最低運賃" double precision,
    "商品区分" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(50),
    "計算ID" smallint,
    "計算方法" character varying(50),
    "車両ID" integer,
    "車両" character varying(50),
    "配達ID" integer,
    "配達" character varying(50),
    "冷凍ID" integer,
    "冷凍" character varying(50),
    "北海道" double precision,
    "東北" double precision,
    "関東" double precision,
    "東海中部" double precision,
    "北陸" double precision,
    "近畿" double precision,
    "中国" double precision,
    "四国" double precision,
    "九州" double precision,
    "その他" double precision,
    "Min" double precision,
    "Max" double precision
);

CREATE TABLE ws_fe."TM_週間予定表マスタ" (
    "ID" integer,
    "届け先コード" integer,
    "届け先名" character varying(255),
    "カウンター数" integer,
    "使用不可" boolean
);

CREATE TABLE ws_fe."TM_運賃分類マスタ" (
    "運賃計算ID" integer,
    "運賃計算名" character varying(255),
    "運賃科目" character varying(255)
);

CREATE TABLE ws_fe."TM_運賃扱いマスタ" (
    "運賃扱い区分" integer,
    "扱い区分" character varying(255),
    "扱い区分名" character varying(255),
    "備考" character varying(255),
    "運賃除外区分" boolean
);

CREATE TABLE ws_fe."TM_運賃振分区分マスタ" (
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255)
);

CREATE TABLE ws_fe."TM_運賃輸送区分" (
    "運賃輸送区分" integer,
    "運賃輸送区分名" character varying(255)
);

CREATE TABLE ws_fe."TM_運送会社マスタ" (
    "ID" integer,
    "小口配送区分" boolean,
    "配達区分" integer,
    "配達区分名" character varying(255),
    "運送会社ID" integer,
    "カナ分類" character varying(1),
    "短縮名" character varying(255),
    "運送会社名" character varying(255),
    "グループコード1" integer,
    "請求先区分" boolean,
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "締日" character varying(50),
    "支払方法" character varying(50),
    "取引銀行" character varying(50),
    "口座番号" character varying(50),
    "その他支払い" character varying(50),
    "サイト" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "請求書送り先住所" character varying(100),
    "請求先電話番号" character varying(50),
    "請求書FAX番号" character varying(255),
    "振込先コード" integer,
    "振込先" character varying(50),
    "振込住所" character varying(100),
    "振込先電話番号" character varying(50),
    "振込先FAX番号" character varying(255),
    "備考" character varying(255),
    "支払い元" character varying(50),
    "支払い元住所" character varying(50),
    "支払い元電話番号" character varying(50),
    "支払先FAX番号" character varying(255),
    "運賃扱い区分" integer,
    "使用不可フラグ" boolean,
    "最大パレット積載数" integer,
    "最小パレット積載数" integer,
    "訂正区分" boolean,
    "eLixxi扱い便CD" character varying(255)
);

CREATE TABLE ws_fe."TM_運送会社車両パレット積載マスタ" (
    "ID" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(255),
    "最大パレット積載数" integer,
    "車両区分ID" integer,
    "車両区分" character varying(255)
);

CREATE TABLE ws_fe."TM_運送会社車番別積載量マスタ" (
    "ID" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(255),
    "運輸検査場所" character varying(255),
    "種別分類番号" character varying(255),
    "車両区分" character varying(255),
    "一連指定番号" character varying(255),
    "形　状" character varying(255),
    "最大積載量" integer,
    "登録日" timestamp without time zone
);

CREATE TABLE ws_fe."TM_配達区分" (
    "ID" integer,
    "配達区分ID" integer,
    "配達区分" character varying(50)
);

CREATE TABLE ws_fe."TM_配達区分old" (
    "ID" integer,
    "配達区分ID" integer,
    "配達区分" character varying(50)
);

CREATE TABLE ws_fe."TM_集荷先別パレット設定" (
    "ID" integer,
    "集荷先ID" integer,
    "集荷先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "パレット単位" integer,
    "特定パレット単位" integer,
    "段数" integer,
    "備考" character varying(50)
);

CREATE TABLE ws_fe."TM_集計用レポートクエリ" (
    "ID" integer,
    "作成日" character varying(50),
    "グループ集計" boolean,
    "集計開始日" timestamp without time zone,
    "集計終了日" timestamp without time zone,
    "表題" character varying(255),
    "W_0" character varying(50),
    "W_0_1" character varying(50),
    "W_1_1" character varying(50),
    "W_1" character varying(50),
    "W_2" character varying(50),
    "W_3" character varying(50),
    "W_4" character varying(50),
    "W_5" character varying(50),
    "W_6" character varying(50),
    "W_7" character varying(50),
    "W_8" character varying(50),
    "W_9" character varying(50),
    "W_10_1" character varying(50),
    "W_10_2" character varying(50),
    "W_10_3" character varying(50),
    "W_10_4" character varying(50),
    "W_11" character varying(50),
    "W_12" character varying(50),
    "W_like" character varying(50),
    "V_0" boolean,
    "V_1" boolean,
    "V_2" boolean,
    "V_3" boolean,
    "V_4" boolean,
    "V_5" boolean,
    "V_6" boolean,
    "V_7" boolean,
    "V_8" boolean,
    "V_9" boolean,
    "V_10" boolean,
    "V_11" boolean,
    "V_12" boolean,
    "ヘッダー" character varying(50),
    "フッダー" character varying(50)
);

CREATE TABLE ws_fe."TX_商品発着管理" (
    "ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "ケース" character varying(50),
    "抽出区分1" boolean,
    "抽出区分2" boolean
);

CREATE TABLE ws_fe."T_トラック積載イメージ用" (
    "ID" integer,
    "出荷日" timestamp without time zone,
    "輸送ID" integer,
    "積込順" integer,
    "商品コード" integer,
    "商品名" character varying(255),
    "総ケース" integer,
    "総商品kg" integer,
    "商品kg" integer,
    "No" integer,
    "通常段列ケース" integer,
    "高さcm" integer,
    "長さcm" integer,
    "横幅積載数" integer,
    "基本段数" integer,
    "縦ブロック積載数" integer,
    "車両区分ID" integer,
    "車両大区分" character varying(255),
    "段高さcm" integer,
    "幅余cm" integer,
    "商品毎No" integer,
    "容積比" integer,
    "届け先コード" integer,
    "届け先" character varying(255),
    "容積立方m" double precision,
    "才数計" double precision
);

CREATE TABLE ws_fe."T_パレット回送" (
    "輸送ID" integer,
    "ID" integer,
    "txt_L1" character varying(255),
    "txt_L2" character varying(255),
    "txt_L3" character varying(255),
    "txt_L4" character varying(255),
    "txt_L5" character varying(255),
    "txt_L6" character varying(255),
    "txt_L7" character varying(255),
    "txt_L8" character varying(255),
    "txt_L9" character varying(255),
    "txt_L10" character varying(255),
    "txt_L11" character varying(255),
    "txt_L12" character varying(255),
    "txt_R1" character varying(255),
    "txt_R2" character varying(255),
    "txt_R3" character varying(255),
    "txt_R4" character varying(255),
    "txt_R5" character varying(255),
    "txt_R6" character varying(255),
    "txt_R7" character varying(255),
    "txt_R8" character varying(255),
    "txt_R9" character varying(255),
    "txt_R10" character varying(255),
    "パレット枚数" integer,
    "左右差" character varying(255),
    "L1" character varying(255),
    "L2" character varying(255),
    "L3" character varying(255),
    "L4" character varying(255),
    "L5" character varying(255),
    "L6" character varying(255),
    "L7" character varying(255),
    "L8" character varying(255),
    "L9" character varying(255),
    "L10" character varying(255),
    "L11" character varying(255),
    "L12" character varying(255),
    "R1" character varying(255),
    "R2" character varying(255),
    "R3" character varying(255),
    "R4" character varying(255),
    "R5" character varying(255),
    "R6" character varying(255),
    "R7" character varying(255),
    "R8" character varying(255),
    "R9" character varying(255),
    "R10" character varying(255)
);

CREATE TABLE ws_fe."T_パレット輸送積み込み" (
    "ID" integer,
    "出荷日" timestamp without time zone,
    "輸送ID" integer,
    "積順" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "入庫日" timestamp without time zone,
    "製造日" timestamp without time zone,
    "タグ" character varying(255),
    "ケース" integer,
    "商品kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "LR場所" character varying(255),
    "混載区分" integer,
    "混載No" integer,
    "パレット区分" character varying(255),
    "LR場所区分" boolean,
    "半端区分" boolean,
    "当日包装区分" boolean,
    "No" integer,
    "非表示区分" boolean,
    "パレット単位" integer,
    "運送会社名" character varying(255),
    "車番" character varying(255),
    "抽出chk" boolean
);

CREATE TABLE ws_fe."T_パレット配置図" (
    "ID" integer NOT NULL,
    "入庫日" timestamp without time zone,
    "R1-1" character varying(255),
    "R2-1" character varying(255),
    "R3-1" character varying(255),
    "R4-1" character varying(255),
    "R5-1" character varying(255),
    "R1-2" character varying(255),
    "R2-2" character varying(255),
    "R3-2" character varying(255),
    "R4-2" character varying(255),
    "R5-2" character varying(255),
    "R1-3" character varying(255),
    "R2-3" character varying(255),
    "R3-3" character varying(255),
    "R4-3" character varying(255),
    "R5-3" character varying(255),
    "L1-1" character varying(255),
    "L2-1" character varying(255),
    "L3-1" character varying(255),
    "L4-1" character varying(255),
    "L5-1" character varying(255),
    "L6-1" character varying(255),
    "L7-1" character varying(255),
    "L1-2" character varying(255),
    "L2-2" character varying(255),
    "L3-2" character varying(255),
    "L4-2" character varying(255),
    "L5-2" character varying(255),
    "L6-2" character varying(255),
    "L7-2" character varying(255),
    "L1-3" character varying(255),
    "L2-3" character varying(255),
    "L3-3" character varying(255),
    "L4-3" character varying(255),
    "L5-3" character varying(255),
    "L6-3" character varying(255),
    "L7-3" character varying(255),
    "CL-1" character varying(255),
    "CL-2" character varying(255),
    "CL-3" character varying(255),
    "CL-4" character varying(255),
    "CL-5" character varying(255),
    "CR-1" character varying(255),
    "CR-2" character varying(255),
    "CR-3" character varying(255),
    "CR-4" character varying(255),
    "CR-5" character varying(255),
    "T1" character varying(255),
    "T2" character varying(255),
    "T3" character varying(255),
    "T4" character varying(255),
    "T5" character varying(255),
    "T6" character varying(255),
    "R1-1在庫ID" character varying(255),
    "R2-1在庫ID" character varying(255),
    "R3-1在庫ID" character varying(255),
    "R4-1在庫ID" character varying(255),
    "R5-1在庫ID" character varying(255),
    "R1-2在庫ID" character varying(255),
    "R2-2在庫ID" character varying(255),
    "R3-2在庫ID" character varying(255),
    "R4-2在庫ID" character varying(255),
    "R5-2在庫ID" character varying(255),
    "R1-3在庫ID" character varying(255),
    "R2-3在庫ID" character varying(255),
    "R3-3在庫ID" character varying(255),
    "R4-3在庫ID" character varying(255),
    "R5-3在庫ID" character varying(255),
    "L1-1在庫ID" character varying(255),
    "L2-1在庫ID" character varying(255),
    "L3-1在庫ID" character varying(255),
    "L4-1在庫ID" character varying(255),
    "L5-1在庫ID" character varying(255),
    "L6-1在庫ID" character varying(255),
    "L7-1在庫ID" character varying(255),
    "L1-2在庫ID" character varying(255),
    "L2-2在庫ID" character varying(255),
    "L3-2在庫ID" character varying(255),
    "L4-2在庫ID" character varying(255),
    "L5-2在庫ID" character varying(255),
    "L6-2在庫ID" character varying(255),
    "L7-2在庫ID" character varying(255),
    "L1-3在庫ID" character varying(255),
    "L2-3在庫ID" character varying(255),
    "L3-3在庫ID" character varying(255),
    "L4-3在庫ID" character varying(255),
    "L5-3在庫ID" character varying(255),
    "L6-3在庫ID" character varying(255),
    "L7-3在庫ID" character varying(255),
    "CL-1在庫ID" character varying(255),
    "CL-2在庫ID" character varying(255),
    "CL-3在庫ID" character varying(255),
    "CL-4在庫ID" character varying(255),
    "CL-5在庫ID" character varying(255),
    "CR-1在庫ID" character varying(255),
    "CR-2在庫ID" character varying(255),
    "CR-3在庫ID" character varying(255),
    "CR-4在庫ID" character varying(255),
    "CR-5在庫ID" character varying(255),
    "T1在庫ID" character varying(255),
    "T2在庫ID" character varying(255),
    "T3在庫ID" character varying(255),
    "T4在庫ID" character varying(255),
    "T5在庫ID" character varying(255),
    "T6在庫ID" character varying(255)
);

CREATE SEQUENCE ws_fe."T_パレット配置図_ID_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE ws_fe."T_パレット配置図_ID_seq" OWNED BY ws_fe."T_パレット配置図"."ID";

CREATE TABLE ws_fe."T_入庫依頼書確認用" (
    "ID" integer,
    "出荷計画日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "届け先コード" integer,
    "届け先" character varying(255),
    "入庫後名義ID" integer,
    "入庫後名義名" character varying(255),
    "ケース" integer,
    "商品kg" double precision,
    "リンクコード1" character varying(255),
    "輸送ID" integer,
    "運送会社ID" integer,
    "運送会社名" character varying(255),
    "車番" character varying(255),
    "キャンセル確認" boolean,
    "入庫依頼書送付chk" boolean,
    "送品案内送付chk" boolean,
    "変更chk" boolean,
    "通知" character varying(255),
    "地区コード" integer,
    "倉庫区分" boolean,
    "冷凍区分ID" integer,
    "入庫済みchk" boolean,
    "入庫依頼書コメント" character varying(255),
    "未データchk" boolean,
    "FAX送信カウント" integer,
    "入庫依頼書確認chk" boolean,
    "送品案内書確認chk" boolean,
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "積込完了件数" integer,
    "出荷件数" integer,
    "ユーザー区分名" character varying(255),
    "入庫区分" boolean,
    "積込完了chk" boolean,
    "抽出区分" boolean,
    "扱い区分" integer,
    "扱い区分名" character varying(255),
    "仮入庫通知" boolean,
    "確認用chk" boolean,
    "仮FAX" boolean,
    "特殊レポート名" character varying(255),
    "入庫受付番号" character varying(255)
);

CREATE TABLE ws_fe."T_出力用ふらの在庫" (
    "ID" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "在庫ケース" integer,
    "在庫kg" double precision,
    "備考" character varying(255)
);

CREATE TABLE ws_fe."T_出庫" (
    "出庫ID" integer,
    "輸送ID" integer,
    "出荷日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(50),
    "社内連絡" character varying(255),
    "ｻﾝﾌﾟﾙ区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "賞味期限" timestamp without time zone,
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean,
    "輸送備考" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "個別運賃" numeric(19,4),
    "入庫ID" integer,
    "積順" integer,
    "届け順" smallint,
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "保管料" double precision,
    "入出庫料" double precision,
    "割増出庫料" integer,
    "買取単価コード" integer,
    "支払区分" character varying(255),
    "買取金額" double precision,
    "出荷期数" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "保管費用支払日" timestamp without time zone,
    "受注確認" boolean,
    "買取chk" boolean,
    "ユーザーchk" boolean,
    "受注No" character varying(50),
    "ユーザー伝票No" character varying(255),
    "タグ" character varying(50),
    "買取区分" integer,
    "受注ID" integer,
    "輸送履歴読込chk" boolean,
    "登録時間" timestamp without time zone,
    "出庫確認" boolean,
    "配車確認" boolean,
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行指令No" character varying(255),
    "出庫済み" boolean,
    "本社受注" boolean,
    "運賃請求ID" integer,
    "商品区分" integer,
    "伝票No確認用" character varying(50),
    "商品状態隠語" character varying(50),
    "届け先区分" integer,
    "運賃扱い区分" integer,
    "請求先名" character varying(255),
    "輸送手段" character varying(255),
    "運賃扱い先" character varying(255),
    "産地コード" integer,
    "丸北輸送ID" integer,
    "製造工場ID" integer,
    "製造工場名" character varying(255),
    "インポート先出庫ID" integer,
    "Newクロップ区分" boolean,
    "他工場伝票No" character varying(255),
    "参照受注番号" character varying(255),
    "指定最終届け先コード" integer,
    "指定最終届け先" character varying(255),
    "受注元ID" integer,
    "受注元名" character varying(255),
    "蔵前区分" boolean,
    "タグ2" character varying(255),
    "インポート場所ID" integer
);

CREATE TABLE ws_fe."T_出荷_丸北" (
    "出庫ID" integer,
    "輸送ID" integer,
    "入庫ID" integer,
    "出荷日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "納品日" timestamp without time zone,
    "手配元ID" integer,
    "手配元" character varying(50),
    "手配帳合ID" integer,
    "手配帳合" character varying(50),
    "取引元ID" integer,
    "取引元" character varying(50),
    "取引帳合ID" integer,
    "取引帳合" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "備考" character varying(150),
    "社内連絡" character varying(150),
    "サンプル区分" boolean,
    "出荷区分" boolean,
    chk boolean,
    "包装日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入力日付" timestamp without time zone,
    "入庫No" character varying(50),
    "商品積込順" integer,
    "変更通知" character varying(100),
    "サービス区分" boolean,
    "認識ID" character varying(50),
    "入庫後名義ID" integer,
    "通知" character varying(25),
    "更新日" timestamp without time zone,
    "在庫ID" integer,
    "計画変更chk" boolean,
    "賞味期限通知" character varying(50),
    "請求先コード" integer,
    "請求先" character varying(50),
    "支払区分" character varying(255),
    "個別運賃" numeric(19,4),
    "地区コード" integer,
    "十二地区" character varying(50),
    "売り日" timestamp without time zone,
    "更新時間" character varying(50),
    "買取単価コード" integer,
    "買取chk" boolean,
    "買取金額" double precision,
    "出荷期数" integer,
    "入庫フラグ" boolean,
    "完了フラグ" boolean,
    "抽出区分" boolean,
    "ユーザー伝票No" character varying(50),
    "受注確認" boolean,
    "出荷元数" integer,
    "破損個数" integer,
    "入力時間" timestamp without time zone,
    "受注グループ" integer,
    "輸送履歴読込chk" boolean,
    "ユーザーchk" boolean,
    "帳票グループ化" integer,
    "受注表題" character varying(255),
    "積込確認" boolean,
    "送り状No" character varying(50),
    "締切時間" character varying(50),
    "破損出庫ID" integer,
    "商品区分" integer,
    "出荷元kg" double precision,
    "訂正kg" double precision,
    "入庫備考" boolean,
    "タグ" character varying(50),
    "受注ID" integer,
    "タグ2" character varying(50),
    "商品輸送区分" integer,
    "商品輸送区分名" character varying(255),
    "運送会社手配No" character varying(255),
    "運賃振分区分" integer,
    "運賃振分区分名" character varying(255),
    "運行指令No" character varying(255),
    "本社受注" boolean,
    "運賃請求ID" integer,
    "伝票No確認用" character varying(50),
    "商品状態隠語" character varying(50),
    "届け先区分" integer,
    "運賃扱い区分" integer,
    "インポート場所ID" integer,
    "パレット使用枚数" integer,
    "倉庫受注ID" integer,
    "印刷前検査待ちフラグ" boolean
);

CREATE TABLE ws_fe."T_前年実績" (
    "入数" double precision,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "グループID" integer,
    "グループ名" character varying(255),
    "届け先コード" integer,
    "届け先" character varying(255),
    "年度" double precision,
    "月集計1" double precision,
    "月集計2" double precision,
    "月集計3" double precision,
    "月集計4" double precision,
    "月集計5" double precision,
    "月集計6" double precision,
    "月集計7" double precision,
    "月集計8" double precision,
    "月集計9" double precision,
    "月集計10" double precision,
    "月集計11" double precision,
    "月集計12" double precision,
    "備考" character varying(255),
    "当年集計開始日" timestamp without time zone,
    "当年集計終了日" timestamp without time zone,
    "倉庫区分" boolean,
    "年間集計" integer,
    "月集計Z1" double precision,
    "月集計Z2" double precision,
    "月集計Z3" double precision,
    "月集計Z4" double precision,
    "月集計Z5" double precision,
    "月集計Z6" double precision,
    "月集計Z7" double precision,
    "月集計Z8" double precision,
    "月集計Z9" double precision,
    "月集計Z10" double precision,
    "月集計Z11" double precision,
    "月集計Z12" double precision,
    "前年集計" integer,
    "今年度" integer,
    "前年度" integer,
    "前々年度" integer,
    "前年集計開始日" timestamp without time zone,
    "前年集計終了日" timestamp without time zone,
    "前年製造数" integer,
    "当年製造数" integer,
    "在庫率" double precision,
    "在庫数" integer,
    "月製造集計1" double precision,
    "月製造集計2" double precision,
    "月製造集計3" double precision,
    "月製造集計4" double precision,
    "月製造集計5" double precision,
    "月製造集計6" double precision,
    "月製造集計7" double precision,
    "月製造集計8" double precision,
    "月製造集計9" double precision,
    "月製造集計10" double precision,
    "月製造集計11" double precision,
    "月製造集計12" double precision,
    "月集計前々年1" double precision,
    "月集計前々年2" double precision,
    "月集計前々年3" double precision,
    "月集計前々年4" double precision,
    "月集計前々年5" double precision,
    "月集計前々年6" double precision,
    "月集計前々年7" double precision,
    "月集計前々年8" double precision,
    "月集計前々年9" double precision,
    "月集計前々年10" double precision,
    "月集計前々年11" double precision,
    "月集計前々年12" double precision,
    "前々年製造数" integer,
    "前々年集計" integer
);

CREATE TABLE ws_fe."T_受注伝票" (
    "ID" integer,
    "集荷先" character varying(50),
    "届け先" character varying(50),
    "市町村" character varying(50),
    "商品名" character varying(50),
    "規格" character varying(50),
    "賞味期限" timestamp without time zone,
    "個数" integer,
    "商品kg" double precision,
    "納品日" timestamp without time zone,
    "締切時間" character varying(50),
    "送り状No" character varying(50),
    "その他" character varying(50),
    "備考" character varying(50),
    "出荷日" timestamp without time zone,
    "住所" character varying(50),
    "積順" integer,
    "輸送ID" integer,
    "電話番号" character varying(50)
);

CREATE TABLE ws_fe."T_名変" (
    "変更No" integer,
    "在庫No" integer,
    "変更日" timestamp without time zone,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" double precision,
    "ケース" integer,
    "商品kg" double precision,
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "変更前名義ID" integer,
    "変更後名義ID" integer,
    "変更区分" integer,
    "備考" character varying(255),
    "買取単価コード" integer,
    "支払区分" integer,
    "買取金額" double precision,
    "買取chk" boolean,
    "保管庫ID" integer,
    "保管庫名" character varying(50),
    "変更Check" boolean,
    "入庫No" character varying(50),
    "変更前在庫数" integer,
    "移動先ID" integer,
    "移動先名" character varying(50),
    "出荷期数" integer,
    "保管料" double precision,
    "入出庫料" double precision,
    "出荷伝票No" integer,
    "抽出区分" boolean,
    "区分" integer
);

CREATE TABLE ws_fe."T_月末在庫_保管場所商品別" (
    "ID" integer,
    "集計月" character varying(255),
    "集計日" timestamp without time zone,
    "倉庫ID" integer,
    "倉庫名" character varying(255),
    "商品コード" integer,
    "商品名" character varying(255),
    "在庫ケース" integer,
    "在庫kg" double precision,
    "ユーザー区分" integer,
    "ユーザー区分名" character varying(255)
);

CREATE TABLE ws_fe."T_画面一覧" (
    "ID" integer,
    "分類" character varying(50),
    "名称" character varying(255),
    "区分" smallint,
    "実行名" character varying(255),
    "ソース名" character varying(255),
    "対象フィールド" character varying(50),
    "解説" character varying(50),
    "引数" character varying(255)
);

CREATE TABLE ws_fe."T_車種区分" (
    "ID" integer,
    "区分" integer,
    "輸送ルート" character varying(50),
    "重量kg" integer
);

CREATE TABLE ws_fe."T_輸送履歴" (
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "売り日" timestamp without time zone,
    "帳合運送会社コード" integer,
    "帳合運送会社名" character varying(50),
    "手配運送会社コード" integer,
    "手配運送会社名" character varying(50),
    "運送会社ID" smallint,
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "輸送区分ID" integer,
    "輸送区分" character varying(20),
    "車両区分ID" integer,
    "車両区分" character varying(20),
    "配達区分ID" integer,
    "配達区分" character varying(20),
    "冷凍区分ID" integer,
    "冷凍区分" character varying(20),
    "輸送ID" integer,
    "分類ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "規格" character varying(50),
    "入数" real,
    "ケース" integer,
    "商品kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "入庫前名義ID" integer,
    "入庫後名義ID" integer,
    "地区コード" integer,
    "地区名" character varying(50),
    "十二地区" character varying(50),
    "都道府県" character varying(50),
    "原料コード" integer,
    "入庫名義" character varying(50),
    "備考" character varying(50)
);

CREATE TABLE ws_fe."T_配車表" (
    "ID" integer,
    "出荷日" timestamp without time zone,
    "納品日" timestamp without time zone,
    "輸送ID" integer,
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "入数" integer,
    "ケース" integer,
    "商品kg" integer,
    "倉庫ID" integer,
    "倉庫名" character varying(50),
    "届け先コード" integer,
    "届け先" character varying(50),
    "備考" character varying(255),
    "商品積込順" integer,
    "届け先順" integer,
    "集荷順" integer,
    "受付時間" character varying(50),
    "売り日" timestamp without time zone,
    "積順" integer
);

CREATE TABLE ws_fe."エクセル用出荷履歴" (
    "ID" integer,
    "出荷日" timestamp without time zone,
    "曜日" character varying(50),
    "出荷元" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "ケース" integer,
    "商品kg" integer,
    "納品日" timestamp without time zone,
    "届け先" character varying(50),
    "入庫名義" character varying(50),
    "運送会社名" character varying(50),
    "車番" character varying(50),
    "日数" integer
);

CREATE TABLE ws_fe."エクセル用在庫表" (
    "ID" integer,
    "保管場所" character varying(50),
    "名義" character varying(50),
    "出荷日" timestamp without time zone,
    "入庫日" timestamp without time zone,
    "入庫番号" character varying(50),
    "商品コード" integer,
    "商品名" character varying(50),
    "規格" character varying(50),
    "製造日" timestamp without time zone,
    "賞味期限" timestamp without time zone,
    "元数" integer,
    "繰越Cs" integer,
    "入庫Cs" integer,
    "出庫Cs" integer,
    "在庫Cs" integer,
    "＆" character varying(50),
    "繰越kg" integer,
    "入庫kg" integer,
    "出庫kg" integer,
    "在庫kg" integer
);

CREATE TABLE ws_fe."オブジェクト一覧" (
    "ID" integer,
    "テーブル" character varying(50),
    "日付項目" character varying(50),
    "オブジェクト名" character varying(50),
    "印刷区分ID" integer,
    "区分名" character varying(50),
    "ユーザー関数" character varying(50),
    "名称" character varying(50),
    "因数" integer,
    "印刷区分" integer
);

CREATE TABLE ws_fe."丸北住所録" (
    "ID" integer,
    "ｶﾅ分類" character varying(50),
    "得意先名" character varying(50),
    "郵便番号" character varying(50),
    "住所" character varying(50),
    "電話番号" character varying(50),
    "FAX番号" character varying(50),
    "備考" character varying(50),
    "入力日" character varying(50)
);

ALTER TABLE ONLY housou_fe."TM_ロボット積み付けマスタold" ALTER COLUMN "ID" SET DEFAULT nextval('housou_fe."TM_ロボット積み付けマスタold_ID_seq"'::regclass);

ALTER TABLE ONLY housou_fe."T_パレット在庫管理 のコピー" ALTER COLUMN "ID" SET DEFAULT nextval('housou_fe."T_パレット在庫管理 のコピー_ID_seq"'::regclass);

ALTER TABLE ONLY juchu_fe."TM_入庫先商品別名義条件" ALTER COLUMN "ID" SET DEFAULT nextval('juchu_fe."TM_入庫先商品別名義条件_ID_seq"'::regclass);

ALTER TABLE ONLY seizo_fe."TM_イベントスケジュール" ALTER COLUMN "ID" SET DEFAULT nextval('seizo_fe."TM_イベントスケジュール_ID_seq"'::regclass);

ALTER TABLE ONLY seizo_fe."TM_テープマスタ" ALTER COLUMN "テープID" SET DEFAULT nextval('seizo_fe."TM_テープマスタ_テープID_seq"'::regclass);

ALTER TABLE ONLY seizo_fe."TM_原料マスタ" ALTER COLUMN "原料分類ID" SET DEFAULT nextval('seizo_fe."TM_原料マスタ_原料分類ID_seq"'::regclass);

ALTER TABLE ONLY seizo_fe."TM_札色設定" ALTER COLUMN "ID" SET DEFAULT nextval('seizo_fe."TM_札色設定_ID_seq"'::regclass);

ALTER TABLE ONLY seizo_fe."TM_製造商品頻度マスタ2025" ALTER COLUMN "ID" SET DEFAULT nextval('seizo_fe."TM_製造商品頻度マスタ2025_ID_seq"'::regclass);

ALTER TABLE ONLY seizo_fe."TM_運送会社マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('seizo_fe."TM_運送会社マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."M_Webアドレス操作" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."M_Webアドレス操作_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_スケジュール" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_スケジュール_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_出荷予定日" ALTER COLUMN "伝票日付No" SET DEFAULT nextval('soko_fe."TD_出荷予定日_伝票日付No_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_商品分類" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_商品分類_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_当日在庫" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_当日在庫_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_月別倉庫保管経費" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_月別倉庫保管経費_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_月別倉庫支払経費" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_月別倉庫支払経費_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_積込順" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_積込順_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TD_訂正履歴" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TD_訂正履歴_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_イベントスケジュール" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_イベントスケジュール_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_カレンダー" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_カレンダー_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_サービス設定" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_サービス設定_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_ニチレイパレット積載マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_ニチレイパレット積載マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_ニチレイパレット積載マスタ_印刷用" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_ニチレイパレット積載マスタ_印刷用_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_レポート作成" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_レポート作成_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_備考欄" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_備考欄_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_入庫先商品別名義条件" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_入庫先商品別名義条件_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_冷凍区分" ALTER COLUMN "冷凍ID" SET DEFAULT nextval('soko_fe."TM_冷凍区分_冷凍ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_出荷場所条件" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_出荷場所条件_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_原料マスタ" ALTER COLUMN "原料分類ID" SET DEFAULT nextval('soko_fe."TM_原料マスタ_原料分類ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_参照アドレス" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_参照アドレス_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_参照アドレスHOUSOU" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_参照アドレスHOUSOU_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_受注先マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_受注先マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_受注検索方法" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_受注検索方法_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_商品隠語マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_商品隠語マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_営業冷蔵庫倉庫商品マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_営業冷蔵庫倉庫商品マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_産地マスタ" ALTER COLUMN "産地コード" SET DEFAULT nextval('soko_fe."TM_産地マスタ_産地コード_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_読込コードマスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_読込コードマスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_買取単価マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_買取単価マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_買取単価マスタ_加工賃" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_買取単価マスタ_加工賃_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_車両区分" ALTER COLUMN "車両区分ID" SET DEFAULT nextval('soko_fe."TM_車両区分_車両区分ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_輸送区分" ALTER COLUMN "輸送区分ID" SET DEFAULT nextval('soko_fe."TM_輸送区分_輸送区分ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_週間予定表マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_週間予定表マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_運賃分類マスタ" ALTER COLUMN "運賃計算ID" SET DEFAULT nextval('soko_fe."TM_運賃分類マスタ_運賃計算ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_運賃扱いマスタ" ALTER COLUMN "運賃扱い区分" SET DEFAULT nextval('soko_fe."TM_運賃扱いマスタ_運賃扱い区分_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_運賃輸送区分" ALTER COLUMN "運賃輸送区分" SET DEFAULT nextval('soko_fe."TM_運賃輸送区分_運賃輸送区分_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_運送会社マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_運送会社マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_運送会社別サイズ別係数" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_運送会社別サイズ別係数_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."TM_配達区分" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."TM_配達区分_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_ユーザー別商品推移" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_ユーザー別商品推移_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_倉庫請求書" ALTER COLUMN "在庫ID" SET DEFAULT nextval('soko_fe."T_倉庫請求書_在庫ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_入庫依頼書確認用" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_入庫依頼書確認用_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_寿Exel出庫" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_寿Exel出庫_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_寿Exel在庫" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_寿Exel在庫_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_寿Exel在庫_TypeB" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_寿Exel在庫_TypeB_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_車種区分" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_車種区分_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_週間予定表_入庫" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_週間予定表_入庫_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_週間予定表_出庫" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_週間予定表_出庫_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."T_配送料明細" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."T_配送料明細_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."エクセル用出荷履歴" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."エクセル用出荷履歴_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."オブジェクト一覧" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."オブジェクト一覧_ID_seq"'::regclass);

ALTER TABLE ONLY soko_fe."テーブル1" ALTER COLUMN "ID" SET DEFAULT nextval('soko_fe."テーブル1_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_イベントスケジュール" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_イベントスケジュール_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_入庫先商品別名義条件" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_入庫先商品別名義条件_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_冷凍区分" ALTER COLUMN "冷凍ID" SET DEFAULT nextval('tehai_fe."TM_冷凍区分_冷凍ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_出荷場所条件" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_出荷場所条件_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_参照アドレス" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_参照アドレス_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_定形メールマスタ" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_定形メールマスタ_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_相手先届け先マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_相手先届け先マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_相手運送会社マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_相手運送会社マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_製造場所" ALTER COLUMN "製造場所ID" SET DEFAULT nextval('tehai_fe."TM_製造場所_製造場所ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_車両区分" ALTER COLUMN "車両区分ID" SET DEFAULT nextval('tehai_fe."TM_車両区分_車両区分ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_輸送区分" ALTER COLUMN "輸送区分ID" SET DEFAULT nextval('tehai_fe."TM_輸送区分_輸送区分ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_運賃輸送区分" ALTER COLUMN "運賃輸送区分" SET DEFAULT nextval('tehai_fe."TM_運賃輸送区分_運賃輸送区分_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_運送会社マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_運送会社マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."TM_配達区分" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."TM_配達区分_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."T_ニチレイ輸送手配詳細データ" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."T_ニチレイ輸送手配詳細データ_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."T_ニチレイ輸送手配詳細データ_前回" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."T_ニチレイ輸送手配詳細データ_前回_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."T_ニチレイ輸送手配詳細データver2" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."T_ニチレイ輸送手配詳細データver2_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."T_ニチレイ輸送手配詳細データver2_前回" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."T_ニチレイ輸送手配詳細データver2_前回_ID_seq"'::regclass);

ALTER TABLE ONLY tehai_fe."T_日別予想kg" ALTER COLUMN "ID" SET DEFAULT nextval('tehai_fe."T_日別予想kg_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."M_Webアドレス操作" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."M_Webアドレス操作_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_WebM" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_WebM_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_elixxi倉庫コードマスタ" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_elixxi倉庫コードマスタ_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_イベントスケジュール" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_イベントスケジュール_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_入庫先商品別名義条件" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_入庫先商品別名義条件_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_参照アドレス" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_参照アドレス_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_参照アドレスHOUSOU" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_参照アドレスHOUSOU_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."TM_運送会社マスタ" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."TM_運送会社マスタ_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."T_elixxi一時入庫データ" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."T_elixxi一時入庫データ_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."T_ランテック詳細" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."T_ランテック詳細_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."テーブル1" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."テーブル1_ID_seq"'::regclass);

ALTER TABLE ONLY web_fe."テーブル2" ALTER COLUMN "ID" SET DEFAULT nextval('web_fe."テーブル2_ID_seq"'::regclass);

ALTER TABLE ONLY ws_fe."TD_在庫変更old" ALTER COLUMN "変更No" SET DEFAULT nextval('ws_fe."TD_在庫変更old_変更No_seq"'::regclass);

ALTER TABLE ONLY ws_fe."TM_パレット調整区分" ALTER COLUMN "ID" SET DEFAULT nextval('ws_fe."TM_パレット調整区分_ID_seq"'::regclass);

ALTER TABLE ONLY ws_fe."T_パレット配置図" ALTER COLUMN "ID" SET DEFAULT nextval('ws_fe."T_パレット配置図_ID_seq"'::regclass);

ALTER TABLE ONLY app.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token);

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (login);

ALTER TABLE ONLY app."受注検索_受注元ボタン"
    ADD CONSTRAINT "受注検索_受注元ボタン_pkey" PRIMARY KEY ("並び");

ALTER TABLE ONLY app."発注依頼書_宛先"
    ADD CONSTRAINT "発注依頼書_宛先_pkey" PRIMARY KEY ("商品コード");

ALTER TABLE ONLY app."発注依頼書_発行元"
    ADD CONSTRAINT "発注依頼書_発行元_pkey" PRIMARY KEY ("番号");

ALTER TABLE ONLY app."設定"
    ADD CONSTRAINT "設定_pkey" PRIMARY KEY ("名前");

CREATE INDEX "TM_商品マスタ_商品コード_idx" ON kyotsu."TM_商品マスタ" USING btree ("商品コード");

CREATE INDEX "TM_得意先マスタ_短縮コード_idx" ON kyotsu."TM_得意先マスタ" USING btree ("短縮コード");

CREATE UNIQUE INDEX "TM_ダンボール寸法マスタ_品番コード_idx" ON seizo_fe."TM_ダンボール寸法マスタ" USING btree ("品番コード");

CREATE UNIQUE INDEX "TM_製造工場マスタ_短縮コード_idx" ON seizo_fe."TM_製造工場マスタ" USING btree ("短縮コード");

CREATE UNIQUE INDEX "TD_出荷予定日_伝票日付No_idx" ON soko_fe."TD_出荷予定日" USING btree ("伝票日付No");

CREATE UNIQUE INDEX "TD_出荷予定日_出荷日_idx" ON soko_fe."TD_出荷予定日" USING btree ("出荷日");

CREATE UNIQUE INDEX "TD_当日在庫_ID_idx" ON soko_fe."TD_当日在庫" USING btree ("ID");

CREATE UNIQUE INDEX "TD_直送買取_出庫ID_idx" ON soko_fe."TD_直送買取" USING btree ("出庫ID");

CREATE UNIQUE INDEX "TM_受注先マスタ_ID_idx" ON soko_fe."TM_受注先マスタ" USING btree ("ID");

CREATE UNIQUE INDEX "T_倉庫請求書_在庫ID_idx" ON soko_fe."T_倉庫請求書" USING btree ("在庫ID");

CREATE UNIQUE INDEX "T_倉庫集計表_UniqeCode_idx" ON soko_fe."T_倉庫集計表" USING btree ("UniqeCode");

CREATE UNIQUE INDEX "T_寿Exel在庫_ID_idx" ON soko_fe."T_寿Exel在庫" USING btree ("ID");

CREATE UNIQUE INDEX "T_寿Exel在庫_TypeB_ID_idx" ON soko_fe."T_寿Exel在庫_TypeB" USING btree ("ID");

CREATE UNIQUE INDEX "エクセル用出荷履歴_ID_idx" ON soko_fe."エクセル用出荷履歴" USING btree ("ID");

CREATE UNIQUE INDEX "T_elixxi一時入庫データ_ID_idx" ON web_fe."T_elixxi一時入庫データ" USING btree ("ID");

ALTER TABLE ONLY app.sessions
    ADD CONSTRAINT sessions_login_fkey FOREIGN KEY (login) REFERENCES app.users(login) ON DELETE CASCADE;

