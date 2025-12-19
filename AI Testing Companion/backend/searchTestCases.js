// Standalone script to search relevant TestRail test cases for a JIRA ticket and PR files
// Usage: node searchTestCases.js <JIRA_ID> <suiteId> [file1 file2 ... | <PR_LINK>]

const config = require('./config');
const JiraService = require('./services/jira-service');
const TestRailService = require('./services/testrail-service');
const BitbucketService = require('./services/bitbucket-service');


const jiraService = new JiraService(config);
const testRailService = new TestRailService(config);
const bitbucketService = new BitbucketService(config);

function extractKeywords(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['this','that','with','from','they','will','would','there','their','what','which','when','where','should','could','make','made','have','been','for','are','but','not','you','all','can','has','was','were','the','and'].includes(w));
}

async function main() {
    const [,, jiraId, suiteId, ...args] = process.argv;
    if (!jiraId || !suiteId) {
        console.log('Usage: node searchTestCases.js <JIRA_ID> <suiteId> [file1 file2 ... | <PR_LINK>]');
        process.exit(1);
    }

    // If last arg looks like a PR link, fetch files from Bitbucket
    let prFiles = args;
    let fileKeywords = [];
    if (args.length === 1 && /^https?:\/\/.+\/pull-requests\//.test(args[0])) {
        const prLink = args[0];
        try {
            const prDetails = await bitbucketService.getPRDetails(prLink);
            const files = prDetails.files.map(f => f.path).filter(Boolean);
            prFiles = files;
            fileKeywords = files.flatMap(f => extractKeywords(f));
            console.log(`Fetched ${files.length} files from PR:`, files);
        } catch (e) {
            console.error('Failed to fetch PR files:', e.message);
            process.exit(1);
        }
    } else {
        fileKeywords = prFiles.flatMap(f => extractKeywords(f));
    }

    // 1. Fetch JIRA ticket
    const jira = await jiraService.getStoryDetails(jiraId);
    const jiraComponents = jira.components || [];
    const jiraTitle = jira.summary || '';
    const titleKeywords = extractKeywords(jiraTitle);
    console.log(`JIRA: ${jiraId}\nTitle: ${jiraTitle}\nComponents: ${jiraComponents.join(', ')}\nTitle Keywords: ${titleKeywords.join(', ')}`);

    // 2. Fetch all test cases in suite
    const response = await testRailService.client.get(`/get_cases/${config.testRail.projectId}&suite_id=${suiteId}`);
    let allCases = Array.isArray(response.data) ? response.data : (response.data.cases || []);
    const sections = await testRailService.getSectionsWithHierarchy(suiteId);
    const sectionMap = new Map(sections.map(s => [s.id, s]));
    allCases = allCases.map(tc => {
        const section = sectionMap.get(tc.section_id);
        return {
            ...tc,
            sectionPath: section ? section.path : '',
            url: testRailService.buildTestCaseUrl(tc.id),
        };
    });
    
    console.log(`\nTotal test cases fetched: ${allCases.length}`);
    
    // Get unique section paths
    const uniquePaths = [...new Set(allCases.map(tc => tc.sectionPath).filter(Boolean))];
    console.log(`\nUnique section paths in suite (total: ${uniquePaths.length}):`);
    uniquePaths.slice(0, 20).forEach((path, i) => {
        console.log(`  ${i+1}. ${path}`);
    });
    if (uniquePaths.length > 20) {
        console.log(`  ... (${uniquePaths.length - 20} more paths)`);
    }

    // 3. Step 1: For each JIRA component, print the matched TestRail component, and search for folder (section path) names matching the JIRA component name or its parts
    const traceability = config.traceabilityMatrix?.components || {};
    let highMatches = [];
    const rolesToIgnore = ['admin', 'investigator', 'reviewer', 'applicant'];
    jiraComponents.forEach(comp => {
        // Split component on hyphens/underscores and also try the full component
        let parts = comp.split(/[-_\s]/).map(p => p.trim().toLowerCase()).filter(Boolean);
        // Remove user roles from parts
        parts = parts.filter(p => !rolesToIgnore.includes(p));
        const allCompParts = [comp.toLowerCase(), ...parts];

        // Find matching TestRail component name and tags
        let matchedTRComponent = null;
        let tags = [];
        for (const [compName, compObj] of Object.entries(traceability)) {
            if (allCompParts.some(part => compName.toLowerCase().includes(part))) {
                matchedTRComponent = compName;
                tags = compObj.tags || [];
                break;
            }
        }
        if (!matchedTRComponent) {
            // Fallback: use allCompParts as tags
            tags = allCompParts;
        }
        console.log(`\n[JIRA Component: ${comp}] Matched TestRail Component: ${matchedTRComponent || 'None'} | Tags used: ${tags.join(', ')}`);

        // Show which section paths will be searched against these tags
        console.log(`  Searching ${allCases.length} test cases for section paths containing any of these tag parts...`);
        
        // For each tag, split on hyphens/underscores and match any part in section path (including nested folders)
        let matchCountForComp = 0;
        allCases.forEach(tc => {
            const sectionPath = tc.sectionPath.toLowerCase();
            // Split section path by " > " or "›" to get individual folder names
            const folders = sectionPath.split(/\s*[>›]\s*/).map(f => f.trim().toLowerCase()).filter(Boolean);
            
            let matchedTagPart = null;
            let matchedFolder = null;
            for (const tag of tags) {
                const tagParts = tag.split(/[-_\s]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 2);
                for (const tagPart of tagParts) {
                    // Check if any folder contains the tag part
                    for (const folder of folders) {
                        if (folder.includes(tagPart)) {
                            matchedTagPart = tagPart;
                            matchedFolder = folder;
                            break;
                        }
                    }
                    if (matchedTagPart) break;
                }
                if (matchedTagPart) break;
            }
            if (matchedTagPart) {
                console.log(`  ✓ MATCH: Test case [${tc.id}] "${tc.sectionPath}" - folder "${matchedFolder}" contains tag "${matchedTagPart}"`);
                highMatches.push(tc);
                tc._matchedBy = `tag: ${matchedTagPart}`;
                matchCountForComp++;
                return;
            }
        });
        console.log(`  Found ${matchCountForComp} test cases matching component "${comp}"`);
    });
    highMatches = Array.from(new Set(highMatches));
    console.log(`\n[Step 1] High matches (by folder/component): ${highMatches.length}`);
    highMatches.forEach(tc => console.log(`  [${tc.id}] ${tc.sectionPath} - ${tc.title}  [Matched by: ${tc._matchedBy || 'unknown'}]`));

    // 4. Step 2: Filter by JIRA title keywords
    let keywordMatches = highMatches.filter(tc =>
        titleKeywords.some(kw => tc.sectionPath.toLowerCase().includes(kw))
    );
    console.log(`\n[Step 2] After JIRA title keyword filter: ${keywordMatches.length}`);
    keywordMatches.forEach(tc => console.log(`  [${tc.id}] ${tc.sectionPath} - ${tc.title}`));

    // 5. Step 3: Filter by PR file keywords
    let fileMatches = keywordMatches.filter(tc =>
        fileKeywords.length === 0 ? true : fileKeywords.some(kw => tc.sectionPath.toLowerCase().includes(kw))
    );
    console.log(`\n[Step 3] After PR file keyword filter: ${fileMatches.length}`);
    fileMatches.forEach(tc => console.log(`  [${tc.id}] ${tc.sectionPath} - ${tc.title}`));

    // 6. Summary
    console.log(`\nSummary:`);
    console.log(`  High matches: ${highMatches.length}`);
    console.log(`  After JIRA title keyword filter: ${keywordMatches.length}`);
    console.log(`  After PR file keyword filter: ${fileMatches.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
