/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   試合中のカウント：数え方と表示（入力画面・進行表・４試合画面で共用）
   - 点の並び：L＝左（番号の小さい方・組合せ表の上）＝青、R＝右＝緑
   - 個人戦：７ゲームマッチ（４ゲーム先取）。団体戦：５ゲームマッチ（３ゲーム先取）。
     代表戦：勝ったペア同士で、ゲームカウント２−２から始まるファイナルゲーム（勝つと３−２）
   - 表示：ゲームは大きく、ポイントはゲームの下に小さく（灰色の帯の中）。横には並べない
   - ふつうのゲーム：４ポイント先取、３－３からは２点差。ファイナルゲーム：７ポイント先取、６－６からは２点差
   - ポイントの表示はカウンターと同じ：デュース＝Ｄ、アドバンテージ＝取った側がＡ・相手がＤ
   - 規約：ES5（var / function のみ）
   ============================================================ */
var LC = (function () {
  /* 区分の種類とマッチ番号（団体戦 0〜2＝第１〜第３マッチ、3＝代表戦）から、試合の決まり */
  function rule(type, mi) {
    if (type === 'team') return mi === 3 ? { gw: 3, start: 2, rep: true } : { gw: 3 };
    return { gw: 4 };
  }

  function pdisp(a, b, fin) {
    var t = fin ? 6 : 3;
    if (a >= t && b >= t) {
      if (a === b) return ['D', 'D'];
      return a > b ? ['A', 'D'] : ['D', 'A'];
    }
    return [String(a), String(b)];
  }

  /* 点の並びを数える */
  function count(seq, r) {
    var s = String(seq || '');
    var gL = r.start || 0, gR = r.start || 0, pL = 0, pR = 0, end = false, winner = '', games = [];
    var fin;
    var i, c, need, used = 0;
    for (i = 0; i < s.length && !end; i++) {
      c = s.charAt(i);
      used++;
      if (c === 'L') pL++; else pR++;
      fin = gL === r.gw - 1 && gR === r.gw - 1;
      need = fin ? 7 : 4;
      if ((pL >= need || pR >= need) && Math.abs(pL - pR) >= 2) {
        games.push(pL > pR ? 'L' : 'R');
        if (pL > pR) gL++; else gR++;
        pL = 0; pR = 0;
        if (gL >= r.gw || gR >= r.gw) { end = true; winner = gL > gR ? 'L' : 'R'; }
      }
    }
    fin = !end && gL === r.gw - 1 && gR === r.gw - 1;
    var d = pdisp(pL, pR, fin);
    return { gL: gL, gR: gR, pL: pL, pR: pR, dL: d[0], dR: d[1], fin: fin, end: end, winner: winner, games: games,
      gameNo: gL + gR + (end ? 0 : 1), used: used, extra: s.length - used, total: s.length,
      ptL: (s.slice(0, used).match(/L/g) || []).length, ptR: (s.slice(0, used).match(/R/g) || []).length };
  }

  function zen(n) { n = String(n); return n.length === 1 ? String.fromCharCode(0xFF10 + parseInt(n, 10)) : n; }

  function esc(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 今のゲームの呼び方（第４ゲーム／ファイナルゲーム／代表戦） */
  function gameLabel(c, r) {
    if (c.end) return '試合終了';
    if (r.rep) return '代表戦・ファイナルゲーム';
    if (c.fin) return 'ファイナルゲーム';
    return '第' + zen(c.gameNo) + 'ゲーム';
  }

  function mLabel(type, mi) {
    if (type !== 'team') return '';
    return mi === 3 ? '代表戦' : '第' + zen(mi + 1) + 'マッチ';
  }

  /* ポイントの帯（ゲームの下に小さく）。label＝「ポイント」の文字を付けるか */
  function ptBand(dL, dR, label) {
    return '<span class="lv-pt">' + (label ? '<span class="lv-pl">ポイント</span>' : '') +
      '<b class="cb">' + esc(dL) + '</b><i>−</i><b class="cg">' + esc(dR) + '</b></span>';
  }
  function circ(v, on) { return on ? '<span class="tb-o">' + v + '</span>' : String(v); }

  /* 個人戦の表示。o: { L: 青の名前のHTML, R: 緑の名前のHTML, c: count の結果, r: rule, foot: 下の行（なければゲームの呼び方）,
     size: 'l'（本部モニター）| 'm'（進行表）| 's'（スマホの２列表示：名前は番号だけ渡す）, head: 上の見出し } */
  function board(o) {
    var c = o.c, size = o.size || 'm';
    var h = '<div class="lv lv-' + size + (c.end ? ' lv-end' : '') + '">';
    if (o.head) h += '<div class="lv-t">' + o.head + '</div>';
    h += '<div class="lv-row"><span class="lv-nl">' + (o.L || '') + '</span>' +
      '<span class="lv-gm"><b class="cb">' + circ(c.gL, c.end && c.winner === 'L') + '</b><i>−</i><b class="cg">' + circ(c.gR, c.end && c.winner === 'R') + '</b></span>' +
      '<span class="lv-nr">' + (o.R || '') + '</span></div>';
    if (!c.end) h += '<div class="lv-pw">' + ptBand(c.dL, c.dR, size !== 's') + '</div>';
    h += '<div class="lv-f">' + (o.foot !== undefined ? o.foot : esc(gameLabel(c, o.r))) + '</div>';
    return h + '</div>';
  }

  /* ---------- 団体戦：１対戦をまとめて出す（マッチの勝ち数・第１〜第３マッチ・代表戦・審判） ----------
     o: { m: 試合（team.pairs を持つ）, live: その試合のカウント {マッチ番号: {s}}, size: 'l'|'m'|'s',
          L, R: 上の行のチーム名のHTML（なければ数字だけ）, ref: 審判のHTML（なければ出さない） }
     マッチの状態：本部が結果を入れた＝終了、カウントで終わった＝終了（本部確認中）、入力中＝試合中、それ以外＝試合前 */
  function pairTxt(a) { return a ? '<span class="tb-nw">' + esc(a[0]) + '・</span><span class="tb-nw">' + esc(a[1]) + '</span>' : ''; }
  function teamRows(m, live) {
    var t = m.team || { pairs: [] };
    var rows = [], i, p, rec, c, g;
    for (i = 0; i < 4; i++) {
      p = i < 3 ? (t.pairs[i] || {}) : {};
      rec = live ? live[String(i)] : null;
      var r = { i: i, pl: pairTxt(p.l), pr: pairTxt(p.r), st: 'pre' };
      if (i === 3 && !(rec && rec.s)) continue;
      if (p.kind === 'none') r.st = 'none';
      else if (p.kind === 'abort') r.st = 'abort';
      else if (p.w) {
        r.st = 'done'; r.w = p.w; r.official = true;
        g = /^(\d+|R)\s*[-－]\s*(\d+|R)/.exec(String(p.g || ''));
        if (p.kind === 'forfeit' || !g || g[1] === 'R' || g[2] === 'R') r.forfeit = true;
        else { r.gL = g[1]; r.gR = g[2]; }
      } else if (rec && rec.s) {
        c = count(rec.s, rule('team', i));
        if (c.end) { r.st = 'done'; r.w = c.winner; r.gL = c.gL; r.gR = c.gR; }
        else { r.st = 'live'; r.c = c; }
      }
      rows.push(r);
    }
    /* 代表戦：各チームの勝ったペア */
    var k, wpl = '', wpr = '';
    for (k = 0; k < rows.length; k++) if (rows[k].i < 3 && rows[k].st === 'done' && !rows[k].forfeit) { if (rows[k].w === 'L') wpl = rows[k].pl; else wpr = rows[k].pr; }
    for (k = 0; k < rows.length; k++) if (rows[k].i === 3) { rows[k].pl = wpl; rows[k].pr = wpr; }
    return rows;
  }
  /* １勝１敗のときの参考：コート主任の入力から計算した得失ゲーム数・得失ポイント数（不戦勝のマッチは入れない） */
  function teamDiff(m, live, rows) {
    var gl = 0, gr = 0, pl = 0, pr = 0, ok = true, i, r, rec, c, g, t = m.team || { pairs: [] };
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (r.i > 2 || r.st === 'none' || r.forfeit) continue;
      if (r.st !== 'done') return null;
      rec = live ? live[String(r.i)] : null;
      if (rec && rec.s) { c = count(rec.s, rule('team', r.i)); gl += c.gL; gr += c.gR; pl += c.ptL; pr += c.ptR; }
      else {
        ok = false;
        g = /^(\d+)\s*[-－]\s*(\d+)/.exec(String((t.pairs[r.i] || {}).g || ''));
        if (g) { gl += parseInt(g[1], 10); gr += parseInt(g[2], 10); }
      }
    }
    return { gl: gl, gr: gr, pl: pl, pr: pr, ptOk: ok };
  }
  function teamBlock(o) {
    var m = o.m, size = o.size || 'm';
    var rows = teamRows(m, o.live);
    var wL = 0, wR = 0, lives = [], firstPre = null, i, r;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (r.st === 'done' && r.i < 3) { if (r.w === 'L') wL++; else wR++; }
      if (r.st === 'live') lives.push(r.i);
      if (r.st === 'pre' && firstPre === null && r.i < 3) firstPre = r.i;
    }
    var decided = m.stage !== 'R1' && (wL >= 2 || wR >= 2);
    var stx;
    if (lives.length) {
      var ns = [];
      for (i = 0; i < lives.length; i++) ns.push(lives[i] === 3 ? '代表戦' : zen(lives[i] + 1));
      stx = lives[0] === 3 ? '代表戦試合中' : '第' + ns.join('・') + 'マッチ試合中';
    } else if (firstPre !== null && !decided) stx = '第' + zen(firstPre + 1) + 'マッチ前';
    else if (wL === wR) stx = wL + '勝' + wR + '敗・本部が判定中';
    else stx = '勝敗決定・本部確認中';
    var h = '<div class="tb tb-' + size + '">';
    h += '<div class="tb-h">' + (o.L !== undefined ? '<span class="tb-tl">' + o.L + '</span>' : '') +
      '<span class="tb-w"><b class="cb">' + wL + '</b><i>−</i><b class="cg">' + wR + '</b></span>' +
      (o.R !== undefined ? '<span class="tb-tr">' + o.R + '</span>' : '') + '</div>';
    h += '<div class="tb-st">（' + stx + '）</div>';
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      var lab = r.i === 3 ? '代表戦' : (size === 's' ? '第' + zen(r.i + 1) : '第' + zen(r.i + 1) + 'マッチ');
      var mid;
      if (r.st === 'none') mid = '<span class="tb-x">なし</span>';
      else if (r.st === 'abort') mid = '<span class="tb-x">打切</span>';
      else if (r.st === 'pre') mid = '<span class="tb-x">試合前</span>';
      else if (r.st === 'done' && r.forfeit) mid = '<span class="tb-g"><b class="cb">' + (r.w === 'L' ? circ(3, true) : 'Ｒ') + '</b><i>−</i><b class="cg">' + (r.w === 'R' ? circ(3, true) : 'Ｒ') + '</b></span>';
      else if (r.st === 'done') mid = '<span class="tb-g"><b class="cb">' + circ(r.gL, r.w === 'L') + '</b><i>−</i><b class="cg">' + circ(r.gR, r.w === 'R') + '</b></span>' +
        (size === 's' ? '' : '<small class="tb-sm">' + (r.official ? '試合終了' : '試合終了・本部確認中') + '</small>');
      else {
        var c = r.c;
        mid = '<span class="tb-g tb-now"><b class="cb">' + c.gL + '</b><i>−</i><b class="cg">' + c.gR + '</b></span>' +
          ptBand(c.dL, c.dR, size !== 's') +
          (size === 's' ? '' : '<small class="tb-sm">' + esc(gameLabel(c, rule('team', r.i))) + '</small>');
      }
      h += '<div class="tb-r tb-' + r.st + '"><span class="tb-lab">' + lab + '</span>' +
        (size === 's' ? '' : '<span class="tb-pl">' + r.pl + '</span>') + '<span class="tb-mid">' + mid + '</span>' +
        (size === 's' ? '' : '<span class="tb-pr">' + r.pr + '</span>') + '</div>';
    }
    /* 1勝1敗（勝ち数が同じ）で、３つのマッチが終わったとき：得失の参考（本部モニターだけ） */
    if (o.diff && wL === wR && firstPre === null && !lives.length) {
      var d = teamDiff(m, o.live, rows);
      if (d) h += '<div class="tb-df"><b>参考（コート主任の入力から計算）</b>　得失ゲーム数　<span class="cb">青 ' + d.gl + '</span> − <span class="cg">' + d.gr + ' 緑</span>' +
        '　／　得失ポイント数　' + (d.ptOk ? '<span class="cb">青 ' + d.pl + '</span> − <span class="cg">' + d.pr + ' 緑</span>' : '入力のないマッチがあり計算できません') +
        '<br>正式な判定は、本部が採点票で行います。同じときは代表戦（勝ったペア同士、ゲームカウント２−２のファイナルゲーム）。</div>';
    }
    if (o.ref) h += '<div class="tb-ref">審判 ' + o.ref + '</div>';
    return h + '</div>';
  }

  /* 表示用の色と形（ページに１回だけ入れる） */
  var CSS = '.lv,.tb{--lb:#0a62e0;--lg:#12940f}' +
    '.lv .cb,.tb .cb{color:var(--lb)}.lv .cg,.tb .cg{color:var(--lg)}' +
    '.lv i,.tb i{font-style:normal;color:#555;margin:0 .25em}' +
    /* ポイントの帯：ゲームの下に小さく */
    '.lv-pt{display:inline-flex;align-items:baseline;gap:0;background:#eef0ee;border:1px solid #d5dad5;border-radius:999px;padding:0 .7em;font-weight:900;font-size:.9rem;line-height:1.45;white-space:nowrap}' +
    '.lv-pl{font-size:.62rem;font-weight:700;color:#666;margin-right:.5em}' +
    '.tb-o{display:inline-block;border:2px solid currentColor;border-radius:50%;min-width:1.35em;line-height:1.2em;text-align:center}' +
    /* 個人戦 */
    '.lv{border:1.5px solid #d6dbd6;border-radius:8px;background:#fff;padding:5px 8px 0;font-family:inherit;overflow:hidden}' +
    '.lv-t{font-size:.7rem;font-weight:900;color:#333}' +
    '.lv-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}' +
    '.lv-nl,.lv-nr{min-width:0;font-size:.8rem;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:4px;flex-wrap:wrap}' +
    '.lv-nl{justify-content:flex-end;text-align:right}' +
    '.lv-gm{font-size:1.7rem;font-weight:900;white-space:nowrap;line-height:1.15}' +
    '.lv-pw{text-align:center;margin:1px 0 3px}' +
    '.lv-f{font-size:.66rem;font-weight:700;color:#555;text-align:center;padding:2px 6px 3px;margin:0 -8px;background:#f6f7f4;border-top:1px solid #eef0ee}' +
    '.lv-end .lv-f{color:#8a4b00;background:#fff3cd}' +
    '.lv-l{padding:8px 12px 0}.lv-l .lv-gm{font-size:2.8rem}.lv-l .lv-nl,.lv-l .lv-nr{font-size:1.05rem}.lv-l .lv-pt{font-size:1.3rem}.lv-l .lv-pl{font-size:.75rem}' +
    '.lv-l .lv-f{font-size:.88rem;padding:4px;margin:0 -12px}.lv-l .lv-t{font-size:.9rem}' +
    '.lv-s{padding:3px 4px 0}.lv-s .lv-row{gap:3px}.lv-s .lv-gm{font-size:1.25rem}.lv-s .lv-pt{font-size:.74rem;padding:0 .5em}.lv-s .lv-f{font-size:.58rem;margin:0 -4px;padding:1px 3px 2px}' +
    /* 団体戦の１対戦 */
    '.tb{background:#fff;border:1.5px solid #d6dbd6;border-radius:8px;padding:6px 8px 8px;font-family:inherit}' +
    '.tb-h{display:flex;align-items:center;justify-content:center;gap:10px}' +
    '.tb-tl,.tb-tr{flex:1;min-width:0;font-weight:900;display:flex;align-items:center;gap:4px;flex-wrap:wrap}' +
    '.tb-tl{justify-content:flex-end;text-align:right}' +
    '.tb-w{font-size:1.5rem;font-weight:900;white-space:nowrap}' +
    '.tb-st{text-align:center;font-size:.8rem;font-weight:700;color:#333;margin:0 0 4px}' +
    '.tb-r{display:grid;grid-template-columns:4.6em 1fr 5.8em 1fr;align-items:center;gap:4px;padding:3px 0;border-top:1px dashed #e1e5e1}' +
    '.tb-lab{font-size:.72rem;color:#555;font-weight:700}' +
    '.tb-pl{text-align:right;font-size:.8rem;font-weight:700}.tb-pr{font-size:.8rem;font-weight:700}' +
    '.tb-nw{white-space:nowrap;display:inline-block}' +
    '.tb-mid{text-align:center;display:flex;flex-direction:column;align-items:center;line-height:1.1}' +
    '.tb-g{font-size:1.15rem;font-weight:900;white-space:nowrap}' +
    '.tb-now{font-size:1.5rem}' +
    '.tb-mid .lv-pt{font-size:.8rem;margin-top:1px}' +
    '.tb-df{font-size:.78rem;line-height:1.6;background:#fffbea;border:1.5px solid #e6d28c;border-radius:6px;padding:4px 8px;margin-top:6px}' +
    '.tb-sm{font-size:.6rem;color:#666;font-weight:500;margin-top:1px;white-space:nowrap}' +
    '.tb-x{font-size:.8rem;color:#888;font-weight:700}' +
    '.tb-ff{font-size:.8rem;font-weight:900}' +
    '.tb-live{background:#fff8e1}' +
    '.tb-ref{font-size:.85rem;font-weight:900;color:#333;margin-top:4px}' +
    '.tb-l .tb-w{font-size:2.1rem}.tb-l .tb-st{font-size:.95rem}.tb-l .tb-tl,.tb-l .tb-tr{font-size:1.05rem}' +
    '.tb-l .tb-r{grid-template-columns:6em 1fr 8em 1fr;padding:5px 0}.tb-l .tb-lab{font-size:.85rem}' +
    '.tb-l .tb-pl,.tb-l .tb-pr{font-size:1rem}.tb-l .tb-g{font-size:1.5rem}.tb-l .tb-now{font-size:2.1rem}.tb-l .tb-mid .lv-pt{font-size:1.1rem}.tb-l .tb-sm{font-size:.72rem}' +
    '.tb-s{padding:4px 5px 5px}.tb-s .tb-w{font-size:1.15rem}.tb-s .tb-st{font-size:.62rem}' +
    '.tb-s .tb-r{grid-template-columns:2.4em 1fr;gap:2px;padding:2px 0}.tb-s .tb-lab{font-size:.62rem}' +
    '.tb-s .tb-g{font-size:.95rem}.tb-s .tb-now{font-size:1.1rem}.tb-s .tb-mid .lv-pt{font-size:.68rem;padding:0 .45em}.tb-s .tb-x{font-size:.66rem}';
  function css() {
    if (document.getElementById('lvCss')) return;
    var st = document.createElement('style');
    st.id = 'lvCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  return { rule: rule, count: count, board: board, gameLabel: gameLabel, mLabel: mLabel, zen: zen, css: css, esc: esc, teamBlock: teamBlock };
})();
