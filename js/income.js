/**
 * income.js — V4: daily rate + ПДФО + one-time support
 */

export const DEFAULT_RATES     = { work1: 120, work2: 95, both: 110 };
export const DEFAULT_TAXES     = { work1: 0,   work2: 0,  both: 0   }; // НДС %
export const DEFAULT_NDFL      = { work1: 0,   work2: 0,  both: 0   }; // НДФО %
export const DEFAULT_RATE_TYPES = { work1: 'hourly', work2: 'hourly', both: 'hourly' }; // 'hourly'|'daily'|'onetime'
export const DEFAULT_NORM_HOURS= { work1: 8, work2: 8 };

export function calcDayDetails(day, rates, taxes, ndfl, rateTypes = DEFAULT_RATE_TYPES, norm = DEFAULT_NORM_HOURS) {
  let w1 = { days:0, hours:0, gross:0, pdv:0, ndfl:0, net:0 };
  let w2 = { days:0, hours:0, gross:0, pdv:0, ndfl:0, net:0 };
  
  const rt = rateTypes[day.type] || 'hourly';
  
  if (day.type && day.type !== 'none' && day.type !== 'off') {
    if (day.type === 'work1') {
      w1.days = 1;
      w1.hours = day.hours > 0 ? day.hours : norm.work1;
      if (rt === 'daily' || rt === 'onetime') w1.gross = rates.work1;
      else w1.gross = w1.hours * rates.work1;
    } else if (day.type === 'work2') {
      w2.days = 1;
      w2.hours = day.hours > 0 ? day.hours : norm.work2;
      if (rt === 'daily' || rt === 'onetime') w2.gross = rates.work2;
      else w2.gross = w2.hours * rates.work2;
    } else if (day.type === 'both') {
      w1.days = 1; w2.days = 1;
      w1.hours = norm.work1; w2.hours = norm.work2;
      const rt1 = rateTypes.work1 || 'hourly';
      const rt2 = rateTypes.work2 || 'hourly';
      w1.gross = (rt1 === 'daily' || rt1 === 'onetime') ? rates.work1 : w1.hours * rates.work1;
      w2.gross = (rt2 === 'daily' || rt2 === 'onetime') ? rates.work2 : w2.hours * rates.work2;
    } else {
      const rtCustom = rateTypes[day.type] || 'hourly';
      if (rtCustom === 'onetime') {
        w1.days = 1;
        w1.gross = rates[day.type] || 0;
      } else if (rtCustom === 'daily') {
        w1.days = 1;
        w1.gross = rates[day.type] || 0;
      } else {
        w1.days = 1;
        w1.hours = day.hours > 0 ? day.hours : (norm[day.type] || 8);
        w1.gross = w1.hours * (rates[day.type] || 0);
      }
    }
  }

  const pdv1 = taxes?.work1||0, ndfl1 = ndfl?.work1||0;
  w1.pdv = Math.round(w1.gross * pdv1 / 100); w1.ndfl = Math.round(w1.gross * ndfl1 / 100);
  w1.net = w1.gross - w1.pdv - w1.ndfl;

  const pdv2 = taxes?.work2||0, ndfl2 = ndfl?.work2||0;
  w2.pdv = Math.round(w2.gross * pdv2 / 100); w2.ndfl = Math.round(w2.gross * ndfl2 / 100);
  w2.net = w2.gross - w2.pdv - w2.ndfl;

  return {
    work1: w1, work2: w2,
    gross: w1.gross+w2.gross, pdv: w1.pdv+w2.pdv, ndfl: w1.ndfl+w2.ndfl, net: w1.net+w2.net,
    hours: w1.hours+w2.hours, days: w1.days || w2.days ? 1 : 0
  };
}

export function calcDayGross(day, rates, rateTypes, norm) {
  return calcDayDetails(day, rates, {}, {}, rateTypes, norm).gross;
}
export function calcDayTaxPdv(gross, type, taxes, day, rates, rateTypes, norm)  { 
  if (day) return calcDayDetails(day, rates, taxes, {}, rateTypes, norm).pdv;
  return Math.round(gross * (taxes?.[type] || 0) / 100); 
}
export function calcDayNdfl(gross, type, ndfl, day, rates, rateTypes, norm) { 
  if (day) return calcDayDetails(day, rates, {}, ndfl, rateTypes, norm).ndfl;
  return Math.round(gross * (ndfl?.[type]  || 0) / 100); 
}

export function buildIncomeSummary(days, rates, taxes = {}, ndfl = {}, rateTypes = DEFAULT_RATE_TYPES, norm = DEFAULT_NORM_HOURS) {
  let totalGross = 0, totalPdv = 0, totalNdfl = 0, totalNet = 0;
  let worked = 0, workedDays = 0, offDays = 0;
  const byType = {
    work1: { hours:0, days:0, gross:0, pdv:0, ndfl:0, net:0 },
    work2: { hours:0, days:0, gross:0, pdv:0, ndfl:0, net:0 },
  };

  for (const day of days) {
    if (!day.type || day.type === 'none') continue;
    if (day.type === 'off') { offDays++; continue; }
    
    const dts = calcDayDetails(day, rates, taxes, ndfl, rateTypes, norm);
    
    totalGross += dts.gross; totalPdv += dts.pdv; totalNdfl += dts.ndfl; totalNet += dts.net;
    worked += dts.hours; workedDays += dts.days;

    ['work1','work2'].forEach(k => {
      byType[k].hours += dts[k].hours;
      byType[k].days  += dts[k].days;
      byType[k].gross += dts[k].gross;
      byType[k].pdv   += dts[k].pdv;
      byType[k].ndfl  += dts[k].ndfl;
      byType[k].net   += dts[k].net;
    });
  }
  return {
    totalGross, totalPdv, totalNdfl, totalNet,
    total: totalNet,
    worked: Math.round(worked * 10) / 10,
    workedDays, offDays,
    avgPerDay: workedDays > 0 ? Math.round(totalNet / workedDays) : 0,
    byType,
  };
}

export function formatCurrency(n) {
  if (!n) return '0\u00A0₽';
  return `${Math.round(n).toLocaleString('ru-RU')}\u00A0₽`;
}
