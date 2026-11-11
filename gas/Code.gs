/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会 システム
   バックエンドGAS（申込系） v1
   - スプレッドシートにバインドして使う（拡張機能 → Apps Script）
   - 規約：ES5（var / function のみ）
   ============================================================ */

var SHEET_CONFIG = '設定';
var SHEET_MASTER = '加盟チーム';
var SHEET_ENTRY = '出場枠';
var SHEET_PAIR = '個人ペア';
var SHEET_LOG = 'ログ';
var SHEET_CHANGE = '選手変更';
var SHEET_DRAW = '組合せ';
var SHEET_MATCH = '試合';
var SHEET_RANK = '予選順位';
var SHEET_REQ = '変更申請';
var SHEET_OFFICIAL = 'プログラム_役員';
var SHEET_HISTORY = 'プログラム_栄光の記録';

var HEADERS = {};
HEADERS[SHEET_MASTER] = ['チーム名', '種別', '地区', '代表者名', '代表者メール', '登録料入金', '選手JSON'];
HEADERS[SHEET_ENTRY] = ['entryId', '区分', 'チーム名', '地区', '代表者名', '代表者メール', 'トークン', '受付コード',
  '状態', '申込日時', '更新日時', '監督氏名', '監督役職', '申込者氏名', '申込者役職', '申込者電話', '申込者メール',
  '選手JSON', 'ペア数', '参加料', '要確認', 'リンク送信日時', '受付状態', '受付日時', '備考', '略称', '初回アクセス日時', '督促送信日時',
  '受付担当', '受付メール送信日時', '領収書番号', '領収書ファイルID', '領収書作成日時', '公開同意日時'];
HEADERS[SHEET_PAIR] = ['pairId', '区分', 'A氏名', 'A学年', 'A所属', 'B氏名', 'B学年', 'B所属', '支払チーム', '監督氏名', '監督役職', '変更記録', '申込時変更'];
HEADERS[SHEET_LOG] = ['日時', '種別', '内容'];
HEADERS[SHEET_CHANGE] = ['日時', '区分', 'チーム', '対象', '変更前', '変更後', '名簿外', '理由', '理由公開'];
HEADERS[SHEET_DRAW] = ['区分', '枠', '対象ID'];
HEADERS[SHEET_MATCH] = ['matchId', '区分', '段階', 'ラウンド', '番号', '左', '右', 'コート', '順番', '2面', '状態', '開始', '終了', '勝者', 'スコア', '備考', '更新日時', 'オーダー左', 'オーダー右', '番手', '判定', 'オーダー公開'];
HEADERS[SHEET_RANK] = ['区分', 'ブロック', '1位', '2位', '更新日時', '3位', '得失表示', '得失値'];
HEADERS[SHEET_REQ] = ['申請ID', '日時', '区分', 'entryId', 'チーム', '種別', '対象', '内容', '理由', '状態', '処理日時', 'コメント', '申請者'];
HEADERS[SHEET_OFFICIAL] = ['区分', '役職', '氏名', '所属'];
HEADERS[SHEET_HISTORY] = ['回', '年度', '種別', '優勝', '準優勝', '3位', '3位（2）'];

var CONFIG_DEFAULTS = [
  ['大会名', '第40回岩手県中学校インドアソフトテニス大会'],
  ['申込開始', '2026-11-04 09:00'],
  ['申込締切', '2026-11-19 17:00'],
  ['サイトURL', 'https://skkr-d.github.io/iwate-indoor/'],
  ['管理パスワード', 'iwatestc2030'],
  ['登録システムGAS_URL', 'https://script.google.com/macros/s/AKfycbwMaX6mOexotFkV6n5Y79QXO9IhDgBRvT4PHuCr9c9j435683_N7G8yKkQPcIi-wXtu/exec'],
  ['団体戦参加料', '10000'],
  ['個人戦参加料', '3000'],
  ['団体戦上限', '16'],
  ['個人戦上限', '16'],
  ['個人戦日程', '令和8年11月28日（土）'],
  ['団体戦日程', '令和8年11月29日（日）'],
  ['男子会場', '雫石町営体育館'],
  ['女子会場', '紫波町総合体育館'],
  ['開場時刻', '7:30'],
  ['受付時刻', '7:35〜8:00'],
  ['略称最大文字数', '6'],
  ['受付パスワード', 'indoor40'],
  ['本部パスワード', 'honbu40'],
  ['組合せパスワード', ''],
  ['変更申請の通知先', ''],
  ['領収書発行者', '岩手県中学生ソフトテニス連盟'],
  ['領収書代表者', '会長　佐々木　義孝'],
  ['角印画像ファイルID', ''],
  ['個人戦名簿PDF', '01_個人戦出場ペア名簿.pdf'],
  ['団体戦名簿PDF', '02_団体戦出場チーム一覧.pdf'],
  ['競技開始時刻', '9:00'],
  ['5ゲーム目安（分）', '20'],
  ['7ゲーム目安（分）', '30'],
  ['団体戦の次戦までの間隔（分）', '15'],
  ['個人戦の次戦までの間隔（分）', '0'],
  ['1回戦オーダー締切', '8:40'],
  ['オーダー提出（分）', '10'],
  ['コート集合（分）', '15'],
  ['署名', '岩手県中学生ソフトテニス連盟\n競技委員長　坂倉　大\n携帯：090-7072-2035（18〜20時）\nE-mail：iwatestc2030@gmail.com']
];

/* 区分定義 */
var DIVISIONS = {
  MT: { code: 'MT', name: '男子団体戦', gender: '男', type: 'team' },
  WT: { code: 'WT', name: '女子団体戦', gender: '女', type: 'team' },
  MI: { code: 'MI', name: '男子個人戦', gender: '男', type: 'indiv' },
  WI: { code: 'WI', name: '女子個人戦', gender: '女', type: 'indiv' }
};
var DIV_ORDER = ['MI', 'WI', 'MT', 'WT'];

/* ============================================================
   初期セットアップ（最初に1回だけ手動実行）
   ============================================================ */
function setup() {
  var ss = ss_();
  var names = [SHEET_CONFIG, SHEET_MASTER, SHEET_ENTRY, SHEET_PAIR, SHEET_LOG, SHEET_CHANGE, SHEET_DRAW, SHEET_MATCH, SHEET_RANK, SHEET_REQ, SHEET_OFFICIAL, SHEET_HISTORY];
  var i, sh;
  for (i = 0; i < names.length; i++) {
    sh = ss.getSheetByName(names[i]);
    if (!sh) sh = ss.insertSheet(names[i]);
    /* 日付・スコアの自動変換を防ぐため全セルを書式なしテキストに */
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
    if (names[i] === SHEET_CONFIG) {
      setupConfig_(sh);
    } else {
      ensureHeaders_(sh, HEADERS[names[i]]);
    }
    sh.setFrozenRows(1);
  }
  var def = ss.getSheetByName('シート1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  log_('setup', 'シートを初期化しました');
}

function setupConfig_(sh) {
  if (sh.getLastRow() === 0) sh.appendRow(['項目', '値']);
  var values = sh.getDataRange().getValues();
  var have = {};
  var i;
  for (i = 1; i < values.length; i++) have[String(values[i][0])] = true;
  for (i = 0; i < CONFIG_DEFAULTS.length; i++) {
    if (!have[CONFIG_DEFAULTS[i][0]]) sh.appendRow(CONFIG_DEFAULTS[i]);
  }
}

/* 既存ヘッダーは書き換えず、足りない列だけ末尾に追加する */
function ensureHeaders_(sh, headers) {
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    return;
  }
  var current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var i;
  for (i = 0; i < headers.length; i++) {
    if (current.indexOf(headers[i]) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(headers[i]).setFontWeight('bold');
    }
  }
}

/* ============================================================
   ルーティング
   ============================================================ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case 'getEntry': return json_(apiGetEntry_(p.t));
      /* 進行表・監督ポータル・選手変更一覧は、たくさんの端末が数十秒ごとに読みに来るので、短い時間だけ結果をためて返す（書き込みがあればすぐ作り直す） */
      case 'progress': return cachedJson_('prog:' + p.div, 10, function () { return progressData_(p.div, false); });
      case 'portal': return cachedJson_('portal:' + p.t, 8, function () { return portalData_(p.t); });
      case 'getTicket': return cachedJson_('ticket:' + p.t, 10, function () { return apiGetTicket_(p.t); });
      case 'changeInfo': return json_(changeInfo_(p.t));
      case 'changes': return cachedJson_('changes:' + (p.div || ''), 15, function () { return { status: 'ok', changes: publicChanges_(p.div), periods: changesPeriods_(getConfig_()), divisions: DIVISIONS, divOrder: DIV_ORDER, tournament: getConfig_()['大会名'] }; });
      case 'programData': return json_(programData_());
      case 'ping': return json_({ status: 'ok', time: now_() });
      default: return json_({ status: 'error', message: '不明なアクション: ' + p.action });
    }
  } catch (err) {
    return json_({ status: 'error', message: err.message });
  }
}

