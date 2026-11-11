/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   監督へのお知らせ（団体戦のオーダーだけ・画面を開いている間）
   - 監督ポータル（団体戦）で使う
   - 出すのは 2 つだけ：①次の対戦相手とオーダーの締切が決まったとき ②締切の5分前（まだ出していないとき）
   - 試合のコール・審判・表彰は会場の放送で知らせる（ここでは出さない）
   - 画面に大きく出し、「確認しました」を押すまで残す。音は「音も鳴らす」を選んだ端末だけ、出たときに1回
     （音・振動は端末やマナーモードで鳴らないことがあるので、約束はしない）
   - 確認したお知らせは、その端末に覚えて二度は出さない
   - 画面を閉じている間は届かない（スマホをつけっぱなしにする必要はない。締切は放送でも伝える）
   - 規約：ES5（var / function のみ）
   ============================================================ */
var CA = { scope: '', on: false, queue: [], cur: null, ctx: null, flash: null, title: '' };
var CA_ON_KEY = 'iwateIndoorAlertOn';

function caGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
function caSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function caSeen() { try { return JSON.parse(caGet('iwateIndoorAlertSeen:' + CA.scope, '{}')) || {}; } catch (e) { return {}; } }
function caMarkSeen(id) { var s = caSeen(); s[id] = 1; caSet('iwateIndoorAlertSeen:' + CA.scope, JSON.stringify(s)); }

/* scope：監督ごと（受付票のリンクの記号）に、確認済みのお知らせを分けて覚える */
function caScope(token) {
  CA.scope = String(token || '').slice(0, 40);
  CA.on = caGet(CA_ON_KEY, '') === '1';
  if (!CA.title) CA.title = document.title;
  caStyle();
}

/* 画面の上に出す、お知らせの説明（小さく） */
function caBoxHtml() {
  return '<div class="ca-box"><b>📣 オーダーのお知らせ</b>　次の対戦相手と締切が決まったとき・締切5分前に、<b>この画面</b>に大きく出します（開いているときだけ）。' +
    '試合のコール・審判・表彰は<b>会場の放送</b>でお知らせします。' +
    (CA.on
      ? '<span class="ca-snd">🔔 音：オン <button type="button" class="ca-mini" onclick="caTest()">音を試す</button> <button type="button" class="ca-mini" onclick="caSound(false)">音を消す</button></span>'
      : '<span class="ca-snd"><button type="button" class="ca-mini" onclick="caSound(true)">🔔 音も鳴らす</button><small>（マナーモードでは鳴らないことがあります）</small></span>') +
    '</div>';
}

function caSound(on) {
  CA.on = !!on;
  caSet(CA_ON_KEY, on ? '1' : '');
  if (on) { caAudio(); caBeep(); }
  var b = document.getElementById('caBox');
  if (b) b.innerHTML = caBoxHtml();
}
/* 以前の画面との互換 */
function caEnable() { caSound(true); }

function caTest() { caAudio(); caBeep(); }

function caAudio() {
  try {
    if (!CA.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) CA.ctx = new AC(); }
    if (CA.ctx && CA.ctx.state === 'suspended') CA.ctx.resume();
  } catch (e) {}
}

/* ピッ・ピッ・ピッ */
function caBeep() {
  if (!CA.ctx) return;
  try {
    var t0 = CA.ctx.currentTime;
    var k, o, g;
    for (k = 0; k < 3; k++) {
      o = CA.ctx.createOscillator();
      g = CA.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 988;
      g.gain.setValueAtTime(0.0001, t0 + k * 0.28);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + k * 0.28 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.28 + 0.2);
      o.connect(g);
      g.connect(CA.ctx.destination);
      o.start(t0 + k * 0.28);
      o.stop(t0 + k * 0.28 + 0.22);
    }
  } catch (e) {}
}

/* events：[{ id, title, text, kind }]。まだ確認していないものを順に出す */
function caCheck(events) {
  var seen = caSeen();
  var i, e, j, dup;
  for (i = 0; i < events.length; i++) {
    e = events[i];
    if (seen[e.id]) continue;
    if (CA.cur && CA.cur.id === e.id) continue;
    dup = false;
    for (j = 0; j < CA.queue.length; j++) if (CA.queue[j].id === e.id) dup = true;
    if (!dup) CA.queue.push(e);
  }
  if (!CA.cur) caNext();
}

