let currentLang = 'en';

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const keys = element.getAttribute('data-i18n').split('.');
        let text = siteContent[currentLang];
        keys.forEach(k => { if(text) text = text[k]; });
        if(text) {
            if (element.tagName === 'INPUT') {
                element.placeholder = text;
            } else {
                element.innerHTML = text; 
            }
        }
    });
    document.documentElement.lang = currentLang;
}

// Initial translation load
document.addEventListener("DOMContentLoaded", applyTranslations);

(function() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add("dark-mode");
    }
})();

function playName() {
    var audio = document.getElementById("name-audio");
    audio.currentTime = 0; 
    audio.play().catch(function(error) { alert("Audio file not found! Check 'kamil_name.mp3'."); });
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'pl' : 'en';
    applyTranslations();
}

function toggleTheme() {
    document.body.classList.toggle("dark-mode");
}

function toggleMusic() {
    var music = document.getElementById("ambient-music");
    var attribution = document.getElementById("music-attribution");
    var btn = document.getElementById("music-btn");
    
    if (music.paused) {
        music.play().catch(function(error) { alert("Music file not found! Ensure filename is exactly: bolero.mp3"); });
        attribution.style.display = "block"; 
        btn.classList.add("is-playing");
    } else {
        music.pause();
        attribution.style.display = "none";
        btn.classList.remove("is-playing");
    }
}

let uniqueChartInst = null;
let learnedChartInst = null;
let distChartInst = null;
let activeGameId = null;
let dashboardInitialized = false;

// State tracking for compare dropdowns
let activeComp1 = null;
let activeComp2 = null;

const gMetrics = typeof globalMetrics !== 'undefined' ? globalMetrics.corpus_global_metrics : null;

// Helper to format text/HTML numbers with commas and max 3 decimals
function formatNum(val) {
    if (typeof val === 'number') {
        if (Number.isInteger(val)) {
            return val.toLocaleString(); 
        }
        return Number(val.toFixed(3)); 
    }
    return val;
}

// NEW: Helper strictly for Chart.js data arrays (never returns strings)
function roundChartNum(val) {
    return typeof val === 'number' ? Number(val.toFixed(3)) : 0;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(tabId + '-tab').classList.add('active');
    
    if (tabId === 'dashboard' && !dashboardInitialized) {
        initDashboard();
        dashboardInitialized = true;
    }
}

let gameOptions = [];

function setupDropdown() {
    const searchInput = document.getElementById('game-search');
    const dropdownList = document.getElementById('dropdown-list');

    function renderList(filter = "") {
        dropdownList.innerHTML = "";
        const lowerFilter = filter.toLowerCase();
        
        const filtered = gameOptions.filter(opt => opt.title.toLowerCase().includes(lowerFilter));
        
        filtered.forEach(opt => {
            let item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = opt.title;
            item.onclick = function() {
                searchInput.value = opt.title;
                activeGameId = opt.id;
                dropdownList.classList.remove('active');
                renderDashboard();
            };
            dropdownList.appendChild(item);
        });
        
        if(filtered.length === 0) {
            let item = document.createElement('div');
            item.className = 'dropdown-item';
            item.style.color = 'var(--subtle-text)';
            item.textContent = "No games found.";
            dropdownList.appendChild(item);
        }
    }

    searchInput.addEventListener('input', (e) => {
        dropdownList.classList.add('active');
        renderList(e.target.value);
    });

    searchInput.addEventListener('focus', () => {
        searchInput.value = "";
        dropdownList.classList.add('active');
        renderList("");
    });

    renderList();
}

function setupCompareDropdown(inputId, listId, isFirstGame) {
    const searchInput = document.getElementById(inputId);
    const dropdownList = document.getElementById(listId);

    function renderList(filter = "") {
        dropdownList.innerHTML = "";
        const lowerFilter = filter.toLowerCase();
        const filtered = gameOptions.filter(opt => opt.title.toLowerCase().includes(lowerFilter));
        
        filtered.forEach(opt => {
            let item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = opt.title;
            item.onclick = function() {
                searchInput.value = opt.title;
                if(isFirstGame) activeComp1 = opt.id;
                else activeComp2 = opt.id;
                dropdownList.classList.remove('active');
                renderComparison();
            };
            dropdownList.appendChild(item);
        });
    }

    searchInput.addEventListener('input', (e) => { dropdownList.classList.add('active'); renderList(e.target.value); });
    searchInput.addEventListener('focus', () => { searchInput.value = ""; dropdownList.classList.add('active'); renderList(""); });
    renderList();
}

