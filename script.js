document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    
    // Проверяем, что данные загружены
    if (typeof okved2Data === 'undefined') {
        console.error('❌ Данные ОКВЭД2 не загружены! Проверьте файл data.js');
        resultsContainer.innerHTML = '<div class="no-results">Ошибка загрузки данных</div>';
        return;
    }
    
    // Добавляем уникальные ID
    const dataWithIds = okved2Data.map((item, index) => ({
        ...item,
        id: index.toString()
    }));
    
    console.log(`✅ Данные ОКВЭД2 загружены. Записей: ${dataWithIds.length}`);
    console.log(`📊 Статистика: Разделы: A-U (${new Set(dataWithIds.map(d => d.section)).size}), ` +
                `Уровни: ${dataWithIds.filter(d => d.level === 'class').length} классов, ` +
                `${dataWithIds.filter(d => d.level === 'subclass').length} подклассов, ` +
                `${dataWithIds.filter(d => d.level === 'group').length} групп`);
    
    // Обработчики популярных запросов
    document.querySelectorAll('.query-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const query = this.textContent.trim();
            searchInput.value = query;
            searchInput.focus();
            
            // Запускаем поиск
            clearTimeout(searchTimeout);
            const results = performSearch(query);
            displayResults(results, query);
        });
    });
    
    // Основная функция поиска для ОКВЭД2
    function performSearch(query) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery || trimmedQuery.length < 2) return [];
        
        // Если запрос содержит цифры И (начинается с цифры ИЛИ содержит точку)
        // Считаем, что это поиск по коду ОКВЭД
        const hasDigits = /\d/.test(trimmedQuery);
        const startsWithDigitOrHasDot = /^\d|\./.test(trimmedQuery);
        
        if (hasDigits && startsWithDigitOrHasDot) {
            // ПОИСК ПО КОДУ ОКВЭД: оставляем цифры, точки и удаляем все остальное
            const cleanQuery = trimmedQuery.replace(/[^\d\.]/g, '');
            
            // Ищем все записи, чей код НАЧИНАЕТСЯ с cleanQuery
            return dataWithIds.filter(item => {
                return item.code.startsWith(cleanQuery);
            });
        }
        // Иначе - поиск по названию вида деятельности
        else {
            const searchLower = trimmedQuery.toLowerCase();
            const words = searchLower.split(/\s+/).filter(w => w.length > 0);
            
            if (words.length === 0) return [];
            
            // Для ОКВЭД2 можно добавить синонимы для популярных запросов
            const synonyms = getSynonyms(searchLower);
            
            return dataWithIds.filter(item => {
                const nameLower = item.name.toLowerCase();
                const searchText = item.search_text || nameLower;
                
                // Проверяем основную фразу
                if (words.length === 1) {
                    const word = words[0];
                    if (nameLower.includes(word)) return true;
                    // Проверяем синонимы
                    if (synonyms && synonyms.some(synonym => nameLower.includes(synonym))) return true;
                    return false;
                } else if (words.length > 1) {
                    // Все слова должны быть в названии
                    const allWordsMatch = words.every(word => searchText.includes(word));
                    if (allWordsMatch) return true;
                    
                    // Или хотя бы одно слово с синонимами
                    if (synonyms && synonyms.some(synonym => nameLower.includes(synonym))) return true;
                    return false;
                }
                return false;
            });
        }
    }
    
    // Синонимы для популярных запросов ОКВЭД2
    function getSynonyms(query) {
        const synonymMap = {
            'кафе': ['ресторан', 'общепит', 'питание'],
            'ресторан': ['кафе', 'общепит', 'столовая'],
            'строитель': ['строительство', 'ремонт', 'монтаж'],
            'перевозк': ['транспорт', 'груз', 'доставка', 'логистик'],
            'торговл': ['продаж', 'розничн', 'оптов'],
            'услуг': ['сервис', 'обслуживан'],
            'аренд': ['прокат', 'лизинг'],
            'консульта': ['консалтинг', 'совет', 'помощь'],
            'образован': ['обучен', 'курс', 'тренинг'],
            'медицин': ['здоров', 'лечен', 'больниц']
        };
        
        for (const [key, synonyms] of Object.entries(synonymMap)) {
            if (query.includes(key)) {
                return synonyms;
            }
        }
        return null;
    }
    
    // Функция отображения результатов для ОКВЭД2
    function displayResults(results, query) {
        const resultsContainer = document.getElementById('resultsContainer');
        
        // Показываем контейнер с результатами ТОЛЬКО если есть запрос и результаты
        if ((!query || query.length < 2) && results.length === 0) {
            resultsContainer.style.display = 'none';
            return;
        }
        
        // Если дошли сюда - показываем контейнер
        resultsContainer.style.display = 'block';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    По запросу "<strong>${escapeHtml(query)}</strong>" ничего не найдено.<br>
                    Попробуйте:
                    <ul style="text-align:left;display:inline-block;margin-top:10px">
                        <li>Упростить запрос (например, "кафе" вместо "кафе и рестораны")</li>
                        <li>Проверить, что все слова написаны правильно</li>
                        <li>Использовать код ОКВЭД (например, "56.10")</li>
                    </ul>
                </div>
            `;
            return;
        }
        
        // Сортируем результаты для ОКВЭД2
        const sortedResults = sortOkvedResults(results, query);
        
        // Показываем первые 50 результатов
        const displayResults = sortedResults.slice(0, 50);
        
        const resultsHtml = displayResults.map(item => `
            <div class="result-item">
                <div class="result-code-container">
                    <span class="result-code">${highlightMatch(item.code, query)}</span>
                    <span class="result-level ${item.level}" title="${getLevelDescription(item.level)}">
                        ${getLevelShort(item.level)}
                    </span>
                    
                    <!-- Кнопка копирования -->
                    <button class="copy-btn" data-code="${item.code}" title="Копировать код ОКВЭД">
                        📋
                    </button>
                    
                    <!-- Ссылка на КонсультантПлюс -->
                    <a href="https://www.consultant.ru/search/?q=оквэд2+${encodeURIComponent(item.code)}" 
                    class="source-link consultant-link" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title="Найти в КонсультантПлюс">
                        ⚖️
                    </a>
                    
                    <!-- Ссылка на ГАРАНТ -->
                    <a href="https://ivo.garant.ru/#/basesearch/оквэд%20${encodeURIComponent(item.code)}" 
                    class="source-link garant-link" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title="Найти в системе ГАРАНТ">
                        🏛️
                    </a>
                </div>
                <div class="result-name">${highlightMatch(item.name, query)}</div>
                ${item.section ? `<div class="result-section">Раздел ${item.section}</div>` : ''}
            </div>
        `).join('');
        
        resultsContainer.innerHTML = `
            <div class="results-count">
                По запросу "<strong>${escapeHtml(query)}</strong>" найдено: <strong>${results.length}</strong> записей 
                ${results.length > 50 ? `(показано: ${displayResults.length})` : ''}
            </div>
            ${resultsHtml}
            ${results.length > 50 ? 
                `<div class="more-results">И ещё ${results.length - 50} записей... 
                 <button id="showAllBtn" class="show-all-btn">Показать все</button></div>` 
                : ''}
        `;
        
        // Добавляем обработчик кнопки "Показать все"
        if (results.length > 50) {
            document.getElementById('showAllBtn').addEventListener('click', function() {
                const allResultsHtml = sortedResults.map(item => `
                    <div class="result-item">
                        <div class="result-code-container">
                            <span class="result-code">${highlightMatch(item.code, query)}</span>
                            <span class="result-level ${item.level}" title="${getLevelDescription(item.level)}">
                                ${getLevelShort(item.level)}
                            </span>
                            
                            <button class="copy-btn" data-code="${item.code}" title="Копировать код ОКВЭД">
                                📋
                            </button>
                            
                            <a href="https://www.consultant.ru/search/?q=оквэд2+${encodeURIComponent(item.code)}" 
                            class="source-link consultant-link" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="Найти в КонсультантПлюс">
                                ⚖️
                            </a>
                            
                            <a href="https://ivo.garant.ru/#/basesearch/оквэд%20${encodeURIComponent(item.code)}" 
                            class="source-link garant-link" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="Найти в системе ГАРАНТ">
                                🏛️
                            </a>
                        </div>
                        <div class="result-name">${highlightMatch(item.name, query)}</div>
                        ${item.section ? `<div class="result-section">Раздел ${item.section}</div>` : ''}
                    </div>
                `).join('');
                
                resultsContainer.innerHTML = `
                    <div class="results-count">
                        По запросу "<strong>${escapeHtml(query)}</strong>" найдено: <strong>${results.length}</strong> записей
                    </div>
                    ${allResultsHtml}
                `;
                
                // Перепривязываем обработчики копирования
                setupCopyButtons();
            });
        }
        
        // Инициализируем кнопки копирования
        setupCopyButtons();
    }
    
    // Специальная сортировка для ОКВЭД2
    function sortOkvedResults(results, query) {
        const queryLower = query.toLowerCase();
        const hasDigits = /\d/.test(query);
        const startsWithDigitOrHasDot = /^\d|\./.test(query);
        const isCodeSearch = hasDigits && startsWithDigitOrHasDot;
        const cleanQuery = isCodeSearch ? query.replace(/[^\d\.]/g, '') : '';
        
        return [...results].sort((a, b) => {
            // Если поиск по коду
            if (isCodeSearch) {
                // Приоритет 1: точное совпадение кода
                if (a.code === cleanQuery) return -1;
                if (b.code === cleanQuery) return 1;
                
                // Приоритет 2: коды той же длины или короче
                const aDiff = Math.abs(a.code.length - cleanQuery.length);
                const bDiff = Math.abs(b.code.length - cleanQuery.length);
                if (aDiff !== bDiff) return aDiff - bDiff;
                
                // Приоритет 3: более короткие коды (более общие) выше
                return a.code.length - b.code.length;
            }
            // Если поиск по названию
            else {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // Приоритет 1: слово начинается с запроса
                const aStartsWith = aName.startsWith(queryLower) ? 2 : 0;
                const bStartsWith = bName.startsWith(queryLower) ? 2 : 0;
                
                // Приоритет 2: название содержит запрос целиком
                const aContains = aName.includes(queryLower) ? 1 : 0;
                const bContains = bName.includes(queryLower) ? 1 : 0;
                
                // Приоритет 3: более высокий уровень (более общие категории выше)
                const levelPriority = { 'section': 3, 'class': 2, 'subclass': 1, 'group': 0 };
                const aLevel = levelPriority[a.level] || 0;
                const bLevel = levelPriority[b.level] || 0;
                
                const aScore = aStartsWith + aContains + aLevel;
                const bScore = bStartsWith + bContains + bLevel;
                
                if (bScore !== aScore) return bScore - aScore;
                
                // Приоритет 4: более короткие названия
                return aName.length - bName.length;
            }
        });
    }
    
    // Вспомогательные функции для уровней
    function getLevelDescription(level) {
        const descriptions = {
            'section': 'Раздел (A-U)',
            'class': 'Класс (XX)',
            'subclass': 'Подкласс (XX.X)',
            'group': 'Группа (XX.XX)'
        };
        return descriptions[level] || 'Неизвестный уровень';
    }
    
    function getLevelShort(level) {
        const shorts = {
            'section': 'Р',
            'class': 'К',
            'subclass': 'ПК',
            'group': 'Г'
        };
        return shorts[level] || '?';
    }
    
    // Подсветка совпадений (улучшенная для ОКВЭД2)
    function highlightMatch(text, query) {
        if (!query || query.length < 2) return escapeHtml(text);
        
        const escapedText = escapeHtml(text);
        
        // Если это похоже на поиск по коду (цифры и/или точки)
        const hasDigits = /\d/.test(query);
        const startsWithDigitOrHasDot = /^\d|\./.test(query);
        
        if (hasDigits && startsWithDigitOrHasDot) {
            const cleanQuery = query.replace(/[^\d\.]/g, '');
            if (text.startsWith(cleanQuery)) {
                return `<mark class="code-match">${escapeHtml(cleanQuery)}</mark>${escapeHtml(text.substring(cleanQuery.length))}`;
            }
            // Также подсвечиваем части кода, если они есть
            const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return escapedText.replace(regex, '<mark class="code-match">$1</mark>');
        }
        
        // Подсветка для текстового поиска
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        let highlighted = escapedText;
        
        words.forEach(word => {
            if (word.length < 2) return;
            // Ищем точное слово (с границами слова)
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        
        return highlighted;
    }
    
    // Escape HTML для безопасности
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Обработчик ввода с дебаунсингом
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (!query) {
            resultsContainer.innerHTML = '<div class="initial-message">Введите код или вид деятельности для поиска</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        
        // Дебаунсинг: ждём 200мс после последнего ввода
        searchTimeout = setTimeout(() => {
            const results = performSearch(query);
            displayResults(results, query);
        }, 200);
    });
    
    // Обработчик клавиши Enter для мгновенного поиска
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            const results = performSearch(query);
            displayResults(results, query);
        }
    });
    
    // Функция копирования кода в буфер обмена
    function setupCopyButtons() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            // Удаляем старые обработчики
            btn.replaceWith(btn.cloneNode(true));
        });
        
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const codeToCopy = this.getAttribute('data-code');
                copyToClipboard(codeToCopy, this);
            });
        });
    }
    
    // Основная функция копирования
    function copyToClipboard(text, button) {
        const originalHtml = button.innerHTML;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showCopyFeedback(button, '✅');
                    setTimeout(() => {
                        button.innerHTML = originalHtml;
                    }, 1500);
                })
                .catch(err => {
                    console.error('Ошибка копирования:', err);
                    fallbackCopy(text, button, originalHtml);
                });
        } else {
            fallbackCopy(text, button, originalHtml);
        }
    }
    
    // Fallback метод копирования
    function fallbackCopy(text, button, originalHtml) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopyFeedback(button, '✅');
            } else {
                showCopyFeedback(button, '❌');
            }
        } catch (err) {
            console.error('Ошибка fallback копирования:', err);
            showCopyFeedback(button, '❌');
        } finally {
            document.body.removeChild(textArea);
            setTimeout(() => {
                button.innerHTML = originalHtml;
            }, 1500);
        }
    }
    
    // Показ обратной связи
    function showCopyFeedback(button, icon) {
        button.innerHTML = icon;
        button.classList.add('copied');
        setTimeout(() => {
            button.classList.remove('copied');
        }, 1500);
    }
    
    // Инициализация кнопок копирования
    setupCopyButtons();
    
    // Показ начального сообщения
    resultsContainer.innerHTML = '<div class="initial-message">Введите код ОКВЭД или вид деятельности для поиска</div>';
    resultsContainer.style.display = 'block';
    
    // Логирование готовности
    console.log('✅ Справочник ОКВЭД2 инициализирован. Готов к поиску!');
});