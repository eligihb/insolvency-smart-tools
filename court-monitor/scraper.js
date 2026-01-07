const { chromium } = require('playwright');
const fs = require('fs');

async function runScraper() {
    console.log('🚀 מתחיל סריקת "הסוואה" - ניסוי שופט חלופי...');
    const browser = await chromium.launch({ headless: true });
    
    // הגדרות דפדפן אנושיות במיוחד
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem'
    });
    
    const page = await context.newPage();

    // נתוני ניסוי חדשים - שופט אחר, מחוז אחר
    const config = {
        court: 'שלום תל אביב',
        judge: 'עמית יריב',
        date: '07/01/2026' // נשארים עם אותו תאריך לבדיקה
    };

    try {
        console.log(`🌐 פונה לנט המשפט: ${config.court} -> ${config.judge}`);
        
        // הגדלת זמן ההמתנה לטעינה ראשונית ל-90 שניות
        await page.goto('https://www.court.gov.il/NGCS.Web.Site/Public/JudgesDailyDiary.aspx', { 
            waitUntil: 'networkidle', 
            timeout: 90000 
        });

        console.log('📍 ממתין לרשימת המחוזות (בסבלנות)...');
        // מחכה שהאלמנט יהיה קיים וגם גלוי
        const courtSelector = '#ctl00_MainContent_ddlCourts';
        await page.waitForSelector(courtSelector, { state: 'visible', timeout: 60000 });
        
        await page.selectOption(courtSelector, { label: config.court });
        console.log('✅ מחוז נבחר');
        
        // השהיה אקראית "אנושית"
        await page.waitForTimeout(Math.random() * 2000 + 1000);

        await page.fill('#ctl00_MainContent_txtJudgeName', config.judge);
        console.log('✅ שם שופט הוזן');

        const dateInput = '#ctl00_MainContent_dtDate_txtDate';
        await page.click(dateInput);
        await page.keyboard.type(config.date, { delay: 120 });
        
        console.log('🔍 שולח שאילתה...');
        await page.click('#ctl00_MainContent_btnSearch');
        
        // מחכה לטבלה או להודעה שאין נתונים
        const resultFound = await Promise.race([
            page.waitForSelector('#ctl00_MainContent_grdHearings', { timeout: 30000 }).then(() => 'data'),
            page.waitForSelector('.LabelError', { timeout: 30000 }).then(() => 'no_data')
        ]);

        let results = [];
        if (resultFound === 'data') {
            results = await page.$$eval('#ctl00_MainContent_grdHearings tr.GridRow, #ctl00_MainContent_grdHearings tr.GridAlternatingRow', rows => {
                return rows.map(r => ({
                    time: r.cells[0]?.innerText.trim(),
                    caseNum: r.cells[1]?.innerText.trim(),
                    parties: r.cells[2]?.innerText.trim(),
                    type: r.cells[3]?.innerText.trim()
                }));
            });
            console.log(`💎 בינגו! נמצאו ${results.length} דיונים.`);
        } else {
            console.log('ℹ️ האתר טוען שאין דיונים לשופט זה בתאריך הנבחר.');
        }

        const output = {
            lastUpdated: new Date().toLocaleString('he-IL'),
            judge: config.judge,
            court: config.court,
            date: config.date,
            count: results.length,
            hearings: results
        };

        fs.writeFileSync('data.json', JSON.stringify(output, null, 2));

    } catch (err) {
        console.error('❌ תקלה בשלב:', err.message);
        // שומרים לוג של מה שהספקנו לראות ב-HTML
        const html = await page.content();
        fs.writeFileSync('error_log.html', html);
        process.exit(1);
    } finally {
        await browser.close();
    }
}
runScraper();
