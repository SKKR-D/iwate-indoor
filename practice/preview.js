/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   プレビュー（非公開）：?preview=1 で開くと、保存済みの組合せ案で表示する
   - 組合せ表（bracket.html）・進行表（progress.html）・プログラム（program.html）で共用
   - 管理パスワードか組合せパスワードが必要（管理画面のプレビューボタンから開くと自動で入る）
   - 規約：ES5（var / function のみ）
   ============================================================ */
var PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
var PV_KEY = 'iwateIndoorPreviewPw';

function pvPw() {
  try { return localStorage.getItem(PV_KEY) || ''; } catch (e) { return ''; }
}

function pvParse(text) {
  var d;
  try { d = JSON.parse(text); } catch (e) { throw new Error('サーバーの応答を読み取れません'); }
  if (d.status !== 'ok') {
    if (d.code === 'auth') { try { localStorage.removeItem(PV_KEY); } catch (e) {} pvLogin('パスワードが違います。'); }
    throw new Error(d.message || 'エラー');
  }
  return d;
}

/* 公開時は GET（query）、プレビュー時は POST（body に action を入れる） */
function pvFetch(query, previewBody) {
  if (!PREVIEW) return fetch(GAS_URL + '?' + query).then(function (r) { return r.text(); }).then(pvParse);
  var pw = pvPw();
  if (!pw) { pvLogin(''); return Promise.reject(new Error('プレビューにはパスワードが必要です')); }
  var body = { pw: pw };
  var k;
  for (k in previewBody) if (previewBody.hasOwnProperty(k)) body[k] = previewBody[k];
  return fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
    .then(function (r) { return r.text(); }).then(pvParse);
}

function pvLogin(msg) {
  var box = document.getElementById('pvLogin');
  if (!box) return;
  box.hidden = false;
  document.getElementById('pvErr').textContent = msg || '';
}

if (PREVIEW) {
  document.addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent = '#pvBar{position:sticky;top:0;z-index:100;background:#7a1f1f;color:#fff;font:700 13px/1.5 "Noto Sans JP",sans-serif;padding:8px 14px;text-align:center}' +
      '#pvBar small{display:block;font-weight:500;opacity:.9}' +
      '#pvLogin{max-width:360px;margin:16px auto;background:#fff;border:2px solid #7a1f1f;border-radius:10px;padding:14px;font:14px "Noto Sans JP",sans-serif;color:#222}' +
      '#pvLogin input{width:100%;padding:10px;border:2px solid #ccc;border-radius:8px;font-size:1rem;margin:8px 0}' +
      '#pvLogin button{width:100%;padding:10px;border:none;border-radius:8px;background:#7a1f1f;color:#fff;font-weight:700;font-size:1rem}' +
      '#pvErr{color:#b33030;font-weight:700;margin-top:6px}' +
      '@media print{#pvBar,#pvLogin{display:none!important}}';
    document.head.appendChild(css);
    var bar = document.createElement('div');
    bar.id = 'pvBar';
    bar.innerHTML = '🔒 プレビュー（非公開）　保存済みの組合せ案で表示しています<small>組合せ係・競技委員長だけが見られます。公開は管理画面の「保存して進行表を作成」です。印刷すると、この帯は出ません。</small>';
    document.body.insertBefore(bar, document.body.firstChild);
    var login = document.createElement('form');
    login.id = 'pvLogin';
    login.hidden = true;
    login.innerHTML = '<b>プレビューのパスワード</b><div style="font-size:12px;color:#666">管理パスワードか組合せパスワードを入れてください。</div>' +
      '<input type="password" id="pvPwInput" autocomplete="current-password"><button type="submit">表示する</button><div id="pvErr"></div>';
    login.onsubmit = function (e) {
      e.preventDefault();
      try { localStorage.setItem(PV_KEY, document.getElementById('pvPwInput').value); } catch (err) {}
      location.reload();
    };
    bar.parentNode.insertBefore(login, bar.nextSibling);
    if (!pvPw()) pvLogin('');
  });
  /* ページ内のリンク（組合せ表・進行表・プログラムの行き来）もプレビューのまま開く */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || /^(https?:|mailto:|#)/.test(href) || href.indexOf('preview=') >= 0) return;
    if (!/^(bracket|progress|program|changes)\.html|^\?/.test(href)) return;
    a.setAttribute('href', href + (href.indexOf('?') >= 0 ? '&' : '?') + 'preview=1');
  }, true);
}
