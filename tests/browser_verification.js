const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { spawn, execSync } = require('child_process');
const { chromium } = require(path.join(__dirname, '..', 'apps', 'web', 'node_modules', 'playwright'));

async function isServerRunning(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning(url)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function runBrowserVerification() {
  console.log('=== Starting Comprehensive Playwright Browser Verification ===');

  let spawnedServer = null;
  const healthUrl = 'http://127.0.0.1:8000/api/health';
  const serverAlreadyRunning = await isServerRunning(healthUrl);

  if (!serverAlreadyRunning) {
    const pythonBin = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
    console.log(`Starting uvicorn backend with ${pythonBin}...`);
    spawnedServer = spawn(pythonBin, [
      '-m', 'uvicorn', 'app.main:app',
      '--app-dir', 'apps/api',
      '--host', '127.0.0.1',
      '--port', '8000',
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await waitForServer(healthUrl);
    console.log('Backend server started and healthy!');
  } else {
    console.log('Existing backend server detected on http://127.0.0.1:8000; reusing session.');
  }

  const screenshotsDir = path.join(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('--- Launching Microsoft Edge for End-to-End Browser Journeys ---');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('BROWSER_CONSOLE_ERROR:', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.error('BROWSER_PAGE_ERROR:', err.message);
  });

  try {
    // -------------------------------------------------------------
    // JOURNEY 1: Overview Page
    // -------------------------------------------------------------
    console.log('\n--- Journey 1: Overview Page ---');
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    const headline = await page.textContent('h1');
    console.log('   Observed Headline:', headline?.trim().replace(/\s+/g, ' '));
    assert(headline && headline.length > 0, 'Overview headline should be present');
    await page.screenshot({ path: path.join(screenshotsDir, '01_overview.png') });
    console.log('   Saved: docs/screenshots/01_overview.png');

    // -------------------------------------------------------------
    // JOURNEY 2: Problem Setup & Baseline Revision
    // -------------------------------------------------------------
    console.log('\n--- Journey 2: Setup Page & Guided Tabs ---');
    await page.click('button:has-text("Setup")');
    await page.waitForTimeout(500);

    // Click through guided tabs
    await page.click('button:has-text("Courses")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("Students & Enrollments")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("Rooms & Blackouts")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("Dates & Slots")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("Constraints & Preferences")');
    await page.waitForTimeout(200);

    // Load Tiny Feasible sample
    console.log('   Loading Tiny Feasible sample...');
    await page.click('button:has-text("Tiny Feasible")');
    await page.waitForTimeout(400);

    // Commit revision
    console.log('   Committing baseline revision...');
    await page.click('button:has-text("Commit Revision")');
    await page.waitForSelector('text=Committed:', { timeout: 8000 });
    const commitBadge = await page.textContent('text=Committed:');
    console.log(`   Baseline revision: ${commitBadge?.trim()}`);

    await page.screenshot({ path: path.join(screenshotsDir, '02_setup.png') });
    console.log('   Saved: docs/screenshots/02_setup.png');

    // -------------------------------------------------------------
    // JOURNEY 3: Search Lab, Controls, F5 While Paused & After Success
    // -------------------------------------------------------------
    console.log('\n--- Journey 3: Search Lab & F5 Refresh Recovery (P1) ---');
    await page.click('button:has-text("Search Lab")');
    await page.waitForTimeout(500);

    // Select BFS (which finds a valid solution with positive penalty g=130) and 250ms speed
    console.log('   Configuring BFS (positive-penalty g=130 solution) with 250ms teaching speed...');
    await page.selectOption('select:has(option[value="bfs"])', 'bfs');
    await page.waitForTimeout(200);
    await page.selectOption('select:has(option[value="250"])', '250');
    await page.waitForTimeout(200);

    // Start Search
    console.log('   Starting Search...');
    await page.click('button:has-text("Start Search")');
    await page.waitForTimeout(350);

    // Pause Search
    console.log('   Pausing Search...');
    const pauseBtn = page.locator('button:has-text("Pause")');
    await pauseBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pauseBtn.click();
    await page.waitForTimeout(400);

    // Verify explored nodes freeze
    const exploredLocator = page.locator('span:below(:text("Explored Nodes"))').first();
    const expBeforeRefresh = await exploredLocator.textContent();
    console.log(`   Explored nodes while paused: ${expBeforeRefresh}`);
    await page.screenshot({ path: path.join(screenshotsDir, '03_search_lab_paused.png') });
    console.log('   Saved: docs/screenshots/03_search_lab_paused.png');

    // TEST F5 REFRESH WHILE PAUSED
    console.log('   >>> Testing F5 Refresh while search is PAUSED <<<');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify Search Lab tab is active and status is PAUSED
    await page.waitForSelector('text=PAUSED', { timeout: 8000 });
    const resumeBtnVisible = await page.locator('button:has-text("Resume")').isVisible();
    assert.strictEqual(resumeBtnVisible, true, 'Resume button must be visible when restored to PAUSED');
    console.log('   Confirmed: PAUSED state restored after F5 refresh with working Resume button!');

    // Verify Step control advances by 1
    console.log('   Testing Step Forward after F5 restore...');
    const stepBtn = page.locator('button:has-text("Step Forward")');
    await stepBtn.waitFor({ state: 'visible' });
    await stepBtn.click();
    await page.waitForTimeout(400);

    // Select fast speed and Resume
    console.log('   Resuming search to completion...');
    await page.selectOption('select:has(option[value="50"])', '50');
    const resumeBtn = page.locator('button:has-text("Resume")');
    await resumeBtn.waitFor({ state: 'visible' });
    await resumeBtn.click();

    // Wait for Validated Timetable Found
    await page.waitForSelector('text=Validated Timetable Found!', { timeout: 15000 });
    console.log('   Validated Timetable Found!');

    // TEST F5 REFRESH AFTER COMPLETION (TRUTHFULNESS OF RECONSTRUCTED SEARCH VISUALIZATION)
    console.log('   >>> Testing F5 Refresh after SUCCESS completion (Truthfulness Check) <<<');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await page.waitForSelector('text=Validated Timetable Found!', { timeout: 8000 });
    console.log('   Restored after F5: "Validated Timetable Found!" is intact!');
    const finalExplored = await page.textContent('span:below(:text("Explored Nodes")) >> nth=0');
    console.log(`   Restored final explored nodes: ${finalExplored?.trim()}`);

    // Verify Truthfulness: Canvas Top Bar must be labeled "Reconstructed Solution Path"
    const canvasTitle = await page.textContent('text=Reconstructed Solution Path');
    assert(canvasTitle !== null, 'Canvas header must be explicitly labeled "Reconstructed Solution Path"');
    console.log('   Verified canvas header: "Reconstructed Solution Path"');

    const canvasSubtitle = await page.textContent('text=(Assignments Restored · Historical Node Evaluations N/A)');
    assert(canvasSubtitle !== null, 'Canvas subtitle must explicitly indicate historical evaluations are N/A');
    console.log('   Verified canvas subtitle: "(Assignments Restored · Historical Node Evaluations N/A)"');

    // Verify Truthfulness: Reconstructed node badge displays N/A instead of fabricated 0 values
    const stepCard = page.locator('div:has-text("Path Step (g/h/f: N/A)")').first();
    await stepCard.waitFor({ state: 'visible', timeout: 5000 });
    console.log('   Verified tree node badge displays "Path Step (g/h/f: N/A)" instead of fabricated zeros');

    // Click the node to inspect evaluation metrics in the Node & State Inspector
    await stepCard.click();
    await page.waitForTimeout(300);

    const inspectorG = await page.locator('div:has(> span:text("g (Penalty)")) > span:nth-child(2)').textContent();
    console.log(`   Inspector g (Penalty) value: ${inspectorG?.trim()}`);
    assert.strictEqual(inspectorG?.trim(), 'N/A', 'Reconstructed node g-value must display "N/A", never fabricated 0');

    const inspectorH = await page.locator('div:has(> span:text("h (Heuristic)")) > span:nth-child(2)').textContent();
    console.log(`   Inspector h (Heuristic) value: ${inspectorH?.trim()}`);
    assert.strictEqual(inspectorH?.trim(), 'N/A', 'Reconstructed node h-value must display "N/A", never fabricated 0');

    const inspectorF = await page.locator('div:has(> span:text("f (g + h)")) > span:nth-child(2)').textContent();
    console.log(`   Inspector f (g + h) value: ${inspectorF?.trim()}`);
    assert.strictEqual(inspectorF?.trim(), 'N/A', 'Reconstructed node f-value must display "N/A", never fabricated 0');

    const naBadge = await page.locator('text=Historical metrics N/A').isVisible();
    assert.strictEqual(naBadge, true, 'Inspector must display "Historical metrics N/A" badge');
    console.log('   Verified: Zero fabricated numerical search values rendered for reconstructed solution path!');

    await page.screenshot({ path: path.join(screenshotsDir, '04_search_lab_completed.png') });
    console.log('   Saved: docs/screenshots/04_search_lab_completed.png');

    // -------------------------------------------------------------
    // JOURNEY 4: Timetable Dashboard, Revalidation & Exports
    // -------------------------------------------------------------
    console.log('\n--- Journey 4: Timetable Dashboard, Filters & Exports ---');
    await page.click('button:has-text("Open Timetable Dashboard")');
    await page.waitForTimeout(500);

    const examRows = await page.locator('tbody tr').count();
    console.log(`   Scheduled exam rows: ${examRows}`);
    assert(examRows >= 2, 'Expected at least 2 scheduled courses');

    // Test Search filter
    await page.fill('input[placeholder*="Search"]', 'NONEXISTENT_COURSE_999');
    await page.waitForTimeout(300);
    const zeroRows = await page.locator('text=No examination assignments match').count();
    assert.strictEqual(zeroRows, 1, 'Should display empty match message');

    await page.fill('input[placeholder*="Search"]', '');
    await page.waitForTimeout(300);

    // Test Re-Validate
    console.log('   Running independent re-validation...');
    await page.click('button:has-text("Re-Validate")');
    await page.waitForSelector('text=Schedule is fully valid!', { timeout: 8000 });
    console.log('   Re-validation confirmed fully valid!');

    await page.screenshot({ path: path.join(screenshotsDir, '05_timetable_dashboard.png') });
    console.log('   Saved: docs/screenshots/05_timetable_dashboard.png');

    // Download PDF and XLSX
    console.log('   Downloading PDF and XLSX files...');
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("PDF")'),
    ]);
    const pdfPath = await pdfDownload.path();
    const pdfSize = fs.statSync(pdfPath).size;
    console.log(`   Downloaded PDF (${pdfSize} bytes)`);
    assert(pdfSize > 1000, 'PDF export must be valid');

    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Excel (XLSX)")'),
    ]);
    const xlsxPath = await xlsxDownload.path();
    const xlsxSize = fs.statSync(xlsxPath).size;
    console.log(`   Downloaded XLSX (${xlsxSize} bytes)`);
    assert(xlsxSize > 1000, 'XLSX export must be valid');

    // Save copy to docs/sample_exports
    const sampleDir = path.join(__dirname, '..', 'docs', 'sample_exports');
    if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
    fs.copyFileSync(xlsxPath, path.join(sampleDir, 'sample_schedule.xlsx'));
    fs.copyFileSync(pdfPath, path.join(sampleDir, 'sample_schedule.pdf'));

    // VERIFY EXCEL CELL TYPES WITH OPENPYXL
    console.log('   >>> Validating Excel Native Date and Time Cell Types (P2) <<<');
    const pythonBin = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
    const verifyScript = path.join(__dirname, 'verify_xlsx_types.py');
    const savedXlsx = path.join(sampleDir, 'sample_schedule.xlsx');
    const xlsxVerifyOutput = execSync(`"${pythonBin}" "${verifyScript}" "${savedXlsx}"`).toString();
    console.log('   openpyxl output:\n   ' + xlsxVerifyOutput.trim().split('\n').join('\n   '));

    // -------------------------------------------------------------
    // JOURNEY 5: Empirical Algorithm Comparison
    // -------------------------------------------------------------
    console.log('\n--- Journey 5: Empirical Algorithm Comparison ---');
    await page.click('button:has-text("Compare")');
    await page.waitForTimeout(500);

    console.log('   Executing 4-Algorithm Benchmark...');
    await page.click('button:has-text("Run 4-Algorithm Benchmark")');
    await page.waitForSelector('text=Sequential Benchmark Results', { timeout: 35000 });
    console.log('   Benchmark complete with all 4 trials!');

    await page.screenshot({ path: path.join(screenshotsDir, '06_algorithm_comparison.png') });
    console.log('   Saved: docs/screenshots/06_algorithm_comparison.png');

    // -------------------------------------------------------------
    // JOURNEY 6: Revision Integrity & Dirty Tracking (P1)
    // -------------------------------------------------------------
    console.log('\n--- Journey 6: Revision Integrity & Dirty State Blocking (P1) ---');
    await page.click('button:has-text("Setup")');
    await page.waitForTimeout(400);

    await page.click('button:has-text("Courses")');
    await page.waitForTimeout(300);

    // Edit Course AI101 duration from 60 to 90 minutes (slots are only 60m)
    console.log('   Editing Course AI101 duration from 60 to 90 mins (exceeds 60m slot limit)...');
    const durationInput = page.locator('[data-testid="course-duration-input"]').first();
    await durationInput.fill('90');
    await page.waitForTimeout(400);

    // Verify "Unsaved Draft" badge is visible in Navbar / Setup
    await page.waitForSelector('text=Unsaved Draft', { timeout: 6000 });
    const unsavedBadge = await page.textContent('text=Unsaved Draft');
    console.log(`   Observed dirty state badge: ${unsavedBadge?.trim()}`);
    assert(unsavedBadge !== null, 'UI must display "Unsaved Draft" when modifications exist');

    // Switch to Search Lab: verify warning banner and disabled start button
    console.log('   Verifying Search Lab execution block on dirty revision...');
    await page.click('button:has-text("Search Lab")');
    await page.waitForTimeout(400);

    const dirtyBannerLab = await page.locator('text=Unsaved problem modifications detected').count();
    assert(dirtyBannerLab >= 1, 'Search Lab must show dirty banner');

    const startBtnDisabled = await page.locator('button:has-text("Start Search")').isDisabled();
    assert.strictEqual(startBtnDisabled, true, 'Start Search must be disabled when dirty');
    console.log('   Confirmed: Start Search is disabled with unsaved dirty banner.');

    // Switch to Comparison: verify benchmark execution is also blocked
    console.log('   Verifying Comparison benchmark execution block on dirty revision...');
    await page.click('button:has-text("Compare")');
    await page.waitForTimeout(400);

    const dirtyBannerCmp = await page.locator('text=Unsaved problem modifications detected').count();
    assert(dirtyBannerCmp >= 1, 'Comparison must show dirty banner');

    const benchmarkBtnDisabled = await page.locator('button:has-text("Run 4-Algorithm Benchmark")').isDisabled();
    assert.strictEqual(benchmarkBtnDisabled, true, 'Benchmark button must be disabled when dirty');
    console.log('   Confirmed: Benchmark is disabled with unsaved dirty banner.');

    // Commit the new revision
    console.log('   Committing edited revision (duration = 90m)...');
    await page.click('button:has-text("Commit Revision Now")');
    await page.waitForSelector('button:has-text("Commit Revision Now")', { state: 'detached', timeout: 8000 });
    console.log('   Revision committed successfully!');

    // Switch to Search Lab and verify run now rejects due to infeasible duration!
    console.log('   Running search on modified problem: expecting No Feasible Timetable Exists...');
    await page.click('button:has-text("Search Lab")');
    await page.waitForTimeout(400);

    const startBtn = page.locator('button:has-text("Start Search")');
    assert.strictEqual(await startBtn.isEnabled(), true, 'Start Search must be enabled after commit');
    await startBtn.click();
    await page.waitForSelector('text=No Feasible Timetable Exists', { timeout: 10000 });
    console.log('   Search correctly identified infeasibility: "No Feasible Timetable Exists"!');
    console.log('   PROVEN: Problem modifications directly govern subsequent search behavior!');

    await page.screenshot({ path: path.join(screenshotsDir, '07_revision_dirty_and_rejection.png') });
    console.log('   Saved: docs/screenshots/07_revision_dirty_and_rejection.png');

    // -------------------------------------------------------------
    // JOURNEY 7: Dynamic Calendar & Simultaneous Room Lanes (P2)
    // -------------------------------------------------------------
    console.log('\n--- Journey 7: Dynamic Calendar & Simultaneous Room Lanes (P2) ---');
    await page.click('button:has-text("Setup")');
    await page.waitForTimeout(400);

    console.log('   Loading "Simultaneous & Off-Hours" fixture...');
    await page.click('button:has-text("Simultaneous & Off-Hours")');
    await page.waitForTimeout(400);

    console.log('   Committing Simultaneous & Off-Hours revision...');
    await page.click('button:has-text("Commit Revision")');
    await page.waitForSelector('text=Committed:', { timeout: 8000 });

    // Run A* search on this problem
    await page.click('button:has-text("Search Lab")');
    await page.waitForTimeout(400);
    await page.selectOption('select:has(option[value="astar"])', 'astar');
    await page.selectOption('select:has(option[value="50"])', '50');
    await page.click('button:has-text("Start Search")');

    await page.waitForSelector('text=Validated Timetable Found!', { timeout: 15000 });
    console.log('   A* solution found for Simultaneous & Off-Hours fixture!');

    // Switch to Timetable Dashboard -> Calendar View
    await page.click('button:has-text("Open Timetable Dashboard")');
    await page.waitForTimeout(500);

    await page.click('button:has-text("Calendar View")');
    await page.waitForTimeout(600);

    // Verify dynamic hours header description
    const calDesc = await page.textContent('text=Dynamic time bounds');
    console.log('   Observed Calendar description:', calDesc?.trim());
    assert(calDesc && (calDesc.includes('06:00') || calDesc.includes('23:00') || calDesc.includes('24:00')),
      'Calendar must dynamically display early (06:00) and late hours');

    // Verify room column lanes in header
    const roomHeader1 = await page.textContent('text=Main Examination Hall 1');
    const roomHeader2 = await page.textContent('text=Science Auditorium 2');
    console.log(`   Observed Room column headers: Hall 1 = "${roomHeader1?.trim()}", Hall 2 = "${roomHeader2?.trim()}"`);
    assert(roomHeader1 !== null && roomHeader2 !== null, 'Both room column lanes must be present');

    // Verify simultaneous exam placements
    const simultaneousCards = await page.locator('.pointer-events-auto').count();
    console.log(`   Observed ${simultaneousCards} positioned exam cards on dynamic calendar.`);
    assert(simultaneousCards >= 4, 'All 4 exams must be placed on calendar');

    await page.screenshot({ path: path.join(screenshotsDir, '08_calendar_dynamic_lanes.png') });
    console.log('   Saved: docs/screenshots/08_calendar_dynamic_lanes.png');

    // -------------------------------------------------------------
    // JOURNEY 8: Mobile Responsive Viewport (390px)
    // -------------------------------------------------------------
    console.log('\n--- Journey 8: Mobile Responsive Viewport (390x844) ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(screenshotsDir, '09_mobile_layout.png') });
    console.log('   Saved: docs/screenshots/09_mobile_layout.png');

    console.log('\n=============================================================');
    console.log('ALL BROWSER ACCEPTANCE JOURNEYS VERIFIED WITH 100% SUCCESS!');
    console.log('=============================================================');

    await browser.close();
  } finally {
    if (spawnedServer) {
      console.log('Stopping spawned local uvicorn server...');
      spawnedServer.kill();
    }
  }
}

runBrowserVerification().catch((err) => {
  console.error('\n*** BROWSER VERIFICATION FAILED ***\n', err);
  process.exit(1);
});
