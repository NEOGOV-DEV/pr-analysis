/**
 * ================================================================
 * BITBUCKET SERVICE
 * ================================================================
 * 
 * Handles all Bitbucket API interactions including:
 * - Fetching PR details
 * - Analyzing PR changes
 * - Getting file diffs
 * - Extracting commit information
 * 
 * Supports both Bitbucket Cloud and Server/Data Center
 * API Documentation: https://developer.atlassian.com/bitbucket/api/2/reference/
 * ================================================================
 */

const axios = require('axios');

class BitbucketService {
    constructor(config) {
        this.config = config.bitbucket;

        // Detect if Bitbucket Server or Cloud based on URL
        this.isServer = !this.config.baseUrl.includes('bitbucket.org');

        const baseURL = this.isServer
            ? `${this.config.baseUrl}/rest/api/1.0`
            : 'https://api.bitbucket.org/2.0';

        this.client = axios.create({
            baseURL,
            auth: {
                username: this.config.username,
                password: this.config.password
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * ============================================================
     * PARSE PR URL
     * ============================================================
     * Extracts project, repo, and PR ID from URL
     */
    parsePRUrl(prUrl) {
        // Bitbucket Server: https://bitbucket.company.com/projects/PROJ/repos/repo-name/pull-requests/123
        // Bitbucket Cloud: https://bitbucket.org/workspace/repo-name/pull-requests/123

        if (this.isServer) {
            const match = prUrl.match(/projects\/([^/]+)\/repos\/([^/]+)\/pull-requests\/(\d+)/);
            if (match) {
                return {
                    project: match[1],
                    repo: match[2],
                    prId: match[3]
                };
            }
        } else {
            const match = prUrl.match(/bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/);
            if (match) {
                return {
                    workspace: match[1],
                    repo: match[2],
                    prId: match[3]
                };
            }
        }

        throw new Error('Invalid Bitbucket PR URL format');
    }

    /**
     * ============================================================
     * GET PR DETAILS
     * ============================================================
     * Fetches complete PR information including changes
     */
    async getPRDetails(prUrl) {
        try {
            console.log(`[BITBUCKET] Fetching PR details from ${prUrl}...`);

            const parsed = this.parsePRUrl(prUrl);

            let pr, files;

            if (this.isServer) {
                // Bitbucket Server API
                const prResponse = await this.client.get(
                    `/projects/${parsed.project}/repos/${parsed.repo}/pull-requests/${parsed.prId}`
                );
                pr = prResponse.data;

                // Get changed files
                const changesResponse = await this.client.get(
                    `/projects/${parsed.project}/repos/${parsed.repo}/pull-requests/${parsed.prId}/changes`
                );
                files = changesResponse.data.values || [];
            } else {
                // Bitbucket Cloud API
                const prResponse = await this.client.get(
                    `/repositories/${parsed.workspace}/${parsed.repo}/pullrequests/${parsed.prId}`
                );
                pr = prResponse.data;

                // Get diff stat
                const diffResponse = await this.client.get(
                    `/repositories/${parsed.workspace}/${parsed.repo}/pullrequests/${parsed.prId}/diffstat`
                );
                files = diffResponse.data.values || [];
            }

            // Debug: log the entire file object for each entry
            console.log('[BITBUCKET] ========================================');
            console.log('[BITBUCKET] Raw file objects from API (total:', files.length, '):');
            console.log('[BITBUCKET] ========================================');
            files.forEach((f, index) => {
                console.log(`[BITBUCKET] File ${index + 1}:`, JSON.stringify(f, null, 2));
                console.log(`[BITBUCKET] File ${index + 1} keys:`, Object.keys(f));
            });

            // Analyze the PR
            const analysis = this.analyzePR(pr, files);

            // Use the robust getPath helper for file path extraction
            const getPath = (f) => {
                // Try all possible path locations
                console.log('[BITBUCKET] getPath - Processing file with keys:', Object.keys(f));
                
                // Direct string path
                if (typeof f.path === 'string') {
                    console.log('[BITBUCKET] Found path as string:', f.path);
                    return f.path;
                }
                
                // Path as object - CRITICAL: Check toString property first!
                if (f.path && typeof f.path === 'object') {
                    console.log('[BITBUCKET] path is object:', f.path);
                    
                    // Bitbucket Server uses toString property for full path
                    if (typeof f.path.toString === 'string') {
                        console.log('[BITBUCKET] Found in f.path.toString:', f.path.toString);
                        return f.path.toString;
                    }
                    
                    // Other object properties
                    if (typeof f.path.value === 'string') return f.path.value;
                    if (typeof f.path.text === 'string') return f.path.text;
                    
                    // If toString is a function, call it
                    if (typeof f.path.toString === 'function' && f.path.toString() !== '[object Object]') {
                        const pathStr = f.path.toString();
                        console.log('[BITBUCKET] path.toString():', pathStr);
                        return pathStr;
                    }
                    
                    // Fallback: iterate through properties (but skip parent/name which are fragments)
                    for (const key in f.path) {
                        if (key !== 'parent' && key !== 'name' && key !== 'extension' && key !== 'components' && typeof f.path[key] === 'string') {
                            console.log(`[BITBUCKET] Found path in f.path.${key}:`, f.path[key]);
                            return f.path[key];
                        }
                    }
                }
                
                // Bitbucket Cloud format
                if (f.new && f.new.path) {
                    console.log('[BITBUCKET] Found in f.new.path:', f.new.path);
                    return f.new.path;
                }
                if (f.old && f.old.path) {
                    console.log('[BITBUCKET] Found in f.old.path:', f.old.path);
                    return f.old.path;
                }
                
                // Last resort - check all properties
                for (const key in f) {
                    if (typeof f[key] === 'string' && f[key].includes('.')) {
                        console.log(`[BITBUCKET] Found potential path in f.${key}:`, f[key]);
                        return f[key];
                    }
                }
                
                console.warn('[BITBUCKET] Could not extract file path from:', JSON.stringify(f, null, 2));
                return '[unknown]';
            };

            return {
                title: pr.title,
                description: pr.description || '',
                author: this.isServer ? pr.author.user.displayName : pr.author.display_name,
                state: pr.state,
                created: pr.createdDate || pr.created_on,
                updated: pr.updatedDate || pr.updated_on,
                filesChanged: files.length,
                files: files.map((f, index) => {
                    console.log(`[BITBUCKET] ======= Mapping file ${index + 1} =======`);
                    const filePath = getPath(f);
                    console.log('[BITBUCKET] Final extracted filePath:', filePath);
                    const fileObj = {
                        path: filePath,
                        linesAdded: f.linesAdded || f.lines_added || 0,
                        linesRemoved: f.linesRemoved || f.lines_removed || 0,
                        status: f.type || 'MODIFY'
                    };
                    console.log('[BITBUCKET] Returning file object:', JSON.stringify(fileObj));
                    return fileObj;
                }),
                analysis
            };
        } catch (error) {
            console.error('[BITBUCKET] Error fetching PR:', error.message);
            throw new Error(`Failed to fetch Bitbucket PR: ${error.message}`);
        }
    }

    /**
     * ============================================================
     * ANALYZE PR
     * ============================================================
     * Categorizes PR and calculates risk score
     */
    analyzePR(pr, files) {
        const totalFiles = files.length;
        const totalLines = files.reduce((sum, f) =>
            sum + (f.linesAdded || f.lines_added || 0) +
            (f.linesRemoved || f.lines_removed || 0), 0
        );

        // Helper function to safely get path
        const getPath = (f) => {
            if (typeof f.path === 'string') return f.path;
            if (f.path && typeof f.path === 'object') {
                if (typeof f.path.value === 'string') return f.path.value;
                if (typeof f.path.text === 'string') return f.path.text;
                for (const key in f.path) {
                    if (typeof f.path[key] === 'string') return f.path[key];
                }
            }
            if (f.new && f.new.path) return f.new.path;
            if (f.old && f.old.path) return f.old.path;
            console.warn('[BITBUCKET] Could not extract file path in getPath from:', JSON.stringify(f, null, 2));
            return '[unknown]';
        };

        // Check if PR touches shared/core components
        const sharedComponents = files.filter(f => {
            const path = getPath(f);
            return path.includes('shared') ||
                path.includes('core') ||
                path.includes('common') ||
                path.includes('utils');
        }).length;

        // Check if only style/formatting changes
        const onlyStyleChanges = files.every(f => {
            const path = getPath(f);
            return path.endsWith('.css') ||
                path.endsWith('.scss') ||
                path.endsWith('.less') ||
                path.includes('style');
        });

        // Check if title indicates minor change but PR is large
        const title = (pr.title || '').toLowerCase();
        const isSarcastic = (title.includes('minor') ||
            title.includes('quick') ||
            title.includes('small') ||
            title.includes('fix')) &&
            (totalFiles > 5 || totalLines > 100);

        // Calculate risk score
        const riskScore = Math.min(100,
            totalFiles * 1 +
            sharedComponents * 10 +
            totalLines * 0.05
        );

        // Determine category
        let category;
        let emoji;

        if (onlyStyleChanges) {
            category = 'Sleepy PR';
            emoji = '😴';
        } else if (isSarcastic) {
            category = 'Sarcastic PR';
            emoji = '🙃';
        } else if (sharedComponents > 3 || riskScore > 85) {
            category = 'Overloaded PR';
            emoji = '🤯';
        } else if (totalFiles > 10 || totalLines > 500) {
            category = 'Angry PR';
            emoji = '😡';
        } else {
            category = 'Relaxed PR';
            emoji = '😂';
        }

        // Determine risk level
        let riskLevel;
        if (riskScore < 30) riskLevel = 'Low';
        else if (riskScore < 70) riskLevel = 'Medium';
        else riskLevel = 'High';

        return {
            category,
            emoji,
            riskScore: Math.round(riskScore),
            riskLevel,
            metrics: {
                filesChanged: totalFiles,
                linesChanged: totalLines,
                sharedComponents,
                onlyStyleChanges
            }
        };
    }

    /**
     * ============================================================
     * EXTRACT COMPONENTS FROM FILES
     * ============================================================
     * Maps changed files to application components
     */
    extractComponents(files, componentMapping) {
        const components = new Set();
        const keywords = new Set();

        files.forEach(file => {
            const path = file.path || '';

            // Check against component mapping first
            for (const [pattern, component] of Object.entries(componentMapping)) {
                if (path.toLowerCase().includes(pattern.toLowerCase())) {
                    components.add(component);
                }
            }

            // Extract meaningful parts from path for keywords
            const parts = path.split('/');
            parts.forEach(part => {
                // Skip common/generic folder names
                const skipWords = ['src', 'app', 'common', 'components', 'services', 'models', 'views', 'controllers'];
                if (part && !skipWords.includes(part.toLowerCase()) && part.length > 3) {
                    // Convert camelCase or PascalCase to readable format
                    const readable = part
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/[._-]/g, ' ')
                        .trim();
                    if (readable && !readable.includes('.')) {
                        keywords.add(readable);
                    }
                }
            });

            // If no components found from mapping, use extracted keywords as components
            if (components.size === 0 && keywords.size > 0) {
                keywords.forEach(kw => {
                    // Capitalize first letter
                    const formatted = kw.charAt(0).toUpperCase() + kw.slice(1);
                    components.add(formatted);
                });
            }
        });

        console.log('[BITBUCKET] Extracted components:', Array.from(components));
        console.log('[BITBUCKET] Extracted keywords for search:', Array.from(keywords));

        return {
            components: Array.from(components),
            keywords: Array.from(keywords)
        };
    }

    /**
     * ============================================================
     * SEARCH PRS BY JIRA ID
     * ============================================================
     * Searches all Bitbucket repos for PRs containing the JIRA ID
     * in title, description, or branch name
     */
    async searchPRsByJiraId(jiraId) {
        console.log(`[BITBUCKET] Searching PRs for JIRA ID: ${jiraId}...`);
        const allPRs = [];
        const debugPRs = [];

        try {
            if (this.isServer) {
                // Bitbucket Server/Data Center API
                // Only search the IN/backgroundsolutions repo
                const projectKey = 'IN';
                const repoSlug = 'backgroundsolutions';
                let start = 0;
                let isLastPage = false;
                const regex = new RegExp(jiraId, 'i');
                while (!isLastPage) {
                    const prsRes = await this.client.get(`/projects/${projectKey}/repos/${repoSlug}/pull-requests?state=ALL&limit=100&start=${start}`);
                    const data = prsRes.data;
                    const prs = data.values || [];
                    prs.forEach(pr => {
                        const title = pr.title || '';
                        const description = pr.description || '';
                        const branchName = pr.fromRef?.displayId || '';
                        debugPRs.push({
                            id: pr.id,
                            title,
                            description,
                            branchName,
                            matches: regex.test(title) || regex.test(description) || regex.test(branchName)
                        });
                    });
                    // Filter PRs that contain the JIRA ID in title, description, or branch name
                    const matchingPRs = prs.filter(pr => {
                        const title = pr.title || '';
                        const description = pr.description || '';
                        const branchName = pr.fromRef?.displayId || '';
                        return regex.test(title) || regex.test(description) || regex.test(branchName);
                    });
                    for (const pr of matchingPRs) {
                        allPRs.push({
                            title: pr.title,
                            status: pr.state,
                            branch: pr.fromRef?.displayId || '',
                            url: `${this.config.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${pr.id}`,
                            author: pr.author?.user?.displayName || 'Unknown',
                            createdDate: pr.createdDate,
                            updatedDate: pr.updatedDate
                        });
                    }
                    isLastPage = data.isLastPage;
                    start = data.nextPageStart;
                }
            } else {
                // Bitbucket Cloud API - search across workspaces
                // Note: Cloud API requires workspace to be known
                console.log('[BITBUCKET] Cloud API search not fully implemented - provide workspace');
            }

            // Output debug info for all PRs checked
            console.log(`[BITBUCKET][DEBUG] PRs checked for JIRA ID '${jiraId}':`);
            debugPRs.forEach(pr => {
                console.log(`  [${pr.id}] Title: "${pr.title}" | Branch: "${pr.branchName}" | Matches: ${pr.matches}`);
            });

            console.log(`[BITBUCKET] Found ${allPRs.length} PR(s) for ${jiraId}`);
            return allPRs;

        } catch (error) {
            console.error('[BITBUCKET] Error searching PRs:', error.message);
            throw error;
        }
    }
}

module.exports = BitbucketService;
