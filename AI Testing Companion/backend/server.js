/**
 * ================================================================
 * AI TESTING COMPANION - EXPRESS SERVER
 * ================================================================
 * 
 * Main backend server that handles:
 * - Test case generation from JIRA stories
 * - PR analysis and impact assessment
 * - Bug report generation
 * - TestRail integration
 * - Configuration management
 * 
 * Port: 3002 (configurable in config.js)
 * ================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Import configuration
const config = require('./config');

// Import services
const JiraService = require('./services/jira-service');
const BitbucketService = require('./services/bitbucket-service');
const TestRailService = require('./services/testrail-service');
const AIGeneratorService = require('./services/ai-generator');

// Initialize Express app
const app = express();
const PORT = config.port;

// Initialize services
const jiraService = new JiraService(config);
const bitbucketService = new BitbucketService(config);
const testRailService = new TestRailService(config);

// Context file path
const contextFilePath = path.join(__dirname, '../context/app-context.txt');
const aiService = new AIGeneratorService(contextFilePath);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Configure multer for file uploads (context file)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../context');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'app-context.txt'); // Always overwrite the context file
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // Only accept .txt files
        if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
            cb(null, true);
        } else {
            cb(new Error('Only .txt files are allowed'), false);
        }
    }
});

// Request logging middleware


// ============================================================
// API ENDPOINTS
// ============================================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'AI Testing Companion',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

/**
 * ============================================================
 * GENERATE TEST CASES
 * ============================================================
 * 
 * POST /api/generate-testcases
 * 
 * Body:
 * {
 *   jiraIds: "PROJ-123,PROJ-124",  // Comma-separated
 *   suiteId: 123,
 *   folderName: "My Test Folder"
 * }
 * 
 * Returns: Array of generated test cases in BDD format
 */