document.addEventListener('click', (e) => {
    // Hide main search list
    const mainSearch = document.getElementById('game-search');
    if(mainSearch && !mainSearch.parentElement.contains(e.target)) {
        document.getElementById('dropdown-list').classList.remove('active');
    }
    // Hide compare list 1
    const compSearch1 = document.getElementById('game-search-compare-1');
    if(compSearch1 && !compSearch1.parentElement.contains(e.target)) {
        document.getElementById('dropdown-list-compare-1').classList.remove('active');
    }
    // Hide compare list 2
    const compSearch2 = document.getElementById('game-search-compare-2');
    if(compSearch2 && !compSearch2.parentElement.contains(e.target)) {
        document.getElementById('dropdown-list-compare-2').classList.remove('active');
    }
});

function safeMed(path) {
    if (!gMetrics) return 0;
    let curr = gMetrics;
    for (let p of path) {
        if (!curr || curr[p] === undefined) return 0;
        curr = curr[p];
    }
    return curr.median !== undefined ? curr.median : curr;
}

function createMedianGame() {
    if (!gMetrics) return null;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'UNKNOWN'];
    const dist = levels.map(l => ({
        cefr_level: l,
        total_amount: 0,
        unique_amount: 0,
        total_percentage: safeMed(['cefr_vocab_distribution', l, 'total_percentage']),
        unique_percentage: safeMed(['cefr_vocab_distribution', l, 'unique_percentage'])
    }));

    const util = {};
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach(l => {
        util[l] = {
            learned: safeMed(['learning_utility', l, 'learned']),
            unique: safeMed(['learning_utility', l, 'unique']),
            utility_score: safeMed(['learning_utility', l, 'utility_score']),
            top_repeated_lemmas: {}
        };
    });

    return {
        game_info: { title: "-- CORPUS MEDIAN --", series: "N/A", year: "N/A", source: "#", source_features: { type: "N/A", completeness: "N/A" }, total_lines_extracted: safeMed(['total_lines_extracted']) },
        analysis_results: {
            readability: { word_count: safeMed(['readability_medians', 'word_count']), flesch_reading_ease: safeMed(['readability_medians', 'flesch_reading_ease']), flesch_kincaid_grade: safeMed(['readability_medians', 'flesch_kincaid_grade']), smog_index: safeMed(['readability_medians', 'smog_index']), dale_chall_score: safeMed(['readability_medians', 'dale_chall_score']) },
            syntactic_complexity: { passives_per_sentence: safeMed(['syntactic_complexity', 'passives_per_sentence']), subordinate_clauses_per_sentence: safeMed(['syntactic_complexity', 'subordinate_clauses_per_sentence']), conditionals_per_sentence: safeMed(['syntactic_complexity', 'conditionals_per_sentence']) },
            register: { slang_density_percentage: safeMed(['slang_density']) },
            vocabulary: { phrasal_verbs_density_per_1000_words: safeMed(['pv_density']), top_20_lemmas: null, top_15_bigrams: null, collocations: null },
            diversity_syntax: { ttr: safeMed(['diversity_syntax', 'ttr']), mtld: safeMed(['diversity_syntax', 'mtld']) },
            oov_analysis: { oov_rate_percent: safeMed(['oov_rate']), top_10_oov: null, true_oov_list: [] },
            lexical_density: { density_including_proper_nouns: safeMed(['lexical_density', 'density_including_proper_nouns']), density_excluding_proper_nouns: safeMed(['lexical_density', 'density_excluding_proper_nouns']) },
            cefr_vocabulary: { level_distribution: dist, thresholds: gMetrics.threshold_modes, learning_utility: util, b2_learned_vocab: null, c1_learned_vocab: null, c2_learned_vocab: null },
            cefr_sentences: {
                counts: { A1: safeMed(['cefr_sentences', 'A1', 'counts']), A2: safeMed(['cefr_sentences', 'A2', 'counts']), B1: safeMed(['cefr_sentences', 'B1', 'counts']), B2: safeMed(['cefr_sentences', 'B2', 'counts']), C1: safeMed(['cefr_sentences', 'C1', 'counts']), C2: safeMed(['cefr_sentences', 'C2', 'counts']) },
                percentages: { A1: safeMed(['cefr_sentences', 'A1', 'percentages']), A2: safeMed(['cefr_sentences', 'A2', 'percentages']), B1: safeMed(['cefr_sentences', 'B1', 'percentages']), B2: safeMed(['cefr_sentences', 'B2', 'percentages']), C1: safeMed(['cefr_sentences', 'C1', 'percentages']), C2: safeMed(['cefr_sentences', 'C2', 'percentages']) }
            }
        }
    };
}

