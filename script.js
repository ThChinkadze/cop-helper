const SHEET_ID = '1ECGNHLbqR8KuPV_QH1E0SO8mGUOm4WIYP-hWWR5PZ-U'; 
const SHEET_NAME = encodeURIComponent('База данных'); 
const TIMEOUT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${SHEET_NAME}&headers=0`;

let parsedDatabase = [];
let currentCode = "uk";
let isCompact = false; // текущий режим отображения

const synonymsDictionary = [
    ["убийство", "убил", "убила", "зарезал", "пристрелил", "дм", "смерть", "лишение жизни"],
    ["оружие", "ствол", "пушка", "пистолет", "автомат", "ган", "вооружен", "патроны", "калибр"],
    ["транспорт", "машина", "тачка", "авто", "тс", "руль", "сбил", "дтп", "езда"],
    ["полицейский", "сотрудник", "коп", "гос", "мент", "пд", "фиб", "шериф", "при исполнении"],
    ["оскорбление", "оск", "мат", "послал", "обозвал", "унижение", "нецензурн"],
    ["взятка", "подкуп", "деньги", "бабки", "предложил"],
    ["наркотики", "нарко", "трава", "доза", "вещества", "сбыт"],
    ["ограбление", "грабеж", "украл", "вор", "кража", "обчистил", "похищение"],
    ["неподчинение", "игнор", "убежал", "скрылся", "отказ", "требовани"],
    ["документы", "паспорт", "айди", "лицензия", "док", "удостоверение"]
];

async function loadData() {
    try {
        const response = await fetch(TIMEOUT_URL);
        const text = await response.text();
        const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
        const rows = json.table.rows;

        parsedDatabase = [];
        rows.forEach((row) => {
            if (!row.c) return;
            const cells = row.c;
            const getVal = (idx) => (cells[idx] && (cells[idx].f || cells[idx].v !== null)) ? String(cells[idx].f || cells[idx].v).trim() : "";

            let rawCode = getVal(0).toUpperCase();
            if (rawCode === "КОДЕКС" || !{'UK':'uk','AK':'ak','DK':'dk'}[rawCode]) return;

            parsedDatabase.push({
                code: {'UK':'uk','AK':'ak','DK':'dk'}[rawCode],
                num: getVal(1),
                title: getVal(2) || (getVal(3).split(/[.\n]/)[0].trim() + '.'),
                desc: getVal(3) || getVal(2),
                stars: getVal(4),
                extraMeasure: getVal(5),
                fine: getVal(6),
                arrest: getVal(7),
                felony: getVal(8),
                type: getVal(9),   // Колонка J — Тип статьи (F / R / F/R / R/FIN)
                tags: getVal(10)   // Колонка K — Теги для поиска
            });
        });
        renderArticles();
    } catch (e) { console.error(e); }
}

/* Экранирование под regex (для безопасной подсветки) */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Экранирование HTML (для тегов) */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = "";
    const filterText = document.getElementById('searchInput').value.toLowerCase().trim();
    const isSearching = filterText.length > 0;

    let searchGroups = [];
    let highlightTerms = [];

    if (isSearching) {
        const queryWords = filterText.split(/\s+/);

        queryWords.forEach(word => {
            let currentGroup = [word];
            synonymsDictionary.forEach(group => {
                if (group.some(syn => syn.includes(word) || word.includes(syn))) {
                    currentGroup = currentGroup.concat(group);
                }
            });
            searchGroups.push([...new Set(currentGroup)]);
            highlightTerms = highlightTerms.concat(currentGroup);
        });
    }

    const highlightText = (text) => {
        if (!isSearching || !text) return text;
        let result = text;

        const uniqueTerms = [...new Set(highlightTerms)]
            .filter(t => t.length > 2 && t !== 'span' && t !== 'class')
            .sort((a, b) => b.length - a.length);

        uniqueTerms.forEach(term => {
            const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
            result = result.replace(regex, '<span class="highlight">$1</span>');
        });
        return result;
    };

    let count = 0;

    // Заголовок таблицы (только в компактном режиме)
    if (isCompact) {
        const head = document.createElement('div');
        head.className = 'compact-head';
        head.innerHTML = `
            <div class="ch-num">Статья</div>
            <div class="ch-type">Тип</div>
            <div class="ch-title">Заголовок</div>
            <div class="ch-stars">Розыск</div>
            <div class="ch-fine">Штраф</div>
            <div class="ch-arrest">Арест</div>
            <div class="ch-felony">Судимость</div>
        `;
        container.appendChild(head);
    }

    parsedDatabase.forEach(article => {
        if (!isSearching && article.code !== currentCode) return;

        let isMatch = true;

        if (isSearching) {
            // Теги тоже участвуют в поиске (это их прямое назначение)
            const searchableText = `${article.num} ${article.title} ${article.desc} ${article.tags}`.toLowerCase();
            isMatch = searchGroups.every(group =>
                group.some(term => searchableText.includes(term))
            );
        }

        if (isMatch) {
            count++;
            const card = document.createElement('div');
            card.className = `card ${article.code}`;

            const highlightedTitle = highlightText(article.title);
            const highlightedNum = highlightText(article.num);
            const highlightedDesc = highlightText(article.desc).replace(/\n/g, '<br>');

            const isFelonyDanger = article.felony.toLowerCase().includes('судимость');

            if (isCompact) {
                card.innerHTML = buildCompactRow(article, {
                    highlightedTitle, highlightedNum, highlightedDesc,
                    highlightText, isFelonyDanger
                });
            } else {
                card.innerHTML = buildCard(article, {
                    highlightedTitle, highlightedNum, highlightedDesc, isFelonyDanger
                });
            }

            container.appendChild(card);
        }
    });

    if (count === 0) {
        container.innerHTML = `<div class="loader">По запросу ничего не найдено. Попробуйте описать иначе.</div>`;
    }

    // Навешиваем аккордеон в компактном режиме
    if (isCompact) {
        bindAccordion(container);
    }
}

/* --------- Карточный режим --------- */
function buildCard(article, d) {
    return `
        <div class="card-header">
            <div class="title">${d.highlightedTitle}</div>
            <div class="article-num">ст. ${d.highlightedNum}</div>
        </div>
        <div class="info-table">
            <div class="info-row"><div class="info-label">Штраф</div><div class="info-val">${article.fine || '—'}</div></div>
            <div class="info-row"><div class="info-label">Розыск</div><div class="info-val">${article.stars || '—'}</div></div>
            <div class="info-row"><div class="info-label">Арест</div><div class="info-val">${article.arrest || '—'}</div></div>
            <div class="info-row"><div class="info-label">Судимость</div><div class="info-val ${d.isFelonyDanger ? 'danger' : ''}">${article.felony || '—'}</div></div>
            <div class="info-row"><div class="info-label">Доп. мера</div><div class="info-val">${article.extraMeasure || '—'}</div></div>
        </div>
        <div class="desc">${d.highlightedDesc}</div>
    `;
}

/* --------- Компактный (табличный) режим со строкой + аккордеоном --------- */
function buildCompactRow(article, d) {
    // Формируем список тегов
    let tagsHtml = '';
    if (article.tags && article.tags.trim()) {
        const tagArr = article.tags
            .split(/[,;]+|\s{2,}/)          // делим по запятой/точке с запятой/двойным пробелам
            .map(t => t.trim())
            .filter(Boolean);

        // Если разделителей не было — делим по одиночным пробелам
        const finalTags = tagArr.length > 1 ? tagArr : article.tags.split(/\s+/).map(t => t.trim()).filter(Boolean);

        tagsHtml = `
            <div class="tags-block">
                <div class="tags-label">Теги для поиска</div>
                <div class="tags-list">
                    ${finalTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                </div>
            </div>
        `;
    }

    // Компактная мета для мобильного вида
    const metaMobile = `
        <div class="c-meta">
            ${article.stars ? 'Розыск: ' + escapeHtml(article.stars) + ' · ' : ''}
            ${article.fine ? 'Штраф: ' + escapeHtml(article.fine) + ' · ' : ''}
            ${article.arrest ? 'Арест: ' + escapeHtml(article.arrest) : ''}
        </div>
    `;

    return `
        <div class="compact-row">
            <div class="c-num">${d.highlightedNum || '—'}</div>
            <div class="c-type ${article.type ? '' : 'c-muted'}">${article.type ? escapeHtml(article.type) : '—'}</div>
            <div class="c-title">${d.highlightedTitle}</div>
            <div class="c-stars ${article.stars ? '' : 'c-muted'}">${article.stars || '—'}</div>
            <div class="c-fine ${article.fine ? '' : 'c-muted'}">${article.fine || '—'}</div>
            <div class="c-arrest ${article.arrest ? '' : 'c-muted'}">${article.arrest || '—'}</div>
            <div class="c-felony ${d.isFelonyDanger ? 'danger' : ''} ${article.felony ? '' : 'c-muted'}">${article.felony || '—'}</div>
            ${metaMobile}
        </div>
        <div class="compact-panel">
            <div class="panel-inner">
                <p class="panel-desc">${d.highlightedDesc || '—'}</p>
                <div class="panel-info">
                    <span>Тип: <b>${article.type ? escapeHtml(article.type) : '—'}</b></span>
                    <span>Розыск: <b>${escapeHtml(article.stars) || '—'}</b></span>
                    <span>Штраф: <b>${escapeHtml(article.fine) || '—'}</b></span>
                    <span>Арест: <b>${escapeHtml(article.arrest) || '—'}</b></span>
                    <span>Судимость: <b>${escapeHtml(article.felony) || '—'}</b></span>
                    <span>Доп. мера: <b>${escapeHtml(article.extraMeasure) || '—'}</b></span>
                </div>
                ${tagsHtml}
            </div>
        </div>
    `;
}

/* --------- Аккордеон (одна открытая строка) --------- */
function bindAccordion(container) {
    container.querySelectorAll('.card').forEach(card => {
        const row = card.querySelector('.compact-row');
        if (!row) return;
        row.addEventListener('click', () => {
            const alreadyOpen = card.classList.contains('open');
            // Закрываем все прочие
            container.querySelectorAll('.card.open').forEach(c => {
                if (c !== card) c.classList.remove('open');
            });
            // Переключаем текущую
            card.classList.toggle('open', !alreadyOpen);
        });
    });
}

/* --------- Переключение режима отображения --------- */
function applyViewMode() {
    const container = document.getElementById('articlesContainer');
    container.classList.toggle('compact-mode', isCompact);
    document.body.classList.toggle('compact-active', isCompact);
}

document.getElementById('viewToggle').addEventListener('click', () => {
    isCompact = !isCompact;
    localStorage.setItem('portland_view_compact', isCompact ? '1' : '0');
    applyViewMode();
    renderArticles();
});

/* --------- Табы --------- */
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCode = e.target.getAttribute('data-code');

    const searchInput = document.getElementById('searchInput');
    if (searchInput.value !== "") {
        searchInput.value = "";
    }
    renderArticles();
}));

/* --------- Поиск --------- */
document.getElementById('searchInput').addEventListener('input', renderArticles);

/* --------- Инициализация --------- */
(function init() {
    // Восстанавливаем сохранённый режим
    isCompact = localStorage.getItem('portland_view_compact') === '1';
    applyViewMode();
    loadData();
})();