function caNext() {
  CA.cur = CA.queue.shift() || null;
  var ov = document.getElementById('caOverlay');
  if (!CA.cur) {
    if (ov) ov.parentNode.removeChild(ov);
    caStop();
    return;
  }
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'caOverlay';
    document.body.appendChild(ov);
  }
  var c = CA.cur;
  ov.className = 'ca-ov ca-' + (c.kind || 'info');
  ov.innerHTML = '<div class="ca-card" role="alertdialog" aria-live="assertive"><div class="ca-badge">📣 お知らせ' + (CA.queue.length ? '（ほかに' + CA.queue.length + '件）' : '') + '</div>' +
    '<div class="ca-ttl">' + caEsc(c.title) + '</div>' + (c.text ? '<div class="ca-body">' + caEsc(c.text).replace(/\n/g, '<br>') + '</div>' : '') +
    '<button type="button" class="ca-ok" onclick="caAck()">確認しました</button></div>';
  if (CA.on) { caAudio(); caBeep(); }
  if (CA.flash) clearInterval(CA.flash);
  var f = false;
  CA.flash = setInterval(function () { f = !f; document.title = f ? '【お知らせ】' + c.title : CA.title; }, 1200);
}

function caStop() {
  if (CA.flash) clearInterval(CA.flash);
  CA.flash = null;
  if (CA.title) document.title = CA.title;
}

function caAck() {
  if (CA.cur) caMarkSeen(CA.cur.id);
  caNext();
}

function caEsc(s) {
  return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function caStyle() {
  if (document.getElementById('caStyle')) return;
  var css = document.createElement('style');
  css.id = 'caStyle';
  css.textContent =
    '.ca-box{margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:.8rem;line-height:1.6;background:#f3f6fb;border:1.5px solid #c9d6ea;color:#2a3a55}' +
    '.ca-snd{display:block;margin-top:4px}.ca-snd small{margin-left:4px;color:#667}' +
    '.ca-mini{padding:3px 10px;border:1.5px solid #3a6fb0;border-radius:12px;background:#fff;color:#234a7a;font:700 .76rem "Noto Sans JP",sans-serif;cursor:pointer}' +
    '.ca-ov{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.ca-card{width:100%;max-width:420px;background:#fff;border-radius:18px;padding:20px 18px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.35);border-top:10px solid #e08a00;animation:caPop .25s ease-out}' +
    '.ca-call .ca-card{border-top-color:#c0392b}' +
    '.ca-badge{display:inline-block;font-size:.78rem;font-weight:900;color:#fff;background:#333;border-radius:10px;padding:2px 12px;margin-bottom:10px}' +
    '.ca-ttl{font-size:1.3rem;font-weight:900;line-height:1.45;color:#222}' +
    '.ca-body{font-size:1rem;line-height:1.6;color:#333;margin-top:8px}' +
    '.ca-ok{display:block;width:100%;margin-top:16px;padding:16px;border:none;border-radius:12px;background:#28a745;color:#fff;font:900 1.15rem "Noto Sans JP",sans-serif;cursor:pointer}' +
    '@keyframes caPop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}' +
    '@media print{.ca-box,.ca-ov{display:none!important}}';
  document.head.appendChild(css);
}

/* 一度タップすれば音が鳴るようにする */
document.addEventListener('click', function () { if (CA.on) caAudio(); }, true);

/* ===== お知らせの中身 ===== */

/* 監督ポータル（団体戦）：D＝portalData の応答。オーダーの2つだけ */
function caEventsPortal(D) {
  var ev = [];
  var m = D.match;
  var nowMin = caMin(D.now);
  if (m && D.reception && m.oppDecided && !m.myOrder && D.view === 'order') {
    ev.push({ id: 'order:' + m.id, kind: 'info', title: '第' + m.no + '試合（' + m.round + '）のオーダーを出してください',
      text: '対戦相手：' + ((m.opp && (m.opp.full || m.opp.label)) || '') + '\nオーダーの締切：' + (m.deadline || '-') + '（' + (m.court || '') + '）' });
    var left = caMin(m.deadline) - nowMin;
    if (m.deadline && left <= 5 && left >= 0) ev.push({ id: 'dl5:' + m.id, kind: 'call', title: 'オーダーの締切まで、あと' + left + '分です', text: '第' + m.no + '試合（' + m.round + '）のオーダーがまだ提出されていません。締切：' + m.deadline });
  }
  return ev;
}

/* 受付票（個人戦）：お知らせは出さない（コール・審判・表彰は放送）。古い画面のために残す */
function caEventsTicket(d) { return []; }

function caMin(hm) { var m = String(hm || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; }