function initDashboard() {
    if (typeof gamesData === 'undefined' || !gamesData || Object.keys(gamesData).length === 0) {
        document.getElementById('dash-title').textContent = "Error: Dashboard data not found.";
        return;
    }

    if (typeof globalMetrics !== 'undefined') {
        const gm = globalMetrics;
        const linesEl = document.getElementById('global-lines');
        const sentEl = document.getElementById('global-sentences');
        const wordsEl = document.getElementById('global-words');
        
        if (linesEl && gm.corpus_global_metrics && gm.corpus_global_metrics.total_lines_extracted && gm.corpus_global_metrics.total_lines_extracted.sum !== undefined) {
            linesEl.textContent = formatNum(gm.corpus_global_metrics.total_lines_extracted.sum);
        }
        if (sentEl && gm.grand_total_sentences_sum !== undefined) {
            sentEl.textContent = formatNum(gm.grand_total_sentences_sum);
        }
        if (wordsEl && gm.word_count_total_sum !== undefined) {
            wordsEl.textContent = formatNum(gm.word_count_total_sum);
        }
    }

    if (gMetrics) {
        gamesData['corpus_median_game'] = createMedianGame();
        if (typeof voiceData !== 'undefined') voiceData['corpus_median_game'] = { proper_title: "-- CORPUS MEDIAN --", voice_acting: "N/A", year: "N/A" };
    }
    
    for (const [id, data] of Object.entries(gamesData)) {
        let title = (typeof voiceData !== 'undefined' && voiceData[id] && voiceData[id].proper_title) ? voiceData[id].proper_title : (data.game_info ? data.game_info.title : id);
        if (id.includes('_B_')) title += " (Source B)";
        gameOptions.push({id: id, title: title});
    }
    
    gameOptions.sort((a,b) => {
        if(a.id === 'corpus_median_game') return -1;
        if(b.id === 'corpus_median_game') return 1;
        return a.title.localeCompare(b.title);
    });

    setupDropdown();
    setupCompareDropdown('game-search-compare-1', 'dropdown-list-compare-1', true);
    setupCompareDropdown('game-search-compare-2', 'dropdown-list-compare-2', false);
    
    if(gameOptions.length > 0) {
        activeGameId = gameOptions[0].id;
        document.getElementById('game-search').value = gameOptions[0].title;
        renderDashboard();
    }
}

function applyStat(elementId, value, globalPath) {
    const el = document.getElementById(elementId);
    if(!el) return;
    el.textContent = formatNum(value);
    
    let target = gMetrics;
    if (target && globalPath) {
        globalPath.forEach(key => { if(target) target = target[key]; });
        
        if (target) {
            let tooltipText = "";
            if (typeof target === 'number') {
                tooltipText = `Global Median: ${formatNum(target)}`;
            } else {
                if(target.median !== undefined) tooltipText += `Median: ${formatNum(target.median)}`;
                if(target.mean !== undefined) tooltipText += ` | Mean: ${formatNum(target.mean)}`;
            }
            
            let tooltip = el.querySelector('.tooltip');
            if(!tooltip) {
                tooltip = document.createElement('span');
                tooltip.className = 'tooltip';
                el.appendChild(tooltip);
            }
            tooltip.textContent = tooltipText;
        }
    }
}

