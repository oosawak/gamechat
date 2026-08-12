/** GameChat membership automation. Bind this script to the response spreadsheet. */
const CONFIG = {
  emailQuestion: 'Googleアカウントのメールアドレス',
  displayNameQuestion: '表示名',
  categoryQuestion: '参加したいカテゴリー',
  termsQuestion: '利用規約への同意',
  statusHeader: 'GameChat処理結果',
  allowedEmailDomain: '',
  groups: {
    community: 'community@example.com',
    'game-dev': 'game-dev@example.com',
    rust: 'rust@example.com',
    wasm: 'wasm@example.com',
    '3dcg': '3dcg@example.com',
  },
};

function installTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'onFormSubmit')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();
  ensureStatusHeader_(spreadsheet.getActiveSheet());
}

function onFormSubmit(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const values = event.namedValues || {};
    const email = firstValue_(values, CONFIG.emailQuestion).toLowerCase();
    const displayName = firstValue_(values, CONFIG.displayNameQuestion);
    const categories = splitCategories_(firstValue_(values, CONFIG.categoryQuestion));
    const terms = firstValue_(values, CONFIG.termsQuestion);
    validateApplication_(email, terms);

    const requestedGroups = new Set(['community']);
    categories.forEach(category => { if (CONFIG.groups[category]) requestedGroups.add(category); });
    const results = [];
    requestedGroups.forEach(category => results.push(addMemberIfMissing_(CONFIG.groups[category], email)));
    writeStatus_(event.range, `承認: ${displayName || email} / ${results.join(', ')}`);
  } catch (error) {
    writeStatus_(event.range, `要確認: ${error.message}`);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function validateApplication_(email, terms) {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('メールアドレスが不正です');
  if (CONFIG.allowedEmailDomain && !email.endsWith(`@${CONFIG.allowedEmailDomain}`)) throw new Error('許可されていないメールドメインです');
  if (!terms.includes('同意')) throw new Error('利用規約への同意が確認できません');
}

function addMemberIfMissing_(groupEmail, email) {
  try {
    const member = AdminDirectory.Members.hasMember(groupEmail, email);
    if (member && member.isMember) return `${groupEmail}:既存`;
    AdminDirectory.Members.insert({ email, role: 'MEMBER' }, groupEmail);
    return `${groupEmail}:追加`;
  } catch (error) {
    if (String(error).includes('Member already exists')) return `${groupEmail}:既存`;
    throw new Error(`${groupEmail} への登録失敗: ${error.message}`);
  }
}

function firstValue_(namedValues, question) { return String((namedValues[question] || [''])[0]).trim(); }
function splitCategories_(value) { return value.split(/[,、]/).map(category => category.trim()).filter(Boolean); }

function ensureStatusHeader_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.includes(CONFIG.statusHeader)) sheet.getRange(1, headers.length + 1).setValue(CONFIG.statusHeader);
}

function writeStatus_(range, status) {
  const sheet = range.getSheet();
  ensureStatusHeader_(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.getRange(range.getRow(), headers.indexOf(CONFIG.statusHeader) + 1).setValue(status);
}
