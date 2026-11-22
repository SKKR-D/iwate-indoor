/* ============================================================
   組合せ・結果のExcel出力（管理画面の「Excelで保存」）
   - 押した時点の最新のデータで作る（公開前は保存した組合せ案、公開後は結果入り）
   - これまでの組合せ表の形のひな形（doc/tpl-kumiawase.xlsx）に書き込む
   - シート：個人戦（男子が上・女子が下）の「組合せ」「結果」、団体戦の組合せ（男女１枚）、
     男子団体・女子団体の「結果」、団体戦の「選手名簿」。選手５名以下のチームは番号を○で囲む
   - ExcelJS（cdn.jsdelivr.net）を押したときに読み込む
   - 規約：ES5（var / function のみ）
   ============================================================ */
var XL_LIB = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
var XL_FONT = 'BIZ UDPゴシック';
var XL_RED = 'FFC00000';
var XL_CIRC = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯'];
var XL_ZEN = { A: 'Ａ', B: 'Ｂ', C: 'Ｃ', D: 'Ｄ' };

function xlLoadLib() {
  if (window.ExcelJS) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = XL_LIB;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Excelを作る部品を読み込めませんでした。インターネットにつながっているか確かめてください。')); };
    document.head.appendChild(s);
  });
}

/* 氏名の４文字そろえ（GASの fmt4Name_ と同じ決まり） */
function xlName(s) {
  var t = String(s || '').replace(/^[\s　]+|[\s　]+$/g, '');
  var parts = t.split(/[\s　]+/);
  if (parts.length < 2) return t;
  var sei = parts[0], mei = parts.slice(1).join('');
  var len = function (x) { return x.replace(/[︀-️]|\uDB40[\uDD00-\uDDEF]/g, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length; };
  var n = len(sei) + len(mei);
  if (n >= 4) return sei + mei;
  return sei + new Array(4 - n + 1).join('　') + mei;
}

function xlScore(m) {
  if (!m || m.state !== '終了' || m.note === '不戦勝') return null;
  var s = String(m.score || '');
  if (s === '不戦勝' && (m.winner === 'L' || m.winner === 'R')) s = m.winner === 'L' ? '4-R' : 'R-4';
  var sc = s.match(/(\d+|R)\s*-\s*(\d+|R)/);
  if (!sc) return null;
  return [sc[1], sc[2]];
}
function xlWon(m, side) { return !!(m && m.state === '終了' && m.winner === side); }
function xlDone(m) { return !!(m && m.state === '終了' && m.winner); }
function xlById(d) { var o = {}, i; for (i = 0; i < d.matches.length; i++) o[d.matches[i].id] = d.matches[i]; return o; }

/* データを集める：区分ごとに結果入り（adminCtlLoad）、まだ公開前なら保存した組合せ案（adminPreview） */
function xlGather(apiFn) {
  var codes = ['MI', 'WI', 'MT', 'WT'];
  var out = { divs: {}, program: null };
  var chain = Promise.resolve();
  codes.forEach(function (code) {
    chain = chain.then(function () {
      return apiFn({ action: 'adminCtlLoad', div: code }).catch(function () { return { matches: [] }; }).then(function (d) {
        if (d && d.matches && d.matches.length) { d.published = true; return d; }
        return apiFn({ action: 'adminPreview', div: code }).then(function (p) { p.published = false; return p; });
      }).then(function (d) { out.divs[code] = d; });
    });
  });
  return chain.then(function () {
    return apiFn({ action: 'adminPreviewProgram' }).then(function (p) { out.program = p; }).catch(function () { out.program = null; });
  }).then(function () { return out; });
}

/* ---------- セルの書き方 ---------- */
function xlCell(ws, r, c, v, o) {
  o = o || {};
  var cell = ws.getCell(r, c);
  if (v !== undefined && v !== null) cell.value = v;
  cell.font = { name: XL_FONT, size: o.size || 10, bold: !!o.bold, color: o.color ? { argb: o.color } : undefined };
  cell.alignment = { horizontal: o.h || 'left', vertical: o.v || 'middle', wrapText: !!o.wrap, shrinkToFit: !!o.shrink };
  if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
  return cell;
}
function xlBorder(ws, r, c, side, red, thick) {
  var cell = ws.getCell(r, c);
  var b = {};
  var k;
  var cur = cell.border || {};
  for (k in cur) if (cur.hasOwnProperty(k)) b[k] = cur[k];
  b[side] = { style: red || thick ? 'medium' : 'thin', color: { argb: red ? XL_RED : 'FF222222' } };
  cell.border = b;
}
function xlBox(ws, r1, c1, r2, c2) {
  var r, c;
  for (r = r1; r <= r2; r++) for (c = c1; c <= c2; c++) {
    xlBorder(ws, r, c, 'top'); xlBorder(ws, r, c, 'bottom'); xlBorder(ws, r, c, 'left'); xlBorder(ws, r, c, 'right');
  }
}
function xlTitle(ws, d, kind, lastCol) {
  ws.mergeCells(1, 1, 1, lastCol);
  xlCell(ws, 1, 1, xlHead(d) + '　' + kind, { size: 14, bold: true, h: 'center' });
  ws.mergeCells(2, 1, 2, lastCol);
  xlCell(ws, 2, 1, '期日：' + (d.date || '') + '　場所：' + (d.venue || ''), { size: 10, h: 'right' });
  ws.getRow(1).height = 24;
}
function xlSheet(wb, name, landscape, onePage) {
  return wb.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: onePage ? 1 : 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }]
  });
}

