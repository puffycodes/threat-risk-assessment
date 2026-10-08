'use strict';

// Assessment browser: renders the TRA workspace documents served by serve.py.
// Everything from the documents is escaped before it reaches the page; no raw
// HTML in the Markdown is passed through.

const ID_SRC = '(?:AS|SC|SE|DP|DD|[ATVCREQF])-\\d{1,3}';
const ID_EXACT = new RegExp(`^${ID_SRC}$`);
const ID_LEAD = new RegExp(`^(${ID_SRC})(?=[:.\\s]|$)`);
const URL_SRC = 'https?:\\/\\/[^\\s<>()`"]+[^\\s<>()`".,;:!?\']';
const TEXT_SRC = `(${URL_SRC})|\\b(${ID_SRC})\\b`;
const TEXT_TEST = new RegExp(TEXT_SRC);

// Which document kind defines each ID prefix (README "ID schemes").
const ID_HOME = {
  A: 'tra', T: 'tra', V: 'tra', C: 'tra', R: 'tra', AS: 'tra', E: 'tra', SE: 'tra',
  Q: 'clarifications', DP: 'design', F: 'design', DD: 'design', SC: 'controls',
};
const RATINGS = ['Critical', 'High', 'Medium', 'Low'];
const BAND_LETTER = { C: 'Critical', H: 'High', M: 'Medium', L: 'Low' };
const KIND_SHORT = {
  scenario: 'Scenario', tra: 'TRA', clarifications: 'Clarifications', design: 'Design',
  controls: 'Controls', summary: 'Summary', submission: 'Answers', other: 'Other',
};
const Q_STATUS = [
  ['open', 'Open'],
  ['pending', 'Answered, not yet assessed'],
  ['partial', 'Answered in part'],
  ['answered', 'Answered'],
  ['other', 'Other'],
];
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const app = document.getElementById('app');
const state = {
  index: null,
  sig: '',
  docs: new Map(),      // path -> { mtime, text, r }
  subjects: new Map(),  // slug -> built subject
  ui: new Map(),        // slug -> view state (filters, sort)
  view: '',             // key of the view on screen
  subject: null,        // built subject on screen
  sessions: new Map(),  // slug -> answering session (the draft being edited)
  reviewing: new Set(), // slugs whose answer page shows Review and submit
};

// ---------------------------------------------------------------- utilities

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function plain(s) {
  return String(s)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1$2')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\\\|/g, '|')
    .trim();
}

const enc = encodeURIComponent;
const num = s => { const m = plain(s || '').match(/\d+/); return m ? +m[0] : null; };
const ratingOf = s => {
  const m = plain(s || '').match(/\b(critical|high|medium|low)\b/i);
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : null;
};

function slugify(text) {
  return plain(text).toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim().replace(/\s+/g, '-') || 'section';
}

function makeSlugger() {
  const seen = new Map();
  return text => {
    const s = slugify(text);
    const n = seen.get(s) || 0;
    seen.set(s, n + 1);
    return n ? `${s}-${n}` : s;
  };
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function fmtDate(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const docRoute = (slug, id, anchor) =>
  `#/s/${enc(slug)}/doc/${enc(id)}${anchor ? `?a=${enc(anchor)}` : ''}`;
const rawRoute = (slug, id, line) =>
  `#/s/${enc(slug)}/raw/${enc(id)}${line ? `?line=${line}` : ''}`;

function badge(rating, text) {
  if (!rating) return text ? `<span class="badge">${escapeHtml(text)}</span>` : '';
  return `<span class="badge r-${rating.toLowerCase()}"><i aria-hidden="true"></i>${escapeHtml(text || rating)}</span>`;
}

// ----------------------------------------------------------------- markdown

function inline(src) {
  const held = [];
  const hold = html => { held.push(html); return `\u0000${held.length - 1}\u0000`; };
  let s = String(src).replace(/\\\|/g, '|').replace(/`([^`]+)`/g, (_, c) => hold(`<code>${escapeHtml(c)}</code>`));
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => hold(linkHtml(emphasis(t), u)));
  s = emphasis(s);
  // Placeholders can nest (a code span inside link text), so expand until none are left.
  while (/\u0000\d+\u0000/.test(s)) s = s.replace(/\u0000(\d+)\u0000/g, (_, k) => held[+k]);
  return s;
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1<em>$2</em>');
}

function linkHtml(text, url) {
  // url is already HTML-escaped, so it is safe inside an attribute.
  if (/^(https?:|mailto:)/i.test(url)) {
    return `<a href="${url}" class="ext" target="_blank" rel="noopener noreferrer">${text}</a>`;
  }
  if (url.startsWith('#')) return `<a data-frag="${url.slice(1)}">${text}</a>`;
  if (/^[a-z][\w+.-]*:/i.test(url)) return text;
  return `<a data-rel="${url}">${text}</a>`;
}

function isTableStart(lines, i) {
  return /^\s*\|/.test(lines[i]);
}

function startsBlock(lines, i) {
  const l = lines[i];
  return HEADING_RE.test(l) || /^\s*(```|~~~)/.test(l) || isTableStart(lines, i) ||
    /^\s*>/.test(l) || LIST_RE.test(l) || /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
}

const indentOf = l => l.match(/^\s*/)[0].replace(/\t/g, '    ').length;

function dedent(lines) {
  const min = Math.min(...lines.filter(l => l.trim()).map(indentOf));
  return lines.map(l => l.replace(/\t/g, '    ').slice(Number.isFinite(min) ? min : 0));
}

function registerDef(ctx, id, fields) {
  if (ctx.seen.has(id)) return false;
  ctx.seen.add(id);
  ctx.defs.push({ id, anchor: `def-${id}`, fields });
  return true;
}

function blocks(lines, ctx) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^\s*(```|~~~)/))) {
      const fence = m[1];
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(dedent(buf).join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(HEADING_RE))) {
      out.push(heading(m[1].length, m[2], lines, i, ctx));
      i++;
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (isTableStart(lines, i)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      out.push(table(rows, ctx));
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${blocks(buf, ctx)}</blockquote>`);
      continue;
    }
    if (LIST_RE.test(line)) {
      const r = list(lines, i, ctx);
      out.push(r.html);
      i = r.next;
      continue;
    }
    const buf = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) buf.push(lines[i++].trim());
    out.push(`<p>${buf.map(inline).join('\n')}</p>`);
  }
  return out.join('\n');
}

function heading(level, text, lines, i, ctx) {
  const id = ctx.slug(text);
  const title = plain(text);
  if (level === 1 && !ctx.title) ctx.title = title;
  if (level === 2 || level === 3) ctx.toc.push({ level, id, text: title });
  const dm = title.match(ID_LEAD);
  let attrs = '';
  let anchor = '';
  if (dm) {
    // A heading such as "### Q-01: Patching" defines Q-01; its fields are the
    // "- **Field:** value" lines that follow, up to the next heading.
    const fields = [['', title.slice(dm[1].length).replace(/^[:.\s]+/, '')]];
    for (let j = i + 1; j < lines.length && !HEADING_RE.test(lines[j]); j++) {
      const f = lines[j].match(/^\s*[-*]\s+\*\*(.+?):\*\*\s*(.*)$/);
      if (f) fields.push([f[1], plain(f[2])]);
      else if (lines[j].trim() && fields.length === 1) fields.push(['', plain(lines[j])]);
    }
    attrs = ` class="defcell" data-def="${dm[1]}"`;
    if (registerDef(ctx, dm[1], fields)) anchor = `<span class="anchor" id="def-${dm[1]}"></span>`;
  }
  return `<h${level} id="${id}"${attrs}>${anchor}${inline(text)}</h${level}>`;
}

