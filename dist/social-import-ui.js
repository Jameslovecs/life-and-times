import {CATEGORIES, MAX_BYTES, parseSocial, reviewRows, createImportedMemories} from './social-import.js';
import {today} from './engine.js';

export function setupSocialImport({getProfile, isDemo, commit, esc, toast}) {
  const $ = s => document.querySelector(s);
  const dialog = $('#social-dialog');
  let rows = [], page = 0, revision = 0;
  const PAGE_SIZE = 20;
  function error(message = '') { $('#social-error').textContent = message; $('#social-error').hidden = !message; }
  function invalidate() {
    revision++; rows = []; page = 0; error(); $('#social-review').hidden = true;
    $('#social-preview').disabled = false;
  }
  $('#social-import').onclick = () => {
    if (isDemo()) {toast('请先退出示例，建立自己的生日档案，再导入社交动态。'); return;}
    invalidate(); $('#social-paste').value = ''; $('#social-file').value = ''; dialog.showModal();
  };
  dialog.addEventListener('close', invalidate);
  $('#social-file').onchange = () => {$('#social-paste').value = ''; invalidate();};
  $('#social-paste').oninput = () => {$('#social-file').value = ''; invalidate();};
  $('#social-platform').onchange = invalidate;
  function reviewed() {return reviewRows(rows, getProfile().memories, getProfile().birth);}
  function updateSummary(review) {
    const ready = review.filter(r => r.ready).length;
    const invalid = review.filter(r => r.error).length;
    const duplicates = review.filter(r => r.duplicate).length;
    const unselected = review.filter(r => !r.error && !r.duplicate && !r.selected).length;
    const free = 1000 - getProfile().memories.length;
    $('#social-summary').textContent = `${rows.length} 条动态 · 待导入 ${ready} · 待修正 ${invalid} · 重复 ${duplicates} · 未选择 ${unselected}。还可保存 ${free} 条。`;
    $('#social-save').textContent = `确认导入 ${ready} 条`;
    $('#social-save').disabled = !ready || ready > free;
    if (ready > free) error('选择的条目超过剩余容量，请取消选择部分条目后再导入。');
    else error();
  }
  function render() {
    const review = reviewed(); updateSummary(review);
    $('#social-review').hidden = false;
    $('#social-rows').innerHTML = review.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE).map(r => `
      <article class="import-row" data-row="${r.index}">
        <div class="import-row-head"><label class="import-check"><input type="checkbox" data-select="${r.index}" ${r.selected?'checked':''} aria-label="选择第 ${r.index+1} 条动态"><span>${esc(r.title || '没有文案的动态')}</span></label><span class="import-status ${r.error?'invalid':''}">${esc(r.error || (r.duplicate?'重复，将跳过':r.selected?'待导入':'未选择'))}</span></div>
        <p class="import-row-meta">${esc(r.date || '待补充日期')} · ${esc(r.origin.platform)} · ${esc(r.category)}${r.place?' · '+esc(r.place):''}</p>
        <details ${r.error?'open':''}><summary>查看正文与修改</summary><div class="import-edit">
          <label>日期<input type="date" data-field="date" min="${getProfile().birth}" max="${today()}" value="${esc(r.date)}"></label>
          <label>主题 · 可修改<select data-field="category">${CATEGORIES.map(c=>`<option ${c===r.category?'selected':''}>${c}</option>`).join('')}</select></label>
          <label class="wide">标题<input data-field="title" value="${esc(r.title)}" maxlength="80"></label>
          <label class="wide">正文<textarea data-field="note" rows="3" maxlength="2000">${esc(r.note)}</textarea></label>
          <label class="wide">地点<input data-field="place" value="${esc(r.place)}" maxlength="80"></label>
        </div><p class="form-note">原始时间：${esc(r.origin.timestamp || '未提供')} · ${r.origin.url?`<a href="${esc(r.origin.url)}" target="_blank" rel="noopener noreferrer">查看原帖</a>`:'未提供原帖链接'}</p></details>
      </article>`).join('');
    const pages = Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    $('#social-page').textContent = `${page+1} / ${pages} 页`;
    $('#social-prev').disabled = page===0; $('#social-next').disabled = page+1>=pages;
  }
  $('#social-preview').onclick = async () => {
    invalidate(); const version = revision;
    $('#social-preview').disabled = true;
    try {
      const file = $('#social-file').files[0];
      if (file && (!/\.(json|csv|js)$/i.test(file.name) || file.size>MAX_BYTES)) throw Error('请选择小于 5 MB 的 JSON、CSV 或 X tweets.js 文件。ZIP 请先解压；截图暂不支持。');
      const text = file ? await file.text() : $('#social-paste').value;
      if (version !== revision || !dialog.open) return;
      rows = parseSocial(text, file?.name || '', $('#social-platform').value);
      render();
    } catch (e) { if (version === revision) error(e.message || '读取失败，请重试。'); }
    finally {if (version === revision) $('#social-preview').disabled=false;}
  };
  $('#social-rows').onchange = event => {
    const element = event.target, container = element.closest('[data-row]');
    if (!container) return;
    const row = rows[Number(container.dataset.row)];
    if (element.hasAttribute('data-select')) {row.selected = element.checked; render();}
    else if (element.dataset.field) {
      row[element.dataset.field] = element.value;
      // Keep the editor mounted so changing a field does not lose keyboard focus.
      const review = reviewed(); updateSummary(review);
      for (const card of $('#social-rows').querySelectorAll('[data-row]')) {
        const r = review[Number(card.dataset.row)], badge = card.querySelector('.import-status');
        badge.textContent = r.error || (r.duplicate?'重复，将跳过':r.selected?'待导入':'未选择');
        badge.classList.toggle('invalid', !!r.error);
      }
      container.querySelector('.import-check span').textContent = row.title || '没有文案的动态';
      container.querySelector('.import-row-meta').textContent = `${row.date || '待补充日期'} · ${row.origin.platform} · ${row.category}${row.place?' · '+row.place:''}`;
    }
  };
  $('#social-select-all').onclick = () => {rows.forEach(r=>r.selected=true); render();};
  $('#social-select-none').onclick = () => {rows.forEach(r=>r.selected=false); render();};
  $('#social-prev').onclick = () => {page--; render();};
  $('#social-next').onclick = () => {page++; render();};
  $('#social-save').onclick = () => {
    const memories = createImportedMemories(reviewed());
    if (!memories.length) {render(); return;}
    const outcome = commit(memories);
    if (!outcome.ok) {error(outcome.message); return;}
    dialog.close(); toast(`已导入 ${memories.length} 条动态，历史关联已更新。`);
  };
}
