/**
 * app.js — V3 Orchestrator
 * New: job names, ПДФО, daily/hourly rate toggle, double-click assign, long-press picker
 */

import {
  buildMonthDays, dayKey, applyShift, calcHours,
  MONTH_NAMES_UK, WEEKDAY_NAMES_UK, WEEKDAY_LONG_UK,
  DAY_TYPES, SHIFT_PRESETS, getDow,
} from './planner.js';

import {
  buildIncomeSummary, calcDayDetails, calcDayGross, calcDayTaxPdv, calcDayNdfl,
  formatCurrency,
  DEFAULT_RATES, DEFAULT_TAXES, DEFAULT_NDFL, DEFAULT_RATE_TYPES,
} from './income.js';

const DEFAULT_WORK_TYPES = [
  { id: 'work1', emoji: '💼', name: 'Работа 1' },
  { id: 'work2', emoji: '🏢', name: 'Работа 2' },
  { id: 'both',  emoji: '⚡', name: 'Обе' },
];

import { STRATEGIES, applyStrategy } from './autoschedule.js';
import { exportJSON, exportTXT, exportPNG, exportICS } from './export.js';
import {
  loadExpenses, saveExpenses, calcTotalExpenses,
  groupByCategory, createCustomExpense, createMathExpense, 
  EXPENSE_CATEGORIES, getPeriodMultiplier, PERIOD_OPTIONS,
} from './expenses.js';
import { renderChartsPanel } from './charts.js';
import { CatCursor } from './cursor.js';
import { login, register, logout, onAuthChange, isLoggedIn, getCurrentUser, getAuthInfo } from './auth.js';
import {
  syncSettingsToCloud, syncDaysToCloud, syncTasksToCloud, 
  syncExpensesToCloud, syncBonusesToCloud, syncDayNotesToCloud,
  loadSettingsFromCloud, loadDaysFromCloud, loadTasksFromCloud,
  loadExpensesFromCloud, loadBonusesFromCloud, loadDayNotesFromCloud,
  loadAllFromCloud, syncAllToCloud, getSyncStatus, onSyncStatusChange
} from './cloud-sync.js';

const CAT_PHRASES = [
  'Мяу! 🐱',
  'Работать не хочу! 😴',
  'Дай покушать! 🍽',
  'Почеши пузико! 😸',
  'Муррррр! ❤️',
  'Когда обед? 🍕',
  'Люблю тебя! 💕',
  'Пора на прогулку! 🌳',
  'Спокойной ночи! 🌙',
  'Доброе утро! ☀️',
  'Поиграем? 🎾',
  'Котик устал... 😴',
  'Мням-мням! 🐟',
  'Где моя игрушка? 🎀',
  'Обними меня! 🤗',
  'Ты лучший! ⭐',
  'Погладишь? 🖐️',
  'Скучаю по тебе! 💗',
  'Пока-пока! 👋',
  'Кофе? ☕',
  'Отличный день! 🌟',
  'Помурлыкаем? 🎵',
  'Люблю спать! 🛏️',
  'Активируем мозг! 🧠',
];

let catVisible = false;
let catTimeout = null;
let catMouseHandler = null;

function showCatWidget() {
  const widget = document.getElementById('catWidget');
  const speech = document.getElementById('catSpeech');
  if (!widget || !speech) return;
  
  catVisible = true;
  widget.classList.add('visible');
  
  if (window.catCursorInstance) {
    window.catCursorInstance.setEnabled(false);
  }
  
  initCatCursor();
  showRandomCatPhrase();
}

function hideCatWidget() {
  const widget = document.getElementById('catWidget');
  if (!widget) return;
  
  catVisible = false;
  widget.classList.remove('visible');
  
  if (catTimeout) {
    clearTimeout(catTimeout);
    catTimeout = null;
  }
  
  if (catMouseHandler) {
    document.removeEventListener('mousemove', catMouseHandler);
    catMouseHandler = null;
  }
  
  if (window.catCursorInstance) {
    window.catCursorInstance.setEnabled(true);
  }
}

function initCatCursor() {
  const maxOffset = 8;
  
  catMouseHandler = (e) => {
    const widget = document.getElementById('catWidget');
    if (!widget || !widget.classList.contains('visible')) return;
    
    const catRect = widget.getBoundingClientRect();
    const catCenterX = catRect.left + catRect.width / 2;
    const catCenterY = catRect.top + catRect.height * 0.4;
    
    const dx = e.clientX - catCenterX;
    const dy = e.clientY - catCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 150;
    
    let moveX = (dx / maxDist) * maxOffset;
    let moveY = (dy / maxDist) * maxOffset;
    
    if (distance < maxDist) {
      const factor = distance / maxDist;
      moveX *= factor;
      moveY *= factor;
    }
    
    moveX = Math.max(-maxOffset, Math.min(maxOffset, moveX));
    moveY = Math.max(-maxOffset, Math.min(maxOffset, moveY));
    
    const pupilLeft = document.querySelector('.cat-pupil');
    const pupilRight = document.querySelectorAll('.cat-pupil')[1];
    
    if (pupilLeft) {
      pupilLeft.style.transform = `translate(${moveX}px, ${moveY}px)`;
    }
    if (pupilRight) {
      pupilRight.style.transform = `translate(${moveX}px, ${moveY}px)`;
    }
  };
  
  document.addEventListener('mousemove', catMouseHandler);
}

function showRandomCatPhrase() {
  if (!catVisible) return;
  
  const speech = document.getElementById('catSpeech');
  if (!speech) return;
  
  const phrase = CAT_PHRASES[Math.floor(Math.random() * CAT_PHRASES.length)];
  speech.textContent = phrase;
  speech.style.animation = 'none';
  speech.offsetHeight;
  speech.style.animation = 'speechPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
  
  catTimeout = setTimeout(() => {
    if (catVisible) showRandomCatPhrase();
  }, 4000);
}

/* ── TASKS ── */
const STOR_TASKS = 'planyr-tasks-v2';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STOR_TASKS);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
    }
  } catch(e) {}
  return [];
}

function saveTasks() {
  try { localStorage.setItem(STOR_TASKS, JSON.stringify(STATE.tasks)); } catch(e) {}
}

function cleanupOldTasks() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const before = STATE.tasks.length;
  STATE.tasks = STATE.tasks.filter(task => {
    if (!task.done || !task.completedAt) return true;
    const completedDate = new Date(task.completedAt);
    return completedDate > thirtyDaysAgo;
  });
  
  if (STATE.tasks.length !== before) {
    saveTasks();
  }
}

function exportTasks() {
  const data = {
    app: 'Планер для коти - Задачи',
    version: '2.0',
    exported: new Date().toISOString(),
    tasks: STATE.tasks
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Задачи экспортированы ✅');
}

function importTasks(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.tasks) {
        if (Array.isArray(data.tasks)) {
          STATE.tasks = [...STATE.tasks, ...data.tasks];
        }
        saveTasks();
        showToast('Задачи импортированы ✅');
        if (document.getElementById('viewTasks').classList.contains('active')) {
          renderTasksView();
        }
      }
    } catch(err) {
      showToast('Ошибка импорта ❌');
    }
  };
  reader.readAsText(file);
}