function table(rows, ctx) {
  const header = splitRow(rows[0]);
  let body = rows.slice(1);
  let align = [];
  if (body.length && SEP_RE.test(body[0])) {
    align = splitRow(body[0]).map(c => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
    body = body.slice(1);
  }
  const cls = (k, extra) => {
    const c = [extra, align[k] && `al-${align[k]}`].filter(Boolean).join(' ');
    return c ? ` class="${c}"` : '';
  };
  const th = header.map((h, k) => `<th${cls(k)}>${inline(h)}</th>`).join('');
  const trs = body.map(r => {
    const cells = splitRow(r);
    while (cells.length < header.length) cells.push('');
    const lead = plain(cells[0]).match(ID_LEAD);
    let attrs = '';
    let firstCls = '';
    if (lead) {
      // A row whose first cell is an ID ("R-01", or "SE-1: ...") defines that ID.
      const fields = header.map((h, k) => [plain(h), plain(cells[k] || '')]);
      firstCls = 'defcell';
      attrs = ` data-def="${lead[1]}"`;
      if (registerDef(ctx, lead[1], fields)) attrs += ` id="def-${lead[1]}"`;
    }
    const tds = cells.map((c, k) => `<td${cls(k, k === 0 ? firstCls : '')}>${inline(c)}</td>`).join('');
    return `<tr${attrs}>${tds}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function list(lines, start, ctx) {
  const first = lines[start].match(LIST_RE);
  const base = indentOf(lines[start]);
  const ordered = /\d/.test(first[2]);
  const items = [];
  let cur = null;
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(LIST_RE);
    if (m && indentOf(line) === base) {
      if (/\d/.test(m[2]) !== ordered) break;
      cur = { first: m[3], rest: [] };
      items.push(cur);
      i++;
      continue;
    }
    if (m && indentOf(line) < base) break;
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && indentOf(lines[j]) > base) { cur.rest.push(''); i++; continue; }
      break;
    }
    if (indentOf(line) > base) { cur.rest.push(line); i++; continue; }
    if (!cur.rest.length && !startsBlock(lines, i)) { cur.first += ` ${line.trim()}`; i++; continue; }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && parseInt(first[2], 10) !== 1 ? ` start="${parseInt(first[2], 10)}"` : '';
  const lis = items.map(it => {
    // An item that starts with a bold ID ("- **AS-01:** ...") defines that ID.
    const dm = /^\*\*/.test(it.first) && plain(it.first).match(ID_LEAD);
    let attrs = '';
    let anchor = '';
    if (dm) {
      attrs = ` class="defcell" data-def="${dm[1]}"`;
      const text = plain(it.first).slice(dm[1].length).replace(/^[:.\s]+/, '');
      if (registerDef(ctx, dm[1], [['', text]])) anchor = `<span class="anchor" id="def-${dm[1]}"></span>`;
    }
    const rest = it.rest.some(l => l.trim()) ? blocks(dedent(it.rest), ctx) : '';
    return `<li${attrs}>${anchor}${inline(it.first)}${rest}</li>`;
  }).join('');
  return { html: `<${tag}${startAttr}>${lis}</${tag}>`, next: i };
}

function renderMarkdown(text) {
  const ctx = { slug: makeSlugger(), toc: [], defs: [], seen: new Set(), title: '' };
  const html = blocks(text.replace(/\r\n?/g, '\n').split('\n'), ctx);
  return { html, toc: ctx.toc, defs: ctx.defs, title: ctx.title, meta: docMeta(text) };
}

// Heading anchors by source line, matching the ids the renderer gives them.
function headingAnchors(text) {
  const slug = makeSlugger();
  const out = [];
  let fence = null;
  text.split(/\r?\n/).forEach((l, i) => {
    const f = l.match(/^\s*(```|~~~)/);
    if (f) { if (!fence) fence = f[1]; else if (l.trim().startsWith(fence)) fence = null; return; }
    if (fence) return;
    const m = l.match(HEADING_RE);
    if (m) out.push({ line: i + 1, id: slug(m[2]), text: plain(m[2]) });
  });
  return out;
}

// ------------------------------------------------------------------ parsing

function parseTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence = !fence; continue; }
    if (fence || !/^\s*\|/.test(lines[i])) continue;
    const rows = [];
    const line = i + 1;
    while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
    const headers = splitRow(rows[0]);
    let body = rows.slice(1);
    if (body.length && SEP_RE.test(body[0])) body = body.slice(1);
    tables.push({ line, headers: headers.map(plain), rows: body.map(splitRow) });
  }
  return tables;
}

function docMeta(text) {
  const t = parseTables(text).find(x => /^field$/i.test(x.headers[0]) && /^value$/i.test(x.headers[1] || ''));
  const meta = {};
  if (t) for (const r of t.rows) meta[plain(r[0]).toLowerCase()] = plain(r[1] || '');
  return {
    version: meta.version || '',
    status: meta.status || '',
    date: meta.date || meta['assessment date'] || '',
  };
}

function parseRisks(text) {
  const tables = parseTables(text);
  const col = (t, re) => t.headers.findIndex(h => re.test(h));
  const isRiskTable = t => /^risk id$/i.test(t.headers[0]);
  const reg = tables.find(t => isRiskTable(t) && col(t, /^rating$/i) >= 0 && col(t, /^l$/i) >= 0);
  if (!reg) return null;
  const trt = tables.find(t => isRiskTable(t) && col(t, /^residual rating$/i) >= 0);
  const get = (t, row, re) => { const k = col(t, re); return k >= 0 ? (row[k] || '') : ''; };

  const risks = [];
  for (const row of reg.rows) {
    const id = plain(row[0]);
    if (!ID_EXACT.test(id)) continue;
    const l = num(get(reg, row, /^l$/i));
    const i = num(get(reg, row, /^i$/i));
    risks.push({
      id,
      scenario: get(reg, row, /scenario/i),
      l, i,
      score: num(get(reg, row, /^score$/i)) ?? (l && i ? l * i : null),
      rating: ratingOf(get(reg, row, /^rating$/i)),
      owner: get(reg, row, /owner/i),
    });
  }
  if (trt) {
    for (const row of trt.rows) {
      const r = risks.find(x => x.id === plain(row[0]));
      if (!r) continue;
      r.treatment = plain(get(trt, row, /^treatment$/i));
      r.actions = get(trt, row, /action/i);
      r.target = plain(get(trt, row, /target/i));
      r.rl = num(get(trt, row, /^residual l$/i));
      r.ri = num(get(trt, row, /^residual i$/i));
      r.rscore = num(get(trt, row, /^residual score$/i)) ?? (r.rl && r.ri ? r.rl * r.ri : null);
      r.rrating = ratingOf(get(trt, row, /^residual rating$/i));
    }
  }

  // Bands from the TRA's own risk matrix (cells such as "15 H").
  const bands = {};
  const mat = tables.find(t => /likelihood/i.test(t.headers[0]) && t.headers.length >= 3);
  if (mat) {
    for (const row of mat.rows) {
      const l = num(row[0]);
      if (!l) continue;
      bands[l] = {};
      for (let k = 1; k < row.length; k++) {
        const impact = num(mat.headers[k]);
        const cell = plain(row[k] || '');
        const letter = cell.match(/\b([CHML])\b/);
        if (impact) bands[l][impact] = ratingOf(cell) || (letter ? BAND_LETTER[letter[1]] : null);
      }
    }
  }
  return { risks, bands, hasTreatment: !!trt };
}

