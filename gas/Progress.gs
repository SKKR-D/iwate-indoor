/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会 システム
   組合せ・進行表（フェーズ3）
   - Code.gs と同じプロジェクトに「Progress.gs」として追加する
   - 規約：ES5（var / function のみ）
   ============================================================ */

var BLOCKS = ['A', 'B', 'C', 'D'];
/* 予選リーグ（4ペア総当たり）の試合順：1-2、3-4、1-3、2-4、2-3、1-4 */
var LEAGUE_ROUNDS = [[[1, 2], [3, 4]], [[1, 3], [2, 4]], [[2, 3], [1, 4]]];
/* 決勝トーナメント：A1位-C2位、D2位-B1位、C1位-A2位、B2位-D1位 */
var KO_QF = [['A1', 'C2'], ['D2', 'B1'], ['C1', 'A2'], ['B2', 'D1']];
var STATES = ['待機', '呼出', '試合中', '終了'];
/* 予選リーグの審判（リーグ内）：試合（枠番号の組）→ 審判をする枠番号。各ペア1〜2回 */
var LEAGUE_REFS = { '12': 3, '34': 1, '13': 4, '24': 1, '23': 4, '14': 2 };

function drawSlots_(divCode) {
  var div = DIVISIONS[divCode];
  var out = [];
  var i, j;
  if (div.type === 'team') {
    for (i = 1; i <= 16; i++) out.push(String(i));
  } else {
    for (i = 0; i < BLOCKS.length; i++) for (j = 1; j <= 4; j++) out.push(BLOCKS[i] + j);
  }
  return out;
}

/* ============================================================
   表示名
   ============================================================ */
function surname_(name) {
  var s = String(name || '').trim();
  var m = s.split(/[\s　]+/);
  return m.length > 1 ? m[0] : s;
}

function plainName_(name) { return String(name || '').replace(/[\s　]+/g, ''); }

function gradeCirc_(g) { return ['', '①', '②', '③'][toInt_(g)] || ''; }

function teamShort_(entryRow) {
  if (!entryRow) return '';
  return entryRow['略称'] || suggestAbbr_(entryRow['チーム名']);
}

/* 区分の参加者（チーム・ペア）の表示情報 */
function participants_(divCode) {
  var div = DIVISIONS[divCode];
  var t = table_(SHEET_ENTRY);
  var abbrOf = {};
  var out = {};
  var i, r;
  for (i = 0; i < t.rows.length; i++) {
    r = t.rows[i];
    if (r['区分'] === divCode) abbrOf[r['チーム名']] = teamShort_(r);
    if (div.type === 'team' && r['区分'] === divCode) {
      out[r.entryId] = { id: r.entryId, label: teamShort_(r), full: r['チーム名'], sub: districtName_(r['地区']), state: r['状態'] || '未申込' };
    }
  }
  if (div.type === 'indiv') {
    var pt = table_(SHEET_PAIR);
    for (i = 0; i < pt.rows.length; i++) {
      r = pt.rows[i];
      if (r['区分'] !== divCode) continue;
      var ta = abbrOf[r['A所属']] || suggestAbbr_(r['A所属']);
      var tb = abbrOf[r['B所属']] || suggestAbbr_(r['B所属']);
      out[r.pairId] = {
        id: r.pairId,
        /* 表示はフルネーム（登録名簿の空白の有無で表記が変わらないよう、空白を除いて統一） */
        label: plainName_(r['A氏名']) + '・' + plainName_(r['B氏名']),
        labelG: plainName_(r['A氏名']) + gradeCirc_(r['A学年']) + '・' + plainName_(r['B氏名']) + gradeCirc_(r['B学年']),
        full: r['A氏名'] + '・' + r['B氏名'],
        sub: ta === tb ? ta : ta + '／' + tb,
        state: '',
        names: [r['A氏名'], r['B氏名']],
        grades: [r['A学年'], r['B学年']],
        teams: [ta, tb],
        teamsFull: [r['A所属'], r['B所属']],
        changed: r['変更記録'] ? 1 : 0
      };
    }
  }
  return out;
}

/* ============================================================
   組合せ（管理画面）
   ============================================================ */
function adminDrawLoad_(body) {
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var people = participants_(body.div);
  var list = [];
  var k;
  for (k in people) if (people.hasOwnProperty(k)) list.push(people[k]);
  if (div.type === 'team') {
    list.sort(function (a, b) { return districtCompare_(a.sub, b.sub) || String(a.full).localeCompare(String(b.full), 'ja'); });
  }
  var draw = {};
  var dt = table_(SHEET_DRAW);
  var i;
  for (i = 0; i < dt.rows.length; i++) if (dt.rows[i]['区分'] === body.div) draw[dt.rows[i]['枠']] = dt.rows[i]['対象ID'];
  var mt = table_(SHEET_MATCH);
  var count = 0;
  var progressed = 0;
  for (i = 0; i < mt.rows.length; i++) {
    if (mt.rows[i]['区分'] !== body.div) continue;
    count++;
    if (mt.rows[i]['状態'] && mt.rows[i]['状態'] !== '待機' && mt.rows[i]['備考'] !== '不戦勝') progressed++;
  }
  return { status: 'ok', slots: drawSlots_(body.div), draw: draw, candidates: list, matchCount: count, progressed: progressed };
}

function adminDrawSave_(body) {
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var people = participants_(body.div);
  var slots = drawSlots_(body.div);
  var a = body.assign || {};
  var used = {};
  var rows = [];
  var i, id;
  for (i = 0; i < slots.length; i++) {
    id = a[slots[i]] || '';
    if (!id) continue;
    if (!people[id]) throw new Error('枠' + slots[i] + 'の選択が正しくありません。');
    if (used[id]) throw new Error('「' + people[id].label + '」が2つの枠に入っています（' + used[id] + '・' + slots[i] + '）。');
    used[id] = slots[i];
    rows.push([body.div, slots[i], id]);
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var dt = table_(SHEET_DRAW);
    for (i = dt.rows.length - 1; i >= 0; i--) if (dt.rows[i]['区分'] === body.div) dt.sheet.deleteRow(dt.rows[i]._row);
    for (i = 0; i < rows.length; i++) appendObj_(table_(SHEET_DRAW), { '区分': rows[i][0], '枠': rows[i][1], '対象ID': rows[i][2] });
  } finally {
    lock.releaseLock();
  }
  log_('組合せ保存', div.name + '：' + rows.length + '/' + slots.length + (body.by ? '（' + body.by + '）' : ''));
  return { status: 'ok', filled: rows.length, total: slots.length };
}

/* 組合せから試合を作る（既定のコート割り・順番つき） */
function adminGenerate_(body) {
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var draw = {};
  var dt = table_(SHEET_DRAW);
  var i;
  for (i = 0; i < dt.rows.length; i++) if (dt.rows[i]['区分'] === body.div) draw[dt.rows[i]['枠']] = dt.rows[i]['対象ID'];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mt = table_(SHEET_MATCH);
    var existing = [];
    for (i = 0; i < mt.rows.length; i++) if (mt.rows[i]['区分'] === body.div) existing.push(mt.rows[i]);
    for (i = 0; i < existing.length; i++) {
      if (existing[i]['状態'] && existing[i]['状態'] !== '待機' && existing[i]['備考'] !== '不戦勝' && !body.force) {
        throw new Error('すでに試合が始まっています。作り直すと結果が消えます（作り直す場合は確認のうえ再実行）。');
      }
    }
    for (i = existing.length - 1; i >= 0; i--) mt.sheet.deleteRow(existing[i]._row);
    var ms = div.type === 'team' ? teamTemplate_(body.div, draw) : indivTemplate_(body.div, draw);
    var stamp = now_();
    var rows = [];
    for (i = 0; i < ms.length; i++) {
      var m = ms[i];
      rows.push([m.id, body.div, m.stage, m.round, String(m.no), m.left, m.right, m.court, String(m.seq), m.two ? '1' : '', m.state || '待機', '', '', m.winner || '', m.score || '', m.note || '', stamp]);
    }
    var sh = ss_().getSheetByName(SHEET_MATCH);
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setNumberFormat('@').setValues(rows);
    if (div.type === 'indiv') {
      var rt = table_(SHEET_RANK);
      for (i = rt.rows.length - 1; i >= 0; i--) if (rt.rows[i]['区分'] === body.div) rt.sheet.deleteRow(rt.rows[i]._row);
    }
  } finally {
    lock.releaseLock();
  }
  log_('進行表作成', div.name + '：' + rows.length + '試合');
  return { status: 'ok', count: rows.length };
}

function ref_(kind, id) { return id ? kind + ':' + id : ''; }

