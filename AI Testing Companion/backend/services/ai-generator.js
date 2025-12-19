/**
 * ================================================================
 * AI GENERATOR SERVICE
 * ================================================================
 * 
 * This service acts as a placeholder for AI-powered content generation.
 * 
 * NOTE FOR PLAYWRIGHT MCP:
 * This is where Playwright MCP AI capabilities should be integrated.
 * All TODO markers indicate where AI prompts should be executed.
 * 
 * The functions below provide the structure and expected return formats.
 * ================================================================
 */

const fs = require('fs');
const path = require('path');

class AIGeneratorService {
    constructor(contextFilePath) {
        this.contextFilePath = contextFilePath;
        this.context = this.loadContext();
    }

    /**
     * ============================================================
     * LOAD APPLICATION CONTEXT
     * ============================================================
     * Reads the context file that provides AI with app knowledge
     */
    loadContext() {
        try {
            if (fs.existsSync(this.contextFilePath)) {
                const context = fs.readFileSync(this.contextFilePath, 'utf-8');
                console.log('[AI] Loaded application context');
                return context;
            }
        } catch (error) {
            console.warn('[AI] Could not load context file:', error.message);
        }
        return '';
    }

    /**
     * ============================================================
     * GENERATE TEST CASES
     * ============================================================
     * 
     * TODO: PLAYWRIGHT MCP - Integrate AI here
     * 
     * This function should use AI to generate BDD test cases based on:
     * - JIRA story details (acceptance criteria, description)
     * - Application context from context file
     * - TestRail custom field requirements
     * 
     * Expected prompt structure:
     * ```
     * You are a QA expert generating test cases.
     * 
     * Application Context:
     * {this.context}
     * 
     * JIRA Stories:
     * {JSON.stringify(stories)}
     * 
     * Generate comprehensive BDD test cases covering all acceptance criteria.
     * Return as JSON array with fields: title, preconditions, steps, expected_result, etc.
     * ```
     */
    async generateTestCases(stories, suiteId) {
        console.log(`[AI] Generating test cases for ${stories.length} stories...`);
        
        // TODO: Replace with actual Playwright MCP AI call
        // This is a placeholder that creates structured test cases
        
        const testCases = [];
        
        for (const story of stories) {
            // Extract acceptance criteria
            const criteria = story.acceptanceCriteria || [];
            
            if (criteria.length === 0) {
                // Generate basic test cases from summary
                testCases.push(this.createBasicTestCase(story));
            } else {
                // Generate test case for each acceptance criterion
                criteria.forEach((criterion, index) => {
                    testCases.push(this.createTestCaseFromCriterion(story, criterion, index));
                });
            }
            
            // Add edge cases
            testCases.push(this.createEdgeCaseTest(story));
        }
        
        console.log(`[AI] Generated ${testCases.length} test cases`);
        return testCases;
    }

    /**
     * Helper: Create basic test case structure
     */
    createBasicTestCase(story) {
        return {
            title: `Verify ${story.summary}`,
            template_id: 1, // Test Case (Steps)
            type_id: 1, // Functional
            priority_id: 2, // Medium
            estimate: '10m',
            refs: story.key,
            custom_preconds: 'User is logged in\nTest data is available',
            custom_steps_separated: [
                { content: `Given the system is ready`, expected: 'System is accessible' },
                { content: `When user performs the action described in ${story.key}`, expected: 'Action completes successfully' },
                { content: `Then verify the expected outcome`, expected: 'Outcome matches requirements' }
            ],
            custom_automation_type: 0, // None
            custom_test_case_health: 1 // Good
        };
    }

    /**
     * Helper: Create test case from acceptance criterion
     */
    createTestCaseFromCriterion(story, criterion, index) {
        return {
            title: `${story.key}: ${criterion.substring(0, 80)}`,
            template_id: 1,
            type_id: 1,
            priority_id: 2,
            estimate: '15m',
            refs: story.key,
            custom_preconds: 'User has appropriate permissions\nTest environment is configured',
            custom_steps_separated: [
                { content: `Given ${criterion}`, expected: 'Precondition met' },
                { content: 'When user executes the test scenario', expected: 'Action executes successfully' },
                { content: 'Then verify acceptance criterion is satisfied', expected: 'Criterion validated' }
            ],
            custom_automation_type: 0,
            custom_test_case_health: 1
        };
    }

