/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   監督の「変更申請の状況」と「相手チームの選手変更」
   - 受付票（ticket.html）・監督ポータル（portal.html）で使う
   - 変更申請：申請中 ⏳ ／ 許可 ✅（反映済み） ／ 却下 ❌（理由）
     結果が出たら色付きの枠で目立たせ、「わかりました」を押すまで残す（その端末に覚える）
   - 相手チームの選手変更（団体戦）：次の試合の欄に出す
   - 規約：ES5（var / function のみ）
   ============================================================ */
var CR_SEEN_KEY = 'iwateIndoorReqSeen:';

function crEsc(s) {
  return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function crSeen(token) { try { return JSON.parse(localStorage.getItem(CR_SEEN_KEY + String(token).slice(0, 40)) || '{}') || {}; } catch (e) { return {}; } }
function crSaveSeen(token, o) { try { localStorage.setItem(CR_SEEN_KEY + String(token).slice(0, 40), JSON.stringify(o)); } catch (e) {} }

/* 結果を見た（許可・却下の枠を普通の表示に戻す） */
function crAck(token, id, state) {
  var s = crSeen(token);
  s[id] = state;
  crSaveSeen(token, s);
  var el = document.getElementById('cr-' + id);
  if (el) { el.className = el.className.replace(/\s*cr-fresh/, ''); var b = el.querySelector('.cr-ok'); if (b) b.parentNode.removeChild(b); }
}

/* 中身の1行：例「第2マッチの選手　佐藤 一郎 → 鈴木 次郎」 */
function crWhat(r) {
  var t = crEsc(r.target || r.kind || '');
  if (r.from || r.to) t += '　' + crEsc(r.from || '—') + ' → <b>' + crEsc(r.to || '欠員') + '</b>';
  return t;
}

/* reqs：getTicket / portal の requests。opt：{ token, changeOpen, type（'team' か 'indiv'） } */
function crCardHtml(reqs, opt) {
  reqs = reqs || [];
  if (!reqs.length) return '';
  crStyle();
  var seen = crSeen(opt.token);
  var pending = 0;
  var h = '';
  var i, r, fresh, cls, st;
  for (i = 0; i < reqs.length; i++) {
    r = reqs[i];
    if (r.state === '申請中') pending++;
    fresh = r.state !== '申請中' && seen[r.id] !== r.state;
    cls = r.state === '許可' ? 'cr-ok-st' : r.state === '却下' ? 'cr-ng-st' : 'cr-wait-st';
    st = r.state === '許可' ? '✅ 許可・反映済み' + (r.decidedAt ? '（' + crEsc(r.decidedAt) + '）' : '')
      : r.state === '却下' ? '❌ 却下' + (r.decidedAt ? '（' + crEsc(r.decidedAt) + '）' : '')
      : '⏳ 申請中（競技委員長が確認中）';
    h += '<div class="cr-it ' + cls + (fresh ? ' cr-fresh' : '') + '" id="cr-' + crEsc(r.id) + '">' +
      (fresh ? '<div class="cr-new">結果が出ました</div>' : '') +
      '<div class="cr-st">' + st + '</div><div class="cr-what">' + crWhat(r) + '</div>' +
      (r.state === '却下' && r.comment ? '<div class="cr-why">理由：' + crEsc(r.comment) + '</div>' : '') +
      (r.state === '却下' && opt.changeOpen ? '<a class="cr-again" href="change.html?t=' + encodeURIComponent(opt.token) + '">もう一度申請する</a>' : '') +
      (r.state === '許可' ? '<div class="cr-note">' + (r.kind === '欠員報告' ? '提出済みのオーダーにこの選手が入っている場合は、オーダーを直してください。' : r.kind === '監督変更' ? '監督の氏名を変更しました。' : opt.type === 'team' ? '選手名簿と提出済みのオーダーの名前は、変更後になっています。' : 'ペアの選手は、変更後になっています（進行表・組合せにも反映）。') + '</div>' : '') +
      (fresh ? '<button type="button" class="cr-ok" onclick="crAck(\'' + crEsc(opt.token) + '\',\'' + crEsc(r.id) + '\',\'' + crEsc(r.state) + '\')">わかりました</button>' : '') +
      '</div>';
  }
  return '<div class="cr-card"><div class="cr-h">📝 変更申請の状況' + (pending ? '<span class="cr-pend">確認中 ' + pending + '件</span>' : '') + '</div>' + h +
    (pending ? '<div class="cr-foot">この画面は自動で更新されます。結果が出ると、ここに表示されます。</div>' : '') + '</div>';
}

function crPending(reqs) {
  var n = 0;
  var i;
  for (i = 0; i < (reqs || []).length; i++) if (reqs[i].state === '申請中') n++;
  return n;
}

/* 相手チームの選手変更（団体戦の次の試合の欄） */
function crOppHtml(list, oppName) {
  if (!list || !list.length) return '';
  crStyle();
  var h = '<div class="cr-opp"><div class="cr-opp-h">⚠ ' + crEsc(oppName) + 'は選手変更があります</div>';
  var i, c;
  for (i = 0; i < list.length; i++) {
    c = list[i];
    h += '<div class="cr-opp-it">' + crEsc(c.target) + '　' + crEsc(c.from || '') + ' → <b>' + crEsc(c.to || '') + '</b>' +
      (c.at ? '<small>（' + crEsc(c.at) + ' 許可）</small>' : '') + '</div>';
  }
  return h + '</div>';
}

function crStyle() {
  if (document.getElementById('crStyle')) return;
  var css = document.createElement('style');
  css.id = 'crStyle';
  css.textContent =
    '.cr-card{background:#fff;border-radius:14px;padding:14px;margin:0 0 14px;box-shadow:0 1px 6px rgba(0,0,0,.08);border:2px solid #e08a00;text-align:left}' +
    '.cr-h{font-weight:900;font-size:.95rem;color:#8a4b00;margin-bottom:8px}' +
    '.cr-pend{display:inline-block;margin-left:8px;padding:1px 10px;border-radius:10px;background:#fff3cd;color:#7a5d00;font-size:.78rem}' +
    '.cr-it{border-radius:10px;padding:10px 12px;margin-top:8px;font-size:.88rem;line-height:1.6}' +
    '.cr-wait-st{background:#fff8e6}.cr-ok-st{background:#e8f5ec}.cr-ng-st{background:#fdeaea}' +
    '.cr-st{font-weight:900}.cr-ok-st .cr-st{color:#1d6b33}.cr-ng-st .cr-st{color:#b33030}.cr-wait-st .cr-st{color:#7a5d00}' +
    '.cr-ft{display:block}.cr-why{color:#721c24;font-weight:700}.cr-note{font-size:.78rem;color:#1d5b2c}' +
    '.cr-fresh{border:3px solid #e08a00;animation:crPulse 1.4s ease-in-out 3}' +
    '.cr-new{display:inline-block;font-size:.72rem;font-weight:900;color:#fff;background:#e08a00;border-radius:8px;padding:1px 8px;margin-bottom:4px}' +
    '.cr-ok{display:block;width:100%;margin-top:8px;padding:10px;border:none;border-radius:10px;background:#28a745;color:#fff;font:900 .95rem "Noto Sans JP",sans-serif;cursor:pointer}' +
    '.cr-again{display:inline-block;margin-top:6px;padding:6px 14px;border-radius:10px;border:2px solid #e08a00;color:#8a4b00;font-weight:900;text-decoration:none;background:#fff}' +
    '.cr-foot{font-size:.75rem;color:#777;margin-top:8px}' +
    '.cr-opp{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff4e0;border:2px solid #e08a00;text-align:left;font-size:.86rem;line-height:1.6}' +
    '.cr-opp-h{font-weight:900;color:#8a4b00}.cr-opp-it small{color:#777;margin-left:4px}' +
    '@keyframes crPulse{0%,100%{box-shadow:0 0 0 0 rgba(224,138,0,0)}50%{box-shadow:0 0 0 6px rgba(224,138,0,.35)}}';
  document.head.appendChild(css);
}