function renderTasksView() {
  const view = document.getElementById('viewTasks');
  const title = document.getElementById('tasksTitle');
  const list = document.getElementById('tasksList');
  const input = document.getElementById('tasksInput');
  
  if (!view || !title || !list) return;
  
  title.textContent = '📋 Мои задачи';
  
  if (STATE.tasks.length === 0) {
    list.innerHTML = `
      <div class="tasks-empty">
        <div class="tasks-empty-icon">📝</div>
        <div class="tasks-empty-text">Нет задач</div>
        <div class="tasks-empty-sub">Добавьте задачу ниже</div>
      </div>
    `;
  } else {
    list.innerHTML = STATE.tasks.map((task, idx) => `
      <div class="task-item ${task.done ? 'completed' : ''}" data-idx="${idx}" data-task-id="${task.id}">
        <button class="task-checkbox ${task.done ? 'checked' : ''}" data-action="toggle"></button>
        <span class="task-text-view" data-action="edit-full">${escapeHtml(task.text)}${task.dueDate ? `<span class="task-due-badge">📅 ${formatDueDate(task.dueDate)}</span>` : ''}</span>
        <button class="task-edit-btn" data-action="edit-full" title="Редактировать">✎</button>
        <button class="task-delete" data-action="delete">✕</button>
      </div>
    `).join('');
  }
  
  if (input) {
    input.value = '';
    input.focus();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDueDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
  
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function showTaskEditor(taskId) {
  const taskIdx = STATE.tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) return;
  
  const task = STATE.tasks[taskIdx];
  
  const editor = document.createElement('div');
  editor.className = 'task-editor-overlay';
  editor.innerHTML = `
    <div class="task-editor">
      <div class="task-editor-header">
        <h3>Редактировать задачу</h3>
        <button class="task-editor-close" data-action="close">✕</button>
      </div>
      <div class="task-editor-body">
        <div class="task-editor-field">
          <label>Текст задачи</label>
          <input type="text" class="task-editor-input" id="taskEditorText" value="${escapeHtml(task.text)}"/>
        </div>
        <div class="task-editor-field">
          <label>Дата выполнения</label>
          <input type="date" class="task-editor-input" id="taskEditorDate" value="${task.dueDate || ''}"/>
        </div>
        <div class="task-editor-actions">
          <button class="task-editor-save" data-action="save">💾 Сохранить</button>
          <button class="task-editor-cancel" data-action="cancel">Отмена</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(editor);
  
  const closeEditor = () => {
    editor.remove();
  };
  
  editor.querySelector('[data-action="close"]').addEventListener('click', closeEditor);
  editor.querySelector('[data-action="cancel"]').addEventListener('click', closeEditor);
  editor.querySelector('[data-action="save"]').addEventListener('click', () => {
    const newText = document.getElementById('taskEditorText').value.trim();
    const newDate = document.getElementById('taskEditorDate').value;
    
    if (newText) {
      STATE.tasks[taskIdx].text = newText;
      STATE.tasks[taskIdx].dueDate = newDate || null;
      saveTasks();
      renderTasksView();
      showToast('Задача сохранена ✓');
    }
    closeEditor();
  });
  
  editor.addEventListener('click', (e) => {
    if (e.target === editor) closeEditor();
  });
  
  document.getElementById('taskEditorText').focus();
}

function addTask() {
  const input = document.getElementById('tasksInput');
  if (!input || !input.value.trim()) return;
  
  STATE.tasks.push({
    id: Date.now(),
    text: input.value.trim(),
    done: false,
    created: new Date().toISOString()
  });
   
  saveTasks();
  input.value = '';
  renderTasksView();
  cleanupOldTasks();
}

function toggleTask(idx) {
  if (STATE.tasks[idx]) {
    const task = STATE.tasks[idx];
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : null;
    saveTasks();
    renderTasksView();
    if (task.done) cleanupOldTasks();
  }
}

function updateTaskText(idx, text) {
  if (STATE.tasks[idx]) {
    STATE.tasks[idx].text = text;
    saveTasks();
  }
}

function deleteTask(idx) {
  STATE.tasks.splice(idx, 1);
  saveTasks();
  renderTasksView();
}

function initTasksEvents() {
  const list = document.getElementById('tasksList');
  const input = document.getElementById('tasksInput');
  const addBtn = document.getElementById('tasksAddBtn');
  
  if (list) {
    list.addEventListener('click', e => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      const action = e.target.dataset.action;
      
      if (action === 'delete') {
        deleteTask(idx);
      } else if (action === 'edit-full') {
        const taskId = parseInt(item.dataset.taskId);
        showTaskEditor(taskId);
      } else {
        toggleTask(idx);
      }
    });
    
    list.addEventListener('dblclick', e => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      const taskId = parseInt(item.dataset.taskId);
      showTaskEditor(taskId);
    });
    
    let longPressTimer = null;
    list.addEventListener('touchstart', e => {
      const item = e.target.closest('.task-item');
      if (!item || e.target.dataset.action === 'toggle' || e.target.dataset.action === 'delete' || e.target.dataset.action === 'edit-full') return;
      longPressTimer = setTimeout(() => {
        const taskId = parseInt(item.dataset.taskId);
        showTaskEditor(taskId);
      }, 500);
    }, { passive: true });
    
    list.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
    
    list.addEventListener('touchmove', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });
  }
  
  if (addBtn) {
    addBtn.addEventListener('click', addTask);
  }
  
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') addTask();
    });
  }
}

function showTasksMode() {
  if (STATE.tasksMode) {
    hideTasksMode();
  } else {
    STATE.tasksMode = true;
    document.getElementById('viewGame').classList.remove('active');
    document.getElementById('viewPro').classList.remove('active');
    document.getElementById('viewTasks').classList.add('active');
    document.getElementById('dockTasks').classList.add('liquid-active');
    renderTasksView();
  }
}

function hideTasksMode() {
  STATE.tasksMode = null;
  document.getElementById('viewTasks').classList.remove('active');
  document.getElementById('dockTasks').classList.remove('liquid-active');
  switchMode(STATE.mode);
}

/* ── STATE ── */
const STATE = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth(),
  days:  [],
  mode:  'game',
  view:  'daily',
  rates:      { ...DEFAULT_RATES },
  taxes:      { ...DEFAULT_TAXES },
  ndfl:       { ...DEFAULT_NDFL },
  rateTypes:  { ...DEFAULT_RATE_TYPES },
  normHours:  { work1: 8, work2: 8 },
  labels:     { work1: 'Работа 1', work2: 'Работа 2', both: 'Обе' },
  workTypes:  [...DEFAULT_WORK_TYPES],
  expenses: [],
  bonuses: [],
  tasks: [],
  tasksMode: null,
  dayNotes: {},
  autoStrategy: null,
  popup:  { open: false, dayIdx: -1, type: 'none', shift: 'none', start: '', end: '' },
  drawer: { open: false, panel: '', incomeTab: 'summary' },
  exportPopupOpen: false,
  tod: 'day',
};

/* ── PERSISTENCE ── */
const STOR    = 'planyr-data-v3';
const STOR_ALL= 'planyr-all-v2';
const STOR_BONUSES = 'planyr-bonuses-v1';
const STOR_DAY_NOTES = 'planyr-day-notes-v1';

function loadDayNotes() {
  try {
    const raw = localStorage.getItem(STOR_DAY_NOTES);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {};
}

function saveDayNotes() {
  try { localStorage.setItem(STOR_DAY_NOTES, JSON.stringify(STATE.dayNotes)); } catch(e) {}
}

function getDayNoteKey(day) {
  return `${STATE.year}-${STATE.month}-${day}`;
}

function showDayNoteEditor(day) {
  const key = getDayNoteKey(day);
  const existingNote = STATE.dayNotes[key] || '';
  
  const overlay = document.createElement('div');
  overlay.className = 'task-editor-overlay';
  overlay.innerHTML = `
    <div class="task-editor">
      <div class="task-editor-header">
        <h3>📝 Заметка на ${day} ${MONTH_NAMES_UK[STATE.month]}</h3>
        <button class="task-editor-close" data-action="close">✕</button>
      </div>
      <div class="task-editor-body">
        <div class="task-editor-field">
          <label>Текст заметки</label>
          <textarea class="task-editor-input task-editor-textarea" id="dayNoteText" placeholder="Введите заметку...">${escapeHtml(existingNote)}</textarea>
        </div>
        <div class="task-editor-actions">
          <button class="task-editor-save" data-action="save">💾 Сохранить</button>
          <button class="task-editor-cancel" data-action="cancel">Отмена</button>
        </div>
        ${existingNote ? '<button class="task-editor-delete" data-action="delete" style="margin-top:12px;width:100%;padding:12px;background:rgba(255,59,48,0.1);border:none;border-radius:12px;color:var(--danger);font-weight:600;cursor:pointer;">🗑 Удалить заметку</button>' : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => overlay.remove());
  
  overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
    const text = document.getElementById('dayNoteText').value.trim();
    if (text) {
      STATE.dayNotes[key] = text;
    } else {
      delete STATE.dayNotes[key];
    }
    saveDayNotes();
    overlay.remove();
    renderGameGrid();
    showToast('Заметка сохранена ✓');
  });
  
  overlay.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    delete STATE.dayNotes[key];
    saveDayNotes();
    overlay.remove();
    renderGameGrid();
    showToast('Заметка удалена');
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.getElementById('dayNoteText').focus();
}

function saveState() {
  try { localStorage.setItem(STOR, JSON.stringify({
    year: STATE.year, month: STATE.month, days: STATE.days,
    rates: STATE.rates, taxes: STATE.taxes, ndfl: STATE.ndfl,
    rateTypes: STATE.rateTypes, normHours: STATE.normHours, labels: STATE.labels, 
    mode: STATE.mode, workTypes: STATE.workTypes,
  })); } catch(e) {}
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STOR) || '{}');
    if (s.year      !== undefined) STATE.year      = s.year;
    if (s.month     !== undefined) STATE.month     = s.month;
    if (s.days)                    STATE.days      = s.days;
    if (s.rates)     STATE.rates     = { ...DEFAULT_RATES,      ...s.rates };
    if (s.taxes)     STATE.taxes     = { ...DEFAULT_TAXES,      ...s.taxes };
    if (s.ndfl)      STATE.ndfl      = { ...DEFAULT_NDFL,       ...s.ndfl };
    if (s.rateTypes) STATE.rateTypes = { ...DEFAULT_RATE_TYPES, ...s.rateTypes };
    if (s.normHours) STATE.normHours = { work1: 8, work2: 8,    ...s.normHours };
    if (s.labels) {
      STATE.labels = { work1:'Работа 1', work2:'Работа 2', both:'Обе', ...s.labels };
      if (STATE.labels.work1 === 'Робота 1') STATE.labels.work1 = 'Работа 1';
      if (STATE.labels.work2 === 'Робота 2') STATE.labels.work2 = 'Работа 2';
      if (STATE.labels.both === 'Обидві') STATE.labels.both = 'Обе';
    }
    if (s.workTypes && Array.isArray(s.workTypes) && s.workTypes.length > 0) {
      STATE.workTypes = s.workTypes;
    }
    if (s.mode)      STATE.mode      = s.mode;
  } catch(e) {}
}

function saveBonuses() {
  try { localStorage.setItem(STOR_BONUSES, JSON.stringify(STATE.bonuses)); } catch(e) {}
}

function loadBonuses() {
  try {
    const raw = localStorage.getItem(STOR_BONUSES);
    if (raw) STATE.bonuses = JSON.parse(raw);
    else STATE.bonuses = [];
  } catch(e) { STATE.bonuses = []; }
}

function calcTotalBonuses() {
  return STATE.bonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
}

function saveAllMonths() {
  try {
    const all = JSON.parse(localStorage.getItem(STOR_ALL) || '{}');
    all[`${STATE.year}-${STATE.month}`] = STATE.days;
    localStorage.setItem(STOR_ALL, JSON.stringify(all));
  } catch(e) {}
}

function ensureMonthDays() {
  try {
    const all = JSON.parse(localStorage.getItem(STOR_ALL) || '{}');
    const k = `${STATE.year}-${STATE.month}`;
    if (all[k]) { STATE.days = all[k]; return; }
  } catch(e) {}
  STATE.days = buildMonthDays(STATE.year, STATE.month);
}

/* ── TIME-OF-DAY ── */
const GREETINGS = { morning:'☀️ Доброе утро!', day:'🌤 Добрый день!', evening:'🌆 Добрый вечер!', night:'🌙 Доброй ночи~' };