/* 読むだけの POST（これ以外の POST があったら、ためておいた進行表などを作り直す） */
var POST_READONLY = { getPdf: 1, recLogin: 1, recList: 1, recLookup: 1, ctlLoad: 1, adminCtlLoad: 1, adminLoad: 1, adminDrawLoad: 1,
  adminPreview: 1, adminPreviewProgram: 1, adminListPdf: 1, adminPdf: 1, adminReceiptPdf: 1, adminReceiptPrint: 1 };

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'error', message: '送信データを読み取れません: ' + err.message });
  }
  var bump = !POST_READONLY[body.action];
  try {
    switch (body.action) {
      case 'submitEntry': return json_(apiSubmitEntry_(body));
      case 'getPdf': return json_(apiGetPdf_(body));
      case 'recLogin':
      case 'recList':
      case 'recLookup':
      case 'recConfirm':
      case 'recCancel': return json_(receptionRoute_(body));
      case 'ctlLoad':
      case 'ctlUpdate':
      case 'ctlRanks':
      case 'ctlDiff':
      case 'ctlConfig':
      case 'ctlOrder':
      case 'ctlPairs': return json_(controlRoute_(body));
      case 'submitOrder': return json_(apiSubmitOrder_(body));
      case 'changeRequest': return json_(apiChangeRequest_(body));
      default:
        if (String(body.action || '').indexOf('admin') === 0) return json_(adminRoute_(body));
        return json_({ status: 'error', message: '不明なアクション: ' + body.action });
    }
  } catch (err) {
    log_('error', body.action + ': ' + err.message);
    return json_({ status: 'error', message: err.message });
  } finally {
    if (bump) bumpCacheGen_();
  }
}

/* ============================================================
   公開API：申込画面
   ============================================================ */
function apiGetEntry_(token) {
  var entry = findEntryByToken_(token);
  if (!entry) return { status: 'error', code: 'invalid', message: '申込リンクが無効です。メールのリンクを確認するか、連盟までお問い合わせください。' };
  if (!entry['初回アクセス日時']) recordFirstAccess_(token);
  var cfg = getConfig_();
  var div = DIVISIONS[entry['区分']];
  var res = {
    status: 'ok',
    tournament: cfg['大会名'],
    division: div,
    teamName: entry['チーム名'],
    district: districtName_(entry['地区']),
    state: entry['状態'] || '未申込',
    period: periodInfo_(cfg),
    date: div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程'],
    venue: div.gender === '男' ? cfg['男子会場'] : cfg['女子会場'],
    abbr: entry['略称'] || '',
    abbrSuggest: suggestAbbr_(entry['チーム名']),
    abbrMax: toInt_(cfg['略称最大文字数']) || 6,
    fee: 0,
    saved: null
  };
  if (entry['状態'] === '申込済') {
    res.saved = {
      abbr: entry['略称'] || '',
      coachName: entry['監督氏名'], coachTitle: entry['監督役職'],
      applicantName: entry['申込者氏名'], applicantTitle: entry['申込者役職'],
      applicantPhone: entry['申込者電話'], applicantEmail: entry['申込者メール'],
      players: parseJson_(entry['選手JSON'], []),
      consentAt: entry['公開同意日時'] || '',
      updatedAt: entry['更新日時'] || entry['申込日時']
    };
  }
  if (div.type === 'team') {
    res.fee = toInt_(cfg['団体戦参加料']);
    res.roster = rosterFor_(entry['チーム名'], div.gender);
  } else {
    var pairs = pairsForEntry_(entry);
    res.pairs = pairs;
    /* 申込時の選手変更（競技委員会承認）があるペアは、交代する側のチームの名簿を渡す */
    res.preRosters = {};
    var pi;
    for (pi = 0; pi < pairs.length; pi++) {
      if (!pairs[pi].preChange) continue;
      var pteam = pairs[pi].preChange.side === 'B' ? pairs[pi].bTeam : pairs[pi].aTeam;
      if (!res.preRosters[pteam]) res.preRosters[pteam] = rosterFor_(pteam, div.gender);
    }
    res.fee = toInt_(cfg['個人戦参加料']) * pairs.length;
    res.feePerPair = toInt_(cfg['個人戦参加料']);
  }
  return res;
}

function apiSubmitEntry_(body) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('混み合っています。少し待ってからもう一度送信してください。');
  try {
    var t = table_(SHEET_ENTRY);
    var entry = null;
    var i;
    for (i = 0; i < t.rows.length; i++) {
      if (body.t && String(t.rows[i]['トークン']) === String(body.t)) { entry = t.rows[i]; break; }
    }
    if (!entry) throw new Error('申込リンクが無効です。');
    var cfg = getConfig_();
    var period = periodInfo_(cfg);
    if (period.state === 'before') throw new Error('申込受付は ' + period.start + ' からです。');
    if (period.state === 'after') throw new Error('申込期間は ' + period.end + ' で終了しました。変更は連盟へご連絡ください。');

    var d = body.data || {};
    var div = DIVISIONS[entry['区分']];
    if (d.consent !== true) throw new Error('「個人情報の取扱い」への同意（選手本人および保護者、監督）のチェックが必要です。');
    requireText_(d.applicantName, '申込責任者の氏名');
    requireText_(d.applicantTitle, '申込責任者の役職');
    requireText_(d.applicantPhone, '申込責任者の携帯番号');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.applicantEmail || ''))) throw new Error('メールアドレスの形式が正しくありません。');
    var abbr = String(d.teamAbbr || '').replace(/[\s　]/g, '');
    var abbrMax = toInt_(cfg['略称最大文字数']) || 6;
    if (!abbr) throw new Error('組合せ用の略称を入力してください。');
    if (abbr.length > abbrMax) throw new Error('略称は' + abbrMax + '文字以内で入力してください。');

    var update = {
      '略称': abbr,
      '申込者氏名': d.applicantName, '申込者役職': d.applicantTitle,
      '申込者電話': String(d.applicantPhone), '申込者メール': d.applicantEmail,
      '更新日時': now_(),
      '公開同意日時': now_()
    };
    var isNew = entry['状態'] !== '申込済';
    if (isNew) update['申込日時'] = now_();
    update['状態'] = '申込済';

    if (div.type === 'team') {
      requireText_(d.coachName, '監督（ベンチ入り指導者）の氏名');
      requireText_(d.coachTitle, '監督（ベンチ入り指導者）の役職');
      var checked = validateTeamPlayers_(d.players, entry['チーム名'], div.gender);
      update['監督氏名'] = d.coachName;
      update['監督役職'] = d.coachTitle;
      update['選手JSON'] = JSON.stringify(checked.players);
      update['要確認'] = checked.flags.join(' / ');
      update['参加料'] = String(toInt_(cfg['団体戦参加料']));
    } else {
      var pairs = pairsForEntry_(entry);
      if (pairs.length === 0) throw new Error('このチームの出場ペアが登録されていません。連盟へお問い合わせください。');
      /* 申込時の選手変更（競技委員会承認）：先にすべて確かめてから、あとで反映する */
      var preDo = [];
      var j0, pq, pv, pside, porigin, pcur;
      for (j0 = 0; j0 < pairs.length; j0++) {
        pq = pairs[j0];
        if (!pq.preChange) continue;
        pv = (d.preChanges || {})[pq.pairId] || {};
        pside = pq.preChange.side === 'B' ? 'B' : 'A';
        porigin = pq.change ? pq.change.from : (pside === 'A' ? pq.aName : pq.bName);
        pcur = pside === 'A' ? pq.aName : pq.bName;
        requireText_(pv.name, 'ペア「' + pq.aName + '・' + pq.bName + '」で、' + porigin + 'さんに代わる選手の氏名');
        requireText_(pv.grade, 'ペア「' + pq.aName + '・' + pq.bName + '」で、代わる選手の学年');
        if (normName_(pv.name) === normName_(porigin)) throw new Error(porigin + 'さんの代わりの選手を選んでください（競技委員会承認の選手変更）。');
        if (normName_(pv.name) === normName_(pcur) && pq.change) continue;
        changePairPlayerCore_({ pairId: pq.pairId, side: pside, name: pv.name, grade: pv.grade, dryRun: true });
        preDo.push({ pairId: pq.pairId, side: pside, name: String(pv.name).trim(), grade: pv.grade, reason: pq.preChange.reason, publicReason: !!pq.preChange.pub });
      }
      var coaches = d.pairCoaches || {};
      var pt = table_(SHEET_PAIR);
      var j, pr, c;
      for (j = 0; j < pt.rows.length; j++) {
        pr = pt.rows[j];
        c = coaches[pr.pairId];
        if (!c) continue;
        if (!isPairOfEntry_(pr, entry)) continue;
        requireText_(c.name, 'ペア「' + pr['A氏名'] + '・' + pr['B氏名'] + '」の監督氏名');
        requireText_(c.title, 'ペア「' + pr['A氏名'] + '・' + pr['B氏名'] + '」の監督役職');
        writeRow_(pt, pr, { '監督氏名': c.name, '監督役職': c.title });
      }
      for (j = 0; j < preDo.length; j++) changePairPlayerCore_(preDo[j]);
      var refreshed = pairsForEntry_(entry);
      for (j = 0; j < refreshed.length; j++) {
        if (!refreshed[j].coachName) throw new Error('すべてのペアに監督（ベンチ入り指導者）を入力してください。');
      }
      update['ペア数'] = String(refreshed.length);
      update['参加料'] = String(toInt_(cfg['個人戦参加料']) * refreshed.length);
      update['選手JSON'] = JSON.stringify(refreshed);
    }
    if (!entry['受付コード']) update['受付コード'] = newCode_(10);
    writeRow_(t, entry, update);
    var saved = table_(SHEET_ENTRY);
    var latest = null;
    for (i = 0; i < saved.rows.length; i++) {
      if (String(saved.rows[i]['トークン']) === String(body.t)) { latest = saved.rows[i]; break; }
    }
    log_(isNew ? '申込' : '修正', div.name + '／' + entry['チーム名']);
    var mailError = '';
    try {
      sendConfirmMail_(latest, cfg, isNew);
    } catch (mErr) {
      mailError = mErr.message;
      log_('mail-error', entry['チーム名'] + ': ' + mErr.message);
    }
    return { status: 'ok', isNew: isNew, mailError: mailError };
  } finally {
    lock.releaseLock();
  }
}