/* 選手５名以下のチーム（番号を○で囲む） */
function xlFewMap(prog, code) {
  var map = {};
  var ts = prog && prog.teams && prog.teams[code] ? prog.teams[code] : [];
  var i, j, n;
  for (i = 0; i < ts.length; i++) {
    n = 0;
    for (j = 0; j < (ts[i].players || []).length; j++) if (ts[i].players[j] && !ts[i].players[j].vacant && ts[i].players[j].name) n++;
    map[ts[i].id] = n > 0 && n <= 5;
  }
  return map;
}

/* ============================================================
   ひな形（これまでの組合せ表の形）に書き込む
   doc/tpl-kumiawase.xlsx：個人戦（男子が上・女子が下）、男子団体・女子団体（各「組合せ」「結果」）
   ============================================================ */
var XL_TPL = (location.pathname.indexOf('/practice/') >= 0 ? '../' : '') + 'doc/tpl-kumiawase.xlsx';
var XL_TRED = 'FFFF0000';
var XL_SUR3 = ['佐々木', '小野寺', '小笠原', '長谷川', '五十嵐', '宇都宮', '佐久間', '小田島', '髙屋敷', '高屋敷', '小保内', '和蛇田', '安久津', '二川原', '民部田', '上岡谷', '向屋敷', '荒木関', '髙清水', '高清水', '田ノ岡', '佐々野', '久保田', '大久保'];