function teamTemplate_(divCode, draw) {
  var ms = [];
  var i, l, r;
  /* 1回戦：Aコート＝第1〜4試合、Bコート＝第5〜8試合 */
  for (i = 0; i < 8; i++) {
    l = draw[String(i * 2 + 1)] || '';
    r = draw[String(i * 2 + 2)] || '';
    var m = { id: divCode + '-R1-' + (i + 1), stage: 'R1', round: '1回戦', no: i + 1, left: ref_('E', l), right: ref_('E', r),
      court: i < 4 ? 'A' : 'B', seq: i < 4 ? (i * 2 + 1) : ((i - 4) * 2 + 2) };
    if (!l || !r) {
      m.state = '終了';
      m.winner = l ? 'L' : (r ? 'R' : '');
      m.score = '不戦勝';
      m.note = '不戦勝';
    }
    ms.push(m);
  }
  var w = function (n) { return 'W:' + divCode + '-R1-' + n; };
  ms.push({ id: divCode + '-QF-1', stage: 'QF', round: '準々決勝', no: 9, left: w(1), right: w(2), court: 'A', seq: 9 });
  ms.push({ id: divCode + '-QF-3', stage: 'QF', round: '準々決勝', no: 11, left: w(5), right: w(6), court: 'B', seq: 10 });
  ms.push({ id: divCode + '-QF-2', stage: 'QF', round: '準々決勝', no: 10, left: w(3), right: w(4), court: 'A', seq: 11 });
  ms.push({ id: divCode + '-QF-4', stage: 'QF', round: '準々決勝', no: 12, left: w(7), right: w(8), court: 'B', seq: 12 });
  ms.push({ id: divCode + '-SF-1', stage: 'SF', round: '準決勝', no: 13, left: 'W:' + divCode + '-QF-1', right: 'W:' + divCode + '-QF-2', court: 'A', seq: 13 });
  ms.push({ id: divCode + '-SF-2', stage: 'SF', round: '準決勝', no: 14, left: 'W:' + divCode + '-QF-3', right: 'W:' + divCode + '-QF-4', court: 'B', seq: 14 });
  ms.push({ id: divCode + '-F', stage: 'F', round: '決勝', no: 15, left: 'W:' + divCode + '-SF-1', right: 'W:' + divCode + '-SF-2', court: 'A', seq: 15, two: true });
  return ms;
}

function indivTemplate_(divCode, draw) {
  var ms = [];
  var courts = { A: ['A', 'B'], B: ['C', 'D'] };
  var seqOf = { A: 1, B: 2 };
  var no = 0;
  var tmp = [];
  var c, r, bi, k, blk, pr, l, rr;
  /* 予選リーグ：Aコート＝A・Bブロック、Bコート＝C・Dブロック。1試合ずつブロックを交互に（A1-2 → B1-2 → A3-4 → B3-4 …） */
  for (c in courts) {
    if (!courts.hasOwnProperty(c)) continue;
    for (r = 0; r < LEAGUE_ROUNDS.length; r++) {
      for (k = 0; k < LEAGUE_ROUNDS[r].length; k++) {
        for (bi = 0; bi < courts[c].length; bi++) {
          blk = courts[c][bi];
          pr = LEAGUE_ROUNDS[r][k];
          l = draw[blk + pr[0]] || '';
          rr = draw[blk + pr[1]] || '';
          if (!l || !rr) continue;
          tmp.push({ id: divCode + '-L-' + blk + pr[0] + pr[1], stage: 'L', block: blk, round: blk + 'ブロック（' + pr[0] + '-' + pr[1] + '）',
            left: ref_('P', l), right: ref_('P', rr), court: c, seq: seqOf[c] });
          seqOf[c] += 2;
        }
      }
    }
  }
  tmp.sort(function (a, b) { return a.seq - b.seq; });
  for (k = 0; k < tmp.length; k++) { tmp[k].no = ++no; ms.push(tmp[k]); }
  var base = Math.max(seqOf.A, seqOf.B);
  var q;
  for (q = 0; q < KO_QF.length; q++) {
    ms.push({ id: divCode + '-QF-' + (q + 1), stage: 'QF', round: '決勝T 準々決勝', no: ++no, left: 'R:' + KO_QF[q][0], right: 'R:' + KO_QF[q][1],
      court: q % 2 === 0 ? 'A' : 'B', seq: base + q });
  }
  ms.push({ id: divCode + '-SF-1', stage: 'SF', round: '決勝T 準決勝', no: ++no, left: 'W:' + divCode + '-QF-1', right: 'W:' + divCode + '-QF-2', court: 'A', seq: base + 4 });
  ms.push({ id: divCode + '-SF-2', stage: 'SF', round: '決勝T 準決勝', no: ++no, left: 'W:' + divCode + '-QF-3', right: 'W:' + divCode + '-QF-4', court: 'B', seq: base + 5 });
  ms.push({ id: divCode + '-F', stage: 'F', round: '決勝', no: ++no, left: 'W:' + divCode + '-SF-1', right: 'W:' + divCode + '-SF-2', court: 'A', seq: base + 6 });
  return ms;
}

/* ============================================================
   進行表データ（公開・本部共通）
   ============================================================ */
function hm_(min) {
  if (min === null || min === undefined || isNaN(min)) return '';
  var h = Math.floor(min / 60);
  var m = Math.round(min % 60);
  if (m === 60) { h++; m = 0; }
  return h + ':' + (m < 10 ? '0' : '') + m;
}

function toMin_(s) {
  var m = String(s || '').match(/(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return m ? toInt_(m[1]) * 60 + toInt_(m[2]) : null;
}

function nowMin_() {
  return toMin_(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'HH:mm'));
}

function loadMatches_(divCode) {
  var mt = table_(SHEET_MATCH);
  var out = [];
  var i, r;
  for (i = 0; i < mt.rows.length; i++) {
    r = mt.rows[i];
    if (r['区分'] !== divCode) continue;
    out.push({
      _row: r, id: r.matchId, stage: r['段階'], round: r['ラウンド'], no: toInt_(r['番号']), left: r['左'], right: r['右'],
      court: r['コート'] || 'A', seq: toInt_(r['順番']), two: r['2面'] === '1', state: r['状態'] || '待機',
      start: r['開始'], end: r['終了'], winner: r['勝者'], score: r['スコア'], note: r['備考'],
      orderL: parseJson_(r['オーダー左'], null), orderR: parseJson_(r['オーダー右'], null), pairs: parseJson_(r['番手'], []), tb: parseJson_(r['判定'], {}), pub: r['オーダー公開'] || ''
    });
  }
  out.sort(function (a, b) { return a.seq - b.seq || a.no - b.no; });
  return out;
}

function loadRanks_(divCode) {
  var rt = table_(SHEET_RANK);
  var ranks = {};
  var i;
  for (i = 0; i < rt.rows.length; i++) {
    if (rt.rows[i]['区分'] !== divCode) continue;
    ranks[rt.rows[i]['ブロック'] + '1'] = rt.rows[i]['1位'];
    ranks[rt.rows[i]['ブロック'] + '2'] = rt.rows[i]['2位'];
    if (rt.rows[i]['3位']) ranks[rt.rows[i]['ブロック'] + '3'] = rt.rows[i]['3位'];
  }
  return ranks;
}

/* 予選リーグ表の「得失」欄：本部が表示を選んだブロックだけ、入力した組だけに出す
   kind：'' は出さない。個人戦は ゲーム／ポイント、団体戦のリーグでは マッチ も選べる */
var DIFF_KINDS = { indiv: ['ゲーム', 'ポイント'], team: ['マッチ', 'ゲーム', 'ポイント'] };

function loadDiff_(divCode) {
  var rt = table_(SHEET_RANK);
  var out = {};
  var i, r, vals;
  for (i = 0; i < rt.rows.length; i++) {
    r = rt.rows[i];
    if (r['区分'] !== divCode || !r['得失表示']) continue;
    vals = {};
    try { vals = JSON.parse(r['得失値'] || '{}') || {}; } catch (e) { vals = {}; }
    out[r['ブロック']] = { kind: String(r['得失表示']), label: '得失' + r['得失表示'], vals: vals };
  }
  return out;
}

/* 「+3」「-2」「0」の形にそろえる。空欄は出さない。数字でなければエラー */
function normDiff_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim()
    .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
    .replace(/[＋]/g, '+').replace(/[−－ー‐]/g, '-').replace(/\s/g, '');
  if (s === '') return '';
  if (!/^[+\-]?\d{1,3}$/.test(s)) return null;
  var n = parseInt(s, 10);
  return n > 0 ? '+' + n : String(n);
}

/* 参照（E:/P:/W:/R:）を参加者IDに解決。未確定なら null */
function resolveRef_(ref, byId, ranks, depth) {
  if (!ref) return null;
  var kind = ref.charAt(0);
  var key = ref.slice(2);
  if (kind === 'E' || kind === 'P') return key;
  if (kind === 'R') return ranks[key] || null;
  if (kind === 'W') {
    var m = byId[key];
    if (!m || !m.winner || (depth || 0) > 6) return null;
    return resolveRef_(m.winner === 'L' ? m.left : m.right, byId, ranks, (depth || 0) + 1);
  }
  return null;
}

