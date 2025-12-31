// ============================================
// פונקציות עזר כלליות
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  const yearBadgeEl = document.getElementById('yearBadge');
  if (yearBadgeEl) {
    yearBadgeEl.textContent = `מעודכן ל־${new Date().getFullYear()}`;
  }
  
  setupNumberOnlyFields();
  setupCurrencyAutoFields();
  setupCourtCaseInput();
  setupCurrency();
  setupCalculations();
  initCalculator();
  setupPaymentCalculation();
  setupTrusteeNameTitle();
});

// שדות מספרים בלבד
function setupNumberOnlyFields() {
  document.querySelectorAll('.number-only').forEach(input => {
    input.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^\d]/g, '');
    });
    input.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
  
  // שדות תאריך - רק תאריך
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('keypress', function(e) {
      // רק מספרים, מקף, חצים
      if (!/[0-9\-]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
  
  // שדות סכום - רק מספרים
  document.querySelectorAll('.currency-input, .currency-input-auto').forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
  });
}

// שדות סכום עם ש"ח ופסיקים
function setupCurrencyAutoFields() {
  document.querySelectorAll('.currency-input-auto').forEach(input => {
    // רק מספרים בעת הקלדה
    input.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^\d]/g, '');
    });
    
    input.addEventListener('focus', function() {
      // הסרת ש"ח ופסיקים בעת עריכה
      this.value = this.value.replace(/[^\d]/g, '');
    });
    
    input.addEventListener('blur', function() {
      // הוספת ש"ח ופסיקים רק אם יש ערך - הסכום מימין והש"ח משמאל (בסוף הטקסט)
      let val = this.value.replace(/[^\d]/g, '');
      if (val && val.length > 0) {
        const num = parseInt(val);
        this.value = num.toLocaleString('he-IL') + ' ש"ח';
      } else {
        this.value = '';
      }
    });
  });
}

// שדה תיק ביהמ"ש עם הפרדה
function setupCourtCaseInput() {
  const court1 = document.getElementById('courtCase1');
  const court2 = document.getElementById('courtCase2');
  const court3 = document.getElementById('courtCase3');
  
  if (!court1 || !court2 || !court3) return;
  
  [court1, court2, court3].forEach((input, idx) => {
    input.addEventListener('input', function() {
      this.value = this.value.replace(/[^\d]/g, '');
      // מעבר אוטומטי לשדה הבא
      if (this.value.length >= this.maxLength && idx < 2) {
        [court1, court2, court3][idx + 1].focus();
      }
    });
  });
}

// חישוב תשלומים
function setupPaymentCalculation() {
  const orderDate = document.getElementById('orderDate');
  const monthlyPayment = document.getElementById('monthlyPayment');
  const gradedPayment = document.getElementById('gradedPayment');
  const gradedMonths = document.getElementById('gradedMonths');
  const totalToPay = document.getElementById('totalToPay');
  const monthsSinceOrder = document.getElementById('monthsSinceOrder');
  const paymentDate = document.getElementById('paymentDate');

  if (!orderDate || !monthlyPayment || !gradedPayment || !gradedMonths || !totalToPay || !monthsSinceOrder || !paymentDate) return;

  // הגדרת תאריך היום אוטומטית
  const today = new Date();
  const todayStr = today.toLocaleDateString('he-IL');
  if (paymentDate.tagName === 'SPAN') {
    paymentDate.textContent = todayStr;
  } else {
    paymentDate.valueAsDate = today;
  }

  function calculatePayment() {
    if (!orderDate.value) {
      monthsSinceOrder.value = '';
      totalToPay.value = '';
      return;
    }

    const orderDateObj = new Date(orderDate.value);
    
    // תאריך התחלה: החודש שלאחר מתן הצו (לא החודש של הצו עצמו)
    const startDate = new Date(orderDateObj.getFullYear(), orderDateObj.getMonth() + 1, 1);
    
    // תאריך סיום: ראשון לחודש הנוכחי (לא כולל החודש הנוכחי)
    const todayDate = new Date();
    const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    
    // חישוב חודשים בין התאריכים (לא כולל החודש הנוכחי)
    let months = 0;
    if (startDate < endDate) {
      const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      
      while (startMonth < endMonth) {
        months++;
        startMonth.setMonth(startMonth.getMonth() + 1);
      }
    }
    
    monthsSinceOrder.value = months.toString();

    // חישוב סה"כ
    const monthly = parseCurrencyValue(monthlyPayment.value);
    const graded = parseCurrencyValue(gradedPayment.value);
    const gradedMonthsCount = parseInt(gradedMonths.value) || 0;

    // בדיקה אם זה תיק אפס - אם תשלום חודשי הוא 0 (רק אם יש ערך מפורש של 0)
    const monthlyStr = monthlyPayment.value.replace(/[^\d]/g, '');
    const isZeroCase = monthlyStr === '0';
    const zeroCaseTitle = document.getElementById('zeroCaseTitle');
    if (zeroCaseTitle) {
      zeroCaseTitle.style.display = isZeroCase ? 'block' : 'none';
    }

    let total = 0;
    
    if (months > 0) {
      // אם יש תשלום מדורג ונמוך יותר, נשתמש בו לחודשים הראשונים
      const useGraded = graded > 0 && gradedMonthsCount > 0 && graded < monthly;
      const gradedMonthsToUse = useGraded ? Math.min(gradedMonthsCount, months) : 0;
      
      for (let i = 1; i <= months; i++) {
        if (i <= gradedMonthsToUse) {
          total += graded;
        } else {
          total += monthly; // גם אם monthly הוא 0, נוסיף אותו
        }
      }
    }

    totalToPay.value = total.toLocaleString('he-IL') + ' ש"ח';
  }

  function parseCurrencyValue(val) {
    if (!val || val.trim() === '') return 0;
    const cleaned = val.replace(/[^\d]/g, '');
    if (cleaned === '') return 0;
    const num = parseInt(cleaned);
    return isNaN(num) ? 0 : num; // מחזיר 0 גם אם הערך הוא 0
  }

  orderDate.addEventListener('change', calculatePayment);
  monthlyPayment.addEventListener('blur', calculatePayment);
  gradedPayment.addEventListener('blur', calculatePayment);
  gradedMonths.addEventListener('change', calculatePayment);
  gradedMonths.addEventListener('input', calculatePayment);
}