function parseQuestions(text) {
  const qs = [];
  let q = null;
  let field = null;
  text.split(/\r?\n/).forEach((line, n) => {
    const h = line.match(/^#{2,4}\s+(Q-\d{1,3})\b\s*[:.\-–]?\s*(.*)$/);
    if (h) { q = { id: h[1], title: plain(h[2]), fields: [], line: n + 1 }; qs.push(q); field = null; return; }
    if (HEADING_RE.test(line)) { q = null; return; }
    if (!q) return;
    const f = line.match(/^\s*[-*]\s+\*\*(.+?):\*\*\s*(.*)$/);
    if (f) { field = [f[1].trim(), f[2]]; q.fields.push(field); return; }
    if (field && line.trim()) field[1] += (field[1] ? '\n' : '') + line.trim();
  });
  for (const x of qs) {
    const get = name => (x.fields.find(f => f[0].toLowerCase() === name) || [])[1] || '';
    x.statusText = plain(get('status'));
    const answered = plain(get('answer')).length > 0;
    const s = x.statusText.toLowerCase();
    // fileStatus is the Status as written; status also counts an answer that
    // no re-assessment has used yet.
    x.fileStatus = /^answered in part/.test(s) ? 'partial'
      : /^answered/.test(s) ? 'answered'
        : /^open/.test(s) || !s ? 'open'
          : 'other';
    x.status = x.fileStatus === 'open' && answered ? 'pending' : x.fileStatus;
    x.pendingAnswers = [];
  }
  return qs;
}

const fieldOf = (q, name) => (q.fields.find(f => f[0].toLowerCase() === name) || [])[1] || '';

// An answer submission written by the browser (serve.py, submit()).
function parseSubmission(text) {
  const t = parseTables(text).find(x => /^field$/i.test(x.headers[0]));
  const meta = {};
  if (t) for (const r of t.rows) meta[plain(r[0]).toLowerCase()] = plain(r[1] || '');
  const unescape = s => s.replace(/^\\(?=[#|>\-*+\d`~])/gm, '');
  const answers = parseQuestions(text).map(q => ({
    id: q.id,
    title: q.title,
    question: fieldOf(q, 'question'),
    answer: unescape(fieldOf(q, 'answer')),
  }));
  const dontKnow = [];
  let inDontKnow = false;
  for (const line of text.split(/\r?\n/)) {
    if (HEADING_RE.test(line)) { inDontKnow = /^##\s+don.t know/i.test(line); continue; }
    const m = inDontKnow && line.match(/^\s*-\s+(Q-\d{1,3})\b[:\s]*(.*)$/);
    if (m) dontKnow.push({ id: m[1], title: plain(m[2]) });
  }
  const status = meta.status || '';
  return {
    status,
    pending: /^pending/i.test(status),
    submitted: meta.submitted || '',
    answeredBy: meta['answered by'] || '',
    clarifications: meta['clarifications file'] || '',
    answers,
    dontKnow,
  };
}

const fmtStamp = iso => String(iso).replace('T', ' ').slice(0, 16);

// ------------------------------------------------------------- data loading

async function fetchIndex() {
  const r = await fetch('/api/index', { cache: 'no-store' });
  if (!r.ok) throw new Error(`Index request failed (${r.status})`);
  return r.json();
}

const indexSig = idx => idx.subjects.map(s => s.docs.map(d => `${d.path}:${d.mtime}`).join('|')).join('||');

async function loadDoc(doc) {
  const c = state.docs.get(doc.path);
  if (c && c.mtime === doc.mtime) return c;
  const r = await fetch(`/api/doc?path=${enc(doc.path)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Couldn't load ${doc.path} (${r.status})`);
  const text = await r.text();
  const entry = { mtime: doc.mtime, text, r: renderMarkdown(text) };
  state.docs.set(doc.path, entry);
  return entry;
}

async function buildSubject(slug) {
  const subj = state.index.subjects.find(s => s.slug === slug);
  if (!subj) return null;
  const sig = subj.docs.map(d => `${d.path}:${d.mtime}`).join('|');
  const cached = state.subjects.get(slug);
  if (cached && cached.sig === sig) {
    cached.hasDraft = !!subj.draft;
    return cached;
  }

  const docs = await Promise.all(subj.docs.map(async d => {
    const e = await loadDoc(d);
    return { ...d, ...e.r, text: e.text };
  }));
  const ids = new Map();
  for (const d of docs) {
    for (const def of d.defs) {
      if (!ids.has(def.id)) ids.set(def.id, { id: def.id, defs: [] });
      ids.get(def.id).defs.push({ doc: d, anchor: def.anchor, fields: def.fields });
    }
  }
  for (const e of ids.values()) {
    const home = ID_HOME[e.id.split('-')[0]];
    e.primary = e.defs.find(x => x.doc.kind === home) || e.defs[0];
  }
  const tra = docs.find(d => d.kind === 'tra');
  const clar = docs.find(d => d.kind === 'clarifications');
  const scen = docs.find(d => d.kind === 'scenario');
  const titleSrc = (tra && tra.title) || (scen && scen.title) || '';
  const questions = clar ? parseQuestions(clar.text) : [];
  const submissions = docs.filter(d => d.kind === 'submission').map(d => ({ doc: d, ...parseSubmission(d.text) }));
  for (const sub of submissions.filter(x => x.pending)) {
    for (const a of sub.answers) {
      const q = questions.find(x => x.id === a.id);
      if (q) q.pendingAnswers.push({ sub, answer: a.answer });
    }
  }
  for (const q of questions) if (q.status === 'open' && q.pendingAnswers.length) q.status = 'pending';
  const built = {
    slug,
    sig,
    docs,
    ids,
    tra,
    clar,
    title: titleSrc.replace(/^[^:]*:\s*/, '') || slug,
    risks: tra ? parseRisks(tra.text) : null,
    questions,
    submissions,
    hasDraft: !!subj.draft,
    mtime: Math.max(0, ...docs.map(d => d.mtime)),
  };
  state.subjects.set(slug, built);
  return built;
}

function findDoc(pathish, b) {
  const p = pathish.replace(/^\.\//, '').replace(/\\/g, '/');
  const match = d => d.path === p || d.path.endsWith(`/${p}`) || d.name === p;
  const local = b && b.docs.find(match);
  if (local) return { slug: b.slug, doc: local };
  for (const s of state.index.subjects) {
    const d = s.docs.find(match);
    if (d) return { slug: s.slug, doc: d };
  }
  return null;
}

function uiFor(slug) {
  if (!state.ui.has(slug)) {
    state.ui.set(slug, { matrix: 'current', ratings: new Set(), text: '', sort: { key: 'score', dir: -1 }, qStatus: '', qText: '' });
  }
  return state.ui.get(slug);
}

// -------------------------------------------------------------------- views

function setCrumbs(parts) {
  document.getElementById('crumbs').innerHTML = parts
    .map(([t, href]) => (href ? `<a href="${href}">${escapeHtml(t)}</a>` : `<span>${escapeHtml(t)}</span>`))
    .join('<span class="sep">/</span>');
}

function render(view, html, b, after) {
  const y = window.scrollY;
  const same = view === state.view;
  state.view = view;
  state.subject = b || null;
  app.innerHTML = html;
  window.scrollTo(0, same || state.keepScroll ? y : 0);
  if (b) enhance(app, b);
  if (after) after();
}

function countBy(list, key) {
  const c = {};
  for (const x of list) if (x[key]) c[x[key]] = (c[x[key]] || 0) + 1;
  return c;
}

function ratingSummary(counts) {
  const parts = RATINGS.filter(r => counts[r]).map(r => badge(r, `${counts[r]} ${r}`));
  return parts.length ? parts.join(' ') : '<span class="muted">none</span>';
}

async function viewHome() {
  setCrumbs([]);
  const subjects = await Promise.all(state.index.subjects.map(s => buildSubject(s.slug)));
  const cards = subjects.map(b => {
    const risks = b.risks ? b.risks.risks : [];
    const open = b.questions.filter(q => q.status === 'open' || q.status === 'partial').length;
    const pending = b.questions.filter(q => q.status === 'pending').length;
    const meta = b.tra ? b.tra.meta : null;
    const kinds = [...new Set(b.docs.filter(d => d.kind !== 'submission').map(d => KIND_SHORT[d.kind]))].join(' · ');
    const subs = b.submissions.filter(s => s.pending).length;
    const answerNotes = [
      subs && `${subs} pending submission${subs === 1 ? '' : 's'}`,
      b.hasDraft && 'unsubmitted draft',
    ].filter(Boolean).join(' · ');
    return `<a class="card" href="#/s/${enc(b.slug)}">
      <h2>${escapeHtml(b.title)}</h2>
      <p class="mono muted">${escapeHtml(b.slug)}</p>
      ${meta ? `<p>TRA v${escapeHtml(meta.version)} · ${escapeHtml(meta.status)} · ${escapeHtml(meta.date)}</p>` : '<p class="muted">No assessment yet</p>'}
      ${risks.length ? `<p class="badges">${ratingSummary(countBy(risks, 'rating'))}</p>` : ''}
      ${b.questions.length ? `<p>${open} open question${open === 1 ? '' : 's'}${pending ? ` · ${pending} answer${pending === 1 ? '' : 's'} awaiting assessment` : ''}</p>` : ''}
      ${answerNotes ? `<p class="small">${escapeHtml(answerNotes)}</p>` : ''}
      <p class="muted small">${escapeHtml(kinds)} · updated ${fmtDate(b.mtime)}</p>
    </a>`;
  }).join('');
  render('home', `<div class="page">
    <h1>Subjects</h1>
    <p class="muted">Documents in <code>scenario/</code> and <code>output/</code>. Pages refresh when the files change.</p>
    ${subjects.length ? `<div class="cards">${cards}</div>` : '<p>No subjects found. Add a folder under <code>scenario/</code> and run the assessor.</p>'}
  </div>`);
}

function subjectHeader(b, active) {
  const tabs = [['overview', 'Overview', `#/s/${enc(b.slug)}`]];
  if (b.questions.length) tabs.push(['questions', 'Questions', `#/s/${enc(b.slug)}/questions`]);
  let summaryShown = false;
  for (const d of b.docs) {
    if (d.kind === 'submission') continue;  // listed on the Questions page
    if (d.kind === 'summary') {
      if (summaryShown) continue;
      summaryShown = true;
    }
    const label = d.kind === 'other' ? d.label : d.kind === 'scenario' && d.name !== 'description.md' ? d.label : KIND_SHORT[d.kind];
    tabs.push([d.kind === 'summary' ? 'summary' : d.id, label, docRoute(b.slug, d.id)]);
  }
  const q = active === 'search' ? (new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '') : '';
  return `<div class="subject-head">
    <h1>${escapeHtml(b.title)}</h1>
    <nav class="tabs" aria-label="Subject">
      ${tabs.map(([k, t, h]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${escapeHtml(t)}</a>`).join('')}
      <form class="search" id="search-form" role="search">
        <input type="search" name="q" placeholder="Search this subject" aria-label="Search this subject" value="${escapeHtml(q)}">
      </form>
    </nav>
  </div>`;
}

function bindSearch(b) {
  const f = document.getElementById('search-form');
  if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const q = f.q.value.trim();
    if (q) location.hash = `#/s/${enc(b.slug)}/search?q=${enc(q)}`;
  });
}

function idLink(b, id, text) {
  const e = b.ids.get(id);
  if (!e) return escapeHtml(text || id);
  return `<a class="idref" data-id="${id}" href="${docRoute(b.slug, e.primary.doc.id, e.primary.anchor)}">${escapeHtml(text || id)}</a>`;
}

function viewOverview(b) {
  setCrumbs([[b.slug, `#/s/${enc(b.slug)}`]]);
  const ui = uiFor(b.slug);
  const R = b.risks;
  const docRows = b.docs.map(d => `<tr>
      <td><a href="${docRoute(b.slug, d.id)}">${escapeHtml(d.label)}</a></td>
      <td>${escapeHtml(d.meta.version)}</td><td>${escapeHtml(d.meta.status)}</td><td>${escapeHtml(d.meta.date)}</td>
      <td class="mono small">${escapeHtml(d.path)}</td><td class="nowrap">${fmtDate(d.mtime)}</td></tr>`).join('');

  let body = '';
  if (b.tra) {
    const m = b.tra.meta;
    body += `<p class="muted">TRA version ${escapeHtml(m.version)} · ${escapeHtml(m.status)} · assessed ${escapeHtml(m.date)}</p>`;
  } else {
    body += '<p class="note">No threat risk assessment for this subject yet. Run the assessor agent on its scenario.</p>';
  }
  if (R && R.risks.length) {
    const cur = countBy(R.risks, 'rating');
    const res = countBy(R.risks, 'rrating');
    const qOpen = b.questions.filter(q => q.status === 'open' || q.status === 'partial').length;
    const qPending = b.questions.filter(q => q.status === 'pending').length;
    body += `<section class="tiles">
      ${RATINGS.map(r => `<div class="tile">
        <div class="tile-label">${badge(r)}</div>
        <div class="tile-num">${cur[r] || 0}</div>
        <div class="tile-sub">${R.hasTreatment ? `${res[r] || 0} after treatment` : 'risks'}</div></div>`).join('')}
      ${b.questions.length ? `<a class="tile" href="#/s/${enc(b.slug)}/questions">
        <div class="tile-label">Questions</div><div class="tile-num">${qOpen}</div>
        <div class="tile-sub">open or answered in part${qPending ? `; ${qPending} awaiting assessment` : ''}</div></a>` : ''}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Risk matrix</h2>
        ${R.hasTreatment ? `<div class="seg" role="group" aria-label="Matrix view">
          <button type="button" data-matrix="current" aria-pressed="${ui.matrix === 'current'}">Current</button>
          <button type="button" data-matrix="residual" aria-pressed="${ui.matrix === 'residual'}">After treatment</button></div>` : ''}
      </div>
      <div id="matrix"></div>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Risk register</h2>
        <div class="filters">
          ${RATINGS.map(r => `<button type="button" class="chip" data-rating="${r}" aria-pressed="${ui.ratings.has(r)}">${badge(r)}</button>`).join('')}
          <input type="search" id="risk-filter" placeholder="Filter risks" aria-label="Filter risks" value="${escapeHtml(ui.text)}">
        </div>
      </div>
      <div id="register"></div>
    </section>`;
  } else if (b.tra) {
    body += '<p class="note">No risk register table was found in the TRA (a table whose first column is "Risk ID").</p>';
  }
  body += `<section class="panel"><h2>Documents</h2>
    <div class="table-wrap"><table><thead><tr><th>Document</th><th>Version</th><th>Status</th><th>Date</th><th>File</th><th>Modified</th></tr></thead>
    <tbody>${docRows}</tbody></table></div></section>`;

  render(`overview:${b.slug}`, `<div class="page">${subjectHeader(b, 'overview')}${body}</div>`, b, () => {
    bindSearch(b);
    if (!R || !R.risks.length) return;
    const drawMatrix = () => { const el = document.getElementById('matrix'); el.innerHTML = matrixHtml(b, ui.matrix); enhance(el, b); };
    const drawRegister = () => { const el = document.getElementById('register'); el.innerHTML = registerHtml(b, ui); enhance(el, b); };
    drawMatrix();
    drawRegister();
    app.querySelectorAll('[data-matrix]').forEach(btn => btn.addEventListener('click', () => {
      ui.matrix = btn.dataset.matrix;
      app.querySelectorAll('[data-matrix]').forEach(x => x.setAttribute('aria-pressed', x === btn));
      drawMatrix();
    }));
    app.querySelectorAll('[data-rating]').forEach(btn => btn.addEventListener('click', () => {
      const r = btn.dataset.rating;
      if (ui.ratings.has(r)) ui.ratings.delete(r); else ui.ratings.add(r);
      btn.setAttribute('aria-pressed', ui.ratings.has(r));
      drawRegister();
    }));
    document.getElementById('risk-filter').addEventListener('input', e => { ui.text = e.target.value; drawRegister(); });
    document.getElementById('register').addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      ui.sort = { key, dir: ui.sort.key === key ? -ui.sort.dir : (key === 'id' ? 1 : -1) };
      drawRegister();
    });
  });
}

