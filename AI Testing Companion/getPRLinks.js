// getPRLinks.js
// Fetch PR links from Bitbucket using JIRA ID (searches PRs by branch name or title)
// Reads API credentials from config.js

const config = require('./backend/config');

// Bitbucket Server/Data Center API to search PRs containing JIRA ID
async function getPRLinksFromBitbucket(jiraId) {
    const { baseUrl, username, password } = config.bitbucket;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    console.log(`Searching Bitbucket for PRs linked to ${jiraId}...`);

    // List all projects first
    const projectsUrl = `${baseUrl}/rest/api/1.0/projects?limit=100`;
    const projectsRes = await fetch(projectsUrl, {
        headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!projectsRes.ok) {
        console.error('Failed to fetch projects:', projectsRes.status, await projectsRes.text());
        return [];
    }

    const projectsData = await projectsRes.json();
    const projects = projectsData.values || [];
    const allPRs = [];

    for (const project of projects) {
        // List repos in each project
        const reposUrl = `${baseUrl}/rest/api/1.0/projects/${project.key}/repos?limit=100`;
        const reposRes = await fetch(reposUrl, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!reposRes.ok) continue;

        const reposData = await reposRes.json();
        const repos = reposData.values || [];

        for (const repo of repos) {
            // Search PRs in each repo
            const prsUrl = `${baseUrl}/rest/api/1.0/projects/${project.key}/repos/${repo.slug}/pull-requests?state=ALL&limit=100`;
            const prsRes = await fetch(prsUrl, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            if (!prsRes.ok) continue;

            const prsData = await prsRes.json();
            const prs = prsData.values || [];

            // Filter PRs that contain the JIRA ID in title, description, or branch name
            const matchingPRs = prs.filter(pr => {
                const title = pr.title || '';
                const description = pr.description || '';
                const branchName = pr.fromRef?.displayId || '';
                const regex = new RegExp(jiraId, 'i');
                return regex.test(title) || regex.test(description) || regex.test(branchName);
            });

            for (const pr of matchingPRs) {
                allPRs.push({
                    title: pr.title,
                    state: pr.state,
                    branch: pr.fromRef?.displayId,
                    link: `${baseUrl}/projects/${project.key}/repos/${repo.slug}/pull-requests/${pr.id}`
                });
            }
        }
    }

    return allPRs;
}

async function main(jiraId) {
    console.log(`\n=== Fetching PRs for JIRA ID: ${jiraId} ===\n`);

    const prs = await getPRLinksFromBitbucket(jiraId);

    if (prs.length === 0) {
        console.log('No PRs found linked to this JIRA ID in Bitbucket.');
    } else {
        console.log(`Found ${prs.length} PR(s):\n`);
        prs.forEach((pr, i) => {
            console.log(`${i + 1}. ${pr.title}`);
            console.log(`   State: ${pr.state}`);
            console.log(`   Branch: ${pr.branch}`);
            console.log(`   Link: ${pr.link}\n`);
        });
    }
}

// Usage: node getPRLinks.js BGS-5547
if (require.main === module) {
    const jiraId = process.argv[2];
    if (!jiraId) {
        console.error('Usage: node getPRLinks.js <JIRA_ID>');
        process.exit(1);
    }
    main(jiraId).catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
}
