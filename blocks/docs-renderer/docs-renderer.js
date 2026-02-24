import { marked } from '../../scripts/lib/marked.esm.js';

const LANG_MAP = {
  js: 'javascript',
  ts: 'typescript',
  html: 'markup',
  xml: 'markup',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
};

function normalizeLang(lang) {
  if (!lang) return 'javascript';
  const l = lang.toLowerCase().trim();
  return LANG_MAP[l] || l;
}

async function loadPrism() {
  if (window.Prism) return window.Prism;
  const base = `${window.hlx.codeBasePath}/scripts/lib`;
  await import(`${base}/prism.min.js`);
  window.Prism.manual = true;

  const grammars = [
    'prism-markup.min.js',
    'prism-css.min.js',
    'prism-javascript.min.js',
    'prism-typescript.min.js',
    'prism-bash.min.js',
    'prism-json.min.js',
    'prism-yaml.min.js',
  ];
  await Promise.all(grammars.map((g) => import(`${base}/${g}`)));
  return window.Prism;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
}

function highlightCodeBlocks(container, Prism) {
  container.querySelectorAll('pre code').forEach((code) => {
    const cls = [...code.classList].find((c) => c.startsWith('language-'));
    const lang = normalizeLang(cls ? cls.replace('language-', '') : '');
    const grammar = Prism.languages[lang];
    if (grammar) {
      code.innerHTML = Prism.highlight(code.textContent, grammar, lang);
    }
    code.className = `language-${lang}`;
    code.parentElement.className = `language-${lang}`;
  });
}

function addCopyButtons(container) {
  container.querySelectorAll('pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.className = 'docs-copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      await navigator.clipboard.writeText(code.textContent);
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2000);
    });

    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

function addHeadingAnchors(container) {
  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    if (!h.id) h.id = slugify(h.textContent);
    const link = document.createElement('a');
    link.className = 'docs-anchor';
    link.href = `#${h.id}`;
    link.setAttribute('aria-hidden', 'true');
    link.textContent = '#';
    h.appendChild(link);
  });
}

function buildTOC(container) {
  const headings = container.querySelectorAll('h2, h3');
  if (headings.length < 3) return null;

  const toc = document.createElement('nav');
  toc.className = 'docs-toc';
  const title = document.createElement('div');
  title.className = 'docs-toc-title';
  title.textContent = 'On this page';
  toc.appendChild(title);

  const list = document.createElement('ul');
  headings.forEach((h) => {
    const li = document.createElement('li');
    li.className = h.tagName === 'H3' ? 'docs-toc-h3' : '';
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent.replace(/#$/, '').trim();
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${h.id}`);
    });
    li.appendChild(a);
    list.appendChild(li);
  });
  toc.appendChild(list);

  // highlight current section on scroll
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          toc.querySelectorAll('a').forEach((a) => a.classList.remove('active'));
          const match = toc.querySelector(`a[href="#${entry.target.id}"]`);
          if (match) match.classList.add('active');
        }
      });
    },
    { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
  );
  headings.forEach((h) => observer.observe(h));

  return toc;
}

export default async function decorate(block) {
  const slug = block.textContent.trim();
  if (!slug) return;

  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'docs-layout';

  const content = document.createElement('article');
  content.className = 'docs-content';

  const loading = document.createElement('div');
  loading.className = 'docs-loading';
  loading.textContent = 'Loading documentation...';
  content.appendChild(loading);
  wrapper.appendChild(content);
  block.appendChild(wrapper);

  try {
    const [resp, Prism] = await Promise.all([
      fetch(`${window.hlx.codeBasePath}/docs/${slug}.md`),
      loadPrism(),
    ]);

    if (!resp.ok) {
      loading.textContent = `Failed to load documentation (${resp.status})`;
      return;
    }

    const md = await resp.text();
    const html = marked.parse(md);

    content.innerHTML = html;

    highlightCodeBlocks(content, Prism);
    addCopyButtons(content);
    addHeadingAnchors(content);

    const toc = buildTOC(content);
    if (toc) wrapper.appendChild(toc);

    // scroll to hash if present
    const { hash } = window.location;
    if (hash) {
      const target = document.getElementById(hash.substring(1));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  } catch (err) {
    loading.textContent = 'Failed to load documentation';
    // eslint-disable-next-line no-console
    console.error('docs-renderer:', err);
  }
}