function matrixHtml(b, mode) {
  const R = b.risks;
  const lk = mode === 'residual' ? 'rl' : 'l';
  const ik = mode === 'residual' ? 'ri' : 'i';
  const cells = {};
  let unplaced = 0;
  for (const r of R.risks) {
    if (!r[lk] || !r[ik]) { unplaced++; continue; }
    (cells[`${r[lk]}-${r[ik]}`] = cells[`${r[lk]}-${r[ik]}`] || []).push(r);
  }
  const rowsHtml = [5, 4, 3, 2, 1].map(l => {
    const tds = [1, 2, 3, 4, 5].map(i => {
      const band = R.bands[l] && R.bands[l][i];
      const list = cells[`${l}-${i}`] || [];
      const label = `Likelihood ${l}, impact ${i}: ${band || 'unrated'}, ${list.length} risk${list.length === 1 ? '' : 's'}`;
      return `<td class="cell${band ? ` b-${band.toLowerCase()}` : ''}${list.length ? ' has' : ''}" aria-label="${escapeHtml(label)}">
        <span class="band">${band ? band[0] : ''} ${l * i}</span>
        <span class="ids">${list.map(r => idLink(b, r.id)).join('')}</span></td>`;
    }).join('');
    return `<tr><th scope="row">${l}</th>${tds}</tr>`;
  }).join('');
  return `<div class="matrix-wrap"><table class="matrix">
      <caption class="sr">Risks by likelihood and impact (${mode === 'residual' ? 'after treatment' : 'current'})</caption>
      <colgroup><col class="lcol"><col span="5"></colgroup>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><th></th>${[1, 2, 3, 4, 5].map(i => `<th scope="col">${i}</th>`).join('')}</tr></tfoot>
    </table>
    <div class="axis-y">Likelihood</div><div class="axis-x">Impact</div></div>
    <p class="legend">${RATINGS.slice().reverse().map(r => badge(r)).join(' ')}
      <span class="muted small">Bands from the TRA's risk matrix. Hover a risk for its details.${unplaced ? ` ${unplaced} risk(s) without ratings are not shown.` : ''}</span></p>`;
}