// הוספת תואר "עו"ד" לשם הנאמן אוטומטית
function setupTrusteeNameTitle() {
  const trusteeNameInput = document.getElementById('trusteeName');
  if (!trusteeNameInput) return;

  trusteeNameInput.addEventListener('blur', function() {
    let value = this.value.trim();
    
    // אם השדה ריק, לא לעשות כלום
    if (!value) return;
    
    // אם התואר כבר קיים, לא להוסיף שוב
    if (value.startsWith('עו"ד')) return;
    
    // הוסף את התואר בתחילת השם
    this.value = 'עו"ד ' + value;
  });
}

function toggleField(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = !state;
  if(!state) el.value = '';
  
  // אם מפעילים "תחולה מותאמת", בטל "מחודש הבא"
  if (id === 'commEffectiveDate' && state) {
    const chkNextMonth = document.getElementById('chkNextMonth');
    if (chkNextMonth) {
      chkNextMonth.checked = false;
    }
  }
  
  // עדכן חישוב
  calcTimeline();
}

function toggleLock(containerId, state) {
  const el = document.getElementById(containerId);
  if (!el) return;
  
  if(state) {
    el.classList.add('locked-section');
    el.querySelectorAll('input').forEach(i => {
      // אל תנעל את שדה הערות, פוטנציאל ואל תנקה אותם
      if (i.id === 'debtorNotes' || i.id === 'spouseNotes' || i.id === 'debtorPotential') {
        i.disabled = false;
        return;
      }
      i.value = '';
      i.disabled = true;
    });
  } else {
    el.classList.remove('locked-section');
    el.querySelectorAll('input').forEach(i => {
      if (i.id !== 'debtorNotes' && i.id !== 'spouseNotes' && i.id !== 'debtorPotential') {
        i.disabled = false;
      }
    });
  }
  calcIncomeTotal();
  calcCalculator(); // עדכון מחשבון
}

function setupCurrency() {
  document.querySelectorAll('.currency-input').forEach(input => {
    input.addEventListener('blur', function() {
      let val = this.value.replace(/[^\d.]/g, '');
      if(val) this.value = parseFloat(val).toLocaleString('he-IL') + ' ש"ח';
    });
    input.addEventListener('focus', function() {
      this.value = this.value.replace(/[^\d.]/g, '');
    });
  });
}

function parseVal(val) {
  if(!val) return 0;
  return parseFloat(val.replace(/[^\d.]/g, '')) || 0;
}

// ============================================
// חישובי הטופס הראשי
// ============================================

function setupCalculations() {
  // האזנה לחישוב הכנסות
  ['debtorNet', 'spouseNet', 'totalAllow'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('blur', calcIncomeTotal);
      el.addEventListener('input', () => {
        calcIncomeTotal();
        calcCalculator(); // עדכון מחשבון בזמן אמת
      });
    }
  });

  // עדכון מחשבון מפרטים אישיים - רק קטינים
  ['minorsCount', 'valAlimony'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('input', calcCalculator);
      el.addEventListener('change', calcCalculator);
    }
  });
  
  // עדכון מחשבון כשמסמנים מזונות
  const chkAlimony = document.getElementById('chkAlimony');
  if (chkAlimony) {
    chkAlimony.addEventListener('change', () => {
      if (chkAlimony.checked) {
        const alimonyVal = parseVal(document.getElementById('valAlimony')?.value || '');
        if (alimonyVal > 0) {
          calcCalculator();
        }
      }
    });
  }
  
  // האזנה לחישובי המלצות
  ['trus', 'comm'].forEach(p => {
    const m = document.getElementById(p+'M');
    const d = document.getElementById(p+'D');

    const run = () => {
      const mon = parseVal(m.value);
      const dur = parseFloat(d.value) || 0;
      const sum = mon * dur;
      const totEl = document.getElementById(p+'Tot');
      if (totEl) totEl.value = sum.toLocaleString('he-IL') + ' ש"ח';
    };

    if(m) m.addEventListener('blur', run);
    if(d) d.addEventListener('input', run);
  });

  // האזנה לחישוב ציר הזמן
  const timelineInputs = [
    'orderDate', 'calcDate', 'monthlyPayment', 'gradedPayment', 'gradedMonths',
    'commDecDate', 'commNewFixed', 'chkCustomDate', 'commEffectiveDate',
    'commGradedAmt', 'commGradedDate', 'commGradedDur'
  ];
  
  // האזנה גם לשדות החדשים
  const commNewFixedEl = document.getElementById('commNewFixed');
  const commGradedAmtEl = document.getElementById('commGradedAmt');
  const chkNextMonthEl = document.getElementById('chkNextMonth');
  if (commNewFixedEl) {
    commNewFixedEl.addEventListener('blur', calcTimeline);
  }
  if (commGradedAmtEl) {
    commGradedAmtEl.addEventListener('blur', calcTimeline);
  }
  if (chkNextMonthEl) {
    chkNextMonthEl.addEventListener('change', calcTimeline);
  }

  timelineInputs.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('blur', calcTimeline);
      if(el.type !== 'text') el.addEventListener('change', calcTimeline);
    }
  });
}

function calcIncomeTotal() {
  const d = parseVal(document.getElementById('debtorNet')?.value || '');
  const s = parseVal(document.getElementById('spouseNet')?.value || '');
  const a = parseVal(document.getElementById('totalAllow')?.value || '');
  const total = d + s + a;
  const grandTotalEl = document.getElementById('grandTotalIncome');
  if (grandTotalEl) {
    grandTotalEl.value = total.toLocaleString('he-IL') + ' ש"ח';
  }
}