/* 団体戦の選手チェック：最低4名・最大8名、重複不可、名簿外は要確認フラグ */
function validateTeamPlayers_(players, teamName, gender) {
  if (!players || players.length !== 8) throw new Error('選手データが不正です（8枠分必要）。');
  var roster = rosterFor_(teamName, gender);
  var rosterNames = {};
  var i;
  for (i = 0; i < roster.length; i++) rosterNames[normName_(roster[i].name)] = roster[i];
  var out = [];
  var seen = {};
  var flags = [];
  var count = 0;
  var p, key;
  for (i = 0; i < 8; i++) {
    p = players[i] || {};
    if (p.vacant) {
      if (i < 4) throw new Error('No.' + (i + 1) + 'は欠員にできません（最低4名）。');
      out.push({ no: i + 1, vacant: true });
      continue;
    }
    requireText_(p.name, 'No.' + (i + 1) + 'の選手名');
    requireText_(p.grade, 'No.' + (i + 1) + 'の学年');
    key = normName_(p.name);
    if (seen[key]) throw new Error('「' + p.name + '」が重複しています。');
    seen[key] = true;
    var offRoster = !rosterNames[key];
    if (offRoster) flags.push('No.' + (i + 1) + ' ' + p.name + ' は登録名簿にない');
    out.push({ no: i + 1, name: String(p.name).trim(), grade: p.grade, offRoster: offRoster });
    count++;
  }
  if (count < 4) throw new Error('選手は最低4名必要です。');
  return { players: out, flags: flags };
}

/* ============================================================
   公開API：受付票・HP入口
   ============================================================ */
function apiGetTicket_(token) {
  var entry = findEntryByToken_(token);
  if (!entry) return { status: 'error', message: 'リンクが無効です。' };
  if (entry['状態'] !== '申込済') return { status: 'error', message: 'まだ申込が完了していません。' };
  var cfg = getConfig_();
  var div = DIVISIONS[entry['区分']];
  return {
    status: 'ok',
    tournament: cfg['大会名'],
    division: div.name,
    date: div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程'],
    venue: div.gender === '男' ? cfg['男子会場'] : cfg['女子会場'],
    openTime: cfg['開場時刻'],
    receptionTime: cfg['受付時刻'],
    teamName: entry['チーム名'],
    fee: toInt_(entry['参加料']),
    pairCount: toInt_(entry['ペア数']),
    receptionCode: entry['受付コード'],
    /* 受付済みなら受付の時刻（例 7:42）。受付票に「✅ 受付済み（7:42）」と出す */
    reception: entry['受付状態'] === '受付済' ? (String(entry['受付日時'] || '').slice(11, 16).replace(/^0/, '') || '受付済') : '',
    type: DIVISIONS[entry['区分']].type,
    divCode: entry['区分'],
    /* 選手・監督の変更申請ができる期間か（申込締切後〜当日の受付終了）。期間外はボタンを出さない */
    changeOpen: changePeriod_(cfg, div).open,
    /* 表彰の対象（第3位・準優勝・優勝）。個人戦はこのチームが申し込んだペアごと */
    awards: (function () { try { return awardsFor_(entry); } catch (e) { return []; } })(),
    /* このチームの変更申請（申請中・許可・却下）。受付票の上に状況を出す */
    requests: (function () { try { return myRequests_(entry); } catch (e) { return []; } })()
  };
}

/* 申込書PDF（申込者向け：申込リンクのトークンで取得） */
function apiGetPdf_(body) {
  var entry = findEntryByToken_(body.t);
  if (!entry) return { status: 'error', message: 'リンクが無効です。' };
  if (entry['状態'] !== '申込済') return { status: 'error', message: 'まだ申込が完了していません。' };
  return pdfResponse_(entry);
}

function pdfResponse_(entry) {
  var blob = buildApplicationPdf_(entry, getConfig_());
  return { status: 'ok', name: blob.getName(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/* ============================================================
   管理API
   ============================================================ */
function adminRoute_(body) {
  var cfg = getConfig_();
  var given = String(body.pw || '');
  if (given && given === String(cfg['管理パスワード'])) return adminRouteFull_(body, cfg);
  if (given && String(cfg['組合せパスワード'] || '') && given === String(cfg['組合せパスワード'])) return drawRoute_(body, cfg);
  return { status: 'error', code: 'auth', message: 'パスワードが違います。' };
}

/* 組合せ係：組合せの閲覧と保存だけ（公開＝進行表の作成、個人情報、メールは不可） */
function drawRoute_(body, cfg) {
  switch (body.action) {
    case 'adminLoad':
      return { status: 'ok', role: 'draw', config: { '大会名': cfg['大会名'], 'サイトURL': cfg['サイトURL'] }, divisions: DIVISIONS, divOrder: DIV_ORDER };
    case 'adminDrawLoad': return adminDrawLoad_(body);
    case 'adminPreview':
    case 'adminPreviewProgram': return previewRoute_(body);
    case 'adminDrawSave':
      var mt = table_(SHEET_MATCH);
      var i;
      for (i = 0; i < mt.rows.length; i++) {
        if (mt.rows[i]['区分'] === body.div) throw new Error('この区分は進行表（公開）が作成済みのため、組合せ係では変更できません。競技委員長へ連絡してください。');
      }
      body.by = '組合せ係';
      return adminDrawSave_(body);
    default:
      return { status: 'error', code: 'role', message: '組合せ係のパスワードでは、この操作はできません。' };
  }
}

function adminRouteFull_(body, cfg) {
  switch (body.action) {
    case 'adminLoad': return adminLoad_(cfg);
    case 'adminRefreshMaster': return adminRefreshMaster_(cfg);
    case 'adminSetTeams': return adminSetTeams_(body, cfg);
    case 'adminSavePair': return adminSavePair_(body, cfg);
    case 'adminDeletePair': return adminDeletePair_(body);
    case 'adminSendLinks': return adminSendLinks_(body, cfg);
    case 'adminSendReminders': return adminSendReminders_(body, cfg);
    case 'adminPdf': return adminPdf_(body);
    case 'adminListPdf': return adminListPdf_(body, cfg);
    case 'adminReceiptPdf': return adminReceiptPdf_(body, cfg);
    case 'adminReceiptBatch': return adminReceiptBatch_(body, cfg);
    case 'adminReceiptPrint': return adminReceiptPrint_(body, cfg);
    case 'adminResendReceipt': return adminResendReceipt_(body, cfg);
    case 'adminChangeTeamPlayer': return adminChangeTeamPlayer_(body);
    case 'adminChangePairPlayer': return adminChangePairPlayer_(body);
    case 'adminChangeCoach': return adminChangeCoach_(body);
    case 'adminSetPreChange': return adminSetPreChange_(body);
    case 'adminChangeDecide': return adminChangeDecide_(body);
    case 'adminDrawLoad': return adminDrawLoad_(body);
    case 'adminDrawSave': return adminDrawSave_(body);
    case 'adminPreview':
    case 'adminPreviewProgram': return previewRoute_(body);
    case 'adminGenerate': return adminGenerate_(body);
    case 'adminCtlLoad': return progressData_(body.div, true);
    case 'adminCtlUpdate': return adminCtlUpdate_(body);
    case 'adminCtlRanks': return adminCtlRanks_(body);
    case 'adminCtlConfig': return adminCtlConfig_(body);
    default: return { status: 'error', message: '不明な管理アクション: ' + body.action };
  }
}

function adminLoad_(cfg) {
  var m = table_(SHEET_MASTER);
  var teams = [];
  var i, r;
  for (i = 0; i < m.rows.length; i++) {
    r = m.rows[i];
    if (!r['チーム名']) continue;
    teams.push({
      name: r['チーム名'], category: r['種別'], district: districtName_(r['地区']),
      repName: r['代表者名'], hasEmail: !!r['代表者メール'], paid: r['登録料入金'] === '済',
      players: parseJson_(r['選手JSON'], [])
    });
  }
  var e = table_(SHEET_ENTRY);
  var entries = [];
  for (i = 0; i < e.rows.length; i++) {
    r = e.rows[i];
    entries.push({
      entryId: r.entryId, div: r['区分'], teamName: r['チーム名'], district: districtName_(r['地区']),
      repEmail: r['代表者メール'], token: r['トークン'], state: r['状態'] || '未申込',
      appliedAt: r['申込日時'], updatedAt: r['更新日時'], coachName: r['監督氏名'], coachTitle: r['監督役職'],
      applicantTitle: r['申込者役職'],
      applicantName: r['申込者氏名'], applicantPhone: r['申込者電話'], applicantEmail: r['申込者メール'],
      players: parseJson_(r['選手JSON'], []), pairCount: r['ペア数'], fee: r['参加料'],
      flag: r['要確認'], linkSentAt: r['リンク送信日時'], reception: r['受付状態'], abbr: r['略称'] || '',
      firstAccessAt: r['初回アクセス日時'] || '', remindedAt: r['督促送信日時'] || '',
      receptionAt: r['受付日時'] || '', receptionStaff: r['受付担当'] || '', receptionMailAt: r['受付メール送信日時'] || '',
      receiptNo: r['領収書番号'] || '', receiptReady: !!(r['領収書ファイルID'] && String(r['領収書作成日時']) >= String(r['更新日時'] || r['申込日時']))
    });
  }
  var p = table_(SHEET_PAIR);
  var pairs = [];
  for (i = 0; i < p.rows.length; i++) pairs.push(pairObj_(p.rows[i]));
  var safeCfg = {};
  var k;
  for (k in cfg) if (cfg.hasOwnProperty(k) && k !== '管理パスワード') safeCfg[k] = cfg[k];
  return {
    status: 'ok', config: safeCfg, divisions: DIVISIONS, divOrder: DIV_ORDER,
    period: periodInfo_(cfg), teams: teams, entries: entries, pairs: pairs,
    masterUpdatedAt: PropertiesService.getScriptProperties().getProperty('MASTER_UPDATED_AT') || '',
    changes: changeLog_(),
    requests: changeRequests_()
  };
}

/* 登録システム（申込系GAS）から加盟チーム名簿を取り込む（読み取り専用参照） */
function adminRefreshMaster_(cfg) {
  var url = String(cfg['登録システムGAS_URL']) + '?action=getRegistrations';
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('登録システムの読み込みに失敗しました（HTTP ' + res.getResponseCode() + '）');
  var data;
  try {
    data = JSON.parse(res.getContentText());
  } catch (err) {
    throw new Error('登録システムの応答を読み取れません: ' + res.getContentText().slice(0, 80));
  }
  var regs = data.registrations || [];
  var rows = [];
  var i, r, players, j, pl;
  for (i = 0; i < regs.length; i++) {
    r = regs[i];
    if (!r.teamName) continue;
    players = parseJson_(r.playersJson, []);
    var norm = [];
    for (j = 0; j < players.length; j++) {
      pl = players[j] || {};
      if (!pl.name) continue;
      norm.push({ name: String(pl.name).trim(), grade: pl.grade || '', gender: String(pl.gender || '').indexOf('女') >= 0 ? '女' : (String(pl.gender || '').indexOf('男') >= 0 ? '男' : '') });
    }
    rows.push([String(r.teamName).trim(), r.category || '', districtName_(r.district), r.repName || '', r.repEmail || '', r.paid ? '済' : '未', JSON.stringify(norm)]);
  }
  var sh = ss_().getSheetByName(SHEET_MASTER);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, HEADERS[SHEET_MASTER].length).setNumberFormat('@').setValues(rows);
  }
  PropertiesService.getScriptProperties().setProperty('MASTER_UPDATED_AT', now_());
  log_('名簿更新', rows.length + 'チーム');
  return { status: 'ok', count: rows.length };
}

/* 団体戦：出場チームの指定（チェックを外したチームは未申込なら削除） */
function adminSetTeams_(body, cfg) {
  var div = DIVISIONS[body.div];
  if (!div || div.type !== 'team') throw new Error('団体戦の区分を指定してください。');
  var want = body.teams || [];
  var max = toInt_(cfg['団体戦上限']) || 16;
  if (want.length > max) throw new Error(div.name + 'は最大' + max + 'チームです（選択：' + want.length + '）。');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var t = table_(SHEET_ENTRY);
    var existing = {};
    var i, r;
    for (i = 0; i < t.rows.length; i++) {
      r = t.rows[i];
      if (r['区分'] === body.div) existing[r['チーム名']] = r;
    }
    var wantMap = {};
    for (i = 0; i < want.length; i++) wantMap[want[i]] = true;
    var blocked = [];
    var toDelete = [];
    var name;
    for (name in existing) {
      if (!existing.hasOwnProperty(name) || wantMap[name]) continue;
      if (existing[name]['状態'] === '申込済') blocked.push(name);
      else toDelete.push(existing[name]._row);
    }
    if (blocked.length > 0) throw new Error('申込済みのチームは外せません：' + blocked.join('、'));
    toDelete.sort(function (a, b) { return b - a; });
    for (i = 0; i < toDelete.length; i++) t.sheet.deleteRow(toDelete[i]);
    var added = 0;
    for (i = 0; i < want.length; i++) {
      if (existing[want[i]]) continue;
      appendEntry_(body.div, want[i]);
      added++;
    }
    log_('出場指定', div.name + '：追加' + added + '／削除' + toDelete.length);
    return { status: 'ok', added: added, removed: toDelete.length };
  } finally {
    lock.releaseLock();
  }
}

