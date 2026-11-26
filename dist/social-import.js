import {validDate, today} from './engine.js';

export const CATEGORIES = ['生活', '升学', '工作', '迁居', '旅行', '家庭', '创业', '科技', '体育', '环境'];
export const MAX_BYTES = 5_000_000;
export const MAX_RECORDS = 5000;
const str = value => typeof value === 'string' ? value.trim() : '';
const firstText = (...values) => values.map(str).find(Boolean) || '';

export function safeUrl(value) {
  try {
    if (typeof value !== 'string' || value.length > 2048) return '';
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

// Use UTC for timestamps; preserve date-only values. Never guess ambiguous dates.
export function importDate(value) {
  if (typeof value === 'string') {
    value = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return validDate(value) ? value : '';
  }
  let milliseconds;
  if (typeof value === 'number' || /^-?\d{9,13}$/.test(value)) {
    const n = Number(value);
    milliseconds = Math.abs(n) < 1e11 ? n * 1000 : n;
  } else if (typeof value === 'string') {
    const iso = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/i;
    const twitter = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) ([01]\d|2[0-3]):[0-5]\d:[0-5]\d [+-]\d{4} (\d{4})$/;
    const match = value.match(iso);
    const x = value.match(twitter);
    if (match && validDate(match[1])) milliseconds = Date.parse(value);
    else if (x) {
      const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(x[1]) + 1;
      if (!validDate(`${x[4]}-${String(month).padStart(2,'0')}-${x[2]}`)) return '';
      milliseconds = Date.parse(value);
    } else return '';
  }
  if (!Number.isFinite(milliseconds)) return '';
  try { return new Date(milliseconds).toISOString().slice(0,10); } catch { return ''; }
}

export function inferCategory(text) {
  const rules = [
    ['升学', /大学|毕业|入学|留学|上学|\b(university|college|graduat\w*|school)\b/i],
    ['迁居', /搬家|迁居|定居|\b(moved|relocat\w*)\b/i],
    ['创业', /创业|\b(startup|founded)\b/i],
    ['工作', /工作|入职|远程办公|\b(job|work\w*|career|office)\b/i],
    ['旅行', /旅行|旅游|远行|\b(travel\w*|trip|vacation)\b/i],
    ['家庭', /结婚|婚礼|宝宝|\b(wedding|married|baby)\b/i],
    ['体育', /奥运|运动|马拉松|\b(olympic\w*|sport\w*|marathon)\b/i],
    ['科技', /科技|编程|互联网|\b(technology|coding|internet|software)\b/i],
    ['环境', /气候|环保|\b(climate|environment)\b/i],
  ];
  return rules.find(([,pattern]) => pattern.test(text))?.[0] || '生活';
}

export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') {
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
        if (c === '\r' && text[i+1] === '\n') i++;
        if (rows.length > MAX_RECORDS + 1) throw Error('一次最多读取 5,000 条，请按年份拆分文件。');
      }
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed || c === '"') throw Error('CSV 引号格式错误，请用双引号包裹含逗号或换行的字段。');
      field += c;
    }
  }
  if (quoted) throw Error('CSV 引号未闭合。');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  const headers = rows.shift()?.map(h => h.trim().toLowerCase());
  if (!headers?.length || new Set(headers).size !== headers.length) throw Error('CSV 需要不重复的列名。');
  if (!headers.some(h => ['date','timestamp','created_at','日期','时间'].includes(h)) || !headers.some(h => ['text','content','title','note','正文','内容','标题'].includes(h))) throw Error('CSV 需要 date 和 text 列，也支持 timestamp、created_at、日期、正文。请参考模板。');
  return rows.map((cells, i) => {
    if (cells.length !== headers.length) throw Error(`CSV 第 ${i+2} 行列数不一致，请检查逗号与引号。`);
    return Object.fromEntries(headers.map((h,j) => [h,cells[j]]));
  });
}

// Some Meta exports encode UTF-8 bytes as Latin-1 JSON escapes. Decode only
// valid byte sequences; already-correct Unicode and ordinary Latin text stay intact.
export function decodeMetaText(value) {
  if (!value || [...value].some(c => c.codePointAt(0) > 255)) return value;
  try { return new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(value, c => c.charCodeAt(0))); }
  catch { return value; }
}

