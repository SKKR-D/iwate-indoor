/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会
   試合中のカウント：数え方と表示（入力画面・進行表・４試合画面で共用）
   - 点の並び：L＝左（番号の小さい方・組合せ表の上）＝青、R＝右＝緑
   - 個人戦：７ゲームマッチ（４ゲーム先取）。団体戦：５ゲームマッチ（３ゲーム先取）。代表戦：ファイナルゲーム１つ
   - ふつうのゲーム：４ポイント先取、３－３からは２点差。ファイナルゲーム：７ポイント先取、６－６からは２点差
   - ポイントの表示はカウンターと同じ：デュース＝Ｄ、アドバンテージ＝取った側がＡ・相手がＤ
   - 規約：ES5（var / function のみ）
   ============================================================ */
var LC = (function () {
  /* 区分の種類とマッチ番号（団体戦 0〜2＝第１〜第３マッチ、3＝代表戦）から、試合の決まり */
  function rule(type, mi) {
    if (type === 'team') return mi === 3 ? { gw: 1, rep: true } : { gw: 3 };
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
    var gL = 0, gR = 0, pL = 0, pR = 0, end = false, winner = '', games = [];
    var fin;
    var i, c, need, used = 0;
    for (i = 0; i < s.length && !end; i++) {
      c = s.charAt(i);
      used++;
      if (c === 'L') pL++; else pR++;
      fin = !!r.rep || (gL === r.gw - 1 && gR === r.gw - 1 && r.gw > 1);
      need = fin ? 7 : 4;
      if ((pL >= need || pR >= need) && Math.abs(pL - pR) >= 2) {
        games.push(pL > pR ? 'L' : 'R');
        if (pL > pR) gL++; else gR++;
        pL = 0; pR = 0;
        if (gL >= r.gw || gR >= r.gw) { end = true; winner = gL > gR ? 'L' : 'R'; }
      }
    }
    fin = !end && (!!r.rep || (gL === r.gw - 1 && gR === r.gw - 1 && r.gw > 1));
    var d = pdisp(pL, pR, fin);
    return { gL: gL, gR: gR, pL: pL, pR: pR, dL: d[0], dR: d[1], fin: fin, end: end, winner: winner, games: games,
      gameNo: gL + gR + (end ? 0 : 1), used: used, extra: s.length - used, total: s.length };
  }

  function zen(n) { n = String(n); return n.length === 1 ? String.fromCharCode(0xFF10 + parseInt(n, 10)) : n; }

  function esc(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 今のゲームの呼び方（第４ゲーム／ファイナルゲーム／代表戦） */
  function gameLabel(c, r) {
    if (c.end) return '試合終了';
    if (r.rep) return '代表戦（ファイナルゲーム）';
    if (c.fin) return 'ファイナルゲーム';
    return '第' + zen(c.gameNo) + 'ゲーム';
  }

  function mLabel(type, mi) {
    if (type !== 'team') return '';
    return mi === 3 ? '代表戦' : '第' + zen(mi + 1) + 'マッチ';
  }

  /* ２段表示。o: { L: 名前のHTML, R: 名前のHTML, c: count の結果, r: rule, foot: 下の行（なければゲームの呼び方）, size: 'm'|'l', head: 上の見出し } */
  function board(o) {
    var c = o.c;
    var h = '<div class="lv' + (o.size === 'l' ? ' lv-l' : '') + (c.end ? ' lv-end' : '') + '">';
    if (o.head) h += '<div class="lv-t">' + o.head + '</div>';
    h += '<div class="lv-h"><span></span><span>ゲーム</span><span>ポイント</span></div>';
    var rows = [['L', 'cb', c.gL, c.dL], ['R', 'cg', c.gR, c.dR]];
    var i;
    for (i = 0; i < 2; i++) {
      var won = c.end && c.winner === rows[i][0];
      h += '<div class="lv-r lv-' + rows[i][1] + (won ? ' lv-w' : '') + '"><span class="lv-n">' + (o[rows[i][0]] || '') + '</span>' +
        '<span class="lv-g">' + rows[i][2] + '</span><span class="lv-p">' + (c.end ? '' : esc(rows[i][3])) + '</span></div>';
    }
    h += '<div class="lv-f">' + (o.foot !== undefined ? o.foot : esc(gameLabel(c, o.r))) + '</div>';
    return h + '</div>';
  }

  /* 表示用の色と形（ページに１回だけ入れる） */
  var CSS = '.lv{--lb:#0a62e0;--lg:#12940f;border:1.5px solid #d6dbd6;border-radius:8px;background:#fff;overflow:hidden;font-family:inherit}' +
    '.lv-t{font-size:.7rem;font-weight:900;color:#333;padding:3px 8px 0}' +
    '.lv-h{display:grid;grid-template-columns:1fr 3.6em 3.8em;color:#666;font-weight:700;padding:2px 6px 0 13px}' +
    '.lv-h span{text-align:center;white-space:nowrap;font-size:.6rem}' +
    '.lv-r{display:grid;grid-template-columns:1fr 3.6em 3.8em;align-items:center;border-left:7px solid;padding:2px 6px 2px 6px;min-height:2.2em}' +
    '.lv-r+.lv-r{border-top:1px solid #eef0ee}' +
    '.lv-cb{border-left-color:var(--lb)}.lv-cg{border-left-color:var(--lg)}' +
    '.lv-n{min-width:0;overflow:hidden;font-size:.78rem;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:4px;flex-wrap:wrap}' +
    '.lv-r>.lv-g{font-size:1.55rem;font-weight:900;text-align:center;line-height:1;border:2px solid currentColor;border-radius:5px;margin:2px 4px;padding:1px 0}' +
    '.lv-p{font-size:1.05rem;font-weight:900;text-align:center;line-height:1}' +
    '.lv-cb>.lv-g,.lv-cb>.lv-p{color:var(--lb)}' +
    '.lv-cg>.lv-g,.lv-cg>.lv-p{color:var(--lg)}' +
    '.lv-w{background:#fff8dc}' +
    '.lv-f{font-size:.68rem;font-weight:700;color:#555;text-align:center;padding:2px 6px 3px;background:#f6f7f4;border-top:1px solid #eef0ee}' +
    '.lv-end .lv-f{color:#8a4b00;background:#fff3cd}' +
    '.lv-l .lv-h{grid-template-columns:1fr 5em 5em;padding-left:18px}' +
    '.lv-l .lv-h span{font-size:.8rem}' +
    '.lv-l .lv-r{grid-template-columns:1fr 5em 5em;min-height:3.6em;border-left-width:12px}' +
    '.lv-l .lv-n{font-size:1.05rem}' +
    '.lv-l .lv-r>.lv-g{font-size:2.6rem;border-width:3px;border-radius:8px}' +
    '.lv-l .lv-p{font-size:1.8rem}' +
    '.lv-l .lv-f{font-size:.9rem;padding:4px}' +
    '.lv-l .lv-t{font-size:.9rem}';
  function css() {
    if (document.getElementById('lvCss')) return;
    var st = document.createElement('style');
    st.id = 'lvCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  return { rule: rule, count: count, board: board, gameLabel: gameLabel, mLabel: mLabel, zen: zen, css: css, esc: esc };
})();