    /**
     * Helper: Create edge case test
     */
    createEdgeCaseTest(story) {
        return {
            title: `${story.key}: Edge Cases and Error Handling`,
            template_id: 1,
            type_id: 1,
            priority_id: 3, // Low
            estimate: '10m',
            refs: story.key,
            custom_preconds: 'Test environment configured\nError scenarios can be triggered',
            custom_steps_separated: [
                { content: 'Given invalid or edge case data', expected: 'System ready' },
                { content: 'When user attempts operation with invalid data', expected: 'System handles gracefully' },
                { content: 'Then verify appropriate error messages displayed', expected: 'User-friendly error shown' }
            ],
            custom_automation_type: 0,
            custom_test_case_health: 1
        };
    }

    /**
     * ============================================================
     * GENERATE BUG REPORT
     * ============================================================
     * 
     * TODO: PLAYWRIGHT MCP - Integrate AI here
     * 
     * This function should use AI to generate a structured bug report based on:
     * - Bug description provided by user
     * - Application context
     * - JIRA formatting requirements
     * 
     * Expected prompt structure:
     * ```
     * You are a QA expert writing bug reports.
     * 
     * Application Context:
     * {this.context}
     * 
     * Bug Description:
     * {bugDescription}
     * 
     * Generate a comprehensive bug report in JIRA format with:
     * - Impact-focused title
     * - Detailed reproduction steps
     * - Expected vs actual results
     * - User impact
     * - Retesting ideas
     * ```
     */
    async generateBugReport(bugDescription) {
        console.log('[AI] Generating bug report...');
        
        // TODO: Replace with actual Playwright MCP AI call
        // This is a placeholder that creates a structured bug report
        
        const bugReport = {
            title: `Issue: ${bugDescription.substring(0, 60)}`,
            environment: 'QA Environment\nURL: https://qa.example.com\nCredentials: test@example.com',
            description: `This bug affects the user experience by causing unexpected behavior in the application.`,
            stepsToReproduce: [
                '1. Navigate to the affected page',
                '2. Perform the action that triggers the bug',
                '3. Observe the unexpected behavior'
            ],
            actualResult: 'The system behaves unexpectedly as described in the bug description.',
            expectedResult: 'The system should behave according to the specified requirements.',
            userImpact: 'This issue impacts users by preventing them from completing their intended task.',
            retestingIdeas: [
                'Verify fix with different user roles',
                'Test edge cases around the fixed functionality',
                'Confirm no regression in related features'
            ]
        };
        
        // Format as JIRA markup
        const jiraFormatted = this.formatBugReportForJira(bugReport);
        
        return {
            ...bugReport,
            jiraFormatted
        };
    }

    /**
     * Format bug report in JIRA markup syntax
     */
    formatBugReportForJira(report) {
        return `h3. 🐛 ${report.title}

*Test Environment Details:*
{code}
${report.environment}
{code}

*Bug Description:*
${report.description}

*Detailed Steps to Reproduce:*
${report.stepsToReproduce.join('\n')}

*Actual Result:*
${report.actualResult}

*Expected Result:*
${report.expectedResult}

*Impact to User:*
${report.userImpact}

*Bug Re-Testing Ideas:*
${report.retestingIdeas.map(idea => `* ${idea}`).join('\n')}`;
    }

