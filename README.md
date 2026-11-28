# 對話與文字處理 Demo

[直接開啟公開 Demo](https://yunyuhu.github.io/AI-Dialogue-Demo/)

已由 GitHub Pages 提供介面，並連接正式 Vercel API，支援即時對話與兩階段文字整理。

由 [2024 多輪對話](https://github.com/Yunyuhu/AI-Practice-2024/blob/main/course/week11_chatgpt_chatbot.ipynb)與 [OpenAI API 文字處理](https://github.com/Yunyuhu/AI-Practice-2024/blob/main/practice/openai_api_basics.ipynb)練習延伸的互動展示。

## 可以操作的內容

- 多輪角色對話：電影推薦與文字整理兩種角色，保留同一頁面的上下文，支援清除及切換角色。
- 兩階段文字整理：第一次請求擷取關鍵字，第二次根據原文與關鍵字整理成文，兩個結果分開呈現。
- 載入、等待、輸入錯誤與服務錯誤均有操作提示。

## 原始實作與 2026 整理版

原始版本以 Python、OpenAI SDK 與 Gradio 實作。網頁整理版以 JavaScript Worker 提供伺服器端 API，讓訪客無須開啟 Notebook、安裝套件或提供金鑰。原始 Notebook 保留於原 repo。

這次新增獨立訪客狀態、請求取消、訊息角色驗證、輸入長度限制及來源白名單檢查。所有模型輸出以純文字呈現，避免執行生成的 HTML。對話紀錄只存在當前瀏覽器頁面，API 使用 `store: false`，沒有建置對話資料庫。

## 程式結構

- `public/`：可獨立閱讀的 HTML、CSS 與前端狀態管理。
- `worker.mjs`：角色對話與兩階段處理。
- `runtime.mjs`：輸入限制、API 呼叫、錯誤處理與靜態檔案回應。
- `build.mjs`：將來源打包成可部署的單一 Worker ESM。
- `dev.mjs`：本機 HTTP 轉接器，使用同一份 Worker 行為。

## 部署方式

[後端部署步驟與環境變數](DEPLOYMENT.md)


展示介面由 GitHub Pages 發布，後端由 Vercel Functions 執行。前端只保存公開 API 網址；API 金鑰保存在後端秘密環境變數。`DEMO_ALLOWED_ORIGIN` 限定為 `https://yunyuhu.github.io`。CORS 限制瀏覽器跨來源操作，無法取代身分驗證或全域費用上限。

- `.github/workflows/pages.yml`：發布 `public/`。
- `api/index.mjs`：處理 API 路由、來源驗證與預檢請求。
- `vercel.json`：指定 API 路由與執行期限。

## 本機執行

需要支援標準 Fetch API、Web Crypto 與 `AbortSignal.timeout` 的 Node.js，無須第三方套件。設定檔請留在版本管理之外。

```sh
# 將來源檔與靜態介面打包。
node build.mjs
# 只將既有金鑰設定檔的位置交給本機伺服器，不把金鑰放在命令列。
DEMO_ENV_FILE=/absolute/path/to/.env.local PORT=8766 node dev.mjs
```

本機設定使用 `OPENAI_API_KEY`，模型可用 `OPENAI_MODEL` 覆寫，預設為 `gpt-4.1-mini`。部署設定保存在託管平台的秘密環境變數中。公開訪客不會取得金鑰。

## 驗證

已實際呼叫 API，確認下一輪能回答前輪提到的「不想看恐怖片」偏好，並確認關鍵字與整理結果都能取得。另檢查非白名單來源 POST、錯誤輸入與文字輸出處理。

## 限制

- 沒有外部電影資料檢索，電影資訊需自行核對，不能保證即時上映或串流平台資訊。
- 對話最多八輪，原文整理最多 4,000 字。
- 單一 Worker 執行個體內設有每 IP 每分鐘八次的限制，這不構成分散式全域費用上限。
- AI 輸入會送至 OpenAI 處理；本展示不保存內容。

## 官方文件

[Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) · [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

## 程式碼授權

© 2026 Yunyu Hu。本儲存庫由 Yunyu Hu 持有著作權的原創程式碼依 [Apache License 2.0](LICENSE) 授權。第三方內容與服務適用各自的授權或使用條款。
