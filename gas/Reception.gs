/* ============================================================
   第40回岩手県中学校インドアソフトテニス大会 システム
   当日受付・領収書（フェーズ2）
   - Code.gs と同じプロジェクトに「Reception.gs」として追加する
   - 規約：ES5（var / function のみ）
   ============================================================ */

var RECEIPT_GREEN = '#1a4a2e';

/* ============================================================
   受付API（受付パスワード または 管理パスワード）
   ============================================================ */
function receptionRoute_(body) {
  var cfg = getConfig_();
  var pw = String(body.pw || '');
  if (!pw || (pw !== String(cfg['受付パスワード']) && pw !== String(cfg['管理パスワード']))) {
    return { status: 'error', code: 'auth', message: 'パスワードが違います。' };
  }
  switch (body.action) {
    case 'recLogin': return recLogin_(cfg);
    case 'recList': return recList_(body);
    case 'recLookup': return recLookup_(body);
    case 'recConfirm': return recConfirm_(body, cfg);
    case 'recCancel': return recCancel_(body);
    default: return { status: 'error', message: '不明な受付アクション: ' + body.action };
  }
}

function recLogin_(cfg) {
  return {
    status: 'ok', tournament: cfg['大会名'], divisions: DIVISIONS, divOrder: DIV_ORDER,
    dates: { team: cfg['団体戦日程'], indiv: cfg['個人戦日程'] },
    venues: { '男': cfg['男子会場'], '女': cfg['女子会場'] }
  };
}

/* 区分の一覧（手動検索・集計用）。申込済みのみ */
function recList_(body) {
  var t = table_(SHEET_ENTRY);
  var list = [];
  var pend = pendingReqMap_();
  var i, r;
  for (i = 0; i < t.rows.length; i++) {
    r = t.rows[i];
    if (body.div && r['区分'] !== body.div) continue;
    if (r['状態'] !== '申込済') continue;
    list.push(recSummary_(r, pend));
  }
  list.sort(function (a, b) { return districtCompare_(a.district, b.district) || String(a.teamName).localeCompare(String(b.teamName), 'ja'); });
  return { status: 'ok', entries: list };
}

function recSummary_(r, pend) {
  var div = DIVISIONS[r['区分']];
  if (!pend) pend = pendingReqMap_();
  return {
    code: r['受付コード'], div: r['区分'], divName: div.name, teamName: r['チーム名'], abbr: r['略称'] || '',
    district: districtName_(r['地区']), fee: toInt_(r['参加料']), pairCount: toInt_(r['ペア数']),
    reception: r['受付状態'] || '', receptionAt: r['受付日時'] || '', staff: r['受付担当'] || '',
    /* 競技委員長が確認中の変更申請の件数（受付一覧に「📝 変更申請中」と出す） */
    reqPending: pend[r.entryId] || 0
  };
}

/* entryId → 申請中の変更申請の件数 */
function pendingReqMap_() {
  var map = {};
  var sh = ss_().getSheetByName(SHEET_REQ);
  if (!sh) return map;
  var t = table_(SHEET_REQ);
  var i;
  for (i = 0; i < t.rows.length; i++) if ((t.rows[i]['状態'] || '申請中') === '申請中') map[t.rows[i].entryId] = (map[t.rows[i].entryId] || 0) + 1;
  return map;
}

/* 受付コード（二次元コードの中身）で1件取得 */
function recLookup_(body) {
  var entry = findEntryByCode_(body.code);
  if (!entry) return { status: 'error', code: 'notfound', message: 'この受付票は見つかりません。申込済みか確認してください。' };
  if (entry['状態'] !== '申込済') return { status: 'error', code: 'notapplied', message: '「' + entry['チーム名'] + '」はまだ申込が完了していません。' };
  var res = recSummary_(entry);
  res.status = 'ok';
  res.applicantName = entry['申込者氏名'];
  res.applicantPhone = entry['申込者電話'];
  res.payers = receiptAddressees_(entry);
  /* 変更申請（申請中・許可・却下）。受付で「変更どうなった？」と聞かれたときに答えられるように */
  res.requests = myRequests_(entry);
  if (DIVISIONS[entry['区分']].type === 'team') {
    var players = parseJson_(entry['選手JSON'], []);
    var names = [];
    var i;
    for (i = 0; i < players.length; i++) if (!players[i].vacant) names.push(players[i].no + '.' + players[i].name);
    res.coach = entry['監督氏名'];
    res.members = names;
  } else {
    var pairs = pairsForEntry_(entry);
    var k;
    res.members = [];
    for (k = 0; k < pairs.length; k++) res.members.push(pairs[k].label);
  }
  return res;
}

/* 受付確定：現金受領 → 受付済み → 領収書PDF付きメール */
function recConfirm_(body, cfg) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('混み合っています。もう一度押してください。');
  var entry;
  try {
    var t = table_(SHEET_ENTRY);
    var code = normCode_(body.code);
    var i;
    entry = null;
    for (i = 0; i < t.rows.length; i++) if (String(t.rows[i]['受付コード']) === code && code) entry = t.rows[i];
    if (!entry) throw new Error('この受付票は見つかりません。');
    if (entry['状態'] !== '申込済') throw new Error('まだ申込が完了していません。');
    if (entry['受付状態'] === '受付済') {
      return { status: 'error', code: 'already', message: 'すでに受付済みです（' + entry['受付日時'] + '　担当：' + (entry['受付担当'] || '—') + '）', entry: recSummary_(entry) };
    }
    writeRow_(t, entry, { '受付状態': '受付済', '受付日時': now_(), '受付担当': String(body.staff || '').slice(0, 20) });
  } finally {
    lock.releaseLock();
  }
  log_('受付', DIVISIONS[entry['区分']].name + '／' + entry['チーム名'] + '／' + toInt_(entry['参加料']) + '円／' + (body.staff || ''));
  var mailError = '';
  try {
    sendReceptionMail_(entry, cfg);
  } catch (err) {
    mailError = err.message;
    log_('mail-error', '受付完了メール ' + entry['チーム名'] + ': ' + err.message);
  }
  var res = recSummary_(entry);
  return { status: 'ok', entry: res, mailError: mailError };
}