    /**
     * ============================================================
     * GENERATE IMPACT ANALYSIS
     * ============================================================
     * 
     * TODO: PLAYWRIGHT MCP - Integrate AI here
     * 
     * Analyzes PR changes and suggests what to test
     */
    async generateImpactAnalysis(prDetails, components, files) {
        console.log('[AI] Generating impact analysis...');
        
        const impacts = [];
        
        // Group files by component/feature (avoid "Other" label)
        const filesByComponent = {};
        
        files.forEach(file => {
            const path = file.path || '';
            let matchedComponent = null;
            
            // Try to match to a provided component first
            for (const comp of components) {
                if (path.toLowerCase().includes(comp.toLowerCase())) {
                    matchedComponent = comp;
                    break;
                }
            }
            
            // If no component match, infer from file path structure
            if (!matchedComponent) {
                const pathParts = path.split('/');
                // Look for recognizable feature/module names in path
                for (const part of pathParts) {
                    if (part.length > 3 && !['src', 'app', 'lib', 'dist', 'test', 'tests'].includes(part.toLowerCase())) {
                        matchedComponent = part.charAt(0).toUpperCase() + part.slice(1);
                        break;
                    }
                }
            }
            
            // Fallback: use filename without extension as component
            if (!matchedComponent) {
                const filename = path.split('/').pop().split('.')[0];
                matchedComponent = filename.charAt(0).toUpperCase() + filename.slice(1).replace(/[-_]/g, ' ');
            }
            
            if (!filesByComponent[matchedComponent]) {
                filesByComponent[matchedComponent] = [];
            }
            filesByComponent[matchedComponent].push(file);
        });
        
        // Generate impact for each component with risk categorization
        Object.keys(filesByComponent).forEach(component => {
            const componentFiles = filesByComponent[component];
            const fileTypes = new Set();
            const riskCategories = [];
            const hasTests = componentFiles.some(f => 
                f.path.includes('.spec.') || 
                f.path.includes('.test.') || 
                f.path.includes('test/')
            );
            
            // Map file types to risk categories
            componentFiles.forEach(f => {
                const path = f.path.toLowerCase();
                
                // UI Rendering risk
                if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.less') || path.endsWith('.scss')) {
                    fileTypes.add('ui');
                    if (!riskCategories.includes('UI Rendering')) {
                        riskCategories.push('UI Rendering');
                    }
                }
                
                // Component Logic & Data Flow risk
                if (path.endsWith('.ts') || path.endsWith('.tsx')) {
                    fileTypes.add('logic');
                    if (!riskCategories.includes('Component Logic & Data Flow')) {
                        riskCategories.push('Component Logic & Data Flow');
                    }
                }
                
                // Backend/API risk
                if (path.includes('service') || path.includes('api') || path.includes('controller')) {
                    if (!riskCategories.includes('API & Backend Services')) {
                        riskCategories.push('API & Backend Services');
                    }
                }
                
                // Database/Schema risk
                if (path.includes('model') || path.includes('schema') || path.includes('migration')) {
                    if (!riskCategories.includes('Data & Database')) {
                        riskCategories.push('Data & Database');
                    }
                }
                
                // Configuration risk
                if (path.endsWith('.json') || path.endsWith('.xml') || path.includes('config')) {
                    fileTypes.add('config');
                    if (!riskCategories.includes('Configuration')) {
                        riskCategories.push('Configuration');
                    }
                }
            });
            
            const suggestions = [];
            const fileNames = componentFiles.map(f => f.path.split('/').pop()).slice(0, 3).join(', ');
            const moreFiles = componentFiles.length > 3 ? ` and ${componentFiles.length - 3} more` : '';
            
            // Generate prioritized test recommendations
            if (fileTypes.has('logic')) {
                suggestions.push({ priority: 'High', test: `Verify component logic and state management in ${component}` });
                suggestions.push({ priority: 'High', test: `Test data flow and business rules` });
            }
            if (fileTypes.has('ui')) {
                suggestions.push({ priority: 'Medium', test: `Check UI rendering across different browsers` });
                suggestions.push({ priority: 'Medium', test: `Verify responsive design and styling` });
            }
            if (fileTypes.has('config')) {
                suggestions.push({ priority: 'High', test: `Validate configuration changes don't break functionality` });
            }
            if (componentFiles.length > 5) {
                suggestions.push({ priority: 'High', test: `Integration testing required - multiple files changed` });
            }
            
            // Quality signals
            const qualitySignals = [];
            if (!hasTests) {
                qualitySignals.push('⚠️ No test files modified - test coverage may be affected');
            } else {
                qualitySignals.push('✓ Test files included in PR');
            }
            
            // Determine risk level based on file types and count
            let riskLevel = 'Medium';
            if (componentFiles.length > 10 || (fileTypes.has('logic') && !hasTests)) {
                riskLevel = 'High';
            } else if (componentFiles.length <= 2 && hasTests) {
                riskLevel = 'Low';
            }
            
            impacts.push({
                component,
                risk: riskLevel,
                reason: `${riskCategories.join(', ')} - ${componentFiles.length} file(s): ${fileNames}${moreFiles}`,
                testingSuggestions: suggestions.slice(0, 4).map(s => `[${s.priority}] ${s.test}`),
                qualitySignals,
                riskCategories
            });
        });
        
        // Calculate overall risk and confidence
        const highRiskCount = impacts.filter(i => i.risk === 'High').length;
        const totalImpacts = impacts.length;
        const overallRisk = highRiskCount > totalImpacts / 2 ? 'High' : (highRiskCount > 0 ? 'Medium' : 'Low');
        const confidence = files.length > 5 ? 'High' : (files.length > 2 ? 'Medium' : 'Low');
        
        // Add summary impact
        impacts.push({
            component: '📊 Overall Assessment',
            risk: overallRisk,
            reason: `${totalImpacts} component(s) affected with ${highRiskCount} high-risk area(s)`,
            testingSuggestions: [
                `Overall Risk Level: ${overallRisk}`,
                `Confidence: ${confidence} (based on ${files.length} changed files)`,
                `Recommendation: ${overallRisk === 'High' ? 'Thorough testing required' : 'Standard regression testing'}`
            ],
            qualitySignals: [],
            riskCategories: []
        });
        