export function parseSocial(text, filename = '', platform = 'auto') {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error('文件或粘贴内容超过 5 MB，请按年份拆分。');
  text = text.replace(/^\uFEFF/, '').trim();
  if (!text) throw Error('请先选择文件或粘贴内容。');
  let data;
  const wrapper = /^window\.YTD\.tweets?\.part\d+\s*=\s*/;
  const xArchive = wrapper.test(text);
  const json = xArchive || /^[\[{]/.test(text) || /\.(json|js)$/i.test(filename);
  if (json) {
    try { data = JSON.parse(xArchive ? text.replace(wrapper, '').replace(/;\s*$/, '') : text); }
    catch { throw Error('JSON 无法解析。X 归档只支持 tweets.js / tweet.js 的数据赋值，不会执行脚本。'); }
  } else data = parseCSV(text);
  if (data?.birth && data?.memories) throw Error('这是此生备份，请使用「导入备份」恢复，不要当作社交帖子导入。');
  let records = Array.isArray(data) ? data : null;
  if (!records && data && typeof data === 'object') {
    for (const key of ['events','posts','tweets','statuses','data','your_posts','ig_posts','media']) {
      if (Array.isArray(data[key])) { records = data[key]; break; }
    }
  }
  if (!records) throw Error('未找到帖子数组。支持 JSON 数组，或 events / posts / tweets / data 等容器；请参考模板。');
  if (records.length > MAX_RECORDS) throw Error('一次最多读取 5,000 条，请按年份拆分文件。');
  if (!records.length) throw Error('文件中没有帖子。');
  return records.map((raw, index) => {
    const r = raw?.tweet || raw || {};
    const media = Array.isArray(r.media) ? r.media[0] : null;
    const facebookText = Array.isArray(r.data) ? r.data.map(d => str(d?.post)).filter(Boolean).join('\n') : '';
    const inferred = xArchive || raw?.tweet || r.full_text ? 'X' : media ? 'Instagram' : facebookText ? 'Facebook' : '通用导入';
    const source = platform !== 'auto' ? platform : firstText(r.platform, r.source) || inferred;
    let content = firstText(r.full_text, r.text, r.content, r.note, r['正文'], r['内容'], facebookText, r.title, r['标题'], media?.title);
    if (media || facebookText) content = decodeMetaText(content);
    const timestamp = r.date ?? r.timestamp ?? r.created_at ?? r.creation_timestamp ?? r['日期'] ?? r['时间'] ?? media?.creation_timestamp;
    const date = importDate(timestamp);
    const category = CATEGORIES.includes(r.category) ? r.category : inferCategory(content);
    const location = firstText(r.place, r.location, r.location?.name, r.place?.full_name, r['地点']);
    // Numeric IDs may already have lost precision in JSON. Use string IDs only.
    const externalId = firstText(r.id_str, r.id, r.post_id).slice(0,200);
    const origin = {
      platform: source.slice(0,80),
      externalId,
      timestamp: String(timestamp ?? '').slice(0,100),
      url: safeUrl(firstText(r.url, r.permalink, r.link) || (source === 'X' && /^\d+$/.test(externalId) ? `https://x.com/i/web/status/${externalId}` : '')),
    };
    return {index, selected: true, date, title: (media || facebookText ? decodeMetaText(firstText(r.title, r['标题'], content)) : firstText(r.title, r['标题'], content)).slice(0,80), note: content, place: location, category, origin};
  });
}

const normalized = s => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
export const contentKey = m => `${m.date}|${normalized(m.note || m.title)}`;
const externalKey = m => m.origin?.externalId ? `${m.origin.platform}|${m.origin.externalId}` : '';

export function reviewRows(rows, existing, birth, end = today()) {
  const content = new Set(existing.flatMap(m => [contentKey(m), m.origin?.contentKey].filter(Boolean)));
  const ids = new Set(existing.map(externalKey).filter(Boolean));
  return rows.map(row => {
    let error = '';
    if (!validDate(row.date)) error = '缺少有效日期；请填写 YYYY-MM-DD（时间戳按 UTC 转换）';
    else if (row.date < birth) error = '日期早于生日';
    else if (row.date > end) error = '日期在未来';
    else if (!row.title.trim()) error = '没有文字内容；可手动补充照片的说明';
    else if (row.title.length > 80 || row.note.length > 2000 || row.place.length > 80) error = '文字过长；标题最多 80 字，正文 2,000 字，地点 80 字';
    else if (!CATEGORIES.includes(row.category)) error = '请选择有效主题';
    const key = contentKey(row), id = externalKey(row);
    const duplicate = !error && (content.has(key) || (id && ids.has(id)));
    if (!error && !duplicate && row.selected) {content.add(key); if (id) ids.add(id);}
    return {...row, error, duplicate: !!duplicate, ready: !error && !duplicate && row.selected};
  });
}

export function createImportedMemories(reviewed, idFactory = () => crypto.randomUUID()) {
  return reviewed.filter(r => r.ready).map(r => ({
    id: idFactory(), date: r.date, title: r.title.trim(), note: r.note.trim(), place: r.place.trim(), category: r.category,
    origin: {...r.origin, contentKey: contentKey(r), importedAt: new Date().toISOString()},
  }));
}
