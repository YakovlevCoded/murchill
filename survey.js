// ========================================
// МУРКОТЕКА SURVEY — Survey logic
// State machine, routing, submit
// ========================================

(function () {
    'use strict';

    // ---- TELEGRAM CONFIG ----
    const TG_BOT_TOKEN = '8085859253:AAGi59iLgCwAf1IMwqwkqev1iSeM5bFMdME';
    const TG_CHAT_ID = '-5130843471';

    // ---- STATE ----
    const STORAGE_KEY = 'murkoteka_survey';
    const VISITOR_KEY = 'murkoteka_visitor_id';

    // Уникальный ID посетителя (для трекинга)
    function getVisitorId() {
        let id = localStorage.getItem(VISITOR_KEY);
        if (!id) {
            id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
            localStorage.setItem(VISITOR_KEY, id);
        }
        return id;
    }

    const visitorId = getVisitorId();

    let state = {
        step: 0,
        segment: null, // 'parent' | 'remote' | 'student' | 'couple'
        answers: {},
        telegramHandle: '',
        history: []
    };

    // ---- QUESTIONS ----
    const questions = [
        {
            id: 'location',
            label: 'Вопрос 1 из 12',
            title: 'Где вы живёте?',
            type: 'single',
            options: [
                { value: 'murino', text: 'Мурино / Девяткино', emoji: '🏠' },
                { value: 'nearby', text: 'Рядом (Парнас, Бугры, Всеволожск)', emoji: '🏘️' },
                { value: 'other', text: 'В другом районе', emoji: '📍' }
            ],
            disqualify: 'other'
        },
        {
            id: 'who',
            label: 'Вопрос 2 из 12',
            title: 'Кто вы?',
            subtitle: 'Это поможет нам персонализировать Мурчилл',
            type: 'single',
            options: [
                { value: 'parent', text: 'Родитель с ребёнком', emoji: '👨‍👩‍👧' },
                { value: 'remote', text: 'Работаю удалённо / из дома', emoji: '👨‍💻' },
                { value: 'student', text: 'Студент или снимаю жильё', emoji: '🧑‍🎓' },
                { value: 'couple', text: 'Ищу досуг для себя/пары', emoji: '💑' }
            ]
        },
        {
            id: 'boredom',
            label: 'Вопрос 3 из 12',
            title: 'Как часто чувствуете, что в Мурино некуда пойти?',
            type: 'single',
            options: [
                { value: 'weekly', text: 'Каждую неделю', emoji: '😩' },
                { value: 'often', text: '2-3 раза в месяц', emoji: '😕' },
                { value: 'sometimes', text: 'Иногда', emoji: '🤔' },
                { value: 'fine', text: 'Меня всё устраивает', emoji: '😊' }
            ]
        },
        {
            id: 'interest',
            label: 'Вопрос 4 из 12',
            title: 'Котокафе рядом с домом — интересно?',
            type: 'single',
            options: [
                { value: 'very', text: 'Очень! Пойду сразу', emoji: '🤩' },
                { value: 'interested', text: 'Интересно, схожу при случае', emoji: '😄' },
                { value: 'maybe', text: 'Может быть', emoji: '🤔' },
                { value: 'no', text: 'Не интересно', emoji: '😐' }
            ],
            earlyExit: 'no'
        },
        {
            id: 'format',
            label: 'Вопрос 5 из 12',
            title: 'Какой формат ближе?',
            subtitle: 'Можно выбрать несколько',
            type: 'multi',
            optionsBySegment: {
                parent: [
                    { value: 'family_weekend', text: 'Семейные выходные', emoji: '👨‍👩‍👧' },
                    { value: 'kids_party', text: 'Детский праздник', emoji: '🎉' },
                    { value: 'cat_class', text: 'Занятия с котами', emoji: '🐱' }
                ],
                remote: [
                    { value: 'coworking', text: 'Коворкинг с котами', emoji: '💻' },
                    { value: 'quiet_hours', text: 'Тихие часы', emoji: '🤫' },
                    { value: 'evening_events', text: 'Вечерние мероприятия', emoji: '🌙' }
                ],
                student: [
                    { value: 'cat_evening', text: 'Вечер с кошкой', emoji: '🐱' },
                    { value: 'cat_therapy', text: 'Кототерапия', emoji: '🧘' },
                    { value: 'meetups', text: 'Встречи по интересам', emoji: '👥' }
                ],
                couple: [
                    { value: 'cat_date', text: 'Свидание с котами', emoji: '💑' },
                    { value: 'board_games', text: 'Настолки / кино', emoji: '🎲' },
                    { value: 'yoga_cats', text: 'Йога с котами', emoji: '🧘' }
                ]
            }
        },
        {
            id: 'payment_format',
            label: 'Вопрос 6 из 12',
            title: 'Какой формат оплаты был бы для вас удобнее?',
            type: 'single',
            options: [
                { value: 'hourly', text: 'Почасовая оплата', emoji: '⏰' },
                { value: 'subscription', text: 'Абонемент на несколько визитов', emoji: '🎫' },
                { value: 'flat_entry', text: 'Фиксированная плата за вход (безлимит)', emoji: '🚪' },
                { value: 'bundle', text: 'Пакет «час + напиток»', emoji: '☕' }
            ]
        },
        {
            id: 'price',
            label: 'Вопрос 7 из 12',
            title: 'Сколько готовы заплатить за часовой визит?',
            type: 'single',
            options: [
                { value: '400-500', text: '400–500₽', emoji: '💰' },
                { value: '500-700', text: '500–700₽', emoji: '💵' },
                { value: '700-1000', text: '700–1000₽', emoji: '💶' },
                { value: '1000+', text: '1000₽+', emoji: '💎' }
            ]
        },
        {
            id: 'frequency',
            label: 'Вопрос 8 из 12',
            title: 'Как часто бы ходили?',
            type: 'single',
            options: [
                { value: 'weekly', text: 'Каждую неделю', emoji: '🔥' },
                { value: '2-3_month', text: '2-3 раза в месяц', emoji: '✨' },
                { value: 'monthly', text: 'Раз в месяц', emoji: '📅' },
                { value: 'rarely', text: 'Пару раз в год', emoji: '🌿' }
            ]
        },
        {
            id: 'blockers',
            label: 'Вопрос 9 из 12',
            title: 'Что может помешать пойти?',
            subtitle: 'Можно выбрать несколько',
            type: 'multi',
            hasOther: true,
            options: [
                { value: 'allergy', text: 'Аллергия', emoji: '🤧' },
                { value: 'cleanliness', text: 'Беспокоюсь о чистоте', emoji: '🧹' },
                { value: 'expensive', text: 'Дорого', emoji: '💸' },
                { value: 'alone', text: 'Неловко идти одному', emoji: '😳' },
                { value: 'nothing', text: 'Ничего не помешает', emoji: '💪' }
            ]
        },
        {
            id: 'channels',
            label: 'Вопрос 10 из 12',
            title: 'Как узнаёте о новых местах?',
            subtitle: 'Можно выбрать несколько',
            type: 'multi',
            hasOther: true,
            options: [
                { value: 'tg_chats', text: 'Telegram-чаты ЖК', emoji: '💬' },
                { value: 'social', text: 'VK / Instagram', emoji: '📱' },
                { value: 'maps', text: 'Яндекс.Карты', emoji: '🗺️' },
                { value: 'friends', text: 'От друзей/соседей', emoji: '🗣️' },
                { value: 'ads', text: 'Объявления в подъезде', emoji: '📋' }
            ]
        },
        {
            id: 'timing',
            label: 'Вопрос 11 из 12',
            title: 'Когда бы пришли?',
            type: 'single',
            options: [
                { value: 'first_week', text: 'В первую неделю после открытия', emoji: '🚀' },
                { value: 'first_month', text: 'В первый месяц', emoji: '📅' },
                { value: 'someday', text: 'Когда-нибудь загляну', emoji: '🤔' },
                { value: 'unlikely', text: 'Вряд ли', emoji: '😕' }
            ]
        },
        {
            id: 'contact',
            label: 'Почти готово!',
            title: 'Оставь свой Telegram — пришлём промокод на скидку 30%',
            subtitle: 'Мурчилл открывается в марте!',
            type: 'contact'
        }
    ];

    // ---- SEGMENT MESSAGES ----
    const segmentResults = {
        parent: {
            emoji: '👨‍👩‍👧',
            title: 'Мы готовим для вас семейные выходные с котами!',
            text: 'Безопасно, уютно и ребёнок будет в восторге. Пока дети играют с кошками — вы пьёте кофе в тишине.'
        },
        remote: {
            emoji: '👨‍💻',
            title: 'Коворкинг с котами — лучше любого опенспейса!',
            text: 'Wi-Fi, розетки и мурчащий кот на коленях. Продуктивность и антистресс в одном месте.'
        },
        student: {
            emoji: '🧑‍🎓',
            title: 'Ваш личный кот ждёт вас каждый вечер!',
            text: 'Не нужно ни кормить, ни убирать лоток. Просто приходите, когда хочется тепла и мурчания.'
        },
        couple: {
            emoji: '💑',
            title: 'Свидание, которое вы оба запомните!',
            text: 'Без кальяна и громкой музыки. Ласковые коты, вкусный кофе и уютная атмосфера.'
        }
    };

    // ---- DOM ----
    const overlay = document.getElementById('survey-overlay');
    const closeBtn = document.getElementById('survey-close');
    const progressBar = document.getElementById('survey-progress-bar');
    const body = document.getElementById('survey-body');

    // ---- INIT ----
    loadState();

    closeBtn.addEventListener('click', closeSurvey);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSurvey();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) closeSurvey();
    });

    // Expose openSurvey globally for landing.js
    window.openSurvey = openSurvey;

    // ---- OPEN / CLOSE ----
    let surveyStartNotified = false;

    function openSurvey() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (!surveyStartNotified && state.step === 0) {
            notifySurveyStart();
            surveyStartNotified = true;
        }
        render();
    }

    function closeSurvey() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ---- STATE PERSISTENCE ----
    function saveState() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                state = { ...state, ...parsed };
            }
        } catch (e) { /* ignore */ }
    }

    // ---- NAVIGATION ----
    function goNext() {
        const q = questions[state.step];

        // Notify multi-select answers on advance
        if (q.type === 'multi') {
            const arr = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
            const opts = q.optionsBySegment
                ? (q.optionsBySegment[state.segment] || q.optionsBySegment.couple)
                : q.options;
            const labels = arr.map(v => {
                const o = opts.find(x => x.value === v);
                return o ? o.text : v;
            });
            const otherText = state.answers[q.id + '_other'];
            if (otherText) labels.push('✏️ ' + otherText);
            if (labels.length > 0) notifyAnswer(q.id, q.title, labels);
        }

        // Check disqualification
        if (q.disqualify && state.answers[q.id] === q.disqualify) {
            renderDisqualify();
            return;
        }

        // Check early exit
        if (q.earlyExit && state.answers[q.id] === q.earlyExit) {
            renderEarlyExit();
            return;
        }

        // Set segment from question 2
        if (q.id === 'who') {
            state.segment = state.answers.who;
        }

        state.history.push(state.step);
        state.step++;
        saveState();
        render();
    }

    function goBack() {
        if (state.history.length > 0) {
            state.step = state.history.pop();
            saveState();
            render();
        }
    }

    // ---- RENDER ----
    function render() {
        if (state.step >= questions.length) {
            renderResult();
            return;
        }

        const q = questions[state.step];
        const progress = ((state.step) / questions.length) * 100;
        progressBar.style.width = progress + '%';

        if (q.type === 'contact') {
            renderContact(q);
        } else {
            renderQuestion(q);
        }
    }

    function renderQuestion(q) {
        const options = q.optionsBySegment
            ? (q.optionsBySegment[state.segment] || q.optionsBySegment.couple)
            : q.options;

        const isMulti = q.type === 'multi';
        const currentAnswer = state.answers[q.id];
        const selectedValues = isMulti
            ? (Array.isArray(currentAnswer) ? currentAnswer : [])
            : (currentAnswer ? [currentAnswer] : []);

        let html = `<div class="survey-screen">`;
        html += `<p class="survey-step-label">${q.label}</p>`;
        html += `<h2>${q.title}</h2>`;
        if (q.subtitle) html += `<p class="survey-subtitle">${q.subtitle}</p>`;

        html += `<div class="survey-options">`;
        options.forEach(opt => {
            const selected = selectedValues.includes(opt.value) ? ' selected' : '';
            const multiClass = isMulti ? ' multi' : '';
            html += `
                <button class="option-card${selected}${multiClass}" data-value="${opt.value}">
                    <span class="option-emoji">${opt.emoji}</span>
                    <span>${opt.text}</span>
                    <span class="option-check"></span>
                </button>`;
        });
        if (q.hasOther) {
            const otherVal = state.answers[q.id + '_other'] || '';
            const otherActive = otherVal ? ' selected' : '';
            html += `
                <div class="option-other-wrap${otherActive}">
                    <span class="option-emoji">✏️</span>
                    <input type="text" class="option-other-input" id="other-input"
                        placeholder="Свой вариант..."
                        value="${otherVal}" autocomplete="off">
                </div>`;
        }
        html += `</div>`;

        // Navigation
        html += `<div class="survey-nav">`;
        if (state.history.length > 0) {
            html += `<button class="survey-btn-back" id="btn-back">← Назад</button>`;
        } else {
            html += `<span></span>`;
        }
        if (isMulti) {
            const disabled = selectedValues.length === 0 ? ' disabled' : '';
            html += `<button class="survey-btn-next" id="btn-next"${disabled}>Далее →</button>`;
        }
        html += `</div>`;
        html += `</div>`;

        body.innerHTML = html;

        // Bind events
        body.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                const val = card.dataset.value;
                if (isMulti) {
                    handleMultiSelect(q.id, val, card);
                } else {
                    handleSingleSelect(q.id, val);
                }
            });
        });

        // "Other" free-text input
        const otherInput = document.getElementById('other-input');
        if (otherInput) {
            otherInput.addEventListener('input', () => {
                const val = otherInput.value.trim();
                state.answers[q.id + '_other'] = val;
                otherInput.closest('.option-other-wrap').classList.toggle('selected', val.length > 0);
                saveState();
                // Enable next button if something is selected or typed
                const nextBtn = document.getElementById('btn-next');
                if (nextBtn) {
                    const arr = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
                    nextBtn.disabled = arr.length === 0 && !val;
                }
            });
        }

        const backBtn = document.getElementById('btn-back');
        if (backBtn) backBtn.addEventListener('click', goBack);

        const nextBtn = document.getElementById('btn-next');
        if (nextBtn) nextBtn.addEventListener('click', goNext);
    }

    function handleSingleSelect(questionId, value) {
        state.answers[questionId] = value;
        saveState();

        // Notify Telegram
        const q = questions[state.step];
        const optLabel = q.options.find(o => o.value === value);
        notifyAnswer(questionId, q.title, optLabel ? optLabel.text : value);

        // Visual feedback
        body.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        const selected = body.querySelector(`[data-value="${value}"]`);
        if (selected) selected.classList.add('selected');

        // Auto-advance after brief delay
        setTimeout(goNext, 300);
    }

    function handleMultiSelect(questionId, value, card) {
        if (!Array.isArray(state.answers[questionId])) {
            state.answers[questionId] = [];
        }
        const arr = state.answers[questionId];
        const idx = arr.indexOf(value);
        if (idx > -1) {
            arr.splice(idx, 1);
            card.classList.remove('selected');
        } else {
            arr.push(value);
            card.classList.add('selected');
        }
        saveState();

        // Enable/disable next button
        const nextBtn = document.getElementById('btn-next');
        if (nextBtn) nextBtn.disabled = arr.length === 0;
    }

    // ---- CONTACT SCREEN ----
    function renderContact(q) {
        let html = `<div class="survey-screen">`;
        html += `<p class="survey-step-label">${q.label}</p>`;
        html += `<h2>${q.title}</h2>`;
        html += `<p class="survey-subtitle">${q.subtitle}</p>`;
        html += `
            <div class="survey-input-group">
                <input type="text" class="survey-input" id="tg-input"
                    placeholder="@ваш_ник_в_telegram"
                    value="${state.telegramHandle || ''}"
                    autocomplete="off" autocapitalize="off">
            </div>
            <button class="survey-btn-next" id="btn-submit" style="width:100%">Получить скидку 30% 🎉</button>
            <button class="survey-skip-link" id="btn-skip">Нет, спасибо</button>
        `;
        html += `<div class="survey-nav">`;
        if (state.history.length > 0) {
            html += `<button class="survey-btn-back" id="btn-back">← Назад</button>`;
        }
        html += `</div>`;
        html += `</div>`;

        body.innerHTML = html;

        const input = document.getElementById('tg-input');
        const submitBtn = document.getElementById('btn-submit');
        const skipBtn = document.getElementById('btn-skip');
        const backBtn = document.getElementById('btn-back');

        input.addEventListener('input', () => {
            state.telegramHandle = input.value.trim();
            saveState();
        });

        submitBtn.addEventListener('click', () => {
            state.telegramHandle = input.value.trim();
            submitSurvey(true);
        });

        skipBtn.addEventListener('click', () => {
            state.telegramHandle = '';
            submitSurvey(false);
        });

        if (backBtn) backBtn.addEventListener('click', goBack);

        // Focus input
        setTimeout(() => input.focus(), 100);
    }

    // ---- DISQUALIFICATION ----
    function renderDisqualify() {
        progressBar.style.width = '100%';
        body.innerHTML = `
            <div class="survey-disqualify">
                <div class="survey-disqualify-emoji">🐾</div>
                <h2>Спасибо за интерес!</h2>
                <p>Мы пока фокусируемся на Мурино и ближайших районах. Но следи за нами — возможно, скоро расширимся!</p>
                <div class="survey-result-links">
                    <a href="https://t.me/murchill" target="_blank" class="survey-result-link primary">Подписаться на Telegram-канал 💬</a>
                </div>
            </div>`;
    }

    function renderEarlyExit() {
        progressBar.style.width = '100%';
        body.innerHTML = `
            <div class="survey-disqualify">
                <div class="survey-disqualify-emoji">🙏</div>
                <h2>Спасибо за честность!</h2>
                <p>Мы ценим ваше мнение. Если передумаете — мы будем рады вас видеть!</p>
                <div class="survey-result-links">
                    <a href="https://t.me/murchill" target="_blank" class="survey-result-link secondary">Подписаться на Telegram-канал 💬</a>
                </div>
            </div>`;
    }

    // ---- SUBMIT ----
    function submitSurvey(withContact) {
        const isHotLead = state.answers.interest === 'very'
            && state.answers.timing === 'first_week'
            && withContact && state.telegramHandle;


        // Telegram notification
        notifyComplete({
            segment: state.segment,
            answers: state.answers,
            telegramHandle: state.telegramHandle,
            isHotLead
        });

        state.step = questions.length; // mark completed
        saveState();
        renderResult(withContact);
    }

    // ---- RESULT SCREEN ----
    function renderResult(withContact) {
        progressBar.style.width = '100%';

        const seg = segmentResults[state.segment] || segmentResults.couple;

        let html = `<div class="survey-result">`;
        html += `<div class="survey-result-emoji">${seg.emoji}</div>`;
        html += `<h2>${seg.title}</h2>`;
        html += `<p>${seg.text}</p>`;

        if (withContact && state.telegramHandle) {
            html += `
                <div class="survey-promo-code">
                    <span>Твой промокод на скидку 30%:</span>
                    <strong>МУРЧИЛЛ30</strong>
                </div>
                <p>Пришлём подробности в Telegram ближе к открытию!</p>`;
        }

        html += `
            <div class="survey-result-links">
                <a href="https://t.me/murchill" target="_blank" class="survey-result-link primary">Подписаться на Telegram-канал 💬</a>
            </div>
            <div class="share-buttons">
                <button class="share-btn tg" onclick="shareTelegram()">Telegram</button>
                <button class="share-btn vk" onclick="shareVK()">VK</button>
            </div>`;

        html += `</div>`;
        body.innerHTML = html;
    }

    // ---- SHARE ----
    window.shareTelegram = function () {
        const text = encodeURIComponent('Котокафе «Мурчилл» открывается в Мурино! Пройди опрос и получи скидку 30% 🐱');
        const url = encodeURIComponent(window.location.href);
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    };

    window.shareVK = function () {
        const url = encodeURIComponent(window.location.href);
        window.open(`https://vk.com/share.php?url=${url}`, '_blank');
    };


    // ---- TELEGRAM NOTIFICATIONS ----
    function sendToTelegram(text) {
        if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' })
        }).catch(() => {});
    }

    function detectDevice() {
        const ua = navigator.userAgent;
        if (/iPad|Tablet|PlayBook/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/i.test(ua))) return '📱 Планшет';
        if (/Mobile|Android|iPhone|iPod/i.test(ua)) return '📱 Мобильный';
        return '💻 Десктоп';
    }

    function detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('YaBrowser')) return 'Яндекс Браузер';
        if (ua.includes('Edg/')) return 'Edge';
        if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Chrome')) return 'Chrome';
        return 'Другой';
    }

    function getUtmParams() {
        const params = new URLSearchParams(window.location.search);
        const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
        const found = [];
        utms.forEach(key => {
            const val = params.get(key);
            if (val) found.push(`${key.replace('utm_', '')}: ${val}`);
        });
        return found.length > 0 ? found.join(', ') : null;
    }

    function notifyPageVisit() {
        const device = detectDevice();
        const browser = detectBrowser();
        const screen = `${window.screen.width}x${window.screen.height}`;
        const lang = navigator.language || '—';
        const ref = document.referrer || 'прямой заход';
        const utms = getUtmParams();
        const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

        // Fetch IP + geo, then send full report
        fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(geo => {
                let msg = `👀 <b>Посещение лендинга</b>\n` +
                    `ID: <code>${visitorId}</code>\n` +
                    `🕐 ${time} (МСК)\n` +
                    `\n` +
                    `🌐 IP: <code>${geo.ip || '—'}</code>\n` +
                    `📍 ${geo.city || '—'}, ${geo.region || ''}, ${geo.country_name || ''}\n` +
                    `🏢 Провайдер: ${geo.org || '—'}\n` +
                    `\n` +
                    `${device}\n` +
                    `🌍 Браузер: ${browser}\n` +
                    `📐 Экран: ${screen}\n` +
                    `🗣 Язык: ${lang}\n` +
                    `\n` +
                    `🔗 Источник: ${ref}`;
                if (utms) msg += `\n📊 UTM: ${utms}`;
                sendToTelegram(msg);
            })
            .catch(() => {
                // Fallback without geo
                let msg = `👀 <b>Посещение лендинга</b>\n` +
                    `ID: <code>${visitorId}</code>\n` +
                    `🕐 ${time} (МСК)\n` +
                    `${device} | ${browser}\n` +
                    `📐 Экран: ${screen}\n` +
                    `🔗 Источник: ${ref}`;
                if (utms) msg += `\n📊 UTM: ${utms}`;
                sendToTelegram(msg);
            });
    }

    function notifySurveyStart() {
        sendToTelegram(
            `🚀 <b>Начал опрос</b>\n` +
            `ID: <code>${visitorId}</code>`
        );
    }

    function notifyAnswer(questionId, questionTitle, answer) {
        const val = Array.isArray(answer) ? answer.join(', ') : answer;
        sendToTelegram(
            `📝 <b>Ответ</b>\n` +
            `ID: <code>${visitorId}</code>\n` +
            `❓ ${questionTitle}\n` +
            `💬 ${val}`
        );
    }

    function notifyComplete(data) {
        const hot = data.isHotLead ? '🔥 ДА' : 'нет';
        sendToTelegram(
            `✅ <b>Опрос завершён!</b>\n` +
            `ID: <code>${visitorId}</code>\n` +
            `Сегмент: ${data.segment || '—'}\n` +
            `Telegram: ${data.telegramHandle || '—'}\n` +
            `Горячий лид: ${hot}\n` +
            `Ответы: <pre>${JSON.stringify(data.answers, null, 2)}</pre>`
        );
    }

    // Track page visit (once per session)
    if (!sessionStorage.getItem('murkoteka_visited')) {
        sessionStorage.setItem('murkoteka_visited', '1');
        notifyPageVisit();
    }

})();