function getTOD() {
  const h = new Date().getHours();
  if (h >=  5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}
function applyTOD() {
  const tod = getTOD();
  STATE.tod = tod;
  document.body.dataset.tod = tod;
  const el = document.getElementById('timeGreeting');
  if (el) el.textContent = GREETINGS[tod] || '';
}

/* ── TYPE LABEL HELPERS ── */
function typeLabel(type) {
  if (type === 'off') return '🌿 Выходной';
  if (type === 'none') return '—';
  if (type === 'work1' || type === 'work2' || type === 'both') {
    return STATE.labels[type] || type;
  }
  const wt = STATE.workTypes.find(w => w.id === type);
  if (wt) {
    return STATE.labels[type] || wt.name;
  }
  return '—';
}

function typeEmoji(type) {
  if (type === 'off') return '🌿';
  if (type === 'work1' || type === 'work2' || type === 'both') {
    const wt = STATE.workTypes.find(w => w.id === type);
    return wt?.emoji || '💼';
  }
  const wt = STATE.workTypes.find(w => w.id === type);
  return wt?.emoji || '💼';
}

function buildTypeButtons() {
  const container = document.getElementById('dayTypeSegment');
  if (!container) return;
  
  container.innerHTML = '';
  
  STATE.workTypes.forEach(wt => {
    const btn = document.createElement('button');
    btn.className = 'seg-btn';
    btn.dataset.type = wt.id;
    btn.id = `typeBtn${wt.id.charAt(0).toUpperCase() + wt.id.slice(1)}`;
    btn.textContent = `${wt.emoji} ${wt.name}`;
    container.appendChild(btn);
  });
  
  const offBtn = document.createElement('button');
  offBtn.className = 'seg-btn';
  offBtn.dataset.type = 'off';
  offBtn.textContent = '🌿 Выходной';
  container.appendChild(offBtn);
  
  syncTypeSegment(STATE.popup.type);
}

function updatePopupTypeLabels() {
  buildTypeButtons();
}

/* ── YEARLY VIEW ── */
function renderYearlyView() {
  const grid = document.getElementById('daysGrid');
  if (!grid) return;
  
  let yearHtml = `<div class="yearly-view">`;
  yearHtml += `<div class="yearly-header"><div class="yearly-title">📅 ${STATE.year}</div><div class="yearly-hint">👆 Нажмите на месяц чтобы открыть календарь</div></div>`;
  yearHtml += `<div class="yearly-grid">`;
  
  for (let m = 0; m < 12; m++) {
    let daysData;
    try {
      const all = JSON.parse(localStorage.getItem(STOR_ALL) || '{}');
      const key = `${STATE.year}-${m}`;
      daysData = all[key] || buildMonthDays(STATE.year, m);
    } catch(e) {
      daysData = buildMonthDays(STATE.year, m);
    }
    
    const sm = buildIncomeSummary(daysData, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours);
    const workDays = daysData.filter(d => d.type && d.type !== 'none' && d.type !== 'off').length;
    const offDays = daysData.filter(d => d.type === 'off').length;
    
    yearHtml += `
      <div class="year-month-card" data-month="${m}">
        <div class="year-month-name">${MONTH_NAMES_UK[m].slice(0, 3)}</div>
        <div class="year-month-stats">
          <div class="year-stat">
            <span class="year-stat-value">${workDays}</span>
            <span class="year-stat-label">раб</span>
          </div>
          <div class="year-stat">
            <span class="year-stat-value">${offDays}</span>
            <span class="year-stat-label">вых</span>
          </div>
        </div>
        <div class="year-month-income">${sm.totalNet > 0 ? formatCurrency(sm.totalNet) : '—'}</div>
      </div>
    `;
  }
  
  yearHtml += `</div></div>`;
  grid.innerHTML = yearHtml;
  
  grid.querySelectorAll('.year-month-card').forEach(card => {
    card.addEventListener('click', () => {
      STATE.month = parseInt(card.dataset.month);
      STATE.view = 'daily';
      STATE.tasksMode = null;
      ensureMonthDays();
      showToast(`${MONTH_NAMES_UK[STATE.month]} ${STATE.year}`);
      renderAll();
      saveState();
    });
  });
}

/* ── MONTHLY VIEW ── */
function renderMonthlyView() {
  const grid = document.getElementById('daysGrid');
  if (!grid) return;
  
  const sm = buildIncomeSummary(STATE.days, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours);
  const offDays = STATE.days.filter(d => d.type === 'off').length;
  
  const workStatsHtml = STATE.workTypes.map(wt => {
    const days = STATE.days.filter(d => d.type === wt.id).length;
    return `
      <div class="monthly-stat ${wt.id}-stat">
        <div class="stat-icon">${wt.emoji}</div>
        <div class="stat-name">${STATE.labels[wt.id] || wt.name}</div>
        <div class="stat-value">${days} дн</div>
      </div>
    `;
  }).join('');
  
  const workDays = STATE.days.filter(d => 
    d.type && d.type !== 'none' && d.type !== 'off'
  ).length;
  
  grid.innerHTML = `
    <div class="monthly-view">
      <div class="monthly-header">
        <div class="monthly-icon">📅</div>
        <div class="monthly-title">${MONTH_NAMES_UK[STATE.month]} ${STATE.year}</div>
      </div>
      
      <div class="monthly-stats">
        ${workStatsHtml}
        <div class="monthly-stat off-stat">
          <div class="stat-icon">🌿</div>
          <div class="stat-name">Выходных</div>
          <div class="stat-value">${offDays} дн</div>
        </div>
      </div>
      
      <div class="monthly-summary">
        <div class="summary-row">
          <span class="summary-label">Всего рабочих дней:</span>
          <span class="summary-value">${workDays} дней</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Всего часов:</span>
          <span class="summary-value">${sm.worked} ч</span>
        </div>
        ${calcTotalBonuses() > 0 ? `<div class="summary-row"><span class="summary-label">🎁 Бонусы:</span><span class="summary-value" style="color:var(--c-work1)">+${formatCurrency(calcTotalBonuses())}</span></div>` : ''}
        <div class="summary-row highlight">
          <span class="summary-label">💰 Чистый доход:</span>
          <span class="summary-value">${formatCurrency(sm.totalNet + calcTotalBonuses())}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Среднее/день:</span>
          <span class="summary-value">${formatCurrency(sm.avgPerDay)}</span>
        </div>
      </div>
      
      <div class="monthly-tap-hint">👆 Нажмите на название месяца вверху чтобы открыть годовой календарь</div>
    </div>
  `;
}

/* ── GAME GRID ── */
function renderGameGrid() {
  const grid = document.getElementById('daysGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const hint = document.createElement('div');
  hint.style.cssText = 'grid-column: 1 / -1; text-align: center; font-size: 0.75rem; color: var(--text-tertiary); padding: 8px 0 4px;';
  hint.textContent = '💡 Удерживайте на дне чтобы добавить заметку';
  grid.appendChild(hint);

  WEEKDAY_NAMES_UK.forEach(n => {
    const h = document.createElement('div');
    h.className = 'day-header'; h.textContent = n; grid.appendChild(h);
  });

  const firstDow = getDow(STATE.year, STATE.month, 1);
  for (let i = 0; i < firstDow; i++) {
    const b = document.createElement('div');
    b.className = 'day-card empty'; b.setAttribute('aria-hidden','true'); grid.appendChild(b);
  }

  const today = new Date();
  let longPressTimer = null;

  STATE.days.forEach((day, idx) => {
    const card = document.createElement('div');
    card.className = 'day-card';
    card.setAttribute('role','listitem'); card.setAttribute('tabindex','0');

    const dow = getDow(day.year, day.month, day.date);
    if (dow === 0 || dow === 6) card.classList.add('weekend');
    if (day.year === today.getFullYear() && day.month === today.getMonth() && day.date === today.getDate())
      card.classList.add('today');
    if (day.type && day.type !== 'none') card.classList.add(`type-${day.type}`);

    // Accent strip
    const acc = document.createElement('div'); acc.className = 'card-accent'; card.appendChild(acc);

    const dateEl = document.createElement('div'); dateEl.className = 'card-date'; dateEl.textContent = day.date; card.appendChild(dateEl);
    const nameEl = document.createElement('div'); nameEl.className = 'card-dayname'; nameEl.textContent = WEEKDAY_NAMES_UK[dow]; card.appendChild(nameEl);

    if (day.type && day.type !== 'none' && day.type !== 'off') {
      if (day.shift && day.shift !== 'none') {
        const em = document.createElement('div'); em.className = 'card-shift-emoji';
        em.textContent = SHIFT_PRESETS[day.shift]?.emoji || ''; card.appendChild(em);
      }
      if (day.hours > 0) {
        const hr = document.createElement('div'); hr.className = 'card-hours';
        hr.textContent = `${day.hours}h`; card.appendChild(hr);
      }
       // Show job name label
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:.64rem;font-weight:700;color:var(--text-tertiary);margin-top:2px';
      lbl.textContent = STATE.labels[day.type] || '';
      card.appendChild(lbl);
    } else if (day.type === 'off') {
      const em = document.createElement('div'); em.className = 'card-shift-emoji'; em.textContent = '🌿'; card.appendChild(em);
      const pw = document.createElement('div'); pw.className = 'paw-decor'; pw.textContent = '🐾'; card.appendChild(pw);
    }
    
    // Note indicator
    const noteKey = getDayNoteKey(day.date);
    if (STATE.dayNotes[noteKey]) {
      const noteIndicator = document.createElement('div');
      noteIndicator.className = 'card-note-indicator';
      noteIndicator.textContent = '📝';
      noteIndicator.title = STATE.dayNotes[noteKey].substring(0, 50);
      card.appendChild(noteIndicator);
    }

    // 3D tilt
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const xp = (e.clientX - r.left) / r.width - 0.5;
      const yp = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${-yp*9}deg) rotateY(${xp*9}deg) translateZ(5px) scale(1.01)`;
    }, { passive:true });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });

    // Single click → full popup
    let clickTime = 0;
    card.addEventListener('click', () => {
      const now = Date.now();
      if (now - clickTime < 280) {
        // Double-click: quick cycle type
        const workTypeIds = STATE.workTypes.map(wt => wt.id);
        const order = ['none', ...workTypeIds, 'off'];
        const ci = order.indexOf(day.type || 'none');
        day.type = order[(ci + 1) % order.length];
        day.shift = day.type === 'off' || day.type === 'none' ? 'none' : (day.shift || 'day');
        if (day.type !== 'off' && day.type !== 'none') {
          if (!day.start) applyShift(day, 'day', '', '');
        } else { day.start = ''; day.end = ''; day.hours = 0; }
        renderAll(); saveState(); saveAllMonths();
        showToast(`${day.date} → ${typeLabel(day.type)}`);
      } else {
        clickTime = now;
        setTimeout(() => {
          if (Date.now() - clickTime >= 260) openDayPopup(idx, card);
        }, 270);
      }
    });

    // Long-press → note editor
    const startLong = (e) => {
      longPressTimer = setTimeout(() => {
        showDayNoteEditor(day.date);
      }, 500);
    };
    const cancelLong = () => clearTimeout(longPressTimer);
    card.addEventListener('mousedown',  startLong, { passive:true });
    card.addEventListener('mouseup',    cancelLong);
    card.addEventListener('mouseleave', cancelLong);
    card.addEventListener('touchstart', startLong, { passive:true });
    card.addEventListener('touchend',   cancelLong, { passive:true });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDayPopup(idx, card); }
    });

    grid.appendChild(card);
  });
}

/* ── QUICK PICKER (long-press) ── */
function showQuickPicker(dayIdx, x, y) {
  document.querySelectorAll('.quick-picker').forEach(e => e.remove());
  const picker = document.createElement('div');
  picker.className = 'quick-picker';
  
  STATE.workTypes.forEach(wt => {
    const btn = document.createElement('button');
    btn.className = 'qp-btn'; btn.textContent = wt.emoji;
    btn.title = STATE.labels[wt.id] || wt.name;
    btn.addEventListener('click', () => {
      const day = STATE.days[dayIdx];
      day.type = wt.id;
      if (!day.start) applyShift(day, 'day', '', '');
      picker.remove();
      renderAll(); saveState(); saveAllMonths();
      showToast(`${day.date} → ${STATE.labels[wt.id] || wt.name}`);
    });
    picker.appendChild(btn);
  });
  
  const offBtn = document.createElement('button');
  offBtn.className = 'qp-btn'; offBtn.textContent = '🌿';
  offBtn.title = 'Выходной';
  offBtn.addEventListener('click', () => {
    const day = STATE.days[dayIdx];
    day.type = 'off';
    day.shift='none'; day.start=''; day.end=''; day.hours=0;
    picker.remove();
    renderAll(); saveState(); saveAllMonths();
    showToast(`${day.date} → 🌿 Выходной`);
  });
  picker.appendChild(offBtn);
  
  const noneBtn = document.createElement('button');
  noneBtn.className = 'qp-btn'; noneBtn.textContent = '✕';
  noneBtn.title = 'Очистить';
  noneBtn.addEventListener('click', () => {
    const day = STATE.days[dayIdx];
    day.type = 'none';
    day.shift='none'; day.start=''; day.end=''; day.hours=0;
    picker.remove();
    renderAll(); saveState(); saveAllMonths();
    showToast(`${day.date} → очищен`);
  });
  picker.appendChild(noneBtn);
  
  // Position near click
  const pw = 260, ph = 62;
  picker.style.left = Math.max(8, Math.min(x - pw/2, window.innerWidth - pw - 8)) + 'px';
  picker.style.top  = Math.max(80, y - ph - 12) + 'px';
  document.body.appendChild(picker);
  // Close on outside click
  const close = e => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 100);
}

/* ── PRO TABLE ── */
function renderProTable() {
  const tbody = document.getElementById('proTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  STATE.days.forEach((day, idx) => {
    const dow   = getDow(day.year, day.month, day.date);
    const ti    = DAY_TYPES[day.type] || DAY_TYPES.none;
    const si    = SHIFT_PRESETS[day.shift] || {};
    const dts   = calcDayDetails(day, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours);
    const gross = dts.gross;
    const pdv   = dts.pdv;
    const ndfl  = dts.ndfl;
    const net   = dts.net;
    const hours = dts.hours;
    const lname = typeLabel(day.type);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${WEEKDAY_NAMES_UK[dow]}</td>
      <td><strong>${day.date}</strong></td>
      <td><span class="pro-type-badge ${day.type}" tabindex="0" role="button">${typeEmoji(day.type)} ${lname}</span></td>
      <td>${si.emoji||''} ${si.label||'—'}</td>
      <td class="pro-hours-cell">${hours > 0 ? hours+'h' : '—'}</td>
      <td class="pro-income-cell">${gross>0?formatCurrency(gross):'—'}</td>
      <td style="color:#FF6B6B;font-weight:700">${pdv>0?'-'+formatCurrency(pdv):'—'}</td>
      <td style="color:#FF9500;font-weight:700">${ndfl>0?'-'+formatCurrency(ndfl):'—'}</td>
      <td class="pro-income-cell">${net>0?formatCurrency(net):'—'}</td>`;
    tr.querySelector('.pro-type-badge').addEventListener('click', () => openDayPopup(idx, tr));
    tbody.appendChild(tr);
  });
}

/* ── RENDER ALL ── */
function renderAll() {
  const t = document.getElementById('monthTitle');
  if (t) t.textContent = `${MONTH_NAMES_UK[STATE.month]} ${STATE.year}`;
  updatePopupTypeLabels();
  
  if (STATE.view === 'yearly') {
    renderYearlyView();
  } else if (STATE.view === 'monthly') {
    renderMonthlyView();
  } else {
    if (STATE.mode === 'game') renderGameGrid();
    else                       renderProTable();
  }
}

/* ── MODE ── */
function switchMode(mode) {
  if (STATE.tasksMode) return;
  STATE.mode = mode;
  STATE.view = 'daily';
  document.getElementById('viewGame').classList.toggle('active', mode === 'game');
  document.getElementById('viewPro').classList.toggle('active',  mode === 'pro');
  document.getElementById('gameModeBtn').classList.toggle('active', mode === 'game');
  document.getElementById('proModeBtn').classList.toggle('active',  mode === 'pro');
  renderAll(); saveState();
}

/* ── POPUP ── */
function openDayPopup(dayIdx, anchor) {
  const day = STATE.days[dayIdx];
  if (!day) return;
  STATE.popup = { ...STATE.popup, open:true, dayIdx, type:day.type||'none', shift:day.shift||'none', start:day.start||'', end:day.end||'' };
  const dow = getDow(day.year, day.month, day.date);
  document.getElementById('popupDayLabel').textContent = `${WEEKDAY_LONG_UK[dow]}, ${day.date} ${MONTH_NAMES_UK[day.month]}`;
  updatePopupTypeLabels();
  syncTypeSegment(STATE.popup.type);
  syncShiftPills(STATE.popup.shift);
  document.getElementById('startTime').value = STATE.popup.start;
  document.getElementById('endTime').value   = STATE.popup.end;
  updateHoursBadge();
  toggleShiftSection(STATE.popup.type !== 'off' && STATE.popup.type !== 'none');
  document.getElementById('dayPopup').classList.add('visible');
  document.getElementById('popupOverlay').classList.add('visible');
  requestAnimationFrame(() => positionPopup(anchor));
}

function closeDayPopup() {
  STATE.popup.open = false;
  document.getElementById('dayPopup').classList.remove('visible');
  document.getElementById('popupOverlay').classList.remove('visible');
}

function positionPopup(anchor) {
  const pop = document.getElementById('dayPopup');
  if (window.innerWidth <= 560) { pop.style.left=pop.style.top=''; return; }
  
  const W = Math.min(420, window.innerWidth - 40);
  const left = (window.innerWidth - W) / 2;
  const top = (window.innerHeight - 480) / 2;
  
  pop.style.left = `${left}px`; 
  pop.style.top = `${top}px`;
  pop.style.right = 'auto';
  pop.style.bottom = 'auto';
  pop.style.width = `${W}px`;
  pop.style.transformOrigin = 'center center';
}

function syncTypeSegment(type) {
  document.querySelectorAll('#dayTypeSegment .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}
function syncShiftPills(shift) {
  document.querySelectorAll('#shiftPresets .shift-pill').forEach(b => b.classList.toggle('active', b.dataset.shift === shift));
}
function toggleShiftSection(show) {
  document.getElementById('shiftSection').classList.toggle('hidden', !show);
}
function updateHoursBadge() {
  const s = document.getElementById('startTime').value;
  const e = document.getElementById('endTime').value;
  const h = calcHours(s,e);
  document.getElementById('hoursBadge').textContent = h > 0 ? `${h}h` : '0h';
  STATE.popup.start = s; STATE.popup.end = e;
}

function savePopup() {
  const idx = STATE.popup.dayIdx;
  if (idx < 0) return;
  const day = STATE.days[idx];
  day.type = STATE.popup.type;
  if (day.type === 'off' || day.type === 'none') {
    day.shift='none'; day.start=''; day.end=''; day.hours=0;
  } else {
    const sk = STATE.popup.shift === 'none' ? 'day' : STATE.popup.shift;
    applyShift(day, sk, STATE.popup.start, STATE.popup.end);
    const preset = SHIFT_PRESETS[sk];
    if (STATE.popup.start && STATE.popup.end &&
        preset && (preset.start !== STATE.popup.start || preset.end !== STATE.popup.end)) {
      day.shift = 'custom'; day.start = STATE.popup.start; day.end = STATE.popup.end;
      day.hours = calcHours(STATE.popup.start, STATE.popup.end);
    }
  }
  closeDayPopup(); renderAll(); saveState(); saveAllMonths();
  showToast(`${day.date} ${MONTH_NAMES_UK[day.month]} сохранено ✓`);
}

/* ── DRAWER ── */
function openDrawer(panel) {
  STATE.drawer = { ...STATE.drawer, open:true, panel };
  const titles = { charts:'📊 Графики', income:'💰 Доход', expenses:'🏠 Расходы', auto:'🗓 Автографик', settings:'⚙️ Настройки' };
  document.getElementById('drawerTitle').textContent = titles[panel] || '';
  document.getElementById('drawerContent').innerHTML = '';
  if (panel === 'charts')    renderChartsPanel(document.getElementById('drawerContent'), STATE);
  if (panel === 'income')   renderIncomePanel();
  if (panel === 'expenses') renderExpensesPanel();
  if (panel === 'auto')     renderAutoPanel();
  if (panel === 'settings') {
    renderSettingsPanel();
    updateProfileUI(getCurrentUser());
  }
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('visible');
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
  const map = { charts:'dockCharts', income:'dockIncome', expenses:'dockExpenses', auto:'dockAuto', settings:'dockSettings' };
  if (map[panel]) document.getElementById(map[panel])?.classList.add('active');
}

function closeDrawer() {
  STATE.drawer.open = false;
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('visible');
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
}

/* ── INCOME PANEL ── */
function renderIncomePanel() {
  const c = document.getElementById('drawerContent');
  const sm = buildIncomeSummary(STATE.days, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours);
  const totalExp = calcTotalExpenses(STATE.expenses, STATE.days);
  const totalBonus = calcTotalBonuses();
  const net = sm.totalNet + totalBonus - totalExp;

  c.innerHTML = `
    <div class="segmented income-toggle" id="incomeToggle">
      <button class="seg-btn ${STATE.drawer.incomeTab==='summary'?'active':''}" data-tab="summary">📊 Итог</button>
      <button class="seg-btn ${STATE.drawer.incomeTab==='stats'?'active':''}" data-tab="stats">📈 По работам</button>
      <button class="seg-btn ${STATE.drawer.incomeTab==='bonus'?'active':''}" data-tab="bonus">🎁 Бонусы</button>
      <button class="seg-btn ${STATE.drawer.incomeTab==='details'?'active':''}" data-tab="details">📋 Дни</button>
    </div>
    <div id="incomeTabContent"></div>`;

  const renderTab = tab => {
    const tc = document.getElementById('incomeTabContent');
    if (tab === 'summary') {
      tc.innerHTML = `
        <div class="income-summary-cards">
          <div class="income-card highlight">
            <div class="income-card-label">Чистый доход</div>
            <div class="income-card-value">${formatCurrency(sm.totalNet + totalBonus)}</div>
            <div class="income-card-sub">${sm.workedDays} дней · ${sm.worked}h · Грязными ${formatCurrency(sm.totalGross)}</div>
          </div>
          ${totalBonus > 0 ? `<div class="income-card"><div class="income-card-label">🎁 Бонусы</div><div class="income-card-value" style="font-size:1.3rem;color:var(--c-work1)">+${formatCurrency(totalBonus)}</div></div>` : ''}
          ${sm.totalPdv ? `<div class="income-card"><div class="income-card-label">🔴 НДС</div><div class="income-card-value" style="font-size:1.3rem;color:#FF6B6B">-${formatCurrency(sm.totalPdv)}</div></div>` : ''}
          ${sm.totalNdfl ? `<div class="income-card"><div class="income-card-label">🟠 НДФЛ</div><div class="income-card-value" style="font-size:1.3rem;color:#FF9500">-${formatCurrency(sm.totalNdfl)}</div></div>` : ''}
          <div class="income-card"><div class="income-card-label">Ср./день</div><div class="income-card-value" style="font-size:1.3rem">${formatCurrency(sm.avgPerDay)}</div></div>
          <div class="income-card"><div class="income-card-label">Часов</div><div class="income-card-value" style="font-size:1.3rem">${sm.worked}h</div></div>
          <div class="income-card"><div class="income-card-label">🌿 Выходных</div><div class="income-card-value" style="font-size:1.3rem">${sm.offDays}</div></div>
        </div>
        ${totalExp > 0 ? `<div class="net-cashflow-row"><span class="net-cashflow-label">💳 Остаток = Доход − Расходы</span><span class="net-cashflow-value" style="${net<0?'color:#FF9999':''}">${formatCurrency(net)}</span></div>` : ''}`;
    } else if (tab === 'stats') {
      let html = '';
      ['work1','work2','both'].forEach(t => {
        const s = sm.byType[t]; if (!s || !s.days) return;
        const ti = DAY_TYPES[t];
        html += `<div class="stat-row">
          <span class="stat-badge ${t}">${ti.emoji} ${STATE.labels[t]||ti.label}</span>
          <div class="stat-nums">
            <div class="stat-num"><span class="stat-num-label">Дней</span><span class="stat-num-value">${s.days}</span></div>
            <div class="stat-num"><span class="stat-num-label">Часы</span><span class="stat-num-value">${Math.round(s.hours*10)/10}h</span></div>
            <div class="stat-num"><span class="stat-num-label">Чисто</span><span class="stat-num-value" style="color:var(--accent)">${formatCurrency(s.net)}</span></div>
            ${s.pdv ? `<div class="stat-num"><span class="stat-num-label">НДС</span><span class="stat-num-value" style="color:var(--danger)">-${formatCurrency(s.pdv)}</span></div>` : ''}
            ${s.ndfl ? `<div class="stat-num"><span class="stat-num-label">НДФЛ</span><span class="stat-num-value" style="color:var(--warning)">-${formatCurrency(s.ndfl)}</span></div>` : ''}
          </div></div>`;
      });
      tc.innerHTML = html || '<div style="text-align:center;color:var(--text-tertiary);padding:32px">Нет данных</div>';
    } else if (tab === 'bonus') {
      let rows = '';
      STATE.bonuses.forEach((b, i) => {
        rows += `<div class="bonus-card" data-idx="${i}">
          <div class="bonus-icon">🎁</div>
          <div class="bonus-content">
            <input class="bonus-input" value="${b.label}" data-field="label" placeholder="Название бонуса"/>
            <input class="bonus-amount" type="number" value="${b.amount}" min="0" placeholder="0 ₽" data-field="amount"/>
          </div>
          <button class="bonus-delete-btn" data-del="${i}">✕</button>
        </div>`;
      });
      tc.innerHTML = `
        <div class="bonus-list">
          ${rows || '<div class="bonus-empty"><div class="bonus-empty-icon">🎁</div><div class="bonus-empty-text">Нет бонусов</div><div class="bonus-empty-sub">Нажмите кнопку ниже чтобы добавить</div></div>'}
        </div>
        <button class="bonus-add-btn" id="addBonusBtn">
          <span class="bonus-add-icon">✨</span>
          <span class="bonus-add-text">Добавить бонус</span>
        </button>
        ${totalBonus > 0 ? `
        <div class="bonus-total">
          <div class="bonus-total-label">Итого бонусов</div>
          <div class="bonus-total-value">+${formatCurrency(totalBonus)}</div>
        </div>` : ''}
      `;
      tc.querySelectorAll('.bonus-card input').forEach(inp => {
        inp.addEventListener('change', () => {
          const idx = parseInt(inp.closest('.bonus-card').dataset.idx);
          if (inp.dataset.field === 'label') STATE.bonuses[idx].label = inp.value;
          if (inp.dataset.field === 'amount') STATE.bonuses[idx].amount = Number(inp.value) || 0;
          saveBonuses();
          renderIncomePanel();
        });
      });
      tc.querySelectorAll('.bonus-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.del);
          STATE.bonuses.splice(idx, 1);
          saveBonuses();
          renderIncomePanel();
        });
      });
      const addBtn = document.getElementById('addBonusBtn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          STATE.bonuses.push({ label: 'Бонус', amount: 0 });
          saveBonuses();
          renderIncomePanel();
        });
      }
    } else {
      const wdays = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      let rows = '';
      STATE.days.forEach(day => {
        if (!day.type || day.type === 'none') return;
        const dow   = getDow(day.year, day.month, day.date);
        const ti    = DAY_TYPES[day.type];
        const dts   = calcDayDetails(day, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours);
        const gross = dts.gross;
        const pdv   = dts.pdv;
        const ndfl  = dts.ndfl;
        const net   = dts.net;
        const sh    = dts.hours;
        rows += `<tr>
          <td>${day.date} ${wdays[dow]}</td>
          <td><span class="income-detail-badge ${day.type}">${ti.emoji}</span></td>
          <td>${sh>0?sh+'h':'—'}</td>
          <td>${gross>0?formatCurrency(gross):'—'}</td>
          <td style="color:#FF6B6B">${pdv>0?'-'+formatCurrency(pdv):'—'}</td>
          <td style="color:#FF9500">${ndfl>0?'-'+formatCurrency(ndfl):'—'}</td>
          <td style="font-weight:700">${net>0?formatCurrency(net):'—'}</td></tr>`;
      });
      tc.innerHTML = `<table style="width:100%;font-size:.83rem"><thead><tr><th>День</th><th>Тип</th><th>Час.</th><th>Вал.</th><th>НДС</th><th>НДФЛ</th><th>Чисто</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  };

  renderTab(STATE.drawer.incomeTab);
  c.querySelector('#incomeToggle').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    STATE.drawer.incomeTab = btn.dataset.tab;
    c.querySelectorAll('.income-toggle .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === btn.dataset.tab));
    renderTab(btn.dataset.tab);
  });
}

/* ── EXPENSES PANEL ── */
function renderExpensesPanel() {
  const c = document.getElementById('drawerContent');
  const groups = groupByCategory(STATE.expenses);
  const total  = calcTotalExpenses(STATE.expenses, STATE.days);
  const netInc = buildIncomeSummary(STATE.days, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours).totalNet + calcTotalBonuses();
  let html = '';
  for (const [cat, items] of Object.entries(groups)) {
    html += `<div class="expense-section"><div class="expense-section-title">${EXPENSE_CATEGORIES[cat]||cat}</div>`;
    for (const item of items) {
      const periodLabel = item.isMath ? (PERIOD_OPTIONS.find(p => p.value === item.period)?.label || '') : '';
      const multiplier = item.isMath ? getPeriodMultiplier(item.period, STATE.days) : 1;
      const monthlyCalc = item.isMath ? `= ${formatCurrency((item.amount || 0) * multiplier)}` : '';
      
      html += `<div class="expense-row" data-id="${item.id}">
        <input class="apple-input" style="flex:2" value="${item.label}" data-field="label"/>
        ${item.isMath ? `<select class="apple-input" data-field="period" style="width:130px">
          ${PERIOD_OPTIONS.map(p => `<option value="${p.value}" ${item.period===p.value?'selected':''}>${p.label}</option>`).join('')}
        </select>` : ''}
        <input class="apple-input" style="flex:1; text-align:right" type="number" value="${item.amount}" min="0" placeholder="0 ₽" data-field="amount"/>
        ${item.isMath ? `<span style="color:var(--text-tertiary);font-size:0.8rem;font-weight:600">${monthlyCalc}</span>` : ''}
        <button class="expense-delete-btn" data-del="${item.id}">✕</button></div>`;
    }
    html += '</div>';
  }
  html += `<div class="expense-buttons-row">
    <button class="add-expense-btn" id="addExpenseBtn">+ Строка</button>
    <button class="add-expense-btn math-btn" id="addMathBtn">+ Мат. строка</button>
  </div>
    <div class="expense-total-row"><span class="expense-total-label">Всего расходов</span><span class="expense-total-value">${formatCurrency(total)}</span></div>
    <div class="net-cashflow-row"><span class="net-cashflow-label">💳 Остаток</span><span class="net-cashflow-value" style="${netInc-total<0?'color:#FF9999':''}">${formatCurrency(netInc - total)}</span></div>`;
  c.innerHTML = html;

  c.querySelectorAll('.apple-input[data-field]').forEach(inp => {
    inp.addEventListener('change', () => {
      const id = inp.closest('.expense-row').dataset.id;
      const item = STATE.expenses.find(e => e.id === id); if (!item) return;
      if (inp.dataset.field === 'label')  item.label  = inp.value;
      if (inp.dataset.field === 'amount') item.amount = Number(inp.value)||0;
      if (inp.dataset.field === 'period') item.period = inp.value;
      saveExpenses(STATE.expenses);
      renderExpensesPanel();
    });
  });
  c.querySelectorAll('.expense-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.expenses = STATE.expenses.filter(e => e.id !== btn.dataset.del);
      saveExpenses(STATE.expenses); renderExpensesPanel();
    });
  });
  document.getElementById('addExpenseBtn').addEventListener('click', () => {
    STATE.expenses.push(createCustomExpense()); saveExpenses(STATE.expenses); renderExpensesPanel();
  });
  document.getElementById('addMathBtn').addEventListener('click', () => {
    STATE.expenses.push(createMathExpense()); saveExpenses(STATE.expenses); renderExpensesPanel();
  });
}

/* ── AUTO PANEL ── */
function renderAutoPanel() {
  const c = document.getElementById('drawerContent');
  const workTypesForAuto = STATE.workTypes.filter(wt => STATE.rateTypes[wt.id] !== 'onetime');
  let wt = workTypesForAuto[0]?.id || 'work1';

  const project = sid =>
    (() => { const d=buildMonthDays(STATE.year,STATE.month).map(x=>({...x})); applyStrategy(d,sid,wt); return buildIncomeSummary(d,STATE.rates,STATE.taxes,STATE.ndfl,STATE.rateTypes,STATE.normHours).totalNet; })();

  const cards = STRATEGIES.map(s => `
    <button class="strategy-card ${STATE.autoStrategy===s.id?'selected':''}" data-strategy="${s.id}">
      <div class="strategy-emoji">${s.emoji}</div>
      <div class="strategy-name">${s.name}</div>
      <div class="strategy-desc">${s.desc}</div>
      <div class="strategy-proj" id="proj-${s.id}">≈ ${formatCurrency(project(s.id))}</div>
    </button>`).join('');
  
  const workTypeButtons = workTypesForAuto.map((wtype, i) => 
    `<button class="seg-btn ${i===0?'active':''}" data-wt="${wtype.id}" style="flex:1;justify-content:center">${wtype.emoji} ${STATE.labels[wtype.id]||wtype.name}</button>`
  ).join('');

  c.innerHTML = `
    <div class="target-salary-row">
      <span class="target-salary-label">🎯 Цель ₽</span>
      <input class="apple-input" style="flex:1; max-width:150px" type="number" id="targetSalary" placeholder="Напр. 30000"/>
    </div>
    <div class="auto-strategy-grid" id="stratGrid">${cards}</div>
    <div class="settings-group" style="margin-bottom:14px">
      <div class="settings-group-label">Тип работы</div>
      <div class="segmented" id="autoWT" style="width:100%">
        ${workTypeButtons}
      </div>
      <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:8px;text-align:center">💡 Разовые работы не участвуют в автографике</div>
    </div>
    <button class="auto-apply-btn" id="autoRotateBtn" style="margin-bottom:12px;background:linear-gradient(135deg,#FF9500,#FF6B00)">🔄 Чередование всех работ</button>
    <button class="auto-apply-btn" id="autoApplyBtn" ${!STATE.autoStrategy?'disabled':''}>Применить ✓</button>`;

  c.querySelector('#stratGrid').addEventListener('click', e => {
    const card = e.target.closest('.strategy-card'); if (!card) return;
    STATE.autoStrategy = card.dataset.strategy;
    c.querySelectorAll('.strategy-card').forEach(x => x.classList.toggle('selected', x.dataset.strategy === STATE.autoStrategy));
    document.getElementById('autoApplyBtn').removeAttribute('disabled');
  });
  c.querySelector('#autoWT').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    wt = btn.dataset.wt;
    c.querySelectorAll('#autoWT .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.wt === wt));
    STRATEGIES.forEach(s => { const el = document.getElementById(`proj-${s.id}`); if(el) el.textContent=`≈ ${formatCurrency(project(s.id))}`; });
  });
  document.getElementById('targetSalary').addEventListener('input', e => {
    const target = Number(e.target.value); if (!target) return;
    let best=null,bestDiff=Infinity;
    STRATEGIES.forEach(s => { const diff=Math.abs(project(s.id)-target); if(diff<bestDiff){bestDiff=diff;best=s.id;} });
    if (best) { STATE.autoStrategy=best; c.querySelectorAll('.strategy-card').forEach(x=>x.classList.toggle('selected',x.dataset.strategy===best)); document.getElementById('autoApplyBtn').removeAttribute('disabled'); }
  });
  document.getElementById('autoApplyBtn').addEventListener('click', () => {
    if (!STATE.autoStrategy) return;
    applyStrategy(STATE.days, STATE.autoStrategy, wt);
    closeDrawer(); renderAll(); saveState(); saveAllMonths();
    showToast('Автографик применен 🗓');
  });
  
  document.getElementById('autoRotateBtn').addEventListener('click', () => {
    // Rotate through ALL work types (including onetime)
    const wtIds = STATE.workTypes.map(w => w.id);
    if (wtIds.length < 2) {
      showToast('Нужно минимум 2 типа работ!');
      return;
    }
    
    let idx = 0;
    STATE.days.forEach(day => {
      if (day.type && day.type !== 'none' && day.type !== 'off') {
        day.type = wtIds[idx % wtIds.length];
        idx++;
      }
    });
    
    closeDrawer(); renderAll(); saveState(); saveAllMonths();
    showToast(`Чередование: ${wtIds.length} работ 🔄`);
  });
}

/* ── EMOJI PICKER ── */
function showEmojiPicker(workTypeId, anchorEl) {
  document.querySelectorAll('.emoji-picker-popup').forEach(e => e.remove());
  
  const emojis = ['💼', '🏢', '⚡', '💻', '🎨', '📱', '🎮', '🎵', '📚', '🏋️', '🍕', '🛒', '🏠', '🚗', '✈️', '💊', '📝', '🔧', '📊', '🎯', '🚀', '💡', '🎁', '🌟', '💪', '🎓', '🏆', '🎸', '🎬', '📷', '🎥', '🏖️', '🏕️', '🎭', '🎪', '🎡', '🎢', '🎠', '🎨', '🎯'];
  
  const picker = document.createElement('div');
  picker.className = 'emoji-picker-popup';
  picker.innerHTML = emojis.map(e => 
    `<button class="emoji-picker-btn" data-emoji="${e}">${e}</button>`
  ).join('');
  
  document.body.appendChild(picker);
  
  const rect = anchorEl.getBoundingClientRect();
  picker.style.left = `${rect.left}px`;
  picker.style.top = `${rect.bottom + 8}px`;
  
  picker.querySelectorAll('.emoji-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newEmoji = btn.dataset.emoji;
      const wt = STATE.workTypes.find(w => w.id === workTypeId);
      if (wt) {
        wt.emoji = newEmoji;
        saveState();
        renderSettingsPanel();
        buildTypeButtons();
        showToast('Эмодзи изменен ✓');
      }
      picker.remove();
    });
  });
  
  document.addEventListener('click', function closePicker(e) {
    if (!picker.contains(e.target) && e.target !== anchorEl) {
      picker.remove();
      document.removeEventListener('click', closePicker);
    }
  });
}

/* ── SETTINGS PANEL ── */
function renderSettingsPanel() {
  const c = document.getElementById('drawerContent');
  
  const workTypesHtml = STATE.workTypes.map(wt => {
    const rt = STATE.rateTypes[wt.id] || 'hourly';
    const rtIndex = { hourly: 0, daily: 1, onetime: 2 }[rt] || 0;
    return `<div class="settings-row" data-work-type="${wt.id}">
      <div style="display:flex; align-items:center; gap:8px">
        <button class="work-emoji-btn" data-id="${wt.id}" title="Изменить эмодзи">${wt.emoji}</button>
        <input class="apple-input" id="nameInput-${wt.id}" value="${STATE.labels[wt.id]||wt.name}" placeholder="Название" style="width:100px"/>
        <button class="work-type-delete" data-id="${wt.id}" title="Удалить">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <div class="rate-toggle" data-key="${wt.id}">
          <div class="rate-toggle-slider" data-key="${wt.id}"></div>
          <button class="rate-toggle-btn ${rt==='hourly'?'active':''}" data-key="${wt.id}" data-rt="hourly">₽/час</button>
          <button class="rate-toggle-btn ${rt==='daily'?'active':''}"  data-key="${wt.id}" data-rt="daily">₽/день</button>
          <button class="rate-toggle-btn ${rt==='onetime'?'active':''}"  data-key="${wt.id}" data-rt="onetime">₽/раз</button>
        </div>
        <input class="apple-input" style="width:80px;text-align:right" type="number" id="rate-${wt.id}" value="${STATE.rates[wt.id]||0}" min="0"/>
      </div>
    </div>`;
  }).join('');
  
  const taxesHtml = STATE.workTypes.map(wt => 
    `<div class="settings-row"><span class="settings-row-label">${wt.emoji} ${STATE.labels[wt.id]||wt.name}</span><input class="apple-input" style="width:80px;text-align:right" type="number" id="tax-${wt.id}" value="${STATE.taxes[wt.id]||0}" min="0" max="100"/></div>`
  ).join('');
  
  const ndflHtml = STATE.workTypes.map(wt => 
    `<div class="settings-row"><span class="settings-row-label">${wt.emoji} ${STATE.labels[wt.id]||wt.name}</span><input class="apple-input" style="width:80px;text-align:right" type="number" id="ndfl-${wt.id}" value="${STATE.ndfl[wt.id]||0}" min="0" max="100"/></div>`
  ).join('');

  c.innerHTML = `
    <div class="settings-group" id="profileSection">
      <div class="profile-header" id="profileHeader">
        <div class="profile-avatar" id="profileAvatar">👤</div>
        <div class="profile-info">
          <div class="profile-name" id="profileName">Гость</div>
          <div class="profile-email" id="profileEmail">Не авторизован</div>
        </div>
        <div class="profile-actions" id="profileActions">
          <button class="auto-apply-btn" id="loginBtn" onclick="openAuthModal()" style="background:var(--accent);padding:8px 16px;">🔐 Войти</button>
        </div>
      </div>
    </div>
    
    <div class="settings-group">
      <div class="settings-group-label" style="display:flex;justify-content:space-between;align-items:center">
        <span>Типы работ</span>
        <button class="auto-apply-btn" id="addWorkTypeBtn" style="padding:6px 12px;font-size:0.8rem;background:var(--accent)">➕ Добавить</button>
      </div>
      ${workTypesHtml}
    </div>
    <div class="settings-group">
      <div class="settings-group-label">НДС %</div>
      ${taxesHtml}
    </div>
    <div class="settings-group">
      <div class="settings-group-label">НДФЛ (подоходный налог) %</div>
      ${ndflHtml}
    </div>
    <div class="settings-group">
      <div class="settings-group-label">База данных для телефонов</div>
      <div style="display:flex; gap:8px;">
        <button class="auto-apply-btn" id="dbExportBtn" style="flex:1;background:#5856D6"><span style="font-size:1.2rem">📤</span> Сохранить</button>
        <button class="auto-apply-btn" id="dbImportBtn" style="flex:1;background:#FF9500"><span style="font-size:1.2rem">📥</span> Загрузить</button>
      </div>
      <input type="file" id="dbFileInp" accept=".json" style="display:none"/>
      <button class="auto-apply-btn" id="clearMonthBtn" style="margin-top:16px;background:rgba(255,59,48,0.1);color:var(--danger);box-shadow:none;">🗑 Очистить месяц</button>
    </div>
    <div class="settings-group">
      <div class="settings-group-label">Задачи — импорт/экспорт</div>
      <div style="display:flex; gap:8px;">
        <button class="auto-apply-btn" id="tasksExportBtn" style="flex:1;background:#34C759"><span style="font-size:1.2rem">📤</span> Экспорт</button>
        <button class="auto-apply-btn" id="tasksImportBtn" style="flex:1;background:#007AFF"><span style="font-size:1.2rem">📥</span> Импорт</button>
      </div>
      <input type="file" id="tasksFileInp" accept=".json" style="display:none"/>
    </div>`;

  // Add work type button
  document.getElementById('addWorkTypeBtn').addEventListener('click', () => {
    const emojis = ['💻', '🎨', '📱', '🎮', '🎵', '📚', '🏋️', '🍕', '🛒', '🏠', '🚗', '✈️', '💊', '📝', '🔧'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const num = STATE.workTypes.length + 1;
    const id = `extra${num}`;
    
    STATE.workTypes.push({ id, emoji, name: `Работа ${num}` });
    STATE.labels[id] = `Работа ${num}`;
    STATE.rates[id] = 0;
    STATE.taxes[id] = 0;
    STATE.ndfl[id] = 0;
    STATE.rateTypes[id] = 'hourly';
    
    saveState();
    renderSettingsPanel();
    buildTypeButtons();
    showToast('Тип работы добавлен ✓');
  });

  // Delete work type buttons
  c.querySelectorAll('.work-type-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (STATE.workTypes.length <= 1) {
        showToast('Нельзя удалить последний тип работы');
        return;
      }
      if (!confirm(`Удалить тип "${STATE.labels[id]||id}"?`)) return;
      
      STATE.workTypes = STATE.workTypes.filter(wt => wt.id !== id);
      delete STATE.labels[id];
      delete STATE.rates[id];
      delete STATE.taxes[id];
      delete STATE.ndfl[id];
      delete STATE.rateTypes[id];
      
      saveState();
      renderSettingsPanel();
      buildTypeButtons();
      showToast('Тип работы удален');
    });
  });

  // Emoji picker buttons
  c.querySelectorAll('.work-emoji-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEmojiPicker(btn.dataset.id, btn);
    });
  });

  // Name inputs
  STATE.workTypes.forEach(wt => {
    const inp = document.getElementById(`nameInput-${wt.id}`);
    if (inp) {
      inp.addEventListener('change', e => {
        STATE.labels[wt.id] = e.target.value || wt.name;
        saveState(); renderAll(); buildTypeButtons();
      });
    }
  });

  // Rate type toggles
  function positionSlider(key) {
    const toggle = c.querySelector(`.rate-toggle[data-key="${key}"]`);
    const slider = c.querySelector(`.rate-toggle-slider[data-key="${key}"]`);
    const activeBtn = c.querySelector(`.rate-toggle-btn[data-key="${key}"].active`);
    if (!toggle || !slider || !activeBtn) return;
    const toggleWidth = toggle.offsetWidth - 8;
    const btnCount = 3;
    const btnWidth = toggleWidth / btnCount;
    const btnIndex = { hourly: 0, daily: 1, onetime: 2 }[STATE.rateTypes[key]] || 0;
    slider.style.width = `calc(${btnWidth}px - 4px)`;
    slider.style.transform = `translateX(${btnIndex * btnWidth}px)`;
  }
  
  c.querySelectorAll('.rate-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key, rt = btn.dataset.rt;
      STATE.rateTypes[key] = rt;
      c.querySelectorAll(`.rate-toggle-btn[data-key="${key}"]`).forEach(b => b.classList.toggle('active', b.dataset.rt === rt));
      positionSlider(key);
      saveState(); showToast('Тип ставки сохранен ✓');
    });
  });
  
  // Initialize sliders
  STATE.workTypes.forEach(wt => positionSlider(wt.id));

  // Rate and tax inputs
  STATE.workTypes.forEach(wt => {
    const rInp = document.getElementById(`rate-${wt.id}`); if (rInp) rInp.addEventListener('change', e => { STATE.rates[wt.id]=Number(e.target.value)||0; saveState(); });
    const tInp = document.getElementById(`tax-${wt.id}`); if (tInp) tInp.addEventListener('change', e => { STATE.taxes[wt.id]=Number(e.target.value)||0; saveState(); });
    const nInp = document.getElementById(`ndfl-${wt.id}`); if (nInp) nInp.addEventListener('change', e => { STATE.ndfl[wt.id]=Number(e.target.value)||0; saveState(); });
  });

  document.getElementById('dbExportBtn').addEventListener('click', () => {
    try { const all = JSON.parse(localStorage.getItem(STOR_ALL)||'{}'); exportJSON(STATE.days, STATE.year, STATE.month, STATE.labels, STATE.rates, STATE.rateTypes, STATE.normHours, all); } catch(e) {}
  });
  
  const dbFileInp = document.getElementById('dbFileInp');
  document.getElementById('dbImportBtn').addEventListener('click', () => dbFileInp.click());
  dbFileInp.addEventListener('change', e => {
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const j = JSON.parse(ev.target.result);
        if (j.app !== 'Планер для коти') { showToast('❌ Файл от другой системы'); return; }
        if (!confirm('Загрузить базу данны? Это полностью заменит ваши текущие смены!')) return;
        if (j.fullDatabase) localStorage.setItem(STOR_ALL, JSON.stringify(j.fullDatabase));
        const s = {
          year: j.year, month: j.month - 1, days: j.days,
          rates: j.rates||STATE.rates, rateTypes: j.rateTypes||STATE.rateTypes,
          normHours: j.normHours||STATE.normHours, labels: j.labels||STATE.labels
        };
        localStorage.setItem(STOR, JSON.stringify(s));
        window.location.reload();
      } catch(err) { showToast('❌ Ошибка чтения'); }
    };
    r.readAsText(file);
  });

  document.getElementById('clearMonthBtn').addEventListener('click', () => {
    if (confirm('Очистить весь месяц?')) {
      STATE.days = buildMonthDays(STATE.year, STATE.month);
      renderAll(); saveState(); saveAllMonths(); closeDrawer(); showToast('Месяц очищен');
    }
  });

  document.getElementById('tasksExportBtn').addEventListener('click', () => {
    exportTasks();
  });

  const tasksFileInp = document.getElementById('tasksFileInp');
  document.getElementById('tasksImportBtn').addEventListener('click', () => tasksFileInp.click());
  tasksFileInp.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      importTasks(file);
      tasksFileInp.value = '';
    }
  });
}

function initCopyMonth() {
  const btn = document.getElementById('copyMonthBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!confirm('Скопировать этот график на следующий месяц?')) return;
    
    const nextMonth = STATE.month + 1;
    const nextYear = STATE.month === 11 ? STATE.year + 1 : STATE.year;
    
    try {
      const all = JSON.parse(localStorage.getItem(STOR_ALL) || '{}');
      const key = `${STATE.year}-${STATE.month}`;
      const nextKey = `${nextYear}-${nextMonth === 12 ? 0 : nextMonth}`;
      
      const currentDays = all[key] || STATE.days;
      let nextDays = all[nextKey] || buildMonthDays(nextYear, nextMonth === 12 ? 0 : nextMonth);
      
      const minDays = Math.min(currentDays.length, nextDays.length);
      for (let i = 0; i < minDays; i++) {
        const from = currentDays[i];
        if (from.type && from.type !== 'none') {
          nextDays[i].type = from.type;
          nextDays[i].shift = from.shift;
          nextDays[i].start = from.start;
          nextDays[i].end = from.end;
          nextDays[i].hours = from.hours;
        }
      }
      
      all[nextKey] = nextDays;
      localStorage.setItem(STOR_ALL, JSON.stringify(all));
      
    } catch(e) {}
    
    goMonth(1);
    showToast('График скопирован!');
  });
}

/* ── EXPORT ── */
function toggleExportPopup(anchor) {
  const popup = document.getElementById('exportPopup');
  const open  = popup.classList.contains('visible');
  if (open) { popup.classList.remove('visible'); STATE.exportPopupOpen=false; return; }
  const rect = anchor.getBoundingClientRect();
  popup.style.left = `${rect.right + 24}px`;
  popup.style.top  = `${rect.top - 20}px`;
  popup.style.right = 'auto';
  popup.classList.add('visible');
  STATE.exportPopupOpen = true;
}
function closeExportPopup() { document.getElementById('exportPopup').classList.remove('visible'); STATE.exportPopupOpen=false; }

/* ── TOAST ── */
function showToast(msg) {
  let c = document.querySelector('.toast-container');
  if (!c) { c=document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>t.remove(), 2700);
}

/* ── MONTH NAV ── */
function goMonth(delta) {
  saveAllMonths();
  STATE.month += delta;
  if (STATE.month < 0)  { STATE.month=11; STATE.year--; }
  if (STATE.month > 11) { STATE.month=0;  STATE.year++; }
  ensureMonthDays(); renderAll(); saveState();
}

/* ── EVENTS ── */
function initEvents() {
  document.getElementById('modeToggle').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (btn?.dataset.mode) switchMode(btn.dataset.mode);
  });
  document.getElementById('monthTitle').addEventListener('click', () => {
    if (STATE.view === 'yearly') {
      STATE.view = 'daily';
      showToast('📆 Дневной календарь');
    } else {
      STATE.view = 'yearly';
      showToast('📅 Годовой календарь');
    }
    renderAll();
  });
  document.getElementById('prevMonth').addEventListener('click', () => goMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => goMonth(+1));
  initCopyMonth();
  document.getElementById('popupClose').addEventListener('click', closeDayPopup);
  document.getElementById('popupOverlay').addEventListener('click', closeDayPopup);
  document.getElementById('popupSave').addEventListener('click', savePopup);
  document.getElementById('dayTypeSegment').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn[data-type]'); if (!btn) return;
    STATE.popup.type = btn.dataset.type; syncTypeSegment(STATE.popup.type);
    toggleShiftSection(STATE.popup.type !== 'off' && STATE.popup.type !== 'none');
  });
  document.getElementById('shiftPresets').addEventListener('click', e => {
    const btn = e.target.closest('.shift-pill'); if (!btn) return;
    STATE.popup.shift = btn.dataset.shift;
    const times = SHIFT_PRESETS[STATE.popup.shift] || {};
    if (times.start) { document.getElementById('startTime').value=times.start; document.getElementById('endTime').value=times.end; }
    syncShiftPills(STATE.popup.shift); updateHoursBadge();
  });
  ['startTime','endTime'].forEach(id => document.getElementById(id).addEventListener('input', () => { STATE.popup.shift='custom'; syncShiftPills('custom'); updateHoursBadge(); }));
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);

  const dh = {
    dockCharts:   () => STATE.drawer.open && STATE.drawer.panel==='charts'   ? closeDrawer() : openDrawer('charts'),
    dockIncome:   () => STATE.drawer.open && STATE.drawer.panel==='income'   ? closeDrawer() : openDrawer('income'),
    dockExpenses: () => STATE.drawer.open && STATE.drawer.panel==='expenses' ? closeDrawer() : openDrawer('expenses'),
    dockTasks:    () => showTasksMode(),
    dockAuto:     () => STATE.drawer.open && STATE.drawer.panel==='auto'     ? closeDrawer() : openDrawer('auto'),
    dockCat:      () => { if (catVisible) hideCatWidget(); else showCatWidget(); },
    dockExport:   e  => toggleExportPopup(e.currentTarget),
    dockSettings: () => STATE.drawer.open && STATE.drawer.panel==='settings' ? closeDrawer() : openDrawer('settings'),
  };
  Object.entries(dh).forEach(([id,fn]) => document.getElementById(id).addEventListener('click', fn));

  document.getElementById('exportPng').addEventListener('click',  () => { exportPNG(STATE.year, STATE.month, STATE.days, STATE.rates, STATE.rateTypes, STATE.normHours, STATE.labels); closeExportPopup(); showToast('PNG сохранен 🖼'); });
  document.getElementById('exportTxt').addEventListener('click',  () => { exportTXT(STATE.days, STATE.year, STATE.month, STATE.rates, STATE.rateTypes, STATE.normHours, STATE.labels); closeExportPopup(); showToast('TXT сохранен 📄'); });
  document.getElementById('exportJson').addEventListener('click', () => { 
    try { const all = JSON.parse(localStorage.getItem(STOR_ALL)||'{}'); exportJSON(STATE.days, STATE.year, STATE.month, STATE.labels, STATE.rates, STATE.rateTypes, STATE.normHours, all); } catch(e) {}
    closeExportPopup(); showToast('JSON сохранен 📦'); 
  });
  document.getElementById('exportIcs').addEventListener('click',  () => { exportICS(STATE.days, STATE.year, STATE.month, STATE.normHours, STATE.labels); closeExportPopup(); showToast('ICS сохранен 📅'); });
  document.getElementById('exportTasks').addEventListener('click',  () => { exportTasks(); closeExportPopup(); });

  document.addEventListener('click', e => {
    if (STATE.exportPopupOpen && !e.target.closest('#exportPopup') && !e.target.closest('#dockExport')) closeExportPopup();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (STATE.popup.open) closeDayPopup();
    else if (STATE.drawer.open) closeDrawer();
    else if (STATE.exportPopupOpen) closeExportPopup();
  });
  // Swipe down to close popup
  const pop = document.getElementById('dayPopup');
  let ty0 = 0;
  pop.addEventListener('touchstart', e => { ty0 = e.touches[0].clientY; }, { passive:true });
  pop.addEventListener('touchend',   e => { if (e.changedTouches[0].clientY - ty0 > 80) closeDayPopup(); }, { passive:true });
}

/* ── AUTH ── */
let authMode = 'login';

// Sync data from cloud
async function syncFromCloud() {
  showToast('⏳ Синхронизация...');
  try {
    const cloudData = await loadAllFromCloud();
    if (cloudData) {
      if (cloudData.settings) {
        Object.assign(STATE.rates, cloudData.settings.rates || {});
        Object.assign(STATE.taxes, cloudData.settings.taxes || {});
        Object.assign(STATE.ndfl, cloudData.settings.ndfl || {});
        Object.assign(STATE.rateTypes, cloudData.settings.rateTypes || {});
        Object.assign(STATE.normHours, cloudData.settings.normHours || {});
        Object.assign(STATE.labels, cloudData.settings.labels || {});
        if (cloudData.settings.workTypes) STATE.workTypes = cloudData.settings.workTypes;
      }
      if (cloudData.tasks) STATE.tasks = cloudData.tasks;
      if (cloudData.expenses) STATE.expenses = cloudData.expenses;
      if (cloudData.bonuses) STATE.bonuses = cloudData.bonuses;
      if (cloudData.dayNotes) STATE.dayNotes = cloudData.dayNotes;
      
      renderAll();
      buildTypeButtons();
    }
  } catch (e) {
    console.error('Sync error:', e);
  }
}

// Sync data to cloud
async function syncToCloud() {
  try {
    await syncAllToCloud(STATE);
  } catch (e) {
    console.error('Sync to cloud error:', e);
  }
}

function initAuthEvents() {
  const authModal = document.getElementById('authModal');
  
  // Auth state listener - only update UI, sync is handled in login/register
  onAuthChange((user) => {
    updateProfileUI(user);
  });
  
  // Direct event listener for login button
  document.addEventListener('click', (e) => {
    const loginBtn = e.target.closest('#loginBtn');
    const logoutBtn = e.target.closest('#logoutBtn');
    
    if (loginBtn) {
      openAuthModal();
      return;
    }
    
    if (logoutBtn) {
      showLogoutConfirm();
      return;
    }
    
    // Auth tabs
    if (e.target.closest('.auth-tab')) {
      const tab = e.target.closest('.auth-tab');
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      authMode = tab.dataset.tab;
      
      const nameGroup = document.getElementById('nameGroup');
      if (authMode === 'register') {
        nameGroup.style.display = 'block';
        document.getElementById('authModalTitle').textContent = '📝 Регистрация';
        document.getElementById('authSubmit').textContent = 'Создать аккаунт';
      } else {
        nameGroup.style.display = 'none';
        document.getElementById('authModalTitle').textContent = '🔐 Вход в профиль';
        document.getElementById('authSubmit').textContent = 'Войти';
      }
      document.getElementById('authError').textContent = '';
    }
  });
  
  // Auth form submit
  document.addEventListener('submit', async (e) => {
    if (!e.target.closest('#authForm')) return;
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.trim();
    const errorEl = document.getElementById('authError');
    
    errorEl.textContent = '⏳ Загрузка...';
    
    if (authMode === 'login') {
      const result = await login(email, password);
      if (result.success) {
        closeAuthModal();
        await syncFromCloud();
      } else {
        errorEl.textContent = result.error || 'Ошибка входа';
      }
    } else {
      const result = await register(email, password, name);
      if (result.success) {
        closeAuthModal();
        await syncToCloud();
      } else {
        errorEl.textContent = result.error || 'Ошибка регистрации';
      }
    }
  });
   
  // Close modal on overlay click
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }
  
  // Close button
  document.addEventListener('click', (e) => {
    if (e.target.closest('#authCloseBtn')) {
      closeAuthModal();
    }
  });
   
  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const authModal = document.getElementById('authModal');
      if (authModal && authModal.classList.contains('visible')) {
        closeAuthModal();
      }
    }
  });
}

function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('visible');
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.remove('visible');
    modal.style.display = '';
    modal.style.opacity = '';
    modal.style.visibility = '';
  }
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authName').value = '';
  document.getElementById('authError').textContent = '';
}

function updateProfileUI(user) {
  // Check if elements exist in DOM
  const avatar = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName');
  const email = document.getElementById('profileEmail');
  const actions = document.getElementById('profileActions');
  const header = document.getElementById('profileHeader');
  
  // Only update if drawer is open
  const drawer = document.getElementById('drawer');
  if (!drawer || !drawer.classList.contains('open')) return;
  if (!avatar || !name || !email || !actions || !header) return;
  
  // Get saved avatar
  const savedAvatar = localStorage.getItem('planyr-user-avatar') || '👤';
  
  if (user) {
    avatar.textContent = savedAvatar;
    avatar.onclick = () => showAvatarPicker();
    avatar.style.cursor = 'pointer';
    name.textContent = user.displayName || user.email?.split('@')[0] || 'Пользователь';
    email.textContent = user.email || '';
    actions.innerHTML = '<button class="auto-apply-btn" id="logoutBtn" onclick="showLogoutConfirm()" style="background:var(--danger);padding:8px 16px;">🚪 Выйти</button>';
    header.classList.add('profile-logged-in');
  } else {
    avatar.textContent = '👤';
    name.textContent = 'Гость';
    email.textContent = 'Не авторизован';
    actions.innerHTML = '<button class="auto-apply-btn" id="loginBtn" onclick="openAuthModal()" style="background:var(--accent);padding:8px 16px;">🔐 Войти</button>';
    header.classList.remove('profile-logged-in');
  }
}

function showLogoutConfirm() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    syncToCloud();
    logout();
  }
}

function showAvatarPicker() {
  // Remove existing picker
  const existing = document.getElementById('avatarPicker');
  if (existing) existing.remove();
  
  const picker = document.createElement('div');
  picker.id = 'avatarPicker';
  picker.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--glass-bg);backdrop-filter:blur(20px);border-radius:20px;padding:24px;z-index:10001;box-shadow:0 20px 60px rgba(0,0,0,0.3);min-width:320px;max-width:90vw;';
  
  picker.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="margin:0;font-size:1.2rem;font-weight:700;">Выбери аватар</h3>
      <button onclick="closeAvatarPicker()" style="background:rgba(0,0,0,0.08);border:none;width:32px;height:32px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;">Эмодзи</div>
      <div id="emojiGrid" style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;"></div>
    </div>
    <div style="border-top:1px solid rgba(0,0,0,0.08);padding-top:20px;">
      <div style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;">Своё фото</div>
      <label for="avatarFileInput" style="display:block;padding:16px;background:linear-gradient(135deg, var(--accent-soft), rgba(88,86,214,0.15));border-radius:14px;border:2px dashed var(--accent);cursor:pointer;text-align:center;transition:all 0.2s;">
        <input type="file" id="avatarFileInput" accept="image/*" style="display:none;"/>
        <div style="font-size:2rem;margin-bottom:8px;">📷</div>
        <div style="font-weight:600;color:var(--accent);">Загрузить фото</div>
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px;">PNG, JPG до 5MB</div>
      </label>
    </div>
  `;
  
  document.body.appendChild(picker);
  
  // Populate emojis
  const emojis = ['👤', '😀', '😎', '🤓', '🦊', '🐱', '🐶', '🐰', '🦄', '🐼', '🐨', '🦁', '🐸', '🐵', '🐲', '👑', '🌟', '💎', '🎮', '🎨', '🎵', '⚽', '🏆', '🚀', '💼', '📱', '💻', '🎯', '🎁', '🔥', '💖', '🌈'];
  const emojiGrid = picker.querySelector('#emojiGrid');
  emojis.forEach(e => {
    const btn = document.createElement('button');
    btn.textContent = e;
    btn.style.cssText = 'width:36px;height:36px;font-size:1.3rem;border:none;background:rgba(0,0,0,0.04);border-radius:10px;cursor:pointer;transition:all 0.2s;';
    btn.onmouseover = () => btn.style.background = 'var(--accent-soft)';
    btn.onmouseout = () => btn.style.background = 'rgba(0,0,0,0.04)';
    btn.onclick = () => selectEmojiAvatar(e);
    emojiGrid.appendChild(btn);
  });
  
  // File input handler
  const fileInput = picker.querySelector('#avatarFileInput');
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Файл слишком большой! Максимум 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        selectImageAvatar(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
}

function closeAvatarPicker() {
  const picker = document.getElementById('avatarPicker');
  if (picker) picker.remove();
}

function selectEmojiAvatar(emoji) {
  localStorage.setItem('planyr-user-avatar', emoji);
  const avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.textContent = emoji;
  closeAvatarPicker();
}

function selectImageAvatar(imageData) {
  localStorage.setItem('planyr-user-avatar', imageData);
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    avatar.textContent = '';
    avatar.style.backgroundImage = `url(${imageData})`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  }
  closeAvatarPicker();
}

/* ── INIT ── */
function init() {
  applyTOD();
  setInterval(applyTOD, 5 * 60 * 1000);
  loadState();
  STATE.expenses = loadExpenses();
  loadBonuses();
  STATE.tasks = loadTasks();
  STATE.dayNotes = loadDayNotes();
  cleanupOldTasks();
  ensureMonthDays();
  switchMode(STATE.mode);
  initEvents();
  initTasksEvents();
  initAuthEvents();
  buildTypeButtons();
  window.catCursorInstance = new CatCursor();
  
  // Make auth functions global for onclick handlers
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.showLogoutConfirm = showLogoutConfirm;
  window.closeAvatarPicker = closeAvatarPicker;
  
  const catCloseBtn = document.getElementById('catClose');
  if (catCloseBtn) {
    catCloseBtn.addEventListener('click', hideCatWidget);
  }
}

document.addEventListener('DOMContentLoaded', init);