function formatList(obj, limit=10) {
    if(!obj) return "N/A";
    return Object.entries(obj).slice(0,limit).map(e => `${e[0]} (${e[1]})`).join(', ');
}

function renderDashboard() {
    if(!activeGameId) return;
    const game = gamesData[activeGameId];
    const res = game.analysis_results;
    const meta = (typeof voiceData !== 'undefined' && voiceData[activeGameId]) ? voiceData[activeGameId] : {};
    const medianWarning = document.getElementById('corpus-median-warning');
    if (medianWarning) {
        medianWarning.style.display = (activeGameId === 'corpus_median_game') ? 'block' : 'none';
    }
    document.getElementById('dash-title').textContent = meta.proper_title || game.game_info.title;
    document.getElementById('dash-series').textContent = game.game_info.series;
    document.getElementById('dash-year').textContent = meta.year || game.game_info.year;
    document.getElementById('dash-source').innerHTML = game.game_info.source === "#" ? "N/A" : `<a href="${game.game_info.source}" target="_blank">Link</a>`;
    document.getElementById('dash-type').textContent = game.game_info.source_features?.type || "Unknown";
    document.getElementById('dash-completeness').textContent = game.game_info.source_features?.completeness || "Unknown";
    document.getElementById('dash-voice').textContent = meta.voice_acting || "Unknown";
    document.getElementById('dash-img').src = `images/${activeGameId}.jpg`;

    applyStat('dash-words', res.readability.word_count, ['readability_medians', 'word_count']);
    let sentSum = 0;
    if(res.cefr_sentences && res.cefr_sentences.counts) {
        Object.values(res.cefr_sentences.counts).forEach(v => sentSum += v);
    }
    document.getElementById('dash-sentences').textContent = formatNum(sentSum);

    applyStat('dash-lines', game.game_info.total_lines_extracted, ['total_lines_extracted']);

    applyStat('dash-pv', res.vocabulary.phrasal_verbs_density_per_1000_words, ['pv_density']);
    applyStat('dash-slang', res.register.slang_density_percentage, ['slang_density']);
    applyStat('dash-lex-with', res.lexical_density.density_including_proper_nouns, ['lexical_density', 'density_including_proper_nouns']);
    applyStat('dash-lex-without', res.lexical_density.density_excluding_proper_nouns, ['lexical_density', 'density_excluding_proper_nouns']);
    applyStat('dash-passives', res.syntactic_complexity.passives_per_sentence, ['syntactic_complexity', 'passives_per_sentence']);
    applyStat('dash-sub', res.syntactic_complexity.subordinate_clauses_per_sentence, ['syntactic_complexity', 'subordinate_clauses_per_sentence']);
    applyStat('dash-cond', res.syntactic_complexity.conditionals_per_sentence, ['syntactic_complexity', 'conditionals_per_sentence']);
    applyStat('dash-ttr', res.diversity_syntax.ttr, ['diversity_syntax', 'ttr']);
    applyStat('dash-mtld', res.diversity_syntax.mtld, ['diversity_syntax', 'mtld']);

    const thresh = res.cefr_vocabulary.thresholds;
    document.getElementById('dash-t95').textContent = thresh.total_95 || "N/A";
    document.getElementById('dash-t98').textContent = thresh.total_98 || "N/A";
    document.getElementById('dash-u95').textContent = thresh.unique_95 || "N/A";
    document.getElementById('dash-u98').textContent = thresh.unique_98 || "N/A";

    applyStat('dash-fre', res.readability.flesch_reading_ease, ['readability_medians', 'flesch_reading_ease']);
    applyStat('dash-fkg', res.readability.flesch_kincaid_grade, ['readability_medians', 'flesch_kincaid_grade']);
    applyStat('dash-smog', res.readability.smog_index, ['readability_medians', 'smog_index']);
    applyStat('dash-dale', res.readability.dale_chall_score, ['readability_medians', 'dale_chall_score']);

    const sBody = document.getElementById('cefr-sent-tbody');
    sBody.innerHTML = "";
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach(lvl => {
        if(res.cefr_sentences?.counts[lvl] !== undefined) {
            let count = res.cefr_sentences.counts[lvl];
            let pct = (res.cefr_sentences.percentages[lvl] * 100).toFixed(2);
            sBody.innerHTML += `<tr><td>${lvl}</td><td>${formatNum(count)}</td><td>${pct}%</td></tr>`;
        }
    });

    applyStat('b2-ni', res.cefr_vocabulary.learning_utility.B2?.utility_score || 0, ['learning_utility', 'B2', 'utility_score']);
    applyStat('c1-ni', res.cefr_vocabulary.learning_utility.C1?.utility_score || 0, ['learning_utility', 'C1', 'utility_score']);
    applyStat('c2-ni', res.cefr_vocabulary.learning_utility.C2?.utility_score || 0, ['learning_utility', 'C2', 'utility_score']);

    document.getElementById('dash-lemmas').textContent = formatList(res.vocabulary.top_20_lemmas);
    document.getElementById('dash-bigrams').textContent = formatList(res.vocabulary.top_15_bigrams);
    document.getElementById('dash-verb-prep').textContent = formatList(res.vocabulary.collocations?.top_15_verb_preposition);
    document.getElementById('dash-adj-noun').textContent = formatList(res.vocabulary.collocations?.top_15_adjective_noun);
    document.getElementById('dash-top-pv').textContent = formatList(res.vocabulary.collocations?.top_15_phrasal_verbs);
    applyStat('dash-oov', res.oov_analysis.oov_rate_percent, ['oov_rate']);
    document.getElementById('dash-top-oov').textContent = formatList(res.oov_analysis.top_10_oov);
    document.getElementById('true-oov').textContent = res.oov_analysis.true_oov_list.join(', ');

    document.getElementById('b2-words').textContent = formatList(res.cefr_vocabulary.b2_learned_vocab, 99999);
    document.getElementById('c1-words').textContent = formatList(res.cefr_vocabulary.c1_learned_vocab, 99999);
    document.getElementById('c2-words').textContent = formatList(res.cefr_vocabulary.c2_learned_vocab, 99999);

    renderCharts(res.cefr_vocabulary);
}