function registerHtml(b, ui) {
  const R = b.risks;
  const t = ui.text.trim().toLowerCase();
  const order = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const sortVal = {
    id: r => num(r.id), score: r => r.score ?? -1, rscore: r => r.rscore ?? -1,
    rating: r => order[r.rating] || 0, l: r => r.l ?? -1, i: r => r.i ?? -1,
  };
  const rows = R.risks
    .filter(r => !ui.ratings.size || ui.ratings.has(r.rating))
    .filter(r => !t || `${r.id} ${plain(r.scenario)} ${plain(r.owner)} ${r.treatment || ''} ${plain(r.actions || '')}`.toLowerCase().includes(t))
    .sort((a, c) => {
      const f = sortVal[ui.sort.key] || sortVal.score;
      return (f(a) - f(c)) * ui.sort.dir || num(a.id) - num(c.id);
    });
  const th = (key, text) => {
    const on = ui.sort.key === key;
    return `<th data-sort="${key}" class="sortable" aria-sort="${on ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${text}${on ? (ui.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  };
  const trs = rows.map(r => `<tr>
      <td class="nowrap">${idLink(b, r.id)}</td>
      <td>${inline(r.scenario)}</td>
      <td class="num">${r.l ?? ''}</td><td class="num">${r.i ?? ''}</td>
      <td class="nowrap">${badge(r.rating, r.rating ? `${r.rating} ${r.score ?? ''}` : '')}</td>
      ${R.hasTreatment ? `<td>${escapeHtml(r.treatment || '')}${r.target ? `<div class="muted small">by ${escapeHtml(r.target)}</div>` : ''}</td>
      <td class="nowrap">${badge(r.rrating, r.rrating ? `${r.rrating} ${r.rscore ?? ''}` : '')}</td>` : ''}
      <td>${inline(r.owner)}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="register"><thead><tr>
      ${th('id', 'Risk')}<th>Scenario</th>${th('l', 'L')}${th('i', 'I')}${th('score', 'Current')}
      ${R.hasTreatment ? `<th>Treatment</th>${th('rscore', 'Residual')}` : ''}<th>Owner</th></tr></thead>
      <tbody>${trs || `<tr><td colspan="9" class="muted">No risks match.</td></tr>`}</tbody></table></div>
    <p class="muted small">${rows.length} of ${R.risks.length} risks. Click a column heading to sort.</p>`;
}

function viewQuestions(b) {
  setCrumbs([[b.slug, `#/s/${enc(b.slug)}`], ['Questions']]);
  const ui = uiFor(b.slug);
  const counts = countBy(b.questions, 'status');
  const chips = [['', `All ${b.questions.length}`]].concat(
    Q_STATUS.filter(([k]) => counts[k]).map(([k, t]) => [k, `${t} ${counts[k]}`]));
  render(`questions:${b.slug}`, `<div class="page">${subjectHeader(b, 'questions')}
    <div class="actions">
      <a class="button primary" href="#/s/${enc(b.slug)}/answer">Answer clarification questions</a>
      ${b.hasDraft ? '<span class="muted">You have an unsubmitted draft.</span>' : ''}
    </div>
    <p class="muted">From <a href="${docRoute(b.slug, b.clar.id)}">${escapeHtml(b.clar.name)}</a>
      (version ${escapeHtml(b.clar.meta.version)}). You can also answer with <code>/clarify ${escapeHtml(b.slug)}</code> in Claude Code, or by editing the file.</p>
    ${submissionsHtml(b)}
    <div class="filters">
      ${chips.map(([k, t]) => `<button type="button" class="chip" data-q="${k}" aria-pressed="${ui.qStatus === k}">${escapeHtml(t)}</button>`).join('')}
      <input type="search" id="q-filter" placeholder="Filter questions" aria-label="Filter questions" value="${escapeHtml(ui.qText)}">
    </div>
    <div id="qlist"></div></div>`, b, () => {
    bindSearch(b);
    const draw = () => {
      const t = ui.qText.trim().toLowerCase();
      const list = b.questions
        .filter(q => !ui.qStatus || q.status === ui.qStatus)
        .filter(q => !t || `${q.id} ${q.title} ${q.fields.map(f => f[1]).join(' ')}`.toLowerCase().includes(t));
      const el = document.getElementById('qlist');
      el.innerHTML = list.length ? list.map(q => questionHtml(b, q)).join('') : '<p class="muted">No questions match.</p>';
      enhance(el, b);
    };
    draw();
    app.querySelectorAll('[data-q]').forEach(btn => btn.addEventListener('click', () => {
      ui.qStatus = btn.dataset.q;
      app.querySelectorAll('[data-q]').forEach(x => x.setAttribute('aria-pressed', x === btn));
      draw();
    }));
    document.getElementById('q-filter').addEventListener('input', e => { ui.qText = e.target.value; draw(); });
    app.querySelectorAll('[data-withdraw]').forEach(btn => btn.addEventListener('click', async () => {
      const file = btn.dataset.withdraw;
      if (!window.confirm(`Withdraw ${file}? The assessor won't use its answers. The file is kept as a record.`)) return;
      btn.disabled = true;
      try {
        await api('/api/withdraw', { subject: b.slug, file });
        toast(`Withdrew ${file}`);
        await refresh();
      } catch (err) {
        btn.disabled = false;
        toast(err.message);
      }
    }));
  });
}

const textHtml = v => v.split('\n').map(inline).join('<br>');

function submissionsHtml(b) {
  if (!b.submissions.length) return '';
  const rows = b.submissions.slice().reverse().map(s => {
    const ids = s.answers.map(a => a.id).join(', ');
    const dk = s.dontKnow.map(a => a.id).join(', ');
    return `<tr>
      <td class="nowrap"><a href="${docRoute(b.slug, s.doc.id)}">${escapeHtml(fmtStamp(s.submitted) || s.doc.name)}</a></td>
      <td>${escapeHtml(s.answeredBy)}</td>
      <td>${escapeHtml(ids) || '<span class="muted">none</span>'}${dk ? `<div class="muted small">Don't know: ${escapeHtml(dk)}</div>` : ''}</td>
      <td><span class="qstatus${s.pending ? ' st-pending' : ''}">${escapeHtml(s.status || 'Unknown')}</span></td>
      <td>${s.pending ? `<button type="button" data-withdraw="${escapeHtml(s.doc.name)}">Withdraw</button>` : ''}</td></tr>`;
  }).join('');
  return `<section class="panel"><h2>Answers submitted from the browser</h2>
    <div class="table-wrap"><table><thead><tr><th>Submitted</th><th>Answered by</th><th>Answers</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="muted small">The assessor uses pending submissions at the next re-assessment, then marks them as used.</p></section>`;
}

function priorAnswersHtml(b, q, includeFile) {
  const out = [];
  const by = plain(fieldOf(q, 'answered by'));
  const on = plain(fieldOf(q, 'answered on'));
  if (includeFile && plain(fieldOf(q, 'answer'))) {
    out.push(`<div class="prior"><div class="prior-h">Answer in the clarifications file${by ? ` · ${escapeHtml(by)}` : ''}${on ? `, ${escapeHtml(on)}` : ''}</div>
      <div>${textHtml(fieldOf(q, 'answer'))}</div></div>`);
  }
  for (const p of q.pendingAnswers) {
    out.push(`<div class="prior pending"><div class="prior-h">Pending answer · ${escapeHtml(p.sub.answeredBy)}, ${escapeHtml(fmtStamp(p.sub.submitted))}
      (<a href="${docRoute(b.slug, p.sub.doc.id, `def-${q.id}`)}">${escapeHtml(p.sub.doc.name)}</a>)</div>
      <div>${textHtml(p.answer)}</div></div>`);
  }
  return out.length ? `<div class="priors">${out.join('')}</div>` : '';
}

function questionHtml(b, q) {
  const label = (Q_STATUS.find(([k]) => k === q.status) || [])[1] || 'Other';
  const fields = q.fields.filter(([k]) => k.toLowerCase() !== 'status');
  return `<article class="q q-${q.status}">
    <header><a class="qid" href="${docRoute(b.slug, b.clar.id, `def-${q.id}`)}">${q.id}</a>
      <h2>${escapeHtml(q.title)}</h2><span class="qstatus">${escapeHtml(label)}</span></header>
    ${q.statusText ? `<p class="muted small">Status: ${escapeHtml(q.statusText)}</p>` : ''}
    <dl>${fields.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${v.trim() ? textHtml(v) : '<span class="muted">—</span>'}</dd>`).join('')}</dl>
    ${priorAnswersHtml(b, q, false)}
  </article>`;
}

// ---------------------------------------------------------- answering

const TOKEN = (document.querySelector('meta[name="ab-token"]') || {}).content || '';
const CARD_RE = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
const SECRET_WORD_RE = /\b(password|passwd|pwd|passphrase|secret|api[ _-]?key|access[ _-]?key|token)\s*(is|=|:)\s*\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const LONG_TOKEN_RE = /(?=[\w+/=-]*\d)(?=[\w+/=-]*[a-z])(?=[\w+/=-]*[A-Z])[\w+/=-]{24,}/;

async function api(path, body, opts = {}) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-AB-Token': TOKEN },
    body: JSON.stringify(body),
    keepalive: !!opts.keepalive,
  });
  let data = {};
  try { data = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

async function refresh() {
  state.index = await fetchIndex();
  state.sig = indexSig(state.index);
  await route({ keepScroll: true });
}

function hasCardNumber(text) {
  for (const m of String(text).matchAll(CARD_RE)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length < 13 || d.length > 19) continue;
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
      let n = +d[d.length - 1 - i];
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    if (sum % 10 === 0) return true;
  }
  return false;
}

const looksSecret = text => SECRET_WORD_RE.test(text) || LONG_TOKEN_RE.test(text);

function answerWarning(text) {
  if (hasCardNumber(text)) {
    return { error: true, msg: 'This looks like a full card number. Remove it: an answer with a card number can\'t be saved or submitted.' };
  }
  if (looksSecret(text)) {
    return { error: false, msg: 'This may contain a password, key or token. Record only that it exists, for example "the API key is kept in a .env file".' };
  }
  return null;
}

const questionText = q => plain(fieldOf(q, 'question'));
// What an answer was given against: the question's status and text.
const questionKey = q => `${q.fileStatus}|${questionText(q)}`;
const isAnswerable = q => q.fileStatus === 'open' || q.fileStatus === 'partial';

function changeReason(q) {
  if (q.fileStatus === 'missing') return 'This question is no longer in the clarifications file.';
  if (!isAnswerable(q)) return `This question is now ${q.statusText || 'closed'}.`;
  return 'The question has changed since you answered it.';
}

function emptySession() {
  return { answeredBy: '', clarVersion: '', answers: {}, savedAt: '', saveState: '', error: '', noSave: false, chain: Promise.resolve() };
}

async function loadSession(b) {
  if (state.sessions.has(b.slug)) return state.sessions.get(b.slug);
  const s = emptySession();
  try {
    const r = await fetch(`/api/draft?subject=${enc(b.slug)}`, { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `Couldn't load the draft (${r.status})`);
    if (data.draft) {
      Object.assign(s, {
        answeredBy: data.draft.answeredBy || '',
        clarVersion: data.draft.clarVersion || '',
        answers: data.draft.answers || {},
        savedAt: data.draft.savedAt || '',
        saveState: 'saved',
      });
    }
  } catch (err) {
    s.error = `${err.message} Saving is turned off so the draft isn't overwritten.`;
    s.noSave = true;
  }
  state.sessions.set(b.slug, s);
  return s;
}

function draftPayload(s) {
  const answers = {};
  for (const [id, a] of Object.entries(s.answers)) {
    // Never write what looks like a card number to disk, even in a draft.
    answers[id] = { state: a.state, text: a.state === 'answer' && !hasCardNumber(a.text) ? a.text : '', q: a.q || '' };
  }
  if (!s.answeredBy.trim() && !Object.keys(answers).length) return null;
  return { answeredBy: s.answeredBy, clarVersion: s.clarVersion, answers };
}

function saveSoon(b, s) {
  clearTimeout(s.timer);
  s.saveState = 'unsaved';
  showSaveState(s);
  s.timer = setTimeout(() => saveNow(b, s), 800);
}

function saveNow(b, s, keepalive) {
  clearTimeout(s.timer);
  if (s.noSave || s.saveState !== 'unsaved') return s.chain;
  s.saveState = 'saving';
  showSaveState(s);
  // One save at a time, in order, so an older save can't land after a newer one.
  s.chain = s.chain.then(async () => {
    try {
      const r = await api('/api/draft', { subject: b.slug, draft: draftPayload(s) }, { keepalive });
      s.savedAt = r.savedAt || '';
      if (s.saveState === 'saving') s.saveState = 'saved';
      s.error = '';
    } catch (err) {
      s.saveState = 'error';
      s.error = err.message;
    }
    showSaveState(s);
  });
  return s.chain;
}

function showSaveState(s) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.classList.toggle('error', s.saveState === 'error');
  el.textContent = {
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    saved: s.savedAt ? `Draft saved ${fmtStamp(s.savedAt).slice(11)}` : 'Nothing to save',
    error: `Not saved: ${s.error}`,
  }[s.saveState] || (s.noSave ? 'Saving is off' : 'No draft yet');
}

function flushSave() {
  if (!state.view.startsWith('answer:')) return;
  const slug = state.view.slice('answer:'.length);
  const s = state.sessions.get(slug);
  const b = state.subjects.get(slug);
  if (s && b && s.saveState === 'unsaved') saveNow(b, s, true);
}

function answerQuestions(b, s) {
  const list = b.questions.filter(isAnswerable);
  for (const id of Object.keys(s.answers)) {
    if (list.some(q => q.id === id)) continue;
    list.push(b.questions.find(q => q.id === id) ||
      { id, title: '(no longer in the clarifications file)', fields: [], fileStatus: 'missing', statusText: '', pendingAnswers: [] });
  }
  return list;
}

function changedQuestions(b, s) {
  return answerQuestions(b, s).filter(q => s.answers[q.id] && s.answers[q.id].q && s.answers[q.id].q !== questionKey(q));
}

function answerCardHtml(b, s, q) {
  const a = s.answers[q.id] || { state: 'skip', text: '' };
  const changed = a.q && a.q !== questionKey(q);
  const status = q.fileStatus === 'open' ? 'Open' : q.fileStatus === 'partial' ? 'Answered in part' : q.statusText || 'Not in file';
  const warn = a.state === 'answer' ? answerWarning(a.text) : null;
  const pressed = st => `aria-pressed="${a.state === st}"`;
  return `<article class="q answer-card${changed ? ' changed' : ''}" id="ans-${q.id}" data-q="${q.id}">
    <header>${b.ids.has(q.id) ? `<a class="qid" href="${docRoute(b.slug, b.clar.id, `def-${q.id}`)}">${q.id}</a>` : `<span class="qid">${q.id}</span>`}
      <h2>${escapeHtml(q.title)}</h2><span class="qstatus">${escapeHtml(status)}</span></header>
    ${changed ? `<p class="flag">${escapeHtml(changeReason(q))}</p>` : ''}
    <dl>
      <dt>Question</dt><dd>${fieldOf(q, 'question') ? textHtml(fieldOf(q, 'question')) : '<span class="muted">—</span>'}</dd>
      ${fieldOf(q, 'why it matters') ? `<dt>Why it matters</dt><dd>${textHtml(fieldOf(q, 'why it matters'))}</dd>` : ''}
    </dl>
    ${priorAnswersHtml(b, q, true)}
    <div class="seg choice" role="group" aria-label="Your answer to ${q.id}">
      <button type="button" data-state="answer" ${pressed('answer')}>Answer</button>
      <button type="button" data-state="dontknow" ${pressed('dontknow')}>Don't know</button>
      <button type="button" data-state="skip" ${pressed('skip')}>Skip</button>
    </div>
    <label class="sr" for="t-${q.id}">Your answer to ${q.id}</label>
    <textarea id="t-${q.id}" data-text rows="4" maxlength="10000"${a.state === 'answer' ? '' : ' hidden'}>${escapeHtml(a.text)}</textarea>
    <p class="warn${warn && warn.error ? ' error' : ''}" data-warn${warn ? '' : ' hidden'}>${warn ? escapeHtml(warn.msg) : ''}</p>
  </article>`;
}

function progressText(b, s) {
  const qs = answerQuestions(b, s);
  const n = st => qs.filter(q => s.answers[q.id] && s.answers[q.id].state === st).length;
  const skipped = qs.length - n('answer') - n('dontknow');
  return `${n('answer')} answered · ${n('dontknow')} don't know · ${skipped} skipped, of ${qs.length}`;
}

function reviewHtml(b, s) {
  const groups = { answered: [], dontknow: [], blank: [], skipped: [], cards: [], secrets: [] };
  for (const q of answerQuestions(b, s)) {
    const a = s.answers[q.id];
    if (!a) groups.skipped.push(q.id);
    else if (a.state === 'dontknow') groups.dontknow.push(q.id);
    else if (!a.text.trim()) groups.blank.push(q.id);
    else {
      groups.answered.push(q.id);
      if (hasCardNumber(a.text)) groups.cards.push(q.id);
      else if (looksSecret(a.text)) groups.secrets.push(q.id);
    }
  }
  const changed = changedQuestions(b, s).map(q => q.id);
  const ids = list => list.map(id => `<button type="button" class="linkish" data-goto="${id}">${id}</button>`).join(', ');
  const problems = [];
  if (!s.answeredBy.trim()) problems.push('Enter who is answering.');
  if (!groups.answered.length && !groups.dontknow.length) problems.push('There is nothing to submit yet.');
  if (groups.cards.length) problems.push(`Remove the card numbers from ${ids(groups.cards)}.`);
  if (changed.length) problems.push(`Review the questions that changed: ${ids(changed)}.`);
  const line = (label, list, note) => `<tr><th>${label}</th><td>${list.length}</td><td>${list.length ? ids(list) : '<span class="muted">none</span>'}${note && list.length ? `<div class="muted small">${note}</div>` : ''}</td></tr>`;
  return `<section class="panel review">
    <h2>Review and submit</h2>
    <p>Answered by <strong>${escapeHtml(s.answeredBy.trim() || '—')}</strong>, against ${escapeHtml(b.clar.name)} version ${escapeHtml(s.clarVersion || b.clar.meta.version)}.</p>
    <div class="table-wrap"><table>
      ${line('Answered', groups.answered)}
      ${line('Don\'t know', groups.dontknow, 'Listed in the submission without an answer, so the assessor can suggest someone else to ask.')}
      ${line('Skipped', groups.skipped.concat(groups.blank), groups.blank.length ? `Marked Answer but left empty: ${groups.blank.join(', ')}.` : '')}
    </table></div>
    ${groups.secrets.length ? `<p class="warn">These answers may contain a password, key or token: ${ids(groups.secrets)}. Check them before submitting.</p>` : ''}
    ${problems.length ? `<ul class="problems">${problems.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
    <p class="muted small">Submitting writes a new file in <code>output/${escapeHtml(b.slug)}/answers/</code> and clears this draft. The assessor uses the answers at the next re-assessment.</p>
    <div class="actions">
      <button type="button" class="primary" data-submit${problems.length ? ' disabled' : ''}>Submit answers</button>
      <button type="button" data-back>Back to answering</button>
    </div>
  </section>`;
}

async function viewAnswer(b) {
  setCrumbs([[b.slug, `#/s/${enc(b.slug)}`], ['Questions', `#/s/${enc(b.slug)}/questions`], ['Answer']]);
  const s = await loadSession(b);
  const changed = changedQuestions(b, s);
  // Nothing the session answered has changed, so it now stands against the current version.
  if (!changed.length && Object.keys(s.answers).length) s.clarVersion = b.clar.meta.version;
  const reviewing = state.reviewing.has(b.slug);
  const qs = answerQuestions(b, s);
  render(`answer:${b.slug}`, `<div class="page">${subjectHeader(b, 'questions')}
    <h2 class="page-h">Answer clarification questions</h2>
    <p class="muted">Questions that are Open or Answered in part, from <a href="${docRoute(b.slug, b.clar.id)}">${escapeHtml(b.clar.name)}</a>
      (version ${escapeHtml(b.clar.meta.version)}), most important first. Your answers are saved as a draft while you type, so you can stop and come back later.
      When you submit, the assessor uses them at the next re-assessment. Answer as specifically as you can, and don't include passwords, keys or full card numbers.</p>
    ${s.error && s.noSave ? `<p class="error">${escapeHtml(s.error)}</p>` : ''}
    <div class="panel who">
      <label for="who"><strong>Who is answering?</strong> <span class="muted">Your name or role, such as System owner. It is recorded with every answer.</span></label>
      <input id="who" type="text" maxlength="300" autocomplete="name" value="${escapeHtml(s.answeredBy)}">
    </div>
    ${changed.length ? `<div class="note warn-note">
      <p><strong>The clarifications file has changed</strong> since you answered ${changed.map(q => q.id).join(', ')}. Check those questions, then mark them as reviewed.</p>
      <button type="button" data-reviewed>Mark as reviewed</button></div>` : ''}
    <div class="answer-bar">
      <span id="progress">${escapeHtml(progressText(b, s))}</span>
      <span id="save-status" class="muted small"></span>
      <span class="spacer"></span>
      <button type="button" id="save">Save</button>
      <button type="button" class="primary" id="review"${reviewing ? ' hidden' : ''}>Review and submit</button>
    </div>
    <div id="review-panel">${reviewing ? reviewHtml(b, s) : ''}</div>
    <div id="alist"${reviewing ? ' hidden' : ''}>${qs.length ? qs.map(q => answerCardHtml(b, s, q)).join('') : '<p class="muted">There are no Open questions.</p>'}</div>
  </div>`, b, () => {
    bindSearch(b);
    showSaveState(s);
    const touch = () => { if (!s.clarVersion) s.clarVersion = b.clar.meta.version; saveSoon(b, s); };
    const progress = () => { document.getElementById('progress').textContent = progressText(b, s); };
    document.getElementById('who').addEventListener('input', e => { s.answeredBy = e.target.value; touch(); });
    document.getElementById('save').addEventListener('click', () => { s.saveState = 'unsaved'; saveNow(b, s); });
    const list = document.getElementById('alist');
    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-state]');
      if (!btn) return;
      const card = btn.closest('[data-q]');
      const q = qs.find(x => x.id === card.dataset.q);
      const st = btn.dataset.state;
      const prev = s.answers[q.id];
      if (st === 'skip') delete s.answers[q.id];
      else s.answers[q.id] = { state: st, text: prev ? prev.text : '', q: prev && prev.q ? prev.q : questionKey(q) };
      card.querySelectorAll('[data-state]').forEach(x => x.setAttribute('aria-pressed', x === btn));
      const ta = card.querySelector('[data-text]');
      ta.hidden = st !== 'answer';
      if (st === 'answer') ta.focus();
      showWarning(card, st === 'answer' ? ta.value : '');
      progress();
      touch();
    });
    list.addEventListener('input', e => {
      if (!e.target.matches('[data-text]')) return;
      const card = e.target.closest('[data-q]');
      const a = s.answers[card.dataset.q];
      if (!a) return;
      a.text = e.target.value;
      showWarning(card, a.text);
      touch();
    });
    const reviewed = app.querySelector('[data-reviewed]');
    if (reviewed) {
      reviewed.addEventListener('click', () => {
        for (const q of answerQuestions(b, s)) if (s.answers[q.id]) s.answers[q.id].q = questionKey(q);
        s.clarVersion = b.clar.meta.version;
        touch();
        viewAnswer(b);
      });
    }
    document.getElementById('review').addEventListener('click', () => {
      state.reviewing.add(b.slug);
      viewAnswer(b);
    });
    const panel = document.getElementById('review-panel');
    panel.addEventListener('click', async e => {
      const goto = e.target.closest('[data-goto]');
      if (goto || e.target.closest('[data-back]')) {
        state.reviewing.delete(b.slug);
        await viewAnswer(b);
        if (goto) scrollToAnchor(`ans-${goto.dataset.goto}`);
        return;
      }
      const submitBtn = e.target.closest('[data-submit]');
      if (!submitBtn) return;
      submitBtn.disabled = true;
      try {
        const file = await submitSession(b, s);
        state.sessions.set(b.slug, emptySession());
        state.reviewing.delete(b.slug);
        toast(`Submitted as ${file}`);
        location.hash = `#/s/${enc(b.slug)}/questions`;
        await refresh();
      } catch (err) {
        submitBtn.disabled = false;
        toast(err.message);
      }
    });
  });
}

