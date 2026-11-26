// 公開頁面與 API 分開部署；本機未指定時沿用同源路徑。
const API_BASE = (document.querySelector('meta[name="api-base"]')?.content || '').replace(/\/+$/, '');
// Pages 尚未接妥後端時停止請求，避免把靜態站的錯誤頁當成 API 回應。
const API_READY = Boolean(API_BASE) || !location.hostname.endsWith('github.io');
const $ = id => document.getElementById(id);
const MAX_ROUNDS = 8;

/* 角色只決定介面上的招呼語與建議訊息；真正的角色設定在伺服器 */
const PERSONAS = {
  movie: {
    name: '小影', avatar: '影', desc: '電影推薦，會先追問你的口味',
    hello: '嗨，我是小影。最近想看什麼樣的電影？跟我說說心情、類型或最近喜歡的片，我幫你挑。',
    suggest: ['想看節奏慢、關於家庭的電影', '週末想放空，推薦輕鬆的喜劇', '有沒有像《你的名字》的動畫電影？', '換一部更冷門一點的'],
  },
  writing: {
    name: '小文', avatar: '文', desc: '幫你把句子改得更通順',
    hello: '嗨，我是小文。把想修改的句子或段落貼給我，也可以告訴我要更正式、更口語，還是更精簡。',
    suggest: ['幫我把這句改正式：我們這週會把東西弄完', '把這段縮短成一句話：', '這封信的語氣會不會太硬？', '再口語一點'],
  },
};
let mode = 'movie', history = [], chatController, processController;

function status(id, value, error = false) { $(id).textContent = value; $(id).classList.toggle('error', error); }
async function post(path, body, signal) {
  const response = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  let data; try { data = await response.json(); } catch { throw Error('暫時連不上回覆服務，請稍後再試。'); }
  if (!response.ok) throw Error(data.error || '暫時無法取得回覆。'); return data;
}