function refPlaceholder_(ref, byId) {
  if (!ref) return '（なし）';
  var kind = ref.charAt(0);
  var key = ref.slice(2);
  if (kind === 'R') return key.charAt(0) + 'ブロック' + key.charAt(1) + '位';
  if (kind === 'W') return byId[key] ? '第' + byId[key].no + '試合の勝者' : '勝者';
  return '';
}

function matchDuration_(m, div, cfg) {
  if (div.type === 'indiv') return toInt_(cfg['7ゲーム目安（分）']) || 30;
  var g5 = toInt_(cfg['5ゲーム目安（分）']) || 20;
  return m.two ? g5 * 2 : g5 * 3;
}

/* 予定時刻の計算：コートの空き・前の試合の終了＋間隔・同じ選手の連戦を考慮 */
function computeTimes_(ms, div, cfg, ranksReady) {
  var byId = {};
  var i;
  for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
  var dayStart = toMin_(cfg['競技開始時刻']) || 540;
  var gap = div.type === 'team' ? toInt_(cfg['団体戦の次戦までの間隔（分）']) : toInt_(cfg['個人戦の次戦までの間隔（分）']);
  var live = false;
  for (i = 0; i < ms.length; i++) if (ms[i].start && ms[i].note !== '不戦勝') live = true;
  var now = live ? nowMin_() : null;
  var est = {};
  var blockEnd = {};
  var iter, m, free, lastEnd, dur, start, end, ready, sides, s, ref, k;
  for (iter = 0; iter < 4; iter++) {
    free = { A: dayStart, B: dayStart };
    lastEnd = {};
    blockEnd = {};
    for (i = 0; i < ms.length; i++) {
      m = ms[i];
      if (m.note === '不戦勝') { est[m.id] = { start: null, end: dayStart }; continue; }
      dur = matchDuration_(m, div, cfg);
      ready = dayStart;
      sides = [m.left, m.right];
      for (s = 0; s < 2; s++) {
        ref = sides[s];
        if (!ref) continue;
        if (ref.charAt(0) === 'W' && est[ref.slice(2)]) ready = Math.max(ready, est[ref.slice(2)].end + gap);
        if (ref.charAt(0) === 'W' && !est[ref.slice(2)] && byId[ref.slice(2)]) ready = Math.max(ready, dayStart + dur + gap);
        if (ref.charAt(0) === 'R') {
          k = ref.charAt(2);
          if (blockEnd[k] !== undefined) ready = Math.max(ready, blockEnd[k] + gap);
        }
        if ((ref.charAt(0) === 'E' || ref.charAt(0) === 'P') && lastEnd[ref] !== undefined) ready = Math.max(ready, lastEnd[ref] + gap);
      }
      var courtFree = m.two ? Math.max(free.A, free.B) : free[m.court];
      if (m.state === '終了' && m.start) {
        start = toMin_(m.start);
        end = toMin_(m.end) || start + dur;
      } else if (m.state === '試合中' && m.start) {
        start = toMin_(m.start);
        end = start + dur;
        if (now !== null) end = Math.max(end, now + 5);
      } else {
        start = Math.max(courtFree, ready);
        if (now !== null) start = Math.max(start, now);
        end = start + dur;
      }
      est[m.id] = { start: start, end: end };
      if (m.two) { free.A = Math.max(free.A, end); free.B = Math.max(free.B, end); } else { free[m.court] = Math.max(free[m.court], end); }
      for (s = 0; s < 2; s++) if (sides[s] && (sides[s].charAt(0) === 'E' || sides[s].charAt(0) === 'P')) lastEnd[sides[s]] = end;
      if (m.stage === 'L') blockEnd[m.id.split('-L-')[1].charAt(0)] = Math.max(blockEnd[m.id.split('-L-')[1].charAt(0)] || 0, end);
    }
  }
  return est;
}

function loadDraw_(divCode) {
  var dt = table_(SHEET_DRAW);
  var d = {};
  var i;
  for (i = 0; i < dt.rows.length; i++) if (dt.rows[i]['区分'] === divCode) d[String(dt.rows[i]['枠'])] = dt.rows[i]['対象ID'];
  return d;
}

/* 審判の割当
   個人戦：予選リーグ＝リーグ内（LEAGUE_REFS）／決勝T1回戦＝各コートの初戦はA・Bブロック3位、2戦目以降は同じコートの直前の試合の敗者／準決勝・決勝＝審判員
   団体戦：各コートの初戦＝Aコートは7番・8番、Bコートは15番・16番のチームから1名ずつ、2戦目以降は同じコートの直前の試合の敗者／決勝＝審判員
   戻り値：matchId → { official } または { id } または { ids }（2チームから1名ずつ） または { text }（未確定の説明） */
function refereeMap_(ms, div, byId, ranks, draw) {
  var res = {};
  var chain = { A: [], B: [] };
  var i, j, m, key, blk, pos, cands, id, prev, court, loserRef;
  for (i = 0; i < ms.length; i++) {
    m = ms[i];
    if (m.note === '不戦勝') continue;
    if (m.stage === 'F' || (div.type === 'indiv' && m.stage === 'SF')) { res[m.id] = { official: true }; continue; }
    if (m.stage === 'L') {
      key = m.id.split('-L-')[1] || '';
      blk = key.charAt(0);
      pos = key.slice(1);
      cands = [LEAGUE_REFS[pos]];
      for (j = 1; j <= 4; j++) if (pos.indexOf(String(j)) < 0 && j !== LEAGUE_REFS[pos]) cands.push(j);
      res[m.id] = { text: '本部が指定' };
      for (j = 0; j < cands.length; j++) {
        id = cands[j] ? draw[blk + cands[j]] : '';
        if (id) { res[m.id] = { id: id }; break; }
      }
      continue;
    }
    court = m.court === 'B' ? 'B' : 'A';
    prev = chain[court].length ? chain[court][chain[court].length - 1] : null;
    if (!prev) {
      if (div.type === 'team') {
        var pair = court === 'A' ? ['7', '8'] : ['15', '16'];
        var ids = [];
        for (j = 0; j < pair.length; j++) if (draw[pair[j]]) ids.push(draw[pair[j]]);
        res[m.id] = ids.length === 2 ? { ids: ids } : (ids.length === 1 ? { id: ids[0] } : { text: '本部が指定' });
      } else {
        id = ranks[court + '3'];
        res[m.id] = id ? { id: id } : { text: court + 'ブロック3位' };
      }
    } else {
      id = null;
      if (prev.winner === 'L' || prev.winner === 'R') {
        loserRef = prev.winner === 'L' ? prev.right : prev.left;
        id = resolveRef_(loserRef, byId, ranks, 0);
      }
      res[m.id] = id ? { id: id, after: prev.no } : { text: '第' + prev.no + '試合の敗者' };
    }
    chain[court].push(m);
  }
  return res;
}