function showWarning(card, text) {
  const el = card.querySelector('[data-warn]');
  const w = text ? answerWarning(text) : null;
  el.hidden = !w;
  el.classList.toggle('error', !!(w && w.error));
  el.textContent = w ? w.msg : '';
}

async function submitSession(b, s) {
  const payload = {
    subject: b.slug,
    answeredBy: s.answeredBy.trim(),
    clarVersion: s.clarVersion || b.clar.meta.version,
    answers: [],
    dontKnow: [],
  };
  for (const q of answerQuestions(b, s)) {
    const a = s.answers[q.id];
    if (!a) continue;
    if (a.state === 'dontknow') payload.dontKnow.push({ id: q.id, title: q.title });
    else if (a.text.trim()) payload.answers.push({ id: q.id, title: q.title, question: questionText(q), answer: a.text });
  }
  clearTimeout(s.timer);
  await s.chain;  // let a save in progress finish, so it can't recreate the draft afterwards
  const r = await api('/api/submit', payload);
  return r.file;
}

function docHead(b, d, mode) {
  const meta = [d.meta.version && `v${d.meta.version}`, d.meta.status, d.meta.date].filter(Boolean).map(escapeHtml).join(' · ');
  const summaries = b.docs.filter(x => x.kind === 'summary');
  const versions = d.kind === 'summary' && summaries.length > 1
    ? `<span class="versions">Versions: ${summaries.map(s => (s.id === d.id
      ? `<strong>${escapeHtml(s.version)}</strong>`
      : `<a href="${docRoute(b.slug, s.id)}">${escapeHtml(s.version)}</a>`)).join(' ')}</span>` : '';
  return `<div class="doc-head">
    <div><strong>${escapeHtml(d.label)}</strong> <span class="muted">${meta}</span> ${versions}
      <div class="mono small muted">${escapeHtml(d.path)} · modified ${fmtDate(d.mtime)}</div></div>
    <div class="seg" role="group" aria-label="View">
      <a href="${docRoute(b.slug, d.id)}"${mode === 'doc' ? ' aria-current="page"' : ''}>Rendered</a>
      <a href="${rawRoute(b.slug, d.id)}"${mode === 'raw' ? ' aria-current="page"' : ''}>Source</a>
    </div></div>`;
}

