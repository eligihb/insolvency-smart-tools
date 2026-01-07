const { chromium } = require('playwright');
const fs = require('fs');

async function runScraper() {
    console.log('🚀 Starting Stealth Scraper...');
    // הגדרות הסוואה כדי להיראות כמו גולש אמיתי
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'he-IL'
    });
    
    const page = await context.newPage();

    const config = {
        court: 'מחוזי מרכז',
        judge: 'חגי ברנר',
        date: '07/01/2026'
    };

    try {
        console.log(`🌐 מנסה להתחבר לנט המשפט עבור ${config.judge}...`);
        
        // הגדרת Timeout ארוך יותר ומעקף חסימות בסיסי
        await page.goto('https://www.court.gov.il/NGCS.Web.Site/Public/JudgesDailyDiary.aspx', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        console.log('📍 בוחר מחוז...');
        await page.selectOption('#ctl00_MainContent_ddlCourts', { label: config.court });
        await page.waitForTimeout(3000); // המתנה קצת יותר ארוכה כדי להיראות אנושי

        console.log('👤 מזין שופט...');
        await page.fill('#ctl00_MainContent_txtJudgeName', config.judge);

        console.log('📅 מזין תאריך...');
        const dateInput = '#ctl00_MainContent_dtDate_txtDate';
        await page.click(dateInput);
        await page.keyboard.type(config.date, { delay: 150 }); // הקלדה אטית

        console.log('🔍 לוחץ חיפוש...');
        await page.click('#ctl00_MainContent_btnSearch');
        
        // המתנה לתוצאות
        await page.waitForSelector('#ctl00_MainContent_grdHearings', { timeout: 20000 });

        const results = await page.$$eval('#ctl00_MainContent_grdHearings tr.GridRow, #ctl00_MainContent_grdHearings tr.GridAlternatingRow', rows => {
            return rows.map(r => ({
                time: r.cells[0]?.innerText.trim(),
                caseNum: r.cells[1]?.innerText.trim(),
                parties: r.cells[2]?.innerText.trim(),
                type: r.cells[3]?.innerText.trim()
            }));
        });

        const output = {
            lastUpdated: new Date().toLocaleString('he-IL'),
            judge: config.judge,
            date: config.date,
            count: results.length,
            hearings: results
        };

        fs.writeFileSync('data.json', JSON.stringify(output, null, 2));
        console.log(`✅ הצלחה! נמצאו ${results.length} דיונים.`);

    } catch (err) {
        console.error('❌ השליפה נכשלה:', err.message);
        // יצירת קובץ ריק כדי שה-Dashboard לא יישבר
        if (!fs.existsSync('data.json')) {
            fs.writeFileSync('data.json', JSON.stringify({ error: err.message, hearings: [] }));
        }
        process.exit(1);
    } finally {
        await browser.close();
    }
}
runScraper();