function calcTimeline() {
  const orderDateStr = document.getElementById('orderDate')?.value;
  if(!orderDateStr) return;

  const start = new Date(orderDateStr);
  const end = new Date(); // תאריך נוכחי
  
  // תאריך התחלה: החודש שלאחר מתן הצו
  const firstPay = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  
  // תאריך סיום: ראשון לחודש הנוכחי (לא כולל החודש הנוכחי)
  const endDate = new Date(end.getFullYear(), end.getMonth(), 1);

  const baseMon = parseVal(document.getElementById('monthlyPayment')?.value || '');
  const baseGrad = parseVal(document.getElementById('gradedPayment')?.value || '');
  const baseGradMonths = parseInt(document.getElementById('gradedMonths')?.value || '3');

  const chkUpdateFromOrder = document.getElementById('chkUpdateFromOrder')?.checked;
  const commFixed = parseVal(document.getElementById('commNewFixed')?.value || '');
  const commDateRaw = document.getElementById('commDecDate')?.value;
  const commNextMonth = document.getElementById('chkNextMonth')?.checked;
  const commCustom = document.getElementById('chkCustomDate')?.checked;
  const commEffRaw = document.getElementById('commEffectiveDate')?.value;
  
  // חישוב תאריך תחולה של תשלום חודשי
  let commEffDate = null;
  if (!chkUpdateFromOrder && commFixed !== null && commFixed !== undefined && commDateRaw) {
    if(commCustom && commEffRaw) {
      // תחולה מותאמת - תאריך עתידי
      commEffDate = new Date(commEffRaw);
      commEffDate.setDate(1); // ראשון לחודש
    } else if(commNextMonth && commDateRaw) {
      // מחודש הבא - ראשון לחודש העוקב אחרי תאריך ההחלטה
      const decDate = new Date(commDateRaw);
      commEffDate = new Date(decDate.getFullYear(), decDate.getMonth() + 1, 1);
    } else if(commDateRaw) {
      // מתאריך ההחלטה
      commEffDate = new Date(commDateRaw);
      commEffDate.setDate(1); // ראשון לחודש
    }
  }

  // חישוב תאריכים של תשלום מדורג
  const cGradAmt = parseVal(document.getElementById('commGradedAmt')?.value || '');
  const cGradStartStr = document.getElementById('commGradedDate')?.value;
  const cGradDur = parseInt(document.getElementById('commGradedDur')?.value || '0');
  
  let cGradStart = null;
  let cGradEnd = null;
  if (!chkUpdateFromOrder && cGradAmt > 0 && cGradStartStr && cGradDur > 0) {
    cGradStart = new Date(cGradStartStr);
    cGradStart.setDate(1); // ראשון לחודש
    cGradEnd = new Date(cGradStart);
    cGradEnd.setMonth(cGradEnd.getMonth() + cGradDur);
  }

  let total = 0;
  let months = 0;
  let curr = new Date(firstPay);
  
  let safety = 0;
  while(curr < endDate && safety < 300) {
    months++;
    
    let monthPay = 0;
    
    if (chkUpdateFromOrder) {
      // אם מסומן "עדכן סכום מיום הצו", הסכום המעודכן מחליף את כל החודשים מיום הצו (גם אם הוא 0)
      monthPay = commFixed || 0;
    } else {
      // תשלום בסיסי מצו התשלומים
      let basePay = 0;
      if(months <= baseGradMonths && baseGrad > 0) {
        basePay = baseGrad;
      } else {
        basePay = baseMon;
      }
      
      // החלטת ממונה - דורסת את הסכום הקודם (גם אם נמוך יותר)
      
      // תשלום מדורג של ממונה - גורס את החודשים שצוינו
      if(cGradStart && cGradEnd && curr >= cGradStart && curr < cGradEnd) {
        monthPay = cGradAmt || 0; // הסכום המדורג מחליף את הבסיסי (גם אם 0)
      }
      // תשלום חודשי של ממונה (רק אם לא בתקופת מדורג)
      else if(commEffDate && curr >= commEffDate) {
        monthPay = commFixed || 0; // החלטת ממונה דורסת את הסכום הקודם (גם אם נמוך יותר)
      } else {
        monthPay = basePay;
      }
    }
    total += monthPay;
    curr.setMonth(curr.getMonth() + 1);
    safety++;
  }

  const monthsEl = document.getElementById('monthsSinceOrder');
  const totalEl = document.getElementById('totalToPay');
  if (monthsEl) monthsEl.value = months;
  if (totalEl) totalEl.value = total.toLocaleString('he-IL') + ' ש"ח';
  
  // חישוב סכום משקולל וסה"כ מעודכן
  calculateCommissionAmounts(total, months);
}

function calculateCommissionAmounts(totalAmount, monthsCount) {
  // סה"כ מעודכן = הסכום הכולל (צו תשלומים + החלטת ממונה)
  const totalUpdatedEl = document.getElementById('commTotalUpdated');
  if (totalUpdatedEl) {
    totalUpdatedEl.value = totalAmount.toLocaleString('he-IL') + ' ש"ח';
  }
}

function toggleNextMonth() {
  const chkNextMonth = document.getElementById('chkNextMonth');
  const chkCustomDate = document.getElementById('chkCustomDate');
  const commDecDate = document.getElementById('commDecDate');
  const commEffectiveDate = document.getElementById('commEffectiveDate');
  
  if (chkNextMonth && chkNextMonth.checked) {
    // אם מסומן "מחודש הבא", בטל את "תחולה מותאמת"
    if (chkCustomDate) {
      chkCustomDate.checked = false;
      if (commEffectiveDate) {
        commEffectiveDate.disabled = true;
        commEffectiveDate.value = '';
      }
    }
    // עדכן חישוב
    calcTimeline();
  }
}