function viewDoc(b, d, anchor, opts) {
  const key = `doc:${b.slug}:${d.id}:${b.sig}`;
  if (state.view === key && !opts.keepScroll) { scrollToAnchor(anchor); return; }
  setCrumbs([[b.slug, `#/s/${enc(b.slug)}`], [d.label]]);
  const toc = d.toc.length ? `<aside class="toc"><details open><summary>Contents</summary><ol>
      ${d.toc.map(t => `<li class="l${t.level}"><a href="${docRoute(b.slug, d.id, t.id)}" data-toc="${t.id}">${escapeHtml(t.text)}</a></li>`).join('')}
    </ol></details></aside>` : '';
  const y = window.scrollY;
  render(key, `<div class="page wide">${subjectHeader(b, d.kind === 'summary' ? 'summary' : d.id)}
    <div class="doc-layout${toc ? '' : ' no-toc'}">${toc}
    <article class="doc">${docHead(b, d, 'doc')}<div class="md" id="md">${d.html}</div></article></div></div>`, b, () => {
    bindSearch(b);
    app.querySelectorAll('a[data-frag]').forEach(a => { a.href = docRoute(b.slug, d.id, a.dataset.frag); });
    if (window.matchMedia('(max-width: 900px)').matches) app.querySelector('.toc details')?.removeAttribute('open');
    if (opts.keepScroll) window.scrollTo(0, y); else if (anchor) scrollToAnchor(anchor); else window.scrollTo(0, 0);
    trackToc();
  });
}

function viewRaw(b, d, line, opts) {
  const key = `raw:${b.slug}:${d.id}:${b.sig}`;
  if (state.view === key && !opts.keepScroll) { scrollToAnchor(line ? `L${line}` : ''); return; }
  setCrumbs([[b.slug, `#/s/${enc(b.slug)}`], [d.label, docRoute(b.slug, d.id)], ['Source']]);
  const lines = d.text.replace(/\r\n?/g, '\n').split('\n');
  const html = lines.map((l, k) => `<span class="line" id="L${k + 1}"><a class="ln" href="${rawRoute(b.slug, d.id, k + 1)}">${k + 1}</a>${escapeHtml(l) || ' '}</span>`).join('');
  const y = window.scrollY;
  state.view = key;
  state.subject = b;
  app.innerHTML = `<div class="page wide">${subjectHeader(b, d.kind === 'summary' ? 'summary' : d.id)}
    <article class="doc">${docHead(b, d, 'raw')}<pre class="raw">${html}</pre></article></div>`;
  bindSearch(b);
  if (opts.keepScroll) window.scrollTo(0, y); else if (line) scrollToAnchor(`L${line}`); else window.scrollTo(0, 0);
}