function progressData_(divCode, isAdmin, previewMs) {
  var div = DIVISIONS[divCode];
  if (!div) return { status: 'error', message: '区分が正しくありません。' };
  var cfg = getConfig_();
  var ms = previewMs || loadMatches_(divCode);
  var ranks = div.type === 'indiv' && !previewMs ? loadRanks_(divCode) : {};
  var people = participants_(divCode);
  var byId = {};
  var i;
  for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
  var est = computeTimes_(ms, div, cfg);
  var refs = refereeMap_(ms, div, byId, ranks, loadDraw_(divCode));
  var playersOf = {};
  if (div.type === 'team' && isAdmin) {
    var et = table_(SHEET_ENTRY);
    for (i = 0; i < et.rows.length; i++) if (et.rows[i]['区分'] === divCode) playersOf[et.rows[i].entryId] = teamPlayers_(et.rows[i]);
  }
  var out = [];
  var m, side, sides, s, pid, e;
  var lastEnd = 0;
  for (i = 0; i < ms.length; i++) {
    m = ms[i];
    sides = [];
    for (s = 0; s < 2; s++) {
      side = s === 0 ? m.left : m.right;
      pid = resolveRef_(side, byId, ranks, 0);
      var origin = side && side.charAt(0) === 'R' ? side.slice(2) + '位' : '';
      if (pid && people[pid]) sides.push({ decided: true, id: pid, label: people[pid].label, sub: people[pid].sub, full: people[pid].full, origin: origin, names: people[pid].names || null, grades: people[pid].grades || null, teamsFull: people[pid].teamsFull || null, changed: people[pid].changed || 0 });
      else sides.push({ decided: false, label: refPlaceholder_(side, byId), sub: '', origin: origin });
    }
    e = est[m.id] || {};
    var rf = refs[m.id] || null;
    var referee = null;
    if (rf && rf.official) referee = { official: true, label: '審判員' };
    else if (rf && rf.id) referee = { decided: true, id: rf.id, label: people[rf.id] ? people[rf.id].label : '', sub: people[rf.id] ? people[rf.id].sub : '' };
    else if (rf && rf.ids) referee = { decided: true, ids: rf.ids, label: (people[rf.ids[0]] ? people[rf.ids[0]].label : '') + '・' + (people[rf.ids[1]] ? people[rf.ids[1]].label : ''), sub: '各1名' };
    else if (rf) referee = { decided: false, label: rf.text };
    if (e.end && e.end > lastEnd && m.note !== '不戦勝') lastEnd = e.end;
    out.push({
      id: m.id, no: m.no, stage: m.stage, round: m.round, court: m.court, seq: m.seq, two: m.two, state: m.state,
      plan: hm_(e.start), planEnd: hm_(e.end), start: String(m.start || '').slice(11, 16), end: String(m.end || '').slice(11, 16),
      left: sides[0], right: sides[1], winner: m.winner, score: m.score, note: m.note, referee: referee,
      team: div.type === 'team' ? teamView_(m, byId, cfg, isAdmin) : null
    });
    if (div.type === 'team' && isAdmin) {
      out[out.length - 1].team.playersL = sides[0].decided ? playersOf[sides[0].id] || [] : [];
      out[out.length - 1].team.playersR = sides[1].decided ? playersOf[sides[1].id] || [] : [];
    }
  }
  var res = {
    status: 'ok', division: div, tournament: cfg['大会名'],
    date: div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程'],
    venue: div.gender === '男' ? cfg['男子会場'] : cfg['女子会場'],
    startTime: cfg['競技開始時刻'], finishPlan: hm_(lastEnd), updated: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'HH:mm:ss'),
    matches: out
  };
  /* ブロック分け（組合せ）は、進行表を作成（＝公開）した区分だけ返す。保存しただけの組合せ案は出さない */
  if (div.type === 'indiv' && ms.length) {
    var blocks = {};
    var dt = table_(SHEET_DRAW);
    for (i = 0; i < dt.rows.length; i++) {
      var d = dt.rows[i];
      if (d['区分'] !== divCode) continue;
      var b = String(d['枠']).charAt(0);
      if (!blocks[b]) blocks[b] = [];
      var pp = people[d['対象ID']];
      blocks[b].push({ pos: toInt_(String(d['枠']).slice(1)), id: d['対象ID'], label: pp ? pp.label : '', sub: pp ? pp.sub : '',
        names: pp ? pp.names : [], grades: pp ? pp.grades : [], teams: pp ? pp.teams : [], teamsFull: pp ? pp.teamsFull : [] });
    }
    for (b in blocks) if (blocks.hasOwnProperty(b)) blocks[b].sort(function (x, y) { return x.pos - y.pos; });
    res.blocks = blocks;
    res.ranks = ranks;
    res.diff = loadDiff_(divCode);
    res.diffKinds = DIFF_KINDS[div.type];
  }
  if (isAdmin) {
    var reqs = changeRequests_();
    res.pendingChanges = 0;
    for (i = 0; i < reqs.length; i++) if (reqs[i].div === divCode && reqs[i].state === '申請中') res.pendingChanges++;
    res.config = {
      start: cfg['競技開始時刻'], g5: cfg['5ゲーム目安（分）'], g7: cfg['7ゲーム目安（分）'],
      gapTeam: cfg['団体戦の次戦までの間隔（分）'], gapIndiv: cfg['個人戦の次戦までの間隔（分）']
    };
  }
  return res;
}

/* ============================================================
   本部操作（本部パスワード または 管理パスワード）
   ============================================================ */
function controlRoute_(body) {
  var cfg = getConfig_();
  var pw = String(body.pw || '');
  if (!pw || (pw !== String(cfg['本部パスワード']) && pw !== String(cfg['管理パスワード']))) {
    return { status: 'error', code: 'auth', message: 'パスワードが違います。' };
  }
  switch (body.action) {
    case 'ctlLoad': return progressData_(body.div, true);
    case 'ctlUpdate': return adminCtlUpdate_(body);
    case 'ctlRanks': return adminCtlRanks_(body);
    case 'ctlDiff': return adminCtlDiff_(body);
    case 'ctlConfig': return adminCtlConfig_(body);
    case 'ctlOrder': return ctlOrder_(body);
    case 'ctlPairs': return ctlPairs_(body);
    default: return { status: 'error', message: '不明な操作です。' };
  }
}
function adminCtlUpdate_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ms = loadMatches_(body.div);
    var div = DIVISIONS[body.div];
    var byId = {};
    var i;
    for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
    var m = byId[body.matchId];
    if (!m) throw new Error('試合が見つかりません。');
    var t = table_(SHEET_MATCH);
    var row = null;
    for (i = 0; i < t.rows.length; i++) if (t.rows[i].matchId === m.id) row = t.rows[i];
    var upd = {};
    var stamp = now_();
    var ranks = div.type === 'indiv' ? loadRanks_(body.div) : {};
    var op = body.op;

    if (op === 'up' || op === 'down') {
      var same = [];
      for (i = 0; i < ms.length; i++) if (ms[i].court === m.court || ms[i].two || m.two) same.push(ms[i]);
      var idx = -1;
      for (i = 0; i < same.length; i++) if (same[i].id === m.id) idx = i;
      var other = op === 'up' ? same[idx - 1] : same[idx + 1];
      if (!other) throw new Error('これ以上動かせません。');
      if (other.state === '終了' || other.state === '試合中') throw new Error('終了・試合中の試合とは入れ替えられません。');
      var r2 = null;
      for (i = 0; i < t.rows.length; i++) if (t.rows[i].matchId === other.id) r2 = t.rows[i];
      writeRow_(t, r2, { '順番': String(m.seq), '更新日時': stamp });
      upd['順番'] = String(other.seq);
    } else if (op === 'court') {
      if (m.state === '終了') throw new Error('終了した試合は移動できません。');
      upd['コート'] = m.court === 'A' ? 'B' : 'A';
    } else if (op === 'two') {
      if (div.type !== 'team') throw new Error('2面展開は団体戦のみです。');
      if (m.state === '終了') throw new Error('終了した試合は変更できません。');
      upd['2面'] = m.two ? '' : '1';
    } else if (op === 'state') {
      var st = body.state;
      if (STATES.indexOf(st) < 0) throw new Error('状態が正しくありません。');
      if (st === '終了') throw new Error('終了は「結果入力」から行ってください。');
      if (st !== '待機') {
        if (!resolveRef_(m.left, byId, ranks, 0) || !resolveRef_(m.right, byId, ranks, 0)) throw new Error('対戦相手が決まっていません。');
      }
      if (m.state === '終了') assertNoDependentsStarted_(m, ms);
      upd['状態'] = st;
      if (st === '試合中' && !m.start) upd['開始'] = stamp;
      if (st === '試合中' && div.type === 'team' && !m.pub) upd['オーダー公開'] = stamp;
      if (st === '待機' || st === '呼出') { upd['開始'] = ''; upd['終了'] = ''; upd['勝者'] = ''; upd['スコア'] = ''; }
    } else if (op === 'publish') {
      if (div.type !== 'team') throw new Error('オーダーの公開は団体戦のみです。');
      if (m.state === '終了') throw new Error('終了した試合です。');
      if (!m.orderL || !m.orderR) throw new Error('両チームのオーダーがそろっていません。未提出のチームは「オーダー」から代理入力してください。');
      upd['オーダー公開'] = stamp;
    } else if (op === 'unpublish') {
      if (m.state === '試合中' || m.state === '終了') throw new Error('試合が始まっているため、非公開に戻せません。');
      upd['オーダー公開'] = '';
    } else if (op === 'result') {
      if (body.winner !== 'L' && body.winner !== 'R') throw new Error('勝者を選んでください。');
      if (!resolveRef_(m.left, byId, ranks, 0) || !resolveRef_(m.right, byId, ranks, 0)) throw new Error('対戦相手が決まっていません。');
      if (m.state === '終了' && m.winner !== body.winner) assertNoDependentsStarted_(m, ms);
      upd['状態'] = '終了';
      upd['勝者'] = body.winner;
      upd['スコア'] = String(body.score || '').slice(0, 30);
      if (!m.start) upd['開始'] = stamp;
      if (!m.end || m.state !== '終了') upd['終了'] = stamp;
    } else {
      throw new Error('不明な操作です。');
    }
    upd['更新日時'] = stamp;
    writeRow_(t, row, upd);
  } finally {
    lock.releaseLock();
  }
  return progressData_(body.div, true);
}