function toggleUpdateFromOrder() {
  const chkUpdateFromOrder = document.getElementById('chkUpdateFromOrder');
  const commNewFixed = document.getElementById('commNewFixed');
  const commGradedAmt = document.getElementById('commGradedAmt');
  const commGradedDur = document.getElementById('commGradedDur');
  const commGradedDate = document.getElementById('commGradedDate');
  const chkNextMonth = document.getElementById('chkNextMonth');
  const chkCustomDate = document.getElementById('chkCustomDate');
  const commEffectiveDate = document.getElementById('commEffectiveDate');
  
  if (chkUpdateFromOrder && chkUpdateFromOrder.checked) {
    // בטל את כל השדות האחרים (חוץ מ-commNewFixed שהוא הסכום המעודכן)
    if (commGradedAmt) commGradedAmt.disabled = true;
    if (commGradedDur) commGradedDur.disabled = true;
    if (commGradedDate) commGradedDate.disabled = true;
    if (chkNextMonth) chkNextMonth.disabled = true;
    if (chkCustomDate) chkCustomDate.disabled = true;
    if (commEffectiveDate) commEffectiveDate.disabled = true;
    // שמור את commNewFixed פעיל - זה הסכום המעודכן
    if (commNewFixed) commNewFixed.disabled = false;
  } else {
    // הפעל את כל השדות
    if (commNewFixed) commNewFixed.disabled = false;
    if (commGradedAmt) commGradedAmt.disabled = false;
    if (commGradedDur) commGradedDur.disabled = false;
    if (commGradedDate) commGradedDate.disabled = false;
    if (chkNextMonth) chkNextMonth.disabled = false;
    if (chkCustomDate) chkCustomDate.disabled = false;
    if (commEffectiveDate) commEffectiveDate.disabled = chkCustomDate ? !chkCustomDate.checked : true;
  }
  calcTimeline();
}

function resetForm() {
  if (confirm('האם אתה בטוח שברצונך לאפס את כל השדות?')) {
    document.getElementById('mainForm').reset();
    // איפוס שדות נוספים
    const today = new Date();
    const paymentDate = document.getElementById('paymentDate');
    if (paymentDate && paymentDate.tagName === 'SPAN') {
      paymentDate.textContent = today.toLocaleDateString('he-IL');
    }
    // איפוס חישובים
    calcTimeline();
    calcIncomeTotal();
  }
}

function openReport() {
  const orderDateStr = document.getElementById('orderDate')?.value;
  if (!orderDateStr) {
    alert('אנא הזן תאריך צו תחילה');
    return;
  }
  
  // חישוב כל החודשים
  const reportData = calculateReportData();
  
  // פתיחת חלון חדש עם הדו"ח
  const reportWindow = window.open('', '_blank', 'width=800,height=600');
  reportWindow.document.write(generateReportHTML(reportData));
  reportWindow.document.close();
}

function openPaymentReport() {
  const orderDateStr = document.getElementById('orderDate')?.value;
  if (!orderDateStr) {
    alert('אנא הזן תאריך צו תחילה');
    return;
  }
  
  // חישוב כל החודשים
  const reportData = calculateReportData();
  
  // פתיחת חלון חדש עם דו"ח תשלומים
  const reportWindow = window.open('', '_blank', 'width=900,height=700');
  reportWindow.document.write(generatePaymentReportHTML(reportData));
  reportWindow.document.close();
}

function calculateReportData() {
  const orderDateStr = document.getElementById('orderDate')?.value;
  if (!orderDateStr) return [];
  
  const start = new Date(orderDateStr);
  const end = new Date();
  const firstPay = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const endDate = new Date(end.getFullYear(), end.getMonth(), 1);
  
  const baseMon = parseVal(document.getElementById('monthlyPayment')?.value || '');
  const baseGrad = parseVal(document.getElementById('gradedPayment')?.value || '');
  const baseGradMonths = parseInt(document.getElementById('gradedMonths')?.value || '3');
  
  const commFixed = parseVal(document.getElementById('commNewFixed')?.value || '');
  const commDateRaw = document.getElementById('commDecDate')?.value;
  const commNextMonth = document.getElementById('chkNextMonth')?.checked;
  const commCustom = document.getElementById('chkCustomDate')?.checked;
  const commEffRaw = document.getElementById('commEffectiveDate')?.value;
  const chkUpdateFromOrder = document.getElementById('chkUpdateFromOrder')?.checked;
  
  let commEffDate = null;
  if (!chkUpdateFromOrder && commFixed !== null && commFixed !== undefined && commDateRaw) {
    if (commCustom && commEffRaw) {
      commEffDate = new Date(commEffRaw);
      commEffDate.setDate(1);
    } else if (commNextMonth && commDateRaw) {
      const decDate = new Date(commDateRaw);
      commEffDate = new Date(decDate.getFullYear(), decDate.getMonth() + 1, 1);
    } else if (commDateRaw) {
      commEffDate = new Date(commDateRaw);
      commEffDate.setDate(1);
    }
  }
  
  const cGradAmt = parseVal(document.getElementById('commGradedAmt')?.value || '');
  const cGradStartStr = document.getElementById('commGradedDate')?.value;
  const cGradDur = parseInt(document.getElementById('commGradedDur')?.value || '0');
  
  let cGradStart = null;
  let cGradEnd = null;
  if (!chkUpdateFromOrder && cGradAmt !== null && cGradAmt !== undefined && cGradStartStr && cGradDur > 0) {
    cGradStart = new Date(cGradStartStr);
    cGradStart.setDate(1);
    cGradEnd = new Date(cGradStart);
    cGradEnd.setMonth(cGradEnd.getMonth() + cGradDur);
  }
  
  const months = [];
  let curr = new Date(firstPay);
  let totalOriginal = 0;
  let totalUpdated = 0;
  
  while (curr < endDate) {
    const monthName = curr.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    
    let originalPay = 0;
    let updatedPay = 0;
    
    if (chkUpdateFromOrder) {
      // אם מסומן "עדכן סכום מיום הצו", הסכום המעודכן מחליף את כל החודשים (גם אם הוא 0)
      const monthIndex = months.length + 1;
      if (monthIndex <= baseGradMonths && baseGrad > 0) {
        originalPay = baseGrad;
      } else {
        originalPay = baseMon;
      }
      updatedPay = commFixed || 0; // הסכום המעודכן מחליף את המקורי (גם אם הוא 0)
    } else {
      // תשלום בסיסי
      const monthIndex = months.length + 1;
      if (monthIndex <= baseGradMonths && baseGrad > 0) {
        originalPay = baseGrad;
      } else {
        originalPay = baseMon;
      }
      
      // החלטת ממונה - דורסת את הסכום הקודם (גם אם נמוך יותר)
      if (cGradStart && cGradEnd && curr >= cGradStart && curr < cGradEnd) {
        // תשלום מדורג של ממונה - גורס את החודשים שצוינו (גם אם 0)
        updatedPay = cGradAmt || 0;
      } else if (commEffDate && curr >= commEffDate) {
        // תשלום חודשי של ממונה - דורס את הסכום הקודם (גם אם נמוך יותר)
        updatedPay = commFixed || 0;
      } else {
        updatedPay = originalPay;
      }
    }
    
    months.push({
      month: monthName,
      original: originalPay,
      updated: updatedPay
    });
    
    totalOriginal += originalPay;
    totalUpdated += updatedPay;
    curr.setMonth(curr.getMonth() + 1);
  }
  
  return { months, totalOriginal, totalUpdated };
}