        return impacts;
    }

    /**
     * ============================================================
     * GENERATE SUGGESTED TEST SCENARIOS
     * ============================================================
     * Reads application context file and generates intelligent test scenarios
     * based on PR changes and application knowledge
     */
    async generateSuggestedTestScenarios(prDetails, components, keywords, functionalAreas) {
        console.log('[AI] Generating AI-powered test scenarios using application context...');
        
        const scenarios = [];
        const prTitle = prDetails.title || '';
        const prDescription = prDetails.description || '';
        const files = prDetails.files || [];
        
        // Extract context from PR title and description
        const titleLower = prTitle.toLowerCase();
        const isBugFix = titleLower.includes('fix') || titleLower.includes('bug');
        const isFeature = titleLower.includes('feat') || titleLower.includes('feature');
        
        // Parse application context to understand what this app does
        const contextInsights = this.parseContextForScenarios(this.context, prTitle, files);
        
        console.log('[AI] Context insights:', contextInsights);
        
        // Strategy 1: Generate scenarios from application context understanding
        if (contextInsights.relevantModules.length > 0) {
            contextInsights.relevantModules.forEach(module => {
                scenarios.push({
                    title: module.testScenario,
                    type: isBugFix ? 'Regression Test' : 'Functional Test',
                    priority: module.priority,
                    description: module.description,
                    suggestedBy: 'AI - Application Context Analysis'
                });
            });
        }
        
        // Strategy 2: PR title analysis for specific features
        const prElements = this.extractPRElements(prTitle, prDescription);
        prElements.forEach(element => {
            scenarios.push({
                title: element.testScenario,
                type: element.testType,
                priority: 'High',
                description: element.description,
                suggestedBy: 'AI - PR Title Analysis'
            });
        });
        
        // Strategy 3: File-based intelligent scenarios
        const filePaths = files.map(f => f.path.toLowerCase());
        
        // Detect component/module from file paths
        if (filePaths.some(p => p.includes('webform'))) {
            scenarios.push({
                title: 'Verify webform submission with all required fields completed',
                type: 'Functional Test',
                priority: 'Critical',
                description: 'Test that webform can be submitted successfully when all mandatory fields are filled',
                suggestedBy: 'AI - File Path Analysis (webform)'
            });
            
            scenarios.push({
                title: 'Verify webform validation prevents submission with incomplete data',
                type: 'Negative Test',
                priority: 'High',
                description: 'Test that submit button remains disabled or shows error when required fields are empty',
                suggestedBy: 'AI - File Path Analysis (webform)'
            });
            
            if (isBugFix && titleLower.includes('submit')) {
                scenarios.push({
                    title: 'Regression: Submit button state management in webform',
                    type: 'Regression Test',
                    priority: 'Critical',
                    description: 'Verify submit button is properly enabled/disabled based on form validation status',
                    suggestedBy: 'AI - Bug Fix Pattern (submit button)'
                });
            }
        }
        
        if (filePaths.some(p => p.includes('questionnaire'))) {
            scenarios.push({
                title: 'Verify questionnaire navigation and progress tracking',
                type: 'Functional Test',
                priority: 'High',
                description: 'Test that users can navigate through questionnaire sections and progress is saved',
                suggestedBy: 'AI - File Path Analysis (questionnaire)'
            });
            
            scenarios.push({
                title: 'Verify questionnaire data persistence across sessions',
                type: 'Functional Test',
                priority: 'Medium',
                description: 'Test that questionnaire answers are saved and restored if user leaves and returns',
                suggestedBy: 'AI - File Path Analysis (questionnaire)'
            });
        }
        
        if (filePaths.some(p => p.includes('applicant'))) {
            scenarios.push({
                title: 'Verify applicant can complete and submit required forms',
                type: 'E2E Test',
                priority: 'Critical',
                description: 'End-to-end test of applicant filling and submitting forms in the investigation process',
                suggestedBy: 'AI - Application Module (Applicant)'
            });
        }
        
        // Strategy 4: File type-based scenarios
        const hasHTMLChanges = files.some(f => f.path.toLowerCase().endsWith('.html'));
        const hasTSChanges = files.some(f => f.path.toLowerCase().endsWith('.ts') || f.path.toLowerCase().endsWith('.js'));
        
        if (hasHTMLChanges && hasTSChanges) {
            scenarios.push({
                title: 'Integration test: UI and business logic changes',
                type: 'Integration Test',
                priority: 'High',
                description: 'Test the interaction between UI changes and corresponding business logic updates',
                suggestedBy: 'AI - File Type Analysis (HTML + TS)'
            });
        }
        
        // Limit to 10 unique scenarios
        const uniqueScenarios = [];
        const seenTitles = new Set();
        
        for (const scenario of scenarios) {
            const normalizedTitle = scenario.title.toLowerCase();
            if (!seenTitles.has(normalizedTitle) && uniqueScenarios.length < 10) {
                seenTitles.add(normalizedTitle);
                uniqueScenarios.push(scenario);
            }
        }
        
        console.log(`[AI] Generated ${uniqueScenarios.length} AI-powered test scenarios`);
        return uniqueScenarios;
    }
    
    /**
     * ============================================================
     * PARSE CONTEXT FOR SCENARIOS
     * ============================================================
     * Intelligently parses application context to generate relevant scenarios
     */
    parseContextForScenarios(context, prTitle, files) {
        const insights = {
            relevantModules: [],
            workflows: [],
            integrations: []
        };
        
        if (!context) return insights;
        
        const contextLower = context.toLowerCase();
        const titleLower = (prTitle || '').toLowerCase();
        const filePaths = files.map(f => f.path.toLowerCase()).join(' ');
        
        // Match PR to application modules from context
        if (filePaths.includes('webform') || filePaths.includes('questionnaire')) {
            if (contextLower.includes('phs') && contextLower.includes('form')) {
                insights.relevantModules.push({
                    name: 'PHS Forms',
                    testScenario: 'Verify PHS form submission workflow for applicants',
                    priority: 'Critical',
                    description: 'Test complete PHS form filling, validation, and submission process including digital signature'
                });
                
                insights.relevantModules.push({
                    name: 'PHS Form Validation',
                    testScenario: 'Verify required field validation in PHS questionnaire modules',
                    priority: 'High',
                    description: 'Test that system properly validates required vs optional fields before allowing submission'
                });
            }
            
            if (contextLower.includes('applicant')) {
                insights.relevantModules.push({
                    name: 'Applicant Submission',
                    testScenario: 'Verify applicant can submit investigation forms with proper validation',
                    priority: 'Critical',
                    description: 'Test applicant workflow: fill forms, validate fields, upload documents, and submit for investigation'
                });
            }
        }
        
        if (filePaths.includes('applicant')) {
            insights.relevantModules.push({
                name: 'Applicant Management',
                testScenario: 'Verify investigation status updates after applicant form submission',
                priority: 'High',
                description: 'Test that application status changes correctly when applicant completes and submits forms'
            });
        }
        
        if (titleLower.includes('button') || titleLower.includes('submit')) {
            insights.relevantModules.push({
                name: 'Form Controls',
                testScenario: 'Verify submit button enable/disable logic based on form validity',
                priority: 'Critical',
                description: 'Test that submit button is disabled when form is incomplete and enabled only when all required data is provided'
            });
        }
        
        return insights;
    }
    
    /**
     * ============================================================
     * EXTRACT PR ELEMENTS
     * ============================================================
     * Extracts specific UI elements and behaviors from PR title
     */
    extractPRElements(prTitle, prDescription) {
        const elements = [];
        const titleLower = (prTitle || '').toLowerCase();
        const descLower = (prDescription || '').toLowerCase();
        const combined = `${titleLower} ${descLower}`;
        
        // Submit button scenarios
        if (combined.includes('submit') && combined.includes('button')) {
            if (combined.includes('always') || combined.includes('enabled') || combined.includes('available')) {
                elements.push({
                    testScenario: 'Verify submit button is disabled when form validation fails',
                    testType: 'Negative Test',
                    description: 'Test that submit button cannot be clicked when required fields are empty or invalid'
                });
                
                elements.push({
                    testScenario: 'Verify submit button becomes enabled after all validations pass',
                    testType: 'Functional Test',
                    description: 'Test that submit button is enabled only when form passes all validation rules'
                });
            }
        }
        
        // Form validation scenarios
        if (combined.includes('form') || combined.includes('questionnaire')) {
            elements.push({
                testScenario: 'Verify client-side form validation before submission',
                testType: 'Functional Test',
                description: 'Test that form validates all fields on client-side before allowing submission'
            });
        }
        
        // Component-specific scenarios
        if (combined.includes('webform')) {
            elements.push({
                testScenario: 'Verify webform renders correctly with all required fields',
                testType: 'UI Test',
                description: 'Test that webform displays all expected fields, labels, and validation messages'
            });
        }
        
        return elements;
    }
}

module.exports = AIGeneratorService;
