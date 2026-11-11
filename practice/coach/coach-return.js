/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   監督の「戻る」ボタン
   - 受付票（ticket.html）・監督ポータル（portal.html）を開いたとき、この端末に戻り先を覚える
     （団体戦＝監督ポータル、個人戦＝受付票。覚えるのはその日の終わりまで）
   - 進行表・組合せ・選手変更一覧（<body data-coach-return="show">）では、覚えている端末にだけ
     画面の下に「← 監督ポータルに戻る」ボタンを出す
   - 戻り先は URL に入れない（進行表の URL を共有しても、監督用のリンクは広まらない）
   - 規約：ES5（var / function のみ）
   ============================================================ */
var COACH_RETURN_KEY = 'iwateIndoorCoachReturn';

/* 受付票・監督ポータルから呼ぶ：type は 'team' か 'indiv' */
function coachReturnSave(token, type, team) {
  if (!token) return;
  var now = new Date();
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
  var o = { t: token, type: type, team: team || '', exp: end };
  try { localStorage.setItem(COACH_RETURN_KEY, JSON.stringify(o)); } catch (e) {}
}

function coachReturnGet() {
  var o = null;
  try { o = JSON.parse(localStorage.getItem(COACH_RETURN_KEY) || 'null'); } catch (e) { o = null; }
  if (!o || !o.t) return null;
  if (o.exp && new Date().getTime() > o.exp) {
    try { localStorage.removeItem(COACH_RETURN_KEY); } catch (e) {}
    return null;
  }
  return o;
}

function coachReturnButton() {
  if (!document.body || document.body.getAttribute('data-coach-return') !== 'show') return;
  if (document.getElementById('coachReturn')) return;
  var o = coachReturnGet();
  if (!o) return;
  var team = o.type === 'team';
  var css = document.createElement('style');
  css.textContent = '#coachReturn{position:fixed;left:0;right:0;bottom:0;z-index:150;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);box-shadow:0 -2px 12px rgba(0,0,0,.15)}' +
    '#coachReturn a{display:block;max-width:560px;margin:0 auto;text-align:center;padding:14px;border-radius:12px;background:#28a745;color:#fff;font:900 1rem/1.3 "Noto Sans JP",sans-serif;text-decoration:none}' +
    '#coachReturn small{display:block;font-weight:500;font-size:.72rem;opacity:.9;margin-top:2px}' +
    'body.has-coach-return{padding-bottom:90px}' +
    '@media print{#coachReturn{display:none!important}body.has-coach-return{padding-bottom:0}}';
  document.head.appendChild(css);
  var div = document.createElement('div');
  div.id = 'coachReturn';
  div.innerHTML = '<a href="' + (team ? 'portal.html' : 'ticket.html') + '?t=' + encodeURIComponent(o.t) + '">← ' + (team ? '監督ポータル' : '受付票') + 'に戻る' +
    (o.team ? '<small>' + String(o.team).replace(/[&<>"]/g, '') + '</small>' : '') + '</a>';
  document.body.appendChild(div);
  document.body.className += ' has-coach-return';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', coachReturnButton);
else coachReturnButton();