function generateReportHTML(data) {
  const { months, totalOriginal, totalUpdated } = data;
  
  let tableRows = '';
  months.forEach(m => {
    tableRows += `
      <tr>
        <td>${m.month}</td>
        <td style="text-align:left; direction:ltr;">₪ ${m.original.toLocaleString('he-IL')}</td>
        <td style="text-align:left; direction:ltr;">₪ ${m.updated.toLocaleString('he-IL')}</td>
      </tr>
    `;
  });
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>דו"ח חודשי</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #0f766e; color: white; }
        tr.summary { font-weight: bold; background-color: #f0f0f0; }
      </style>
    </head>
    <body>
      <h1>דו"ח חודשי - סכומי תשלום</h1>
      <table>
        <thead>
          <tr>
            <th>חודש</th>
            <th>סכום מקורי</th>
            <th>סכום מעודכן</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="summary">
            <td>סה"כ</td>
            <td style="text-align:left; direction:ltr;">₪ ${totalOriginal.toLocaleString('he-IL')}</td>
            <td style="text-align:left; direction:ltr;">₪ ${totalUpdated.toLocaleString('he-IL')}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function generatePaymentReportHTML(data) {
  const { months, totalOriginal, totalUpdated } = data;
  
  let tableRows = '';
  months.forEach(m => {
    const diff = m.updated - m.original;
    const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : '';
    tableRows += `
      <tr>
        <td>${m.month}</td>
        <td style="text-align:left; direction:ltr;">₪ ${m.original.toLocaleString('he-IL')}</td>
        <td style="text-align:left; direction:ltr;">₪ ${m.updated.toLocaleString('he-IL')}</td>
        <td class="${diffClass}" style="text-align:left; direction:ltr;">${diff !== 0 ? (diff > 0 ? '+' : '') + '₪ ' + diff.toLocaleString('he-IL') : '-'}</td>
      </tr>
    `;
  });
  
  const totalDiff = totalUpdated - totalOriginal;
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>דו"ח תשלומים חודשי</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
        h1 { color: #0f766e; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
        th { background-color: #0f766e; color: white; font-weight: bold; }
        tr.summary { font-weight: bold; background-color: #e5f6ff; }
        tr.summary td { border-top: 2px solid #0f766e; }
        .positive { color: #059669; font-weight: bold; }
        .negative { color: #dc2626; font-weight: bold; }
        tbody tr:hover { background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>דו"ח תשלומים חודשי</h1>
      <table>
        <thead>
          <tr>
            <th>חודש</th>
            <th>תשלום מקורי</th>
            <th>תשלום מעודכן</th>
            <th>הפרש</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="summary">
            <td><strong>סה"כ</strong></td>
            <td style="text-align:left; direction:ltr;"><strong>₪ ${totalOriginal.toLocaleString('he-IL')}</strong></td>
            <td style="text-align:left; direction:ltr;"><strong>₪ ${totalUpdated.toLocaleString('he-IL')}</strong></td>
            <td style="text-align:left; direction:ltr; ${totalDiff > 0 ? 'color: #059669;' : totalDiff < 0 ? 'color: #dc2626;' : ''}"><strong>${totalDiff !== 0 ? (totalDiff > 0 ? '+' : '') + '₪ ' + totalDiff.toLocaleString('he-IL') : '-'}</strong></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

// ============================================
// מחשבון עזר (מאוחד)
// ============================================

const fmt = n => new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:0}).format(n||0);
const r10 = n => Math.floor((n||0)/10)*10;
const E = id => document.getElementById(id);

const calcEls = {
  salaryD: E('salaryDebtor'), 
  salaryP: E('salaryPartner'),
  otherD: E('otherIncomeDebtor'), 
  otherP: E('otherIncomePartner'),
  allowD: E('debtorAllowance'), 
  allowP: E('partnerAllowance'),
  unusual: E('unusualExpenses'), 
  child: E('childcareExpenses'), 
  alimony: E('alimonyExpenses'),
  tIncome: E('totalIncomeResult'), 
  tExp: E('totalExpensesResult'),
  base: E('baseLivingCostResult'), 
  kidsA: E('socialSecurityAllowance'),
  disp: E('disposableIncomeResult'),
  rDeb: E('debtorIncomeRatio'), 
  rPar: E('partnerIncomeRatio'),
  payDeb: E('debtorPaymentResult'), 
  payPar: E('partnerPaymentResult'),
  famCard: E('familyPaymentCard'), 
  payFam: E('finalPaymentResult'),
  zeroRow: E('zeroCaseRow'),
  partnerCard: E('partnerPaymentCard'), 
  debtorPayCard: E('debtorPaymentCard'),
  lblRD: E('debtorIncomeRatioLabel'), 
  lblRP: E('partnerIncomeRatioLabel'),
  lblPD: E('debtorPaymentLabel'),    
  lblPP: E('partnerPaymentLabel'),
  lblSalaryD: E('lblSalaryD'), 
  lblSalaryP: E('lblSalaryP'),
  lblOtherD: E('lblOtherD'),  
  lblOtherP: E('lblOtherP'),
  lblAllowD: E('lblAllowD'),  
  lblAllowP: E('lblAllowP'),
  btnAllow: E('btnAllowances'), 
  boxAllow: E('allowanceFields'),
  btnAlim: E('btnAlimony'),    
  boxAlim: E('alimonyFields'),
  btnExtra: E('btnExtra'),     
  boxExtra: E('extraFields'),
  male: E('debtorMaleBtn'), 
  female: E('debtorFemaleBtn'), 
  joint: E('jointBtn'),
  addChild: E('addChildBtn'), 
  childrenLabel: E('childrenCountLabel'),
};

const livingBase = {
  "יחיד": 4556,
  "רווק": 4556,
  "זוג": 6024,
};

const kidsMap = {
  0:0,1:169,2:383,3:597,4:811,
  5:980,6:1149,7:1318,8:1487,9:1656,10:1825
};

let calcGender = 'חייב';
let calcJoint = false;
let calcFamilyType = "יחיד";
let calcChildrenCount = 0;

function updateChildrenLabel(){
  if (calcEls.childrenLabel) {
    calcEls.childrenLabel.textContent = `(${calcChildrenCount})`;
  }
}

function updateLabelSets(){
  const d = (calcGender==='חייב')?'חייב':'חייבת';
  const p = (calcGender==='חייב')?'בת זוג':'בן זוג';
  if (calcEls.lblRD) calcEls.lblRD.textContent = `אחוז הכנסה (${d})`;
  if (calcEls.lblRP) calcEls.lblRP.textContent = `אחוז הכנסה (${p})`;
  if (calcEls.lblPD) calcEls.lblPD.textContent = `תשלום מוצע (${d})`;
  if (calcEls.lblPP) calcEls.lblPP.textContent = `תשלום מוצע (${p})`;
  if (calcEls.lblSalaryD) calcEls.lblSalaryD.textContent = `הכנסה (${d})`;
  if (calcEls.lblSalaryP) calcEls.lblSalaryP.textContent = `הכנסה (${p})`;
  if (calcEls.lblOtherD) calcEls.lblOtherD.textContent = `הכנסות אחרות (${d})`;
  if (calcEls.lblOtherP) calcEls.lblOtherP.textContent = `הכנסות אחרות (${p})`;
  if (calcEls.lblAllowD) calcEls.lblAllowD.textContent = `קצבה (${d})`;
  if (calcEls.lblAllowP) calcEls.lblAllowP.textContent = `קצבה (${p})`;
}

function setGender(g){
  calcGender = g;
  if (calcEls.male) {
    calcEls.male.classList.toggle('active', g==='חייב');
    calcEls.male.setAttribute('aria-pressed', String(g==='חייב'));
  }
  if (calcEls.female) {
    calcEls.female.classList.toggle('active', g==='חייבת');
    calcEls.female.setAttribute('aria-pressed', String(g==='חייבת'));
  }
  updateLabelSets(); 
  calcCalculator();
}

if (calcEls.male) calcEls.male.onclick = () => setGender('חייב');
if (calcEls.female) calcEls.female.onclick = () => setGender('חייבת');

if (calcEls.joint) {
  calcEls.joint.onclick = () => {
    calcJoint = !calcJoint;
    calcEls.joint.classList.toggle('active', calcJoint);
    calcEls.joint.setAttribute('aria-pressed', String(calcJoint));
    if (calcEls.famCard) calcEls.famCard.style.display = calcJoint ? 'block' : 'none';
    if (calcEls.partnerCard) calcEls.partnerCard.style.display = calcJoint ? 'block' : 'none';
    if (calcEls.debtorPayCard) calcEls.debtorPayCard.classList.toggle('solo-pay', !calcJoint);
    calcCalculator();
  };
}

if (calcEls.btnAllow) {
  calcEls.btnAllow.onclick = () => {
    calcEls.btnAllow.classList.toggle('active');
    if (calcEls.boxAllow) {
      calcEls.boxAllow.style.display = calcEls.btnAllow.classList.contains('active') ? 'grid' : 'none';
    }
  };
}

if (calcEls.btnAlim) {
  calcEls.btnAlim.onclick = () => {
    calcEls.btnAlim.classList.toggle('active');
    if (calcEls.boxAlim) {
      calcEls.boxAlim.style.display = calcEls.btnAlim.classList.contains('active') ? 'grid' : 'none';
    }
  };
}

if (calcEls.btnExtra) {
  calcEls.btnExtra.onclick = () => {
    calcEls.btnExtra.classList.toggle('active');
    if (calcEls.boxExtra) {
      calcEls.boxExtra.style.display = calcEls.btnExtra.classList.contains('active') ? 'grid' : 'none';
    }
  };
}

const familyTypeButtons = document.querySelectorAll('.family-type');
familyTypeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    calcFamilyType = btn.dataset.type;
    familyTypeButtons.forEach(b => b.classList.toggle('active', b === btn));
    calcCalculator();
    
    // עדכון החלק העליון כשמשנים במחשבון
    const type = btn.dataset.type;
    let maritalValue = '';
    
    if (type === 'זוג') {
      maritalValue = 'נשוי';
    } else if (type === 'רווק') {
      maritalValue = 'רווק';
    } else if (type === 'יחיד') {
      maritalValue = 'גרוש';
    }
    
    if (maritalValue) {
      const radio = document.querySelector(`input[name="maritalStatus"][value="${maritalValue}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
  });
});

if (calcEls.addChild) {
  calcEls.addChild.onclick = () => {
    if(calcChildrenCount < 10){
      calcChildrenCount++;
      updateChildrenLabel();
      calcCalculator();
    }
  };
}

let pop = null;
document.addEventListener('click', e => {
  const b = e.target.closest('.info-btn');
  if(b){
    e.stopPropagation();
    if(pop) pop.remove();
    pop = document.createElement('div');
    pop.className = 'pop';
    pop.innerHTML = (b.dataset.info||'').replace(/\n/g,'<br>');
    document.body.appendChild(pop);
    const r = b.getBoundingClientRect();
    pop.style.top = (window.scrollY + r.bottom + 8) + 'px';
    pop.style.right = (window.innerWidth - r.right + 8) + 'px';
    return;
  }
  if(pop){ pop.remove(); pop = null; }
});

function getBaseLiving(familyType, childrenCount){
  const base0 = livingBase[familyType] || 4556;
  const c = Math.max(0, childrenCount || 0);
  const upTo4 = Math.min(c, 4);
  const above4 = Math.max(c - 4, 0);
  return base0 + (upTo4 * 1500) + (above4 * 1300);
}

// פונקציית החישוב הראשית - קוראת מהטופס הראשי
function calcCalculator(){
  // קריאה מהשדות בטופס הראשי
  const debtorNetVal = parseVal(document.getElementById('debtorNet')?.value || '');
  const spouseNetVal = parseVal(document.getElementById('spouseNet')?.value || '');
  const totalAllowVal = parseVal(document.getElementById('totalAllow')?.value || '');
  
  // קריאה מפרטים אישיים - רק קטינים
  const minorsCount = parseInt(document.getElementById('minorsCount')?.value || '0') || 0;
  const alimonyVal = parseVal(document.getElementById('valAlimony')?.value || '');
  
  // עדכון מספר הילדים במחשבון - רק קטינים
  if (minorsCount !== calcChildrenCount) {
    calcChildrenCount = minorsCount;
    updateChildrenLabel();
  }
  
  // עדכון מזונות במחשבון
  if (calcEls.alimony && alimonyVal > 0) {
    calcEls.alimony.value = alimonyVal;
    // פתיחת שדה מזונות אם יש ערך
    const alimonyFields = document.getElementById('alimonyFields');
    if (alimonyFields && alimonyFields.style.display === 'none') {
      document.getElementById('btnAlimony')?.click();
    }
  }

  // עדכון שדות המחשבון (readonly)
  if (calcEls.salaryD) calcEls.salaryD.value = debtorNetVal || '';
  if (calcEls.salaryP) calcEls.salaryP.value = spouseNetVal || '';
  
  // עדכון קצבאות במחשבון
  if (totalAllowVal > 0) {
    // חלוקת קצבאות בין חייב לבן זוג (פשוט - חצי חצי)
    const halfAllow = totalAllowVal / 2;
    if (calcEls.allowD) calcEls.allowD.value = halfAllow;
    if (calcEls.allowP) calcEls.allowP.value = halfAllow;
    // פתיחת שדה קצבאות אם יש ערך
    const allowanceFields = document.getElementById('allowanceFields');
    if (allowanceFields && allowanceFields.style.display === 'none') {
      document.getElementById('btnAllowances')?.click();
    }
  }

  // חישוב בסיס מחיה
  const base = getBaseLiving(calcFamilyType, calcChildrenCount);
  const kids = kidsMap[calcChildrenCount] || 0;

  if (calcEls.base) calcEls.base.textContent = fmt(base);
  if (calcEls.kidsA) calcEls.kidsA.textContent = fmt(kids);

  // חישוב הכנסות
  const dS = debtorNetVal || 0;
  const pS = spouseNetVal || 0;
  const dO = +calcEls.otherD?.value || 0;
  const pO = +calcEls.otherP?.value || 0;
  const dA = +calcEls.allowD?.value || 0;
  const pA = +calcEls.allowP?.value || 0;
  const un = +calcEls.unusual?.value || 0;
  const ch = +calcEls.child?.value || 0;
  const al = +calcEls.alimony?.value || 0;

  // חלוקת קצבאות בין חייב לבן זוג (פשוט - חצי חצי)
  const allowD = Math.floor(totalAllowVal / 2);
  const allowP = totalAllowVal - allowD;

  const totalIncome = dS + pS + dO + pO + dA + pA + allowD + allowP + kids;
  if (calcEls.tIncome) calcEls.tIncome.textContent = fmt(totalIncome);

  const totalExp = base + un + ch + al;
  if (calcEls.tExp) calcEls.tExp.textContent = fmt(totalExp);

  const disp = totalIncome - totalExp;
  if (calcEls.disp) calcEls.disp.textContent = disp <= 0 ? 'אין הכנסה פנויה' : fmt(disp);

  const sumForRatio = dS + dO + pS + pO;
  const rD = sumForRatio > 0 ? (dS + dO) / sumForRatio : 0;
  const rP = sumForRatio > 0 ? (pS + pO) / sumForRatio : 0;
  if (calcEls.rDeb) calcEls.rDeb.textContent = (rD * 100).toFixed(1) + '%';
  if (calcEls.rPar) calcEls.rPar.textContent = (rP * 100).toFixed(1) + '%';

  const payD = r10((disp * rD) / 2);
  const payP = r10((disp * rP) / 2);
  if (calcEls.payDeb) calcEls.payDeb.textContent = fmt(Math.max(0, payD));
  if (calcEls.payPar) calcEls.payPar.textContent = fmt(Math.max(0, payP));

  if(calcJoint && calcEls.payFam){
    const fam = r10(Math.max(0, (disp / 2) - payP) * rD + payP);
    calcEls.payFam.textContent = fmt(fam);
  }

  const zeroCase = (dS === 0 && dO === 0 && (dA + allowD) > 0);
  if (calcEls.zeroRow) calcEls.zeroRow.style.display = zeroCase ? 'block' : 'none';
}

function initCalculator() {
  setGender('חייב');
  if (calcEls.debtorPayCard) calcEls.debtorPayCard.classList.add('solo-pay');
  updateChildrenLabel();
  calcCalculator();
  
  // קישור בין כפתורי סטטוס משפחתי בחלק העליון לכפתורים במחשבון
  const maritalStatusRadios = document.querySelectorAll('input[name="maritalStatus"]');
  maritalStatusRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        const value = this.value;
        let targetType = '';
        
        // מיפוי בין הערכים בחלק העליון לכפתורים במחשבון
        if (value === 'נשוי') {
          targetType = 'זוג';
        } else if (value === 'גרוש') {
          targetType = 'יחיד';
        } else if (value === 'רווק') {
          targetType = 'רווק';
        }
        
        // עדכון הכפתורים במחשבון
        if (targetType) {
          document.querySelectorAll('.family-type').forEach(btn => {
            const isActive = btn.dataset.type === targetType;
            btn.classList.toggle('active', isActive);
            if (isActive) {
              calcFamilyType = targetType;
              calcCalculator();
            }
          });
        }
      }
    });
  });
  
  // האזנה לשדות המחשבון עצמו
  [
    'otherIncomeDebtor', 'otherIncomePartner',
    'debtorAllowance', 'partnerAllowance',
    'unusualExpenses', 'childcareExpenses', 'alimonyExpenses'
  ].forEach(id => {
    const el = E(id);
    if(el) el.addEventListener('input', calcCalculator);
  });

  // כפתור איפוס
  const resetBtn = E('btnReset');
  if (resetBtn) {
    resetBtn.onclick = () => {
      calcChildrenCount = 0;
      updateChildrenLabel();
      document.querySelectorAll('#allowanceFields input[type="number"], #alimonyFields input[type="number"], #extraFields input[type="number"]').forEach(i => i.value = '');
      ['btnAllow', 'btnAlim', 'btnExtra'].forEach(k => {
        if(calcEls[k] && calcEls[k].classList.contains('active')) calcEls[k].click();
      });
      calcFamilyType = "יחיד";
      document.querySelectorAll('.family-type').forEach(b => {
        b.classList.toggle('active', b.dataset.type === "יחיד");
      });
      setGender('חייב');
      calcJoint = false;
      if (calcEls.joint) calcEls.joint.classList.remove('active');
      calcCalculator();
    };
  }
}

function togglePaymentType(type) {
  // פונקציה זו יכולה להיות מורחבת בעתיד
}

// ============================================
// פונקציות כפתורים חדשות
// ============================================

// שחזור גרסה שמורה
function restoreVersion() {
  if (confirm('האם אתה בטוח שברצונך לשחזר את הגרסה השמורה "שחזרו 100"? כל השינויים הנוכחיים יאבדו.')) {
    // כאן ניתן להוסיף לוגיקה לשחזור מהגיבוי
    alert('פונקציית השחזור תשולב בקרוב. בינתיים ניתן לשחזר ידנית מתיקיית "שחזרו 100".');
  }
}

// הדפסה
function printForm() {
  window.print();
}

// יצוא ל-PDF
function exportToPDF() {
  const { jsPDF } = window.jspdf;
  
  // הסתרת top-bar זמנית
  const topBar = document.querySelector('.top-bar');
  const originalDisplay = topBar ? topBar.style.display : '';
  if (topBar) {
    topBar.style.display = 'none';
  }
  
  // הסתרת כפתורים זמנית
  const buttons = document.querySelectorAll('.btn-action');
  const originalButtonDisplays = [];
  buttons.forEach(btn => {
    originalButtonDisplays.push(btn.style.display);
    btn.style.display = 'none';
  });
  
  html2canvas(document.querySelector('.page'), {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 0;
    
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    
    // שחזור תצוגה
    if (topBar) {
      topBar.style.display = originalDisplay;
    }
    buttons.forEach((btn, index) => {
      btn.style.display = originalButtonDisplays[index];
    });
    
    // הורדת PDF
    const fileName = `דוח_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }).catch(error => {
    console.error('שגיאה ביצירת PDF:', error);
    alert('אירעה שגיאה ביצירת PDF. נסה שוב.');
    
    // שחזור תצוגה במקרה של שגיאה
    if (topBar) {
      topBar.style.display = originalDisplay;
    }
    buttons.forEach((btn, index) => {
      btn.style.display = originalButtonDisplays[index];
    });
  });
}

// צילום מסך
function takeScreenshot() {
  // הסתרת top-bar זמנית
  const topBar = document.querySelector('.top-bar');
  const originalDisplay = topBar ? topBar.style.display : '';
  if (topBar) {
    topBar.style.display = 'none';
  }
  
  // הסתרת כפתורים זמנית
  const buttons = document.querySelectorAll('.btn-action');
  const originalButtonDisplays = [];
  buttons.forEach(btn => {
    originalButtonDisplays.push(btn.style.display);
    btn.style.display = 'none';
  });
  
  html2canvas(document.querySelector('.page'), {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  }).then(canvas => {
    // שחזור תצוגה
    if (topBar) {
      topBar.style.display = originalDisplay;
    }
    buttons.forEach((btn, index) => {
      btn.style.display = originalButtonDisplays[index];
    });
    
    // הורדת תמונה
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `צילום_מסך_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }).catch(error => {
    console.error('שגיאה בצילום מסך:', error);
    alert('אירעה שגיאה בצילום המסך. נסה שוב.');
    
    // שחזור תצוגה במקרה של שגיאה
    if (topBar) {
      topBar.style.display = originalDisplay;
    }
    buttons.forEach((btn, index) => {
      btn.style.display = originalButtonDisplays[index];
    });
  });
}