/* 勝者を変える・取り消す前に、次の試合が始まっていないか確認 */
function assertNoDependentsStarted_(m, ms) {
  var i;
  for (i = 0; i < ms.length; i++) {
    if ((ms[i].left === 'W:' + m.id || ms[i].right === 'W:' + m.id) && ms[i].state !== '待機' && ms[i].state !== '呼出') {
      throw new Error('次の試合（第' + ms[i].no + '試合）が始まっているため変更できません。');
    }
  }
}

/* 予選リーグの順位（1位・2位、審判に使う3位）を本部が入力 */
function adminCtlRanks_(body) {
  var div = DIVISIONS[body.div];
  if (!div || div.type !== 'indiv') throw new Error('個人戦の区分を指定してください。');
  var blk = String(body.block || '');
  if (BLOCKS.indexOf(blk) < 0) throw new Error('ブロックを指定してください。');
  if (body.first && body.first === body.second) throw new Error('1位と2位が同じです。');
  if (body.third && (body.third === body.first || body.third === body.second)) throw new Error('3位が1位・2位と同じです。');
  var dt = table_(SHEET_DRAW);
  var members = {};
  var i;
  for (i = 0; i < dt.rows.length; i++) if (dt.rows[i]['区分'] === body.div && String(dt.rows[i]['枠']).charAt(0) === blk) members[dt.rows[i]['対象ID']] = true;
  if ((body.first && !members[body.first]) || (body.second && !members[body.second]) || (body.third && !members[body.third])) throw new Error(blk + 'ブロックのペアを選んでください。');
  var old = loadRanks_(body.div);
  var changed = (old[blk + '1'] || '') !== (body.first || '') || (old[blk + '2'] || '') !== (body.second || '');
  var ms = loadMatches_(body.div);
  for (i = 0; changed && i < ms.length; i++) {
    if (ms[i].stage === 'QF' && (ms[i].left === 'R:' + blk + '1' || ms[i].right === 'R:' + blk + '1' || ms[i].left === 'R:' + blk + '2' || ms[i].right === 'R:' + blk + '2') &&
        ms[i].state !== '待機' && ms[i].state !== '呼出') {
      throw new Error('決勝トーナメント（第' + ms[i].no + '試合）が始まっているため変更できません。');
    }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureHeaders_(table_(SHEET_RANK).sheet, HEADERS[SHEET_RANK]);
    var rt = table_(SHEET_RANK);
    var target = null;
    for (i = 0; i < rt.rows.length; i++) if (rt.rows[i]['区分'] === body.div && rt.rows[i]['ブロック'] === blk) target = rt.rows[i];
    var vals = { '1位': body.first || '', '2位': body.second || '', '3位': body.third || '', '更新日時': now_() };
    if (target) writeRow_(rt, target, vals);
    else { vals['区分'] = body.div; vals['ブロック'] = blk; appendObj_(rt, vals); }
  } finally {
    lock.releaseLock();
  }
  log_('予選順位', div.name + '／' + blk + 'ブロック');
  return progressData_(body.div, true);
}

/* 予選リーグ表の「得失」欄を本部が設定（表示の種類と、組ごとの値） */
function adminCtlDiff_(body) {
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var blk = String(body.block || '');
  if (BLOCKS.indexOf(blk) < 0) throw new Error('ブロックを指定してください。');
  var kind = String(body.kind || '');
  var kinds = DIFF_KINDS[div.type] || [];
  if (kind && kinds.indexOf(kind) < 0) throw new Error('得失の種類が正しくありません。');
  var dt = table_(SHEET_DRAW);
  var members = {};
  var i;
  for (i = 0; i < dt.rows.length; i++) if (dt.rows[i]['区分'] === body.div && String(dt.rows[i]['枠']).charAt(0) === blk) members[dt.rows[i]['対象ID']] = true;
  var src = body.vals || {};
  var vals = {};
  var k, v;
  if (kind) {
    for (k in src) {
      if (!src.hasOwnProperty(k) || !members[k]) continue;
      v = normDiff_(src[k]);
      if (v === null) throw new Error('得失の値は「+3」「-2」「0」のように数字で入力してください。');
      if (v !== '') vals[k] = v;
    }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureHeaders_(table_(SHEET_RANK).sheet, HEADERS[SHEET_RANK]);
    var rt = table_(SHEET_RANK);
    var target = null;
    for (i = 0; i < rt.rows.length; i++) if (rt.rows[i]['区分'] === body.div && rt.rows[i]['ブロック'] === blk) target = rt.rows[i];
    var upd = { '得失表示': kind, '得失値': kind ? JSON.stringify(vals) : '', '更新日時': now_() };
    if (target) writeRow_(rt, target, upd);
    else { upd['区分'] = body.div; upd['ブロック'] = blk; appendObj_(rt, upd); }
  } finally {
    lock.releaseLock();
  }
  log_('得失表示', div.name + '／' + blk + 'ブロック：' + (kind ? '得失' + kind : '表示しない'));
  return progressData_(body.div, true);
}

/* 目安時間などの変更（設定シートに書き込み） */
function adminCtlConfig_(body) {
  var allowed = { start: '競技開始時刻', g5: '5ゲーム目安（分）', g7: '7ゲーム目安（分）', gapTeam: '団体戦の次戦までの間隔（分）', gapIndiv: '個人戦の次戦までの間隔（分）' };
  var vals = body.values || {};
  var sh = ss_().getSheetByName(SHEET_CONFIG);
  var data = sh.getDataRange().getValues();
  var k, i, found, v;
  for (k in allowed) {
    if (!allowed.hasOwnProperty(k) || vals[k] === undefined) continue;
    v = String(vals[k]).trim();
    if (k === 'start' && !/^\d{1,2}:\d{2}$/.test(v)) throw new Error('競技開始時刻は「9:00」の形で入力してください。');
    if (k !== 'start' && !/^\d{1,3}$/.test(v)) throw new Error(allowed[k] + 'は数字で入力してください。');
    found = false;
    for (i = 1; i < data.length; i++) {
      if (String(data[i][0]) === allowed[k]) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(v); found = true; }
    }
    if (!found) sh.appendRow([allowed[k], v]);
  }
  log_('目安時間変更', JSON.stringify(vals));
  return progressData_(body.div, true);
}

/* ============================================================
   団体戦：オーダー・番手結果・勝敗判定（フェーズ4）
   3ダブルス。1回戦は3番手まで行う。2回戦以降は2勝で決着（残りは打ち切り）。
   6名未満のチームは第3マッチが欠員（不戦敗）。不戦敗・リタイアのスコアは勝者から見て「3-R」（R＝リタイアメント）。同数のときは 得失ゲーム差 → 得失ポイント差（本部入力）→ 代表戦（本部入力）
   ============================================================ */

/* 選手（欠員を除く。選手変更を反映済み） */
function teamPlayers_(entryRow) {
  var ps = parseJson_(entryRow['選手JSON'], []);
  var out = [];
  var i;
  for (i = 0; i < ps.length; i++) if (ps[i] && !ps[i].vacant && ps[i].name) out.push({ no: ps[i].no || (i + 1), name: ps[i].name, grade: ps[i].grade });
  return out;
}

/* オーダーの確認と整形：[[A,B],[C,D],[E,F] or null] */
function normalizeOrder_(entryRow, pairs) {
  var players = teamPlayers_(entryRow);
  var names = {};
  var i, j;
  for (i = 0; i < players.length; i++) names[normName_(players[i].name)] = players[i].name;
  var need = players.length >= 6 ? 3 : 2;
  var used = {};
  var out = [];
  for (i = 0; i < 3; i++) {
    var pr = (pairs && pairs[i]) || [];
    if (i >= need) {
      out.push(null);
      continue;
    }
    if (!pr[0] || !pr[1]) throw new Error('第' + (i + 1) + 'マッチの選手を2名選んでください。');
    var row = [];
    for (j = 0; j < 2; j++) {
      var key = normName_(pr[j]);
      if (!names[key]) throw new Error('「' + pr[j] + '」は登録選手にいません。');
      if (used[key]) throw new Error('「' + names[key] + '」が2つのマッチに入っています。');
      used[key] = true;
      row.push(names[key]);
    }
    out.push(row);
  }
  return out;
}

function matchRow_(matchId) {
  var t = table_(SHEET_MATCH);
  var i;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i].matchId === matchId) return { t: t, row: t.rows[i] };
  return null;
}

function entryById_(entryId) {
  var t = table_(SHEET_ENTRY);
  var i;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === entryId) return t.rows[i];
  return null;
}

