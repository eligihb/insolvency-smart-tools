// ============================================
// פונקציות עזר כלליות
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // עדכון תאריך אוטומטי בכותרת ההדפסה
  const currentDateEl = document.getElementById('current-date');
  if (currentDateEl) {
    currentDateEl.innerText = new Date().toLocaleDateString('he-IL');
  }
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
  
  // הפעלה ראשונית של חישובים
  setTimeout(() => {
    try {
      updateAllCalculations();
      refreshSystem(); // עדכון כל המדדים
    } catch (error) {
      console.error('Error in initial calculations:', error);
    }
  }, 100);
  
  // מאזין גלובלי לכל שדות הקלט - מערכת ריאקטיבית
  setTimeout(() => {
    document.querySelectorAll('input, select').forEach(element => {
      // דילוג על orderDate, monthlyPayment, gradedPayment, gradedMonths - הם מטופלים ב-setupPaymentCalculation
      if (element.id === 'orderDate' || element.id === 'monthlyPayment' || 
          element.id === 'gradedPayment' || element.id === 'gradedMonths') {
        return;
      }
      
      // הוספת listener רק אם אין כבר אחד
      if (!element.dataset.reactiveListener) {
        element.addEventListener('input', refreshSystem);
        element.addEventListener('change', refreshSystem);
        element.addEventListener('blur', refreshSystem);
        element.dataset.reactiveListener = 'true';
      }
    });
    
    // מאזין לכפתורי chip
    document.querySelectorAll('button.chip, .chip').forEach(element => {
      if (!element.dataset.reactiveListener) {
        element.addEventListener('click', refreshSystem);
        element.dataset.reactiveListener = 'true';
      }
    });
    
    // מאזין ספציפי לצ'קבוקסים ורדיו של דוחות
    document.querySelectorAll('input[name="rep"], #chkMissingDocs').forEach(element => {
      if (!element.dataset.reactiveListener) {
        element.addEventListener('change', () => {
          updateTransparencyIndex();
          refreshSystem();
        });
        element.dataset.reactiveListener = 'true';
      }
    });
    
    // מאזין ספציפי לתאריך דיון
    const hearingDateInput = document.getElementById('hearingDate');
    if (hearingDateInput && !hearingDateInput.dataset.reactiveListener) {
      hearingDateInput.addEventListener('change', refreshSystem);
      hearingDateInput.dataset.reactiveListener = 'true';
    }
    
    // הפעלה ראשונית
    try {
      refreshSystem();
    } catch (error) {
      console.error('Error in reactive system initialization:', error);
    }
  }, 100);
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

  // הפיכת calculatePayment לפונקציה גלובלית כדי שתהיה נגישה מ-refreshSystem
  window.calculatePayment = function() {
    // קבלת האלמנטים מחדש בכל קריאה (למקרה שהם השתנו)
    const orderDateEl = document.getElementById('orderDate');
    const monthlyPaymentEl = document.getElementById('monthlyPayment');
    const gradedPaymentEl = document.getElementById('gradedPayment');
    const gradedMonthsEl = document.getElementById('gradedMonths');
    const totalToPayEl = document.getElementById('totalToPay');
    const monthsSinceOrderEl = document.getElementById('monthsSinceOrder');
    
    if (!orderDateEl || !monthsSinceOrderEl || !totalToPayEl) return;
    
    if (!orderDateEl.value) {
      monthsSinceOrderEl.value = '';
      totalToPayEl.value = '';
      return;
    }

    const orderDateObj = new Date(orderDateEl.value);
    
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
    
    monthsSinceOrderEl.value = months.toString();

    // חישוב סה"כ
    const monthly = parseCurrencyValue(monthlyPaymentEl ? monthlyPaymentEl.value : '');
    const graded = parseCurrencyValue(gradedPaymentEl ? gradedPaymentEl.value : '');
    const gradedMonthsCount = parseInt(gradedMonthsEl ? gradedMonthsEl.value : '0') || 0;

    // בדיקה אם זה תיק אפס - אם תשלום חודשי הוא 0 (רק אם יש ערך מפורש של 0)
    const monthlyStr = monthlyPaymentEl ? monthlyPaymentEl.value.replace(/[^\d]/g, '') : '';
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

    totalToPayEl.value = total.toLocaleString('he-IL') + ' ש"ח';
  };

  function parseCurrencyValue(val) {
    if (!val || val.trim() === '') return 0;
    const cleaned = val.replace(/[^\d]/g, '');
    if (cleaned === '') return 0;
    const num = parseInt(cleaned);
    return isNaN(num) ? 0 : num; // מחזיר 0 גם אם הערך הוא 0
  }

  // הוספת event listeners - גרסה פשוטה שעובדת
  // הסרת listeners קודמים אם יש (על ידי הוספת flag)
  if (!orderDate.dataset.paymentListener) {
    orderDate.addEventListener('change', window.calculatePayment);
    orderDate.addEventListener('input', window.calculatePayment);
    orderDate.dataset.paymentListener = 'true';
  }
  
  if (!monthlyPayment.dataset.paymentListener) {
    monthlyPayment.addEventListener('blur', window.calculatePayment);
    monthlyPayment.addEventListener('input', window.calculatePayment);
    monthlyPayment.dataset.paymentListener = 'true';
  }
  
  if (!gradedPayment.dataset.paymentListener) {
    gradedPayment.addEventListener('blur', window.calculatePayment);
    gradedPayment.addEventListener('input', window.calculatePayment);
    gradedPayment.dataset.paymentListener = 'true';
  }
  
  if (!gradedMonths.dataset.paymentListener) {
    gradedMonths.addEventListener('change', window.calculatePayment);
    gradedMonths.addEventListener('input', window.calculatePayment);
    gradedMonths.dataset.paymentListener = 'true';
  }
  
  // הפעלה ראשונית - רק אחרי שה-event listeners הוגדרו
  setTimeout(() => {
    if (typeof window.calculatePayment === 'function') {
      window.calculatePayment();
    }
  }, 200);
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