function recCancel_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var t = table_(SHEET_ENTRY);
    var code = normCode_(body.code);
    var i;
    for (i = 0; i < t.rows.length; i++) {
      if (code && String(t.rows[i]['受付コード']) === code) {
        writeRow_(t, t.rows[i], { '受付状態': '', '受付日時': '', '受付担当': '' });
        log_('受付取消', t.rows[i]['チーム名'] + '／' + (body.staff || ''));
        return { status: 'ok', entry: recSummary_(t.rows[i]) };
      }
    }
    throw new Error('この受付票は見つかりません。');
  } finally {
    lock.releaseLock();
  }
}

function normCode_(code) {
  return String(code || '').replace(/^IWIN:/i, '').replace(/\s/g, '');
}

function findEntryByCode_(code) {
  var c = normCode_(code);
  if (!c) return null;
  var t = table_(SHEET_ENTRY);
  var i;
  for (i = 0; i < t.rows.length; i++) if (String(t.rows[i]['受付コード']) === c) return t.rows[i];
  return null;
}

/* ============================================================
   受付完了メール（申込責任者のみ・領収書PDF添付）
   ============================================================ */
function sendReceptionMail_(entry, cfg) {
  var t = table_(SHEET_ENTRY);
  var row = null;
  var i;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === entry.entryId) row = t.rows[i];
  if (!row) throw new Error('申込データが見つかりません。');
  var div = DIVISIONS[row['区分']];
  var receipt = getReceiptBlob_(row, cfg);
  var lines = [];
  lines.push(row['チーム名'] + '　' + row['申込者氏名'] + ' 様');
  lines.push('');
  lines.push(cfg['大会名'] + '　' + div.name + 'の受付を完了しました。');
  lines.push('参加料を受領しましたので、領収書（PDF）を添付します。');
  lines.push('');
  lines.push('■ 受付内容');
  lines.push('　チーム名：' + row['チーム名']);
  lines.push('　参加料：' + toInt_(row['参加料']).toLocaleString() + '円' + (div.type === 'indiv' ? '（' + toInt_(row['ペア数']) + 'ペア）' : ''));
  lines.push('　受付日時：' + warekiDateTime_(row['受付日時']));
  lines.push('　領収書番号：' + (row['領収書番号'] || ''));
  lines.push('');
  lines.push('※ 紙の領収書が必要な場合は、大会本部へお申し出ください。');
  lines.push('');
  lines.push('--');
  lines.push(cfg['署名']);
  MailApp.sendEmail({
    to: row['申込者メール'],
    subject: '【' + cfg['大会名'] + '】' + div.name + ' 受付完了・領収書（' + row['チーム名'] + '）',
    body: lines.join('\n'),
    name: '岩手県中学生ソフトテニス連盟',
    attachments: [receipt]
  });
  writeRow_(t, row, { '受付メール送信日時': now_() });
}

/* ============================================================
   領収書
   ============================================================ */

/* 宛名：チーム名。個人戦で合同ペアがあれば相手チームも併記 */
function receiptAddressees_(entry) {
  var names = [entry['チーム名']];
  if (DIVISIONS[entry['区分']].type === 'indiv') {
    var pairs = pairsForEntry_(entry);
    var i;
    for (i = 0; i < pairs.length; i++) {
      if (names.indexOf(pairs[i].aTeam) < 0) names.push(pairs[i].aTeam);
      if (names.indexOf(pairs[i].bTeam) < 0) names.push(pairs[i].bTeam);
    }
  }
  return names;
}

/* 領収書番号：区分ごとの連番（一度付けたら変えない） */
function ensureReceiptNo_(t, row) {
  if (row['領収書番号']) return row['領収書番号'];
  var max = 0;
  var i, m;
  for (i = 0; i < t.rows.length; i++) {
    m = String(t.rows[i]['領収書番号'] || '').match(new RegExp('^' + row['区分'] + '-(\\d+)$'));
    if (m && toInt_(m[1]) > max) max = toInt_(m[1]);
  }
  var no = row['区分'] + '-' + ('00' + (max + 1)).slice(-3);
  writeRow_(t, row, { '領収書番号': no });
  return no;
}

/* 保存済みの領収書PDFを使う。なければ（または申込修正後なら）作り直して保存 */
function getReceiptBlob_(row, cfg) {
  var fresh = row['領収書ファイルID'] && String(row['領収書作成日時']) >= String(row['更新日時'] || row['申込日時']);
  if (fresh) {
    try {
      return DriveApp.getFileById(row['領収書ファイルID']).getBlob();
    } catch (err) {
      log_('error', '領収書ファイルが開けないため再作成: ' + row['チーム名']);
    }
  }
  return saveReceipt_(row, cfg);
}

function saveReceipt_(row, cfg) {
  var t = table_(SHEET_ENTRY);
  var target = null;
  var i;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === row.entryId) target = t.rows[i];
  if (!target) throw new Error('申込データが見つかりません。');
  ensureReceiptNo_(t, target);
  var blob = buildReceiptPdf_([target], cfg, receiptFileName_(target, cfg));
  var folder = receiptFolder_();
  if (target['領収書ファイルID']) {
    try { DriveApp.getFileById(target['領収書ファイルID']).setTrashed(true); } catch (e) { /* 古いファイルが無い場合は無視 */ }
  }
  var file = folder.createFile(blob);
  writeRow_(t, target, { '領収書ファイルID': file.getId(), '領収書作成日時': now_() });
  return file.getBlob();
}

function receiptFileName_(row, cfg) {
  return '領収書_' + row['領収書番号'] + '_' + DIVISIONS[row['区分']].name + '_' + row['チーム名'] + '.pdf';
}

function receiptFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('RECEIPT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 消されていたら作り直す */ }
  }
  var folder = DriveApp.createFolder('県インドア大会_領収書');
  props.setProperty('RECEIPT_FOLDER_ID', folder.getId());
  return folder;
}

function sealBlob_(cfg) {
  var id = String(cfg['角印画像ファイルID'] || '').trim();
  if (!id) return null;
  var m = id.match(/[-\w]{25,}/);
  try {
    return DriveApp.getFileById(m ? m[0] : id).getBlob();
  } catch (err) {
    log_('error', '角印画像を読み込めません: ' + err.message);
    return null;
  }
}