/* オーダー締切（分）：1回戦は設定の時刻、2回戦以降は前の試合（遅い方）の終了＋提出時間 */
function orderDeadline_(m, byId, cfg) {
  if (m.stage === 'R1') return { deadline: toMin_(cfg['1回戦オーダー締切']), gather: null, decidedAt: null };
  var refs = [m.left, m.right];
  var last = null;
  var i, f;
  for (i = 0; i < 2; i++) {
    if (!refs[i] || refs[i].charAt(0) !== 'W') continue;
    f = byId[refs[i].slice(2)];
    if (!f || f.state !== '終了') return { deadline: null, gather: null, decidedAt: null };
    var e = toMin_(f.end);
    if (f.note === '不戦勝') e = null;
    if (e !== null && (last === null || e > last)) last = e;
  }
  if (last === null) return { deadline: null, gather: null, decidedAt: null };
  return { deadline: last + (toInt_(cfg['オーダー提出（分）']) || 10), gather: last + (toInt_(cfg['コート集合（分）']) || 15), decidedAt: last };
}

/* 番手ごとの状態と勝敗の判定 */
function teamOutcome_(m) {
  var oL = m.orderL ? m.orderL.p : null;
  var oR = m.orderR ? m.orderR.p : null;
  var res = m.pairs || [];
  var isR1 = m.stage === 'R1';
  var wL = 0, wR = 0, gd = 0, done = 0;
  var rows = [];
  var i, r, fL, fR, sc;
  for (i = 0; i < 3; i++) {
    r = res[i] || {};
    fL = !!(oL && i === 2 && !oL[2]);
    fR = !!(oR && i === 2 && !oR[2]);
    var row = { w: '', g: '', kind: '' };
    if (fL && fR) { row.kind = 'none'; done++; }
    else if (fL) { row.w = 'R'; row.g = 'R-3'; row.kind = 'forfeit'; row.vac = true; wR++; done++; }
    else if (fR) { row.w = 'L'; row.g = '3-R'; row.kind = 'forfeit'; row.vac = true; wL++; done++; }
    else if (r.w === 'L' || r.w === 'R') {
      row.w = r.w;
      row.g = r.g || '';
      /* 不戦勝・リタイア：「3-R」（旧表記「不戦勝」も同じ扱い）。得失ゲーム差には入れない */
      if (r.g === '不戦勝') row.g = r.w === 'L' ? '3-R' : 'R-3';
      row.kind = /R/.test(row.g) ? 'forfeit' : 'played';
      if (r.w === 'L') wL++; else wR++;
      done++;
      sc = String(r.g || '').match(/^(\d+)-(\d+)$/);
      if (sc) gd += toInt_(sc[1]) - toInt_(sc[2]);
    }
    rows.push(row);
  }
  var out = { rows: rows, wL: wL, wR: wR, gd: gd, decided: false, winner: '', score: '', need: '' };
  if (!isR1 && (wL >= 2 || wR >= 2)) {
    out.decided = true;
    out.winner = wL >= 2 ? 'L' : 'R';
    for (i = 0; i < 3; i++) if (!rows[i].w && rows[i].kind !== 'none') rows[i].kind = 'abort';
  } else if (done === 3) {
    if (wL !== wR) { out.decided = true; out.winner = wL > wR ? 'L' : 'R'; }
    else if (gd !== 0) { out.decided = true; out.winner = gd > 0 ? 'L' : 'R'; out.via = 'G差'; }
    else if (m.tb && (m.tb.points === 'L' || m.tb.points === 'R')) { out.decided = true; out.winner = m.tb.points; out.via = 'P差'; }
    else if (m.tb && (m.tb.rep === 'L' || m.tb.rep === 'R')) { out.decided = true; out.winner = m.tb.rep; out.via = '代表戦'; out.need = 'rep'; }
    else out.need = m.tb && m.tb.pointsTie ? 'rep' : 'points';
  }
  if (out.decided) out.score = wL + '-' + wR + (out.via ? '（' + out.via + '）' : '');
  return out;
}

/* 進行表に載せる団体戦の情報。showAll=false のときは両チームのオーダーが揃うまで選手名を出さない */
function teamView_(m, byId, cfg, showAll) {
  var dl = orderDeadline_(m, byId, cfg);
  var both = !!(m.orderL && m.orderR);
  /* オーダーの公開：本部が「公開」を押したとき（試合開始のあいさつ）。開始・終了した試合も公開扱い */
  var open = !!m.pub || m.state === '試合中' || m.state === '終了';
  var oc = teamOutcome_(m);
  var nowM = nowMin_();
  var pairs = [];
  var i;
  for (i = 0; i < 3; i++) {
    pairs.push({
      l: (showAll || open) && m.orderL ? m.orderL.p[i] : null,
      r: (showAll || open) && m.orderR ? m.orderR.p[i] : null,
      w: oc.rows[i].w, g: oc.rows[i].g, kind: oc.rows[i].kind, vac: !!oc.rows[i].vac
    });
  }
  var pending = m.state === '待機' || m.state === '呼出';
  return {
    orderL: !!m.orderL, orderR: !!m.orderR, both: both, open: open, pubAt: m.pub ? String(m.pub).slice(11, 16) : '',
    byL: m.orderL ? m.orderL.by : '', byR: m.orderR ? m.orderR.by : '',
    deadline: hm_(dl.deadline), gather: hm_(dl.gather),
    overdue: pending && dl.deadline !== null && nowM !== null && nowM > dl.deadline && !both,
    pairs: pairs, wL: oc.wL, wR: oc.wR, gd: oc.gd, need: m.state === '終了' ? '' : oc.need, tb: m.tb || {}
  };
}

function saveOrder_(divCode, matchId, side, pairs, by, allowLocked) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ms = loadMatches_(divCode);
    var byId = {};
    var i;
    for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
    var m = byId[matchId];
    if (!m) throw new Error('試合が見つかりません。');
    if (DIVISIONS[divCode].type !== 'team') throw new Error('団体戦の試合ではありません。');
    var lid = resolveRef_(m.left, byId, {}, 0);
    var rid = resolveRef_(m.right, byId, {}, 0);
    if (!lid || !rid) throw new Error('対戦相手が決まっていません。');
    if (m.state === '終了') throw new Error('試合は終了しています。');
    if (!allowLocked) {
      if (m.state === '試合中') throw new Error('試合が始まっているため変更できません。');
      if (m.pub) throw new Error('本部がオーダーを公開したため、変更できません。変更は本部へ申し出てください。');
      /* 提出後の修正は、オーダー提出の締切（1回戦は設定の時刻、2回戦以降は前の試合の終了＋設定の分）まで */
      var mine = side === 'L' ? m.orderL : m.orderR;
      if (mine) {
        var dl = orderDeadline_(m, byId, getConfig_());
        var nowM = nowMin_();
        if (dl.deadline !== null && nowM !== null && nowM > dl.deadline) throw new Error('オーダー提出の締切（' + hm_(dl.deadline) + '）を過ぎたため、修正できません。変更は本部へ申し出てください。');
      }
    }
    var entry = entryById_(side === 'L' ? lid : rid);
    var order = normalizeOrder_(entry, pairs);
    var hit = matchRow_(matchId);
    var upd = { '更新日時': now_() };
    upd[side === 'L' ? 'オーダー左' : 'オーダー右'] = JSON.stringify({ p: order, at: now_(), by: by });
    writeRow_(hit.t, hit.row, upd);
    log_('オーダー', DIVISIONS[divCode].name + '／第' + m.no + '試合／' + entry['チーム名'] + '（' + by + '）');
    return order;
  } finally {
    lock.releaseLock();
  }
}

/* 監督ポータルから提出 */
function apiSubmitOrder_(body) {
  var entry = findEntryByToken_(body.t);
  if (!entry) return { status: 'error', message: 'リンクが無効です。' };
  if (DIVISIONS[entry['区分']].type !== 'team') return { status: 'error', message: '団体戦のリンクではありません。' };
  if (entry['受付状態'] !== '受付済') return { status: 'error', message: '当日受付が済んでいません。受付を済ませてからオーダーを提出してください。' };
  var ms = loadMatches_(entry['区分']);
  var byId = {};
  var i, side = '';
  for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
  var m = byId[body.matchId];
  if (!m) return { status: 'error', message: '試合が見つかりません。' };
  if (resolveRef_(m.left, byId, {}, 0) === entry.entryId) side = 'L';
  else if (resolveRef_(m.right, byId, {}, 0) === entry.entryId) side = 'R';
  if (!side) return { status: 'error', message: 'このチームの試合ではありません。' };
  saveOrder_(entry['区分'], m.id, side, body.pairs, '監督', false);
  return portalData_(body.t);
}

/* 本部の代理入力（そろった後の訂正も可） */
function ctlOrder_(body) {
  saveOrder_(body.div, body.matchId, body.side === 'R' ? 'R' : 'L', body.pairs, '本部', true);
  return progressData_(body.div, true);
}