function calculateAge() {
  const birthYearInput = document.getElementById('birthYear');
  const ageInput = document.getElementById('debtorAge');
  if (!birthYearInput || !ageInput) return;
  
  const birthYear = parseInt(birthYearInput.value);
  if (!birthYear || birthYear < 1900 || birthYear > 2100) {
    ageInput.value = '';
    return;
  }
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  ageInput.value = age > 0 && age < 100 ? age.toString().padStart(2, '0') : '';
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

// פונקציה מרכזית לעדכון כל החישובים
// פונקציה מרכזית שרצה בכל שינוי בטופס - מערכת ריאקטיבית
function refreshSystem() {
  try {
    const data = getFormData(); // פונקציה שאוספת את כל הערכים מהשדות
    
    // עדכון חישוב תשלומים (כולל מס' חודשים מיום הצו) - קודם כל
    if (typeof window.calculatePayment === 'function') {
      try {
        window.calculatePayment();
      } catch (e) {
        console.error('Error in calculatePayment:', e);
      }
    }
    
    // עדכון חישובים בסיסיים
    updateAllCalculations();
    
    // עדכון מחשבון
    if (typeof calculateFinances === 'function') {
      calculateFinances(data);
    }
    
    // עדכון חישוב חודשים ופיגורים
    if (typeof calculateMonthsAndCompliance === 'function') {
      calculateMonthsAndCompliance();
    }
    
    // עדכון גרפים ומדדים
    if (typeof updateSmartGraphs === 'function') {
      updateSmartGraphs(data);
    }
    if (typeof generateLegalSummary === 'function') {
      generateLegalSummary(data);
    }
    if (typeof updateDividendChart === 'function') {
      updateDividendChart(data);
    }
    
    // עדכון חישוב תשלומים (כולל תאריך דיון) - כבר טופל למעלה
    
    // עדכון מדד שקיפות
    if (typeof updateTransparencyIndex === 'function') {
      updateTransparencyIndex();
    }
    
    // חישוב כל המדדים
    if (typeof calculateAllMetrics === 'function') {
      calculateAllMetrics();
    }
  } catch (error) {
    console.error('Error in refreshSystem:', error);
  }
}

// איסוף כל הנתונים מהטופס
function getFormData() {
  const debtorNet = parseVal(document.getElementById('debtorNet')?.value || '');
  const spouseNet = parseVal(document.getElementById('spouseNet')?.value || '');
  const totalAllow = parseVal(document.getElementById('totalAllow')?.value || '');
  const debtorPotential = parseVal(document.getElementById('debtorPotential')?.value || '');
  const debtorOther = parseVal(calcEls.otherD?.value || '');
  const spouseOther = parseVal(calcEls.otherP?.value || '');
  const minorsCount = parseInt(document.getElementById('minorsCount')?.value || '0') || 0;
  const alimonyVal = parseVal(document.getElementById('valAlimony')?.value || '');
  const unusualExp = parseVal(calcEls.unusual?.value || '');
  const childcareExp = parseVal(calcEls.child?.value || '');
  const isNotWorking = document.getElementById('chkDebtorNotWorking')?.checked || false;
  
  // חישוב סטטוס משפחתי
  const maritalStatus = document.querySelector('input[name="maritalStatus"]:checked')?.value || '';
  const isMarried = maritalStatus === 'נשוי';
  const familySize = 1 + (isMarried ? 1 : 0) + minorsCount;
  
  // בדיקת תיק אפס
  const hasOnlyAllowances = (debtorNet === 0 && debtorOther === 0 && debtorPotential === 0 && totalAllow > 0);
  const onlyAllowances = isNotWorking && hasOnlyAllowances;
  
  // חישוב בסיס מחייה
  let familyType = 'יחיד';
  if (maritalStatus === 'נשוי') familyType = 'זוג';
  else if (maritalStatus === 'רווק') familyType = 'רווק';
  
  const baseLivingCost = getBaseLiving(familyType, minorsCount);
  const kidsAllowance = kidsMap[minorsCount] || 0;
  
  // חישוב הכנסות כוללות
  const allowD = Math.floor(totalAllow / 2);
  const allowP = totalAllow - allowD;
  const totalIncome = debtorNet + spouseNet + debtorOther + spouseOther + allowD + allowP + kidsAllowance;
  
  // חישוב הוצאות כוללות
  const totalExpenses = baseLivingCost + unusualExp + childcareExp + alimonyVal;
  
  // חישוב הכנסה פנויה
  const disposableIncome = totalIncome - totalExpenses;
  
  // חישוב תשלום מוצע
  const sumForRatio = debtorNet + debtorOther + spouseNet + spouseOther;
  const rD = sumForRatio > 0 ? (debtorNet + debtorOther) / sumForRatio : 0;
  const payD = disposableIncome > 0 ? r10((disposableIncome * rD) / 2) : 0;
  
  return {
    debtorNet,
    spouseNet,
    totalAllow,
    debtorPotential,
    debtorOther,
    spouseOther,
    minorsCount,
    alimonyVal,
    unusualExp,
    childcareExp,
    isNotWorking,
    onlyAllowances,
    familySize,
    totalSouls: familySize,
    baseLivingCost,
    totalIncome,
    totalExpenses,
    disposableIncome,
    proposedPayment: payD,
    familyType
  };
}

// חישוב כספים ועדכון המחשבון
function calculateFinances(data) {
  // עדכון מספר הילדים במחשבון
  if (data.minorsCount !== calcChildrenCount) {
    calcChildrenCount = data.minorsCount;
    updateChildrenLabel();
  }
  
  // עדכון שדות המחשבון
  if (calcEls.salaryD) calcEls.salaryD.value = data.debtorNet || '';
  if (calcEls.salaryP) calcEls.salaryP.value = data.spouseNet || '';
  
  // עדכון קצבאות
  if (data.totalAllow > 0) {
    const halfAllow = data.totalAllow / 2;
    if (calcEls.allowD) calcEls.allowD.value = halfAllow;
    if (calcEls.allowP) calcEls.allowP.value = halfAllow;
  }
  
  // עדכון מזונות
  if (calcEls.alimony && data.alimonyVal > 0) {
    calcEls.alimony.value = data.alimonyVal;
  }
  
  // עדכון בסיס מחייה
  if (calcEls.base) calcEls.base.textContent = fmt(data.baseLivingCost);
  const kids = kidsMap[data.minorsCount] || 0;
  if (calcEls.kidsA) calcEls.kidsA.textContent = fmt(kids);
  
  // עדכון סה"כ הכנסות
  if (calcEls.tIncome) calcEls.tIncome.textContent = fmt(data.totalIncome);
  
  // עדכון סה"כ הוצאות
  if (calcEls.tExp) calcEls.tExp.textContent = fmt(data.totalExpenses);
  
  // עדכון הכנסה פנויה
  if (calcEls.disp) {
    if (data.disposableIncome <= 0) {
      calcEls.disp.textContent = 'אין הכנסה פנויה';
      calcEls.disp.style.color = 'var(--danger)';
      calcEls.disp.style.fontWeight = '700';
    } else {
      calcEls.disp.textContent = fmt(data.disposableIncome);
      calcEls.disp.style.color = 'var(--green)';
      calcEls.disp.style.fontWeight = '800';
    }
  }
  
  // עדכון תשלומים מוצעים
  const sumForRatio = data.debtorNet + data.debtorOther + data.spouseNet + data.spouseOther;
  const rD = sumForRatio > 0 ? (data.debtorNet + data.debtorOther) / sumForRatio : 0;
  const rP = sumForRatio > 0 ? (data.spouseNet + data.spouseOther) / sumForRatio : 0;
  
  if (calcEls.rDeb) calcEls.rDeb.textContent = (rD * 100).toFixed(1) + '%';
  if (calcEls.rPar) calcEls.rPar.textContent = (rP * 100).toFixed(1) + '%';
  
  const payD = data.disposableIncome > 0 ? r10((data.disposableIncome * rD) / 2) : 0;
  const payP = data.disposableIncome > 0 ? r10((data.disposableIncome * rP) / 2) : 0;
  
  // כפיית תשלום 0 בתיק אפס
  const finalPayD = data.onlyAllowances ? 0 : payD;
  const finalPayP = data.onlyAllowances ? 0 : payP;
  
  if (calcEls.payDeb) calcEls.payDeb.textContent = fmt(Math.max(0, finalPayD));
  if (calcEls.payPar) calcEls.payPar.textContent = fmt(Math.max(0, finalPayP));
  
  // עדכון באנר תיק אפס
  const zeroCaseBanner = document.getElementById('zeroCaseBanner');
  if (zeroCaseBanner) {
    zeroCaseBanner.style.display = data.onlyAllowances ? 'block' : 'none';
  }
  
  // מדד מאמץ מעודכן ב-updateSmartGraphs
}

// פונקציה מרכזית לחישוב ועדכון כל החישובים הבסיסיים
function updateAllCalculations() {
  // איסוף נתונים מהטופס
  const data = getFormData();
  
  // חישוב סך הכנסות
  const totalIncome = data.totalIncome || 0;
  
  // חישוב סך הוצאות
  const totalExpenses = data.totalExpenses || 0;
  
  // חישוב הכנסה פנויה
  const disposableIncome = data.disposableIncome || 0;
  
  // עדכון שדות התוצאה - פורמט ש"ח עם פסיקים
  const totalIncomeEl = document.getElementById('totalIncomeResult');
  if (totalIncomeEl) {
    totalIncomeEl.textContent = totalIncome.toLocaleString('he-IL') + ' ש"ח';
  }
  
  const totalExpensesEl = document.getElementById('totalExpensesResult');
  if (totalExpensesEl) {
    totalExpensesEl.textContent = totalExpenses.toLocaleString('he-IL') + ' ש"ח';
  }
  
  const disposableIncomeEl = document.getElementById('disposableIncomeResult');
  if (disposableIncomeEl) {
    if (disposableIncome <= 0) {
      disposableIncomeEl.textContent = 'אין הכנסה פנויה';
      disposableIncomeEl.style.color = 'var(--danger)';
      disposableIncomeEl.style.fontWeight = '700';
    } else {
      disposableIncomeEl.textContent = disposableIncome.toLocaleString('he-IL') + ' ש"ח';
      disposableIncomeEl.style.color = 'var(--green)';
      disposableIncomeEl.style.fontWeight = '800';
    }
  }
  
  // עדכון גם את המחשבון (אם קיים)
  calculateFinances(data);
  
  // חישוב חודשים ופיגורים
  calculateMonthsAndCompliance();
  
  // עדכון מדד שקיפות
  updateTransparencyIndex();
  
  // עדכון חישוב דיבידנד
  updateDividendChart(data);
}

// פונקציה עזר לחישוב מדד עמידה (נקראת מ-calculatePayment)
function calculateComplianceIndex(monthsSinceOrder) {
  const monthlyPayment = parseVal(document.getElementById('monthlyPayment')?.value || '') || 0;
  const caseBalance = parseVal(document.getElementById('caseBalance')?.value || '') || 0;
  
  // חישוב צבירה מצופה
  const expectedAccumulation = monthlyPayment * monthsSinceOrder;
  
  // חישוב אחוז עמידה
  let compliancePercent = 0;
  let arrearsAmount = 0;
  let hasCredit = false;
  
  if (expectedAccumulation > 0) {
    if (caseBalance > expectedAccumulation) {
      // יתרת זכות
      compliancePercent = 100;
      arrearsAmount = 0;
      hasCredit = true;
    } else if (caseBalance >= expectedAccumulation) {
      compliancePercent = 100;
      arrearsAmount = 0;
    } else {
      compliancePercent = (caseBalance / expectedAccumulation) * 100;
      arrearsAmount = expectedAccumulation - caseBalance;
    }
  } else if (caseBalance >= 0 && monthsSinceOrder > 0) {
    compliancePercent = 100;
    arrearsAmount = 0;
  }
  
  // הגבלה ל-0-100%
  compliancePercent = Math.min(100, Math.max(0, compliancePercent));
  
  // עדכון מדד הפיגורים
  updateArrearsGauge(compliancePercent, arrearsAmount, hasCredit);
}

// פונקציה לעדכון מדד שקיפות
function updateTransparencyIndex() {
  // בדיקת מצב הדוחות - נחפש את הרדיו שנבחר
  const repRadios = document.querySelectorAll('input[name="rep"]');
  let reportsAsOrdered = false;
  let reportsPartial = false;
  let reportsNotSubmitted = false;
  let hasSelection = false;
  
  repRadios.forEach((radio, index) => {
    if (radio.checked) {
      hasSelection = true;
      // נסה לפי הטקסט ב-label
      const label = radio.closest('label');
      if (label) {
        const labelText = label.textContent.trim();
        if (labelText.includes('כסדרם') || labelText.includes('כסדר')) {
          reportsAsOrdered = true;
        } else if (labelText.includes('חלקי')) {
          reportsPartial = true;
        } else if (labelText.includes('לא הוגשו') || labelText.includes('לא הוגש')) {
          reportsNotSubmitted = true;
        }
      }
      // אם לא מצאנו לפי טקסט, נסה לפי המיקום (index)
      if (!reportsAsOrdered && !reportsPartial && !reportsNotSubmitted) {
        if (index === 0) {
          reportsAsOrdered = true;
        } else if (index === 1) {
          reportsPartial = true;
        } else if (index === 2) {
          reportsNotSubmitted = true;
        }
      }
    }
  });
  
  // אם לא נבחר כלום - לא לעשות כלום
  if (!hasSelection) {
    const transparencyGauge = document.getElementById('transparencyGauge');
    const transparencyText = document.getElementById('transparencyText');
    const transparencyValue = document.getElementById('transparencyValue');
    const statusTextEl = document.getElementById('transparencyStatusText');
    
    if (transparencyGauge) transparencyGauge.style.width = '0%';
    if (transparencyText) transparencyText.textContent = '';
    if (transparencyValue) {
      transparencyValue.textContent = '';
      transparencyValue.style.display = 'none';
    }
    if (statusTextEl) statusTextEl.textContent = '';
    return;
  }
  
  // בדיקת מסמכים חסרים
  const chkMissingDocs = document.getElementById('chkMissingDocs');
  const hasMissingDocs = chkMissingDocs ? chkMissingDocs.checked : false;
  
  const transparencyGauge = document.getElementById('transparencyGauge');
  const transparencyText = document.getElementById('transparencyText');
  const transparencyValue = document.getElementById('transparencyValue');
  
  if (transparencyGauge && transparencyText && transparencyValue) {
    let transparency = 0;
    
    // ניקוד לפי מצב הדוחות - חישוב אחוזים עם מסמכים חסרים
    // אם יש מסמכים חסרים, הסרגל ימדוד גם את זה ויחלק באחוזים
    if (reportsAsOrdered && !hasMissingDocs) {
      transparency = 100; // כסדרם + אין מסמכים חסרים = 100%
    } else if (reportsAsOrdered && hasMissingDocs) {
      transparency = 50; // כסדרם אבל יש מסמכים חסרים = 50%
    } else if (reportsPartial && !hasMissingDocs) {
      transparency = 50; // חלקי + אין מסמכים חסרים = 50%
    } else if (reportsPartial && hasMissingDocs) {
      transparency = 25; // חלקי + יש מסמכים חסרים = 25%
    } else if (reportsNotSubmitted && !hasMissingDocs) {
      transparency = 0; // לא הוגשו + אין מסמכים חסרים = 0%
    } else if (reportsNotSubmitted && hasMissingDocs) {
      transparency = 0; // לא הוגשו + יש מסמכים חסרים = 0%
    } else if (hasMissingDocs) {
      // רק מסמכים חסרים ללא בחירת דוחות
      transparency = 0;
    }
    
    // עדכון הגרף
    transparencyGauge.style.width = transparency + '%';
    transparencyGauge.className = 'compact-gauge-fill';
    transparencyGauge.classList.remove('low', 'medium', 'high');
    
    // צבעים: ירוק 100%, כתום 50%, אדום 0%
    if (transparency >= 100) {
      transparencyGauge.classList.add('low'); // ירוק
    } else if (transparency >= 50) {
      transparencyGauge.classList.add('medium'); // כתום
    } else {
      transparencyGauge.classList.add('high'); // אדום
    }
    
    // עדכון הטקסט - הסרת כפילות
    const percentText = transparency + '%';
    transparencyText.textContent = ''; // הסרת כפילות - רק transparencyValue יציג
    
    // עדכון מלל דינמי לפי אחוזים
    const statusTextEl = document.getElementById('transparencyStatusText');
    if (statusTextEl) {
      let statusText = '';
      let statusColor = '';
      
      if (transparency >= 80) {
        statusText = 'שיתוף פעולה מלא';
        statusColor = '#10b981'; // ירוק
      } else if (transparency >= 50) {
        statusText = 'שיתוף פעולה חלקי - נדרשת השלמה';
        statusColor = '#f59e0b'; // כתום
      } else {
        statusText = 'העדר שיתוף פעולה/מסמכים חסרים';
        statusColor = '#ef4444'; // אדום
      }
      
      statusTextEl.textContent = statusText;
      statusTextEl.style.color = statusColor;
      statusTextEl.style.fontWeight = '700';
    }
  }
}

// פונקציה לעדכון גרף מדד הפיגורים (עם לוגיקת רמזור מתוקנת)
function updateArrearsGauge(compliancePercent, arrearsAmount, hasCredit = false) {
  const arrearsGauge = document.getElementById('arrearsGauge');
  const arrearsText = document.getElementById('arrearsText');
  const arrearsValue = document.getElementById('arrearsValue');
  
  if (arrearsGauge && arrearsText && arrearsValue) {
    // עדכון הגרף (0-100%)
    arrearsGauge.style.width = compliancePercent + '%';
    arrearsGauge.className = 'compact-gauge-fill';
    arrearsGauge.classList.remove('low', 'medium', 'high');
    
    // לוגיקת רמזור: ירוק כשאין פיגורים (100%), אדום ככל שיש יותר פיגורים
    let statusText = '';
    // חישוב אחוז פיגורים (הפוך מ-compliance)
    const arrearsPercent = 100 - compliancePercent;
    
    if (hasCredit || compliancePercent >= 100) {
      // אין פיגורים - ירוק
      arrearsGauge.style.background = '#22c55e'; // ירוק
      statusText = hasCredit ? 'יתרת זכות' : 'אין פיגורים';
    } else {
      // יש פיגורים - מעבר מירוק לאדום לפי אחוז הפיגורים
      // 0% פיגורים = ירוק, 100% פיגורים = אדום
      const red = Math.min(255, Math.round(34 + (arrearsPercent * 2.21))); // 34-255
      const green = Math.max(0, Math.round(197 - (arrearsPercent * 1.97))); // 197-0
      arrearsGauge.style.background = `rgb(${red}, ${green}, 34)`;
      
      if (arrearsPercent < 5) {
        statusText = 'פיגור מינורי';
      } else if (arrearsPercent < 30) {
        statusText = 'פיגור בינוני';
      } else {
        statusText = 'פיגור משמעותי';
      }
    }
    
    // עדכון הטקסט באחוזים (ללא ספרות אחרי הנקודה) - רק בתוך הסרגל
    const percentText = Math.round(compliancePercent) + '%';
    arrearsText.textContent = percentText; // רק בתוך הסרגל
    
    // עדכון כותרת המשנה עם סטטוס
    const subtitleEl = document.querySelector('#arrearsValue')?.closest('.metric-card')?.querySelector('.metric-subtitle');
    if (subtitleEl && statusText) {
      const originalSubtitle = 'יתרה בקופה מול צבירה צפויה';
      subtitleEl.textContent = `${originalSubtitle} • ${statusText}`;
    }
    
    // עדכון ערך מדד פיגורים - אחוזים וסכומים (כמה מתוך כמה)
    const formatter = new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    // חישוב סכומים
    const monthlyPayment = parseVal(document.getElementById('monthlyPayment')?.value || '') || 0;
    const monthsSinceOrder = parseVal(document.getElementById('monthsSinceOrder')?.textContent || '0') || 0;
    const expectedAccumulation = monthlyPayment * monthsSinceOrder;
    const caseBalance = parseVal(document.getElementById('caseBalance')?.value || '') || 0;
    
    if (arrearsValue) {
      if (monthsSinceOrder > 0 && monthlyPayment > 0) {
        // הסרת תצוגת אחוזים - רק "פעיל"
        arrearsValue.textContent = "פעיל";
        arrearsValue.style.display = 'block';
      } else {
        arrearsValue.textContent = '';
        arrearsValue.style.display = 'none';
      }
    }
    
    // הוספת tooltip
    if (arrearsAmount > 0) {
      arrearsValue.title = `פיגור של ${formatter.format(arrearsAmount)}`;
    } else if (hasCredit) {
      arrearsValue.title = statusText;
    } else {
      arrearsValue.title = '';
    }
  }
}

// פונקציה לחישוב חודשים ופיגורים
function calculateMonthsAndCompliance() {
  // 1. חישוב מספר חודשים מתאריך הצו עד היום
  const orderDate = document.getElementById('orderDate');
  const monthsSinceOrderEl = document.getElementById('monthsSinceOrder');
  
  if (!orderDate || !monthsSinceOrderEl) return;
  
  // אם אין תאריך צו - לא לעשות כלום
  if (!orderDate.value) {
    const arrearsGauge = document.getElementById('arrearsGauge');
    const arrearsText = document.getElementById('arrearsText');
    const arrearsValue = document.getElementById('arrearsValue');
    
    if (arrearsGauge) arrearsGauge.style.width = '0%';
    if (arrearsText) arrearsText.textContent = '';
    if (arrearsValue) {
      arrearsValue.textContent = '';
      arrearsValue.style.display = 'none';
    }
    return;
  }
  
  let monthsSinceOrder = 0;
  
  if (orderDate.value) {
    const orderDateObj = new Date(orderDate.value);
    const today = new Date();
    
    // בדיקה אם התאריך בעתיד
    if (orderDateObj > today) {
      monthsSinceOrder = 0;
    } else {
      // תאריך התחלה: החודש שלאחר מתן הצו (לא החודש של הצו עצמו)
      const startDate = new Date(orderDateObj.getFullYear(), orderDateObj.getMonth() + 1, 1);
      
      // תאריך סיום: ראשון לחודש הנוכחי (לא כולל החודש הנוכחי)
      const endDate = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // חישוב חודשים בין התאריכים
      if (startDate < endDate) {
        const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        
        while (startMonth < endMonth) {
          monthsSinceOrder++;
          startMonth.setMonth(startMonth.getMonth() + 1);
        }
      }
    }
  }
  
  // עדכון השדה "מס' חודשים מיום הצו"
  if (monthsSinceOrderEl.tagName === 'INPUT') {
    monthsSinceOrderEl.value = monthsSinceOrder.toString();
  } else {
    monthsSinceOrderEl.textContent = monthsSinceOrder.toString();
  }
  
  // 2. חישוב מדד עמידה בתוכנית (Compliance Index)
  const monthlyPayment = parseVal(document.getElementById('monthlyPayment')?.value || '') || 0;
  const caseBalance = parseVal(document.getElementById('caseBalance')?.value || '') || 0;
  
  // חישוב צבירה מצופה: תשלום חודשי × מספר חודשים
  const expectedAccumulation = monthlyPayment * monthsSinceOrder;
  
  // חישוב אחוז עמידה: (יתרה בתיק / (תשלום בצו * חודשים)) * 100
  let compliancePercent = 0;
  let arrearsAmount = 0;
  let hasCredit = false; // יתרת זכות
  
  if (expectedAccumulation > 0) {
    // אם היתרה גדולה מהצבירה המצופה -> יתרת זכות
    if (caseBalance > expectedAccumulation) {
      compliancePercent = 100;
      arrearsAmount = 0;
      hasCredit = true;
    } else if (caseBalance >= expectedAccumulation) {
      // אם היתרה שווה לצבירה המצופה -> 100%
      compliancePercent = 100;
      arrearsAmount = 0;
    } else {
      // אם היתרה נמוכה מהצבירה -> אחוז יחסי
      compliancePercent = (caseBalance / expectedAccumulation) * 100;
      arrearsAmount = expectedAccumulation - caseBalance;
    }
  } else if (caseBalance >= 0 && monthsSinceOrder > 0) {
    // אם אין תשלום צפוי אבל יש יתרה חיובית
    compliancePercent = 100;
    arrearsAmount = 0;
  }
  
  // הגבלה ל-0-100% למדד הויזואלי
  compliancePercent = Math.min(100, Math.max(0, compliancePercent));
  
  // עדכון מדד הפיגורים ב-Grid 2x2
  const arrearsGauge = document.getElementById('arrearsGauge');
  const arrearsText = document.getElementById('arrearsText');
  const arrearsValue = document.getElementById('arrearsValue');
  const arrearsSubtitle = document.querySelector('#arrearsValue')?.parentElement?.querySelector('.metric-subtitle');
  
  if (arrearsGauge && arrearsText && arrearsValue) {
    // עדכון הגרף (0-100%)
    arrearsGauge.style.width = compliancePercent + '%';
    arrearsGauge.className = 'compact-gauge-fill';
    arrearsGauge.classList.remove('low', 'medium', 'high');
    
    // לוגיקת רמזור: ירוק כשאין פיגורים (100%), אדום ככל שיש יותר פיגורים
    let statusText = '';
    // חישוב אחוז פיגורים (הפוך מ-compliance)
    const arrearsPercent = 100 - compliancePercent;
    
    if (hasCredit || compliancePercent >= 100) {
      // אין פיגורים - ירוק
      arrearsGauge.style.background = '#22c55e'; // ירוק
      statusText = hasCredit ? 'יתרת זכות' : 'אין פיגורים';
    } else {
      // יש פיגורים - מעבר מירוק לאדום לפי אחוז הפיגורים
      // 0% פיגורים = ירוק, 100% פיגורים = אדום
      const red = Math.min(255, Math.round(34 + (arrearsPercent * 2.21))); // 34-255
      const green = Math.max(0, Math.round(197 - (arrearsPercent * 1.97))); // 197-0
      arrearsGauge.style.background = `rgb(${red}, ${green}, 34)`;
      
      if (arrearsPercent < 5) {
        statusText = 'פיגור מינורי';
      } else if (arrearsPercent < 30) {
        statusText = 'פיגור בינוני';
      } else {
        statusText = 'פיגור משמעותי';
      }
    }
    
    // עדכון הטקסט באחוזים (ללא ספרות אחרי הנקודה) - רק בתוך הסרגל
    const percentText = Math.round(compliancePercent) + '%';
    arrearsText.textContent = percentText; // רק בתוך הסרגל
    
    // עדכון כותרת המשנה עם סטטוס
    const subtitleEl = document.querySelector('#arrearsValue')?.closest('.metric-card')?.querySelector('.metric-subtitle');
    if (subtitleEl && statusText) {
      const originalSubtitle = 'יתרה בקופה מול צבירה צפויה';
      subtitleEl.textContent = `${originalSubtitle} • ${statusText}`;
    }
    
    // עדכון ערך מדד פיגורים - אחוזים וסכומים (כמה מתוך כמה)
    const formatter = new Intl.NumberFormat('he-IL', { 
      style: 'currency', 
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    // חישוב סכומים
    const monthlyPayment = parseVal(document.getElementById('monthlyPayment')?.value || '') || 0;
    const monthsSinceOrder = parseVal(document.getElementById('monthsSinceOrder')?.textContent || '0') || 0;
    const expectedAccumulation = monthlyPayment * monthsSinceOrder;
    const caseBalance = parseVal(document.getElementById('caseBalance')?.value || '') || 0;
    
    if (arrearsValue) {
      if (monthsSinceOrder > 0 && monthlyPayment > 0) {
        // הסרת תצוגת אחוזים - רק "פעיל"
        arrearsValue.textContent = "פעיל";
        arrearsValue.style.display = 'block';
      } else {
        arrearsValue.textContent = '';
        arrearsValue.style.display = 'none';
      }
    }
    
    // הוספת tooltip עם סכום הפיגור בשקלים
    if (arrearsAmount > 0) {
      arrearsValue.title = `פיגור של ${formatter.format(arrearsAmount)}`;
    } else if (hasCredit) {
      const creditAmount = caseBalance - expectedAccumulation;
      arrearsValue.title = `יתרת זכות: ${formatter.format(creditAmount)}`;
    } else {
      arrearsValue.title = '';
    }
  }
}

function setupCalculations() {
  // רשימת כל השדות שצריכים לעדכן חישובים
  const calculationFields = [
    'debtorNet', 'spouseNet', 'totalAllow', // הכנסות
    'debtorPotential', // פוטנציאל
    'minorsCount', 'valAlimony', // פרטים אישיים
    'grandTotalExpenses' // הוצאות כוללות
  ];
  
  // הוספת event listeners לכל השדות
  calculationFields.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('input', updateAllCalculations);
      el.addEventListener('blur', updateAllCalculations);
      el.addEventListener('change', updateAllCalculations);
    }
  });
  
  // האזנה לחישוב הכנסות (שמירה על הפונקציה הקיימת)
  ['debtorNet', 'spouseNet', 'totalAllow'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('blur', calcIncomeTotal);
      el.addEventListener('input', () => {
        calcIncomeTotal();
        updateAllCalculations(); // עדכון מחשבון בזמן אמת
      });
    }
  });

  // עדכון מחשבון מפרטים אישיים - רק קטינים
  ['minorsCount', 'valAlimony'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('input', updateAllCalculations);
      el.addEventListener('change', updateAllCalculations);
    }
  });
  
  // עדכון מחשבון כשמסמנים מזונות
  const chkAlimony = document.getElementById('chkAlimony');
  if (chkAlimony) {
    chkAlimony.addEventListener('change', updateAllCalculations);
  }
  
  // עדכון כשמסמנים "אינו עובד"
  const chkDebtorNotWorking = document.getElementById('chkDebtorNotWorking');
  if (chkDebtorNotWorking) {
    chkDebtorNotWorking.addEventListener('change', updateAllCalculations);
  }
  
  // עדכון כשמשנים סטטוס משפחתי
  const maritalStatusRadios = document.querySelectorAll('input[name="maritalStatus"]');
  maritalStatusRadios.forEach(radio => {
    radio.addEventListener('change', updateAllCalculations);
  });
  
  // עדכון שדות במחשבון עצמו
  const calculatorInputs = [
    'otherIncomeDebtor', 'otherIncomePartner',
    'debtorAllowance', 'partnerAllowance',
    'unusualExpenses', 'childcareExpenses', 'alimonyExpenses'
  ];
  
  calculatorInputs.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.removeEventListener('input', updateAllCalculations);
      el.removeEventListener('blur', updateAllCalculations);
      el.addEventListener('input', updateAllCalculations);
      el.addEventListener('blur', updateAllCalculations);
    }
  });
  
  // הוספת מאזין input לכל שדות המספרים הכלליים
  document.querySelectorAll('.currency-input, input[type="number"]').forEach(el => {
    if (!el.dataset.hasCalculationListener) {
      el.addEventListener('input', updateAllCalculations);
      el.addEventListener('blur', updateAllCalculations);
      el.dataset.hasCalculationListener = 'true';
    }
  });
  
  // הוספת מאזין change לכל צ'קבוקסים
  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    if (!checkbox.dataset.hasCalculationListener) {
      checkbox.addEventListener('change', updateAllCalculations);
      checkbox.dataset.hasCalculationListener = 'true';
    }
  });
  
  // מאזינים לשדות חובות, יתרה, דין קדימה, תשלום חודשי
  const criticalFields = ['caseBalance', 'monthlyPayment', 'orderDate', 'hearingDate'];
  criticalFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.hasCalculationListener) {
      el.addEventListener('input', () => {
        updateAllCalculations();
        refreshSystem(); // עדכון כל המדדים
      });
      el.addEventListener('change', () => {
        updateAllCalculations();
        refreshSystem(); // עדכון כל המדדים
      });
      el.addEventListener('blur', () => {
        updateAllCalculations();
        refreshSystem(); // עדכון כל המדדים
      });
      el.dataset.hasCalculationListener = 'true';
    }
  });
  
  // מאזינים לשדות חובות (8 ספרות)
  const debtFields = document.querySelectorAll('.currency-input[maxlength="8"]');
  debtFields.forEach(field => {
    if (!field.dataset.hasCalculationListener) {
      field.addEventListener('input', () => {
        updateAllCalculations();
        refreshSystem(); // עדכון כל המדדים
      });
      field.addEventListener('blur', () => {
        updateAllCalculations();
        refreshSystem(); // עדכון כל המדדים
      });
      field.dataset.hasCalculationListener = 'true';
    }
  });
  
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

  // האזנה לשדה פוטנציאל
  const debtorPotential = document.getElementById('debtorPotential');
  if (debtorPotential) {
    debtorPotential.addEventListener('blur', () => {
      const netVal = parseVal(document.getElementById('debtorNet')?.value || '');
      validateIncomeGap(netVal, debtorPotential.value);
    });
  }

  // האזנה לשדה הוצאות
  const grandTotalExpenses = document.getElementById('grandTotalExpenses');
  if (grandTotalExpenses) {
    grandTotalExpenses.addEventListener('blur', () => {
      calcCalculator();
    });
  }

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