function viewSearch(b, q) {
  setCrumbs([[b.slug, `#/s/${enc(b.slug)}`], ['Search']]);
  const needle = q.trim().toLowerCase();
  let body = '';
  if (needle.length < 2) {
    body = '<p class="muted">Type at least two characters.</p>';
  } else {
    const idHit = b.ids.get(q.trim().toUpperCase());
    if (idHit) {
      body += `<p class="note">${idLink(b, idHit.id)} is defined in ${idHit.defs.map(x => `<a href="${docRoute(b.slug, x.doc.id, x.anchor)}">${escapeHtml(x.doc.label)}</a>`).join(', ')}.</p>`;
    }
    let total = 0;
    for (const d of b.docs) {
      const anchors = headingAnchors(d.text);
      const hits = [];
      d.text.split(/\r?\n/).forEach((line, k) => {
        if (hits.length >= 100 || !line.toLowerCase().includes(needle)) return;
        let sec = null;
        for (const a of anchors) { if (a.line <= k + 1) sec = a; else break; }
        const text = plain(line.replace(/^\s*(#+|>|[-*+]|\d+[.)])\s+/, '').replace(/^\s*\||\|\s*$/g, ''));
        hits.push({ line: k + 1, text, sec });
      });
      if (!hits.length) continue;
      total += hits.length;
      body += `<section class="panel"><h2>${escapeHtml(d.label)} <span class="muted small">${hits.length}${hits.length >= 100 ? '+' : ''} match${hits.length === 1 ? '' : 'es'}</span></h2>
        <ol class="hits">${hits.map(h => `<li>
          <div><a href="${docRoute(b.slug, d.id, h.sec && h.sec.id)}">${escapeHtml(h.sec ? h.sec.text : d.label)}</a>
          <a class="muted small" href="${rawRoute(b.slug, d.id, h.line)}">line ${h.line}</a></div>
          <div class="snippet">${snippet(h.text, needle)}</div></li>`).join('')}</ol></section>`;
    }
    if (!total && !idHit) body += '<p class="muted">No matches.</p>';
  }
  render(`search:${b.slug}:${q}`, `<div class="page">${subjectHeader(b, 'search')}<h2 class="sr">Search results</h2>${body}</div>`, b, () => bindSearch(b));
}

function snippet(text, needle) {
  const at = text.toLowerCase().indexOf(needle);
  const from = Math.max(0, at - 90);
  const s = text.slice(from, at + needle.length + 150);
  const lower = s.toLowerCase();
  let out = from ? '…' : '';
  let pos = 0;
  for (let k = lower.indexOf(needle); k >= 0; k = lower.indexOf(needle, pos)) {
    out += `${escapeHtml(s.slice(pos, k))}<mark>${escapeHtml(s.slice(k, k + needle.length))}</mark>`;
    pos = k + needle.length;
  }
  return out + escapeHtml(s.slice(pos)) + (from + s.length < text.length ? '…' : '');
}

function notFound() {
  setCrumbs([]);
  render('404', '<div class="page"><h1>Not found</h1><p>That subject or document isn\'t in the workspace. <a href="#/">All subjects</a></p></div>');
}

// ------------------------------------------------------------- enhancement

function enhance(root, b) {
  root.querySelectorAll('a[data-rel]').forEach(a => {
    const [p, frag] = a.dataset.rel.split('#');
    const hit = p ? findDoc(p, b) : null;
    if (hit) a.href = docRoute(hit.slug, hit.doc.id, frag);
    else { a.classList.add('dead'); a.title = 'Not found in this workspace'; }
    a.removeAttribute('data-rel');
  });
  // Code spans that name a workspace document, optionally with a line: `file.md:12`.
  root.querySelectorAll('code').forEach(c => {
    if (c.closest('pre, a')) return;
    const m = c.textContent.match(/^([\w./\\-]+\.md)(?::(\d+)(?:[-–]\d+)?)?$/);
    const hit = m && findDoc(m[1], b);
    if (!hit) return;
    const a = document.createElement('a');
    a.href = m[2] ? rawRoute(hit.slug, hit.doc.id, m[2]) : docRoute(hit.slug, hit.doc.id);
    a.className = 'doclink';
    c.replaceWith(a);
    a.appendChild(c);
  });
  linkText(root, b);
}

function linkText(root, b) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || p.closest('a, script, style, textarea, button') || (p.closest('code') && !p.closest('pre'))) {
        return NodeFilter.FILTER_REJECT;
      }
      return TEXT_TEST.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const re = new RegExp(TEXT_SRC, 'g');
    const dc = n.parentElement.closest('.defcell');
    const selfId = dc && (dc.dataset.def || (dc.parentElement && dc.parentElement.dataset.def));
    const frag = document.createDocumentFragment();
    let last = 0;
    let changed = false;
    let m;
    while ((m = re.exec(n.data))) {
      let el = null;
      if (m[1]) {
        el = document.createElement('a');
        el.href = m[1];
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
        el.className = 'ext';
        el.textContent = m[1];
      } else if (m[2] !== selfId && b.ids.has(m[2])) {
        const e = b.ids.get(m[2]);
        el = document.createElement('a');
        el.className = 'idref';
        el.dataset.id = m[2];
        el.href = docRoute(b.slug, e.primary.doc.id, e.primary.anchor);
        el.textContent = m[2];
      }
      if (!el) continue;
      frag.append(n.data.slice(last, m.index), el);
      last = m.index + m[0].length;
      changed = true;
    }
    if (!changed) continue;
    frag.append(n.data.slice(last));
    n.replaceWith(frag);
  }
}

function scrollToAnchor(anchor) {
  if (!anchor) return;
  const el = document.getElementById(anchor);
  if (!el) return;
  const target = el.classList.contains('anchor') ? el.parentElement : el;
  target.scrollIntoView({ block: el.classList.contains('line') ? 'center' : 'start' });
  target.classList.remove('flash');
  void target.offsetWidth;
  target.classList.add('flash');
}

let tocHandler = null;
function trackToc() {
  if (tocHandler) window.removeEventListener('scroll', tocHandler);
  const links = [...app.querySelectorAll('[data-toc]')];
  if (!links.length) { tocHandler = null; return; }
  const heads = links.map(a => document.getElementById(a.dataset.toc)).filter(Boolean);
  let pending = false;
  tocHandler = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      let cur = heads[0];
      for (const h of heads) { if (h.getBoundingClientRect().top < 120) cur = h; else break; }
      links.forEach(a => a.classList.toggle('active', cur && a.dataset.toc === cur.id));
    });
  };
  window.addEventListener('scroll', tocHandler, { passive: true });
  tocHandler();
}

// ------------------------------------------------------------------ tooltip

const tip = document.getElementById('tip');

function showTip(a) {
  const b = state.subject;
  const e = b && b.ids.get(a.dataset.id);
  if (!e) return;
  const def = e.primary;
  const fields = def.fields.slice(1).filter(([, v]) => v).slice(0, 8);
  const lead = def.fields[0] && def.fields[0][0] === '' ? def.fields[0][1] : '';
  const trunc = s => (s.length > 260 ? `${s.slice(0, 257)}…` : s);
  const elsewhere = e.defs.filter(x => x !== def).map(x => x.doc.label);
  tip.innerHTML = `<div class="tip-h"><strong>${e.id}</strong>${lead ? ` ${escapeHtml(lead)}` : ''}
      <span class="muted small">${escapeHtml(def.doc.label)}</span></div>
    <dl>${fields.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(trunc(v))}</dd>`).join('')}</dl>
    ${elsewhere.length ? `<div class="muted small">Also listed in: ${escapeHtml([...new Set(elsewhere)].join(', '))}</div>` : ''}`;
  tip.hidden = false;
  const r = a.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  const top = r.bottom + 6 + h < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

document.addEventListener('mouseover', e => {
  const a = e.target.closest && e.target.closest('a.idref');
  if (a) showTip(a); else if (!e.target.closest || !e.target.closest('#tip')) tip.hidden = true;
});
document.addEventListener('focusin', e => {
  const a = e.target.closest && e.target.closest('a.idref');
  if (a) showTip(a); else tip.hidden = true;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') tip.hidden = true; });
window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

// ---------------------------------------------------------- router and live

async function route(opts = {}) {
  tip.hidden = true;
  state.keepScroll = !!opts.keepScroll;
  const hash = location.hash.slice(1) || '/';
  const [path, query = ''] = hash.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  try {
    if (!state.index) {
      state.index = await fetchIndex();
      state.sig = indexSig(state.index);
    }
    if (!parts.length) return await viewHome();
    if (parts[0] === 's' && parts[1]) {
      const b = await buildSubject(parts[1]);
      if (!b) return notFound();
      const sub = parts[2] || '';
      if (!sub) return viewOverview(b);
      if (sub === 'questions' && b.clar) return viewQuestions(b);
      if (sub === 'answer' && b.clar) return await viewAnswer(b);
      if (sub === 'search') return viewSearch(b, params.get('q') || '');
      const d = b.docs.find(x => x.id === parts[3]);
      if (d && sub === 'doc') return viewDoc(b, d, params.get('a'), opts);
      if (d && sub === 'raw') return viewRaw(b, d, +params.get('line') || 0, opts);
    }
    return notFound();
  } catch (err) {
    state.view = 'error';
    app.innerHTML = `<div class="page"><p class="error">${escapeHtml(err.message)}</p></div>`;
  }
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4000);
}

async function poll() {
  const live = document.getElementById('live');
  try {
    const idx = await fetchIndex();
    live.classList.remove('off');
    live.textContent = 'Live';
    const sig = indexSig(idx);
    if (sig === state.sig) return;
    // Don't re-render under someone typing; the next poll retries.
    if (document.activeElement && document.activeElement.matches('input, textarea')) return;
    const before = new Map((state.index ? state.index.subjects : []).flatMap(s => s.docs.map(d => [d.path, d.mtime])));
    const changed = idx.subjects.flatMap(s => s.docs).filter(d => before.get(d.path) !== d.mtime).map(d => d.name);
    state.index = idx;
    state.sig = sig;
    await route({ keepScroll: true });
    toast(changed.length ? `Updated: ${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ` and ${changed.length - 3} more` : ''}` : 'Documents changed');
  } catch {
    live.classList.add('off');
    live.textContent = 'Offline';
  }
}

// -------------------------------------------------------------------- theme

const THEMES = ['auto', 'light', 'dark'];
function applyTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.getElementById('theme').textContent = t[0].toUpperCase() + t.slice(1);
}
let theme = 'auto';
try { theme = localStorage.getItem('ab-theme') || 'auto'; } catch { /* storage unavailable */ }
if (!THEMES.includes(theme)) theme = 'auto';
applyTheme(theme);
document.getElementById('theme').addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  applyTheme(theme);
  try { localStorage.setItem('ab-theme', theme); } catch { /* storage unavailable */ }
});

window.addEventListener('hashchange', () => { flushSave(); route(); });
window.addEventListener('pagehide', flushSave);
route();
setInterval(poll, 4000);