/* 個人戦：選考ペアの登録・更新。支払チームの出場枠を自動作成 */
function adminSavePair_(body, cfg) {
  var p = body.pair || {};
  var div = DIVISIONS[p.div];
  if (!div || div.type !== 'indiv') throw new Error('個人戦の区分を指定してください。');
  requireText_(p.aName, '選手Aの氏名');
  requireText_(p.aTeam, '選手Aの所属');
  requireText_(p.bName, '選手Bの氏名');
  requireText_(p.bTeam, '選手Bの所属');
  var payer = p.payer || p.aTeam;
  if (payer !== p.aTeam && payer !== p.bTeam) throw new Error('支払チームはAかBの所属から選んでください。');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var pt = table_(SHEET_PAIR);
    var count = 0;
    var target = null;
    var i;
    for (i = 0; i < pt.rows.length; i++) {
      if (pt.rows[i]['区分'] === p.div) count++;
      if (p.pairId && pt.rows[i].pairId === p.pairId) target = pt.rows[i];
    }
    var max = toInt_(cfg['個人戦上限']) || 16;
    if (!target && count >= max) throw new Error(div.name + 'は最大' + max + 'ペアです。');
    var values = {
      '区分': p.div, 'A氏名': String(p.aName).trim(), 'A学年': p.aGrade || '', 'A所属': p.aTeam,
      'B氏名': String(p.bName).trim(), 'B学年': p.bGrade || '', 'B所属': p.bTeam, '支払チーム': payer
    };
    var oldPayer = target ? target['支払チーム'] : null;
    if (target) {
      if (oldPayer !== payer && entryStateFor_(p.div, oldPayer) === '申込済') {
        throw new Error('支払チーム「' + oldPayer + '」は申込済みのため、支払チームを変更できません。');
      }
      writeRow_(pt, target, values);
    } else {
      values.pairId = 'P' + newCode_(8);
      appendObj_(pt, values);
    }
    ensureEntry_(p.div, payer);
    if (oldPayer && oldPayer !== payer) cleanupEntry_(p.div, oldPayer);
    log_('ペア登録', div.name + '：' + values['A氏名'] + '・' + values['B氏名']);
    return { status: 'ok' };
  } finally {
    lock.releaseLock();
  }
}

function adminDeletePair_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var pt = table_(SHEET_PAIR);
    var i, r;
    for (i = 0; i < pt.rows.length; i++) {
      r = pt.rows[i];
      if (r.pairId === body.pairId) {
        if (entryStateFor_(r['区分'], r['支払チーム']) === '申込済') {
          throw new Error('支払チーム「' + r['支払チーム'] + '」は申込済みです。ペアを外す場合はスプレッドシートで直接修正してください。');
        }
        pt.sheet.deleteRow(r._row);
        cleanupEntry_(r['区分'], r['支払チーム']);
        log_('ペア削除', r['A氏名'] + '・' + r['B氏名']);
        return { status: 'ok' };
      }
    }
    throw new Error('ペアが見つかりません。');
  } finally {
    lock.releaseLock();
  }
}

/* 申込リンクの送信：代表者メールごとに1通にまとめる */
/* 申込書PDF（管理者用） */
function adminPdf_(body) {
  var t = table_(SHEET_ENTRY);
  var i;
  for (i = 0; i < t.rows.length; i++) {
    if (t.rows[i].entryId === body.entryId) {
      if (t.rows[i]['状態'] !== '申込済') throw new Error('まだ申込されていません。');
      return pdfResponse_(t.rows[i]);
    }
  }
  throw new Error('申込データが見つかりません。');
}

function adminSendLinks_(body, cfg) {
  var t = table_(SHEET_ENTRY);
  var ids = body.entryIds || [];
  var onlyUnsent = !!body.onlyUnsent;
  var groups = {};
  var order = [];
  var skipped = [];
  var i, r, key;
  for (i = 0; i < t.rows.length; i++) {
    r = t.rows[i];
    if (ids.length > 0 && ids.indexOf(r.entryId) < 0) continue;
    if (onlyUnsent && r['リンク送信日時']) continue;
    if (!r['代表者メール']) { skipped.push(r['チーム名']); continue; }
    key = String(r['代表者メール']).toLowerCase() + '|' + r['チーム名'];
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(r);
  }
  var remaining = MailApp.getRemainingDailyQuota();
  if (order.length > remaining) throw new Error('本日のメール送信可能数（残り' + remaining + '通）を超えます。対象を絞ってください。');
  /* 添付する確定名簿（PDF）を送信前にすべて用意する。見つからなければ1通も送らない */
  var need = { indiv: false, team: false };
  for (i = 0; i < order.length; i++) {
    var kinds = linkMailKinds_(groups[order[i]]);
    if (kinds.indiv) need.indiv = true;
    if (kinds.team) need.team = true;
  }
  var att = {};
  if (need.indiv) att.indiv = rosterPdf_(cfg['個人戦名簿PDF'] || '01_個人戦出場ペア名簿.pdf', '個人戦名簿PDF');
  if (need.team) att.team = rosterPdf_(cfg['団体戦名簿PDF'] || '02_団体戦出場チーム一覧.pdf', '団体戦名簿PDF');
  var sent = 0;
  var stamp = now_();
  for (i = 0; i < order.length; i++) {
    var resent = false;
    var x;
    for (x = 0; x < groups[order[i]].length; x++) if (groups[order[i]][x]['リンク送信日時']) resent = true;
    sendLinkMail_(groups[order[i]], cfg, resent, att);
    var j;
    for (j = 0; j < groups[order[i]].length; j++) writeRow_(t, groups[order[i]][j], { 'リンク送信日時': stamp });
    sent++;
  }
  log_('リンク送信', sent + '通' + (skipped.length ? '／メール未登録：' + skipped.join('、') : ''));
  return { status: 'ok', sent: sent, skipped: skipped };
}

