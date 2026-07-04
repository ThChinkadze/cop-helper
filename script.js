const SHEET_ID = '1ECGNHLbqR8KuPV_QH1E0SO8mGUOm4WIYP-hWWR5PZ-U'; 
const SHEET_NAME = encodeURIComponent('База данных'); 
const TIMEOUT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${SHEET_NAME}&headers=0`;

let parsedDatabase = [];
let currentCode = "uk";

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
                felony: getVal(8), // Проверь, чтобы индексы совпадали с таблицей
                type: getVal(9),   // Тип статьи (F, R, F/R и т.д.)
                tags: getVal(10)   // Скрытые теги для поиска
            });
        });
        renderArticles();
    } catch (e) { console.error(e); }
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
            const regex = new RegExp(`(${term})`, 'gi');
            result = result.replace(regex, '<span class="highlight">$1</span>');
        });
        return result;
    };

    let count = 0;

    parsedDatabase.forEach(article => {
        if (!isSearching && article.code !== currentCode) return;

        let isMatch = true;

        if (isSearching) {
            // Добавили скрытые теги (article.tags) в строку для поиска
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

            // Логика отображения типа статьи (только для УК и если тип указан)
            let typeHtml = '';
            if (article.code === 'uk' && article.type) {
                typeHtml = `<div class="article-type">${article.type}</div>`;
            }

            card.innerHTML = `
                <div class="card-header">
                    <div class="title">${highlightedTitle}</div>
                    <div class="card-header-right">
                        ${typeHtml}
                        <div class="article-num">ст. ${highlightedNum}</div>
                    </div>
                </div>
                <div class="info-table">
                    <div class="info-row"><div class="info-label">Штраф</div><div class="info-val">${article.fine || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Розыск</div><div class="info-val">${article.stars || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Арест</div><div class="info-val">${article.arrest || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Судимость</div><div class="info-val ${article.felony.toLowerCase().includes('судимость') ? 'danger' : ''}">${article.felony || '—'}</div></div>
                    <div class="info-row"><div class="info-label">Доп. мера</div><div class="info-val">${article.extraMeasure || '—'}</div></div>
                </div>
                <div class="desc">${highlightedDesc}</div>
            `;
            container.appendChild(card);
        }
    });

    if (count === 0) {
        container.innerHTML = `<div class="loader">По запросу ничего не найдено. Попробуйте описать иначе.</div>`;
    }
}

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

document.getElementById('searchInput').addEventListener('input', renderArticles);
loadData();
