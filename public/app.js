// 公開頁面與 API 分開部署；本機未指定時沿用同源路徑。
const API_BASE = (document.querySelector('meta[name="api-base"]')?.content || '').replace(/\/+$/, '');
// Pages 尚未接妥後端時停止請求，避免把靜態站的錯誤頁當成 API 回應。
const API_READY = Boolean(API_BASE) || !location.hostname.endsWith('github.io');
/* 對話狀態僅存於當前頁面；重設與切換角色會取消請求並清除歷史。 */
const $ = id => document.getElementById(id);
let history = [], chatController, processController;

function status(id, value, error = false) { $(id).textContent = value; $(id).classList.toggle('error', error); }
async function post(path, body, signal) {
  const response = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  let data; try { data = await response.json(); } catch { throw Error('暫時無法連上回覆服務，請稍後再試。'); } if (!response.ok) throw Error(data.error || '暫時無法取得回覆。'); return data;
}
function render() {
  $('history').replaceChildren();
  if (!history.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '送出第一則訊息，看看助手如何回應。'; $('history').append(empty); }
  for (const message of history) {
    const node = document.createElement('div'); node.className = 'message ' + message.role;
    const label = document.createElement('div'); label.className = 'message-label'; label.textContent = message.role === 'user' ? '你' : '助手';
    const content = document.createElement('div'); content.textContent = message.content;
    node.append(label, content); $('history').append(node);
  }
  $('history').scrollTop = $('history').scrollHeight;
}
function resetChat() {
  chatController?.abort(); chatController = null; history = []; $('chat-input').value = ''; $('chat-send').disabled = false; render();
  status('chat-status', '可以連續追問，最多八輪。');
}
async function sendChat() {
  if (!API_READY) return status('chat-status', '即時回覆服務設定中，請稍後再試。');
  const message = $('chat-input').value.trim();
  if (!message) return status('chat-status', '請先輸入訊息。', true);
  if (history.length >= 16) return status('chat-status', '已達八輪展示長度，請開始新的對話。', true);
  const current = new AbortController(); chatController = current; $('chat-send').disabled = true;
  status('chat-status', '助手正在回覆…');
  const messages = [...history, { role: 'user', content: message }];
  try {
    const data = await post('/api/chat', { role: $('role').value, messages }, current.signal);
    if (chatController !== current) return;
    history = [...messages, { role: 'assistant', content: data.answer }]; $('chat-input').value = ''; render();
    status('chat-status', `已完成 ${history.length / 2} 輪，可以繼續追問。`);
  } catch (error) { if (error.name !== 'AbortError') status('chat-status', error.message, true); }
  finally { if (chatController === current) { $('chat-send').disabled = false; chatController = null; } }
}
function resetProcess() {
  processController?.abort(); processController = null; $('process-input').value = ''; $('process-send').disabled = false;
  $('keywords').textContent = '關鍵字會顯示在這裡。'; $('summary').textContent = '整理結果會顯示在這裡。';
  status('process-status', '最多 4,000 字；將依序進行兩次 AI 處理。');
}
async function processText() {
  if (!API_READY) return status('process-status', '即時回覆服務設定中，請稍後再試。');
  const input = $('process-input').value.trim(); if (!input) return status('process-status', '請先貼上文字。', true);
  const current = new AbortController(); processController = current; $('process-send').disabled = true;
  $('keywords').textContent = '正在擷取關鍵字…'; $('summary').textContent = '等待第一階段完成。'; status('process-status', '正在依序處理，請稍候。');
  try {
    const data = await post('/api/process', { text: input }, current.signal); if (processController !== current) return;
    $('keywords').textContent = data.keywords; $('summary').textContent = data.summary; status('process-status', '兩階段處理完成。請核對結果是否保留原意。');
  } catch (error) {
    if (error.name !== 'AbortError') { $('keywords').textContent = '這次未完成處理。'; $('summary').textContent = '請稍後再試。'; status('process-status', error.message, true); }
  } finally { if (processController === current) { processController = null; $('process-send').disabled = false; } }
}

// 頁籤支援鍵盤左右切換，避免只允許滑鼠操作。
function tab(name) {
  for (const mode of ['chat', 'process']) { const active = mode === name; $(mode + '-tab').setAttribute('aria-selected', String(active)); $(mode + '-tab').tabIndex = active ? 0 : -1; $(mode + '-view').hidden = !active; }
}
for (const name of ['chat', 'process']) {
  $(name + '-tab').addEventListener('click', () => tab(name));
  $(name + '-tab').addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const other = name === 'chat' ? 'process' : 'chat'; tab(other); $(other + '-tab').focus(); } });
}
$('chat-send').addEventListener('click', sendChat); $('chat-clear').addEventListener('click', resetChat); $('role').addEventListener('change', resetChat);
$('process-send').addEventListener('click', processText); $('process-clear').addEventListener('click', resetProcess);
$('chat-example').addEventListener('click', () => { $('role').value = 'movie'; resetChat(); $('chat-input').value = '我想看節奏慢、關於家庭關係的電影，可以推薦兩部並說明理由嗎？'; });
$('process-example').addEventListener('click', () => { $('process-input').value = '我們這次訪談五位學生，發現大家常在三個不同頁面之間查詢課程資訊。有兩位表示找不到退選日期，另外三位希望先看到衝堂提醒。團隊決定先整理課程資訊架構，再用互動原型測試選課與退選流程。下次會議要確認測試任務與招募方式。'; });

if (!API_READY) {
  $('chat-send').disabled = true; $('process-send').disabled = true;
  status('chat-status', '即時回覆服務設定中，請稍後再試。');
  status('process-status', '即時回覆服務設定中，請稍後再試。');
}