/* 未申込チームへの督促メール（管理者のみ）。同じチームの複数区分は1通にまとめる */
function adminSendReminders_(body, cfg) {
  var t = table_(SHEET_ENTRY);
  var ids = body.entryIds || [];
  var groups = {};
  var order = [];
  var skipped = [];
  var i, r, key;
  for (i = 0; i < t.rows.length; i++) {
    r = t.rows[i];
    if (r['状態'] === '申込済') continue;
    if (ids.length > 0 && ids.indexOf(r.entryId) < 0) continue;
    if (!r['代表者メール']) { skipped.push(r['チーム名']); continue; }
    key = String(r['代表者メール']).toLowerCase() + '|' + r['チーム名'];
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(r);
  }
  if (order.length === 0) return { status: 'ok', sent: 0, skipped: skipped };
  var remaining = MailApp.getRemainingDailyQuota();
  if (order.length > remaining) throw new Error('本日のメール送信可能数（残り' + remaining + '通）を超えます。対象を絞ってください。');
  var stamp = now_();
  var j;
  for (i = 0; i < order.length; i++) {
    sendReminderMail_(groups[order[i]], cfg);
    for (j = 0; j < groups[order[i]].length; j++) writeRow_(t, groups[order[i]][j], { '督促送信日時': stamp });
  }
  log_('督促送信', order.length + '通' + (skipped.length ? '／メール未登録：' + skipped.join('、') : ''));
  return { status: 'ok', sent: order.length, skipped: skipped };
}

/* ============================================================
   メール
   ============================================================ */
