/**
 * ================================================================
 * AI TESTING COMPANION - FRONTEND JAVASCRIPT
 * ================================================================
 * 
 * Handles all frontend interactions including:
 * - Navigation between sections
 * - API calls to backend
 * - UI updates and rendering
 * - Form handling
 * - Toast notifications
 * 
 * ================================================================
 */

// ============================================================
// CONSTANTS & CONFIG
// ============================================================

const API_BASE_URL = 'http://localhost:3002/api';

// ============================================================
// STATE MANAGEMENT
// ============================================================

const state = {
    generatedTestCases: [],
    selectedTestCases: new Set(),
    currentSection: 'generate-tests',
    config: null
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🤖 AI Testing Companion - Initializing...');
    
    initializeNavigation();
    initializeGenerateTests();
    initializeBugIntelligence();
    initializeAnalyzePR();
    initializeSettings();
    loadConfiguration();
    
    console.log('✅ Initialization complete');
});

// ============================================================
// NAVIGATION
// ============================================================

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const sectionId = link.getAttribute('data-section');
            navigateToSection(sectionId);
        });
    });
}

function navigateToSection(sectionId) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Update active section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    state.currentSection = sectionId;
}

// ============================================================
// GENERATE TESTS SECTION
// ============================================================

function initializeGenerateTests() {
    const btnGenerate = document.getElementById('btn-generate-tests');
    const btnUpload = document.getElementById('btn-upload-to-testrail');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnDeselectAll = document.getElementById('btn-deselect-all');
    
    btnGenerate.addEventListener('click', handleGenerateTests);
    btnUpload.addEventListener('click', handleUploadToTestRail);
    btnSelectAll.addEventListener('click', () => selectAllTestCases(true));
    btnDeselectAll.addEventListener('click', () => selectAllTestCases(false));
}

async function handleGenerateTests() {
    const jiraIds = document.getElementById('jira-ids').value.trim();
    const suiteId = document.getElementById('suite-id').value.trim();
    const folderName = document.getElementById('folder-name').value.trim();
    
    // Validation
    if (!jiraIds || !suiteId || !folderName) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    showLoading('Generating test cases from JIRA stories...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-testcases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jiraIds, suiteId, folderName })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            state.generatedTestCases = data.testCases;
            displayTestCases(data.testCases);
            showToast(`✨ Generated ${data.count} test cases from ${data.storiesProcessed} stories`, 'success');
            
            // Show the test cases card
            document.getElementById('test-cases-card').style.display = 'block';
            document.getElementById('test-case-count').textContent = `${data.count} test cases`;
        } else {
            showToast(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error generating test cases:', error);
        showToast('Failed to generate test cases. Check console for details.', 'error');
    }
}

function displayTestCases(testCases) {
    const container = document.getElementById('test-cases-list');
    container.innerHTML = '';
    
    testCases.forEach((testCase, index) => {
        const testCaseEl = createTestCaseElement(testCase, index);
        container.appendChild(testCaseEl);
    });
}

function createTestCaseElement(testCase, index) {
    const div = document.createElement('div');
    div.className = 'test-case-item';
    div.dataset.index = index;
    
    // Format steps
    const steps = testCase.custom_steps_separated || [];
    const stepsHTML = steps.map((step, i) => `
        <li>
            <strong>Step ${i + 1}:</strong> ${step.content || step}<br>
            <em>Expected:</em> ${step.expected || 'N/A'}
        </li>
    `).join('');
    
    div.innerHTML = `
        <div class="test-case-header">
            <input type="checkbox" 
                   class="test-case-checkbox" 
                   data-index="${index}"
                   checked>
            <div class="test-case-title">${testCase.title}</div>
            <div class="test-case-actions">
                <button class="btn btn-sm btn-secondary" onclick="editTestCase(${index})">✏️ Edit</button>
            </div>
        </div>
        <div class="test-case-body">
            <div class="test-case-field">
                <span class="test-case-field-label">Preconditions:</span>
                <div class="test-case-field-value">${testCase.custom_preconds || 'N/A'}</div>
            </div>
            <div class="test-case-field">
                <span class="test-case-field-label">Steps:</span>
                <ul class="test-case-steps">${stepsHTML}</ul>
            </div>
            <div class="test-case-field">
                <span class="test-case-field-label">References:</span>
                <div class="test-case-field-value">${testCase.refs || 'N/A'}</div>
            </div>
        </div>
    `;
    
    // Add checkbox event listener
    const checkbox = div.querySelector('.test-case-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            state.selectedTestCases.add(index);
            div.classList.add('selected');
        } else {
            state.selectedTestCases.delete(index);
            div.classList.remove('selected');
        }
    });
    
    // Initialize as selected
    state.selectedTestCases.add(index);
    div.classList.add('selected');
    
    return div;
}

