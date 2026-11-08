/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   組合せ表（SVG）の描画：bracket.html と program.html で共用
   規約：ES5（var / function のみ）
   ============================================================ */
var RED = '#d0021b';
var INK = '#111';
var W = 760;
var CIRCLED = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
var ZEN = { A: 'Ａ', B: 'Ｂ', C: 'Ｃ', D: 'Ｄ', '1': '１', '2': '２' };

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function byId(d) {
  var o = {};
  var i;
  for (i = 0; i < d.matches.length; i++) o[d.matches[i].id] = d.matches[i];
  return o;
}

function gradeMark(g) {
  var n = String(g || '').replace(/[^0-9]/g, '');
  return n ? CIRCLED[+n] || '' : '';
}

/* 試合のスコア（左-右）を数値で */
function scorePair(m) {
  if (!m || m.state !== '終了') return null;
  var sc = String(m.score || '').match(/(\d+)\s*-\s*(\d+)/);
  return sc ? [+sc[1], +sc[2]] : null;
}

function won(m, side) { return !!(m && m.state === '終了' && m.winner === side); }
function decided(m) { return !!(m && m.state === '終了' && m.winner); }

/* 2回戦以降の線：入口の横線（前の試合の勝者が来た＝赤）＋縦線（この試合に勝った＝赤）
   勝ち上がりは「横・縦・横」になる（3本目の横は、次の試合の入口の横線） */
function stepLine(g, xa, y, xb, yJ, inRed, vRed) {
  g.line('M' + xa + ' ' + y + ' H' + xb, inRed);
  g.line('M' + xb + ' ' + y + ' V' + yJ, vRed);
}

/* ============================================================
   SVG 部品
   ============================================================ */
