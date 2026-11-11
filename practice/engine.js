/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会　操作練習用エンジン
   - 本番と同じ GAS のプログラムを、ブラウザの中で動かす（通信先を差し替える）
   - データはこの端末のブラウザの中だけ（同じブラウザのタブどうしで共有）。本番のデータには一切触れない
   - メールは送らない（「送ったことにする」記録だけ残す）
   - 練習の時刻は、選んだ場面の時刻から実際の時間と同じ速さで進む
   - 規約：ES5（var / function のみ）
   ============================================================ */
(function () {
  /* IWP_NS：練習の種類ごとにデータを分ける（運営の練習＝''、監督の体験＝'coach'） */
  var NS = window.IWP_NS || '';
  var KEY = 'iwPractice.state.v1' + (NS ? '.' + NS : '');
  var GAS_RE = /^https:\/\/script\.google\.com\/macros\//;
  var LS = window.localStorage;
  var SP = window.Storage && Storage.prototype;
  var rawGetItem = SP.getItem, rawSetItem = SP.setItem, rawRemoveItem = SP.removeItem;
  var RD = Date;
  var realFetch = window.fetch ? window.fetch.bind(window) : null;

  function rawGet(k) { try { return rawGetItem.call(LS, k); } catch (e) { return null; } }
  function rawSet(k, v) { try { rawSetItem.call(LS, k, v); return true; } catch (e) { return false; } }

  /* ページが使う保存（パスワードの記憶など）は練習用の名前に分ける。本番の画面の保存と混ざらない */
  var PFX = 'iwPrac:' + (NS ? NS + ':' : '');
  SP.getItem = function (k) { return rawGetItem.call(this, PFX + k); };
  SP.setItem = function (k, v) { return rawSetItem.call(this, PFX + k, v); };
  SP.removeItem = function (k) { return rawRemoveItem.call(this, PFX + k); };

  var SCEN = window.IW_SCENARIOS || {};
  var GAS = window.IW_GAS_SRC || '';
  var DEFAULT_SCEN = window.IWP_DEFAULT || 'indiv-pre';

  /* ---------- 状態（場面のデータ・練習の時刻・送ったことにしたメール） ---------- */
  function fresh(id) {
    var s = SCEN[id] || SCEN[DEFAULT_SCEN];
    return { scen: s.id, sheets: JSON.parse(JSON.stringify(s.sheets)), base: s.clock, real: RD.now(), mails: [], startedAt: RD.now() };
  }

  function load() {
    var t = rawGet(KEY);
    var st = null;
    try { st = t ? JSON.parse(t) : null; } catch (e) { st = null; }
    if (!st || !st.sheets || !SCEN[st.scen]) { st = fresh(DEFAULT_SCEN); save(st); }
    return st;
  }

  function save(st) {
    if (!rawSet(KEY, JSON.stringify(st))) alert('練習データを保存できませんでした（ブラウザの保存領域がいっぱい、またはプライベートモードの可能性があります）。');
    rawSet(CLOCK, JSON.stringify({ base: st.base, real: st.real }));
  }

  /* ページ側の時計も練習の時刻にそろえる（画面に出る「現在」の時刻など） */
  var CLOCK = 'iwPractice.clock.v1' + (NS ? '.' + NS : '');
  function pageNow() {
    var c = null;
    try { c = JSON.parse(rawGet(CLOCK) || 'null'); } catch (e) { c = null; }
    if (!c) { var st = load(); c = { base: st.base, real: st.real }; }
    return c.base + (RD.now() - c.real);
  }
  var PageDate = function () {
    if (!(this instanceof PageDate)) return new RD(pageNow()).toString();
    if (!arguments.length) return new RD(pageNow());
    var a = [null].concat([].slice.call(arguments));
    return new (Function.prototype.bind.apply(RD, a))();
  };
  PageDate.now = pageNow;
  PageDate.UTC = RD.UTC;
  PageDate.parse = RD.parse;
  PageDate.prototype = RD.prototype;
  window.Date = PageDate;

  function nowMs(st) { return st.base + (RD.now() - st.real); }

  function hm(ms) {
    var d = new RD(ms + 9 * 3600e3);
    return d.getUTCHours() + ':' + ('0' + d.getUTCMinutes()).slice(-2);
  }

  /* ---------- Google のサービスの代わり ---------- */
  function makeSheet(name, data) {
    var s = { name: name, data: data, maxRows: 1000, maxCols: 26 };
    s.getName = function () { return name; };
    s.setName = function (n) { return s; };
    s.getLastRow = function () { return s.data.length; };
    s.getLastColumn = function () { var m = 0, i; for (i = 0; i < s.data.length; i++) m = Math.max(m, s.data[i].length); return m; };
    s.getMaxRows = function () { return s.maxRows; };
    s.getMaxColumns = function () { return s.maxCols; };
    s.setFrozenRows = function () { return s; };
    s.setColumnWidth = function () { return s; };
    s.appendRow = function (r) { s.data.push(r.slice()); return s; };
    s.deleteRow = function (i) { s.data.splice(i - 1, 1); return s; };
    s.getDataRange = function () { return s.getRange(1, 1, Math.max(s.data.length, 1), Math.max(s.getLastColumn(), 1)); };
    s.getRange = function (r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      var g = {};
      g.setNumberFormat = function () { return g; };
      g.setFontWeight = function () { return g; };
      g.setBackground = function () { return g; };
      g.getValues = function () {
        var out = [], i, j, row, v;
        for (i = 0; i < nr; i++) { row = []; for (j = 0; j < nc; j++) { v = (s.data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined || v === null ? '' : v); } out.push(row); }
        return out;
      };
      g.getDisplayValues = function () { return g.getValues().map(function (row) { return row.map(String); }); };
      g.setValues = function (v) {
        var i, j;
        for (i = 0; i < nr; i++) { while (s.data.length < r + i) s.data.push([]); for (j = 0; j < nc; j++) s.data[r - 1 + i][c - 1 + j] = v[i][j]; }
        return g;
      };
      g.setValue = function (v) { return g.setValues([[v]]); };
      g.clearContent = function () {
        var i, j, row;
        for (i = 0; i < nr; i++) { row = s.data[r - 1 + i]; if (row) for (j = 0; j < nc; j++) row[c - 1 + j] = ''; }
        s.data = s.data.filter(function (row, idx) { return idx === 0 || row.some(function (x) { return x !== ''; }); });
        return g;
      };
      return g;
    };
    return s;
  }

  function z(n) { return (n < 10 ? '0' : '') + n; }

  function services(st) {
    var sheets = {};
    var k;
    for (k in st.sheets) if (st.sheets.hasOwnProperty(k)) sheets[k] = makeSheet(k, st.sheets[k]);
    var ss = {
      getSheetByName: function (n) { return sheets[n] || null; },
      insertSheet: function (n) { sheets[n] = makeSheet(n, []); return sheets[n]; },
      getSheets: function () { var a = [], n; for (n in sheets) if (sheets.hasOwnProperty(n)) a.push(sheets[n]); return a; },
      deleteSheet: function (s) { delete sheets[s.name]; }
    };
    var FakeDate = function () {
      if (!arguments.length) return new RD(nowMs(st));
      var a = [null].concat([].slice.call(arguments));
      return new (Function.prototype.bind.apply(RD, a))();
    };
    FakeDate.now = function () { return nowMs(st); };
    FakeDate.UTC = RD.UTC;
    FakeDate.parse = RD.parse;
    FakeDate.prototype = RD.prototype;
    var noDrive = function () { throw new Error('練習版では、この機能（ファイルの作成・PDF）は使えません。'); };
    var svc = {
      SpreadsheetApp: { getActiveSpreadsheet: function () { return ss; } },
      Utilities: {
        formatDate: function (d, tz, pat) {
          var j = new RD(d.getTime() + 9 * 3600e3);
          var Y = j.getUTCFullYear(), M = j.getUTCMonth() + 1, D = j.getUTCDate(), h = j.getUTCHours(), mi = j.getUTCMinutes(), se = j.getUTCSeconds(), wd = j.getUTCDay();
          if (!pat || pat === 'yyyy-MM-dd HH:mm:ss') return Y + '-' + z(M) + '-' + z(D) + ' ' + z(h) + ':' + z(mi) + ':' + z(se);
          var map = { yyyy: Y, MM: z(M), dd: z(D), HH: z(h), mm: z(mi), ss: z(se), M: M, d: D, H: h, u: wd === 0 ? 7 : wd };
          return pat.replace(/yyyy|MM|dd|HH|mm|ss|M|d|H|u/g, function (t) { return map[t]; });
        },
        parseDate: function (s) {
          var m = String(s).match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)$/);
          if (!m) throw new Error('日付の形式が正しくありません');
          return new RD(RD.UTC(+m[1], m[2] - 1, +m[3], m[4] - 9, +m[5]));
        },
        getUuid: function () {
          if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
        },
        base64Encode: function () { return ''; },
        base64EncodeWebSafe: function (s) { return btoa(unescape(encodeURIComponent(String(s)))).replace(/\+/g, '-').replace(/\//g, '_'); },
        sleep: function () {}
      },
      LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {} }; } },
      CacheService: { getScriptCache: function () { var c = {}; return { get: function (k) { return c[k] || null; }, put: function (k, v) { c[k] = v; }, remove: function (k) { delete c[k]; } }; } },
      PropertiesService: { getScriptProperties: function () { var p = st.props || (st.props = {}); return { getProperty: function (k) { return p[k] || null; }, setProperty: function (k, v) { p[k] = String(v); } }; } },
      MailApp: {
        sendEmail: function (o) {
          if (typeof o !== 'object') o = { to: arguments[0], subject: arguments[1], body: arguments[2] };
          st.mails.unshift({ at: hm(nowMs(st)), to: o.to || '', subject: o.subject || '', body: o.body || '' });
          if (st.mails.length > 40) st.mails.length = 40;
        },
        getRemainingDailyQuota: function () { return 100; }
      },
      UrlFetchApp: { fetch: function () { throw new Error('練習版では、外部のシステムには接続しません。'); } },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: function (s) { return { setMimeType: function () { return { s: s }; } }; } },
      DriveApp: { getFileById: noDrive, getFolderById: noDrive, createFolder: noDrive, getFilesByName: function () { return { hasNext: function () { return false; } }; } },
      DocumentApp: { create: noDrive, HorizontalAlignment: {}, VerticalAlignment: {}, ElementType: {} },
      MimeType: { PDF: 'application/pdf' },
      Logger: { log: function () {} },
      Session: { getScriptTimeZone: function () { return 'Asia/Tokyo'; } },
      console: window.console,
      Date: FakeDate
    };
    return { svc: svc, sheets: sheets };
  }

  /* 練習用の差し替え：受付完了メール（領収書PDF）は作らず、「送ったことにする」記録だけ */
  var OVERRIDES = [
    'function sendReceptionMail_(entry, cfg) {',
    '  var t = table_(SHEET_ENTRY); var row = null; var i;',
    '  for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === entry.entryId) row = t.rows[i];',
    '  if (!row) return;',
    '  var no = ensureReceiptNo_(t, row);',
    '  MailApp.sendEmail({ to: row["申込者メール"], subject: "【練習】" + DIVISIONS[row["区分"]].name + " 受付完了・領収書（" + row["チーム名"] + "）",',
    '    body: "（練習のため、実際には送っていません）\\n本番では、申込責任者にこのメールと領収書PDFが届きます。\\n\\nチーム名：" + row["チーム名"] + "\\n参加料：" + toInt_(row["参加料"]).toLocaleString() + "円\\n領収書番号：" + no });',
    '  writeRow_(t, row, { "受付メール送信日時": now_() });',
    '}'
  ].join('\n');

  function call(kind, payload) {
    var st = load();
    var S = services(st);
    var names = [], vals = [], k;
    for (k in S.svc) if (S.svc.hasOwnProperty(k)) { names.push(k); vals.push(S.svc[k]); }
    var fn = Function.apply(null, names.concat([GAS + '\n' + OVERRIDES + '\nreturn { doGet: doGet, doPost: doPost };']));
    var api = fn.apply(null, vals);
    var out;
    if (kind === 'GET') out = api.doGet({ parameter: payload });
    else out = api.doPost({ postData: { contents: payload } });
    st.sheets = {};
    for (k in S.sheets) if (S.sheets.hasOwnProperty(k)) st.sheets[k] = S.sheets[k].data;
    save(st);
    return out.s;
  }

  function handle(url, opts) {
    var u = new URL(url, location.href);
    var text;
    try {
      if (opts && String(opts.method || 'GET').toUpperCase() === 'POST') {
        text = call('POST', typeof opts.body === 'string' ? opts.body : '');
      } else {
        var p = {};
        u.searchParams.forEach(function (v, key) { p[key] = v; });
        text = call('GET', p);
      }
    } catch (err) {
      text = JSON.stringify({ status: 'error', message: '練習版のエラー：' + err.message });
    }
    return text;
  }

  window.fetch = function (input, opts) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (GAS_RE.test(url)) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          var text = handle(url, opts);
          resolve(new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }, 150);
      });
    }
    return realFetch(input, opts);
  };

  /* ---------- 入口ページから使う操作 ---------- */
  window.IWP = {
    scenarios: SCEN,
    state: load,
    reset: function (id) { var st = fresh(id); save(st); return st; },
    setClock: function (h, m) {
      var st = load();
      var d = new RD(st.base + 9 * 3600e3);
      st.base = RD.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 9, m);
      st.real = RD.now();
      save(st);
      return st;
    },
    clock: function () { return hm(nowMs(load())); },
    nowMs: function () { return nowMs(load()); },
    setNowMs: function (ms) { var st = load(); st.base = ms; st.real = RD.now(); save(st); return st; },
    get: function (params) { return JSON.parse(call('GET', params)); },
    post: function (body) { return JSON.parse(call('POST', JSON.stringify(body))); }
  };

  /* ---------- 画面の上の「練習用」の帯 ---------- */
  function bar() {
    if (document.getElementById('iwpBar')) return;
    var css = document.createElement('style');
    css.textContent = '#iwpBar{background:#b3261e;color:#fff;font:700 13px/1.45 "Noto Sans JP",system-ui,sans-serif;padding:6px 12px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;justify-content:center;text-align:center;position:relative;z-index:200}' +
      '#iwpBar a{color:#fff;background:rgba(255,255,255,.2);border-radius:12px;padding:2px 10px;text-decoration:none;white-space:nowrap}' +
      '#iwpBar small{font-weight:500;opacity:.92}' +
      '@media print{#iwpBar{display:none!important}}';
    document.head.appendChild(css);
    var b = document.createElement('div');
    b.id = 'iwpBar';
    document.body.insertBefore(b, document.body.firstChild);
    var draw = function () {
      var st = load();
      var sc = SCEN[st.scen] || {};
      b.innerHTML = '<span>🧪 練習用（本番のデータではありません）</span><small>' + (sc.label || '') + '　練習の時刻 ' + hm(nowMs(st)) + '</small>' + (window.IWP_HUB ? '' : '<a href="index.html">練習の入口へ</a>');
    };
    draw();
    window.IWP.bar = draw;
    setInterval(draw, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar);
  else bar();
})();