/* 本部：マッチごとの結果（勝者・ゲーム数）と同数時の判定（シートの列名は「番手」のまま） */
function ctlPairs_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ms = loadMatches_(body.div);
    var byId = {};
    var i;
    for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
    var m = byId[body.matchId];
    if (!m) throw new Error('試合が見つかりません。');
    if (DIVISIONS[body.div].type !== 'team') throw new Error('団体戦の試合ではありません。');
    if (!resolveRef_(m.left, byId, {}, 0) || !resolveRef_(m.right, byId, {}, 0)) throw new Error('対戦相手が決まっていません。');
    var pairs = [];
    var p, g;
    for (i = 0; i < 3; i++) {
      p = (body.pairs || [])[i] || {};
      g = String(p.g || '').trim().replace(/[ＲｒＲr]/g, 'R');
      if (p.w !== 'L' && p.w !== 'R') { pairs.push({}); continue; }
      if (g && g !== '不戦勝' && !/^\d+-\d+$/.test(g) && !/^(\d+-R|R-\d+)$/.test(g)) throw new Error('第' + (i + 1) + 'マッチのゲーム数が正しくありません。');
      pairs.push({ w: p.w, g: g });
    }
    var tb = body.tb || {};
    m.pairs = pairs;
    m.tb = { points: tb.points || '', rep: tb.rep || '', pointsTie: !!tb.pointsTie };
    var oc = teamOutcome_(m);
    var stamp = now_();
    var upd = { '番手': JSON.stringify(pairs), '判定': JSON.stringify(m.tb), '更新日時': stamp };
    var any = false;
    for (i = 0; i < 3; i++) if (pairs[i].w) any = true;
    if (oc.decided) {
      if (m.state === '終了' && m.winner !== oc.winner) assertNoDependentsStarted_(m, ms);
      upd['状態'] = '終了';
      upd['勝者'] = oc.winner;
      upd['スコア'] = oc.score;
      if (!m.start) upd['開始'] = stamp;
      if (m.state !== '終了' || !m.end) upd['終了'] = stamp;
    } else {
      if (m.state === '終了') assertNoDependentsStarted_(m, ms);
      upd['勝者'] = '';
      upd['スコア'] = '';
      upd['終了'] = '';
      if (any) { upd['状態'] = '試合中'; if (!m.start) upd['開始'] = stamp; }
    }
    var hit = matchRow_(m.id);
    writeRow_(hit.t, hit.row, upd);
  } finally {
    lock.releaseLock();
  }
  return progressData_(body.div, true);
}

/* ============================================================
   監督ポータル（申込リンクのトークンで表示）
   ============================================================ */
/* 相手チームの選手変更（選手変更一覧と同じ中身） */
function oppChanges_(divCode, teamName) {
  var all = [];
  try { all = publicChanges_(divCode); } catch (e) { return []; }
  var out = [];
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MM-dd');
  var i, at;
  for (i = 0; i < all.length; i++) {
    if (all[i].team !== teamName) continue;
    /* きょうの変更は時刻だけ（例 7:25）、前の日の変更は日付つき（例 11/20 18:05） */
    at = String(all[i].at || '');
    at = at.slice(0, 5) === today ? at.slice(6).replace(/^0/, '') : at.replace('-', '/');
    out.push({ at: at, target: all[i].target, from: all[i].from, to: all[i].to });
  }
  return out;
}

function portalData_(token) {
  var entry = findEntryByToken_(token);
  if (!entry) return { status: 'error', message: 'リンクが無効です。受付票のボタンから開いてください。' };
  var div = DIVISIONS[entry['区分']];
  if (div.type !== 'team') return { status: 'error', message: 'オーダー提出は団体戦のみです。' };
  var cfg = getConfig_();
  var ms = loadMatches_(entry['区分']);
  var people = participants_(entry['区分']);
  var byId = {};
  var i;
  for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
  var est = computeTimes_(ms, div, cfg);
  var me = entry.entryId;
  var mine = [];
  var appears = false;
  var m, l, r;
  for (i = 0; i < ms.length; i++) {
    m = ms[i];
    if (m.left === 'E:' + me || m.right === 'E:' + me) appears = true;
    l = resolveRef_(m.left, byId, {}, 0);
    r = resolveRef_(m.right, byId, {}, 0);
    if (l === me || r === me) mine.push({ m: m, side: l === me ? 'L' : 'R', opp: l === me ? r : l, oppRef: l === me ? m.right : m.left });
  }
  var res = {
    status: 'ok', tournament: cfg['大会名'], division: div.name, date: cfg['団体戦日程'],
    venue: div.gender === '男' ? cfg['男子会場'] : cfg['女子会場'],
    team: { name: entry['チーム名'], abbr: teamShort_(entry), coach: entry['監督氏名'] },
    reception: entry['受付状態'] === '受付済', players: teamPlayers_(entry),
    history: [], view: '', match: null, now: hm_(nowMin_()),
    divCode: entry['区分'], changeOpen: changePeriod_(cfg, div).open,
    /* このチームの変更申請（申請中・許可・却下） */
    requests: (function () { try { return myRequests_(entry); } catch (e) { return []; } })()
  };
  /* 審判の担当（未終了の試合のうち、このチームが審判をするもの） */
  var refs = refereeMap_(ms, div, byId, {}, loadDraw_(entry['区分']));
  res.refDuties = [];
  for (i = 0; i < ms.length; i++) {
    var rfm = refs[ms[i].id];
    if (ms[i].state === '終了' || !rfm || (rfm.id !== me && !(rfm.ids && rfm.ids.indexOf(me) >= 0))) continue;
    var partner = rfm.ids ? (rfm.ids[0] === me ? rfm.ids[1] : rfm.ids[0]) : null;
    res.refDuties.push({ no: ms[i].no, round: ms[i].round, court: ms[i].two ? 'A・B' : ms[i].court, plan: hm_((est[ms[i].id] || {}).start), state: ms[i].state,
      after: rfm.after || null, partner: partner && people[partner] ? people[partner].label : '' });
  }
  var current = null;
  var k;
  for (k = 0; k < mine.length; k++) {
    var x = mine[k];
    if (x.m.state === '終了') {
      if (x.m.note !== '不戦勝' || x.m.winner) {
        res.history.push({ no: x.m.no, round: x.m.round, opp: x.opp && people[x.opp] ? people[x.opp].label : '不戦勝', win: x.m.winner === x.side,
          score: x.m.score ? (x.side === 'L' ? x.m.score : flipScore_(x.m.score)) : '' });
      }
    } else if (!current) {
      current = x;
    }
  }
  if (!appears && !mine.length) { res.view = 'nodraw'; return res; }
  if (!current) {
    var last = mine.length ? mine[mine.length - 1] : null;
    res.view = last && last.m.winner === last.side && last.m.stage === 'F' ? 'champion' : 'finished';
    /* 表彰の対象（準決勝で負け＝第3位、決勝で負け＝準優勝、優勝） */
    if (last && last.m.stage === 'F') res.award = last.m.winner === last.side ? '優勝' : '準優勝';
    else if (last && last.m.stage === 'SF' && last.m.winner && last.m.winner !== last.side) res.award = '第3位';
    return res;
  }
  var cm = current.m;
  var dl = orderDeadline_(cm, byId, cfg);
  var tv = teamView_(cm, byId, cfg, false);
  var myOrder = current.side === 'L' ? cm.orderL : cm.orderR;
  var oppOrder = current.side === 'L' ? cm.orderR : cm.orderL;
  var e = est[cm.id] || {};
  res.match = {
    id: cm.id, no: cm.no, round: cm.round, court: cm.two ? 'A・B（2面展開）' : cm.court + 'コート', state: cm.state,
    plan: hm_(e.start), deadline: hm_(dl.deadline), gather: hm_(dl.gather),
    deadlinePassed: dl.deadline !== null && nowMin_() > dl.deadline,
    opp: current.opp && people[current.opp] ? { label: people[current.opp].label, full: people[current.opp].full } : { label: refPlaceholder_(current.oppRef, byId), full: '' },
    oppDecided: !!current.opp,
    myOrder: myOrder ? myOrder.p : null, myOrderAt: myOrder ? String(myOrder.at).slice(11, 16) : '', myOrderBy: myOrder ? myOrder.by : '',
    oppSubmitted: !!oppOrder, published: tv.open, pubAt: tv.pubAt,
    oppOrder: tv.open && oppOrder ? oppOrder.p : null,
    pairs: tv.pairs, side: current.side,
    queue: courtQueue_(cm, ms, est),
    /* 次の対戦相手の選手変更（許可されたもの）。オーダーを考えるときに一覧を探さなくてよいように */
    oppChanges: current.opp && people[current.opp] ? oppChanges_(entry['区分'], people[current.opp].full) : []
  };
  var prev = null;
  for (k = mine.length - 1; k >= 0; k--) {
    var o = mine[k].side === 'L' ? mine[k].m.orderL : mine[k].m.orderR;
    if (o && mine[k].m.id !== cm.id) { prev = o.p; break; }
  }
  res.prevOrder = prev;
  if (!res.reception) res.view = 'reception';
  else if (!current.opp) res.view = 'waiting';
  else if (cm.state === '試合中') res.view = 'playing';
  else if (tv.open) res.view = 'locked';
  else res.view = 'order';
  return res;
}

