const { chromium } = require('playwright');
const fs = require('fs');

async function runScraper() {
    console.log('🚀 Starting Scraper...');
    const browser = await chromium.launch({ headless: true }); 
    const page = await browser.newPage();

    const config = {
        court: 'מחוזי מרכז',
        judge: 'חגי ברנר',
        date: '07/01/2026'
    };

    try {
        await page.goto('https://www.court.gov.il/NGCS.Web.Site/Public/JudgesDailyDiary.aspx');
        await page.selectOption('#ctl00_MainContent_ddlCourts', { label: config.court });
        await page.waitForTimeout(2000);
        await page.fill('#ctl00_MainContent_txtJudgeName', config.judge);

        const dateInput = '#ctl00_MainContent_dtDate_txtDate';
        await page.click(dateInput);
        await page.keyboard.type(config.date, { delay: 100 });

        await page.click('#ctl00_MainContent_btnSearch');
        await page.waitForSelector('#ctl00_MainContent_grdHearings', { timeout: 15000 });

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
        console.log(`✅ Success! Found ${results.length} hearings.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}
runScraper();
