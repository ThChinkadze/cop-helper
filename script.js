const SHEET_ID = '1ECGNHLbqR8KuPV_QH1E0SO8mGUOm4WIYP-hWWR5PZ-U'; 
const SHEET_NAME = encodeURIComponent('База данных'); 
const TIMEOUT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${SHEET_NAME}&headers=0`;

let parsedDatabase = [];
let currentCode = "uk";
// Загружаем состояние из памяти браузера
let isCompact = localStorage.getItem('isCompact') === 'true';

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

// Функция переключения вида
function toggleView() {
    isCompact = !isCompact;
    localStorage.setItem('isCompact', isCompact);
    const container = document.getElementById('articlesContainer');
    container.classList.toggle('compact-mode', isCompact);
    renderArticles();
}

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
                type: getVal(9),   
                tags: getVal(10)   
            });
        });

        // Применяем класс при загрузке
        if (isCompact) document.getElementById('articlesContainer').classList.add('compact-mode');
        renderArticles();
    } catch (e) { console.error(e); }
}

function renderArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = "";
    const filterText = document.getElementById('searchInput').value.toLowerCase().trim();
    const isSearching = filterText.length > 0;

    let searchWords = isSearching ? filterText.split(/\s+/).filter(w => w.length > 1) : [];
    let matchedArticles = [];

    parsedDatabase.forEach(article => {
        if (!isSearching && article.code !== currentCode) return;
        let matchScore = 0;
        if (isSearching) {
            const searchableText = `${article.num} ${article.title} ${article.desc} ${article.tags}`.toLowerCase();
            searchWords.forEach(word => { if (searchableText.includes(word)) matchScore += 1; });
            if (matchScore === 0) return;
        }
        matchedArticles.push({ article, matchScore });
    });

    matchedArticles.sort((a, b) => b.matchScore - a.matchScore);

    const highlightText = (text) => {
        if (!isSearching) return text;
        let result = text;
        searchWords.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            result = result.replace(regex, '<span class="highlight">$1</span>');
        });
        return result;
    };

    let count = 0;
    matchedArticles.forEach(item => {
        const article = item.article;
        count++;

        if (isCompact) {
            // КОМПАКТНЫЙ РЕЖИМ (Таблица)
            const row = document.createElement('div');
            row.className = "compact-row";
            row.innerHTML = `
                <div class="row-header">
                    <div>${article.num}</div>
                    <div style="font-size:12px; color:#636366;">${article.type || '-'}</div>
                    <div style="font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${article.title}</div>
                    <div style="color:var(--stars)">${article.stars || '-'}</div>
                    <div>${article.fine || '-'}</div>
                    <div>${article.arrest || '-'}</div>
                    <div>${article.felony || '-'}</div>
                </div>
                <div class="row-details">
                    <p><b>Описание:</b><br>${highlightText(article.desc).replace(/\n/g, '<br>')}</p>
                    <p><b>Теги:</b> <em>${article.tags || 'нет'}</em></p>
                </div>
            `;
            row.onclick = () => row.querySelector('.row-details').classList.toggle('active');
            container.appendChild(row);
        } else {
            // ОБЫЧНЫЙ РЕЖИМ (Карточки)
            const card = document.createElement('div');
            card.className = `card ${article.code}`;
            const typeHtml = (article.code === 'uk' && article.type && article.type !== '-') ? `<div class="article-type">${article.type}</div>` : '';
            card.innerHTML = `
                <div class="card-header">
                    <div class="title">${highlightText(article.title)}</div>
                    <div class="card-header-right">${typeHtml}<div class="article-num">ст. ${highlightText(article.num)}</div></div>
                </div>
                <div class="info-table">
                    <div class="info-row"><div class="info-label">Штраф</div><div class="info-val">${article.fine || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Розыск</div><div class="info-val">${article.stars || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Арест</div><div class="info-val">${article.arrest || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Судимость</div><div class="info-val ${article.felony.toLowerCase().includes('судимость') ? 'danger' : ''}">${article.felony || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Доп. мера</div><div class="info-val">${article.extraMeasure || '—'}</div></div>
                </div>
                <div class="desc">${highlightText(article.desc).replace(/\n/g, '<br>')}</div>
            `;
            container.appendChild(card);
        }
    });
}

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCode = e.target.getAttribute('data-code');
    const searchInput = document.getElementById('searchInput');
    if (searchInput.value !== "") searchInput.value = "";
    renderArticles();
}));

document.getElementById('searchInput').addEventListener('input', renderArticles);
loadData();