/* 領収書PDF（A5横・1件1ページ）。rows を複数渡すと印刷用にまとめる */
function buildReceiptPdf_(rows, cfg, fileName) {
  var doc = DocumentApp.create('領収書_tmp');
  var fileId = doc.getId();
  try {
    var body = doc.getBody();
    body.setPageWidth(595.28).setPageHeight(419.53);
    body.setMarginTop(30).setMarginBottom(24).setMarginLeft(44).setMarginRight(44);
    var seal = sealBlob_(cfg);
    var i;
    for (i = 0; i < rows.length; i++) {
      if (i > 0) body.appendPageBreak();
      appendReceipt_(body, rows[i], cfg, seal, i === 0);
    }
    doc.saveAndClose();
    return DriveApp.getFileById(fileId).getAs(MimeType.PDF).setName(fileName);
  } finally {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* 削除失敗は無視 */ }
  }
}

function appendReceipt_(body, row, cfg, seal, isFirst) {
  var div = DIVISIONS[row['区分']];
  var C = DocumentApp.HorizontalAlignment;
  var dateText = String(div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']).replace(/（.*?）/g, '');
  var fee = toInt_(row['参加料']);

  var top = isFirst ? body.getParagraphs()[0] : body.appendParagraph('');
  top.setText('No. ' + (row['領収書番号'] || '') + '　　発行日　' + dateText);
  pdfPara_(top, 9, false, C.RIGHT, 0, 2);

  pdfPara_(body.appendParagraph('領　収　書'), 26, true, C.CENTER, 4, 16);

  var names = receiptAddressees_(row);
  var addr = body.appendParagraph(names.join(' 様、') + ' 様');
  pdfPara_(addr, names.length > 1 ? 13 : 16, true, C.LEFT, 0, 14);
  addr.editAsText().setUnderline(true);

  var amount = body.appendTable([['金額', '￥' + fee.toLocaleString() + '－']]);
  amount.setBorderColor('#333333').setBorderWidth(1);
  amount.setColumnWidth(0, 70);
  pdfCell_(amount.getRow(0).getCell(0), 12, true, '#e8f1eb', '#000000');
  pdfCell_(amount.getRow(0).getCell(1), 22, true, '#ffffff', '#000000');
  amount.getRow(0).getCell(0).getChild(0).asParagraph().setAlignment(C.CENTER);
  amount.getRow(0).getCell(1).getChild(0).asParagraph().setAlignment(C.CENTER);
  amount.getRow(0).getCell(0).setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
  amount.getRow(0).getCell(1).setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER).setPaddingTop(8).setPaddingBottom(8);

  var tadashi = '但し　' + cfg['大会名'] + '　' + div.name + '　参加料' +
    (div.type === 'indiv' ? '（' + toInt_(row['ペア数']) + 'ペア分）' : '') + 'として';
  pdfPara_(pdfNextPara_(body, tadashi), 11, false, C.LEFT, 14, 4);
  pdfPara_(body.appendParagraph('上記正に領収いたしました。'), 11, false, C.LEFT, 0, 28);

  /* 発行者（右寄せ）＋角印 */
  var issuer = body.appendTable([[String(cfg['領収書発行者']) + '\n' + String(cfg['領収書代表者']), '']]);
  issuer.setBorderWidth(0);
  issuer.setColumnWidth(0, 420);
  issuer.setColumnWidth(1, 70);
  var c0 = issuer.getRow(0).getCell(0);
  pdfCell_(c0, 12, false, '#ffffff', '#000000');
  var n = c0.getNumChildren();
  var k;
  for (k = 0; k < n; k++) c0.getChild(k).asParagraph().setAlignment(C.RIGHT);
  var c1 = issuer.getRow(0).getCell(1);
  pdfCell_(c1, 10, false, '#ffffff', '#000000');
  if (seal) {
    var img = c1.getChild(0).asParagraph().appendInlineImage(seal);
    var w = img.getWidth();
    var h = img.getHeight();
    var size = 58;
    if (w && h) img.setWidth(size).setHeight(Math.round(size * h / w));
  }

  var foot = pdfNextPara_(body, '受付コード：' + (row['受付コード'] || ''));
  pdfPara_(foot, 7.5, false, C.RIGHT, 18, 0);
  foot.editAsText().setForegroundColor('#666666');
}

/* ============================================================
   管理画面から
   ============================================================ */
function findEntryRow_(entryId) {
  var t = table_(SHEET_ENTRY);
  var i;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === entryId) return t.rows[i];
  return null;
}

/* 1件の領収書PDF（ダウンロード用） */
function adminReceiptPdf_(body, cfg) {
  var row = findEntryRow_(body.entryId);
  if (!row) throw new Error('申込データが見つかりません。');
  if (row['状態'] !== '申込済') throw new Error('まだ申込されていません。');
  var blob = getReceiptBlob_(row, cfg);
  var latest = findEntryRow_(body.entryId);
  return { status: 'ok', name: receiptFileName_(latest, cfg), base64: Utilities.base64Encode(blob.getBytes()) };
}

/* 領収書の事前一括作成。時間切れ前に区切り、残り件数を返す（画面側で繰り返し呼ぶ） */
function adminReceiptBatch_(body, cfg) {
  var started = new Date().getTime();
  var t = table_(SHEET_ENTRY);
  var targets = [];
  var i, r;
  for (i = 0; i < t.rows.length; i++) {
    r = t.rows[i];
    if (r['状態'] !== '申込済') continue;
    if (body.div && r['区分'] !== body.div) continue;
    if (r['領収書ファイルID'] && String(r['領収書作成日時']) >= String(r['更新日時'] || r['申込日時'])) continue;
    targets.push(r);
  }
  var done = 0;
  for (i = 0; i < targets.length; i++) {
    if (new Date().getTime() - started > 240000) break;
    saveReceipt_(targets[i], cfg);
    done++;
  }
  log_('領収書作成', done + '件');
  return { status: 'ok', done: done, remaining: targets.length - done };
}

