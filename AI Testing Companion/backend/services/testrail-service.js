/**
 * ================================================================
 * TESTRAIL SERVICE
 * ================================================================
 * 
 * Handles all TestRail API interactions including:
 * - Creating and managing test cases
 * - Fetching test suites and sections
 * - Searching for test cases
 * - Managing custom fields
 * 
 * API Documentation: https://www.gurock.com/testrail/docs/api
 * ================================================================
 */

const axios = require('axios');

class TestRailService {
    constructor(config) {
        this.config = config.testRail;
        this.client = axios.create({
            baseURL: `${this.config.baseUrl}/index.php?/api/v2`,
            auth: {
                username: this.config.username,
                password: this.config.apiKey
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * ============================================================
     * GET CUSTOM FIELDS
     * ============================================================
     * Fetches all custom fields for test cases
     */
    async getCustomFields() {
        try {
            console.log('[TESTRAIL] Fetching custom fields...');
            const response = await this.client.get('/get_case_fields');
            return response.data;
        } catch (error) {
            console.error('[TESTRAIL] Error fetching custom fields:', error.message);
            throw new Error(`Failed to fetch TestRail custom fields: ${error.message}`);
        }
    }

    /**
     * ============================================================
     * GET OR CREATE SECTION
     * ============================================================
     * Gets section ID or creates new section if it doesn't exist
     */
    async getOrCreateSection(suiteId, sectionName) {
        try {
            console.log(`[TESTRAIL] Looking for section "${sectionName}" in suite ${suiteId}...`);
            
            // Get all sections in the suite
            const response = await this.client.get(`/get_sections/${this.config.projectId}&suite_id=${suiteId}`);
            const sections = Array.isArray(response.data) ? response.data : (response.data.sections || []);
            
            // Look for existing section (case-insensitive)
            const existing = sections.find(s => 
                s.name.toLowerCase() === sectionName.toLowerCase()
            );
            
            if (existing) {
                console.log(`[TESTRAIL] Found existing section: ${existing.id}`);
                return existing.id;
            }
            
            // Create new section
            console.log(`[TESTRAIL] Creating new section "${sectionName}"...`);
            const createResponse = await this.client.post(`/add_section/${this.config.projectId}`, {
                suite_id: suiteId,
                name: sectionName,
                description: `Auto-created by AI Testing Companion on ${new Date().toLocaleDateString()}`
            });
            
            console.log(`[TESTRAIL] Created section: ${createResponse.data.id}`);
            return createResponse.data.id;
        } catch (error) {
            console.error('[TESTRAIL] Error with section:', error.message);
            throw new Error(`Failed to get/create section: ${error.message}`);
        }
    }

    /**
     * ============================================================
     * SEARCH TEST CASES
     * ============================================================
     * Searches for test cases by various criteria
     */
    async searchTestCases(suiteId, criteria = {}) {
        try {
            console.log(`[TESTRAIL] Searching test cases in suite ${suiteId}...`);
            console.log(`[TESTRAIL] Search criteria:`, JSON.stringify(criteria, null, 2));
            
            const response = await this.client.get(`/get_cases/${this.config.projectId}&suite_id=${suiteId}`);
            let cases = Array.isArray(response.data.cases) ? response.data.cases : (Array.isArray(response.data) ? response.data : []);
            
            console.log(`[TESTRAIL] Total test cases in suite: ${cases.length}`);
            
            // Collect all search terms
            const searchTerms = [];
            
            if (criteria.components && criteria.components.length > 0) {
                criteria.components.forEach(comp => {
                    // Always include the full, lowercased component name
                    if (comp && comp.length > 2) searchTerms.push(comp.toLowerCase());
                    // Split on whitespace, hyphens, underscores, and camelCase/PascalCase
                    const words = comp
                        .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase/PascalCase
                        .replace(/[\s_-]+/g, ' ') // whitespace, hyphens, underscores
                        .split(' ');
                    words.forEach(word => {
                        if (word.length > 2) searchTerms.push(word.toLowerCase());
                    });
                });
            }
            
            if (criteria.keywords && criteria.keywords.length > 0) {
                criteria.keywords.forEach(kw => {
                    // Split multi-word keywords
                    kw.split(/\s+/).forEach(word => {
                        if (word.length > 2) searchTerms.push(word.toLowerCase());
                    });
                });
            }
            
            console.log(`[TESTRAIL] Search terms:`, searchTerms);
            
            // Score-based matching for better relevance
            const scoredCases = [];
            
            cases.forEach(testCase => {
                const title = (testCase.title || '').toLowerCase();
                const refs = (testCase.refs || '').toLowerCase();
                const customFields = JSON.stringify(testCase.custom_fields || {}).toLowerCase();
                const searchText = `${title} ${refs} ${customFields}`;
                
                let score = 0;
                let matchedTerms = [];
                
                // Check JIRA reference first (highest priority)
                if (criteria.jiraId && refs.includes(criteria.jiraId.toLowerCase())) {
                    score += 100;
                    matchedTerms.push(`JIRA:${criteria.jiraId}`);
                }
                
                // Check each search term
                searchTerms.forEach(term => {
                    if (title.includes(term)) {
                        score += 10; // Title match is high priority
                        matchedTerms.push(term);
                    } else if (searchText.includes(term)) {
                        score += 3; // Other field match is lower priority
                        matchedTerms.push(term);
                    }
                });
                
                if (score > 0) {
                    scoredCases.push({
                        testCase,
                        score,
                        matchedTerms
                    });
                }
            });
            
            // Sort by score descending
            scoredCases.sort((a, b) => b.score - a.score);
            
            console.log(`[TESTRAIL] Found ${scoredCases.length} matching test cases`);
            if (scoredCases.length > 0) {
                console.log(`[TESTRAIL] Top matches:`);
                scoredCases.slice(0, 5).forEach((sc, idx) => {
                    console.log(`[TESTRAIL]   ${idx + 1}. [Score: ${sc.score}] ${sc.testCase.title} (matched: ${sc.matchedTerms.join(', ')})`);
                });
            }
            
            return scoredCases.map(sc => sc.testCase);
        } catch (error) {
            console.error('[TESTRAIL] Error searching test cases:', error.message);
            throw new Error(`Failed to search test cases: ${error.message}`);
        }
    }

    /**
     * ============================================================
     * GET REGRESSION TEST CASES
     * ============================================================
     * Fetches test cases marked as regression tests
     */
    async getRegressionTestCases(suiteId, method = 'folder', keyword = 'Regression') {
        try {
            console.log(`[TESTRAIL] Fetching regression test cases (method: ${method}, keyword: "${keyword}")...`);
            
            // FIRST: Get section hierarchy for path enrichment
            console.log(`[TESTRAIL] Fetching section hierarchy...`);
            const sectionsWithPaths = await this.getSectionsWithHierarchy(suiteId);
            const sectionPathMap = new Map(sectionsWithPaths.map(s => [s.id, s.path]));
            console.log(`[TESTRAIL] Built section path map with ${sectionPathMap.size} sections`);
            
            if (sectionsWithPaths.length > 0) {
                console.log(`[TESTRAIL] Sample section paths:`, sectionsWithPaths.slice(0, 5).map(s => s.path));
            }
            
            if (method === 'folder') {
                // Get all sections and filter by folder name
                const sections = sectionsWithPaths;
                
                console.log(`[TESTRAIL] Total sections in suite: ${sections.length}`);
                console.log(`[TESTRAIL] Looking for sections with keyword: "${keyword}"`);
                
                const regressionSections = sections.filter(s => {
                    const nameMatch = s.name.toLowerCase().includes(keyword.toLowerCase()) ||
                                     (s.path && s.path.toLowerCase().includes(keyword.toLowerCase()));
                    if (nameMatch) {
                        console.log(`[TESTRAIL] Found regression section: ${s.path || s.name} (ID: ${s.id})`);
                    }
                    return nameMatch;
                });
                
                console.log(`[TESTRAIL] Found ${regressionSections.length} regression sections`);
                
                // If no regression sections found, return all test cases with section path enrichment
                if (regressionSections.length === 0) {
                    console.log(`[TESTRAIL] No sections with "${keyword}" in name.`);
                    console.log(`[TESTRAIL] Strategy: Return ALL test cases with section path enrichment for intelligent scoring`);
                    const response = await this.client.get(`/get_cases/${this.config.projectId}&suite_id=${suiteId}`);
                    const allCases = Array.isArray(response.data) ? response.data : (response.data.cases || []);
                    
                    console.log(`[TESTRAIL] Total test cases in suite: ${allCases.length}`);
                    
                    // Enrich ALL test cases with section paths
                    allCases.forEach(tc => {
                        if (tc.section_id && sectionPathMap.has(tc.section_id)) {
                            tc.sectionPath = sectionPathMap.get(tc.section_id);
                        }
                    });
                    
                    const enrichedCount = allCases.filter(tc => tc.sectionPath).length;
                    console.log(`[TESTRAIL] Enriched ${enrichedCount} test cases with section paths`);
                    
                    return allCases;
                }
                
                // Get test cases from regression sections
                const allCases = [];
                for (const section of regressionSections) {
                    const casesResponse = await this.client.get(`/get_cases/${this.config.projectId}&suite_id=${suiteId}&section_id=${section.id}`);
                    const cases = Array.isArray(casesResponse.data) ? casesResponse.data : (casesResponse.data.cases || []);
                    console.log(`[TESTRAIL] Section "${section.path || section.name}" has ${cases.length} test cases`);
                    
                    // Enrich each test case with section path
                    cases.forEach(tc => {
                        tc.sectionPath = section.path || section.name;
                    });
                    
                    allCases.push(...cases);
                }
                
                console.log(`[TESTRAIL] Total regression tests fetched: ${allCases.length}`);
                return allCases;
            } else {
                // Method: field - filter by custom field
                const response = await this.client.get(`/get_cases/${this.config.projectId}&suite_id=${suiteId}`);
                const cases = Array.isArray(response.data) ? response.data : (response.data.cases || []);
                
                // Enrich with section paths
                cases.forEach(tc => {
                    if (tc.section_id && sectionPathMap.has(tc.section_id)) {
                        tc.sectionPath = sectionPathMap.get(tc.section_id);
                    }
                });
                
                return cases;
            }
        } catch (error) {
            console.error('[TESTRAIL] Error fetching regression tests:', error.message);
            return [];
        }
    }

    /**
     * ============================================================
     * SCORE REGRESSION TESTS FOR RELEVANCE
     * ============================================================
     * Scores regression tests 0-100 based on relevance to changed files
     * Returns only the most relevant tests (score >= 30, top 10-20)
     */
    async scoreRegressionTestsForRelevance(regressionTests, changedFiles, components, keywords, prTitle = '', prDescription = '') {
        console.log(`\n[TESTRAIL] ==================== SCORING REGRESSION TESTS ====================`);
        console.log(`[TESTRAIL] Total tests to score: ${regressionTests.length}`);
        console.log(`[TESTRAIL] Changed files (${changedFiles.length}):`, changedFiles.map(f => f.path));
        console.log(`[TESTRAIL] Components extracted:`, components);
        console.log(`[TESTRAIL] Keywords extracted:`, keywords);
        console.log(`[TESTRAIL] PR Title:`, prTitle);
        
        // Check section path enrichment
        const testsWithSectionPath = regressionTests.filter(t => t.sectionPath);
        console.log(`[TESTRAIL] Tests with section paths: ${testsWithSectionPath.length}/${regressionTests.length}`);
        if (testsWithSectionPath.length > 0) {
            console.log(`[TESTRAIL] Sample section paths:`, testsWithSectionPath.slice(0, 3).map(t => `"${t.sectionPath}"`));
        }
        
        // Map file paths to functional areas
        const functionalAreas = this.mapFilesToFunctionalAreas(changedFiles);
        console.log(`[TESTRAIL] Identified functional areas:`, functionalAreas);
        
        // Check if shared/core components are impacted
        const hasSharedComponentImpact = changedFiles.some(f => {
            const path = f.path.toLowerCase();
            return path.includes('shared') || path.includes('core') || 
                   path.includes('common') || path.includes('utils') ||
                   path.includes('service') || path.includes('api');
        });
        
        // Extract PR context for advanced scoring
        const prContext = this.extractPRContext(prTitle, prDescription, changedFiles);
        console.log(`[TESTRAIL] PR Context:`, JSON.stringify(prContext, null, 2));
        
        const scoredTests = [];
        let debugCount = 0;
        
        regressionTests.forEach((testCase, idx) => {
            const title = (testCase.title || '').toLowerCase();
            const refs = (testCase.refs || '').toLowerCase();
            const customFields = JSON.stringify(testCase.custom_fields || {}).toLowerCase();
            const searchText = `${title} ${refs} ${customFields}`;
            const sectionPath = (testCase.sectionPath || '').toLowerCase();
            
            let score = 0;
            const matchDetails = [];
            
            // Debug first 3 test cases
            const showDebug = debugCount < 3;
            if (showDebug) {
                console.log(`\n[TESTRAIL] --- Test Case #${idx + 1} ---`);
                console.log(`[TESTRAIL] Title: ${testCase.title}`);
                console.log(`[TESTRAIL] Section: ${testCase.sectionPath || 'NOT SET'}`);
                debugCount++;
            }
            
            // 1. Section Path Matching (MOST IMPORTANT: +30-50 points)
            if (testCase.sectionPath) {
                const pathParts = sectionPath.split(' > ').map(p => p.trim());
                
                // Component match in section path
                components.forEach(comp => {
                    if (pathParts.some(part => part.includes(comp.toLowerCase()))) {
                        score += 35;
                        matchDetails.push(`Section has component: ${comp}`);
                        if (showDebug) console.log(`[TESTRAIL]   ✓ Section component match: ${comp} (+35)`);
                    }
                });
                
                // Functional area match in section path
                functionalAreas.forEach(area => {
                    if (pathParts.some(part => part.includes(area.toLowerCase()))) {
                        score += 30;
                        matchDetails.push(`Section has area: ${area}`);
                        if (showDebug) console.log(`[TESTRAIL]   ✓ Section area match: ${area} (+30)`);
                    }
                });
                
                // File name match in section path
                changedFiles.forEach(file => {
                    const fileName = file.path.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
                    if (fileName.length > 3 && pathParts.some(part => part.includes(fileName))) {
                        score += 25;
                        matchDetails.push(`Section has file: ${fileName}`);
                        if (showDebug) console.log(`[TESTRAIL]   ✓ Section file match: ${fileName} (+25)`);
                    }
                });
                
                // Keyword match in section path
                keywords.forEach(kw => {
                    if (pathParts.some(part => part.includes(kw.toLowerCase()))) {
                        score += 20;
                        matchDetails.push(`Section has keyword: ${kw}`);
                        if (showDebug) console.log(`[TESTRAIL]   ✓ Section keyword match: ${kw} (+20)`);
                    }
                });
            } else if (showDebug) {
                console.log(`[TESTRAIL]   ⚠️  No section path - missing important matching criteria`);
            }
            
            // 2. Title - Direct feature/area match (HIGH: +40 points)
            functionalAreas.forEach(area => {
                if (title.includes(area.toLowerCase())) {
                    score += 40;
                    matchDetails.push(`Title has feature: ${area}`);
                    if (showDebug) console.log(`[TESTRAIL]   ✓ Title feature match: ${area} (+40)`);
                }
            });
            
            // 3. Title - Component match (HIGH: +30 points)
            components.forEach(comp => {
                const compWords = comp.toLowerCase().split(/\s+/);
                compWords.forEach(word => {
                    if (word.length > 3 && title.includes(word)) {
                        score += 30;
                        matchDetails.push(`Title has component: ${comp}`);
                        if (showDebug) console.log(`[TESTRAIL]   ✓ Title component match: ${comp} (+30)`);
                    }
                });
            });
            
            // 4. Title - Keyword match (MEDIUM: +20 points)
            keywords.forEach(kw => {
                if (title.includes(kw.toLowerCase())) {
                    score += 20;
                    matchDetails.push(`Title has keyword: ${kw}`);
                    if (showDebug) console.log(`[TESTRAIL]   ✓ Title keyword match: ${kw} (+20)`);
                }
            });
            
            // 5. File name match in title (HIGH: +35 points)
            changedFiles.forEach(file => {
                const fileName = file.path.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
                if (fileName.length > 3 && title.includes(fileName)) {
                    score += 35;
                    matchDetails.push(`Title has file: ${fileName}`);
                    if (showDebug) console.log(`[TESTRAIL]   ✓ Title file match: ${fileName} (+35)`);
                }
            });
            
            if (showDebug) {
                console.log(`[TESTRAIL]   Total score so far: ${score}`);
            }
            
            // 6. API/Screen reference match (MEDIUM: +20 points)
            const apiPatterns = ['api', 'endpoint', 'service', 'rest', 'graphql'];
            const uiPatterns = ['screen', 'page', 'view', 'component', 'modal', 'dialog'];
            
            apiPatterns.forEach(pattern => {
                if (searchText.includes(pattern)) {
                    changedFiles.forEach(file => {
                        if (file.path.toLowerCase().includes(pattern) || file.path.toLowerCase().includes('api')) {
                            score += 20;
                            matchDetails.push(`API/Service match`);
                        }
                    });
                }
            });
            
            uiPatterns.forEach(pattern => {
                if (searchText.includes(pattern)) {
                    changedFiles.forEach(file => {
                        if (file.path.toLowerCase().includes('component') || 
                            file.path.toLowerCase().includes('view') ||
                            file.path.toLowerCase().includes('.html')) {
                            score += 20;
                            matchDetails.push(`UI/Component match`);
                        }
                    });
                }
            });
            
            // 6. Critical/Smoke test bonus (ALWAYS INCLUDE if shared components impacted: +50)
            const isCritical = title.includes('smoke') || title.includes('critical') || 
                             title.includes('p0') || title.includes('p1') ||
                             (testCase.priority_id && testCase.priority_id <= 2);
            
            if (isCritical && hasSharedComponentImpact) {
                score += 50;
                matchDetails.push(`Critical/Smoke test (shared component impacted)`);
            } else if (isCritical) {
                score += 10;
                matchDetails.push(`Critical/Smoke test`);
            }
            
            // 7. Keyword match in other fields (LOW: +5 points)
            keywords.forEach(kw => {
                if (!title.includes(kw.toLowerCase()) && searchText.includes(kw.toLowerCase())) {
                    score += 5;
                    matchDetails.push(`Keyword in fields: ${kw}`);
                }
            });
            
            // 8. PR Title/Description Context Analysis (MEDIUM-HIGH: +20 to +40)
            if (prContext.uiElements.length > 0 || prContext.behaviors.length > 0) {
                let contextScore = 0;
                let contextMatches = [];
                
                // UI element match from PR title (e.g., "submit button", "dropdown", "checkbox")
                prContext.uiElements.forEach(element => {
                    if (title.includes(element)) {
                        contextScore += 20;
                        contextMatches.push(`UI element: ${element}`);
                    }
                });
                
                // Behavior match from PR title (e.g., "always available", "disabled", "validation")
                prContext.behaviors.forEach(behavior => {
                    if (title.includes(behavior)) {
                        contextScore += 15;
                        contextMatches.push(`Behavior: ${behavior}`);
                    }
                });
                
                // Both element AND behavior match (high relevance)
                if (contextMatches.length >= 2) {
                    contextScore += 20;
                    matchDetails.push(`PR context match: ${contextMatches.join(', ')} (+bonus)`);
                } else if (contextMatches.length > 0) {
                    matchDetails.push(`PR context: ${contextMatches.join(', ')}`);
                }
                
                score += Math.min(contextScore, 40);
            }
            
            // 9. Bug Fix Context (for fix/bugfix PRs) (MEDIUM: +25 to +30)
            if (prContext.isBugFix) {
                // Prioritize negative scenarios and validation tests
                const negativeScenarioKeywords = ['should not', 'prevent', 'disable', 'block', 'reject', 
                                                  'invalid', 'error', 'validation', 'verify', 'edge case'];
                const hasNegativeScenario = negativeScenarioKeywords.some(kw => title.includes(kw));
                
                if (hasNegativeScenario) {
                    score += 25;
                    matchDetails.push('Bug fix: negative scenario test');
                }
                
                // Regression test for same component
                const hasComponentMatch = components.some(comp => 
                    title.includes(comp.toLowerCase())
                );
                if (hasComponentMatch && title.includes('regression')) {
                    score += 30;
                    matchDetails.push('Bug fix: regression test for same component');
                }
            }
            
            // 10. File Type Specificity (MEDIUM: +20 to +30)
            if (prContext.fileTypes) {
                const fileTypeBonus = this.calculateFileTypeRelevance(prContext.fileTypes, title);
                if (fileTypeBonus > 0) {
                    score += fileTypeBonus;
                    matchDetails.push(`File type relevance: +${fileTypeBonus}`);
                }
            }
            
            // 11. Section Path Matching (must be at least 2 levels deep)
            if (testCase.section_id) {
                const sectionPathDepth = this.getSectionPathDepth(testCase);
                if (sectionPathDepth >= 2) {
                    // Valid section path depth
                    const sectionPathMatch = this.checkSectionPathMatch(testCase, components, functionalAreas);
                    if (sectionPathMatch.score > 0) {
                        score += sectionPathMatch.score;
                        matchDetails.push(sectionPathMatch.reason);
                    }
                } else if (sectionPathDepth === 1) {
                    // Shallow section path (e.g., just "Regression") - penalize generic tests
                    const isGenericTest = this.isGenericTest(title, components);
                    if (isGenericTest) {
                        score -= 20;
                        matchDetails.push('Generic test (shallow section) penalty: -20');
                    }
                }
            }
            
            // 12. Exclude Generic Tests (tests that only mention top-level module)
            const isGenericTest = this.isGenericTest(title, components);
            if (isGenericTest && score < 50) {
                score -= 20;
                matchDetails.push('Generic test penalty: -20');
            }
            
            // Cap score at 100
            score = Math.min(Math.max(score, 0), 100);
            
            if (score > 0) {
                scoredTests.push({
                    testCase,
                    score,
                    matchDetails
                });
            }
        });
        
        // Sort by score descending
        scoredTests.sort((a, b) => b.score - a.score);
        
        // Filter: progressively lower threshold to find relevant tests
        let threshold = 60;
        let relevantTests = scoredTests.filter(st => st.score >= threshold);
        
        // If no tests pass, progressively lower threshold
        if (relevantTests.length === 0 && scoredTests.length > 0) {
            console.log(`[TESTRAIL] No tests scored >= ${threshold}. Trying threshold 40...`);
            threshold = 40;
            relevantTests = scoredTests.filter(st => st.score >= threshold);
        }
        
        if (relevantTests.length === 0 && scoredTests.length > 0) {
            console.log(`[TESTRAIL] No tests scored >= ${threshold}. Trying threshold 25...`);
            threshold = 25;
            relevantTests = scoredTests.filter(st => st.score >= threshold);
        }
        
        if (relevantTests.length === 0 && scoredTests.length > 0) {
            console.log(`[TESTRAIL] No tests scored >= ${threshold}. Returning top 10 tests by score...`);
            relevantTests = scoredTests.slice(0, 10);
            threshold = relevantTests.length > 0 ? relevantTests[relevantTests.length - 1].score : 0;
        }
        
        console.log(`\n[TESTRAIL] ==================== SCORING SUMMARY ====================`);
        console.log(`[TESTRAIL] - Total regression tests: ${regressionTests.length}`);
        console.log(`[TESTRAIL] - Tests with any score: ${scoredTests.length}`);
        console.log(`[TESTRAIL] - Tests with score >= ${threshold}: ${relevantTests.length}`);
        console.log(`[TESTRAIL] - PR Type: ${this.determinePRType(changedFiles.length)}`);
        console.log(`[TESTRAIL] - Threshold used: ${threshold}`);
        
        if (scoredTests.length > 0 && relevantTests.length === 0) {
            console.log(`[TESTRAIL] ⚠️  All tests scored 0 - no matches found`);
            console.log(`[TESTRAIL] Top 5 test titles for reference:`);
            regressionTests.slice(0, 5).forEach((tc, idx) => {
                console.log(`[TESTRAIL]   ${idx + 1}. ${tc.title}`);
            });
        }
        
        /*if (relevantTests.length > 0) {
            console.log(`\n[TESTRAIL] Top relevant tests:`);
            relevantTests.slice(0, 10).forEach((st, idx) => {
                console.log(`[TESTRAIL]   ${idx + 1}. [Score: ${st.score}] ${st.testCase.title}`);
                console.log(`[TESTRAIL]      Section: ${st.testCase.sectionPath || 'N/A'}`);
                console.log(`[TESTRAIL]      Matches: ${st.matchDetails.join(', ')}`);
            });
        } else {
            console.log(`[TESTRAIL] ⚠️  No relevant test cases found`);
        }*/
        console.log(`[TESTRAIL] =================================================================\n`);
        
        // Determine max tests based on PR type
        const maxTests = this.getMaxTestsForPRSize(changedFiles.length);
        
        // Return top N most relevant tests based on PR size
        const topTests = relevantTests.slice(0, maxTests).map(st => ({
            ...st.testCase,
            relevanceScore: st.score,
            matchDetails: st.matchDetails
        }));
        
        console.log(`[TESTRAIL] Returning ${topTests.length} most relevant regression tests\n`);
        
        return topTests;
    }
    
    /**
     * ============================================================
     * MAP FILES TO FUNCTIONAL AREAS
     * ============================================================
     * Infers impacted functional areas from changed file paths
     */
    mapFilesToFunctionalAreas(files) {
        const areas = new Set();
        const config = require('../config');
        const componentMap = config.traceabilityMatrix?.components || {};
        // Build a tag->componentName map for fast lookup
        const tagToComponent = {};
        Object.entries(componentMap).forEach(([componentName, obj]) => {
            (obj.tags || []).forEach(tag => {
                tagToComponent[tag.toLowerCase()] = componentName;
            });
        });

        files.forEach(file => {
            const path = file.path.toLowerCase();
            // For each tag, if it appears in the path, add the component name
            Object.entries(tagToComponent).forEach(([tag, componentName]) => {
                if (path.includes(tag)) {
                    areas.add(componentName);
                }
            });
        });
        return Array.from(areas);
    }

    /**
     * ============================================================
     * EXTRACT PR CONTEXT
     * ============================================================
     * Extracts UI elements and behaviors from PR title/description
     */
    extractPRContext(prTitle, prDescription, changedFiles) {
        const context = {
            uiElements: [],
            behaviors: [],
            isBugFix: false,
            fileTypes: { html: 0, ts: 0, js: 0, css: 0, java: 0, both: false }
        };
        
        const titleLower = (prTitle || '').toLowerCase();
        const descLower = (prDescription || '').toLowerCase();
        const combined = `${titleLower} ${descLower}`;
        
        // Check if it's a bug fix
        context.isBugFix = /^fix\(|\bfix:|\bbug\b|\bbugfix\b|\bissue\b/.test(titleLower);
        
        // Extract UI elements
        const uiElementPatterns = [
            'button', 'submit', 'dropdown', 'checkbox', 'radio', 'input', 'field',
            'form', 'modal', 'dialog', 'popup', 'menu', 'tab', 'panel', 'table',
            'grid', 'list', 'card', 'link', 'icon', 'image', 'tooltip', 'notification'
        ];
        
        uiElementPatterns.forEach(element => {
            if (combined.includes(element)) {
                context.uiElements.push(element);
            }
        });
        
        // Extract behaviors
        const behaviorPatterns = [
            'always available', 'always visible', 'always enabled', 'disabled', 'enabled',
            'hidden', 'visible', 'validation', 'required', 'optional', 'mandatory',
            'editable', 'readonly', 'clickable', 'selectable', 'expandable', 'collapsible',
            'loading', 'error', 'success', 'warning', 'submitted', 'saved', 'deleted'
        ];
        
        behaviorPatterns.forEach(behavior => {
            if (combined.includes(behavior)) {
                context.behaviors.push(behavior);
            }
        });
        
        // Analyze file types
        changedFiles.forEach(file => {
            const path = file.path.toLowerCase();
            if (path.endsWith('.html') || path.endsWith('.htm')) context.fileTypes.html++;
            if (path.endsWith('.ts')) context.fileTypes.ts++;
            if (path.endsWith('.js') || path.endsWith('.jsx')) context.fileTypes.js++;
            if (path.endsWith('.css') || path.endsWith('.scss') || path.endsWith('.sass')) context.fileTypes.css++;
            if (path.endsWith('.java')) context.fileTypes.java++;
        });
        
        // Check if both UI and logic files changed
        context.fileTypes.both = (context.fileTypes.html > 0 && 
            (context.fileTypes.ts > 0 || context.fileTypes.js > 0 || context.fileTypes.java > 0));
        
        return context;
    }

    /**
     * ============================================================
     * CALCULATE FILE TYPE RELEVANCE
     * ============================================================
     * Assigns bonus points based on test type matching file changes
     */
    calculateFileTypeRelevance(fileTypes, testTitle) {
        let bonus = 0;
        
        // HTML-only changes: UI rendering and display tests
        if (fileTypes.html > 0 && fileTypes.ts === 0 && fileTypes.js === 0 && fileTypes.java === 0) {
            const uiKeywords = ['display', 'render', 'visible', 'shown', 'appear', 'ui', 'layout', 'screen'];
            if (uiKeywords.some(kw => testTitle.includes(kw))) {
                bonus = 20;
            }
        }
        
        // Logic-only changes: Behavior and logic tests
        if ((fileTypes.ts > 0 || fileTypes.js > 0 || fileTypes.java > 0) && fileTypes.html === 0) {
            const logicKeywords = ['validate', 'calculate', 'process', 'save', 'submit', 'api', 'service', 'logic', 'function'];
            if (logicKeywords.some(kw => testTitle.includes(kw))) {
                bonus = 20;
            }
        }
        
        // Both UI and logic: Integration tests
        if (fileTypes.both) {
            const integrationKeywords = ['integration', 'end-to-end', 'e2e', 'workflow', 'complete', 'full'];
            if (integrationKeywords.some(kw => testTitle.includes(kw))) {
                bonus = 30;
            } else if (testTitle.includes('verify') || testTitle.includes('test')) {
                // General integration test
                bonus = 15;
            }
        }
        
        return bonus;
    }

    /**
     * ============================================================
     * GET SECTION PATH DEPTH
     * ============================================================
     * Returns the depth of section hierarchy
     */
    getSectionPathDepth(testCase) {
        // Check if section path is available from previous enrichment
        if (testCase.sectionPath) {
            return testCase.sectionPath.split(' > ').length;
        }
        return 0;
    }

    /**
     * ============================================================
     * CHECK SECTION PATH MATCH
     * ============================================================
     * Checks if section path matches components/functional areas
     */
    checkSectionPathMatch(testCase, components, functionalAreas) {
        const result = { score: 0, reason: '' };
        
        if (!testCase.sectionPath) {
            return result;
        }
        
        const sectionPathLower = testCase.sectionPath.toLowerCase();
        const pathParts = sectionPathLower.split(' > ');
        
        // Must match at least 2 levels deep to count
        if (pathParts.length < 2) {
            return result;
        }
        
        // Check component match in path
        const componentMatch = components.some(comp => 
            pathParts.some(part => part.includes(comp.toLowerCase()))
        );
        
        if (componentMatch) {
            result.score = 30;
            result.reason = `Section path match (depth ${pathParts.length}): +30`;
        }
        
        // Check functional area match
        const areaMatch = functionalAreas.some(area => 
            pathParts.some(part => part.includes(area.toLowerCase()))
        );
        
        if (areaMatch && !componentMatch) {
            result.score = 25;
            result.reason = `Section functional area match (depth ${pathParts.length}): +25`;
        }
        
        return result;
    }

    /**
     * ============================================================
     * IS GENERIC TEST
     * ============================================================
     * Determines if test is too generic (only mentions top-level module)
     */
    isGenericTest(testTitle, components) {
        // Check if test only contains top-level module name without specific features
        const titleWords = testTitle.toLowerCase().split(/\s+/);
        const specificKeywords = [
            'form', 'button', 'field', 'page', 'screen', 'api', 'endpoint',
            'submit', 'save', 'delete', 'update', 'create', 'validate',
            'search', 'filter', 'sort', 'export', 'import', 'upload', 'download'
        ];
        
        const hasSpecificKeyword = specificKeywords.some(kw => testTitle.includes(kw));
        
        // If only mentions component name without specific keywords, it's generic
        if (!hasSpecificKeyword) {
            const onlyMentionsComponent = components.some(comp => 
                testTitle.includes(comp.toLowerCase()) && titleWords.length < 8
            );
            return onlyMentionsComponent;
        }
        
        return false;
    }

    /**
     * ============================================================
     * DETERMINE PR TYPE
     * ============================================================
     * Classifies PR based on number of files changed
     */
    determinePRType(filesChanged) {
        if (filesChanged <= 2) return 'Relaxed';
        if (filesChanged <= 5) return 'Sleepy';
        if (filesChanged <= 10) return 'Sarcastic';
        if (filesChanged <= 20) return 'Overloaded';
        return 'Angry';
    }

    /**
     * ============================================================
     * GET MAX TESTS FOR PR SIZE
     * ============================================================
     * Returns maximum number of tests based on PR type
     */
    getMaxTestsForPRSize(filesChanged) {
        if (filesChanged <= 2) return 10;   // Relaxed
        if (filesChanged <= 5) return 15;   // Sleepy
        if (filesChanged <= 10) return 20;  // Sarcastic
        if (filesChanged <= 20) return 40;  // Overloaded
        return 60;  // Angry
    }

    /**
     * ============================================================
     * CHECK FOR DUPLICATES
     * ============================================================
     * Checks if test case already exists based on JIRA reference
     */
    async checkForDuplicates(sectionId, jiraRefs) {
        try {
            const response = await this.client.get(`/get_cases/${this.config.projectId}&section_id=${sectionId}`);
            const existingCases = response.data;
            
            const duplicates = existingCases.filter(testCase => {
                const refs = (testCase.refs || '').toUpperCase();
                return jiraRefs.some(jiraId => refs.includes(jiraId.toUpperCase()));
            });
            
            return duplicates;
        } catch (error) {
            console.warn('[TESTRAIL] Could not check for duplicates:', error.message);
            return [];
        }
    }

    /**
     * ============================================================
     * ADD TEST CASE
     * ============================================================
     * Creates a single test case in TestRail
     */
    async addTestCase(sectionId, testCase) {
        try {
            const response = await this.client.post(`/add_case/${sectionId}`, testCase);
            console.log(`[TESTRAIL] Created test case: ${response.data.id} - ${testCase.title}`);
            return response.data;
        } catch (error) {
            console.error(`[TESTRAIL] Error creating test case "${testCase.title}":`, error.message);
            throw error;
        }
    }

    /**
     * ============================================================
     * BULK ADD TEST CASES
     * ============================================================
     * Adds multiple test cases with progress tracking
     */
    async bulkAddTestCases(sectionId, testCases, progressCallback) {
        const results = {
            success: [],
            failed: [],
            skipped: []
        };
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            
            try {
                // Report progress
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: testCases.length,
                        status: 'uploading',
                        testCase: testCase.title
                    });
                }
                
                const created = await this.addTestCase(sectionId, testCase);
                results.success.push({
                    title: testCase.title,
                    id: created.id
                });
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                results.failed.push({
                    title: testCase.title,
                    error: error.message
                });
                
                // Stop on first error (rollback strategy)
                console.error('[TESTRAIL] Stopping upload due to error');
                break;
            }
        }
        
        return results;
    }

    /**
     * ============================================================
     * GET SECTIONS WITH HIERARCHY
     * ============================================================
     * Returns sections with their full folder path
     */
    async getSectionsWithHierarchy(suiteId) {
        try {
            const response = await this.client.get(`/get_sections/${this.config.projectId}&suite_id=${suiteId}`);
            let sections = response.data;
            // Handle both array and object responses
            if (!Array.isArray(sections)) {
                if (Array.isArray(sections.sections)) {
                    sections = sections.sections;
                } else if (typeof sections === 'object') {
                    sections = Object.values(sections);
                } else {
                    sections = [];
                }
            }
            // Build hierarchy
            const sectionMap = new Map(sections.map(s => [s.id, s]));
            sections.forEach(section => {
                const path = [];
                let current = section;
                while (current) {
                    path.unshift(current.name);
                    current = current.parent_id ? sectionMap.get(current.parent_id) : null;
                }
                section.path = path.join(' > ');
            });
            return sections;
        } catch (error) {
            console.error('[TESTRAIL] Error fetching sections:', error.message);
            throw error;
        }
    }

    /**
     * ============================================================
     * BUILD TESTRAIL URL
     * ============================================================
     * Constructs URLs for test cases and sections
     */
    buildTestCaseUrl(testCaseId) {
        return `${this.config.baseUrl}/index.php?/cases/view/${testCaseId}`;
    }

    buildSectionUrl(suiteId, sectionId) {
        return `${this.config.baseUrl}/index.php?/suites/view/${suiteId}&group_by=cases:section_id&group_id=${sectionId}`;
    }

    /**
     * ============================================================
     * EXTRACT FILE KEYWORDS FROM CHANGED FILES
     * ============================================================
     * Extracts meaningful keywords from file paths (folders, file names)
     */
    extractFileKeywords(files) {
        const keywords = new Set();
        const stopWords = new Set(['src', 'app', 'common', 'components', 'services', 'models', 'views', 'controllers', 'utils', 'lib', 'core']);

        files.forEach(file => {
            const path = file.path || '';
            const parts = path.split('/');

            parts.forEach(part => {
                // Remove file extension
                const cleanPart = part.replace(/\.[^/.]+$/, '');
                
                // Split camelCase/PascalCase
                const words = cleanPart
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/[._-]/g, ' ')
                    .trim()
                    .toLowerCase()
                    .split(/\s+/);

                words.forEach(word => {
                    if (word.length >= 4 && !stopWords.has(word) && /^[a-z0-9]+$/.test(word)) {
                        keywords.add(word);
                    }
                });
            });
        });

        return [...keywords];
    }