/* 表題：令和８年度　第40回岩手県中学校インドアソフトテニス大会　男子個人戦 */
function xlHead(d) {
  var t = d.tournament || '';
  var y = String(d.date || '').match(/令和\s*([0-9０-９]+)\s*年/);
  if (y && t.indexOf('年度') < 0) {
    var n = y[1].replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    t = '令和' + (n.length === 1 ? String.fromCharCode(n.charCodeAt(0) + 0xFEE0) : n) + '年度　' + t;
  }
  return t + '　' + d.division.name;
}
function xlChars(s) { return String(s || '').match(/[\uD800-\uDBFF][\uDC00-\uDFFF](?:\uDB40[\uDD00-\uDDEF])?|[\s\S](?:\uDB40[\uDD00-\uDDEF]|[︀-️])?/g) || []; }
/* 名簿の書き方：字と字の間をあける（佐　藤　悠　生／満　点　　　丸／小笠原　悠　真） */
function xlSpaced(name) {
  var ch = xlChars(xlName(name));
  if (ch.length <= 4) return ch.join('　');
  var first3 = ch.slice(0, 3).join('');
  if (ch.length === 5) return XL_SUR3.indexOf(first3) >= 0 ? first3 + '　' + ch[3] + '　' + ch[4] : ch[0] + '　' + ch[1] + '　' + ch.slice(2).join('');
  return first3 + '　' + ch.slice(3).join('');
}
function xlGrade(g) { var n = parseInt(String(g || '').replace(/[^0-9０-９]/g, '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }), 10); return n >= 1 && n <= 9 ? XL_CIRC[n] : ''; }
/* 勝った側の数字は丸数字 */
function xlNum(v, win) { if (v === null || v === undefined || v === '') return ''; if (v === 'R') return 'R'; var n = parseInt(v, 10); return win && n >= 1 && n <= 16 ? XL_CIRC[n] : n; }

function xlSet(ws, r, c, v) { ws.getCell(r, c).value = (v === undefined ? null : v); }
/* 読み込んだひな形では、同じ書式のセルが書式を共有しているので、変える前に自分の分を作る */
function xlOwn(cell) { cell.style = JSON.parse(JSON.stringify(cell.style || {})); return cell; }
function xlFont(ws, r, c, size, extra) {
  var cell = xlOwn(ws.getCell(r, c));
  var f = cell.font || {}, k;
  f.size = size;
  for (k in (extra || {})) if (extra.hasOwnProperty(k)) f[k] = extra[k];
  cell.font = f;
  return cell;
}
function xlAlign(ws, r, c, a) {
  var cell = xlOwn(ws.getCell(r, c));
  var o = cell.alignment || {}, k;
  for (k in a) if (a.hasOwnProperty(k)) o[k] = a[k];
  cell.alignment = o;
  return cell;
}
function xlLine(ws, r, c, side, red) {
  var cell = xlOwn(ws.getCell(r, c));
  var b = {}, k, cur = cell.border || {};
  for (k in cur) if (cur.hasOwnProperty(k) && cur[k]) b[k] = cur[k];
  b[side] = red ? { style: 'medium', color: { argb: XL_TRED } } : { style: 'thin', color: { argb: 'FF000000' } };
  cell.border = b;
}

function xlLeague(d, blk) {
  var ps = (d.blocks && d.blocks[blk]) || [];
  var st = {}, res = {}, done = 0;
  var i, m, sc;
  for (i = 0; i < ps.length; i++) st[ps[i].id] = { w: 0, l: 0, g: 0 };
  for (i = 0; i < d.matches.length; i++) {
    m = d.matches[i];
    if (m.stage !== 'L' || String(m.round).charAt(0) !== blk || !m.left.id || !m.right.id) continue;
    res[m.left.id + '|' + m.right.id] = { m: m, side: 'L' };
    res[m.right.id + '|' + m.left.id] = { m: m, side: 'R' };
    if (!xlDone(m)) continue;
    done++;
    sc = xlScore(m);
    if (sc && st[m.left.id] && st[m.right.id]) { var gl = parseInt(sc[0], 10) || 0, gr = parseInt(sc[1], 10) || 0; st[m.left.id].g += gl - gr; st[m.right.id].g += gr - gl; }
    if (st[m.left.id] && st[m.right.id]) {
      if (m.winner === 'L') { st[m.left.id].w++; st[m.right.id].l++; } else { st[m.right.id].w++; st[m.left.id].l++; }
    }
  }
  var rank = {};
  var rk = d.ranks || {};
  if (rk[blk + '1']) rank[rk[blk + '1']] = 1;
  if (rk[blk + '2']) rank[rk[blk + '2']] = 2;
  if (rk[blk + '3']) rank[rk[blk + '3']] = 3;
  if (rk[blk + '1'] && rk[blk + '2'] && rk[blk + '3'] && done >= 6) {
    for (i = 0; i < ps.length; i++) if (!rank[ps[i].id]) rank[ps[i].id] = 4;
  }
  return { ps: ps, st: st, res: res, rank: rank, done: done, all: ps.length >= 2 && done >= ps.length * (ps.length - 1) / 2 };
}

/* ---------- 個人戦（男子：1〜31行、女子：33〜63行） ---------- */
function xlFillIndiv(ws, d, off, withResult) {
  if (!d || !d.division) return;
  var code = d.division.code;
  var M = xlById(d);
  xlSet(ws, 1 + off, 1, xlHead(d));
  var blks = ['A', 'B', 'C', 'D'];
  var bi, L, i, j, q, r, p, opp, x, sc, mine;
  for (bi = 0; bi < 4; bi++) {
    L = xlLeague(d, blks[bi]);
    var top = 3 + bi * 6 + off;
    for (i = 0; i < 4; i++) {
      p = null;
      for (j = 0; j < L.ps.length; j++) if (L.ps[j].pos === i + 1) p = L.ps[j];
      r = top + 1 + i;
      if (!p) continue;
      xlSet(ws, r, 2, xlSpaced(p.names ? p.names[0] : '') + '　' + xlGrade(p.grades ? p.grades[0] : ''));
      xlSet(ws, r, 4, xlSpaced(p.names ? p.names[1] : '') + '　' + xlGrade(p.grades ? p.grades[1] : ''));
      var tm = p.teams && p.teams.length ? (p.teams[0] === p.teams[1] || !p.teams[1] ? p.teams[0] : p.teams[0] + '／' + p.teams[1]) : (p.sub || '');
      xlSet(ws, r, 5, tm);
      xlAlign(ws, r, 5, { horizontal: 'center', shrinkToFit: true, wrapText: false });
      if (!withResult) continue;
      for (q = 0; q < 4; q++) {
        if (q === i) continue;
        opp = null;
        for (j = 0; j < L.ps.length; j++) if (L.ps[j].pos === q + 1) opp = L.ps[j];
        x = opp ? L.res[p.id + '|' + opp.id] : null;
        if (!x || !xlDone(x.m)) continue;
        sc = xlScore(x.m);
        mine = x.side === 'L' ? 0 : 1;
        xlSet(ws, r, 6 + q, sc ? xlNum(sc[mine], x.m.winner === x.side) : (x.m.winner === x.side ? '○' : '●'));
      }
      /* 得失：本部が入力した得失（同率のとき）があればそれ、なければスコアから出したゲーム得失 */
      var dfv = d.diff && d.diff[blks[bi]] && d.diff[blks[bi]].vals ? d.diff[blks[bi]].vals[p.id] : undefined;
      if (L.all) { xlSet(ws, r, 10, L.st[p.id].w); xlSet(ws, r, 11, dfv !== undefined && dfv !== '' ? dfv : L.st[p.id].g); }
      if (L.rank[p.id]) xlSet(ws, r, 12, L.rank[p.id]);
    }
  }
  /* 決勝トーナメント：枠は QF-1の左・右、QF-2の左・右…（ラベルはひな形のまま） */
  var order = [['QF-1', 'L'], ['QF-1', 'R'], ['QF-2', 'L'], ['QF-2', 'R'], ['QF-3', 'L'], ['QF-3', 'R'], ['QF-4', 'L'], ['QF-4', 'R']];
  var m, s, k;
  var won = function (mm, side) { return withResult && xlWon(mm, side); };
  var dn = function (mm) { return withResult && xlDone(mm); };
  for (i = 0; i < 8; i++) {
    m = M[code + '-' + order[i][0]];
    s = m ? (order[i][1] === 'L' ? m.left : m.right) : null;
    var og = s && s.origin ? String(s.origin).match(/^([A-D])([1-4])/) : null;
    if (og) xlSet(ws, 3 + 3 * i + off, 14, XL_ZEN[og[1]] + 'ブロック' + String.fromCharCode(og[2].charCodeAt(0) + 0xFEE0) + '位');
    if (withResult && s && s.decided) {
      xlAlign(ws, 4 + 3 * i + off, 14, { shrinkToFit: true });
      xlAlign(ws, 5 + 3 * i + off, 14, { shrinkToFit: true });
      xlSet(ws, 4 + 3 * i + off, 14, s.names && s.names.length ? xlName(s.names[0]) + '・' + xlName(s.names[1]) : s.label);
      var sch = s.teams && s.teams.length ? (s.teams[0] === s.teams[1] || !s.teams[1] ? s.teams[0] : s.teams[0] + '／' + s.teams[1]) : (s.sub || '');
      xlSet(ws, 5 + 3 * i + off, 14, '（' + sch + '）');
    }
  }
  /* 線：O列＝１回戦、P列＝準決勝、Q列＝決勝、R列＝優勝 */
  for (k = 0; k < 4; k++) {
    m = M[code + '-QF-' + (k + 1)];
    var a = 4 + 6 * k + off, c = 7 + 6 * k + off;
    xlLine(ws, a, 15, 'bottom', won(m, 'L'));
    xlLine(ws, c, 15, 'bottom', won(m, 'R'));
    xlLine(ws, a + 1, 15, 'right', won(m, 'L')); xlLine(ws, a + 2, 15, 'right', won(m, 'L'));
    xlLine(ws, c, 15, 'right', won(m, 'R'));
    xlLine(ws, a + 2, 16, 'bottom', dn(m));
    sc = withResult ? xlScore(m) : null;
    if (sc) { xlSet(ws, a + 2, 16, xlNum(sc[0], m.winner === 'L')); xlSet(ws, c, 16, xlNum(sc[1], m.winner === 'R')); }
  }
  for (k = 0; k < 2; k++) {
    m = M[code + '-SF-' + (k + 1)];
    var t0 = 6 + 12 * k + off;
    for (r = t0 + 1; r <= t0 + 3; r++) xlLine(ws, r, 16, 'right', won(m, 'L'));
    for (r = t0 + 4; r <= t0 + 6; r++) xlLine(ws, r, 16, 'right', won(m, 'R'));
    xlLine(ws, t0 + 3, 17, 'bottom', dn(m));
    sc = withResult ? xlScore(m) : null;
    if (sc) { xlSet(ws, t0 + 3, 17, xlNum(sc[0], m.winner === 'L')); xlSet(ws, t0 + 4, 17, xlNum(sc[1], m.winner === 'R')); }
  }
  var fm = M[code + '-F'];
  for (r = 10 + off; r <= 15 + off; r++) xlLine(ws, r, 17, 'right', won(fm, 'L'));
  for (r = 16 + off; r <= 21 + off; r++) xlLine(ws, r, 17, 'right', won(fm, 'R'));
  xlLine(ws, 15 + off, 18, 'bottom', dn(fm));
  sc = withResult ? xlScore(fm) : null;
  if (sc) { xlSet(ws, 15 + off, 18, xlNum(sc[0], fm.winner === 'L')); xlSet(ws, 16 + off, 18, xlNum(sc[1], fm.winner === 'R')); }
  /* 成績 */
  if (withResult) {
    var rows = [[fm, 'W'], [fm, 'L'], [M[code + '-SF-1'], 'L'], [M[code + '-SF-2'], 'L']];
    for (i = 0; i < 4; i++) {
      m = rows[i][0];
      if (!xlDone(m)) continue;
      s = rows[i][1] === 'W' ? (m.winner === 'L' ? m.left : m.right) : (m.winner === 'L' ? m.right : m.left);
      if (!s) continue;
      r = 28 + i + off;
      xlSet(ws, r, 5, xlName(s.names ? s.names[0] : ''));
      xlSet(ws, r, 9, xlName(s.names ? s.names[1] : ''));
      var full = s.teamsFull && s.teamsFull.length ? (s.teamsFull[0] === s.teamsFull[1] || !s.teamsFull[1] ? s.teamsFull[0] : s.teamsFull[0] + '／' + s.teamsFull[1]) : (s.sub || '');
      xlSet(ws, r, 14, '（' + full + '）');
    }
  }
}

/* ---------- 団体戦 ---------- */
/* draw：組合せ（男女１枚の見本の形）のとき { base: 山の最初の行 } */
function xlFillTeam(ws, d, prog, withResult, draw) {
  if (!d || !d.division) return;
  var code = d.division.code;
  var M = xlById(d);
  var few = xlFewMap(prog, code);
  var b = draw ? draw.base : 5, i, k, m, r0;
  if (!draw) {
    xlSet(ws, 1, 1, xlHead(d));
    xlFont(ws, 1, 1, 14, { bold: true });
    xlAlign(ws, 1, 1, { shrinkToFit: true });
    xlSet(ws, 2, 20, '期日：' + (d.date || ''));
    xlSet(ws, 3, 20, '場所：' + (d.venue || ''));
  }
  var won = function (mm, side) { return withResult && xlWon(mm, side); };
  var dn = function (mm) { return withResult && xlDone(mm); };
  var anyFew = false;
  var slot = function (no, s, row, right) {
    var isFew = !!(s && s.decided && few[s.id]);
    if (isFew) anyFew = true;
    xlSet(ws, row, right ? 30 : 1, isFew ? XL_CIRC[no] : String(no));
    if (no >= 10 && !isFew) xlFont(ws, row, 30, 10);
    if (s && s.decided) {
      var lb = s.label;
      var ln = xlChars(lb).length, dn2 = xlChars(s.sub || '').length;
      xlSet(ws, row, right ? 21 : 2, lb);
      xlFont(ws, row, right ? 21 : 2, ln <= 4 ? 14 : (ln === 5 ? 12 : 10));
      xlSet(ws, row, right ? 26 : 7, s.sub || '');
      xlFont(ws, row, right ? 26 : 7, dn2 <= 2 ? 12 : (dn2 === 3 ? 11 : 8));
    }
  };
  var cnt = function (mm, side, row, col) {
    if (!withResult) return;
    var sc = xlScore(mm);
    if (!sc) return;
    xlSet(ws, row, col, xlNum(sc[side === 'L' ? 0 : 1], mm.winner === side));
  };
  /* 線：赤は勝ち上がり。1回戦＝K列・T列、準々決勝＝L列・S列、準決勝＝M列・R列、決勝＝N〜Q列 */
  for (k = 0; k < 8; k++) {
    m = M[code + '-R1-' + (k + 1)];
    var right = k >= 4;
    r0 = b + 4 * (right ? k - 4 : k);
    slot(k * 2 + 1, m && m.left, r0, right);
    slot(k * 2 + 2, m && m.right, r0 + 2, right);
    var col = right ? 20 : 11, vs = right ? 'left' : 'right', nx = right ? 19 : 12;
    xlLine(ws, r0, col, 'bottom', won(m, 'L'));
    xlLine(ws, r0 + 2, col, 'bottom', won(m, 'R'));
    xlLine(ws, r0 + 1, col, vs, won(m, 'L'));
    xlLine(ws, r0 + 2, col, vs, won(m, 'R'));
    cnt(m, 'L', r0 + 1, nx);
    cnt(m, 'R', r0 + 2, nx);
  }
  for (k = 0; k < 4; k++) {
    m = M[code + '-QF-' + (k + 1)];
    var rt = k >= 2;
    r0 = b + 8 * (rt ? k - 2 : k);
    var c2 = rt ? 19 : 12, vs2 = rt ? 'left' : 'right', nx2 = rt ? 18 : 13;
    xlLine(ws, r0 + 1, c2, 'bottom', won(m, 'L'));
    xlLine(ws, r0 + 5, c2, 'bottom', won(m, 'R'));
    xlLine(ws, r0 + 2, c2, vs2, won(m, 'L')); xlLine(ws, r0 + 3, c2, vs2, won(m, 'L'));
    xlLine(ws, r0 + 4, c2, vs2, won(m, 'R')); xlLine(ws, r0 + 5, c2, vs2, won(m, 'R'));
    cnt(m, 'L', r0 + 3, nx2);
    cnt(m, 'R', r0 + 4, nx2);
  }
  for (k = 0; k < 2; k++) {
    m = M[code + '-SF-' + (k + 1)];
    var c3 = k ? 18 : 13, vs3 = k ? 'left' : 'right', nx3 = k ? 17 : 14;
    xlLine(ws, b + 3, c3, 'bottom', won(m, 'L'));
    xlLine(ws, b + 11, c3, 'bottom', won(m, 'R'));
    for (i = b + 4; i <= b + 7; i++) xlLine(ws, i, c3, vs3, won(m, 'L'));
    for (i = b + 8; i <= b + 11; i++) xlLine(ws, i, c3, vs3, won(m, 'R'));
    cnt(m, 'L', b + 7, nx3);
    cnt(m, 'R', b + 8, nx3);
  }
  var fm = M[code + '-F'];
  xlLine(ws, b + 7, 14, 'bottom', won(fm, 'L'));
  xlLine(ws, b + 7, 15, 'bottom', won(fm, 'L'));
  xlLine(ws, b + 7, 16, 'bottom', won(fm, 'R'));
  xlLine(ws, b + 7, 17, 'bottom', won(fm, 'R'));
  for (i = b + 4; i <= b + 7; i++) xlLine(ws, i, 15, 'right', dn(fm));
  cnt(fm, 'L', b + 6, 15);
  cnt(fm, 'R', b + 6, 16);
  if (anyFew) {
    var lr = b + 16;
    xlSet(ws, lr, 2, '○で囲んだ番号：選手が５名以下のチーム（第３マッチは欠員のため不戦敗）');
    xlOwn(ws.getCell(lr, 2));
    ws.getCell(lr, 2).font = { name: 'ＭＳ Ｐゴシック', size: 9 };
    ws.getCell(lr, 2).alignment = { horizontal: 'left', vertical: 'middle' };
  }
  if (!withResult) return;
  /* 準決勝・決勝の詳細 */
  var det = [[M[code + '-SF-1'], 25], [M[code + '-SF-2'], 30], [fm, 36]];
  var pn = function (a, i2) { return a && a.length ? xlName(a[i2]) : ''; };
  for (k = 0; k < 3; k++) {
    m = det[k][0];
    var base = det[k][1];
    if (!m) continue;
    if (m.left && m.left.decided) xlSet(ws, base, 7, m.left.label + '（' + (m.left.sub || '') + '）');
    if (m.right && m.right.decided) xlSet(ws, base, 19, m.right.label + '（' + (m.right.sub || '') + '）');
    if (!xlDone(m)) continue;
    cnt(m, 'L', base, 13);
    cnt(m, 'R', base, 17);
    var t = m.team;
    for (i = 0; i < 3; i++) {
      var pr = t && t.pairs ? t.pairs[i] : null;
      if (!pr) continue;
      var rr = base + 1 + i;
      if (pr.l && pr.l.length) { xlSet(ws, rr, 7, pn(pr.l, 0)); xlSet(ws, rr, 11, pn(pr.l, 1)); } else if (pr.vac || pr.w === 'R') xlSet(ws, rr, 7, '（欠員）');
      if (pr.r && pr.r.length) { xlSet(ws, rr, 18, pn(pr.r, 0)); xlSet(ws, rr, 22, pn(pr.r, 1)); } else if (pr.vac || pr.w === 'L') xlSet(ws, rr, 18, '（欠員）');
      var gx = pr.kind === 'forfeit' && (!pr.g || pr.g === '不戦勝') ? (pr.w === 'L' ? '3-R' : 'R-3') : (pr.g || '');
      var gs = String(gx).match(/(\d+|R)\s*-\s*(\d+|R)/);
      if (gs) { xlSet(ws, rr, 14, xlNum(gs[1], pr.w === 'L')); xlSet(ws, rr, 17, xlNum(gs[2], pr.w === 'R')); }
    }
  }
  /* 成績 */
  var rows = [[fm, 'W'], [fm, 'L'], [M[code + '-SF-1'], 'L'], [M[code + '-SF-2'], 'L']];
  for (i = 0; i < 4; i++) {
    m = rows[i][0];
    if (!xlDone(m)) continue;
    var s = rows[i][1] === 'W' ? (m.winner === 'L' ? m.left : m.right) : (m.winner === 'L' ? m.right : m.left);
    if (s) xlSet(ws, 42 + i, 10, s.full || s.label);
  }
}

/* ============================================================
   団体戦：選手名簿（枠の順）
   ============================================================ */
function xlRosterSheet(wb, d, prog, sheetName) {
  var ws = xlSheet(wb, sheetName, true, true);
  var code = d.division.code;
  var widths = [5, 18, 9, 13, 12, 12, 12, 12, 12, 12, 12, 12];
  var i, j;
  for (i = 0; i < widths.length; i++) ws.getColumn(i + 1).width = widths[i];
  xlTitle(ws, d, '選手名簿', 12);
  var hd = ['番号', 'チーム名', '地区', '監督', 'No.１', 'No.２', 'No.３', 'No.４', 'No.５', 'No.６', 'No.７', 'No.８'];
  for (i = 0; i < hd.length; i++) xlCell(ws, 4, i + 1, hd[i], { size: 9, bold: true, h: 'center', fill: 'FFE8EFE8' });
  xlBox(ws, 4, 1, 4, 12);
  var ts = (prog && prog.teams && prog.teams[code]) ? prog.teams[code].slice() : [];
  var slotNo = function (t) { var n = parseInt(String(t.slot || '').replace(/\D/g, ''), 10); return isNaN(n) ? 99 : n; };
  ts.sort(function (a, b) { return slotNo(a) - slotNo(b); });
  var few = xlFewMap(prog, code);
  var anyFew = false;
  var row = 5, t, p, n;
  for (i = 0; i < ts.length; i++) {
    t = ts[i];
    n = slotNo(t);
    ws.getRow(row).height = 30;
    if (few[t.id]) anyFew = true;
    xlCell(ws, row, 1, n === 99 ? '' : (few[t.id] ? XL_CIRC[n] : n), { h: 'center', size: few[t.id] ? 12 : 10 });
    xlCell(ws, row, 2, t.name || '', { size: 10, bold: true, wrap: true });
    xlCell(ws, row, 3, t.district || '', { size: 9, h: 'center' });
    xlCell(ws, row, 4, xlName(t.coach || ''), { size: 9, h: 'center', shrink: true });
    for (j = 0; j < 8; j++) {
      p = (t.players || [])[j];
      xlCell(ws, row, 5 + j, p && !p.vacant && p.name ? xlName(p.name) + '\n（' + (p.grade || '') + '）' : '（欠員）', { size: 9, h: 'center', wrap: true, color: p && !p.vacant && p.name ? undefined : 'FF888888' });
    }
    xlBox(ws, row, 1, row, 12);
    row++;
  }
  if (!ts.length) { ws.mergeCells(row, 1, row, 12); xlCell(ws, row, 1, '名簿のデータがありません。', { size: 10 }); }
  if (anyFew) { ws.mergeCells(row + 1, 1, row + 1, 12); xlCell(ws, row + 1, 1, '○で囲んだ番号：選手が５名以下のチーム（第３マッチは欠員のため不戦敗）', { size: 9 }); }
  ws.pageSetup.printTitlesRow = '4:4';
  return ws;
}

/* ============================================================
   まとめて作ってダウンロード
   ============================================================ */
function xlBuild(data) {
  var wb = new ExcelJS.Workbook();
  return fetch(XL_TPL, { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('組合せ表のひな形（doc/tpl-kumiawase.xlsx）を読み込めませんでした。');
    return r.arrayBuffer();
  }).then(function (buf) { return wb.xlsx.load(buf); }).then(function () {
    var D = data.divs;
    var pair = [['個人戦_組合せ', false], ['個人戦_結果', true]];
    var i, ws;
    for (i = 0; i < pair.length; i++) {
      ws = wb.getWorksheet(pair[i][0]);
      xlFillIndiv(ws, D.MI, 0, pair[i][1]);
      xlFillIndiv(ws, D.WI, 32, pair[i][1]);
      ws.getRow(32).addPageBreak();
    }
    var teams = [['男子団体', 'MT'], ['女子団体', 'WT']];
    /* 組合せは男女１枚（男子：4〜19行、女子：29〜44行）、結果は男女別のシート */
    ws = wb.getWorksheet('団体戦_組合せ');
    xlFillTeam(ws, D.MT, data.program, false, { base: 4 });
    xlFillTeam(ws, D.WT, data.program, false, { base: 29 });
    for (i = 0; i < teams.length; i++) xlFillTeam(wb.getWorksheet(teams[i][0] + '_結果'), D[teams[i][1]], data.program, true);
    for (i = 0; i < teams.length; i++) if (D[teams[i][1]] && D[teams[i][1]].division) xlRosterSheet(wb, D[teams[i][1]], data.program, teams[i][0] + '_選手名簿');
    wb.creator = '岩手県中学生ソフトテニス連盟';
    return wb.xlsx.writeBuffer();
  });
}

function xlStamp() {
  var t = new Date();
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()) + '_' + p(t.getHours()) + p(t.getMinutes());
}

/* apiFn：管理画面の api()。onDone(fileName) / onError(err) */
function exportDrawExcel(apiFn, onDone, onError) {
  var name = '組合せ・結果_' + xlStamp() + '.xlsx';
  xlLoadLib().then(function () { return xlGather(apiFn); }).then(xlBuild).then(function (buf) {
    var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    if (onDone) onDone(name);
  }).catch(function (err) { if (onError) onError(err); });
}