/* 区分別の印刷用PDF（A5横・1件1ページ） */
function adminReceiptPrint_(body, cfg) {
  var div = DIVISIONS[body.div];
  if (!div) throw new Error('区分を指定してください。');
  var t = table_(SHEET_ENTRY);
  var rows = [];
  var i;
  for (i = 0; i < t.rows.length; i++) {
    if (t.rows[i]['区分'] === body.div && t.rows[i]['状態'] === '申込済') rows.push(t.rows[i]);
  }
  if (rows.length === 0) throw new Error(div.name + 'の申込はまだありません。');
  rows.sort(function (a, b) { return districtCompare_(a['地区'], b['地区']) || String(a['チーム名']).localeCompare(String(b['チーム名']), 'ja'); });
  for (i = 0; i < rows.length; i++) ensureReceiptNo_(t, rows[i]);
  var name = cfg['大会名'] + '_' + div.name + '_領収書（印刷用）.pdf';
  var blob = buildReceiptPdf_(rows, cfg, name);
  return { status: 'ok', name: name, base64: Utilities.base64Encode(blob.getBytes()), count: rows.length };
}

/* 受付完了メールの再送（メール失敗時など） */
function adminResendReceipt_(body, cfg) {
  var row = findEntryRow_(body.entryId);
  if (!row) throw new Error('申込データが見つかりません。');
  if (row['受付状態'] !== '受付済') throw new Error('まだ受付が済んでいません。');
  sendReceptionMail_(row, cfg);
  return { status: 'ok' };
}

/* ============================================================
   選手変更（本部・管理画面から）
   要項11(3)：個人戦は1名のみ、団体戦はやむを得ない場合。届出は紙で本部へ
   ============================================================ */
function changeLog_() {
  var sh = ss_().getSheetByName(SHEET_CHANGE);
  if (!sh) return [];
  var t = table_(SHEET_CHANGE);
  var out = [];
  var i, r;
  for (i = t.rows.length - 1; i >= 0; i--) {
    r = t.rows[i];
    out.push({ at: r['日時'], div: r['区分'], team: r['チーム'], target: r['対象'], from: r['変更前'], to: r['変更後'], offRoster: r['名簿外'] === '○', reason: r['理由'] });
  }
  return out;
}

function addChangeLog_(divCode, team, target, from, to, offRoster, reason, publicReason) {
  var sh = ss_().getSheetByName(SHEET_CHANGE);
  if (!sh) throw new Error('シート「選手変更」がありません。setup() を実行してください。');
  if (publicReason) ensureHeaders_(sh, HEADERS[SHEET_CHANGE]);
  appendObj_(table_(SHEET_CHANGE), {
    '日時': now_(), '区分': DIVISIONS[divCode].name, 'チーム': team, '対象': target,
    '変更前': from, '変更後': to, '名簿外': offRoster ? '○' : '', '理由': String(reason || '').slice(0, 100),
    '理由公開': publicReason ? '○' : ''
  });
  log_('選手変更', DIVISIONS[divCode].name + '／' + team + '／' + target + '：' + from + ' → ' + to);
}

/* 団体戦：番号（1〜8）の選手を差し替える、または欠員にする */
function adminChangeTeamPlayer_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var t = table_(SHEET_ENTRY);
    var entry = null;
    var i;
    for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === body.entryId) entry = t.rows[i];
    if (!entry) throw new Error('申込データが見つかりません。');
    var div = DIVISIONS[entry['区分']];
    if (div.type !== 'team') throw new Error('団体戦の申込ではありません。');
    if (entry['状態'] !== '申込済') throw new Error('まだ申込されていません。');
    var slot = toInt_(body.slot);
    if (slot < 1 || slot > 8) throw new Error('番号（1〜8）を選んでください。');
    var players = parseJson_(entry['選手JSON'], []);
    var cur = players[slot - 1] || { no: slot, vacant: true };
    var fromName = cur.vacant ? '（欠員）' : cur.name;
    var rec;
    if (body.mode === 'vacant') {
      if (cur.vacant) throw new Error('No.' + slot + 'はすでに欠員です。');
      rec = { no: slot, vacant: true, changedFrom: fromName };
    } else {
      requireText_(body.name, '交代する選手の氏名');
      requireText_(body.grade, '交代する選手の学年');
      var key = normName_(body.name);
      for (i = 0; i < players.length; i++) {
        if (i !== slot - 1 && players[i] && !players[i].vacant && normName_(players[i].name) === key) {
          throw new Error('「' + body.name + '」はすでにNo.' + (i + 1) + 'に登録されています。');
        }
      }
      var roster = rosterFor_(entry['チーム名'], div.gender);
      var onRoster = false;
      for (i = 0; i < roster.length; i++) if (normName_(roster[i].name) === key) onRoster = true;
      rec = { no: slot, name: String(body.name).trim(), grade: body.grade, offRoster: !onRoster, changedFrom: fromName };
    }
    /* 何度変更しても「元の選手」を残す。元の選手に戻したら変更なしに戻す */
    if (cur.changedFrom) rec.changedFrom = cur.changedFrom;
    if (!rec.vacant && rec.changedFrom && normName_(rec.changedFrom) === normName_(rec.name)) delete rec.changedFrom;
    if (rec.vacant && rec.changedFrom === '（欠員）') delete rec.changedFrom;
    if (body.dryRun) return { status: 'ok', team: entry['チーム名'], target: 'No.' + slot, from: fromName, to: rec.vacant ? '（欠員）' : rec.name + '（' + rec.grade + '）', offRoster: !!rec.offRoster };
    players[slot - 1] = rec;
    var count = 0;
    for (i = 0; i < players.length; i++) if (players[i] && !players[i].vacant) count++;
    var update = { '選手JSON': JSON.stringify(players) };
    if (rec.offRoster) {
      update['要確認'] = (entry['要確認'] ? entry['要確認'] + ' / ' : '') + 'No.' + slot + ' ' + rec.name + ' は登録名簿にない（選手変更）';
    }
    writeRow_(t, entry, update);
    addChangeLog_(entry['区分'], entry['チーム名'], 'No.' + slot, fromName, rec.vacant ? '（欠員）' : rec.name + '（' + rec.grade + '）', !!rec.offRoster, body.reason);
    var orderNote = cur.vacant ? [] : fixOrdersAfterChange_(entry, cur.name, rec.vacant ? '' : rec.name);
    return { status: 'ok', count: count, orderNote: orderNote };
  } finally {
    lock.releaseLock();
  }
}