// פונקציית איפוס מלאה - כולל איפוס כל המדדים
function resetFormAndMetrics() {
  if (confirm('האם אתה בטוח שברצונך לאפס את כל השדות?')) {
    // שמירת כל נתוני הטופס לפני איפוס
    saveFormDataBeforeReset();
    
    // איפוס השדות
    document.getElementById('mainForm').reset();
    
    // איפוס שדות נוספים
    const today = new Date();
    const paymentDate = document.getElementById('paymentDate');
    if (paymentDate && paymentDate.tagName === 'SPAN') {
      paymentDate.textContent = today.toLocaleDateString('he-IL');
    }
    
    // איפוס כל המדדים הויזואליים ל-0
    updateGauge('effortScore', 0);
    updateGauge('arrears', 0);
    updateGauge('transparency', 0);
    
    // איפוס מלל דינמי - מדד שקיפות
    const transparencyStatusText = document.getElementById('transparencyStatusText');
    if (transparencyStatusText) {
      transparencyStatusText.textContent = '';
    }
    
    // איפוס מלל דינמי - מדד מאמץ
    const effortScoreStatusText = document.getElementById('effortScoreStatusText');
    if (effortScoreStatusText) {
      effortScoreStatusText.textContent = '';
    }
    
    // איפוס מדד חוב משולב
    const priorityDebtLabel = document.getElementById('priorityDebtLabel');
    const debtCombinedBar = document.getElementById('debtCombinedBar');
    const priorityDebtBar = document.getElementById('priorityDebtBar');
    const ordinaryDebtBar = document.getElementById('ordinaryDebtBar');
    const totalDebtsText = document.getElementById('totalDebtsText');
    
    if (priorityDebtLabel) priorityDebtLabel.textContent = 'דין קדימה: ₪ 0';
    if (debtCombinedBar) debtCombinedBar.style.width = '0%';
    if (priorityDebtBar) priorityDebtBar.style.width = '0%';
    if (ordinaryDebtBar) ordinaryDebtBar.style.width = '0%';
    if (totalDebtsText) {
      totalDebtsText.textContent = '0';
      totalDebtsText.style.display = 'none';
    }
    
    // איפוס גרף דיבידנד
    const expectedReturnBar = document.getElementById('expectedReturnBar');
    const expectedReturnText = document.getElementById('expectedReturnText');
    const dividendPercentage = document.getElementById('dividendPercentage');
    const dividendTotalRecovery = document.getElementById('dividendTotalRecovery');
    
    if (expectedReturnBar) expectedReturnBar.style.width = '0%';
    if (expectedReturnText) {
      expectedReturnText.textContent = '0';
      expectedReturnText.style.display = 'none';
    }
    if (dividendPercentage) dividendPercentage.textContent = '0%';
    if (dividendTotalRecovery) dividendTotalRecovery.textContent = '';
    
    // איפוס התראת הוצאות
    const expensesField = document.getElementById('grandTotalExpenses');
    if (expensesField) {
      expensesField.style.borderColor = '';
      expensesField.style.backgroundColor = '';
      const warningEl = document.getElementById('expensesWarning');
      if (warningEl) {
        warningEl.remove();
        expensesField.removeAttribute('data-warning');
      }
    }
    
    // איפוס חישובים
    if (typeof calcTimeline === 'function') calcTimeline();
    if (typeof calcIncomeTotal === 'function') calcIncomeTotal();
    
    // עדכון מערכת
    setTimeout(() => {
      updateAllCalculations();
      refreshSystem();
    }, 100);
  }
}

