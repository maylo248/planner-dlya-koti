/**
 * export.js — Export to PNG, TXT, JSON, ICS (Samsung/Google Calendar)
 */

import { MONTH_NAMES_UK, DAY_TYPES, SHIFT_PRESETS } from './planner.js';
import { formatCurrency, calcDayGross } from './income.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function fname(year, month) {
  return `Планер_${MONTH_NAMES_UK[month]}_${year}`;
}

/* ── JSON ──────────────────────────────────────────────────── */
export function exportJSON(days, year, month, labels, rates, rateTypes, normHours, allData = null) {
  const payload = {
    app: 'Планер для коти', version: 4, timestamp: new Date().toISOString(),
    year, month: month + 1,
    monthName: MONTH_NAMES_UK[month],
    days: days.map(d => ({ ...d })),
    labels, rates, rateTypes, normHours,
    fullDatabase: allData // The stable database backup
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  download(blob, `${fname(year, month)}.json`);
}

/* ── TXT ───────────────────────────────────────────────────── */
export function exportTXT(days, year, month, rates, rateTypes, normHours, labels) {
  const wdays = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const lines = [
    `🐾 Планер для коти — ${MONTH_NAMES_UK[month]} ${year}`,
    '═'.repeat(46), '',
  ];

  let totalH = 0, workDays = 0;
  for (const day of days) {
    if (day.type === 'none') continue;
    const wd  = new Date(day.year, day.month, day.date).getDay();
    const tiLabel = (day.type === 'work1' || day.type === 'work2' || day.type === 'both') ? labels[day.type] : ti.label;
    const shi = day.shift !== 'none' && SHIFT_PRESETS[day.shift]
      ? ` [${day.start}–${day.end}]` : '';
    const h = day.hours > 0 ? day.hours : (normHours[day.type] || normHours.work1);
    const hrs = h > 0 ? ` • ${h}h` : '';
    const inc = rates && day.type !== 'off'
      ? ` • ${formatCurrency(calcDayGross(day, rates, rateTypes, normHours))}` : '';
    lines.push(`${String(day.date).padStart(2)} ${wdays[wd]}  ${ti.emoji} ${tiLabel}${shi}${hrs}${inc}`);
    if (day.type !== 'off') { totalH += h; workDays++; }
  }

  lines.push('', '═'.repeat(46));
  lines.push(`Всего: ${workDays} рабочих дней • ${Math.round(totalH * 10)/10}h`);
  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  download(blob, `${fname(year, month)}.txt`);
}

/* ── PNG ───────────────────────────────────────────────────── */
export async function exportPNG(year, month, days, rates, rateTypes, normHours, labels) {
  const daysInMonth = days.length;
  const cols = 7;
  const cellW = 120, cellH = 92, padX = 24, padY = 24;
  const firstDow = new Date(year, month, 1).getDay();
  const totalCells = firstDow + daysInMonth;
  const rows = Math.ceil(totalCells / 7) + 1;
  const W = cols * cellW + padX * 2;
  const H = rows * cellH + padY * 2 + 64;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#F5F4F0';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillStyle = '#1C1C1E';
  ctx.textAlign = 'left';
  ctx.fillText(`🐾 График работы — ${MONTH_NAMES_UK[month]} ${year}`, padX, padY + 28);

  const typeColors = { work1:'#EEF0FF', work2:'#EDFBF2', both:'#FFF0CC', off:'#F5F5F5', none:'#FAFAFA' };
  const typeAccent = { work1:'#5E5CE6', work2:'#30D158', both:'#FF9F0A', off:'#C7C7CC', none:'transparent' };
  const typeLabels = { work1:`💼 ${labels.work1}`, work2:`🏢 ${labels.work2}`, both:`⚡ ${labels.both}`, off:'🌿 Выходной', none:'' };
  const wDays = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

  // Day headers
  for (let i = 0; i < 7; i++) {
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = '#AEAEB2';
    ctx.textAlign = 'center';
    ctx.fillText(wDays[i], padX + i * cellW + cellW / 2, padY + 58);
  }

  for (let idx = 0; idx < daysInMonth; idx++) {
    const day = days[idx];
    const col = (firstDow + idx) % 7;
    const row = Math.floor((firstDow + idx) / 7) + 1;
    const x = padX + col * cellW + 4;
    const y = padY + 60 + row * cellH + 4;
    const cw = cellW - 8, ch = cellH - 8;

    ctx.fillStyle = typeColors[day.type] || '#FAFAFA';
    roundRect(ctx, x, y, cw, ch, 14); ctx.fill();

    ctx.fillStyle = typeAccent[day.type] || 'transparent';
    roundRect(ctx, x, y, cw, 3, { tl:14, tr:14, bl:0, br:0 }); ctx.fill();

    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = '#1C1C1E'; ctx.textAlign = 'left';
    ctx.fillText(String(day.date), x + 10, y + 28);

    if (day.type !== 'none') {
      ctx.font = '500 10px Inter, sans-serif';
      ctx.fillStyle = typeAccent[day.type];
      ctx.fillText(typeLabels[day.type], x + 10, y + 46);
    }
    const h = day.hours > 0 ? day.hours : (normHours[day.type] || normHours.work1);
    if (h > 0) {
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = typeAccent[day.type];
      ctx.textAlign = 'right';
      ctx.fillText(`${h}h`, x + cw - 10, y + ch - 10);
    }
  }

  canvas.toBlob(blob => download(blob, `${fname(year, month)}.png`), 'image/png');
}

/* ── ICS (Samsung / Google Calendar) ──────────────────────── */
export function exportICS(days, year, month, normHours, labels) {
  const pad = n => String(n).padStart(2, '0');

  function toICSDate(y, m, d, timeStr) {
    // timeStr like "09:00", if empty use midnight
    const [hh, mm] = timeStr ? timeStr.split(':').map(Number) : [0, 0];
    return `${y}${pad(m + 1)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Планнер//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const day of days) {
    if (day.type === 'none' || day.type === 'off') continue;
    const ti = DAY_TYPES[day.type];
    const tiLabel = (day.type === 'work1' || day.type === 'work2' || day.type === 'both') ? labels[day.type] : ti.label;
    const summary = `${ti.emoji} ${tiLabel}` +
      (day.start ? ` (${day.start}–${day.end})` : '');

    const dtstart = toICSDate(day.year, day.month, day.date, day.start);
    const dtend   = toICSDate(day.year, day.month,
      // Handle overnight: if end < start, it's next day
      day.end && day.start && day.end <= day.start ? day.date + 1 : day.date,
      day.end || day.start);

    const uid = `planyer-${day.year}${pad(day.month+1)}${pad(day.date)}@kotycat`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:Часов: ${day.hours > 0 ? day.hours : (normHours[day.type] || normHours.work1)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  download(blob, `${fname(year, month)}.ics`);
}

/* ── Canvas helper ─────────────────────────────────────────── */
function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl:r, tr:r, bl:r, br:r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}