function sendReminderMail_(rows, cfg) {
  var first = rows[0];
  var site = siteUrl_(cfg);
  var lines = [];
  lines.push(first['チーム名'] + '　' + (first['代表者名'] ? first['代表者名'] + ' 様' : 'ご担当者 様'));
  lines.push('');
  lines.push('岩手県中学生ソフトテニス連盟です。');
  lines.push(cfg['大会名'] + 'について、下記の区分の参加申込がまだ完了していません。');
  lines.push('申込締切（' + warekiDateTime_(cfg['申込締切']) + '）までに、専用の申込リンクからお申し込みください。');
  lines.push('');
  var sorted = rows.slice().sort(function (a, b) { return DIV_ORDER.indexOf(a['区分']) - DIV_ORDER.indexOf(b['区分']); });
  var i, r, div;
  for (i = 0; i < sorted.length; i++) {
    r = sorted[i];
    div = DIVISIONS[r['区分']];
    lines.push('■ ' + div.name + '（' + (div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']) + '）');
    lines.push('　' + site + (div.type === 'team' ? 'entry-team.html' : 'entry-individual.html') + '?t=' + r['トークン']);
    lines.push('');
  }
  lines.push('※ 出場を辞退される場合や、すでに申込済みの場合は、お手数ですが下記までご連絡ください。');
  lines.push('');
  lines.push('--');
  lines.push(cfg['署名']);
  var subject = '【' + cfg['大会名'] + '】参加申込のお願い（締切 ' + warekiDateTime_(cfg['申込締切']) + '）';
  MailApp.sendEmail({ to: first['代表者メール'], subject: subject, body: lines.join('\n'), name: '岩手県中学生ソフトテニス連盟' });
}

/* 1通に含まれる区分の種類（個人戦・団体戦） */
function linkMailKinds_(rows) {
  var k = { indiv: false, team: false };
  var i;
  for (i = 0; i < rows.length; i++) {
    if (DIVISIONS[rows[i]['区分']].type === 'team') k.team = true; else k.indiv = true;
  }
  return k;
}

/* 確定名簿PDFをGoogleドライブから取得。設定値はファイル名・ファイルID・ドライブのURLのどれでもよい */
function rosterPdf_(spec, label) {
  spec = String(spec || '').trim();
  var file = null;
  var m = spec.match(/\/d\/([A-Za-z0-9_-]{20,})/) || spec.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  var id = m ? m[1] : (/^[A-Za-z0-9_-]{25,}$/.test(spec) ? spec : '');
  if (id) {
    try { file = DriveApp.getFileById(id); } catch (e) { throw new Error('設定「' + label + '」のファイル（' + spec + '）を開けません。'); }
  } else {
    var it = DriveApp.getFilesByName(spec);
    var f;
    while (it.hasNext()) {
      f = it.next();
      if (f.isTrashed()) continue;
      if (!file || f.getLastUpdated().getTime() > file.getLastUpdated().getTime()) file = f;
    }
    if (!file) throw new Error('添付する「' + spec + '」がGoogleドライブに見つかりません。メールは送信していません。ファイルをドライブに置くか、設定シート「' + label + '」にファイル名・ID・URLを入れてください。');
  }
  var blob = file.getBlob();
  if (blob.getContentType() !== 'application/pdf') blob = file.getAs('application/pdf');
  return blob.setName(id ? file.getName() : spec);
}

function sendLinkMail_(rows, cfg, isResend, att) {
  var first = rows[0];
  if (!first['代表者メール']) return;
  var kinds = linkMailKinds_(rows);
  att = att || {};
  var site = siteUrl_(cfg);
  var lines = [];
  lines.push(first['チーム名'] + '　' + (first['代表者名'] ? first['代表者名'] + ' 様' : 'ご担当者 様'));
  lines.push('');
  lines.push('岩手県中学生ソフトテニス連盟です。');
  lines.push(cfg['大会名'] + 'の参加申込についてご案内します。');
  lines.push('');
  lines.push('貴チームは下記の区分の' + (kinds.team && kinds.indiv ? '出場チーム・出場ペア' : kinds.team ? '出場チーム' : '出場ペア') + 'に決定しました。');
  lines.push((kinds.team && kinds.indiv ? '個人戦の出場ペア名簿と団体戦の出場チーム一覧' : kinds.team ? '団体戦の出場チーム一覧' : '個人戦の出場ペア名簿') + '（PDF）を添付しています。');
  lines.push('それぞれ専用の申込リンクから、申込期間内にお申し込みください。');
  lines.push('');
  lines.push('■ 申込期間');
  lines.push('　' + warekiDateTime_(cfg['申込開始']) + ' 〜 ' + warekiDateTime_(cfg['申込締切']));
  lines.push('');
  var sorted = rows.slice().sort(function (a, b) { return DIV_ORDER.indexOf(a['区分']) - DIV_ORDER.indexOf(b['区分']); });
  var i, r, div;
  for (i = 0; i < sorted.length; i++) {
    r = sorted[i];
    div = DIVISIONS[r['区分']];
    lines.push('■ ' + div.name + '（' + (div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']) + '／' + (div.gender === '男' ? cfg['男子会場'] : cfg['女子会場']) + '）');
    if (div.type === 'indiv') {
      var pairs = pairsForEntry_(r);
      var j;
      for (j = 0; j < pairs.length; j++) lines.push('　・' + pairs[j].label);
    }
    lines.push('　' + site + (div.type === 'team' ? 'entry-team.html' : 'entry-individual.html') + '?t=' + r['トークン']);
    lines.push('');
  }
  lines.push('※ このリンクは貴チーム専用です。他チームへの転送はご遠慮ください。');
  lines.push('※ 申込後も、申込期間内であれば同じリンクから内容を修正できます。');
  lines.push('※ 参加料は大会当日の受付で現金にて納入してください。');
  lines.push('※ 申込フォームでは、選手の氏名・学年・学校名、監督（ベンチ入り指導者）の氏名、試合結果を大会ホームページへの掲載や報道機関への結果提供等に使用することについて、選手本人および保護者、監督の同意を得ていることを確認します。申込開始までにご確認をお願いします。');
  lines.push('');
  lines.push('--');
  lines.push(cfg['署名']);
  var what = kinds.team && kinds.indiv ? '団体戦出場チーム・個人戦出場ペアの決定について' : kinds.team ? '団体戦出場チームの決定について' : '個人戦出場ペアの決定について';
  var subject = '【' + cfg['大会名'] + '】' + what + '（申込リンクのご案内）' + (isResend ? '（再送）' : '');
  var files = [];
  if (kinds.indiv) { if (!att.indiv) att.indiv = rosterPdf_(cfg['個人戦名簿PDF'] || '01_個人戦出場ペア名簿.pdf', '個人戦名簿PDF'); files.push(att.indiv); }
  if (kinds.team) { if (!att.team) att.team = rosterPdf_(cfg['団体戦名簿PDF'] || '02_団体戦出場チーム一覧.pdf', '団体戦名簿PDF'); files.push(att.team); }
  MailApp.sendEmail({ to: first['代表者メール'], subject: subject, body: lines.join('\n'), name: '岩手県中学生ソフトテニス連盟', attachments: files });
}

function sendConfirmMail_(entry, cfg, isNew) {
  var div = DIVISIONS[entry['区分']];
  var site = siteUrl_(cfg);
  var lines = [];
  lines.push(entry['チーム名'] + '　' + entry['申込者氏名'] + ' 様');
  lines.push('');
  lines.push(cfg['大会名'] + '　' + div.name + 'の' + (isNew ? '参加申込を受け付けました。' : '申込内容の修正を受け付けました。'));
  lines.push('');
  lines.push('■ 大会情報');
  lines.push('　期日：' + (div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']));
  lines.push('　会場：' + (div.gender === '男' ? cfg['男子会場'] : cfg['女子会場']));
  lines.push('　開場：' + cfg['開場時刻']);
  lines.push('　受付：' + cfg['受付時刻']);
  lines.push('');
  lines.push('■ 申込内容');
  lines.push('　チーム名：' + entry['チーム名'] + (entry['略称'] ? '（組合せ表記：' + entry['略称'] + '）' : ''));
  if (div.type === 'team') {
    lines.push('　監督（ベンチ入り指導者）：' + entry['監督氏名'] + '（' + entry['監督役職'] + '）');
    var players = parseJson_(entry['選手JSON'], []);
    var i;
    for (i = 0; i < players.length; i++) {
      lines.push('　' + players[i].no + '．' + (players[i].vacant ? '（欠員）' : players[i].name + '（' + players[i].grade + '）'));
    }
  } else {
    var pairs = pairsForEntry_(entry);
    var k;
    for (k = 0; k < pairs.length; k++) {
      lines.push('　ペア' + (k + 1) + '：' + pairs[k].label + '　監督：' + pairs[k].coachName + '（' + pairs[k].coachTitle + '）');
    }
  }
  lines.push('　申込責任者：' + entry['申込者氏名'] + '（' + entry['申込者役職'] + '）' + entry['申込者電話']);
  lines.push('　個人情報の取扱い：同意済み（選手本人および保護者、監督）');
  lines.push('');
  lines.push('■ 参加料：' + toInt_(entry['参加料']).toLocaleString() + '円（大会当日の受付で現金にて納入）');
  lines.push('');
  lines.push('■ 申込書（PDF）');
  lines.push('　このメールに添付しています。申込内容の修正ページからもダウンロードできます。');
  lines.push('');
  lines.push('■ 当日受付票（二次元コード）');
  lines.push('　当日の受付で、次のページの二次元コードを提示してください。');
  lines.push('　' + site + 'ticket.html?t=' + entry['トークン']);
  lines.push('');
  lines.push('■ 申込内容の修正は' + warekiDateTime_(cfg['申込締切']) + 'まで可能です。');
  lines.push('　' + site + (div.type === 'team' ? 'entry-team.html' : 'entry-individual.html') + '?t=' + entry['トークン']);
  lines.push('');
  lines.push('--');
  lines.push(cfg['署名']);
  var subject = '【' + cfg['大会名'] + '】' + div.name + ' ' + (isNew ? '申込受付' : '申込修正') + '（' + entry['チーム名'] + '）';
  var mail = { to: entry['申込者メール'], subject: subject, body: lines.join('\n'), name: '岩手県中学生ソフトテニス連盟' };
  /* 申込書PDFを添付（作成に失敗してもメールは送る） */
  try {
    mail.attachments = [buildApplicationPdf_(entry, cfg)];
  } catch (pErr) {
    log_('pdf-error', entry['チーム名'] + ': ' + pErr.message);
  }
  MailApp.sendEmail(mail);
}

/* ============================================================
   申込書PDF（A4縦1枚）
   Googleドキュメントで作成 → PDF化 → 一時ドキュメントは削除
   ============================================================ */
var PDF_GREEN = '#1a4a2e';
var PDF_LIGHT = '#e8f1eb';

function buildApplicationPdf_(entry, cfg) {
  var div = DIVISIONS[entry['区分']];
  var doc = DocumentApp.create('申込書_' + entry['区分'] + '_' + entry['チーム名']);
  var fileId = doc.getId();
  try {
    var body = doc.getBody();
    body.setPageWidth(595.28).setPageHeight(841.89);
    body.setMarginTop(36).setMarginBottom(30).setMarginLeft(42).setMarginRight(42);

    var head = body.getParagraphs()[0];
    head.setText(cfg['大会名']);
    pdfPara_(head, 12, true, DocumentApp.HorizontalAlignment.CENTER, 0, 2);
    pdfPara_(body.appendParagraph(div.name + '　参加申込書'), 18, true, DocumentApp.HorizontalAlignment.CENTER, 0, 4);
    var stamp = '申込日時：' + warekiDateTime_(entry['申込日時']);
    if (entry['更新日時'] && entry['更新日時'] !== entry['申込日時']) stamp += '　最終更新：' + warekiDateTime_(entry['更新日時']);
    pdfPara_(body.appendParagraph(stamp), 9, false, DocumentApp.HorizontalAlignment.RIGHT, 0, 6);

    pdfHeading_(body, '大会情報');
    pdfKvTable_(body, [
      ['期日', div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']],
      ['会場', div.gender === '男' ? cfg['男子会場'] : cfg['女子会場']],
      ['開場・受付', '開場 ' + cfg['開場時刻'] + '　／　受付 ' + cfg['受付時刻']]
    ]);

    pdfHeading_(body, 'チーム');
    var teamRows = [
      ['チーム名', entry['チーム名']],
      ['組合せ表記（略称）', entry['略称'] || ''],
      ['地区', districtName_(entry['地区'])]
    ];
    if (div.type === 'team') teamRows.push(['監督（ベンチ入り指導者）', entry['監督氏名'] + '（' + entry['監督役職'] + '）']);
    pdfKvTable_(body, teamRows);

    if (div.type === 'team') {
      pdfHeading_(body, '選手');
      var players = parseJson_(entry['選手JSON'], []);
      var rows = [['No.', '氏名', '学年', '備考']];
      var i, p;
      for (i = 0; i < 8; i++) {
        p = players[i] || { vacant: true };
        var note = p.vacant ? '欠員' : (p.offRoster ? '登録名簿外（要確認）' : '');
        if (p.changedFrom) note = (note ? note + '\n' : '') + '選手変更（変更前：' + p.changedFrom + '）';
        rows.push([String(i + 1), p.vacant ? '' : p.name, p.vacant ? '' : p.grade, note]);
      }
      pdfGridTable_(body, rows, [40, 230, 60, 181]);
    } else {
      pdfHeading_(body, '出場ペア');
      var pairs = pairsForEntry_(entry);
      var prow = [['ペア', '選手A', '選手B', '監督（ベンチ入り指導者）']];
      var k, pr;
      for (k = 0; k < pairs.length; k++) {
        pr = pairs[k];
        prow.push([String(k + 1),
          pr.aName + '（' + pr.aGrade + '）\n' + pr.aTeam,
          pr.bName + '（' + pr.bGrade + '）\n' + pr.bTeam,
          (pr.coachName || '') + (pr.coachTitle ? '\n（' + pr.coachTitle + '）' : '')]);
      }
      pdfGridTable_(body, prow, [40, 165, 165, 141]);
    }

    pdfHeading_(body, '申込責任者');
    pdfKvTable_(body, [
      ['氏名（役職）', entry['申込者氏名'] + '（' + entry['申込者役職'] + '）'],
      ['携帯番号', entry['申込者電話']],
      ['メールアドレス', entry['申込者メール']]
    ]);

    pdfHeading_(body, '参加料');
    var feeText = toInt_(entry['参加料']).toLocaleString() + '円';
    if (div.type === 'indiv') feeText += '（' + toInt_(entry['ペア数']) + 'ペア × ' + toInt_(cfg['個人戦参加料']).toLocaleString() + '円）';
    pdfKvTable_(body, [['参加料', feeText + '　大会当日の受付で現金にて納入']]);

    pdfPara_(pdfNextPara_(body, '受付コード：' + (entry['受付コード'] || '') + '　　岩手県中学生ソフトテニス連盟'), 8, false, DocumentApp.HorizontalAlignment.RIGHT, 10, 0);

    doc.saveAndClose();
    var name = cfg['大会名'] + '_' + div.name + '_申込書_' + entry['チーム名'] + '.pdf';
    return DriveApp.getFileById(fileId).getAs(MimeType.PDF).setName(name);
  } finally {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* 削除失敗は無視 */ }
  }
}

function pdfPara_(p, size, bold, align, before, after) {
  p.setAlignment(align).setSpacingBefore(before).setSpacingAfter(after).setLineSpacing(1);
  var t = p.editAsText();
  if (t.getText().length > 0) t.setFontSize(size).setBold(bold).setForegroundColor('#000000');
  return p;
}

/* ============================================================
   区分別 申込一覧PDF（A4横）
   ============================================================ */
function adminListPdf_(body, cfg) {
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var t = table_(SHEET_ENTRY);
  var entries = [];
  var i;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i]['区分'] === body.div) entries.push(t.rows[i]);
  entries.sort(function (a, b) { return districtCompare_(a['地区'], b['地区']) || String(a['チーム名']).localeCompare(String(b['チーム名']), 'ja'); });
  var applied = 0;
  var feeTotal = 0;
  for (i = 0; i < entries.length; i++) {
    if (entries[i]['状態'] === '申込済') { applied++; feeTotal += toInt_(entries[i]['参加料']); }
  }

  var name = cfg['大会名'] + '_' + div.name + '_申込一覧.pdf';
  var doc = DocumentApp.create('一覧_' + body.div);
  var fileId = doc.getId();
  try {
    var b = doc.getBody();
    b.setPageWidth(841.89).setPageHeight(595.28);
    b.setMarginTop(28).setMarginBottom(24).setMarginLeft(28).setMarginRight(28);
    var head = b.getParagraphs()[0];
    head.setText(cfg['大会名'] + '　' + div.name + '　申込一覧');
    pdfPara_(head, 14, true, DocumentApp.HorizontalAlignment.CENTER, 0, 2);
    var summary = (div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']) + '　' + (div.gender === '男' ? cfg['男子会場'] : cfg['女子会場']) +
      '　｜　申込済 ' + applied + ' / 出場 ' + entries.length + ' チーム';
    var rows, widths;
    if (div.type === 'team') {
      rows = [['No.', '地区', 'チーム名\n（略称）', '監督', '1', '2', '3', '4', '5', '6', '7', '8', '状態']];
      var e, players, row, k, p;
      for (i = 0; i < entries.length; i++) {
        e = entries[i];
        players = e['状態'] === '申込済' ? parseJson_(e['選手JSON'], []) : [];
        row = [String(i + 1), districtName_(e['地区']), e['チーム名'] + (e['略称'] ? '\n（' + e['略称'] + '）' : ''), e['監督氏名'] || ''];
        for (k = 0; k < 8; k++) {
          p = players[k];
          if (!p) row.push('');
          else if (p.vacant) row.push('欠員');
          else row.push(p.name + (p.offRoster ? '※' : '') + '\n' + p.grade);
        }
        row.push(e['状態'] || '未申込');
        rows.push(row);
      }
      widths = [22, 36, 104, 62, 62, 62, 62, 62, 62, 62, 62, 62, 46];
    } else {
      var pt = table_(SHEET_PAIR);
      var pairs = [];
      for (i = 0; i < pt.rows.length; i++) if (pt.rows[i]['区分'] === body.div) pairs.push(pairObj_(pt.rows[i]));
      summary += '（' + pairs.length + 'ペア）';
      var stateOf = {};
      var abbrOf = {};
      for (i = 0; i < entries.length; i++) { stateOf[entries[i]['チーム名']] = entries[i]['状態'] || '未申込'; abbrOf[entries[i]['チーム名']] = entries[i]['略称'] || ''; }
      rows = [['No.', '選手A', '学年', '所属', '選手B', '学年', '所属', '監督（役職）', '申込チーム\n（略称）', '状態']];
      var pr;
      for (i = 0; i < pairs.length; i++) {
        pr = pairs[i];
        rows.push([String(i + 1), pr.aName, pr.aGrade || '', pr.aTeam, pr.bName, pr.bGrade || '', pr.bTeam,
          pr.coachName ? pr.coachName + '\n（' + pr.coachTitle + '）' : '',
          pr.payer + (abbrOf[pr.payer] ? '\n（' + abbrOf[pr.payer] + '）' : ''), stateOf[pr.payer] || '未申込']);
      }
      widths = [22, 82, 32, 108, 82, 32, 108, 100, 108, 46];
    }
    summary += '　｜　参加料（申込済）' + feeTotal.toLocaleString() + '円　｜　作成 ' + warekiDateTime_(now_());
    pdfPara_(b.appendParagraph(summary), 8.5, false, DocumentApp.HorizontalAlignment.RIGHT, 0, 4);
    pdfGridTable_(b, rows, widths, 8.5);
    if (div.type === 'team') pdfPara_(pdfNextPara_(b, '※ 登録名簿にない選手（要確認）'), 8, false, DocumentApp.HorizontalAlignment.LEFT, 4, 0);
    doc.saveAndClose();
    var blob = DriveApp.getFileById(fileId).getAs(MimeType.PDF).setName(name);
    return { status: 'ok', name: name, base64: Utilities.base64Encode(blob.getBytes()) };
  } finally {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) { /* 削除失敗は無視 */ }
  }
}

/* 表の直後に自動で入る空段落があれば再利用する（余白を詰める） */
function pdfNextPara_(body, text) {
  var n = body.getNumChildren();
  var last = n > 0 ? body.getChild(n - 1) : null;
  if (last && last.getType() === DocumentApp.ElementType.PARAGRAPH && last.asParagraph().getText() === '' && n > 1) {
    var p = last.asParagraph();
    p.setText(text);
    return p;
  }
  return body.appendParagraph(text);
}

function pdfHeading_(body, label) {
  var p = pdfNextPara_(body, '■ ' + label);
  pdfPara_(p, 10.5, true, DocumentApp.HorizontalAlignment.LEFT, 8, 3);
  p.editAsText().setForegroundColor(PDF_GREEN);
}

/* 項目名｜内容 の2列表 */
function pdfKvTable_(body, rows) {
  var table = body.appendTable(rows);
  table.setBorderColor('#999999').setBorderWidth(0.5);
  table.setColumnWidth(0, 150);
  var r, c, cell;
  for (r = 0; r < table.getNumRows(); r++) {
    for (c = 0; c < 2; c++) {
      cell = table.getRow(r).getCell(c);
      pdfCell_(cell, 10, c === 0, c === 0 ? PDF_LIGHT : '#ffffff', '#000000');
    }
  }
  return table;
}

/* 見出し行つきの一覧表（1行目が見出し） */
function pdfGridTable_(body, rows, widths, size) {
  size = size || 10;
  var table = body.appendTable(rows);
  table.setBorderColor('#999999').setBorderWidth(0.5);
  var r, c, cell;
  for (c = 0; c < widths.length; c++) table.setColumnWidth(c, widths[c]);
  for (r = 0; r < table.getNumRows(); r++) {
    for (c = 0; c < table.getRow(r).getNumCells(); c++) {
      cell = table.getRow(r).getCell(c);
      if (r === 0) {
        pdfCell_(cell, size - 0.5, true, PDF_GREEN, '#ffffff');
      } else {
        /* 見出しの白文字がデータ行に引き継がれないよう黒を明示 */
        pdfCell_(cell, size, false, '#ffffff', '#000000');
      }
      if (c === 0) cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }
  return table;
}

function pdfCell_(cell, size, bold, bg, color) {
  cell.setBackgroundColor(bg).setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);
  var t = cell.editAsText();
  if (t.getText().length > 0) t.setFontSize(size).setBold(bold).setForegroundColor(color);
  var n = cell.getNumChildren();
  var i;
  for (i = 0; i < n; i++) {
    if (cell.getChild(i).getType() === DocumentApp.ElementType.PARAGRAPH) {
      cell.getChild(i).asParagraph().setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
    }
  }
}

/* ============================================================
   データヘルパー
   ============================================================ */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function table_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。setup() を実行してください。');
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : [];
  var rows = [];
  var i, j, o;
  for (i = 1; i < values.length; i++) {
    o = { _row: i + 1 };
    for (j = 0; j < headers.length; j++) o[headers[j]] = values[i][j] === null ? '' : values[i][j];
    rows.push(o);
  }
  return { sheet: sh, headers: headers, rows: rows };
}

function writeRow_(t, rowObj, update) {
  var range = t.sheet.getRange(rowObj._row, 1, 1, t.headers.length);
  var current = range.getValues()[0];
  var k, col;
  for (k in update) {
    if (!update.hasOwnProperty(k)) continue;
    col = t.headers.indexOf(k);
    if (col < 0 && HEADERS[t.sheet.getName()] && HEADERS[t.sheet.getName()].indexOf(k) >= 0) {
      /* 新しく追加した列（例：略称）は自動でヘッダーを足す */
      t.sheet.getRange(1, t.headers.length + 1).setNumberFormat('@').setValue(k).setFontWeight('bold');
      t.headers.push(k);
      current.push('');
      range = t.sheet.getRange(rowObj._row, 1, 1, t.headers.length);
      col = t.headers.length - 1;
    }
    if (col < 0) throw new Error('シート「' + t.sheet.getName() + '」に列「' + k + '」がありません。setup() を再実行してください。');
    current[col] = update[k] === undefined || update[k] === null ? '' : update[k];
    rowObj[k] = current[col];
  }
  range.setNumberFormat('@').setValues([current]);
}

function appendObj_(t, obj) {
  var row = [];
  var i;
  for (i = 0; i < t.headers.length; i++) row.push(obj[t.headers[i]] === undefined ? '' : obj[t.headers[i]]);
  var r = t.sheet.getLastRow() + 1;
  t.sheet.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}

function appendEntry_(divCode, teamName) {
  var master = masterTeam_(teamName, DIVISIONS[divCode].gender);
  var t = table_(SHEET_ENTRY);
  appendObj_(t, {
    entryId: 'E' + newCode_(8), '区分': divCode, 'チーム名': teamName,
    '地区': master ? districtName_(master['地区']) : '', '代表者名': master ? master['代表者名'] : '',
    '代表者メール': master ? master['代表者メール'] : '', 'トークン': newCode_(16), '状態': '未申込'
  });
}

function ensureEntry_(divCode, teamName) {
  if (entryStateFor_(divCode, teamName) === null) appendEntry_(divCode, teamName);
}

/* 支払チームのペアが0になり、未申込なら出場枠を削除 */
function cleanupEntry_(divCode, teamName) {
  var pt = table_(SHEET_PAIR);
  var i;
  for (i = 0; i < pt.rows.length; i++) {
    if (pt.rows[i]['区分'] === divCode && pt.rows[i]['支払チーム'] === teamName) return;
  }
  var t = table_(SHEET_ENTRY);
  for (i = 0; i < t.rows.length; i++) {
    if (t.rows[i]['区分'] === divCode && t.rows[i]['チーム名'] === teamName && t.rows[i]['状態'] !== '申込済') {
      t.sheet.deleteRow(t.rows[i]._row);
      return;
    }
  }
}

function entryStateFor_(divCode, teamName) {
  var t = table_(SHEET_ENTRY);
  var i;
  for (i = 0; i < t.rows.length; i++) {
    if (t.rows[i]['区分'] === divCode && t.rows[i]['チーム名'] === teamName) return t.rows[i]['状態'] || '未申込';
  }
  return null;
}

/* 申込リンクが初めて開かれた日時を記録（管理画面の「未開封」判定に使う） */
function recordFirstAccess_(token) {
  try {
    var t = table_(SHEET_ENTRY);
    var i;
    for (i = 0; i < t.rows.length; i++) {
      if (String(t.rows[i]['トークン']) === String(token)) {
        if (!t.rows[i]['初回アクセス日時']) writeRow_(t, t.rows[i], { '初回アクセス日時': now_() });
        return;
      }
    }
  } catch (err) {
    log_('error', '初回アクセス記録: ' + err.message);
  }
}

function findEntryByToken_(token) {
  if (!token || String(token).length < 8) return null;
  var t = table_(SHEET_ENTRY);
  var i;
  for (i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i]['トークン']) === String(token)) return t.rows[i];
  }
  return null;
}