/* 監督ポータル用：この試合のコートの様子（いま試合中の試合と、この試合の前に残っている試合の数）
   2面展開の試合は、A・Bどちらかのコートの試合を数える */
function courtQueue_(cm, ms, est) {
  if (cm.state === '試合中' || cm.state === '終了') return null;
  var courts = cm.two ? ['A', 'B'] : [cm.court];
  var mine = est[cm.id] || {};
  var live = [];
  var ahead = 0;
  var i, x, ex, on;
  for (i = 0; i < ms.length; i++) {
    x = ms[i];
    if (x.id === cm.id || x.state === '終了') continue;
    on = x.two || courts.indexOf(x.court) >= 0;
    if (!on) continue;
    if (x.state === '試合中') { live.push({ no: x.no, court: x.two ? 'A・B' : x.court }); ahead++; continue; }
    ex = est[x.id] || {};
    if (ex.start === null || ex.start === undefined || mine.start === null || mine.start === undefined) continue;
    if (ex.start < mine.start || (ex.start === mine.start && x.seq < cm.seq)) ahead++;
  }
  return { live: live, ahead: ahead };
}

/* 受付票用：このチーム（個人戦はこのチームが申し込んだペア）の表彰（第3位・準優勝・優勝） */
function awardsFor_(entry) {
  var divCode = entry['区分'];
  var div = DIVISIONS[divCode];
  var ids = {};
  var i, r;
  if (div.type === 'team') ids[entry.entryId] = true;
  else {
    var pt = table_(SHEET_PAIR);
    for (i = 0; i < pt.rows.length; i++) {
      r = pt.rows[i];
      if (r['区分'] === divCode && r['支払チーム'] === entry['チーム名']) ids[r.pairId] = true;
    }
  }
  var ms = loadMatches_(divCode);
  if (!ms.length) return [];
  var byId = {};
  for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
  var ranks = div.type === 'indiv' ? loadRanks_(divCode) : {};
  var people = participants_(divCode);
  var out = [];
  var m, l, rr, win, lose;
  for (i = 0; i < ms.length; i++) {
    m = ms[i];
    if ((m.stage !== 'SF' && m.stage !== 'F') || m.state !== '終了' || !m.winner) continue;
    l = resolveRef_(m.left, byId, ranks, 0);
    rr = resolveRef_(m.right, byId, ranks, 0);
    win = m.winner === 'L' ? l : rr;
    lose = m.winner === 'L' ? rr : l;
    if (m.stage === 'F') {
      if (win && ids[win]) out.push({ ord: 1, place: '優勝', id: win });
      if (lose && ids[lose]) out.push({ ord: 2, place: '準優勝', id: lose });
    } else if (lose && ids[lose]) out.push({ ord: 3, place: '第3位', id: lose });
  }
  out.sort(function (a, b) { return a.ord - b.ord; });
  return out.map(function (x) { return { place: x.place, label: people[x.id] ? people[x.id].label : '' }; });
}

function flipScore_(s) {
  var m = String(s).match(/^(\d+|R)-(\d+|R)(.*)$/);
  return m ? m[2] + '-' + m[1] + m[3] : s;
}

/* ============================================================
   大会プログラム用データ（公開）
   組合せ・進行表は progress を区分ごとに読む。ここでは名簿・変更・役員・栄光の記録を返す
   監督（ベンチ入り指導者）の氏名は申込フォームの同意の範囲で出す（役職・連絡先は出さない）
   ============================================================ */
function sheetRows_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var t = table_(name);
  var out = [];
  var i, k, o, any;
  for (i = 0; i < t.rows.length; i++) {
    o = {};
    any = false;
    for (k = 0; k < t.headers.length; k++) { o[t.headers[k]] = t.rows[i][t.headers[k]]; if (String(o[t.headers[k]]).trim()) any = true; }
    if (any) out.push(o);
  }
  return out;
}

function programData_(preview) {
  var cfg = getConfig_();
  var res = {
    status: 'ok',
    info: { tournament: cfg['大会名'], indivDate: cfg['個人戦日程'], teamDate: cfg['団体戦日程'], venueM: cfg['男子会場'], venueW: cfg['女子会場'],
      open: cfg['開場時刻'], reception: cfg['受付時刻'], start: cfg['競技開始時刻'], site: siteUrl_(cfg) },
    teams: {}, pairs: {}, changes: publicChanges_(''), officials: sheetRows_(SHEET_OFFICIAL), history: sheetRows_(SHEET_HISTORY)
  };
  var dt = table_(SHEET_DRAW);
  var slotOf = {};
  var i, r;
  /* 組合せ番号は、公開した区分（試合がある区分）だけ。プレビューでは保存済みの案も出す */
  var published = {};
  var mt = table_(SHEET_MATCH);
  for (i = 0; i < mt.rows.length; i++) published[mt.rows[i]['区分']] = true;
  for (i = 0; i < dt.rows.length; i++) {
    if (!preview && !published[dt.rows[i]['区分']]) continue;
    slotOf[dt.rows[i]['区分'] + '|' + dt.rows[i]['対象ID']] = String(dt.rows[i]['枠']);
  }
  if (preview) res.preview = true;
  var et = table_(SHEET_ENTRY);
  for (i = 0; i < et.rows.length; i++) {
    r = et.rows[i];
    if (!DIVISIONS[r['区分']] || DIVISIONS[r['区分']].type !== 'team') continue;
    if (!res.teams[r['区分']]) res.teams[r['区分']] = [];
    var ps = parseJson_(r['選手JSON'], []);
    var players = [];
    var j;
    for (j = 0; j < 8; j++) {
      var p = ps[j];
      if (!p) { players.push({ no: j + 1, vacant: true }); continue; }
      players.push({ no: j + 1, name: p.vacant ? '' : p.name, grade: p.vacant ? '' : p.grade, vacant: !!p.vacant, changedFrom: p.changedFrom || '' });
    }
    res.teams[r['区分']].push({ id: r.entryId, name: r['チーム名'], abbr: teamShort_(r), district: districtName_(r['地区']), applied: r['状態'] === '申込済',
      slot: slotOf[r['区分'] + '|' + r.entryId] || '', players: players, coach: r['監督氏名'] || '' });
  }
  var codes = ['MI', 'WI'];
  var c;
  for (c = 0; c < codes.length; c++) {
    var people = participants_(codes[c]);
    var pt = table_(SHEET_PAIR);
    res.pairs[codes[c]] = [];
    for (i = 0; i < pt.rows.length; i++) {
      r = pt.rows[i];
      if (r['区分'] !== codes[c]) continue;
      var pp = people[r.pairId] || {};
      var ch = parseJson_(r['変更記録'], null);
      res.pairs[codes[c]].push({ id: r.pairId, slot: slotOf[codes[c] + '|' + r.pairId] || '',
        a: { name: r['A氏名'], grade: r['A学年'], team: r['A所属'], abbr: (pp.teams || [])[0] || '' },
        b: { name: r['B氏名'], grade: r['B学年'], team: r['B所属'], abbr: (pp.teams || [])[1] || '' },
        change: ch ? { side: ch.side, from: ch.from } : null, coach: r['監督氏名'] || '' });
    }
  }
  return res;
}

/* ============================================================
   プレビュー（非公開）：保存済みの組合せ案から、進行表を作成したときと同じ形のデータを
   その場で組み立てて返す。シートには何も書かない。委員長と組合せ係だけが使える
   ============================================================ */
function previewMatches_(divCode) {
  var div = DIVISIONS[divCode];
  var draw = loadDraw_(divCode);
  var tm = div.type === 'team' ? teamTemplate_(divCode, draw) : indivTemplate_(divCode, draw);
  var out = [];
  var i, m;
  for (i = 0; i < tm.length; i++) {
    m = tm[i];
    out.push({ id: m.id, stage: m.stage, round: m.round, no: m.no, left: m.left, right: m.right, court: m.court, seq: m.seq, two: !!m.two,
      state: m.state || '待機', start: '', end: '', winner: m.winner || '', score: m.score || '', note: m.note || '',
      orderL: null, orderR: null, pairs: [], tb: {}, pub: '' });
  }
  out.sort(function (a, b) { return a.seq - b.seq || a.no - b.no; });
  return out;
}

function previewRoute_(body) {
  if (body.action === 'adminPreviewProgram') return programData_(true);
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var draw = loadDraw_(body.div);
  var k, n = 0;
  for (k in draw) if (draw.hasOwnProperty(k) && draw[k]) n++;
  var res = progressData_(body.div, false, n ? previewMatches_(body.div) : []);
  res.preview = true;
  res.drawCount = n;
  return res;
}