    /**
     * ============================================================
     * EXTRACT SIGNIFICANT KEYWORDS FROM TEXT
     * ============================================================
     * Extracts meaningful keywords from text (min 4 chars, excludes common words)
     */
    extractSignificantKeywords(text) {
        if (!text) return [];

        // Common/stop words to exclude
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'was', 'were',
            'been', 'have', 'this', 'that', 'with', 'from', 'they', 'will', 'would', 'there',
            'their', 'what', 'which', 'when', 'where', 'should', 'could', 'make', 'made',
            'able', 'about', 'into', 'than', 'them', 'these', 'those', 'does', 'done'
        ]);

        // Extract words (4+ chars, alphanumeric)
        const words = text.toLowerCase()
            .split(/[\s,.-]+/)
            .filter(word => 
                word.length >= 4 && 
                /^[a-z0-9]+$/.test(word) && 
                !stopWords.has(word)
            );

        // Remove duplicates
        return [...new Set(words)];
    }

    /**
     * ============================================================
     * GET IMPACTED TEST CASES (TRACEABILITY MATRIX-BASED)
     * ============================================================
     * Simplified approach:
     * 1. Direct JIRA reference match (highest priority)
     * 2. JIRA Component match in TestRail
     * 3. Within component matches, filter by file keywords
     * 
     * Returns deduplicated, prioritized, and grouped test cases
     * Limited based on PR category
     */
    async getImpactedTestCases(suiteId, options = {}) {
        const {
            jiraId,
            changedFiles = [],
            components = [],
            keywords = [],
            traceabilityMatrix = {},
            jiraTitle = '',
            prCategory = 'Relaxed PR',
            jiraComponents = []
        } = options;

        console.log(`\n[TESTRAIL] ==================== IMPACT-BASED TEST CASE MAPPING ====================`);
        console.log(`[TESTRAIL] JIRA ID: ${jiraId || 'N/A'}`);
        console.log(`[TESTRAIL] JIRA Title: ${jiraTitle || 'N/A'}`);
        console.log(`[TESTRAIL] JIRA Components: ${jiraComponents.join(', ') || 'None'}`);
        console.log(`[TESTRAIL] PR Category: ${prCategory}`);
        console.log(`[TESTRAIL] Changed files: ${changedFiles.length}`);
        console.log(`[TESTRAIL] Keywords from files: ${keywords.join(', ') || 'None'}`);

        // Define max test cases based on PR category
        const categoryLimits = {
            'Relaxed PR': 20,
            'Sleepy PR': 30,
            'Sarcastic PR': 40,
            'Overloaded PR': 60,
            'Angry PR': 80
        };
        const maxTestCases = categoryLimits[prCategory] || 50;
        console.log(`[TESTRAIL] Max test cases for ${prCategory}: ${maxTestCases}`);

        // Extract keywords from JIRA title only (not from files)
        const jiraTitleKeywords = this.extractSignificantKeywords(jiraTitle);
        console.log(`[TESTRAIL] Keywords from JIRA Title: ${jiraTitleKeywords.join(', ')}`);

        const results = {
            directJiraMatch: [],      // Priority 1: Direct JIRA ref match
            componentMatch: [],       // Priority 2: JIRA component match in TestRail
            componentWithKeywords: [],// Priority 3: Component + file keyword match
            allCases: [],             // Deduplicated combined results
            groupedByModule: {}       // Grouped by component
        };

        const seenCaseIds = new Set();

        try {
            // Fetch all sections with pagination
            let allSections = [];
            let sectionOffset = 0;
            const sectionLimit = 250;
            let hasMoreSections = true;
            
            console.log(`[TESTRAIL] Fetching all sections from suite...`);
            while (hasMoreSections) {
                const sectionResponse = await this.client.get(`/get_sections/${this.config.projectId}&suite_id=${suiteId}&limit=${sectionLimit}&offset=${sectionOffset}`);
                const fetchedSections = Array.isArray(sectionResponse.data) ? sectionResponse.data : (sectionResponse.data.sections || []);
                if (fetchedSections.length === 0) {
                    hasMoreSections = false;
                } else {
                    allSections.push(...fetchedSections);
                    sectionOffset += sectionLimit;
                    console.log(`[TESTRAIL] Fetched ${fetchedSections.length} sections (total so far: ${allSections.length})`);
                    if (fetchedSections.length < sectionLimit) {
                        hasMoreSections = false;
                    }
                }
            }
            
            // Build hierarchy paths for all sections
            const sectionMap = new Map(allSections.map(s => [s.id, s]));
            allSections.forEach(section => {
                const pathParts = [];
                let current = section;
                while (current) {
                    pathParts.unshift(current.name);
                    current = current.parent_id ? sectionMap.get(current.parent_id) : null;
                }
                section.path = pathParts.join(' › ');
            });
            
            const sections = allSections;
            console.log(`[TESTRAIL] Total sections in suite: ${sections.length}`);
            
            // Fetch all test cases with pagination
            let allCases = [];
            let offset = 0;
            const limit = 250;
            let hasMore = true;
            
            console.log(`[TESTRAIL] Fetching all test cases from suite...`);
            while (hasMore) {
                const response = await this.client.get(`/get_cases/${this.config.projectId}&suite_id=${suiteId}&limit=${limit}&offset=${offset}`);
                const cases = Array.isArray(response.data) ? response.data : (response.data.cases || []);
                if (cases.length === 0) {
                    hasMore = false;
                } else {
                    allCases.push(...cases);
                    offset += limit;
                    console.log(`[TESTRAIL] Fetched ${cases.length} test cases (total so far: ${allCases.length})`);
                    if (cases.length < limit) {
                        hasMore = false;
                    }
                }
            }
            console.log(`[TESTRAIL] Total test cases in suite: ${allCases.length}`);

            allCases = allCases.map(tc => {
                const section = sectionMap.get(tc.section_id);
                return {
                    ...tc,
                    sectionPath: section ? section.path : '',
                    url: this.buildTestCaseUrl(tc.id),
                    sectionUrl: section ? this.buildSectionUrl(suiteId, section.id) : ''
                };
            });

            console.log(`[TESTRAIL] Enriched ${allCases.length} test cases with section paths`);
            
            // Define user roles to exclude from matching
            const USER_ROLES = ['admin', 'investigator', 'reviewer', 'applicant'];

            // ===============================================
            // PRIORITY 1: Direct JIRA Reference Match
            // ===============================================
            if (jiraId) {
                console.log(`\n[TESTRAIL] STEP 1: Searching for direct JIRA reference: ${jiraId}`);
                
                const jiraMatches = allCases.filter(tc => {
                    const refs = (tc.refs || '').toLowerCase();
                    return refs.includes(jiraId.toLowerCase());
                });

                jiraMatches.forEach(tc => {
                    if (!seenCaseIds.has(tc.id)) {
                        seenCaseIds.add(tc.id);
                        results.directJiraMatch.push({
                            ...tc,
                            matchType: 'jira_reference',
                            matchReason: `Direct JIRA reference: ${jiraId}`,
                            priority: 1
                        });
                    }
                });
                console.log(`[TESTRAIL] Found ${results.directJiraMatch.length} direct JIRA matches`);
            }

            // ===============================================
            // PRIORITY 2 & 3: JIRA Component Match + File Keywords
            // ===============================================
            const step1Matches = [];
            const componentMatches = [];
            
            if (jiraComponents.length > 0) {
                console.log(`\n[TESTRAIL] STEP 2: Searching by JIRA Components: ${jiraComponents.join(', ')}`);
                
                const componentMapping = traceabilityMatrix.components || {};

                jiraComponents.forEach(jiraComp => {
                    console.log(`[TESTRAIL] Processing JIRA component: "${jiraComp}"`);
                    
                    // Remove user roles from component parts
                    let compParts = jiraComp.split(/[-_\s]/).map(p => p.trim().toLowerCase()).filter(Boolean);
                    compParts = compParts.filter(p => !USER_ROLES.includes(p));
                    
                    // Further split camelCase/PascalCase into separate words
                    // e.g., "phsTemplates" → ["phs", "templates"]
                    const expandedParts = [];
                    compParts.forEach(part => {
                        // Split on camelCase boundaries
                        const words = part.split(/(?=[A-Z])/).map(w => w.toLowerCase());
                        expandedParts.push(...words);
                    });
                    compParts = [...new Set([...compParts, ...expandedParts])].filter(Boolean);
                    
                    console.log(`[TESTRAIL]   Component parts (minus roles): ${compParts.join(', ')}`);
                    
                    // Find matching TestRail component and get its tags
                    let matchedTRComponent = null;
                    let tags = [];
                    for (const [trCompName, trCompObj] of Object.entries(componentMapping)) {
                        const trCompWords = trCompName.toLowerCase().split(/[-_\s]+/);
                        
                        // Check if any component part matches any word in the TR component name (bidirectional)
                        const hasMatch = compParts.some(part => 
                            trCompWords.some(word => 
                                word.includes(part) || part.includes(word)
                            )
                        );
                        
                        if (hasMatch) {
                            matchedTRComponent = trCompName;
                            tags = trCompObj.tags || [];
                            break;
                        }
                    }
                    
                    if (!matchedTRComponent) {
                        console.log(`[TESTRAIL]   No TestRail component matched. Using component parts as tags.`);
                        tags = compParts;
                    } else {
                        console.log(`[TESTRAIL]   Matched TestRail Component: "${matchedTRComponent}"`);
                        console.log(`[TESTRAIL]   Tags from component: ${tags.join(', ')}`);
                    }

                    // For each tag, split it and create search terms
                    const searchTerms = [];
                    tags.forEach(tag => {
                        const tagParts = tag.split(/[-_\s]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 2);
                        searchTerms.push(...tagParts);
                    });
                    const uniqueSearchTerms = [...new Set(searchTerms)];
                    console.log(`[TESTRAIL]   Search terms to match in folders: ${uniqueSearchTerms.join(', ')}`);

                    // Search through all test cases
                    let matchCount = 0;
                    allCases.forEach(tc => {
                        const sectionPath = tc.sectionPath;
                        const sectionPathLower = sectionPath.toLowerCase();
                        
                        // Split path into folders (handle both > and ›)
                        const folders = sectionPath.split(/\s*[>›]\s*/).map(f => f.trim()).filter(Boolean);
                        const foldersLower = folders.map(f => f.toLowerCase());
                        
                        // Check if any folder contains any search term
                        for (const searchTerm of uniqueSearchTerms) {
                            for (let i = 0; i < foldersLower.length; i++) {
                                if (foldersLower[i].includes(searchTerm)) {
                                    matchCount++;
                                    step1Matches.push({
                                        testCase: tc,
                                        jiraComponent: jiraComp,
                                        matchedBy: `folder:"${folders[i]}" contains "${searchTerm}"`,
                                        matchedTerm: searchTerm
                                    });
                                    return; // Stop checking this test case
                                }
                            }
                        }
                    });
                    
                    console.log(`[TESTRAIL]   Total matches for "${jiraComp}": ${matchCount}`);
                });

                // Remove duplicates
                const seenTestCaseIds = new Set();
                step1Matches.forEach(match => {
                    if (!seenTestCaseIds.has(match.testCase.id)) {
                        seenTestCaseIds.add(match.testCase.id);
                        componentMatches.push(match);
                    }
                });
                
                console.log(`[TESTRAIL] Found ${componentMatches.length} unique component matches (Step 1)`);

                // ===============================================
                // STEP 3: Filter by JIRA title keywords in section path or test case title
                // ===============================================
                const step2Matches = [];
                if (jiraTitleKeywords.length > 0) {
                    console.log(`\n[TESTRAIL] STEP 3: Filtering by JIRA title keywords: ${jiraTitleKeywords.join(', ')}`);

                    componentMatches.forEach(match => {
                        const sectionPathLower = (match.testCase.sectionPath || '').toLowerCase();
                        const titleLower = (match.testCase.title || '').toLowerCase();
                        const matchingKeywords = jiraTitleKeywords.filter(kw => 
                            sectionPathLower.includes(kw.toLowerCase()) || titleLower.includes(kw.toLowerCase())
                        );
                        if (matchingKeywords.length > 0) {
                            step2Matches.push({
                                ...match,
                                matchedKeywords: matchingKeywords
                            });
                        }
                    });
                    
                    console.log(`[TESTRAIL] Component + Keyword matches: ${step2Matches.length}`);
                } else {
                    // No JIRA title keywords - use all component matches
                    console.log(`\n[TESTRAIL] STEP 3: No JIRA title keywords - using all component matches`);
                    step2Matches.push(...componentMatches);
                }
                
                // ===============================================
                // STEP 4: Filter by PR file keywords (from filenames only)
                // ===============================================
                const step3Matches = [];
                
                // Extract keywords from filenames only
                const filenameKeywords = changedFiles.flatMap(filePath => {
                    const filename = filePath.path.split(/[/\\]/).pop();
                    return this.extractSignificantKeywords(filename);
                });
                const uniqueFileKeywords = [...new Set(filenameKeywords)];
                
                if (uniqueFileKeywords.length > 0) {
                    console.log(`\n[TESTRAIL] STEP 4: Filtering by PR file keywords (${uniqueFileKeywords.length} unique): ${uniqueFileKeywords.slice(0, 15).join(', ')}${uniqueFileKeywords.length > 15 ? '...' : ''}`);

                    step2Matches.forEach(match => {
                        const sectionPathLower = (match.testCase.sectionPath || '').toLowerCase();
                        const titleLower = (match.testCase.title || '').toLowerCase();
                        const matchingFileKw = uniqueFileKeywords.filter(kw => 
                            sectionPathLower.includes(kw.toLowerCase()) || titleLower.includes(kw.toLowerCase())
                        );
                        if (matchingFileKw.length > 0) {
                            step3Matches.push({
                                ...match,
                                matchedFileKeywords: matchingFileKw
                            });
                        }
                    });
                    
                    console.log(`[TESTRAIL] After PR file keyword filter: ${step3Matches.length}`);
                } else {
                    // No PR file keywords - use all step 2 matches
                    console.log(`\n[TESTRAIL] STEP 4: No PR file keywords - using all Step 2 matches`);
                    step3Matches.push(...step2Matches);
                }
                
                // ===============================================
                // Build results and group by section path
                // ===============================================
                const finalMatches = step3Matches;
                const groupedBySection = {};
                
                finalMatches.forEach(match => {
                    const tc = match.testCase;
                    const sectionPath = tc.sectionPath || 'Unknown Section';
                    
                    if (!groupedBySection[sectionPath]) {
                        groupedBySection[sectionPath] = [];
                    }
                    
                    // Add enriched test case to group
                    const enrichedTC = {
                        ...tc,
                        matchType: 'component_with_keywords',
                        matchReason: `Component: ${match.jiraComponent}${match.matchedKeywords ? ', JIRA Keywords: ' + match.matchedKeywords.join(', ') : ''}${match.matchedFileKeywords ? ', File Keywords: ' + match.matchedFileKeywords.join(', ') : ''}`,
                        matchedComponent: match.jiraComponent,
                        matchedKeywords: match.matchedKeywords || [],
                        matchedFileKeywords: match.matchedFileKeywords || [],
                        priority: 3
                    };
                    
                    groupedBySection[sectionPath].push(enrichedTC);
                    
                    // Also add to allCases if not already seen
                    if (!seenCaseIds.has(tc.id)) {
                        seenCaseIds.add(tc.id);
                        results.componentWithKeywords.push(enrichedTC);
                        results.allCases.push(enrichedTC);
                    }
                });
                
                // Use section-based grouping instead of component-based
                results.groupedByModule = groupedBySection;
            } else {
                console.log(`\n[TESTRAIL] ⚠️  No JIRA components provided - cannot filter test cases by component`);
            }

            // ===============================================
            // Add direct JIRA matches to allCases
            // ===============================================
            results.allCases = [
                ...results.directJiraMatch,
                ...results.allCases
            ];

            console.log(`\n[TESTRAIL] ==================== MAPPING SUMMARY ====================`);
            console.log(`[TESTRAIL] Direct JIRA matches: ${results.directJiraMatch.length}`);
            console.log(`[TESTRAIL] Component + Keyword matches: ${results.componentWithKeywords.length}`);
            console.log(`[TESTRAIL] Total unique test cases: ${results.allCases.length}`);
            console.log(`[TESTRAIL] Impacted Section Paths (${Object.keys(results.groupedByModule).length}):`);
            Object.keys(results.groupedByModule).sort().forEach(path => {
                console.log(`    - ${path} (${results.groupedByModule[path].length} test cases)`);
            });
            console.log(`[TESTRAIL] =================================================================\n`);

            return results;

        } catch (error) {
            console.error('[TESTRAIL] Error in getImpactedTestCases:', error.message);
            throw error;
        }
    }
}

module.exports = TestRailService;