function selectAllTestCases(select) {
    const checkboxes = document.querySelectorAll('.test-case-checkbox');
    checkboxes.forEach((cb, index) => {
        cb.checked = select;
        const item = cb.closest('.test-case-item');
        if (select) {
            state.selectedTestCases.add(index);
            item.classList.add('selected');
        } else {
            state.selectedTestCases.delete(index);
            item.classList.remove('selected');
        }
    });
}

function editTestCase(index) {
    // TODO: Implement inline editing
    showToast('Edit functionality coming soon', 'info');
}

async function handleUploadToTestRail() {
    if (state.selectedTestCases.size === 0) {
        showToast('Please select at least one test case', 'error');
        return;
    }
    
    const jiraIds = document.getElementById('jira-ids').value.trim();
    const suiteId = document.getElementById('suite-id').value.trim();
    const folderName = document.getElementById('folder-name').value.trim();
    
    // Get selected test cases
    const selectedTests = Array.from(state.selectedTestCases).map(index => state.generatedTestCases[index]);
    
    showLoading(`Uploading ${selectedTests.length} test cases to TestRail...`);
    
    // Show progress section
    const progressSection = document.getElementById('upload-progress');
    progressSection.style.display = 'block';
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload-to-testrail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                suiteId,
                folderName,
                testCases: selectedTests,
                jiraIds
            })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.duplicatesFound) {
            showToast(`⚠️ Found ${data.duplicates.length} duplicate test cases`, 'error');
            // TODO: Show duplicate handling UI
            return;
        }
        
        if (data.success) {
            // Update progress bar
            document.getElementById('progress-bar-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = '✅ Upload Complete!';
            
            // Display results in log
            const log = document.getElementById('progress-log');
            data.results.success.forEach(result => {
                const item = document.createElement('div');
                item.className = 'progress-log-item success';
                item.textContent = `✓ ${result.title} (ID: ${result.id})`;
                log.appendChild(item);
            });
            
            showToast(`✅ Successfully uploaded ${data.uploaded} test cases`, 'success');
            
            // Clear uploaded test cases
            state.selectedTestCases.forEach(index => {
                const item = document.querySelector(`.test-case-item[data-index="${index}"]`);
                if (item) item.remove();
            });
            state.selectedTestCases.clear();
            
        } else {
            showToast(`Upload failed: ${data.results.failed[0]?.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error uploading to TestRail:', error);
        showToast('Failed to upload to TestRail. Check console for details.', 'error');
    }
}

// ============================================================
// BUG INTELLIGENCE SECTION
// ============================================================

function initializeBugIntelligence() {
    const btnGenerate = document.getElementById('btn-generate-bug-report');
    const btnCopy = document.getElementById('btn-copy-bug-report');
    
    btnGenerate.addEventListener('click', handleGenerateBugReport);
    btnCopy.addEventListener('click', handleCopyBugReport);
}

async function handleGenerateBugReport() {
    const description = document.getElementById('bug-description').value.trim();
    
    if (!description) {
        showToast('Please enter a bug description', 'error');
        return;
    }
    
    showLoading('Generating comprehensive bug report...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-bug-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            displayBugReport(data.bugReport);
            document.getElementById('bug-report-card').style.display = 'block';
            showToast('✨ Bug report generated successfully', 'success');
        } else {
            showToast(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error generating bug report:', error);
        showToast('Failed to generate bug report. Check console for details.', 'error');
    }
}

function displayBugReport(report) {
    const container = document.getElementById('bug-report-content');
    container.textContent = report.jiraFormatted;
}

async function handleCopyBugReport() {
    const content = document.getElementById('bug-report-content').textContent;
    
    try {
        await navigator.clipboard.writeText(content);
        showToast('📋 Bug report copied to clipboard', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showToast('Failed to copy to clipboard', 'error');
    }
}

// ============================================================
// ANALYZE PR SECTION
// ============================================================

function initializeAnalyzePR() {
    const btnFetch = document.getElementById('btn-fetch-prs');
    const btnAnalyze = document.getElementById('btn-analyze-pr');
    
    btnFetch.addEventListener('click', handleFetchPRs);
    btnAnalyze.addEventListener('click', handleAnalyzePR);
}

async function handleFetchPRs() {
    const jiraId = document.getElementById('pr-jira-id').value.trim();
    
    if (!jiraId) {
        showToast('Please enter a JIRA ticket ID', 'error');
        return;
    }
    
    showLoading('Fetching linked PRs from JIRA...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/fetch-prs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jiraId })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success && data.linkedPRs && data.linkedPRs.length > 0) {
            displayPRModal(data.linkedPRs);
        } else {
            showToast('No PRs found linked to this JIRA ticket', 'warning');
        }
    } catch (error) {
        hideLoading();
        console.error('Error fetching PRs:', error);
        showToast('Failed to fetch PRs. Check console for details.', 'error');
    }
}

function displayPRModal(prs) {
    const modal = document.getElementById('pr-modal');
    const prList = document.getElementById('pr-list');
    
    const prHTML = prs.map((pr, index) => `
        <div class="pr-item" onclick="selectPR('${pr.url.replace(/'/g, "\\'")}')">            <div class="pr-title">${pr.title}</div>
            <div class="pr-meta">
                <span class="pr-status pr-status-${pr.status}">${pr.status}</span>
                <span class="pr-url">${pr.url}</span>
            </div>
        </div>
    `).join('');
    
    prList.innerHTML = prHTML;
    modal.style.display = 'flex';
}

function selectPR(url) {
    document.getElementById('pr-url').value = url;
    closePRModal();
    showToast('PR URL populated. Click "Analyze PR" to continue.', 'success');
}

function closePRModal() {
    document.getElementById('pr-modal').style.display = 'none';
}

// Toggle grouped section visibility (collapsible)
function toggleGroupedSection(sectionId) {
    const content = document.getElementById(sectionId);
    const icon = document.getElementById(sectionId + '-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
    } else {
        content.style.display = 'none';
        icon.textContent = '▶';
    }
}

// Expand all grouped sections
function expandAllSections() {
    document.querySelectorAll('.grouped-section-content').forEach(el => {
        el.style.display = 'block';
    });
    document.querySelectorAll('.toggle-icon').forEach(el => {
        el.textContent = '▼';
    });
}

// Collapse all grouped sections
function collapseAllSections() {
    document.querySelectorAll('.grouped-section-content').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('.toggle-icon').forEach(el => {
        el.textContent = '▶';
    });
}

async function handleAnalyzePR() {
    const jiraId = document.getElementById('pr-jira-id').value.trim();
    const prUrl = document.getElementById('pr-url').value.trim();
    const suiteId = document.getElementById('pr-suite-id').value.trim();
    
    if (!jiraId && !prUrl) {
        showToast('Please enter either a JIRA ID or PR URL', 'error');
        return;
    }
    
    if (!suiteId) {
        showToast('Please enter TestRail Suite ID', 'error');
        return;
    }
    
    showLoading('Analyzing PR and identifying impacted test cases...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/analyze-pr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jiraId, prUrl, suiteId })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.noPRFound) {
            showToast(data.message, 'error');
            return;
        }
        
        if (data.success) {
            displayPRAnalysis(data);
            document.getElementById('pr-results').style.display = 'block';
            showToast('✅ PR analysis complete', 'success');
        } else {
            showToast(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error analyzing PR:', error);
        showToast('Failed to analyze PR. Check console for details.', 'error');
    }
}

function displayPRAnalysis(data) {
    // Debug: log the received data structure
    console.log('[UI] Received PR Analysis Data:', {
        riskScore: data.analysis?.riskScore,
        riskLevel: data.analysis?.riskLevel,
        totalTestCases: data.estimation?.totalTestCases,
        estimatedHours: data.estimation?.estimatedHours,
        groupedTests: Object.keys(data.testCases?.grouped || {}).length,
        files: data.pr?.files?.length
    });
    
    // Display category
    const categoryEl = document.getElementById('pr-category');
    categoryEl.className = `pr-category ${data.pr.category.toLowerCase().replace(' pr', '')}`;
    // PR category descriptions
    const prCategoryDescriptions = {
        'Sarcastic PR': 'quick fixes that aren\'t actually quick',
        'Sleepy PR': 'mostly style or minor changes',
        'Overloaded PR': 'touches many shared components or high risk',
        'Angry PR': 'large, high-impact, or risky changes',
        'Relaxed PR': 'small, safe, or routine changes'
    };
    const desc = prCategoryDescriptions[data.pr.category] || '';
    categoryEl.innerHTML = `
        <span style="font-size: 2rem;">${data.pr.emoji}</span>
        <div style="flex:1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <span>${data.pr.category}</span>
                <span style="font-size: 0.85rem; color: #6b7280; font-weight: 400; opacity: 0.85; text-align: right; min-width: 180px;">${desc}</span>
            </div>
            <div style="font-size: 0.875rem; font-weight: normal; opacity: 0.8;">
                ${data.pr.filesChanged} files changed by ${data.pr.author}
            </div>
        </div>
    `;
    
    // Display files
    const filesEl = document.getElementById('pr-files');
    filesEl.style.display = 'block'; // Force visible
    const seen = new Set();
    const fileList = [];
    const invalidFiles = [];
    data.pr.files.forEach(file => {
        if (!file || typeof file.path !== 'string') {
            invalidFiles.push(file);
            return;
        }
        const filename = file.path.split('/').pop();
        const match = /\.[a-zA-Z0-9]+$/.test(filename);
        if (!match) return;
        if (seen.has(file.path)) return;
        seen.add(file.path);
        fileList.push(file);
    });
    if (fileList.length === 0) {
        console.error('[UI] No files to display after filtering. Invalid/malformed files:', invalidFiles, 'All files:', data.pr.files);
    }
    const filesHTML = fileList.map(file => `
        <div class="file-item">
            <span class="file-path">${file.path}</span>
            <span class="file-stats">
                <span class="added">+${file.linesAdded}</span>
                <span class="removed">-${file.linesRemoved}</span>
            </span>
        </div>
    `).join('');
    if (fileList.length === 0 && invalidFiles.length > 0) {
        filesEl.innerHTML = '<p>No file changes detected. Invalid file objects received:<br>' +
            invalidFiles.map(f => JSON.stringify(f)).join('<br>') + '</p>';
    } else {
        filesEl.innerHTML = filesHTML || '<p>No file changes detected</p>';
    }
    
    // Display impact analysis
    const impactEl = document.getElementById('impact-analysis');
    const impactHTML = data.impactAnalysis.map(impact => `
        <div class="impact-item ${impact.risk.toLowerCase()}">
            <div class="impact-header">
                <div class="impact-component">${impact.component}</div>
                <span class="impact-risk-badge ${impact.risk.toLowerCase()}">${impact.risk} Risk</span>
            </div>
            <div class="impact-reason">${impact.reason}</div>
            ${impact.qualitySignals && impact.qualitySignals.length > 0 ? `
                <div class="quality-signals">
                    ${impact.qualitySignals.map(signal => `<div class="quality-signal">${signal}</div>`).join('')}
                </div>
            ` : ''}
            <div class="impact-suggestions-title">Testing Recommendations:</div>
            <ul class="impact-suggestions">
                ${impact.testingSuggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
        </div>
    `).join('');
    impactEl.innerHTML = impactHTML || '<p>No specific impact identified</p>';
    
    // Display test cases
    const testCasesEl = document.getElementById('impacted-test-cases');
    const regressionTests = data.testCases.regression || [];
    const suggestedScenarios = data.testCases.suggested || [];
    const groupedTests = data.testCases.grouped || {};
    const byPriority = data.testCases.byPriority || null;
    
    let testCasesHTML = '';
    
    // Display grouped impacted test cases with collapsible sections (by section path)
    if (Object.keys(groupedTests).length > 0) {
        const impactedAreasCount = Object.keys(groupedTests).length;
        const totalTestCases = Object.values(groupedTests).reduce((sum, cases) => sum + cases.length, 0);
        
        testCasesHTML += `
            <div class="grouped-tests-header">
                <h4>📊 Impacted Test Cases from TestRail</h4>
                <p class="impacted-areas-count">Impacted Areas: <strong>${impactedAreasCount}</strong> | Total Test Cases: ${totalTestCases}</p>
                <p class="grouped-tests-subtitle">Click on a section path to expand/collapse</p>
            </div>
        `;

        // Display grouped sections sorted alphabetically
        const sortedPaths = Object.keys(groupedTests).sort();
        sortedPaths.forEach((sectionPath, index) => {
            const cases = groupedTests[sectionPath];
            const sectionId = `grouped-section-${index}`;
            testCasesHTML += `
                <div class="grouped-section">
                    <div class="grouped-section-header" onclick="toggleGroupedSection('${sectionId}')">
                        <span class="toggle-icon" id="${sectionId}-icon">▶</span>
                        <span class="module-name">${sectionPath}</span>
                        <span class="case-count">${cases.length} test case${cases.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="grouped-section-content" id="${sectionId}" style="display: none;">
                        ${cases.map(tc => `
                            <a href="${tc.url}" target="_blank" class="test-case-link grouped-test-case">
                                <div class="test-case-info">
                                    <div class="test-case-title">${tc.title}</div>
                                    ${tc.matchedKeywords && tc.matchedKeywords.length > 0 ? `<div class="test-case-keywords">JIRA Keywords: ${tc.matchedKeywords.join(', ')}</div>` : ''}
                                    ${tc.matchedFileKeywords && tc.matchedFileKeywords.length > 0 ? `<div class="test-case-keywords">File Keywords: ${tc.matchedFileKeywords.join(', ')}</div>` : ''}
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }
    
    // Show AI scenarios below TestRail test cases (collapsible)
    if (suggestedScenarios.length > 0) {
        testCasesHTML += `
            <div class="ai-scenarios-section">
                <div class="ai-scenarios-header" onclick="toggleAIScenarios()">
                    <span class="toggle-icon" id="ai-scenarios-icon">▼</span>
                    <h4>🤖 AI-Generated Test Scenarios</h4>
                    <span class="scenario-count">${suggestedScenarios.length} scenarios</span>
                </div>
                <div id="ai-scenarios-content" class="ai-scenarios-content" style="display: block;">
                    <p class="ai-scenarios-subtitle">Based on application context and PR changes</p>
                    ${suggestedScenarios.map(scenario => `
                        <div class="suggested-scenario">
                            <div class="scenario-header">
                                <span class="scenario-title">${scenario.title}</span>
                                <span class="scenario-priority ${scenario.priority.toLowerCase()}">${scenario.priority}</span>
                            </div>
                            <div class="scenario-type">${scenario.type}</div>
                            <div class="scenario-description">${scenario.description}</div>
                            <div class="scenario-suggested-by">${scenario.suggestedBy}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Fallback for legacy regression test display (if no grouped tests)
    if (regressionTests.length > 0 && Object.keys(groupedTests).length === 0) {
        testCasesHTML += `
            <div class="existing-tests-header">
                <p><strong>Existing Test Cases from TestRail</strong> (${regressionTests.length} tests found):</p>
            </div>
            ${regressionTests.map(tc => `
                <a href="${tc.url}" target="_blank" class="test-case-link">
                    <div class="test-case-path">${tc.sectionPath || 'N/A'}</div>
                    <div>${tc.title}</div>
                </a>
            `).join('')}
        `;
    } 
    
    if (!suggestedScenarios.length && !regressionTests.length && Object.keys(groupedTests).length === 0) {
        testCasesHTML = '<p>No test cases or scenarios available</p>';
    }
    
    testCasesEl.innerHTML = testCasesHTML;
    
    // Display risk assessment with impacted areas and time in same row
    const riskEl = document.getElementById('risk-assessment');
    const impactedAreasCount = data.estimation.impactedSections || Object.keys(data.testCases.grouped || {}).length;
    const estimatedHours = data.estimation.estimatedHours || 0;
    
    riskEl.innerHTML = `
        <div class="risk-assessment-row">
            <div class="risk-stat-box">
                <div class="risk-stat-value">${impactedAreasCount}</div>
                <div class="risk-stat-label">Impacted Functional Areas</div>
            </div>
            
            <div class="risk-score-circle ${data.analysis.riskLevel.toLowerCase()}">
                <div class="risk-score-value">${data.analysis.riskScore}</div>
                <div class="risk-score-label">${data.analysis.riskLevel} Risk</div>
            </div>
            
            <div class="risk-stat-box">
                <div class="risk-stat-value">${estimatedHours}h</div>
                <div class="risk-stat-label">Estimated Test Time</div>
                <div class="risk-stat-sublabel">(Based on ${data.estimation.prCategory || 'PR complexity'})</div>
            </div>
        </div>
    `;
}

// ============================================================
// SETTINGS SECTION
// ============================================================

function initializeSettings() {
    const btnUploadContext = document.getElementById('btn-upload-context');
    btnUploadContext.addEventListener('click', handleUploadContext);
}

async function loadConfiguration() {
    try {
        const response = await fetch(`${API_BASE_URL}/config`);
        const config = await response.json();
        state.config = config;
        
        // Populate settings
        document.getElementById('jira-url').value = config.jira.baseUrl;
        document.getElementById('bitbucket-url').value = config.bitbucket.baseUrl;
        document.getElementById('testrail-url').value = config.testRail.baseUrl;
        document.getElementById('testrail-project').value = config.testRail.projectId;
        document.getElementById('testrail-suite').value = config.testRail.defaultSuiteId;
        
        // Update status badges
        updateStatusBadge('jira-status', config.jira.configured);
        updateStatusBadge('bitbucket-status', config.bitbucket.configured);
        updateStatusBadge('testrail-status', config.testRail.configured);
        updateStatusBadge('context-status', config.contextFileExists);
        
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

function updateStatusBadge(elementId, configured) {
    const badge = document.getElementById(elementId);
    if (configured) {
        badge.className = 'status-badge connected';
        badge.textContent = '✓ Configured';
    } else {
        badge.className = 'status-badge disconnected';
        badge.textContent = '✗ Not Configured';
    }
}

async function handleUploadContext() {
    const fileInput = document.getElementById('context-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a context file', 'error');
        return;
    }
    
    if (!file.name.endsWith('.txt')) {
        showToast('Only .txt files are allowed', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('contextFile', file);
    
    showLoading('Uploading context file...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/config/upload-context`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            showToast('✅ Context file uploaded successfully', 'success');
            updateStatusBadge('context-status', true);
        } else {
            showToast(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error uploading context file:', error);
        showToast('Failed to upload context file', 'error');
    }
}

// ============================================================
// UI UTILITIES
// ============================================================

// Toggle function for grouped test case sections
function toggleGroupedSection(sectionId) {
    const content = document.getElementById(sectionId);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
    } else {
        content.style.display = 'none';
        icon.textContent = '►';
    }
}

// Toggle function for AI scenarios section
function toggleAIScenarios() {
    const content = document.getElementById('ai-scenarios-content');
    const icon = document.getElementById('ai-scenarios-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
    } else {
        content.style.display = 'none';
        icon.textContent = '►';
    }
}

// Make toggle functions globally available
window.toggleGroupedSection = toggleGroupedSection;
window.toggleAIScenarios = toggleAIScenarios;

function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    text.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