/* 對話泡泡 */
function bubble(role, text, extra = '') {
  const row = document.createElement('div'); row.className = `msg ${role} ${extra}`.trim();
  if (role === 'assistant') { const av = document.createElement('span'); av.className = `avatar a-${mode}`; av.textContent = PERSONAS[mode].avatar; av.setAttribute('aria-hidden', 'true'); row.append(av); }
  const b = document.createElement('div'); b.className = 'bubble';
  for (const para of text.split(/\n{2,}/)) { const p = document.createElement('p'); p.textContent = para; b.append(p); }
  row.append(b); return row;
}
function render(pending = false) {
  const box = $('history'); box.replaceChildren();
  box.append(bubble('assistant', PERSONAS[mode].hello, 'hello'));
  for (const m of history) box.append(bubble(m.role, m.content));
  if (pending) { const t = bubble('assistant', ''); t.querySelector('.bubble').innerHTML = '<span class="dots"><i></i><i></i><i></i></span>'; t.classList.add('typing'); box.append(t); }
  box.scrollTop = box.scrollHeight;
  const rounds = history.filter(m => m.role === 'user').length;
  $('round-text').textContent = `${rounds}/${MAX_ROUNDS}`;
  $('ring').style.strokeDashoffset = String(94.25 * (1 - rounds / MAX_ROUNDS));
  $('suggest').hidden = rounds >= MAX_ROUNDS;
}
function suggestions() {
  $('suggest').replaceChildren(...PERSONAS[mode].suggest.map(text => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    b.addEventListener('click', () => {
      if (text.endsWith('：')) { $('chat-input').value = text; $('chat-input').focus(); autosize(); }
      else { $('chat-input').value = text; sendChat(); }
    });
    return b;
  }));
}
function autosize() { const t = $('chat-input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }

function switchMode(next) {
  mode = next;
  for (const t of document.querySelectorAll('.thread')) t.setAttribute('aria-selected', String(t.dataset.mode === next));
  const isChat = next !== 'process';
  $('chat-view').hidden = !isChat; $('process-view').hidden = isChat;
  if (isChat) {
    $('head-avatar').textContent = PERSONAS[next].avatar; $('head-avatar').className = `avatar big a-${next}`;
    $('head-name').textContent = PERSONAS[next].name; $('head-desc').textContent = PERSONAS[next].desc;
    resetChat(); suggestions();
  }
}
function resetChat() {
  chatController?.abort(); chatController = null; history = []; $('chat-input').value = ''; autosize();
  $('chat-send').disabled = !API_READY; render(); status('chat-status', API_READY ? '' : '回覆服務設定中，請稍後再試。');
}
async function sendChat() {
  if (!API_READY) return;
  const message = $('chat-input').value.trim();
  if (!message) return status('chat-status', '先輸入一句話吧。', true);
  if (history.filter(m => m.role === 'user').length >= MAX_ROUNDS) return status('chat-status', '這段對話已經 8 輪了，按右上角的＋開始新對話。', true);
  const current = new AbortController(); chatController = current; $('chat-send').disabled = true;
  const messages = [...history, { role: 'user', content: message }];
  history = messages; $('chat-input').value = ''; autosize(); status('chat-status', ''); render(true);
  try {
    const data = await post('/api/chat', { role: mode, messages }, current.signal);
    if (chatController !== current) return;
    history = [...messages, { role: 'assistant', content: data.answer }]; render();
  } catch (error) {
    if (error.name === 'AbortError') return;
    history = messages.slice(0, -1); $('chat-input').value = message; autosize(); render();
    $('history').append(bubble('system', `沒有送出：${error.message}`)); status('chat-status', '訊息還在輸入框裡，可以再送一次。', true);
  } finally { if (chatController === current) { chatController = null; $('chat-send').disabled = false; } }
}

/* 重點整理 */
function countText() { $('count').textContent = `${$('process-input').value.length.toLocaleString()} / 4,000 字`; }
function resetProcess() {
  processController?.abort(); processController = null; $('process-input').value = ''; countText(); $('process-send').disabled = !API_READY;
  $('step-1').dataset.state = 'idle'; $('step-2').dataset.state = 'idle'; $('ratio').hidden = true;
  $('keywords').innerHTML = '<span class="placeholder">關鍵字會一個一個出現在這裡</span>';
  $('summary').innerHTML = '<span class="placeholder">整理好的短文會出現在這裡</span>';
  status('process-status', API_READY ? '' : '回覆服務設定中，請稍後再試。');
}
function showKeywords(text) {
  const words = text.split(/[、,，\n]+/).map(w => w.replace(/^[\s\d.、*-]+/, '').trim()).filter(Boolean).slice(0, 8);
  $('keywords').replaceChildren(...words.map((w, i) => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = w; c.style.animationDelay = `${i * 90}ms`; return c; }));
}
function showSummary(text, original) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const box = $('summary'); box.replaceChildren();
  lines.forEach((line, i) => {
    const clean = line.replace(/^#+\s*|^\*\*|\*\*$/g, '').replace(/^標題[：:]\s*/, '');
    const el = document.createElement(i === 0 && clean.length <= 30 ? 'h2' : 'p'); el.textContent = clean; box.append(el);
  });
  const before = original.length, after = text.replace(/\s/g, '').length;
  const shorter = after < before;
  $('ratio').querySelector('.ratio-bar').hidden = !shorter;
  $('ratio-new').style.width = `${after / before * 100}%`;
  $('ratio-text').textContent = shorter
    ? `原文 ${before.toLocaleString()} 字 → 整理後約 ${after.toLocaleString()} 字，縮短 ${Math.round((1 - after / before) * 100)}%`
    : `原文 ${before.toLocaleString()} 字，整理成有標題的短文後約 ${after.toLocaleString()} 字（原文較短時，結構化後可能變長）`;
  $('ratio').hidden = false;
}
async function processText() {
  if (!API_READY) return;
  const input = $('process-input').value.trim(); if (!input) return status('process-status', '先貼上一段文字，或按「填入範例」。', true);
  const current = new AbortController(); processController = current; $('process-send').disabled = true;
  $('step-1').dataset.state = 'working'; $('step-2').dataset.state = 'waiting'; $('ratio').hidden = true;
  $('keywords').innerHTML = '<span class="placeholder">正在讀原文…</span>'; $('summary').innerHTML = '<span class="placeholder">等關鍵字抓好後開始</span>';
  status('process-status', '兩個步驟依序進行，大約需要 10～20 秒。');
  // 兩個步驟在同一次請求裡完成；過幾秒先把第二步標成進行中，讓等待有進度感
  const nudge = setTimeout(() => { if (processController === current) $('step-2').dataset.state = 'working'; }, 4500);
  try {
    const data = await post('/api/process', { text: input }, current.signal); if (processController !== current) return;
    showKeywords(data.keywords); $('step-1').dataset.state = 'done';
    showSummary(data.summary, input); $('step-2').dataset.state = 'done'; status('process-status', '完成了。請對照原文確認意思沒有跑掉。');
  } catch (error) {
    if (error.name !== 'AbortError') { $('step-1').dataset.state = 'error'; $('step-2').dataset.state = 'idle'; $('keywords').innerHTML = '<span class="placeholder">這次沒有完成</span>'; status('process-status', error.message, true); }
  } finally { clearTimeout(nudge); if (processController === current) { processController = null; $('process-send').disabled = false; } }
}

for (const t of document.querySelectorAll('.thread')) {
  t.addEventListener('click', () => switchMode(t.dataset.mode));
  t.addEventListener('keydown', e => {
    if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault();
    const list = [...document.querySelectorAll('.thread')], next = list[(list.indexOf(t) + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length];
    next.focus(); switchMode(next.dataset.mode);
  });
}
$('chat-form').addEventListener('submit', e => { e.preventDefault(); sendChat(); });
$('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); } });
$('chat-input').addEventListener('input', autosize);
$('chat-clear').addEventListener('click', resetChat);
$('process-send').addEventListener('click', processText); $('process-clear').addEventListener('click', resetProcess);
$('process-input').addEventListener('input', countText);
$('process-example').addEventListener('click', () => { $('process-input').value = '我們這次訪談五位學生，發現大家常在三個不同頁面之間查詢課程資訊。有兩位表示找不到退選日期，另外三位希望先看到衝堂提醒。團隊決定先整理課程資訊架構，再用互動原型測試選課與退選流程。下次會議要確認測試任務與招募方式。'; countText(); });
switchMode('movie'); resetProcess();
