/**
 * charts.js — Statistics & Charts Panel
 */

import { buildIncomeSummary, formatCurrency } from './income.js';
import { calcTotalExpenses } from './expenses.js';
import { buildMonthDays, MONTH_NAMES_UK } from './planner.js';

const Chart = window.Chart;

const STOR_ALL = 'planyr-all-v2';

export function getMonthData(year, month, rates, taxes, ndfl, rateTypes, norm) {
  try {
    const all = JSON.parse(localStorage.getItem(STOR_ALL) || '{}');
    const key = `${year}-${month}`;
    const days = all[key] || buildMonthDays(year, month);
    const summary = buildIncomeSummary(days, rates, taxes, ndfl, rateTypes, norm);
    return {
      gross: summary.totalGross,
      net: summary.totalNet,
      expenses: 0,
      utilities: { electricity: 0, water: 0, gas: 0 }
    };
  } catch (e) {
    return { gross: 0, net: 0, expenses: 0, utilities: { electricity: 0, water: 0, gas: 0 } };
  }
}

export function loadExpensesHistory() {
  try {
    const raw = localStorage.getItem('planyr-expenses-history') || '{}';
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function saveExpensesHistory(history) {
  try {
    localStorage.setItem('planyr-expenses-history', JSON.stringify(history));
  } catch (e) {}
}

export function getExpensesForMonth(year, month) {
  const history = loadExpensesHistory();
  const key = `${year}-${month}`;
  return history[key] || null;
}

export function saveExpensesForMonth(year, month, expenses) {
  const history = loadExpensesHistory();
  history[`${year}-${month}`] = expenses;
  saveExpensesHistory(history);
}

const UTILITY_LABELS = {
  elec: 'Электричество',
  water: 'Вода',
  gas: 'Газ',
  internet: 'Интернет',
  phone: 'Телефон'
};

export function renderChartsPanel(drawerContent, STATE) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const months = [];
  const incomeData = [];
  const expenseData = [];
  const utilitiesData = { elec: [], water: [], gas: [] };
  const labels = [];
  
  for (let i = 11; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m < 0) { m += 12; y--; }
    
    months.push({ year: y, month: m });
    labels.push(MONTH_NAMES_UK[m].slice(0, 3));
    
    const monthData = getMonthData(y, m, STATE.rates, STATE.taxes, STATE.ndfl, STATE.rateTypes, STATE.normHours);
    
    const savedExp = getExpensesForMonth(y, m);
    const expenses = savedExp || STATE.expenses;
    
    let monthDays;
    try {
      const all = JSON.parse(localStorage.getItem(STOR_ALL) || '{}');
      const key = `${y}-${m}`;
      monthDays = all[key] || buildMonthDays(y, m);
    } catch(e) {
      monthDays = buildMonthDays(y, m);
    }
    
    const totalExp = calcTotalExpenses(expenses, monthDays);
    const utilities = expenses.filter(e => e.category === 'utility');
    
    monthData.expenses = totalExp;
    monthData.utilities.electricity = utilities.find(e => e.id === 'elec')?.amount || 0;
    monthData.utilities.water = utilities.find(e => e.id === 'water')?.amount || 0;
    monthData.utilities.gas = utilities.find(e => e.id === 'gas')?.amount || 0;
    
    incomeData.push(monthData.net);
    expenseData.push(monthData.expenses);
    utilitiesData.elec.push(monthData.utilities.electricity);
    utilitiesData.water.push(monthData.utilities.water);
    utilitiesData.gas.push(monthData.utilities.gas);
  }
  
  const totalIncome = incomeData.reduce((a, b) => a + b, 0);
  const totalExpensesAll = expenseData.reduce((a, b) => a + b, 0);
  const avgIncome = totalIncome / 12;
  const avgExpenses = totalExpensesAll / 12;
  
  drawerContent.innerHTML = `
    <div class="charts-summary">
      <div class="chart-summary-card">
        <div class="chart-summary-label">Средний доход</div>
        <div class="chart-summary-value" style="color: var(--c-work1)">${formatCurrency(avgIncome)}</div>
      </div>
      <div class="chart-summary-card">
        <div class="chart-summary-label">Средний расход</div>
        <div class="chart-summary-value" style="color: var(--danger)">${formatCurrency(avgExpenses)}</div>
      </div>
      <div class="chart-summary-card">
        <div class="chart-summary-label">Баланс за год</div>
        <div class="chart-summary-value" style="color: ${totalIncome - totalExpensesAll >= 0 ? 'var(--c-work1)' : 'var(--danger)'}">${formatCurrency(totalIncome - totalExpensesAll)}</div>
      </div>
    </div>
    
    <div class="chart-container">
      <div class="chart-title">📈 Доходы и Расходы (12 месяцев)</div>
      <canvas id="incomeExpenseChart"></canvas>
    </div>
    
    <div class="chart-container">
      <div class="chart-title">⚡ Коммунальные платежи</div>
      <canvas id="utilitiesChart"></canvas>
    </div>
    
    <div class="utilities-grid">
      <div class="utility-card">
        <div class="utility-icon">💡</div>
        <div class="utility-name">Электричество</div>
        <div class="utility-avg">В среднем: ${formatCurrency(utilitiesData.elec.reduce((a,b)=>a+b,0)/12)}</div>
      </div>
      <div class="utility-card">
        <div class="utility-icon">💧</div>
        <div class="utility-name">Вода</div>
        <div class="utility-avg">В среднем: ${formatCurrency(utilitiesData.water.reduce((a,b)=>a+b,0)/12)}</div>
      </div>
      <div class="utility-card">
        <div class="utility-icon">🔥</div>
        <div class="utility-name">Газ</div>
        <div class="utility-avg">В среднем: ${formatCurrency(utilitiesData.gas.reduce((a,b)=>a+b,0)/12)}</div>
      </div>
    </div>
    
    <div class="month-history">
      <div class="chart-title">📅 История по месяцам</div>
      <div class="month-history-list" id="monthHistoryList"></div>
    </div>
  `;
  
  if (typeof Chart !== 'undefined') {
    try {
      const ctx1 = drawerContent.querySelector('#incomeExpenseChart').getContext('2d');
      new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Доход',
              data: incomeData,
              backgroundColor: 'rgba(52, 199, 89, 0.8)',
              borderColor: 'rgba(52, 199, 89, 1)',
              borderWidth: 2,
              borderRadius: 8
            },
            {
              label: 'Расход',
              data: expenseData,
              backgroundColor: 'rgba(255, 59, 48, 0.8)',
              borderColor: 'rgba(255, 59, 48, 1)',
              borderWidth: 2,
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { family: 'Inter', weight: '600' } }
            },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: v => formatCurrency(v)
              },
              grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
      
      const ctx2 = drawerContent.querySelector('#utilitiesChart').getContext('2d');
      new Chart(ctx2, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Электричество',
              data: utilitiesData.elec,
              borderColor: '#FFD60A',
              backgroundColor: 'rgba(255, 214, 10, 0.2)',
              tension: 0.4,
              fill: true,
              pointRadius: 5,
              pointHoverRadius: 7
            },
            {
              label: 'Вода',
              data: utilitiesData.water,
              borderColor: '#0A84FF',
              backgroundColor: 'rgba(10, 132, 255, 0.2)',
              tension: 0.4,
              fill: true,
              pointRadius: 5,
              pointHoverRadius: 7
            },
            {
              label: 'Газ',
              data: utilitiesData.gas,
              borderColor: '#FF9500',
              backgroundColor: 'rgba(255, 149, 0, 0.2)',
              tension: 0.4,
              fill: true,
              pointRadius: 5,
              pointHoverRadius: 7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { family: 'Inter', weight: '600' } }
            },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: v => formatCurrency(v)
              },
              grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    } catch (e) {
      console.warn('Charts failed to render:', e);
    }
  }
  
  const historyList = drawerContent.querySelector('#monthHistoryList');
  let historyHtml = '';
  for (let i = months.length - 1; i >= 0; i--) {
    const { year, month } = months[i];
    const inc = incomeData[i];
    const exp = expenseData[i];
    const balance = inc - exp;
    historyHtml += `
      <div class="history-row">
        <div class="history-month">${MONTH_NAMES_UK[month]} ${year}</div>
        <div class="history-values">
          <span class="history-income">${formatCurrency(inc)}</span>
          <span class="history-expense">${formatCurrency(exp)}</span>
          <span class="history-balance" style="color: ${balance >= 0 ? 'var(--c-work1)' : 'var(--danger)'}">${balance >= 0 ? '+' : ''}${formatCurrency(balance)}</span>
        </div>
      </div>
    `;
  }
  historyList.innerHTML = historyHtml;
}