function Svg() { this.h = []; }
Svg.prototype.line = function (d, red, w) {
  this.h.push('<path d="' + d + '" fill="none" stroke="' + (red ? RED : INK) + '" stroke-width="' + (red ? 2.6 : (w || 1.1)) + '" stroke-linecap="square"/>');
};
Svg.prototype.rect = function (x, y, w, h, sw) {
  this.h.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#222" stroke-width="' + (sw || 1) + '"/>');
};
Svg.prototype.hr = function (x1, x2, y, sw) {
  this.h.push('<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#222" stroke-width="' + (sw || 1) + '"/>');
};
Svg.prototype.raw = function (s) { this.h.push(s); };
/* opt: size, anchor, bold, color, fit（この幅に収める）, spread（この幅に字間をあけて並べる） */
Svg.prototype.text = function (x, y, s, opt) {
  opt = opt || {};
  s = String(s === undefined || s === null ? '' : s);
  if (!s) return;
  var size = opt.size || 13;
  var n = 0;
  var i;
  for (i = 0; i < s.length; i++) n += s.charCodeAt(i) < 256 ? 0.55 : 1;
  var natural = n * size;
  var extra = '';
  if (opt.spread && s.length > 1 && natural < opt.spread) extra = ' textLength="' + opt.spread + '" lengthAdjust="spacing"';
  else if ((opt.fit || opt.spread) && natural > (opt.fit || opt.spread)) extra = ' textLength="' + (opt.fit || opt.spread) + '" lengthAdjust="spacingAndGlyphs"';
  this.h.push('<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + (opt.anchor || 'start') + '" font-weight="' + (opt.bold ? 700 : 400) + '" fill="' + (opt.color || INK) + '"' + extra + '>' + esc(s) + '</text>');
};
/* 数字（丸囲みは勝ち） */
Svg.prototype.num = function (x, y, n, circled, size) {
  size = size || 12;
  if (n === null || n === undefined || n === '') return;
  if (circled) this.h.push('<circle cx="' + x + '" cy="' + (y - size * 0.36) + '" r="' + (size * 0.62) + '" fill="none" stroke="' + RED + '" stroke-width="1"/>');
  this.text(x, y, n, { size: size, anchor: 'middle', color: RED });
};
Svg.prototype.out = function (h) {
  return '<svg viewBox="0 0 ' + W + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans JP, sans-serif">' + this.h.join('') + '</svg>';
};

function header(g, d, y) {
  g.text(W / 2, y, d.tournament + '　' + d.division.name, { size: 19, bold: true, anchor: 'middle' });
  g.text(500, y + 22, '期日：' + (d.date || ''), { size: 11 });
  g.text(500, y + 38, '場所：' + (d.venue || ''), { size: 11 });
}

/* ============================================================
   団体戦（A4縦1枚）
   ============================================================ */
function teamPage(d) {
  var code = d.division.code;
  var M = byId(d);
  var g = new Svg();
  header(g, d, 30);

  var y0 = 126, rowH = 50;
  var xs = 238, x1 = 262, x2 = 286, x3 = 310, cx = W / 2;
  var xr = W - xs, x1r = W - x1, x2r = W - x2, x3r = W - x3;
  var slotY = function (i) { return y0 + i * rowH; };
  var mid = function (a, b) { return (a + b) / 2; };

  /* チーム名（略称・字間をそろえる）（地区） */
  var slot = function (no, s, y, right) {
    var nx = right ? W - 6 : 6;
    g.text(nx, y + 6, no, { size: 13, anchor: right ? 'end' : 'start', color: '#333' });
    if (!s || !s.decided) return;
    var base = right ? 526 : 26;
    g.text(base, y + 6, s.label, { size: 16, spread: 108 });
    if (s.sub) {
      g.text(base + 120, y + 6, '（', { size: 13 });
      g.text(base + 140, y + 6, s.sub, { size: 13, spread: 50 });
      g.text(base + 196, y + 6, '）', { size: 13 });
    }
  };
  /* 勝ち数：縦線の外側、それぞれの線の高さに */
  var counts = function (m, xJ, yA, yB, right) {
    var sc = scorePair(m);
    if (!sc) return;
    var dx = right ? -9 : 9;
    g.num(xJ + dx, yA + 5, sc[0], m.winner === 'L', 12);
    g.num(xJ + dx, yB + 5, sc[1], m.winner === 'R', 12);
  };

  var i, m, yA, yB, yJ;
  var r1J = [];
  for (i = 0; i < 8; i++) {
    m = M[code + '-R1-' + (i + 1)];
    var right = i >= 4;
    var s0 = right ? (i - 4) * 2 : i * 2;
    yA = slotY(s0);
    yB = slotY(s0 + 1);
    yJ = mid(yA, yB);
    r1J.push(yJ);
    slot(i * 2 + 1, m && m.left, yA, right);
    slot(i * 2 + 2, m && m.right, yB, right);
    if (!right) {
      g.line('M' + xs + ' ' + yA + ' H' + x1 + ' V' + yJ, won(m, 'L'));
      g.line('M' + xs + ' ' + yB + ' H' + x1 + ' V' + yJ, won(m, 'R'));
      counts(m, x1, yA, yB, false);
    } else {
      g.line('M' + xr + ' ' + yA + ' H' + x1r + ' V' + yJ, won(m, 'L'));
      g.line('M' + xr + ' ' + yB + ' H' + x1r + ' V' + yJ, won(m, 'R'));
      counts(m, x1r, yA, yB, true);
    }
  }
  var qJ = [];
  for (i = 0; i < 4; i++) {
    m = M[code + '-QF-' + (i + 1)];
    yA = r1J[i * 2];
    yB = r1J[i * 2 + 1];
    yJ = mid(yA, yB);
    qJ.push(yJ);
    var fA = M[code + '-R1-' + (i * 2 + 1)], fB = M[code + '-R1-' + (i * 2 + 2)];
    if (i < 2) {
      stepLine(g, x1, yA, x2, yJ, decided(fA), won(m, 'L'));
      stepLine(g, x1, yB, x2, yJ, decided(fB), won(m, 'R'));
      counts(m, x2, yA, yB, false);
    } else {
      stepLine(g, x1r, yA, x2r, yJ, decided(fA), won(m, 'L'));
      stepLine(g, x1r, yB, x2r, yJ, decided(fB), won(m, 'R'));
      counts(m, x2r, yA, yB, true);
    }
  }
  var sf1 = M[code + '-SF-1'], sf2 = M[code + '-SF-2'], fm = M[code + '-F'];
  var ySF = mid(qJ[0], qJ[1]);
  stepLine(g, x2, qJ[0], x3, ySF, decided(M[code + '-QF-1']), won(sf1, 'L'));
  stepLine(g, x2, qJ[1], x3, ySF, decided(M[code + '-QF-2']), won(sf1, 'R'));
  counts(sf1, x3, qJ[0], qJ[1], false);
  stepLine(g, x2r, qJ[2], x3r, ySF, decided(M[code + '-QF-3']), won(sf2, 'L'));
  stepLine(g, x2r, qJ[3], x3r, ySF, decided(M[code + '-QF-4']), won(sf2, 'R'));
  counts(sf2, x3r, qJ[2], qJ[3], true);
  /* 決勝：中央。優勝した側だけ横線を中央まで伸ばして上へ。負けた側は準決勝の縦線まで */
  g.line('M' + x3 + ' ' + ySF + ' H' + cx, won(fm, 'L'));
  g.line('M' + x3r + ' ' + ySF + ' H' + cx, won(fm, 'R'));
  g.line('M' + cx + ' ' + ySF + ' V' + (y0 - 22), !!(fm && fm.state === '終了' && fm.winner));
  var fs = scorePair(fm);
  if (fs) {
    g.num(cx - 18, ySF - 7, fs[0], fm.winner === 'L', 12);
    g.num(cx + 18, ySF - 7, fs[1], fm.winner === 'R', 12);
  }
  if (fm && fm.state === '試合中') g.text(cx, ySF + 16, '決勝 試合中', { size: 10, anchor: 'middle', color: RED });

  /* 準決勝・決勝の詳細 */
  var yD = slotY(7) + 46;
  g.hr(14, W - 14, yD, 0.8);
  var y = yD + 28;
  g.text(cx, y, '準　決　勝', { size: 15, bold: true, anchor: 'middle' });
  y = detail(g, sf1, y + 10);
  y = detail(g, sf2, y + 18);
  g.text(cx, y + 30, '決　　　勝', { size: 15, bold: true, anchor: 'middle' });
  y = detail(g, fm, y + 40);

  /* 結果 */
  y += 40;
  var rows = [['優　　　勝', fm, 'win'], ['準　優　勝', fm, 'lose'], ['第　３　位', sf1, 'lose'], ['第　３　位', sf2, 'lose']];
  g.hr(120, 640, y, 1);
  for (i = 0; i < rows.length; i++) {
    var who = placeOf(rows[i][1], rows[i][2]);
    var yy = y + 26 + i * 38;
    g.text(130, yy, rows[i][0], { size: 15, spread: 100 });
    if (who) {
      var tnm = who.label + (who.sub ? '（' + who.sub + '）' : '');
      g.text(260, yy, tnm, { size: 16, spread: Math.min(370, tnm.length * 26), bold: i === 0, color: i === 0 ? RED : INK });
    }
    g.hr(120, 640, yy + 11, i === rows.length - 1 ? 1 : 0.8);
  }
  return g.out(y + 4 * 38 + 14);
}

/* 1位〜3位の当該チーム／ペア */
function placeOf(m, kind) {
  if (!m || m.state !== '終了' || !m.winner) return null;
  var w = kind === 'win' ? m.winner : (m.winner === 'L' ? 'R' : 'L');
  return w === 'L' ? m.left : m.right;
}

/* 団体戦の1試合の詳細（チーム名・勝ち数、番手ごとの選手名とゲーム数） */
function detail(g, m, y) {
  var cx = W / 2;
  var bxL = 140, bxR = W - 140 - 190, bw = 190, bh = 28;
  g.rect(bxL, y, bw, bh, 1);
  g.rect(bxR, y, bw, bh, 1);
  var nm = function (s) { return s && s.decided ? s.label + '（' + (s.sub || '') + '）' : ''; };
  g.text(bxL + bw / 2, y + 20, nm(m && m.left), { size: 15, anchor: 'middle', fit: bw - 10 });
  g.text(bxR + bw / 2, y + 20, nm(m && m.right), { size: 15, anchor: 'middle', fit: bw - 10 });
  g.text(cx, y + 19, '-', { size: 13, anchor: 'middle', color: RED });
  var sc = scorePair(m);
  if (sc) {
    g.num(cx - 30, y + 20, sc[0], m.winner === 'L', 14);
    g.num(cx + 30, y + 20, sc[1], m.winner === 'R', 14);
  }
  var t = m && m.team;
  var yy = y + bh + 2;
  var i;
  for (i = 0; i < 3; i++) {
    yy += 19;
    var p = t && t.pairs ? t.pairs[i] : null;
    g.text(cx, yy, '-', { size: 10, anchor: 'middle', color: RED });
    if (!p) continue;
    pairNames(g, p.l, bxL + 4, yy);
    pairNames(g, p.r, bxR + 4, yy);
    if (p.kind === 'played') {
      var gs = String(p.g || '').match(/(\d+)-(\d+)/);
      if (gs) {
        g.num(cx - 30, yy, +gs[1], p.w === 'L', 11);
        g.num(cx + 30, yy, +gs[2], p.w === 'R', 11);
      }
    } else if (p.kind === 'forfeit') {
      g.text(p.w === 'L' ? cx - 30 : cx + 30, yy, '不戦勝', { size: 8, anchor: 'middle', color: RED });
    }
  }
  return yy + 4;
}

function pairNames(g, names, x, y) {
  if (!names) return;
  g.text(x + 4, y, names[0], { size: 11, spread: 70 });
  g.text(x + 90, y, '・', { size: 11, anchor: 'middle' });
  g.text(x + 104, y, names[1], { size: 11, spread: 70 });
}

/* ============================================================
   個人戦（A4縦1枚：予選リーグ＋決勝トーナメント）
   ============================================================ */
function leagueStat(d, blk) {
  var ps = d.blocks[blk] || [];
  var byPos = {};
  var st = {};
  var res = {};
  var done = 0;
  var i, m, sc;
  for (i = 0; i < ps.length; i++) { byPos[ps[i].pos] = ps[i]; st[ps[i].id] = { w: 0, gf: 0, ga: 0, n: 0 }; }
  for (i = 0; i < d.matches.length; i++) {
    m = d.matches[i];
    if (m.stage !== 'L' || String(m.round).charAt(0) !== blk || m.state !== '終了' || !m.left.id || !m.right.id) continue;
    sc = scorePair(m);
    done++;
    res[m.left.id + '|' + m.right.id] = { win: m.winner === 'L', g: sc ? sc[0] : '' };
    res[m.right.id + '|' + m.left.id] = { win: m.winner === 'R', g: sc ? sc[1] : '' };
    if (st[m.left.id] && st[m.right.id]) {
      st[m.left.id].n++; st[m.right.id].n++;
      if (m.winner === 'L') st[m.left.id].w++; else if (m.winner === 'R') st[m.right.id].w++;
      if (sc) { st[m.left.id].gf += sc[0]; st[m.left.id].ga += sc[1]; st[m.right.id].gf += sc[1]; st[m.right.id].ga += sc[0]; }
    }
  }
  /* 順位：1〜3位は本部の確定値。4位は残りの1ペア
     3位が未確定のときだけ自動：残り2ペアの勝数が違う、または同率が2ペアだけ（直接対決で決まる）とき。
     3ペア以上の同率が絡むときは、得失などで本部が決めるので空欄にする */
  var rank = {};
  var r1 = d.ranks[blk + '1'], r2 = d.ranks[blk + '2'], r3 = d.ranks[blk + '3'];
  if (r1) rank[r1] = 1;
  if (r2) rank[r2] = 2;
  if (r1 && r2 && done >= 6) {
    var rest = [];
    for (i = 0; i < ps.length; i++) if (ps[i].id !== r1 && ps[i].id !== r2) rest.push(ps[i].id);
    if (rest.length === 2) {
      var a = rest[0], b = rest[1];
      var aFirst = null;
      if (r3 === a || r3 === b) aFirst = r3 === a;
      else if (st[a].w !== st[b].w) aFirst = st[a].w > st[b].w;
      else {
        var same = 0;
        for (i = 0; i < ps.length; i++) if (st[ps[i].id].w === st[a].w) same++;
        if (same === 2 && res[a + '|' + b]) aFirst = !!res[a + '|' + b].win;
      }
      if (aFirst !== null) {
        rank[aFirst ? a : b] = 3;
        rank[aFirst ? b : a] = 4;
      }
    }
  }
  return { byPos: byPos, st: st, res: res, rank: rank };
}

function leagueTable(g, d, blk, y) {
  var L = leagueStat(d, blk);
  var rowH = 38, hh = 25;
  var X = { no: 0, nm: 18, sc: 246, c: 306, cw: 28, pt: 418, df: 452, rk: 486, end: 518 };
  var i, j;
  /* 枠線 */
  g.rect(X.no, y, X.end - X.no, hh + rowH * 4, 1);
  var vx = [X.nm, X.sc, X.c, X.c + X.cw, X.c + X.cw * 2, X.c + X.cw * 3, X.pt, X.df, X.rk];
  for (i = 0; i < vx.length; i++) {
    var top = vx[i] === X.sc ? y + hh : y;
    g.raw('<line x1="' + vx[i] + '" y1="' + top + '" x2="' + vx[i] + '" y2="' + (y + hh + rowH * 4) + '" stroke="#222" stroke-width="0.8"/>');
  }
  for (i = 0; i <= 3; i++) g.hr(X.no, X.end, y + hh + rowH * i, 0.8);
  g.text((X.nm + X.c) / 2, y + 17, ZEN[blk] + 'ブロック', { size: 11, anchor: 'middle' });
  for (j = 0; j < 4; j++) g.text(X.c + X.cw * j + X.cw / 2, y + 17, j + 1, { size: 12, anchor: 'middle' });
  g.text((X.pt + X.df) / 2, y + 17, '勝点', { size: 11, anchor: 'middle' });
  /* 得失の欄：本部が表示を選んだブロックだけ「得失ゲーム」などに変わり、入力した組だけに値が出る */
  var DF = d.diff && d.diff[blk] ? d.diff[blk] : null;
  if (DF) {
    g.text((X.df + X.rk) / 2, y + 11, '得失', { size: 9.5, anchor: 'middle' });
    g.text((X.df + X.rk) / 2, y + 21.5, DF.kind, { size: DF.kind.length > 3 ? 7.5 : 8.5, anchor: 'middle' });
  } else {
    g.text((X.df + X.rk) / 2, y + 17, '得失', { size: 11, anchor: 'middle' });
  }
  g.text((X.rk + X.end) / 2, y + 17, '順位', { size: 11, anchor: 'middle' });
  for (i = 0; i < 4; i++) {
    var p = L.byPos[i + 1];
    var ry = y + hh + rowH * i;
    var ty = ry + 24.5;
    g.text(X.no + 9, ty, i + 1, { size: 11, anchor: 'middle' });
    if (p) {
      var nm = p.names && p.names.length ? p.names : [p.label, ''];
      var gr = p.grades || [];
      g.text(X.nm + 6, ty, nm[0], { size: 12.5, spread: 74 });
      g.text(X.nm + 91, ty, gradeMark(gr[0]), { size: 12.5, anchor: 'middle' });
      g.text(X.nm + 112, ty, '・', { size: 12.5, anchor: 'middle' });
      g.text(X.nm + 126, ty, nm[1], { size: 12.5, spread: 74 });
      g.text(X.nm + 213, ty, gradeMark(gr[1]), { size: 12.5, anchor: 'middle' });
      g.text(X.sc + 4, ty, schoolText(p), { size: 11.5, spread: X.c - X.sc - 8 });
    }
    for (j = 0; j < 4; j++) {
      var cx0 = X.c + X.cw * j;
      if (i === j) {
        g.raw('<line x1="' + cx0 + '" y1="' + ry + '" x2="' + (cx0 + X.cw) + '" y2="' + (ry + rowH) + '" stroke="#222" stroke-width="0.8"/>');
        continue;
      }
      var q = L.byPos[j + 1];
      var r = p && q ? L.res[p.id + '|' + q.id] : null;
      if (r) g.num(cx0 + X.cw / 2, ty, r.g === '' ? (r.win ? '○' : '●') : r.g, r.win && r.g !== '', 13.5);
    }
    var s = p ? L.st[p.id] : null;
    if (s && s.n) {
      g.text((X.pt + X.df) / 2, ty, s.w, { size: 13.5, anchor: 'middle', color: RED });
    }
    if (p && DF && DF.vals[p.id]) g.text((X.df + X.rk) / 2, ty, DF.vals[p.id], { size: 12.5, anchor: 'middle', color: RED });
    if (p && L.rank[p.id]) g.text((X.rk + X.end) / 2, ty, L.rank[p.id], { size: 13.5, anchor: 'middle', color: RED, bold: L.rank[p.id] <= 2 });
  }
  return y + hh + rowH * 4;
}

function schoolText(p) {
  if (!p) return '';
  if (p.teams && p.teams.length) return p.teams[0] === p.teams[1] || !p.teams[1] ? p.teams[0] : p.teams[0] + '／' + p.teams[1];
  return p.sub || '';
}

function fullSchool(p) {
  var t = p && p.teamsFull;
  if (t && t[0]) return !t[1] || t[0] === t[1] ? t[0] : t[0] + '／' + t[1];
  return p ? p.sub || '' : '';
}

function indivPage(d) {
  var code = d.division.code;
  var M = byId(d);
  var g = new Svg();
  header(g, d, 30);
  var top = 100;
  g.text(259, top - 8, '「予選リーグ」', { size: 12, anchor: 'middle' });
  g.text(602, top - 8, '「決勝トーナメント」', { size: 12, anchor: 'middle' });
  var bl = ['A', 'B', 'C', 'D'];
  var i, y = top;
  for (i = 0; i < 4; i++) y = leagueTable(g, d, bl[i], y) + 20;
  var bottom = y - 20;

  /* 決勝トーナメント */
  var order = [['QF-1', 'L'], ['QF-1', 'R'], ['QF-2', 'L'], ['QF-2', 'R'], ['QF-3', 'L'], ['QF-3', 'R'], ['QF-4', 'L'], ['QF-4', 'R']];
  var bx = 532, bw = 140;
  var x1 = 694, x2 = 716, x3 = 738, xEnd = 756;
  var pitch = (bottom - top) / 8;
  var ys = [];
  var m, s, side, by0;
  for (i = 0; i < 8; i++) {
    m = M[code + '-' + order[i][0]];
    side = order[i][1];
    s = m ? (side === 'L' ? m.left : m.right) : null;
    by0 = top + i * pitch;
    var origin = s && s.origin ? s.origin : '';
    if (origin) g.text(bx + bw / 2, by0 + 12, ZEN[origin.charAt(0)] + 'ブロック' + ZEN[origin.charAt(1)] + '位', { size: 12, anchor: 'middle' });
    var boxTop = by0 + 19, boxH = pitch - 25;
    g.rect(bx, boxTop, bw, boxH, 1);
    ys.push(boxTop + boxH / 2);
    var l1 = boxTop + boxH * 0.40, l2 = boxTop + boxH * 0.86;
    if (s && s.decided) {
      var nm = s.names && s.names.length ? s.names[0] + '・' + s.names[1] : s.label;
      g.text(bx + bw / 2, l1, nm, { size: 12.5, anchor: 'middle', fit: bw - 6 });
      g.text(bx + 4, l2, '（', { size: 12 });
      g.text(bx + 24, l2, s.sub || '', { size: 12, spread: bw - 48 });
      g.text(bx + bw - 16, l2, '）', { size: 12 });
    } else {
      g.text(bx + 4, l2, '（', { size: 12 });
      g.text(bx + bw - 16, l2, '）', { size: 12 });
    }
  }
  var kcounts = function (mm, xJ, yA, yB) {
    var sc = scorePair(mm);
    if (!sc) return;
    g.num(xJ + 11, yA + 16, sc[0], mm.winner === 'L', 12.5);
    g.num(xJ + 11, yB + 2, sc[1], mm.winner === 'R', 12.5);
  };
  var j, yA, yB, yJ;
  var qJ = [];
  for (j = 0; j < 4; j++) {
    m = M[code + '-QF-' + (j + 1)];
    yA = ys[j * 2]; yB = ys[j * 2 + 1]; yJ = (yA + yB) / 2;
    qJ.push(yJ);
    g.line('M' + (bx + bw) + ' ' + yA + ' H' + x1 + ' V' + yJ, won(m, 'L'));
    g.line('M' + (bx + bw) + ' ' + yB + ' H' + x1 + ' V' + yJ, won(m, 'R'));
    kcounts(m, x1, yA, yB);
  }
  var sJ = [];
  for (j = 0; j < 2; j++) {
    m = M[code + '-SF-' + (j + 1)];
    yA = qJ[j * 2]; yB = qJ[j * 2 + 1]; yJ = (yA + yB) / 2;
    sJ.push(yJ);
    stepLine(g, x1, yA, x2, yJ, decided(M[code + '-QF-' + (j * 2 + 1)]), won(m, 'L'));
    stepLine(g, x1, yB, x2, yJ, decided(M[code + '-QF-' + (j * 2 + 2)]), won(m, 'R'));
    kcounts(m, x2, yA, yB);
  }
  var fm = M[code + '-F'];
  yJ = (sJ[0] + sJ[1]) / 2;
  stepLine(g, x2, sJ[0], x3, yJ, decided(M[code + '-SF-1']), won(fm, 'L'));
  stepLine(g, x2, sJ[1], x3, yJ, decided(M[code + '-SF-2']), won(fm, 'R'));
  g.line('M' + x3 + ' ' + yJ + ' H' + xEnd, !!(fm && fm.state === '終了' && fm.winner));
  kcounts(fm, x3, sJ[0], sJ[1]);

  /* 結果 */
  var sf1 = M[code + '-SF-1'], sf2 = M[code + '-SF-2'];
  var rows = [['第１位', fm, 'win'], ['第２位', fm, 'lose'], ['第３位', sf1, 'lose'], ['第３位', sf2, 'lose']];
  var yR = bottom + 34;
  g.hr(70, 740, yR, 1);
  for (i = 0; i < rows.length; i++) {
    var who = placeOf(rows[i][1], rows[i][2]);
    var yy = yR + 25 + i * 36;
    g.text(80, yy, rows[i][0], { size: 14, bold: true });
    if (who) {
      var nms = who.names && who.names.length ? who.names : [who.label, ''];
      var col = i === 0 ? RED : INK;
      g.text(160, yy, nms[0], { size: 15, spread: 100, bold: true, color: col });
      g.text(282, yy, '・', { size: 15, anchor: 'middle' });
      g.text(304, yy, nms[1], { size: 15, spread: 100, bold: true, color: col });
      g.text(420, yy, '（', { size: 13 });
      var fsch = schoolText(who) || who.sub || '';
      var fw = Math.min(270, fsch.length * 24);
      g.text(440, yy, fsch, { size: 13, spread: fw });
      g.text(446 + fw, yy, '）', { size: 13 });
    }
    g.hr(70, 740, yy + 11, 0.8);
  }
  return g.out(yR + 4 * 36 + 14);
}

/* 白紙用：組合せ（団体戦1回戦・個人戦予選リーグの顔ぶれ）だけ残し、結果と勝ち上がりを消す */
function blankOut(d) {
  d.ranks = {};
  var k;
  for (k in d.diff || {}) if (d.diff.hasOwnProperty(k)) d.diff[k].vals = {};
  var i, m;
  for (i = 0; i < d.matches.length; i++) {
    m = d.matches[i];
    m.state = '待機';
    m.winner = '';
    m.score = '';
    m.team = null;
    if (m.stage !== 'R1' && m.stage !== 'L') {
      m.left = { decided: false, label: '', sub: '', origin: m.left ? m.left.origin : '' };
      m.right = { decided: false, label: '', sub: '', origin: m.right ? m.right.origin : '' };
    }
  }
  return d;
}