/* 個人戦：ペアの1名を同じチームの選手と交代（1ペアにつき1名まで） */
function adminChangePairPlayer_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return changePairPlayerCore_(body);
  } finally {
    lock.releaseLock();
  }
}

/* 個人戦：ペアの1名を交代（ロックは呼び出し側。1ペアにつき1名まで） */
function changePairPlayerCore_(body) {
  {
    var pt = table_(SHEET_PAIR);
    var pr = null;
    var i;
    for (i = 0; i < pt.rows.length; i++) if (pt.rows[i].pairId === body.pairId) pr = pt.rows[i];
    if (!pr) throw new Error('ペアが見つかりません。');
    var side = body.side === 'B' ? 'B' : 'A';
    var other = side === 'A' ? 'B' : 'A';
    var log = parseJson_(pr['変更記録'], null);
    if (log && log.side !== side) {
      throw new Error('このペアはすでに選手' + log.side + '（' + log.from + '）を変更済みです。個人戦の選手変更は1名のみです。');
    }
    requireText_(body.name, '交代する選手の氏名');
    requireText_(body.grade, '交代する選手の学年');
    var team = pr[side + '所属'];
    var fromName = pr[side + '氏名'];
    var key = normName_(body.name);
    if (normName_(pr[other + '氏名']) === key) throw new Error('ペアの相手と同じ選手です。');
    for (i = 0; i < pt.rows.length; i++) {
      var q = pt.rows[i];
      if (q.pairId === pr.pairId || q['区分'] !== pr['区分']) continue;
      if ((normName_(q['A氏名']) === key && q['A所属'] === team) || (normName_(q['B氏名']) === key && q['B所属'] === team)) {
        throw new Error('「' + body.name + '」は別のペアで出場しています。');
      }
    }
    var roster = rosterFor_(team, DIVISIONS[pr['区分']].gender);
    var onRoster = false;
    for (i = 0; i < roster.length; i++) if (normName_(roster[i].name) === key) onRoster = true;
    var origin = log ? log.from : fromName;
    var pairLabel = pr['A氏名'] + '・' + pr['B氏名'];
    if (body.dryRun) return { status: 'ok', team: team, target: 'ペア（' + pairLabel + '）の選手' + side, from: fromName, to: String(body.name).trim() + '（' + body.grade + '）', offRoster: !onRoster };
    var update = {};
    update[side + '氏名'] = String(body.name).trim();
    update[side + '学年'] = body.grade;
    /* 元の選手に戻した場合は「変更なし」に戻す */
    update['変更記録'] = normName_(origin) === key ? '' : JSON.stringify({ side: side, from: origin, at: now_() });
    writeRow_(pt, pr, update);
    addChangeLog_(pr['区分'], team, 'ペア（' + pairLabel + '）の選手' + side,
      fromName, String(body.name).trim() + '（' + body.grade + '）', !onRoster, body.reason, body.publicReason);
    return { status: 'ok' };
  }
}

/* 団体戦の選手変更のあと、終わっていない試合のオーダーを直す
   交代：元の選手の名前を新しい選手に置き換える／欠員：置き換えず、本部が訂正する試合を返す */
function fixOrdersAfterChange_(entry, oldName, newName) {
  var notes = [];
  var ms = loadMatches_(entry['区分']);
  var byId = {};
  var i, j, k, m, side, o, hit, changed, upd;
  for (i = 0; i < ms.length; i++) byId[ms[i].id] = ms[i];
  var key = normName_(oldName);
  for (i = 0; i < ms.length; i++) {
    m = ms[i];
    if (m.state === '終了') continue;
    var sides = [['L', m.left, m.orderL, 'オーダー左'], ['R', m.right, m.orderR, 'オーダー右']];
    for (j = 0; j < 2; j++) {
      side = sides[j];
      o = side[2];
      if (!o || !o.p || resolveRef_(side[1], byId, {}, 0) !== entry.entryId) continue;
      changed = false;
      for (k = 0; k < o.p.length; k++) {
        if (!o.p[k]) continue;
        if (normName_(o.p[k][0]) === key) { if (newName) { o.p[k][0] = newName; changed = true; } else notes.push('第' + m.no + '試合'); }
        if (normName_(o.p[k][1]) === key) { if (newName) { o.p[k][1] = newName; changed = true; } else notes.push('第' + m.no + '試合'); }
      }
      if (changed) {
        hit = matchRow_(m.id);
        upd = { '更新日時': now_() };
        upd[side[3]] = JSON.stringify(o);
        writeRow_(hit.t, hit.row, upd);
        notes.push('第' + m.no + '試合のオーダーを「' + oldName + '」→「' + newName + '」に置き換え');
      }
    }
  }
  if (!newName && notes.length) notes = ['欠員にした「' + oldName + '」が' + notes.join('・') + 'のオーダーに入っています。本部の「オーダー」から訂正してください。'];
  return notes;
}