/* 加盟チーム名簿からチームを探す。同じ名前で男女別に登録している団体（例：クラブ）は、
   gender（'男'／'女'）に合う種別の登録を優先する（男子・女子 → 完全一致、男女 → 次点） */
function masterTeam_(name, gender) {
  var m = table_(SHEET_MASTER);
  var best = null, bestScore = -1;
  var i, sc;
  for (i = 0; i < m.rows.length; i++) {
    if (m.rows[i]['チーム名'] !== name) continue;
    sc = gender ? categoryScore_(m.rows[i]['種別'], gender) : 0;
    if (sc > bestScore) { best = m.rows[i]; bestScore = sc; }
  }
  return best;
}

function categoryScore_(cat, gender) {
  cat = String(cat || '');
  if (cat.indexOf('男女') >= 0) return 1;
  if (cat.indexOf(gender) >= 0) return 2;
  return cat ? 0 : 1;
}

/* 登録名簿のうち、指定の性別の選手（性別未設定の選手も含める） */
function rosterFor_(teamName, gender) {
  var m = masterTeam_(teamName, gender);
  if (!m) return [];
  var players = parseJson_(m['選手JSON'], []);
  var out = [];
  var i;
  for (i = 0; i < players.length; i++) {
    if (!players[i].gender || players[i].gender === gender) out.push({ name: players[i].name, grade: players[i].grade });
  }
  return out;
}

