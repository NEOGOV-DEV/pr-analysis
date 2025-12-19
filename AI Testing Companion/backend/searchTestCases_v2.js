// Standalone script to search relevant TestRail test cases for a JIRA ticket and PR files
// Usage: node searchTestCases_v2.js <JIRA_ID> <suiteId> [PR_LINK]

const config = require('./config');
const JiraService = require('./services/jira-service');
const TestRailService = require('./services/testrail-service');
const BitbucketService = require('./services/bitbucket-service');

const jiraService = new JiraService(config);
const testRailService = new TestRailService(config);
const bitbucketService = new BitbucketService(config);

const USER_ROLES = ['admin', 'investigator', 'reviewer', 'applicant'];

function extractKeywords(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['this','that','with','from','they','will','would','there','their','what','which','when','where','should','could','make','made','have','been','for','are','but','not','you','all','can','has','was','were','the','and'].includes(w));
}

async function main() {
    const [,, jiraId, suiteId, prLink] = process.argv;
    if (!jiraId || !suiteId) {
        console.log('Usage: node searchTestCases_v2.js <JIRA_ID> <suiteId> [PR_LINK]');
        process.exit(1);
    }

    console.log('='.repeat(80));
    console.log('STEP 0: FETCH DATA');
    console.log('='.repeat(80));

    // Fetch JIRA ticket
    const jira = await jiraService.getStoryDetails(jiraId);
    const jiraComponents = jira.components || [];
    const jiraTitle = jira.summary || '';
    const titleKeywords = extractKeywords(jiraTitle);
    
    console.log(`\nJIRA ID: ${jiraId}`);
    console.log(`JIRA Title: ${jiraTitle}`);
    console.log(`JIRA Components: ${jiraComponents.join(', ')}`);
    console.log(`JIRA Title Keywords: ${titleKeywords.join(', ')}`);

    // Fetch PR files if provided
    let prFiles = [];
    let fileKeywords = [];
    if (prLink && /^https?:\/\/.+\/pull-requests\//.test(prLink)) {
        try {
            const prDetails = await bitbucketService.getPRDetails(prLink);
            prFiles = prDetails.files.map(f => f.path).filter(Boolean);
            
            // Extract keywords only from filenames (not folder paths), and remove duplicates
            const filenameKeywords = prFiles.flatMap(filePath => {
                const filename = filePath.split(/[/\\]/).pop(); // Get last part after / or \
                return extractKeywords(filename);
            });
            fileKeywords = [...new Set(filenameKeywords)]; // Remove duplicates
            
            console.log(`\nPR Files (${prFiles.length}): ${prFiles.slice(0, 3).join(', ')}${prFiles.length > 3 ? '...' : ''}`);
            console.log(`PR File Keywords (from filenames only, ${fileKeywords.length} unique): ${fileKeywords.slice(0, 15).join(', ')}${fileKeywords.length > 15 ? '...' : ''}`);
        } catch (e) {
            console.error('Failed to fetch PR files:', e.message);
        }
    }

    // Fetch all sections with pagination
    let allSections = [];
    let sectionOffset = 0;
    const sectionLimit = 250;
    let hasMoreSections = true;
    
    console.log(`\nFetching all sections from suite...`);
    while (hasMoreSections) {
        const response = await testRailService.client.get(`/get_sections/${config.testRail.projectId}&suite_id=${suiteId}&limit=${sectionLimit}&offset=${sectionOffset}`);
        const fetchedSections = Array.isArray(response.data) ? response.data : (response.data.sections || []);
        if (fetchedSections.length === 0) {
            hasMoreSections = false;
        } else {
            allSections.push(...fetchedSections);
            sectionOffset += sectionLimit;
            console.log(`  Fetched ${fetchedSections.length} sections (total so far: ${allSections.length})`);
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
    console.log(`\nTotal sections in suite: ${sections.length}`);
    console.log(`\nAll section names and paths (showing first 20):`);
    sections.slice(0, 20).forEach((s, i) => {
        console.log(`  ${i+1}. [ID:${s.id}] ${s.path || s.name}`);
    });
    if (sections.length > 20) {
        console.log(`  ... and ${sections.length - 20} more sections`);
    }
    
    // Check if any sections contain correspondence
    const correspondenceSections = sections.filter(s => 
        (s.path || s.name).toLowerCase().includes('correspondence')
    );
    console.log(`\nSections containing "correspondence": ${correspondenceSections.length}`);
    correspondenceSections.forEach(s => {
        console.log(`  - [ID:${s.id}] ${s.path || s.name}`);
    });

    // Fetch all test cases in suite (with pagination to get ALL cases)
    let allCases = [];
    let offset = 0;
    const limit = 250;
    let hasMore = true;
    
    console.log(`\nFetching all test cases from suite...`);
    while (hasMore) {
        const response = await testRailService.client.get(`/get_cases/${config.testRail.projectId}&suite_id=${suiteId}&limit=${limit}&offset=${offset}`);
        const cases = Array.isArray(response.data) ? response.data : (response.data.cases || []);
        if (cases.length === 0) {
            hasMore = false;
        } else {
            allCases.push(...cases);
            offset += limit;
            console.log(`  Fetched ${cases.length} test cases (total so far: ${allCases.length})`);
            if (cases.length < limit) {
                hasMore = false;
            }
        }
    }
    console.log(`\nTotal test cases fetched from API: ${allCases.length}`);
    
    // Map test cases to section paths (sectionMap already created above)
    allCases = allCases.map(tc => {
        const section = sectionMap.get(tc.section_id);
        return {
            ...tc,
            sectionPath: section ? section.path : '',
            url: testRailService.buildTestCaseUrl(tc.id),
        };
    });
    
    // Check test cases without section paths
    const casesWithoutPath = allCases.filter(tc => !tc.sectionPath);
    if (casesWithoutPath.length > 0) {
        console.log(`\nWARNING: ${casesWithoutPath.length} test cases have no section path`);
        casesWithoutPath.slice(0, 5).forEach(tc => {
            console.log(`  [${tc.id}] section_id: ${tc.section_id}`);
        });
    }
    
    // Show all unique section paths from test cases
    const uniquePaths = [...new Set(allCases.map(tc => tc.sectionPath).filter(Boolean))];
    console.log(`\nUnique section paths from test cases (${uniquePaths.length}):`);
    uniquePaths.forEach((path, i) => {
        console.log(`  ${i+1}. ${path}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: HIGH MATCHES - JIRA COMPONENT MATCHES TESTRAIL FOLDERS');
    console.log('='.repeat(80));

    const traceability = config.traceabilityMatrix?.components || {};
    let step1Matches = [];

    jiraComponents.forEach(jiraComp => {
        console.log(`\n--- Processing JIRA Component: "${jiraComp}" ---`);
        
        // Remove user roles from component parts
        let compParts = jiraComp.split(/[-_\s]/).map(p => p.trim().toLowerCase()).filter(Boolean);
        compParts = compParts.filter(p => !USER_ROLES.includes(p));
        console.log(`  Component parts (minus roles): ${compParts.join(', ')}`);
        
        // Find matching TestRail component and get its tags
        let matchedTRComponent = null;
        let tags = [];
        for (const [trCompName, trCompObj] of Object.entries(traceability)) {
            if (compParts.some(part => trCompName.toLowerCase().includes(part))) {
                matchedTRComponent = trCompName;
                tags = trCompObj.tags || [];
                break;
            }
        }
        
        if (!matchedTRComponent) {
            console.log(`  No TestRail component matched. Using component parts as tags.`);
            tags = compParts;
        } else {
            console.log(`  Matched TestRail Component: "${matchedTRComponent}"`);
            console.log(`  Tags from component: ${tags.join(', ')}`);
        }

        // For each tag, split it and create search terms
        const searchTerms = [];
        tags.forEach(tag => {
            const tagParts = tag.split(/[-_\s]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 2);
            searchTerms.push(...tagParts);
        });
        const uniqueSearchTerms = [...new Set(searchTerms)];
        console.log(`  Search terms to match in folders: ${uniqueSearchTerms.join(', ')}`);

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
                        console.log(`  ✓ MATCH [${tc.id}]: Folder "${folders[i]}" contains "${searchTerm}" | Path: ${sectionPath}`);
                        step1Matches.push({
                            ...tc,
                            matchedBy: `folder:"${folders[i]}" contains "${searchTerm}"`,
                            matchedTerm: searchTerm
                        });
                        return; // Stop checking this test case
                    }
                }
            }
        });
        
        console.log(`  Total matches for "${jiraComp}": ${matchCount}`);
    });

    // Remove duplicates
    const uniqueStep1 = Array.from(new Map(step1Matches.map(tc => [tc.id, tc])).values());
    console.log(`\n[STEP 1 RESULT] Total high matches: ${uniqueStep1.length}`);
    if (uniqueStep1.length > 0) {
        console.log(`Sample matches:`);
        uniqueStep1.slice(0, 5).forEach(tc => {
            console.log(`  [${tc.id}] ${tc.sectionPath}`);
            console.log(`    → ${tc.matchedBy}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: FILTER BY JIRA TITLE KEYWORDS');
    console.log('='.repeat(80));

    let step2Matches = [];
    if (titleKeywords.length === 0) {
        console.log('No title keywords to filter. Keeping all Step 1 matches.');
        step2Matches = uniqueStep1;
    } else {
        console.log(`Filtering by title keywords: ${titleKeywords.join(', ')}`);
        uniqueStep1.forEach(tc => {
            const sectionPathLower = tc.sectionPath.toLowerCase();
            const titleLower = (tc.title || '').toLowerCase();
            const matchingKeywords = titleKeywords.filter(kw => 
                sectionPathLower.includes(kw) || titleLower.includes(kw)
            );
            if (matchingKeywords.length > 0) {
                step2Matches.push({
                    ...tc,
                    matchedKeywords: matchingKeywords
                });
                console.log(`  ✓ [${tc.id}] matches keywords: ${matchingKeywords.join(', ')}`);
            }
        });
    }

    console.log(`\n[STEP 2 RESULT] After title keyword filter: ${step2Matches.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: FILTER BY PR FILE KEYWORDS');
    console.log('='.repeat(80));

    let step3Matches = [];
    if (fileKeywords.length === 0) {
        console.log('No PR file keywords to filter. Keeping all Step 2 matches.');
        step3Matches = step2Matches;
    } else {
        console.log(`Filtering by PR file keywords: ${fileKeywords.slice(0, 10).join(', ')}${fileKeywords.length > 10 ? '...' : ''}`);
        step2Matches.forEach(tc => {
            const sectionPathLower = tc.sectionPath.toLowerCase();
            const titleLower = (tc.title || '').toLowerCase();
            const matchingFileKw = fileKeywords.filter(kw => 
                sectionPathLower.includes(kw) || titleLower.includes(kw)
            );
            if (matchingFileKw.length > 0) {
                step3Matches.push({
                    ...tc,
                    matchedFileKeywords: matchingFileKw
                });
                console.log(`  ✓ [${tc.id}] matches file keywords: ${matchingFileKw.join(', ')}`);
            }
        });
    }

    console.log(`\n[STEP 3 RESULT] After PR file keyword filter: ${step3Matches.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('FINAL RESULTS');
    console.log('='.repeat(80));
    console.log(`Step 1 (Component match): ${uniqueStep1.length}`);
    console.log(`Step 2 (+ Title keywords): ${step2Matches.length}`);
    console.log(`Step 3 (+ PR file keywords): ${step3Matches.length}`);
    
    if (step3Matches.length > 0) {
        console.log(`\n\nFinal matched test cases grouped by section path:`);
        console.log('='.repeat(80));
        
        // Group by section path
        const groupedBySection = {};
        step3Matches.forEach(tc => {
            const path = tc.sectionPath || 'Unknown Section';
            if (!groupedBySection[path]) {
                groupedBySection[path] = [];
            }
            groupedBySection[path].push(tc);
        });
        
        // Sort section paths alphabetically
        const sortedPaths = Object.keys(groupedBySection).sort();
        
        sortedPaths.forEach((path, idx) => {
            const cases = groupedBySection[path];
            console.log(`\n${idx + 1}. Section: ${path}`);
            console.log(`   Test Cases (${cases.length}):`);
            cases.forEach(tc => {
                console.log(`   - [${tc.id}] ${tc.title}`);
                console.log(`     URL: ${tc.url}`);
                if (tc.matchedKeywords && tc.matchedKeywords.length > 0) {
                    console.log(`     Matched Title Keywords: ${tc.matchedKeywords.join(', ')}`);
                }
                if (tc.matchedFileKeywords && tc.matchedFileKeywords.length > 0) {
                    console.log(`     Matched PR File Keywords: ${tc.matchedFileKeywords.join(', ')}`);
                }
            });
        });
        
        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total sections with matched test cases: ${sortedPaths.length}`);
        console.log(`Total final matched test cases: ${step3Matches.length}`);
    } else {
        console.log(`\nNo test cases matched all filtering criteria.`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