/* 監督（ベンチ入り指導者）の変更：団体戦は entryId、個人戦は pairId */
function adminChangeCoach_(body) {
  requireText_(body.name, '新しい監督の氏名');
  requireText_(body.title, '新しい監督の役職');
  var name = String(body.name).trim();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var i;
    if (body.pairId) {
      var pt = table_(SHEET_PAIR);
      var pr = null;
      for (i = 0; i < pt.rows.length; i++) if (pt.rows[i].pairId === body.pairId) pr = pt.rows[i];
      if (!pr) throw new Error('ペアが見つかりません。');
      var fromP = (pr['監督氏名'] || '（未登録）') + (pr['監督役職'] ? '（' + pr['監督役職'] + '）' : '');
      var target = 'ペア（' + pr['A氏名'] + '・' + pr['B氏名'] + '）の監督';
      if (normName_(pr['監督氏名']) === normName_(name) && pr['監督役職'] === body.title) throw new Error('今の監督と同じです。');
      if (body.dryRun) return { status: 'ok', team: pr['支払チーム'], target: target, from: fromP, to: name + '（' + body.title + '）' };
      writeRow_(pt, pr, { '監督氏名': name, '監督役職': body.title });
      addChangeLog_(pr['区分'], pr['支払チーム'], target, fromP, name + '（' + body.title + '）', false, body.reason);
      return { status: 'ok' };
    }
    var t = table_(SHEET_ENTRY);
    var entry = null;
    for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === body.entryId) entry = t.rows[i];
    if (!entry) throw new Error('申込データが見つかりません。');
    if (DIVISIONS[entry['区分']].type !== 'team') throw new Error('個人戦はペアを指定してください。');
    var from = (entry['監督氏名'] || '（未登録）') + (entry['監督役職'] ? '（' + entry['監督役職'] + '）' : '');
    if (normName_(entry['監督氏名']) === normName_(name) && entry['監督役職'] === body.title) throw new Error('今の監督と同じです。');
    if (body.dryRun) return { status: 'ok', team: entry['チーム名'], target: '監督', from: from, to: name + '（' + body.title + '）' };
    writeRow_(t, entry, { '監督氏名': name, '監督役職': body.title });
    addChangeLog_(entry['区分'], entry['チーム名'], '監督', from, name + '（' + body.title + '）', false, body.reason);
    return { status: 'ok' };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   変更申請（監督がスマホから申請 → 競技委員長が許可・却下 → 許可で自動反映）
   ============================================================ */
var REQ_KINDS = { player: '選手変更', vacant: '欠員報告', coach: '監督変更' };

function reqTable_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET_REQ);
  if (!sh) {
    sh = ss.insertSheet(SHEET_REQ);
    sh.getRange(1, 1, 1, HEADERS[SHEET_REQ].length).setValues([HEADERS[SHEET_REQ]]).setFontWeight('bold');
  }
  return table_(SHEET_REQ);
}

function reqObj_(r) {
  var c = parseJson_(r['内容'], {});
  return {
    id: r['申請ID'], at: r['日時'], div: r['区分'], divName: DIVISIONS[r['区分']] ? DIVISIONS[r['区分']].name : r['区分'],
    entryId: r.entryId, team: r['チーム'], kind: r['種別'], target: r['対象'], from: c.from || '', to: c.to || '',
    offRoster: !!c.offRoster, reason: r['理由'], state: r['状態'] || '申請中', decidedAt: r['処理日時'] || '', comment: r['コメント'] || '', by: r['申請者'] || ''
  };
}

/* 申請を、既存の変更関数の引数に組み立てる */
function reqApplyBody_(entry, p) {
  var b = { kind: p.kind, reason: p.reason };
  var div = DIVISIONS[entry['区分']];
  if (p.kind === 'coach') {
    if (div.type === 'team') b.entryId = entry.entryId; else b.pairId = p.pairId;
    b.name = p.name; b.title = p.title;
  } else if (div.type === 'team') {
    b.entryId = entry.entryId; b.slot = p.slot; b.mode = p.kind === 'vacant' ? 'vacant' : 'replace'; b.name = p.name; b.grade = p.grade;
  } else {
    if (p.kind !== 'player') throw new Error('個人戦の申請は「選手変更」か「監督変更」です。');
    b.pairId = p.pairId; b.side = p.side; b.name = p.name; b.grade = p.grade;
  }
  return b;
}

function reqRun_(entry, b) {
  var div = DIVISIONS[entry['区分']];
  if (b.kind === 'coach') return adminChangeCoach_(b);
  if (div.type === 'team') return adminChangeTeamPlayer_(b);
  /* 個人戦：自チームが支払うペアに限る */
  var ps = pairsForEntry_(entry);
  var ok = false;
  var i;
  for (i = 0; i < ps.length; i++) if (ps[i].pairId === b.pairId) ok = true;
  if (!ok) throw new Error('このチームのペアではありません。');
  return adminChangePairPlayer_(b);
}