app.post('/api/generate-testcases', async (req, res) => {
    try {
        const { jiraIds, suiteId, folderName } = req.body;
        
        // Validate inputs
        if (!jiraIds || !suiteId || !folderName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: jiraIds, suiteId, folderName'
            });
        }
        
        // ...existing code...
        
        // Parse JIRA IDs
        const jiraIdArray = jiraIds.split(',').map(id => id.trim()).filter(id => id);
        
        // Fetch JIRA stories
        const { stories, errors } = await jiraService.getMultipleStories(jiraIdArray);
        
        if (stories.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Could not fetch any JIRA stories',
                errors
            });
        }
        
        // Generate test cases using AI
        const testCases = await aiService.generateTestCases(stories, suiteId);
        
        // Add metadata
        testCases.forEach(tc => {
            tc.custom_test_case_category = 'Functional';
            tc.custom_source = 'AI Generated';
            tc.custom_automated = 5; // Not Verified
            tc.custom_primary_automation_type = 0; // None
            tc.custom_test_case_health = 1; // Good
        });
        
        res.json({
            success: true,
            count: testCases.length,
            storiesProcessed: stories.length,
            testCases,
            stories: stories.map(s => ({ key: s.key, summary: s.summary })),
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('[API] Error generating test cases:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ============================================================
 * UPLOAD TEST CASES TO TESTRAIL
 * ============================================================
 * 
 * POST /api/upload-to-testrail
 * 
 * Body:
 * {
 *   suiteId: 123,
 *   folderName: "My Test Folder",
 *   testCases: [...],  // Array of test cases to upload
 *   jiraIds: "PROJ-123,PROJ-124"  // For duplicate checking
 * }
 */
app.post('/api/upload-to-testrail', async (req, res) => {
    try {
        const { suiteId, folderName, testCases, jiraIds } = req.body;
        
        if (!suiteId || !folderName || !testCases || testCases.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // ...existing code...
        
        // Get or create section
        const sectionId = await testRailService.getOrCreateSection(suiteId, folderName);
        
        // Check for duplicates
        const jiraIdArray = jiraIds.split(',').map(id => id.trim());
        const duplicates = await testRailService.checkForDuplicates(sectionId, jiraIdArray);
        
        if (duplicates.length > 0) {
            console.log(`[API] Found ${duplicates.length} duplicate test cases`);
            return res.json({
                success: false,
                duplicatesFound: true,
                duplicates: duplicates.map(d => ({ id: d.id, title: d.title })),
                message: 'Duplicate test cases found. Please review before uploading.'
            });
        }
        
        // Upload test cases with progress tracking
        const results = await testRailService.bulkAddTestCases(
            sectionId,
            testCases,
            (progress) => {
                // Progress callback - could be sent via WebSocket in future
                console.log(`[UPLOAD] ${progress.current}/${progress.total} - ${progress.testCase}`);
            }
        );
        
        res.json({
            success: results.failed.length === 0,
            uploaded: results.success.length,
            failed: results.failed.length,
            results,
            sectionId
        });
        
    } catch (error) {
        console.error('[API] Error uploading to TestRail:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ============================================================
 * FETCH PRS FROM JIRA
 * ============================================================
 * 
 * POST /api/fetch-prs
 * 
 * Body:
 * {
 *   jiraId: "PROJ-123"
 * }
 */
app.post('/api/fetch-prs', async (req, res) => {
    try {
        const { jiraId } = req.body;
        
        if (!jiraId) {
            return res.status(400).json({
                success: false,
                error: 'JIRA ID is required'
            });
        }
        
        // ...existing code...
        
        // Search PRs directly from Bitbucket (more reliable than JIRA Dev Status API)
        const linkedPRs = await bitbucketService.searchPRsByJiraId(jiraId);
        
        // Optionally get JIRA summary for display
        let summary = '';
        try {
            const story = await jiraService.getStoryDetails(jiraId);
            summary = story.summary || '';
        } catch (jiraErr) {
            console.warn('[API] Could not fetch JIRA summary:', jiraErr.message);
        }
        
        res.json({
            success: true,
            linkedPRs,
            jiraId,
            summary
        });
    } catch (error) {
        console.error('[API] Error fetching PRs:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ============================================================
 * ANALYZE PR
 * ============================================================
 * 
 * POST /api/analyze-pr
 * 
 * Body:
 * {
 *   jiraId: "PROJ-123",
 *   prUrl: "https://bitbucket.com/..." (optional)
 *   suiteId: 123
 * }
 */
app.post('/api/analyze-pr', async (req, res) => {
    try {
        const { jiraId, prUrl, suiteId } = req.body;

        if (!jiraId && !prUrl) {
            return res.status(400).json({
                success: false,
                error: 'Either jiraId or prUrl must be provided'
            });
        }

        // ...existing code...

        let prDetails;
        let linkedPRs = [];

        // If JIRA ID provided, fetch linked PRs
        if (jiraId) {
            const story = await jiraService.getStoryDetails(jiraId);
            linkedPRs = story.linkedPRs;

            if (linkedPRs.length === 0 && !prUrl) {
                return res.json({
                    success: false,
                    noPRFound: true,
                    message: 'No PR found linked to this JIRA ticket. Please provide PR URL manually.'
                });
            }

            // Use provided PR URL or the first linked PR
            const targetPR = prUrl || (linkedPRs[0] && linkedPRs[0].url);
            prDetails = await bitbucketService.getPRDetails(targetPR);
        } else {
            // Direct PR URL analysis
            prDetails = await bitbucketService.getPRDetails(prUrl);
        }

        // Extract components from changed files
        const extracted = bitbucketService.extractComponents(
            prDetails.files,
            config.componentMapping
        );
        const components = extracted.components || [];
        const keywords = extracted.keywords || [];

        // Generate AI impact analysis
        const impactAnalysis = await aiService.generateImpactAnalysis(prDetails, components, prDetails.files);

        // Try to get test cases and regression tests, but do not fail the whole response if this fails
        let testCases = [];
        let regressionTests = [];
        let impactedTestCases = null;
        let totalTests = 0;
        let estimatedTime = 0;
        let jiraStory = null;
        
        try {
            if (suiteId) {
                // Fetch JIRA story details for title and components
                if (jiraId) {
                    try {
                        jiraStory = await jiraService.getStoryDetails(jiraId);
                        // ...existing code...
                    } catch (jiraErr) {
                        console.warn('[API] Could not fetch JIRA story details:', jiraErr.message);
                    }
                }

                // NEW: Use traceability matrix-based impact analysis
                const jiraComponentsToPass = jiraStory ? jiraStory.components : [];
                console.log('[SERVER][DEBUG] jiraComponents passed to getImpactedTestCases:', jiraComponentsToPass);
                impactedTestCases = await testRailService.getImpactedTestCases(suiteId, {
                    jiraId,
                    changedFiles: prDetails.files,
                    components,
                    keywords,
                    traceabilityMatrix: config.traceabilityMatrix || {},
                    jiraTitle: jiraStory ? jiraStory.summary : '',
                    prCategory: prDetails.analysis.category,
                    jiraComponents: jiraComponentsToPass
                });
                // ...existing code...

                // Legacy: Also get score-based matches for comparison
                if (components.length > 0 || keywords.length > 0) {
                    testCases = await testRailService.searchTestCases(suiteId, {
                        components,
                        keywords,
                        jiraId
                    });
                    // Get test cases with folder hierarchy
                    const sections = await testRailService.getSectionsWithHierarchy(suiteId);
                    // Add section info to each test case
                    testCases = testCases.map(tc => {
                        const section = sections.find(s => s.id === tc.section_id);
                        return {
                            ...tc,
                            sectionPath: section ? section.path : '',
                            url: testRailService.buildTestCaseUrl(tc.id),
                            sectionUrl: section ? testRailService.buildSectionUrl(suiteId, section.id) : ''
                        };
                    });
                }
            
                // Get regression tests and score them for relevance
                const allRegressionTests = await testRailService.getRegressionTestCases(
                    suiteId,
                    config.regressionIdentification.method,
                    config.regressionIdentification.folderKeyword
                );
                
                // Score regression tests for relevance (0-100)
                // Returns only top 10-60 most relevant tests (score >= 60, or >= 45 for small PRs)
                regressionTests = await testRailService.scoreRegressionTestsForRelevance(
                    allRegressionTests,
                    prDetails.files,
                    components,
                    keywords,
                    prDetails.title || '',
                    prDetails.description || ''
                );
                
                // Add section info to regression tests
                const sections = await testRailService.getSectionsWithHierarchy(suiteId);
                regressionTests = regressionTests.map(tc => {
                    const section = sections.find(s => s.id === tc.section_id);
                    return {
                        ...tc,
                        sectionPath: section ? section.path : '',
                        url: testRailService.buildTestCaseUrl(tc.id),
                        sectionUrl: section ? testRailService.buildSectionUrl(suiteId, section.id) : ''
                    };
                });
            }
            
            // Calculate total from impacted test cases if available
            totalTests = impactedTestCases ? impactedTestCases.allCases.length : (testCases.length + regressionTests.length);
            
            // If totalTests is still 0 but we have suggestedScenarios, use those
            if (totalTests === 0 && suggestedScenarios && suggestedScenarios.length > 0) {
                totalTests = suggestedScenarios.length;
                console.log(`[API] No existing test cases found, using ${totalTests} AI-suggested scenarios for estimation`);
            }
            
            // NEW: Calculate estimated time based on impacted sections and PR category
            let estimatedHoursPerSection = 1; // Default: 1 hour per section
            const impactedSections = impactedTestCases ? Object.keys(impactedTestCases.groupedByModule).length : 0;
            
            // Adjust time estimate based on PR category
            const categoryTimeMultipliers = {
                'Relaxed PR': 0.5,    // Simple changes
                'Sleepy PR': 0.75,    // Moderate changes
                'Sarcastic PR': 1.0,  // Standard changes
                'Overloaded PR': 1.5, // Complex changes
                'Angry PR': 2.0       // Very complex changes
            };
            
            const prCategory = prDetails.analysis.category || 'Sarcastic PR';
            const timeMultiplier = categoryTimeMultipliers[prCategory] || 1.0;
            
            if (impactedSections > 0) {
                // Use section-based estimation
                estimatedTime = impactedSections * estimatedHoursPerSection * timeMultiplier;
                console.log(`[API] Estimated time: ${impactedSections} sections × ${estimatedHoursPerSection}h × ${timeMultiplier} (${prCategory}) = ${Math.round(estimatedTime * 10) / 10}h`);
            } else {
                // Fallback to test case-based estimation
                estimatedTime = totalTests * (config.timeEstimation.medium / 60); // Convert to hours
                console.log(`[API] Fallback estimation: ${totalTests} test cases × ${config.timeEstimation.medium / 60}h = ${Math.round(estimatedTime * 10) / 10}h`);
            }
            
            console.log(`[API] Total test cases: ${totalTests}, Impacted sections: ${impactedSections}, Estimated time: ${Math.round(estimatedTime * 10) / 10}h`);
        } catch (err) {
            console.error('[API] Error fetching test cases or regression tests:', err.message);
            // Leave testCases and regressionTests as empty arrays, totalTests and estimatedTime as 0
        }

        // ALWAYS generate AI-suggested test scenarios using application context
        console.log('[API] Generating AI-powered test scenarios from application context...');
        const functionalAreas = testRailService.mapFilesToFunctionalAreas(prDetails.files);
        const suggestedScenarios = await aiService.generateSuggestedTestScenarios(
            prDetails,
            components,
            keywords,
            functionalAreas
        );

        res.json({
            success: true,
            pr: {
                title: prDetails.title,
                author: prDetails.author,
                category: prDetails.analysis.category,
                emoji: prDetails.analysis.emoji,
                filesChanged: prDetails.filesChanged,
                files: prDetails.files
            },
            analysis: {
                riskScore: prDetails.analysis.riskScore,
                riskLevel: prDetails.analysis.riskLevel,
                metrics: prDetails.analysis.metrics
            },
            components,
            impactAnalysis,
            testCases: {
                impacted: testCases,
                regression: regressionTests,
                suggested: suggestedScenarios,
                total: totalTests,
                // NEW: Grouped impacted test cases by module/component
                grouped: impactedTestCases ? impactedTestCases.groupedByModule : {},
                byPriority: impactedTestCases ? {
                    directJiraMatch: impactedTestCases.directJiraMatch,
                    componentMatch: impactedTestCases.componentMatch,
                    componentWithKeywords: impactedTestCases.componentWithKeywords
                } : null
            },
            estimation: {
                totalTestCases: totalTests,
                estimatedHours: Math.round(estimatedTime * 10) / 10,
                impactedSections: impactedTestCases ? Object.keys(impactedTestCases.groupedByModule).length : 0,
                prCategory: prDetails.analysis.category
            },
            linkedPRs
        });
    } catch (error) {
        console.error('[API] Error analyzing PR:', error);
        // Always return PR details if available, even if error occurs after PR analysis
        if (typeof prDetails !== 'undefined') {
            res.json({
                success: true,
                pr: {
                    title: prDetails.title,
                    author: prDetails.author,
                    category: prDetails.analysis.category,
                    emoji: prDetails.analysis.emoji,
                    filesChanged: prDetails.filesChanged,
                    files: prDetails.files
                },
                analysis: {
                    riskScore: prDetails.analysis.riskScore,
                    riskLevel: prDetails.analysis.riskLevel,
                    metrics: prDetails.analysis.metrics
                },
                components: [],
                impactAnalysis: {},
                testCases: {
                    impacted: [],
                    regression: [],
                    total: 0
                },
                estimation: {
                    totalTestCases: 0,
                    estimatedHours: 0
                },
                linkedPRs: []
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
});

/**
 * ============================================================
 * GENERATE BUG REPORT
 * ============================================================
 * 
 * POST /api/generate-bug-report
 * 
 * Body:
 * {
 *   description: "Brief bug description..."
 * }
 */
app.post('/api/generate-bug-report', async (req, res) => {
    try {
        const { description } = req.body;
        
        if (!description) {
            return res.status(400).json({
                success: false,
                error: 'Bug description is required'
            });
        }
        
        // ...existing code...
        
        const bugReport = await aiService.generateBugReport(description);
        
        res.json({
            success: true,
            bugReport
        });
        
    } catch (error) {
        console.error('[API] Error generating bug report:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ============================================================
 * CONFIGURATION ENDPOINTS
 * ============================================================
 */

/**
 * Get current configuration (sanitized, no credentials)
 */
app.get('/api/config', (req, res) => {
    res.json({
        jira: {
            baseUrl: config.jira.baseUrl,
            configured: !!config.jira.apiToken
        },
        bitbucket: {
            baseUrl: config.bitbucket.baseUrl,
            configured: !!config.bitbucket.password
        },
        testRail: {
            baseUrl: config.testRail.baseUrl,
            projectId: config.testRail.projectId,
            defaultSuiteId: config.testRail.defaultSuiteId,
            configured: !!config.testRail.apiKey
        },
        contextFileExists: fs.existsSync(contextFilePath)
    });
});

/**
 * Upload context file
 */
app.post('/api/config/upload-context', upload.single('contextFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        
        // ...existing code...
        
        // Reload context in AI service
        aiService.context = aiService.loadContext();
        
        res.json({
            success: true,
            message: 'Context file uploaded successfully',
            path: req.file.path
        });
    } catch (error) {
        console.error('[API] Error uploading context file:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get TestRail custom fields
 */
app.get('/api/testrail/fields', async (req, res) => {
    try {
        const fields = await testRailService.getCustomFields();
        res.json({
            success: true,
            fields
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🤖 AI TESTING COMPANION SERVER                     ║
║                                                            ║
║        Status: RUNNING                                     ║
║        Port: ${PORT}                                           ║
║        URL: http://localhost:${PORT}                           ║
║                                                            ║
║        Dashboard: http://localhost:${PORT}/                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    console.log('\n[INFO] Configuration Status:');
    console.log(`  ✓ JIRA: ${config.jira.baseUrl}`);
    console.log(`  ✓ Bitbucket: ${config.bitbucket.baseUrl}`);
    console.log(`  ✓ TestRail: ${config.testRail.baseUrl}`);
    console.log(`  ✓ Context File: ${fs.existsSync(contextFilePath) ? 'Loaded' : 'Not found'}\n`);
});

module.exports = app;