function isPairOfEntry_(pr, entry) {
  return pr['区分'] === entry['区分'] && pr['支払チーム'] === entry['チーム名'];
}

function pairsForEntry_(entry) {
  var pt = table_(SHEET_PAIR);
  var out = [];
  var i;
  for (i = 0; i < pt.rows.length; i++) {
    if (isPairOfEntry_(pt.rows[i], entry)) out.push(pairObj_(pt.rows[i]));
  }
  return out;
}

function pairObj_(r) {
  var joint = r['A所属'] !== r['B所属'];
  var label = r['A氏名'] + '・' + r['B氏名'] + '（' + (joint ? r['A所属'] + '／' + r['B所属'] : r['A所属']) + '）';
  return {
    pairId: r.pairId, div: r['区分'],
    aName: r['A氏名'], aGrade: r['A学年'], aTeam: r['A所属'],
    bName: r['B氏名'], bGrade: r['B学年'], bTeam: r['B所属'],
    payer: r['支払チーム'], joint: joint, label: label, change: parseJson_(r['変更記録'], null), preChange: parseJson_(r['申込時変更'], null),
    coachName: r['監督氏名'], coachTitle: r['監督役職']
  };
}

function getConfig_() {
  var sh = ss_().getSheetByName(SHEET_CONFIG);
  if (!sh) throw new Error('シート「設定」がありません。setup() を実行してください。');
  var values = sh.getDataRange().getValues();
  var cfg = {};
  var i, v;
  /* シートにない項目は初期値を使う（項目を追加したときの保険） */
  for (i = 0; i < CONFIG_DEFAULTS.length; i++) cfg[CONFIG_DEFAULTS[i][0]] = CONFIG_DEFAULTS[i][1];
  for (i = 1; i < values.length; i++) {
    v = values[i][1];
    if (v instanceof Date) {
      v = v.getFullYear() < 1901 ? Utilities.formatDate(v, 'Asia/Tokyo', 'H:mm') : Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    }
    if (String(values[i][0]) !== '') cfg[String(values[i][0])] = v;
  }
  return cfg;
}

function periodInfo_(cfg) {
  var start = parseJst_(cfg['申込開始']);
  var end = parseJst_(cfg['申込締切']);
  var now = new Date();
  var state = 'open';
  if (start && now < start) state = 'before';
  if (end && now > end) state = 'after';
  return { state: state, start: cfg['申込開始'], end: cfg['申込締切'] };
}

function parseJst_(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  try {
    return Utilities.parseDate(String(s).trim().slice(0, 16), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  } catch (err) {
    return null;
  }
}

/* 「2026-11-19 17:00」→「令和8年11月19日（木）17:00」 */
function warekiDateTime_(s) {
  var d = parseJst_(s);
  if (!d) return String(s || '');
  var y = toInt_(Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy'));
  var md = Utilities.formatDate(d, 'Asia/Tokyo', 'M月d日');
  var hm = Utilities.formatDate(d, 'Asia/Tokyo', 'H:mm');
  var w = ['日', '月', '火', '水', '木', '金', '土'][toInt_(Utilities.formatDate(d, 'Asia/Tokyo', 'u')) % 7];
  return '令和' + (y - 2018) + '年' + md + '（' + w + '）' + hm;
}

/* 中体連の地区順 */
var DISTRICT_ORDER = ['久慈', '二戸', '岩手', '盛岡', '紫波', '花巻', '和賀', '胆江', '一関', '気仙', '遠野', '釜石・大槌', '宮古'];
/* 地区名の表示：団体登録の「01_久慈」のような並び順の番号（数字＋アンダーバー等）を外す */
function districtName_(d) {
  return String(d || '').replace(/^\s*[0-9０-９]+\s*[_＿\-－.．、:：]\s*/, '').trim();
}
function districtCompare_(a, b) {
  a = districtName_(a);
  b = districtName_(b);
  var ia = DISTRICT_ORDER.indexOf(a), ib = DISTRICT_ORDER.indexOf(b);
  if (ia < 0) ia = 99;
  if (ib < 0) ib = 99;
  return ia - ib;
}

/* 略称の候補：「○○中学校」→「○○中」 */
function suggestAbbr_(name) {
  return String(name || '').replace(/中学校$/, '中').replace(/[\s　]/g, '');
}

function siteUrl_(cfg) {
  var u = String(cfg['サイトURL'] || '');
  return u.charAt(u.length - 1) === '/' ? u : u + '/';
}

function log_(kind, msg) {
  try {
    var sh = ss_().getSheetByName(SHEET_LOG);
    if (sh) sh.appendRow([now_(), kind, msg]);
  } catch (err) { /* ログ失敗は無視 */ }
}

function now_() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }

function newCode_(len) {
  var s = '';
  while (s.length < len) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, len);
}

function parseJson_(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (err) { return fallback; }
}

function toInt_(v) { var n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; }

function normName_(s) { return String(s || '').replace(/[\s　]/g, ''); }

function requireText_(v, label) {
  if (v === undefined || v === null || String(v).trim() === '') throw new Error(label + 'を入力してください。');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* 短時間のキャッシュ：世代番号（書き込みのたびに変わる）をキーに含めるので、書き込み後は古い内容を返さない
   キャッシュに入るのは成功した応答で 95KB 未満のものだけ（CacheService の上限は1件100KB） */
function cachedJson_(key, ttl, fn) {
  var c = null;
  var k = '';
  try {
    c = CacheService.getScriptCache();
    k = key + '|' + (c.get('cacheGen') || '0');
    var hit = c.get(k);
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  } catch (e) { c = null; }
  var s = JSON.stringify(fn());
  if (c && s.length < 95000 && s.indexOf('"status":"ok"') >= 0) {
    try { c.put(k, s, ttl); } catch (e2) {}
  }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function bumpCacheGen_() {
  try { CacheService.getScriptCache().put('cacheGen', new Date().getTime() + '-' + Math.floor(Math.random() * 1000000), 21600); } catch (e) {}
}

/* ============================================================
   一度だけ実行：出場枠の代表者を、区分の性別に合う名簿の登録に合わせ直す
   （同じ名前で男女別に登録しているチームの、男子の枠に女子の代表者が入っていた件の修正）
   - まだ申込していない枠だけを直す。直した枠は「リンク未送信」に戻すので、
     管理画面の「未送信のチームにリンクを送信」で正しい代表者へ送れる
   - GASの画面で関数「fixEntryReps」を選んで実行。結果は実行ログとシート「ログ」に出る
   ============================================================ */
function fixEntryReps() {
  var t = table_(SHEET_ENTRY);
  var fixed = [], applied = [];
  var i, e, mt;
  for (i = 0; i < t.rows.length; i++) {
    e = t.rows[i];
    if (!DIVISIONS[e['区分']]) continue;
    mt = masterTeam_(e['チーム名'], DIVISIONS[e['区分']].gender);
    if (!mt) continue;
    if (String(mt['代表者メール']) === String(e['代表者メール']) && String(mt['代表者名']) === String(e['代表者名'])) continue;
    var label = DIVISIONS[e['区分']].name + '／' + e['チーム名'] + '：' + (e['代表者名'] || '') + '（' + (e['代表者メール'] || '') + '）→ ' + (mt['代表者名'] || '') + '（' + (mt['代表者メール'] || '') + '）';
    if (e['状態'] === '申込済') { applied.push(label); continue; }
    writeRow_(t, e, { '代表者名': mt['代表者名'] || '', '代表者メール': mt['代表者メール'] || '', '地区': districtName_(mt['地区'] || e['地区']), 'リンク送信日時': '', '初回アクセス日時': '' });
    fixed.push(label);
  }
  var msg = '直した枠：' + fixed.length + '件' + (fixed.length ? '\n' + fixed.join('\n') : '') +
    (applied.length ? '\n申込済みのため直していない枠（確認してください）：\n' + applied.join('\n') : '');
  log_('代表者の修正', msg);
  Logger.log(msg);
  return msg;
}