/* 変更申請の締切：その区分の大会当日の受付終了時刻（設定「受付時刻」の終わり。例 7:35〜8:00 → 8:00） */
function changeDeadline_(cfg, div) {
  var day = String(div.type === 'team' ? cfg['団体戦日程'] : cfg['個人戦日程']);
  var y, mo, d;
  var m = day.match(/令和\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
  if (m) { y = 2018 + toInt_(m[1]); mo = toInt_(m[2]); d = toInt_(m[3]); }
  else {
    m = day.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
    if (!m) return null;
    y = toInt_(m[1]); mo = toInt_(m[2]); d = toInt_(m[3]);
  }
  var times = String(cfg['受付時刻'] || '8:00').match(/(\d{1,2}):(\d{2})/g);
  var end = times ? times[times.length - 1] : '8:00';
  var hm = end.split(':');
  var z = function (n) { return (n < 10 ? '0' : '') + n; };
  return parseJst_(y + '-' + z(mo) + '-' + z(d) + ' ' + z(toInt_(hm[0])) + ':' + hm[1]);
}

function changePeriod_(cfg, div) {
  var nowT = new Date().getTime();
  var start = parseJst_(cfg['申込締切']);
  var end = changeDeadline_(cfg, div);
  var endText = end ? Utilities.formatDate(end, 'Asia/Tokyo', 'M月d日 H:mm') : '';
  if (start && nowT < start.getTime()) {
    return { open: false, before: true, deadline: endText, message: '申込締切（' + warekiDateTime_(cfg['申込締切']) + '）までは、申込フォームから直接修正できます。変更申請は締切後に使います。' };
  }
  if (end && nowT > end.getTime()) {
    return { open: false, after: true, deadline: endText, message: '変更申請の受付は、大会当日の受付終了（' + endText + '）で締め切りました。' };
  }
  return { open: true, deadline: endText, message: '' };
}

/* 監督の受付票・ポータル・受付係用：このチームの変更申請（新しい順・要点だけ） */
function myRequests_(entry) {
  var out = [];
  if (!ss_().getSheetByName(SHEET_REQ)) return out;
  var rt = table_(SHEET_REQ);
  var hmOf = function (v) { var m = String(v || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) + ':' + m[2] : ''; };
  var i, r;
  for (i = rt.rows.length - 1; i >= 0; i--) {
    if (rt.rows[i].entryId !== entry.entryId) continue;
    r = reqObj_(rt.rows[i]);
    out.push({ id: r.id, at: hmOf(r.at), kind: r.kind, target: r.target, from: r.from, to: r.to, state: r.state,
      decidedAt: hmOf(r.decidedAt), comment: r.state === '却下' ? r.comment : '' });
  }
  return out;
}

/* 選手変更一覧用：区分ごとの変更の締切（当日の受付終了）と、締め切ったか・きょうの種別か */
function changesPeriods_(cfg) {
  var out = {};
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var code, end;
  for (code in DIVISIONS) {
    if (!DIVISIONS.hasOwnProperty(code)) continue;
    end = changeDeadline_(cfg, DIVISIONS[code]);
    out[code] = end
      ? { deadline: Utilities.formatDate(end, 'Asia/Tokyo', 'H:mm'), day: Utilities.formatDate(end, 'Asia/Tokyo', 'M/d'),
          closed: new Date().getTime() > end.getTime(), today: Utilities.formatDate(end, 'Asia/Tokyo', 'yyyy-MM-dd') === today }
      : { deadline: '', day: '', closed: false, today: false };
  }
  return out;
}

/* 監督用：変更申請ページのデータ */
function changeInfo_(token) {
  var entry = findEntryByToken_(token);
  if (!entry) return { status: 'error', message: 'リンクが無効です。受付票のボタンから開いてください。' };
  var cfg = getConfig_();
  var div = DIVISIONS[entry['区分']];
  var res = {
    status: 'ok', tournament: cfg['大会名'], division: div.name, type: div.type, team: entry['チーム名'], applied: entry['状態'] === '申込済',
    period: changePeriod_(cfg, div), entryUrl: siteUrl_(cfg) + (div.type === 'team' ? 'entry-team.html' : 'entry-individual.html') + '?t=' + entry['トークン'],
    requests: []
  };
  var i;
  if (div.type === 'team') {
    var ps = parseJson_(entry['選手JSON'], []);
    res.coach = { name: entry['監督氏名'] || '', title: entry['監督役職'] || '' };
    res.players = [];
    for (i = 0; i < 8; i++) {
      var p = ps[i] || { no: i + 1, vacant: true };
      res.players.push({ no: i + 1, name: p.vacant ? '' : p.name, grade: p.vacant ? '' : p.grade, vacant: !!p.vacant, changedFrom: p.changedFrom || '' });
    }
    res.roster = rosterFor_(entry['チーム名'], div.gender);
  } else {
    var pairs = pairsForEntry_(entry);
    res.pairs = [];
    res.rosters = {};
    for (i = 0; i < pairs.length; i++) {
      var q = pairs[i];
      res.pairs.push({ pairId: q.pairId, label: q.label, a: { name: q.aName, grade: q.aGrade, team: q.aTeam }, b: { name: q.bName, grade: q.bGrade, team: q.bTeam },
        coach: { name: q.coachName || '', title: q.coachTitle || '' }, change: q.change });
      if (!res.rosters[q.aTeam]) res.rosters[q.aTeam] = rosterFor_(q.aTeam, div.gender);
      if (!res.rosters[q.bTeam]) res.rosters[q.bTeam] = rosterFor_(q.bTeam, div.gender);
    }
  }
  var rt = reqTable_();
  for (i = rt.rows.length - 1; i >= 0; i--) if (rt.rows[i].entryId === entry.entryId) res.requests.push(reqObj_(rt.rows[i]));
  return res;
}

/* 監督用：変更を申請する（内容はここで検証し、反映は許可のとき） */
function apiChangeRequest_(body) {
  var entry = findEntryByToken_(body.t);
  if (!entry) throw new Error('リンクが無効です。');
  if (entry['状態'] !== '申込済') throw new Error('申込が済んでいないため、変更申請はできません。');
  var cfg = getConfig_();
  var period = changePeriod_(cfg, DIVISIONS[entry['区分']]);
  if (!period.open) throw new Error(period.message);
  if (!REQ_KINDS[body.kind]) throw new Error('申請の種類を選んでください。');
  requireText_(body.reason, '変更の理由');
  var b = reqApplyBody_(entry, body);
  b.dryRun = true;
  var check = reqRun_(entry, b);
  var rt = reqTable_();
  var i;
  for (i = 0; i < rt.rows.length; i++) {
    if (rt.rows[i].entryId === entry.entryId && rt.rows[i]['状態'] === '申請中' && rt.rows[i]['対象'] === check.target) {
      throw new Error('「' + check.target + '」の申請が確認待ちです。結果が出るまでお待ちください。');
    }
  }
  var params = { kind: body.kind, slot: body.slot || '', pairId: body.pairId || '', side: body.side || '', name: body.name || '', grade: body.grade || '', title: body.title || '',
    from: check.from, to: check.to, offRoster: !!check.offRoster };
  var id = 'R' + newCode_(6);
  appendObj_(rt, {
    '申請ID': id, '日時': now_(), '区分': entry['区分'], entryId: entry.entryId, 'チーム': entry['チーム名'], '種別': REQ_KINDS[body.kind],
    '対象': check.target, '内容': JSON.stringify(params), '理由': String(body.reason).slice(0, 200), '状態': '申請中', '申請者': String(body.by || '').slice(0, 40)
  });
  log_('変更申請', DIVISIONS[entry['区分']].name + '／' + entry['チーム名'] + '／' + check.target + '：' + check.from + ' → ' + check.to);
  var to = String(cfg['変更申請の通知先'] || '').trim();
  if (to) {
    try {
      MailApp.sendEmail({ to: to, subject: '【変更申請】' + DIVISIONS[entry['区分']].name + '　' + entry['チーム名'],
        body: DIVISIONS[entry['区分']].name + '　' + entry['チーム名'] + '\n' + REQ_KINDS[body.kind] + '：' + check.target + '\n' + check.from + ' → ' + check.to +
          (check.offRoster ? '（登録名簿にない選手）' : '') + '\n理由：' + body.reason + '\n\n管理画面「選手変更」で許可・却下してください。\n' + siteUrl_(cfg) + 'admin.html',
        name: '県インドア大会システム' });
    } catch (e) { log_('mail-error', '変更申請の通知: ' + e.message); }
  }
  return { status: 'ok', id: id };
}

/* 競技委員長：許可・却下 */
function adminChangeDecide_(body) {
  var rt = reqTable_();
  var row = null;
  var i;
  for (i = 0; i < rt.rows.length; i++) if (rt.rows[i]['申請ID'] === body.id) row = rt.rows[i];
  if (!row) throw new Error('申請が見つかりません。');
  if (row['状態'] !== '申請中') throw new Error('この申請はすでに「' + row['状態'] + '」です。');
  var t = table_(SHEET_ENTRY);
  var entry = null;
  for (i = 0; i < t.rows.length; i++) if (t.rows[i].entryId === row.entryId) entry = t.rows[i];
  if (!entry) throw new Error('申込データが見つかりません。');
  var approve = body.decision === 'approve';
  var comment = String(body.comment || '').slice(0, 200);
  if (!approve && !comment) throw new Error('却下の理由（監督に伝える内容）を入力してください。');
  var result = { status: 'ok' };
  if (approve) {
    var p = parseJson_(row['内容'], {});
    p.reason = '申請：' + row['理由'];
    result = reqRun_(entry, reqApplyBody_(entry, p));
  }
  writeRow_(rt, row, { '状態': approve ? '許可' : '却下', '処理日時': now_(), 'コメント': comment });
  log_('変更申請', (approve ? '許可' : '却下') + '：' + row['チーム'] + '／' + row['対象']);
  try { sendChangeResultMail_(entry, reqObj_(row), getConfig_()); } catch (e) { log_('mail-error', '変更申請の結果: ' + e.message); }
  return { status: 'ok', orderNote: result.orderNote || [] };
}

function sendChangeResultMail_(entry, r, cfg) {
  var to = entry['申込者メール'] || entry['代表者メール'];
  if (!to) return;
  var ok = r.state === '許可';
  var lines = [];
  lines.push(entry['チーム名'] + '　ご担当者 様');
  lines.push('');
  lines.push(cfg['大会名'] + '　' + r.divName + 'の変更申請について、競技委員長が' + (ok ? '許可しました。' : '却下しました。'));
  lines.push('');
  lines.push('■ ' + r.kind + '：' + r.target);
  lines.push('　' + r.from + ' → ' + r.to);
  if (r.comment) lines.push('■ 競技委員長から：' + r.comment);
  lines.push('');
  lines.push(ok ? '変更は進行表・組合せ・オーダー画面などに反映されています。' : '内容を確認のうえ、必要であれば大会本部へご相談ください。');
  lines.push('');
  lines.push('--');
  lines.push(cfg['署名']);
  MailApp.sendEmail({ to: to, subject: '【' + cfg['大会名'] + '】変更申請の結果（' + (ok ? '許可' : '却下') + '）', body: lines.join('\n'), name: '岩手県中学生ソフトテニス連盟' });
}

function changeRequests_() {
  var sh = ss_().getSheetByName(SHEET_REQ);
  if (!sh) return [];
  var rt = table_(SHEET_REQ);
  var out = [];
  var i;
  for (i = rt.rows.length - 1; i >= 0; i--) out.push(reqObj_(rt.rows[i]));
  return out;
}

/* 公開用：選手変更一覧（変更前・変更後。理由と名簿外の印は出さない。監督の変更も氏名を出す＝申込フォームの同意の範囲） */
function publicChanges_(divCode) {
  var sh = ss_().getSheetByName(SHEET_CHANGE);
  if (!sh) return [];
  var t = table_(SHEET_CHANGE);
  var name = divCode && DIVISIONS[divCode] ? DIVISIONS[divCode].name : '';
  var out = [];
  var i, r;
  for (i = 0; i < t.rows.length; i++) {
    r = t.rows[i];
    if (name && r['区分'] !== name) continue;
    var isCoach = /監督/.test(String(r['対象']));
    /* 監督は氏名だけ（役職は出さない） */
    var strip = function (v) { return isCoach ? String(v || '').replace(/（[^（）]*）$/, '') : v; };
    out.push({ at: String(r['日時']).slice(5, 16), div: r['区分'], team: r['チーム'], target: r['対象'], from: strip(r['変更前']), to: strip(r['変更後']),
      note: r['理由公開'] === '○' ? String(r['理由'] || '').replace(/^申請：/, '') : '' });
  }
  return out;
}

/* ============================================================
   申込時の選手変更（競技委員会承認）：委員長が対象ペアに設定 → 監督が申込フォームで代わりの選手を選ぶ
   → 申込の送信で選手変更として記録（1ペア1名の枠を使う）。理由は選手変更一覧に載せられる
   ============================================================ */
function adminSetPreChange_(body) {
  var pt = table_(SHEET_PAIR);
  var pr = null;
  var i;
  for (i = 0; i < pt.rows.length; i++) if (pt.rows[i].pairId === body.pairId) pr = pt.rows[i];
  if (!pr) throw new Error('ペアが見つかりません。');
  if (!body.side) {
    writeRow_(pt, pr, { '申込時変更': '' });
    log_('申込時変更', '解除：' + pr['A氏名'] + '・' + pr['B氏名']);
    return { status: 'ok' };
  }
  var side = body.side === 'B' ? 'B' : 'A';
  var log = parseJson_(pr['変更記録'], null);
  if (log && log.side !== side) throw new Error('このペアはすでに選手' + log.side + 'を変更済みです（1ペア1名まで）。');
  requireText_(body.reason, '理由');
  writeRow_(pt, pr, { '申込時変更': JSON.stringify({ side: side, reason: String(body.reason).slice(0, 100), pub: !!body.publicReason }) });
  log_('申込時変更', DIVISIONS[pr['区分']].name + '：' + pr['A氏名'] + '・' + pr['B氏名'] + '／選手' + side + '／' + body.reason);
  return { status: 'ok' };
}
