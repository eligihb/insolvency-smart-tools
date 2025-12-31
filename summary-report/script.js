const parseVal = (val) => {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
};

const fmt = (n) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

function refreshSystem() {
  // 1. חישוב הכנסה פנויה
  const debtorNet = parseVal(document.getElementById('debtorNet').value);
  const expenses = parseVal(document.getElementById('grandTotalExpenses').value);
  const disposable = debtorNet - expenses;
  
  document.getElementById('disposableIncomeResult').innerText = fmt(disposable);
  
  // 2. חישוב זמן עד הדיון (Interim)
  const hearingDateVal = document.getElementById('hearingDate').value;
  const monthlyPay = parseVal(document.getElementById('monthlyPayment').value);
  const caseBalance = parseVal(document.getElementById('caseBalance').value);
  const trusD = parseVal(document.getElementById('trusD').value);
  const trusM = parseVal(document.getElementById('trusM').value);
  const trusTot = trusD * trusM;
  document.getElementById('trusTot').value = fmt(trusTot);

  let monthsToHearing = 0;
  if (hearingDateVal) {
      const hDate = new Date(hearingDateVal);
      const today = new Date();
      monthsToHearing = Math.max(0, (hDate.getFullYear() - today.getFullYear()) * 12 + (hDate.getMonth() - today.getMonth()));
  }

  // 3. חישוב דיבידנד (יתרה + צבירה עד דיון + תוכנית)
  const expectedInterim = monthsToHearing * monthlyPay;
  const totalAssets = caseBalance + expectedInterim + trusTot;
  const priority = parseVal(document.getElementById('valPriority').value);
  const totalDebts = parseVal(document.getElementById('valTotalDebts').value);
  
  const netForGeneral = totalAssets - priority;
  const divDisplay = document.getElementById('dividendText');

  if (totalDebts > 0) {
      if (netForGeneral <= 0 && priority > 0) {
          divDisplay.innerText = "לא צפוי דיבידנד בשל חוב בדין קדימה";
          divDisplay.style.color = "red";
      } else {
          const divPercent = (netForGeneral / (totalDebts - priority)) * 100;
          divDisplay.innerText = `צפי דיבידנד: ${Math.max(0, divPercent).toFixed(1)}%`;
          divDisplay.style.color = "black";
      }
  }

  // 4. מדד מאמץ
  const effortScoreFill = document.getElementById('effortScoreFill');
  const effortStatus = document.getElementById('effortScoreStatusText');
  
  if (disposable > 0 && trusM > 0) {
      const effortPercent = (trusM / disposable) * 100;
      effortScoreFill.style.width = Math.min(effortPercent, 100) + "%";
      
      if (effortPercent > 110) {
          effortStatus.innerHTML = "<b style='color:red;'>⚠️ חשד להכנסות לא מדווחות</b>";
          effortScoreFill.style.background = "red";
      } else {
          effortStatus.innerText = "מאמץ תואם יכולת";
          effortScoreFill.style.background = "#0ea5e9";
      }
  }
}

// הפעלה בכל שינוי
document.addEventListener('input', refreshSystem);