// שמירה על תאימות - פונקציה ישנה
function resetForm() {
  resetFormAndMetrics();
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
  "נשוי": 6024,
  "רווק": 4556,
  "גרוש": 4556,
  "יחיד": 4556, // לשמירה על תאימות
  "זוג": 6024, // לשמירה על תאימות
};

const kidsMap = {
  0:0,1:169,2:383,3:597,4:811,
  5:980,6:1149,7:1318,8:1487,9:1656,10:1825
};

let calcGender = 'חייב';
let calcJoint = false;
let calcFamilyType = "נשוי";
let calcChildrenCount = 0;

function updateChildrenLabel(){
  if (calcEls.childrenLabel) {
    calcEls.childrenLabel.textContent = `(${calcChildrenCount})`;
  }
}

function updateLabelSets(){
  const isFemale = calcGender === 'חייבת';
  const d = isFemale ? 'חייבת' : 'חייב';
  const p = isFemale ? 'בן זוג' : 'בת זוג';
  
  // עדכון תוויות במחשבון
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
  
  // עדכון כפתורי סטטוס משפחתי ללשון נקבה אם נדרש
  const familyTypeButtons = document.querySelectorAll('.family-type');
  familyTypeButtons.forEach(btn => {
    const type = btn.dataset.type;
    if (isFemale) {
      if (type === 'נשוי') btn.textContent = 'נשואה';
      else if (type === 'רווק') btn.textContent = 'רווקה';
      else if (type === 'גרוש') btn.textContent = 'גרושה';
    } else {
      if (type === 'נשוי') btn.textContent = 'נשוי';
      else if (type === 'רווק') btn.textContent = 'רווק';
      else if (type === 'גרוש') btn.textContent = 'גרוש';
    }
  });
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
  // עדכון תוויות כולל כפתורי סטטוס משפחתי
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
    
    // עדכון החלק העליון כשמשנים במחשבון
    const type = btn.dataset.type;
    let maritalValue = type; // נשוי, רווק, גרוש
    
    if (maritalValue) {
      const radio = document.querySelector(`input[name="maritalStatus"][value="${maritalValue}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
    
    // עדכון תוויות לפי מין
    updateLabelSets();
    calcCalculator();
  });
});

// עדכון פרופיל חייב
function updateDebtorProfile(data) {
  // סטטוס אישי
  const maritalStatus = document.querySelector('input[name="maritalStatus"]:checked')?.value || '';
  const minorsCount = parseInt(document.getElementById('minorsCount')?.value || '0') || 0;
  const profileMaritalStatus = document.getElementById('profileMaritalStatus');
  if (profileMaritalStatus) {
    profileMaritalStatus.textContent = maritalStatus + (minorsCount > 0 ? ' + ' + minorsCount : '');
  }
  
  // תעסוקה
  const isNotWorking = document.getElementById('chkDebtorNotWorking')?.checked || false;
  const profileEmployment = document.getElementById('profileEmployment');
  if (profileEmployment) {
    profileEmployment.textContent = isNotWorking ? 'לא עובד' : 'שכיר';
  }
  
  // מדד שקיפות - לוגיקה מתוקנת
  updateTransparencyIndex();
}

// עדכון מדד מאמץ - לוגיקה חכמה מבוססת דו"ח גיא שחם
function updateEffortMetric() {
  // קבלת הכנסה פנויה - נסה מהמחשבון או מהטופס
  let disposable = 0;
  
  // נסה מהמחשבון
  const disposableIncomeEl = document.getElementById('disposableIncomeResult');
  if (disposableIncomeEl) {
    const disposableText = disposableIncomeEl.textContent || '';
    if (disposableText.includes('אין')) {
      disposable = 0;
    } else {
      disposable = parseVal(disposableText) || 0;
    }
  }
  
  // אם לא מצאנו, נסה מהטופס ישירות
  if (disposable <= 0) {
    const data = getFormData();
    disposable = data.disposableIncome || 0;
  }
  
  // קבלת הצעת נאמן או ממונה
  const recommendation = parseVal(document.getElementById('trusM')?.value || '') || 
                         parseVal(document.getElementById('commM')?.value || '') || 0;
  
  const statusText = document.getElementById('effortScoreStatusText');
  const scoreValue = document.getElementById('effortScoreValue');
  const scoreFill = document.getElementById('effortScoreFill');
  
  if (!statusText || !scoreValue || !scoreFill) return;
  
  // אם אין נתונים - לא לעשות כלום
  if (disposable <= 0 || recommendation <= 0) {
    statusText.textContent = '';
    scoreValue.textContent = '';
    scoreValue.style.display = 'none';
    scoreFill.style.width = '0%';
    return;
  }
  
  const effortPercent = (recommendation / disposable) * 100;
  
  // הסרת תצוגת אחוזים - רק "פעיל"
  if (scoreValue) {
    scoreValue.textContent = "פעיל";
    scoreValue.style.display = 'block';
  }
  
  if (scoreFill) {
    scoreFill.style.width = Math.min(effortPercent, 100) + "%";
  }
  
  // לוגיקת התראות חכמות
  if (effortPercent > 110) {
    statusText.innerHTML = "<span style='color:#dc2626; font-weight:800;'>⚠️ חשד להכנסות לא מדווחות: התשלום המוצע עולה על ההכנסה הפנויה המוצהרת</span>";
    statusText.style.color = '#dc2626';
    if (scoreFill) {
      scoreFill.style.backgroundColor = "#dc2626"; // אדום בוהק
    }
  } else if (effortPercent < 60) {
    statusText.textContent = "קיים פוטנציאל להגדלת התשלום לקופת הנשייה";
    statusText.style.color = '#eab308';
    if (scoreFill) {
      scoreFill.style.backgroundColor = "#eab308"; // צהוב
    }
  } else {
    statusText.textContent = "מאמץ תואם יכולת כלכלית";
    statusText.style.color = '#15803d';
    if (scoreFill) {
      scoreFill.style.backgroundColor = "#15803d"; // ירוק
    }
  }
}

// עדכון גרף צפי דיבידנד - עם לוגיקה חדשה (ניכוי דין קדימה בלבד, ללא הוצאות הליכון)
function updateDividendChart(data) {
  // קריאה לפונקציה הדינמית
  calculateDynamicDividend();
}

// חישוב דיבידנד דינמי - מבוסס דו"ח גיא שחם
function calculateDynamicDividend() {
  const hearingDateStr = document.getElementById('hearingDate')?.value;
  if (!hearingDateStr) {
    return 0;
  }
  
  const hearingDate = new Date(hearingDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  hearingDate.setHours(0, 0, 0, 0);
  
  const monthsToHearing = Math.max(0, (hearingDate.getFullYear() - today.getFullYear()) * 12 + (hearingDate.getMonth() - today.getMonth()));
  
  const currentMonthly = parseVal(document.getElementById('monthlyPayment')?.value || '') || 0;
  const balance = parseVal(document.getElementById('caseBalance')?.value || '') || 0;
  const planTotal = parseVal(document.getElementById('trusTot')?.value || '') || 0;
  
  // חישוב סך חובות - שימוש ב-ID ישירים
  let priority = 0;
  let generalDebts = 0;
  let totalDebts = 0;
  
  // נסה למצוא לפי ID ישיר
  const totalDebtsEl = document.getElementById('valTotalDebts');
  const priorityDebtEl = document.getElementById('priorityDebtInput');
  
  if (totalDebtsEl) {
    totalDebts = parseVal(totalDebtsEl.value || '') || 0;
  }
  
  if (priorityDebtEl) {
    priority = parseVal(priorityDebtEl.value || '') || 0;
  }
  
  // אם לא מצאנו לפי ID, נסה את השיטה הישנה
  if (totalDebts === 0 && priority === 0) {
    const conductSection = Array.from(document.querySelectorAll('.section-title')).find(el => 
      el.textContent.includes('התנהלות') || el.textContent.includes('ודוחות')
    )?.closest('.card');
    
    if (conductSection) {
      const debtSubtitle = Array.from(conductSection.querySelectorAll('.sub-title')).find(el => 
        el.textContent.trim() === 'חובות'
      );
      
      if (debtSubtitle) {
        const debtRow = debtSubtitle.nextElementSibling;
        if (debtRow) {
          const debtInputs = Array.from(debtRow.querySelectorAll('.currency-input[maxlength="8"]'));
          if (debtInputs.length >= 1) {
            totalDebts = parseVal(debtInputs[0]?.value || '') || 0;
          }
          if (debtInputs.length >= 2) {
            priority = parseVal(debtInputs[1]?.value || '') || 0;
          }
        }
      }
    }
  }
  
  generalDebts = Math.max(0, totalDebts - priority);
  
  // אם אין נתונים בסיסיים - לא לעשות כלום
  if (!hearingDateStr || (balance <= 0 && currentMonthly <= 0 && planTotal <= 0)) {
    const divText = document.getElementById('dividendText');
    const trusteePlanBar = document.getElementById('trusteePlanBar');
    const trusteePlanText = document.getElementById('trusteePlanText');
    const commPlanBar = document.getElementById('commPlanBar');
    const commPlanText = document.getElementById('commPlanText');
    
    if (divText) divText.textContent = '';
    if (trusteePlanBar) trusteePlanBar.style.width = '0%';
    if (trusteePlanText) {
      trusteePlanText.textContent = '';
      trusteePlanText.style.display = 'none';
    }
    if (commPlanBar) commPlanBar.style.width = '0%';
    if (commPlanText) {
      commPlanText.textContent = '';
      commPlanText.style.display = 'none';
    }
    return 0;
  }
  
  // חישוב תוכנית נאמן: יתרה + צפי עד דיון + תוכנית נאמן
  const trusteeMonthly = parseVal(document.getElementById('trusM')?.value || '') || 0;
  const trusteeDuration = parseVal(document.getElementById('trusD')?.value || '') || 0;
  const trusteePlanTotal = trusteeMonthly * trusteeDuration;
  const trusteeExpectedFund = balance + (monthsToHearing * currentMonthly) + trusteePlanTotal;
  const trusteeNetForGeneral = trusteeExpectedFund - priority;
  
  // חישוב תוכנית ממונה: יתרה + צפי עד דיון + תוכנית ממונה
  const commMonthly = parseVal(document.getElementById('commM')?.value || '') || 0;
  const commDuration = parseVal(document.getElementById('commD')?.value || '') || 0;
  const commPlanTotal = commMonthly * commDuration;
  const commExpectedFund = balance + (monthsToHearing * currentMonthly) + commPlanTotal;
  const commNetForGeneral = commExpectedFund - priority;
  
  const divText = document.getElementById('dividendText');
  const trusteePlanBar = document.getElementById('trusteePlanBar');
  const trusteePlanText = document.getElementById('trusteePlanText');
  const commPlanBar = document.getElementById('commPlanBar');
  const commPlanText = document.getElementById('commPlanText');
  
  // עדכון מדד חוב משולב
  const formatter = new Intl.NumberFormat('he-IL', { 
    style: 'currency', 
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  const priorityDebtLabel = document.getElementById('priorityDebtLabel');
  const debtCombinedBar = document.getElementById('debtCombinedBar');
  const priorityDebtBar = document.getElementById('priorityDebtBar');
  const ordinaryDebtBar = document.getElementById('ordinaryDebtBar');
  const totalDebtsText = document.getElementById('totalDebtsText');
  
  // דין קדימה לא מופיע עד שלא מוכנס סכום
  if (priorityDebtLabel && debtCombinedBar && priorityDebtBar && ordinaryDebtBar && totalDebtsText) {
    if (priority > 0) {
      priorityDebtLabel.textContent = `דין קדימה: ${formatter.format(priority)}`;
      priorityDebtLabel.style.display = 'block';
    } else {
      priorityDebtLabel.textContent = '';
      priorityDebtLabel.style.display = 'none';
    }
    
    if (totalDebts > 0) {
      const maxValue = Math.max(totalDebts, Math.max(trusteeNetForGeneral, commNetForGeneral), 1);
      const totalDebtsPercent = (totalDebts / maxValue) * 100;
      debtCombinedBar.style.width = totalDebtsPercent + '%';
      
      const priorityPercent = (priority / totalDebts) * 100;
      const ordinaryPercent = 100 - priorityPercent;
      
      priorityDebtBar.style.width = priorityPercent + '%';
      ordinaryDebtBar.style.width = ordinaryPercent + '%';
      
      totalDebtsText.textContent = formatter.format(totalDebts);
      totalDebtsText.style.display = totalDebtsPercent > 10 ? 'block' : 'none';
    } else {
      debtCombinedBar.style.width = '0%';
      priorityDebtBar.style.width = '0%';
      ordinaryDebtBar.style.width = '0%';
      totalDebtsText.textContent = '0';
      totalDebtsText.style.display = 'none';
    }
  }
  
  // חישוב דיבידנד לכל תוכנית בנפרד
  let trusteeDivPercent = 0;
  let commDivPercent = 0;
  
  if (generalDebts > 0) {
    if (trusteeNetForGeneral > 0) {
      trusteeDivPercent = (trusteeNetForGeneral / generalDebts) * 100;
      trusteeDivPercent = Math.min(100, Math.max(0, trusteeDivPercent));
    }
    if (commNetForGeneral > 0) {
      commDivPercent = (commNetForGeneral / generalDebts) * 100;
      commDivPercent = Math.min(100, Math.max(0, commDivPercent));
    }
  }
  
  // עדכון תוכנית נאמן - רק "פעיל" אם יש תוכנית
  if (trusteePlanBar && trusteePlanText) {
    if (trusteeMonthly > 0 && trusteeDuration > 0) {
      // יש תוכנית נאמן - הצג "פעיל"
      trusteePlanBar.style.width = '100%';
      trusteePlanText.textContent = 'פעיל';
      trusteePlanText.style.display = 'block';
      
      // בדיקת דיבידנד אפס
      if (trusteeNetForGeneral <= 0 && priority > 0) {
        if (divText && (!commMonthly || !commDuration)) {
          divText.textContent = "לא צפוי דיבידנד בשל חוב בדין קדימה";
          divText.style.color = "#dc2626";
        }
      } else if (trusteeDivPercent > 0) {
        if (divText && (!commMonthly || !commDuration)) {
          divText.textContent = `תוכנית נאמן: צפוי דיבידנד ${trusteeDivPercent.toFixed(1)}%`;
          divText.style.color = "#1e293b";
        }
      }
    } else {
      trusteePlanBar.style.width = '0%';
      trusteePlanText.textContent = '';
      trusteePlanText.style.display = 'none';
    }
  }
  
  // עדכון תוכנית ממונה - רק "פעיל" אם יש תוכנית
  if (commPlanBar && commPlanText) {
    if (commMonthly > 0 && commDuration > 0) {
      // יש תוכנית ממונה - הצג "פעיל"
      commPlanBar.style.width = '100%';
      commPlanText.textContent = 'פעיל';
      commPlanText.style.display = 'block';
      
      // בדיקת דיבידנד אפס
      if (commNetForGeneral <= 0 && priority > 0) {
        if (divText && (!trusteeMonthly || !trusteeDuration)) {
          divText.textContent = "לא צפוי דיבידנד בשל חוב בדין קדימה";
          divText.style.color = "#dc2626";
        }
      } else if (commDivPercent > 0) {
        if (divText && (!trusteeMonthly || !trusteeDuration)) {
          divText.textContent = `תוכנית ממונה: צפוי דיבידנד ${commDivPercent.toFixed(1)}%`;
          divText.style.color = "#1e293b";
        } else if (divText && trusteeMonthly > 0 && trusteeDuration > 0) {
          // אם יש שתי תוכניות - הצג השוואה
          const diff = trusteeDivPercent - commDivPercent;
          if (Math.abs(diff) > 0.1) {
            divText.textContent = `השוואה: נאמן ${trusteeDivPercent.toFixed(1)}% | ממונה ${commDivPercent.toFixed(1)}% (הפרש: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)`;
            divText.style.color = "#1e293b";
          } else {
            divText.textContent = `צפוי דיבידנד: ${trusteeDivPercent.toFixed(1)}%`;
            divText.style.color = "#1e293b";
          }
        }
      }
    } else {
      commPlanBar.style.width = '0%';
      commPlanText.textContent = '';
      commPlanText.style.display = 'none';
    }
  }
  
  // אם אין תוכניות כלל - נקה את הטקסט
  if (divText && (!trusteeMonthly || !trusteeDuration) && (!commMonthly || !commDuration)) {
    divText.textContent = '';
  }
  
  return Math.max(trusteeDivPercent, commDivPercent).toFixed(1);
}

// הוספת שורה לאבני דרך
document.addEventListener('DOMContentLoaded', () => {
  const addTimelineRowBtn = document.getElementById('addTimelineRow');
  if (addTimelineRowBtn) {
    addTimelineRowBtn.addEventListener('click', () => {
      const timelineContainer = document.getElementById('timelineContainer');
      if (timelineContainer) {
        const newRow = document.createElement('div');
        newRow.className = 'timeline-row';
        newRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 3px; align-items: center;';
        newRow.innerHTML = `
          <input type="date" class="timeline-date" style="width: 120px; height: 20px !important; font-size: 10px !important; padding: 0 4px !important;">
          <input type="text" class="timeline-desc" placeholder="תיאור האירוע" style="flex: 1; height: 20px !important; font-size: 10px !important; padding: 0 4px !important;">
        `;
        timelineContainer.appendChild(newRow);
      }
    });
  }
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

  // חישוב הכנסה פנויה: (שכר + קצבאות) - (מחייה בכבוד + מזונות משולמים + הוצאות חריגות)
  // סה"כ הכנסות = שכר חייב + שכר בן זוג + קצבאות + הכנסות אחרות
  // סה"כ הוצאות = מחייה בכבוד + מזונות + הוצאות חריגות + הוצאות טיפול
  const disp = totalIncome - totalExp;
  if (calcEls.disp) {
    if (disp <= 0) {
      calcEls.disp.textContent = 'אין הכנסה פנויה';
      calcEls.disp.style.color = 'var(--danger)';
      calcEls.disp.style.fontWeight = '700';
    } else {
      calcEls.disp.textContent = fmt(disp);
      calcEls.disp.style.color = 'var(--green)';
      calcEls.disp.style.fontWeight = '800';
    }
  }

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

  // לוגיקת תיק אפס: אינו עובד + רק קצבאות (ללא משכורת או פוטנציאל)
  const isNotWorking = document.getElementById('chkDebtorNotWorking')?.checked || false;
  const debtorPotentialVal = parseVal(document.getElementById('debtorPotential')?.value || '');
  const hasOnlyAllowances = (dS === 0 && dO === 0 && debtorPotentialVal === 0 && (dA + allowD + totalAllowVal) > 0);
  const zeroCase = isNotWorking && hasOnlyAllowances;
  
  if (calcEls.zeroRow) {
    calcEls.zeroRow.style.display = zeroCase ? 'block' : 'none';
    if (zeroCase) {
      const zeroText = calcEls.zeroRow.querySelector('.v.zero-case');
      if (zeroText) {
        zeroText.textContent = 'תיק אפס - קיום על קצבאות בלבד';
      }
    }
  }
  
  // הצגת באנר תיק אפס במחשבון
  const zeroCaseBanner = document.getElementById('zeroCaseBanner');
  if (zeroCaseBanner) {
    zeroCaseBanner.style.display = zeroCase ? 'block' : 'none';
  }
  
  // כפיית תשלום 0 בתיק אפס
  if (zeroCase) {
    payD = 0;
    payP = 0;
    if (calcEls.payDeb) calcEls.payDeb.textContent = '₪0';
    if (calcEls.payPar) calcEls.payPar.textContent = '₪0';
    if(calcJoint && calcEls.payFam) {
      calcEls.payFam.textContent = '₪0';
    }
  }
  
  // בדיקת הגיון - הוצאות
  validateExpenses(totalExp, base);
  
  // בדיקת הגיון - פער נטו/פוטנציאל
  validateIncomeGap(debtorNetVal, document.getElementById('debtorPotential')?.value);
  
  // עדכון נוסח הצעה משפטי (כולל zeroCase ונתונים נוספים)
  updateLegalProposal(disp, calcChildrenCount, payD, zeroCase, totalIncome, base, un, ch, al);
  
  // עדכון Smart Analytics (כולל zeroCase)
  updateSmartAnalytics(disp, payD, totalIncome, dS, pS, dO, pO, base, un, ch, al, zeroCase);
}

// פונקציה לעדכון יחס החזר
function updateRepaymentRatio(disposableIncome, baseLiving, proposedPayment) {
  const repaymentCard = document.getElementById('repaymentRatioCard');
  const progressFill = document.getElementById('repaymentProgressFill');
  const ratioLabel = document.getElementById('repaymentRatioLabel');
  
  if (!repaymentCard || !progressFill || !ratioLabel) return;
  
  if (disposableIncome <= 0 || baseLiving <= 0) {
    repaymentCard.style.display = 'none';
    return;
  }
  
  const ratio = (proposedPayment / baseLiving) * 100;
  const normalizedRatio = Math.min(ratio, 100);
  
  repaymentCard.style.display = 'block';
  progressFill.style.width = normalizedRatio + '%';
  ratioLabel.textContent = ratio.toFixed(1) + '%';
  
  // צבע דינמי
  progressFill.className = 'progress-bar-fill';
  if (ratio <= 30) {
    progressFill.classList.add('low');
  } else if (ratio <= 50) {
    progressFill.classList.add('medium');
  } else {
    progressFill.classList.add('high');
  }
}

// בדיקת הגיון - הוצאות
function validateExpenses(totalExpenses, baseLiving) {
  const expenseField = document.getElementById('grandTotalExpenses');
  if (!expenseField) return;
  
  const expenses = parseVal(expenseField.value) || totalExpenses;
  const threshold = 0.15; // 15%
  const lowerBound = baseLiving * (1 - threshold);
  const upperBound = baseLiving * (1 + threshold);
  
  expenseField.classList.remove('warning');
  
  if (expenses < lowerBound || expenses > upperBound) {
    expenseField.classList.add('warning');
  }
}

// בדיקת הגיון - פער נטו/פוטנציאל
function validateIncomeGap(netIncome, potentialIncome) {
  const icon = document.getElementById('debtorPotentialIcon');
  if (!icon) return;
  
  const net = parseVal(netIncome) || 0;
  const pot = parseVal(potentialIncome) || 0;
  
  if (pot > 0 && net > 0) {
    const gap = Math.abs((pot - net) / net);
    if (gap > 0.2) { // פער של יותר מ-20%
      icon.style.display = 'inline-block';
    } else {
      icon.style.display = 'none';
    }
  } else {
    icon.style.display = 'none';
  }
}

// לוגיקת הנוסח המשפטי המדויק - מעודכן
function generateLegalSummary(data) {
  const summaryElement = document.getElementById('legalProposalText');
  if (!summaryElement) return;
  
  let text = "";
  const income = data.disposableIncome;
  const payment = data.onlyAllowances ? 0 : data.proposedPayment;
  
  // תנאי 1: תיק אפס (קצבאות בלבד)
  if (data.isNotWorking && data.onlyAllowances) {
    text = `החייב אינו עובד ומתקיים מקצבאות בלבד. בהתאם להלכת 'תיק אפס' ובהיעדר הכנסה פנויה או נכסים, מוצעת תוכנית פירעון בערך אפס.`;
  } 
  // תנאי 2: אין הכנסה פנויה (אבל אולי עובד)
  else if (income <= 0) {
    text = `לאור היעדר הכנסה פנויה למשק הבית (הוצאות המחייה עולות על ההכנסות), מוצעת תוכנית פירעון בסך 0 ש"ח לחודש. מומלץ לבחון את פוטנציאל ההשתכרות מחדש.`;
  }
  // תנאי 3: יש הכנסה פנויה ותשלום
  else {
    const effort = ((payment / income) * 100).toFixed(0);
    text = `לאור הכנסה פנויה של ${income.toLocaleString('he-IL')} ש"ח, מוצעת תוכנית פירעון בסך ${payment.toLocaleString('he-IL')} ש"ח. סכום זה משקף 'מדד מאמץ' של ${effort}% מההכנסה הפנויה, בהתאם לנסיבות התא המשפחתי המונה ${data.totalSouls} נפשות.`;
  }
  
  // הוספת פיגורים אם יש
  const arrearsLabel = Array.from(document.querySelectorAll('.label-stack')).find(el => 
    el.textContent.includes('פיגורים') || el.textContent.includes('פיגור')
  );
  let arrearsVal = 0;
  if (arrearsLabel && arrearsLabel.nextElementSibling) {
    arrearsVal = parseVal(arrearsLabel.nextElementSibling.value || '');
  }
  
  if (arrearsVal > 0) {
    const daysToClear = arrearsVal > 10000 ? 60 : 30;
    text += ` לחובת החייב נצברו ${arrearsVal.toLocaleString('he-IL')} ש"ח פיגורים. תנאי למתן הצו יהיה סילוק הפיגורים בתוך ${daysToClear} ימים.`;
  }
  
  // הוספת מידע על דיבידנד
  const dividendText = document.getElementById('dividendText');
  if (dividendText && dividendText.textContent.includes('לא צפוי דיבידנד')) {
    text += ` ${dividendText.textContent}.`;
  } else if (dividendText && dividendText.textContent.includes('צפוי דיבידנד')) {
    text += ` ${dividendText.textContent}.`;
  }
  
  summaryElement.value = text;
  
  // כיווץ שדה המלצות אם יש הרבה נתונים
  if (text.length > 200) {
    summaryElement.style.minHeight = '40px';
    summaryElement.style.maxHeight = '80px';
  } else {
    summaryElement.style.minHeight = '60px';
    summaryElement.style.maxHeight = 'none';
  }
}

// פונקציה ישנה לשם תאימות
function updateLegalProposal(disposableIncome, childrenCount, proposedPayment, isZeroCase, totalIncome, baseLiving, unusualExp, childcareExp, alimonyExp) {
  const data = getFormData();
  generateLegalSummary(data);
}

// פונקציה עזר לעדכון מד (Gauge)
function updateGauge(gaugeId, percent) {
  // בדיקת קצה: NaN ו-Infinity
  if (!isFinite(percent) || isNaN(percent)) {
    percent = 0;
  }
  
  percent = Math.min(100, Math.max(0, percent));
  
  // מיפוי IDs לפי סוג המד
  let gaugeFill, gaugeText, gaugeValue;
  
  if (gaugeId === 'effortScore') {
    gaugeFill = document.getElementById('effortScoreFill');
    gaugeText = document.getElementById('effortScoreText');
    gaugeValue = document.getElementById('effortScoreValue');
  } else if (gaugeId === 'arrears') {
    gaugeFill = document.getElementById('arrearsGauge');
    gaugeText = document.getElementById('arrearsText');
    gaugeValue = document.getElementById('arrearsValue');
  } else if (gaugeId === 'transparency') {
    gaugeFill = document.getElementById('transparencyGauge');
    gaugeText = document.getElementById('transparencyText');
    gaugeValue = document.getElementById('transparencyValue');
  } else {
    // fallback למבנה סטנדרטי
    gaugeFill = document.getElementById(gaugeId + 'Fill') || document.getElementById(gaugeId);
    gaugeText = document.getElementById(gaugeId + 'Text');
    gaugeValue = document.getElementById(gaugeId + 'Value');
  }
  
  if (gaugeFill) {
    gaugeFill.style.width = percent + '%';
    gaugeFill.className = 'compact-gauge-fill';
    
    // צבעים לפי אחוז
    gaugeFill.classList.remove('low', 'medium', 'high');
    if (percent < 40) {
      gaugeFill.classList.add('low');
    } else if (percent <= 60) {
      gaugeFill.classList.add('medium');
    } else {
      gaugeFill.classList.add('high');
    }
  }
  
  const percentText = percent.toFixed(1) + '%';
  // רק gaugeText בתוך הסרגל יציג את האחוז
  if (gaugeText) gaugeText.textContent = percentText;
  // הסרת gaugeValue - לא צריך יותר
  if (gaugeValue) {
    gaugeValue.textContent = '';
    gaugeValue.style.display = 'none'; // הסתרה מלאה
  }
}

// פונקציה מרכזית לחישוב כל המדדים
function calculateAllMetrics() {
  // 1. איסוף נתונים בסיסי
  const data = getFormData(); // קבלת כל הנתונים מהטופס
  
  // קבלת הכנסה פנויה מהמחשבון
  const disposableIncomeEl = document.getElementById('disposableIncomeResult');
  let disposableIncome = 0;
  if (disposableIncomeEl) {
    const disposableText = disposableIncomeEl.textContent || '';
    if (disposableText.includes('אין')) {
      disposableIncome = 0;
    } else {
      disposableIncome = parseVal(disposableText) || data.disposableIncome || 0;
    }
  } else {
    disposableIncome = data.disposableIncome || 0;
  }
  
  const proposedPayment = parseVal(document.getElementById('proposedPayment')?.value || '') || 
                          parseVal(document.getElementById('commNewFixed')?.value || '') || 
                          parseVal(document.getElementById('commGradedAmt')?.value || '') || 0;
  
  // חובות
  const debtInputs = document.querySelectorAll('.row .currency-input[maxlength="8"]');
  const totalDebts = debtInputs.length > 0 ? parseVal(debtInputs[0]?.value || '') || 0 : 0;
  const priorityDebt = debtInputs.length > 1 ? parseVal(debtInputs[1]?.value || '') || 0 : 0;
  
  // יתרה ותשלומים
  const currentBalance = parseVal(document.getElementById('caseBalance')?.value || '') || 0;
  const monthlyOrder = parseVal(document.getElementById('monthlyPayment')?.value || '') || 0;
  
  // חישוב מס' חודשים
  const orderDate = document.getElementById('orderDate')?.value;
  const hearingDate = document.getElementById('hearingDate')?.value;
  let monthsPassed = 0;
  
  if (orderDate && hearingDate) {
    const orderDateObj = new Date(orderDate);
    const hearingDateObj = new Date(hearingDate);
    if (hearingDateObj > orderDateObj) {
      const startMonth = new Date(orderDateObj.getFullYear(), orderDateObj.getMonth(), 1);
      const endMonth = new Date(hearingDateObj.getFullYear(), hearingDateObj.getMonth(), 1);
      while (startMonth < endMonth) {
        monthsPassed++;
        startMonth.setMonth(startMonth.getMonth() + 1);
      }
    }
  }
  
  if (monthsPassed === 0) {
    monthsPassed = parseVal(document.getElementById('monthsSinceOrder')?.textContent || '0') || 0;
  }
  
  // 2. עדכון מדד מאמץ - לוגיקה חכמה מבוססת דו"ח גיא שחם
  updateEffortMetric();
  
  // ניתוח הוצאות - אם סך הוצאות גבוה מ-90% מסך הכנסות
  // totalIncome ו-totalExpenses כבר מוגדרים למעלה
  const expensesField = document.getElementById('grandTotalExpenses');
  const expensesRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
  
  if (expensesField && expensesRatio > 90) {
    expensesField.style.borderColor = '#ef4444';
    expensesField.style.backgroundColor = '#fef2f2';
    
    // הוספת מלל התראה
    let warningText = expensesField.getAttribute('data-warning') || '';
    if (!warningText) {
      const warningEl = document.createElement('div');
      warningEl.id = 'expensesWarning';
      warningEl.style.cssText = 'font-size: 9px; color: #ef4444; margin-top: 2px; font-weight: 700;';
      warningEl.textContent = 'רמת הוצאות חריגה - נדרש בירור';
      expensesField.parentElement.appendChild(warningEl);
      expensesField.setAttribute('data-warning', 'true');
    } else {
      const warningEl = document.getElementById('expensesWarning');
      if (warningEl) {
        warningEl.textContent = 'רמת הוצאות חריגה - נדרש בירור';
      }
    }
  } else if (expensesField) {
    expensesField.style.borderColor = '';
    expensesField.style.backgroundColor = '';
    const warningEl = document.getElementById('expensesWarning');
    if (warningEl) {
      warningEl.remove();
      expensesField.removeAttribute('data-warning');
    }
  }
  
  // 3. חישוב עמידה בתוכנית (Compliance Index) - לא משתמשים כאן, משתמשים ב-calculateMonthsAndCompliance
  // המדד מתעדכן ב-calculateMonthsAndCompliance() שנקראת מ-updateAllCalculations()
  
  // 4. חישוב דיבידנד - מעודכן ב-updateDividendChart() עם הלוגיקה החדשה
  // החישוב עבר ל-updateDividendChart() כדי להשתמש בלוגיקה החדשה:
  // - חודשים מהיום עד hearingDate
  // - צבירה עד הדיון = חודשים * monthlyPayment
  // - קופה כוללת = יתרה + צבירה עד הדיון + תוכנית פירעון
  // - ניכוי דין קדימה בלבד (ללא הוצאות הליכון)
  // - בדיקת אפס והצגת הודעה
  
  // 5. מדד שקיפות (Transparency Index) - מעודכן ב-updateTransparencyIndex()
  updateTransparencyIndex();
}

// ציור גרף ההתפלגות (CSS-Based) - מעודכן
function updateSmartGraphs(data) {
  const smartAnalytics = document.querySelector('.smart-analytics');
  const zeroCaseMessage = document.getElementById('zeroCaseMessage');
  const analyticsContent = document.getElementById('analyticsContent');
  
  // אם תיק אפס - הצג הודעה והסתר גרפים
  if (data.onlyAllowances) {
    if (zeroCaseMessage) zeroCaseMessage.style.display = 'block';
    if (analyticsContent) analyticsContent.style.display = 'none';
    return;
  }
  
  // אם לא תיק אפס - הצג גרפים והסתר הודעה
  if (zeroCaseMessage) zeroCaseMessage.style.display = 'none';
  if (analyticsContent) analyticsContent.style.display = 'grid';
  
  // קריאה לפונקציה המרכזית לחישוב כל המדדים
  calculateAllMetrics();
  
  // עדכון מדד שקיפות
  updateTransparencyIndex();
}

// פונקציה ישנה לשם תאימות
function updateSmartAnalytics(disposableIncome, proposedPayment, totalIncome, debtorSalary, spouseSalary, debtorOther, spouseOther, baseLiving, unusualExp, childcareExp, alimonyExp, isZeroCase) {
  const data = getFormData();
  updateSmartGraphs(data);
}

function initCalculator() {
  setGender('חייב');
  if (calcEls.debtorPayCard) calcEls.debtorPayCard.classList.add('solo-pay');
  updateChildrenLabel();
  
  // הגדרת כפתור נשוי כברירת מחדל
  const marriedBtn = document.getElementById('statusMarriedBtn');
  if (marriedBtn) {
    marriedBtn.classList.add('active');
    calcFamilyType = 'נשוי';
  }
  
  updateLabelSets();
  calcCalculator();
  
  // קישור בין כפתורי סטטוס משפחתי בחלק העליון לכפתורים במחשבון
  const maritalStatusRadios = document.querySelectorAll('input[name="maritalStatus"]');
  maritalStatusRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        const value = this.value;
        let targetType = '';
        
        // מיפוי בין הערכים בחלק העליון לכפתורים במחשבון
        targetType = value; // נשוי, רווק, גרוש
        
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
    if(el) el.addEventListener('input', updateAllCalculations);
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
      calcFamilyType = "נשוי";
      document.querySelectorAll('.family-type').forEach(b => {
        b.classList.toggle('active', b.dataset.type === "נשוי");
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
// שמירת נתוני הטופס לפני איפוס
function saveFormDataBeforeReset() {
  const formData = {};
  
  // שמירת כל שדות הקלט
  document.querySelectorAll('input, select, textarea').forEach(element => {
    if (element.id) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        formData[element.id] = element.checked;
      } else {
        formData[element.id] = element.value;
      }
    }
    // גם שדות עם name בלבד
    if (element.name && !element.id) {
      if (element.type === 'radio') {
        if (element.checked) {
          formData[element.name] = element.value;
        }
      } else if (element.type === 'checkbox') {
        formData[element.name] = element.checked;
      } else {
        formData[element.name] = element.value;
      }
    }
  });
  
  // שמירה ב-localStorage
  localStorage.setItem('formDataBeforeReset', JSON.stringify(formData));
}

// שחזור נתוני הטופס לאחר איפוס
function restoreFormDataAfterReset() {
  const savedData = localStorage.getItem('formDataBeforeReset');
  if (!savedData) {
    alert('אין נתונים שמורים לשחזור');
    return;
  }
  
  try {
    const formData = JSON.parse(savedData);
    let restoredCount = 0;
    
    // שחזור כל השדות
    Object.keys(formData).forEach(key => {
      const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = formData[key];
          restoredCount++;
        } else if (element.type === 'radio') {
          if (element.value === formData[key]) {
            element.checked = true;
            restoredCount++;
          }
        } else {
          element.value = formData[key];
          restoredCount++;
        }
      }
    });
    
    // עדכון חישובים
    setTimeout(() => {
      updateAllCalculations();
      refreshSystem();
    }, 100);
    
    alert(`שוחזרו ${restoredCount} שדות בהצלחה!`);
  } catch (error) {
    alert('שגיאה בשחזור הנתונים: ' + error.message);
  }
}

