// 見本版の暗号（ブラウザの中だけで動くので、本当の暗号にはしない。見本版のデータは作り物だけ）
export const 鍵がある = () => true;
export const 暗号にする = (平文: string) => "demo:" + btoa(unescape(encodeURIComponent(平文)));
export const 元に戻す = (暗号: string) => decodeURIComponent(escape(atob(暗号.replace(/^demo:/, ""))));