function renderCharts(vocab) {
    const levelsUtil = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const levelsDist = ["A1", "A2", "B1", "B2", "C1", "C2", "UNKNOWN"];
    
    const utilData = levelsUtil.map(l => vocab.learning_utility[l] || {learned:0, unique:0, utility_score:0});
    
    let utilLearnedMedians = [];
    let utilUniqueMedians = [];
    if (gMetrics && gMetrics.learning_utility) {
        utilLearnedMedians = levelsUtil.map(l => safeMed(['learning_utility', l, 'learned']));
        utilUniqueMedians = levelsUtil.map(l => safeMed(['learning_utility', l, 'unique']));
    }

    const ctxUnique = document.getElementById('uniqueChart').getContext('2d');
    if(uniqueChartInst) uniqueChartInst.destroy();
    
    uniqueChartInst = new Chart(ctxUnique, {
        type: 'bar',
        data: {
            labels: levelsUtil,
            datasets: [
                { label: 'Game Unique Vocab', data: utilData.map(d => roundChartNum(d.unique)), backgroundColor: '#a4c2f4' },
                { label: 'Global Median (Unique)', data: utilUniqueMedians.map(roundChartNum), backgroundColor: '#6d9eeb' }
            ]
        },
        options: { 
            responsive: true, 
            plugins: { 
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    callbacks: {
                        label: function(ctx) {
                            return ctx.dataset.label + ': ' + formatNum(ctx.raw);
                        }
                    }
                } 
            }, 
            scales: { y: { beginAtZero: true } } 
        }
    });

    const ctxLearned = document.getElementById('learnedChart').getContext('2d');
    if(learnedChartInst) learnedChartInst.destroy();

    learnedChartInst = new Chart(ctxLearned, {
        type: 'bar',
        data: {
            labels: levelsUtil,
            datasets: [
                { label: 'Game Learned Vocab', data: utilData.map(d => roundChartNum(d.learned)), backgroundColor: '#a4c2f4' },
                { label: 'Global Median (Learned)', data: utilLearnedMedians.map(roundChartNum), backgroundColor: '#6d9eeb' }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    mode: 'index', intersect: false,
                    callbacks: {
                        label: function(ctx) {
                            return ctx.dataset.label + ': ' + formatNum(ctx.raw);
                        },
                        afterBody: function(ctx) {
                            let lvl = ctx[0].label;
                            let obj = vocab.learning_utility[lvl];
                            let score = obj ? formatNum(obj.utility_score) : 0;
                            let top = obj && obj.top_repeated_lemmas ? Object.keys(obj.top_repeated_lemmas).slice(0,3).join(', ') : '';
                            return `\nGame Utility Score: ${score}\nTop Game Lemmas: ${top}`;
                        }
                    }
                }
            },
            scales: { y: { beginAtZero: true } }
        }
    });

    const ctxDist = document.getElementById('distChart').getContext('2d');
    if(distChartInst) distChartInst.destroy();
    
    const distData = vocab.level_distribution;
    let totalAmt = [], uniqueAmt = [], totalPct = [], uniquePct = [];
    
    levelsDist.forEach(lvl => {
        let match = distData.find(d => d.cefr_level === lvl) || {total_amount:0, unique_amount:0, total_percentage:0, unique_percentage:0};
        totalAmt.push(match.total_amount);
        uniqueAmt.push(match.unique_amount);
        totalPct.push((match.total_percentage * 100).toFixed(2) + '%');
        uniquePct.push((match.unique_percentage * 100).toFixed(2) + '%');
    });

    distChartInst = new Chart(ctxDist, {
        type: 'bar',
        data: {
            labels: levelsDist.map(lvl => lvl === "UNKNOWN" ? "Unclassified" : lvl),
            datasets: [
                { label: 'Total Words', data: totalAmt.map(roundChartNum), backgroundColor: '#a4c2f4', yAxisID: 'y' },
                { label: 'Unique Words', data: uniqueAmt.map(roundChartNum), backgroundColor: '#6d9eeb', yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            let label = ctx.dataset.label || '';
                            let val = formatNum(ctx.raw);
                            let pct = ctx.datasetIndex === 0 ? totalPct[ctx.dataIndex] : uniquePct[ctx.dataIndex];
                            return `${label}: ${val} (${pct})`;
                        }
                    }
                }
            },
            scales: {
                y: { type: 'linear', display: true, position: 'left' },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

function renderComparison() {
    const table = document.getElementById('compare-table');
    const disclaimer = document.getElementById('compare-disclaimer');
    
    if(!activeComp1 || !activeComp2) {
        table.style.display = 'none';
        disclaimer.style.display = 'none';
        return;
    }
    table.style.display = 'table';
    disclaimer.style.display = 'block';
    
    const g1 = gamesData[activeComp1];
    const g2 = gamesData[activeComp2];
    const r1 = g1.analysis_results;
    const r2 = g2.analysis_results;
    
    document.getElementById('comp-header-1').textContent = gameOptions.find(o => o.id === activeComp1).title;
    document.getElementById('comp-header-2').textContent = gameOptions.find(o => o.id === activeComp2).title;

    const rows = [
        { key: "b2_acq", tt: "tooltips.acq_index", v1: r1.cefr_vocabulary.learning_utility.B2?.utility_score, v2: r2.cefr_vocabulary.learning_utility.B2?.utility_score },
        { key: "c1_acq", tt: "tooltips.acq_index", v1: r1.cefr_vocabulary.learning_utility.C1?.utility_score, v2: r2.cefr_vocabulary.learning_utility.C1?.utility_score },
        { key: "c2_acq", tt: "tooltips.acq_index", v1: r1.cefr_vocabulary.learning_utility.C2?.utility_score, v2: r2.cefr_vocabulary.learning_utility.C2?.utility_score },
        { key: "pv", tt: "tooltips.pv", v1: r1.vocabulary.phrasal_verbs_density_per_1000_words, v2: r2.vocabulary.phrasal_verbs_density_per_1000_words },
        { key: "slang", tt: "tooltips.slang", v1: r1.register.slang_density_percentage, v2: r2.register.slang_density_percentage },
        { key: "lex_prop", tt: "tooltips.lexical_prop", v1: r1.lexical_density.density_including_proper_nouns, v2: r2.lexical_density.density_including_proper_nouns },
        { key: "lex_no_prop", tt: "tooltips.lexical_no_prop", v1: r1.lexical_density.density_excluding_proper_nouns, v2: r2.lexical_density.density_excluding_proper_nouns },
        { key: "passives", tt: "tooltips.passives", v1: r1.syntactic_complexity.passives_per_sentence, v2: r2.syntactic_complexity.passives_per_sentence },
        { key: "subordinates", tt: "tooltips.subordinates", v1: r1.syntactic_complexity.subordinate_clauses_per_sentence, v2: r2.syntactic_complexity.subordinate_clauses_per_sentence },
        { key: "conditionals", tt: "tooltips.conditionals", v1: r1.syntactic_complexity.conditionals_per_sentence, v2: r2.syntactic_complexity.conditionals_per_sentence },
        { key: "ttr", tt: "tooltips.ttr", v1: r1.diversity_syntax.ttr, v2: r2.diversity_syntax.ttr },
        { key: "mtld", tt: "tooltips.mtld", v1: r1.diversity_syntax.mtld, v2: r2.diversity_syntax.mtld },
        { key: "fre", tt: "tooltips.fre", v1: r1.readability.flesch_reading_ease, v2: r2.readability.flesch_reading_ease },
        { key: "fkg", tt: "tooltips.fkg", v1: r1.readability.flesch_kincaid_grade, v2: r2.readability.flesch_kincaid_grade },
        { key: "smog", tt: "tooltips.smog", v1: r1.readability.smog_index, v2: r2.readability.smog_index },
        { key: "dale", tt: "tooltips.dale", v1: r1.readability.dale_chall_score, v2: r2.readability.dale_chall_score },
        { key: "oov", tt: "tooltips.oov_rate", v1: r1.oov_analysis.oov_rate_percent, v2: r2.oov_analysis.oov_rate_percent },
        { key: "t95", tt: "tooltips.t95", v1: r1.cefr_vocabulary.thresholds.total_95, v2: r2.cefr_vocabulary.thresholds.total_95 },
        { key: "t98", tt: "tooltips.t98", v1: r1.cefr_vocabulary.thresholds.total_98, v2: r2.cefr_vocabulary.thresholds.total_98 },
        { key: "u95", tt: "tooltips.u95", v1: r1.cefr_vocabulary.thresholds.unique_95, v2: r2.cefr_vocabulary.thresholds.unique_95 },
        { key: "u98", tt: "tooltips.u98", v1: r1.cefr_vocabulary.thresholds.unique_98, v2: r2.cefr_vocabulary.thresholds.unique_98 }
    ];

    const tbody = document.getElementById('comp-tbody');
    let html = '';
    rows.forEach(r => {
        let f1 = r.v1 !== undefined && r.v1 !== null ? formatNum(r.v1) : 'N/A';
        let f2 = r.v2 !== undefined && r.v2 !== null ? formatNum(r.v2) : 'N/A';
        
        if (typeof r.v1 === 'number' && typeof r.v2 === 'number') {
            if (r.v1 > r.v2) {
                f1 = `<strong>${f1}</strong>`;
            } else if (r.v2 > r.v1) {
                f2 = `<strong>${f2}</strong>`;
            }
        }
        
        html += `<tr>
            <td><strong data-i18n="compare_metrics.${r.key}"></strong> <span class="info-icon">i<span class="tooltip" data-i18n="${r.tt}"></span></span></td>
            <td>${f1}</td>
            <td>${f2}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    
    applyTranslations();
}