function restoreVersion() {
  // שחזור נתוני הטופס לאחר איפוס
  if (confirm('האם אתה רוצה לשחזר את הנתונים שנמחקו באיפוס האחרון?')) {
    restoreFormDataAfterReset();
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
  
  // קביעת גובה מקסימלי ל-A4
  const pageElement = document.querySelector('.page');
  const originalHeight = pageElement.style.height;
  const originalMaxHeight = pageElement.style.maxHeight;
  
  // הגבלת גובה ל-A4 (297mm - 10mm שוליים = 287mm)
  pageElement.style.height = '287mm';
  pageElement.style.maxHeight = '287mm';
  pageElement.style.overflow = 'hidden';
  
  html2canvas(pageElement, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: pageElement.scrollWidth,
    height: pageElement.scrollHeight,
    windowWidth: pageElement.scrollWidth,
    windowHeight: pageElement.scrollHeight
  }).then(canvas => {
    // שחזור גובה מקורי
    pageElement.style.height = originalHeight;
    pageElement.style.maxHeight = originalMaxHeight;
    pageElement.style.overflow = '';
    
    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    
    // חישוב יחס גובה/רוחב
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // המרה מפיקסלים למילימטרים (בהנחה ש-96 DPI)
    const mmPerPx = 0.264583;
    const imgWidthMM = imgWidth * mmPerPx;
    const imgHeightMM = imgHeight * mmPerPx;
    
    // חישוב יחס התאמה ל-A4 (עם שוליים של 5mm מכל צד)
    const availableWidth = pdfWidth - 10; // 5mm מכל צד
    const availableHeight = pdfHeight - 10; // 5mm מכל צד
    
    const widthRatio = availableWidth / imgWidthMM;
    const heightRatio = availableHeight / imgHeightMM;
    const ratio = Math.min(widthRatio, heightRatio, 1); // לא להגדיל מעבר לגודל המקורי
    
    const finalWidth = imgWidthMM * ratio;
    const finalHeight = imgHeightMM * ratio;
    
    // מרכוז התמונה
    const imgX = (pdfWidth - finalWidth) / 2;
    const imgY = (pdfHeight - finalHeight) / 2;
    
    // אם הגובה גדול מדי, נחלק לעמודים
    if (finalHeight > pdfHeight - 10) {
      // חלוקה לעמודים
      const pagesNeeded = Math.ceil(finalHeight / (pdfHeight - 10));
      const pageHeightPx = (pdfHeight - 10) / ratio / mmPerPx;
      
      for (let i = 0; i < pagesNeeded; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const sourceY = i * pageHeightPx;
        const sourceHeight = Math.min(pageHeightPx, imgHeight - sourceY);
        
        // יצירת canvas חלקי
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = sourceHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        
        const pageImgData = tempCanvas.toDataURL('image/png', 0.95);
        const pageHeightMM = sourceHeight * mmPerPx * ratio;
        
        pdf.addImage(pageImgData, 'PNG', imgX, 5, finalWidth, pageHeightMM);
      }
    } else {
      // התאמה לעמוד אחד
      pdf.addImage(imgData, 'PNG', imgX, Math.max(5, imgY), finalWidth, finalHeight);
    }
    
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
    const pageElement = document.querySelector('.page');
    if (pageElement) {
      pageElement.style.height = '';
      pageElement.style.maxHeight = '';
      pageElement.style.overflow = '';
    }
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


