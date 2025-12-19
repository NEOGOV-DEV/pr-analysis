/**
 * ================================================================
 * JIRA SERVICE
 * ================================================================
 * 
 * Handles all JIRA API interactions including:
 * - Fetching story details
 * - Fetching acceptance criteria
 * - Fetching linked PRs
 * - Searching for issues
 * 
 * API Documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 * ================================================================
 */

const axios = require('axios');

class JiraService {
    constructor(config) {
        this.config = config.jira;
        this.client = axios.create({
            baseURL: `${this.config.baseUrl}/rest/api/3`,
            auth: {
                username: this.config.email,
                password: this.config.apiToken
            },
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    /**
     * ============================================================
     * FETCH JIRA STORY DETAILS
     * ============================================================
     * Fetches complete story information including description,
     * acceptance criteria, and linked PRs
     */
    async getStoryDetails(jiraId) {
        try {
            console.log(`[JIRA] Fetching story details for ${jiraId}...`);
            
            const response = await this.client.get(`/issue/${jiraId}`, {
                params: {
                    fields: 'summary,description,status,priority,assignee,reporter,components,labels,customfield_10000,remotelink,issuelinks',
                    expand: 'changelog,renderedFields'
                }
            });

            const issue = response.data;
            
            // Store issue ID for other API calls
            this.lastIssueId = issue.id;
            
            // Extract acceptance criteria
            // Note: Acceptance criteria might be in description or a custom field
            const acceptanceCriteria = this.extractAcceptanceCriteria(issue.fields.description);
            
            // Get linked PRs
            const linkedPRs = await this.getLinkedPRs(jiraId);

            return {
                key: issue.key,
                summary: issue.fields.summary,
                description: issue.fields.description?.content || issue.fields.description,
                acceptanceCriteria,
                status: issue.fields.status.name,
                priority: issue.fields.priority?.name || 'Medium',
                components: issue.fields.components.map(c => c.name),
                labels: issue.fields.labels,
                linkedPRs
            };
        } catch (error) {
            console.error(`[JIRA] Error fetching story ${jiraId}:`, error.message);
            throw new Error(`Failed to fetch JIRA story ${jiraId}: ${error.message}`);
        }
    }

    /**
     * ============================================================
     * FETCH MULTIPLE STORIES
     * ============================================================
     * Fetches multiple JIRA stories in parallel
     */
    async getMultipleStories(jiraIds) {
        console.log(`[JIRA] Fetching ${jiraIds.length} stories...`);
        
        const promises = jiraIds.map(id => this.getStoryDetails(id));
        const results = await Promise.allSettled(promises);
        
        const stories = [];
        const errors = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                stories.push(result.value);
            } else {
                errors.push({
                    jiraId: jiraIds[index],
                    error: result.reason.message
                });
            }
        });
        
        return { stories, errors };
    }

    /**
     * ============================================================
     * EXTRACT ACCEPTANCE CRITERIA
     * ============================================================
     * Parses description to extract acceptance criteria
     */
    extractAcceptanceCriteria(description) {
        if (!description) return [];
        
        // Convert JIRA description format to plain text
        let text = typeof description === 'string' ? description : 
                   JSON.stringify(description);
        
        // Look for common patterns
        const patterns = [
            /acceptance criteria[:\s]*([\s\S]*?)(?=\n\n|\z)/i,
            /ac[:\s]*([\s\S]*?)(?=\n\n|\z)/i,
            /criteria[:\s]*([\s\S]*?)(?=\n\n|\z)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                // Split by bullets or numbers
                return match[1]
                    .split(/\n/)
                    .map(line => line.replace(/^[-*•\d.)\s]+/, '').trim())
                    .filter(line => line.length > 0);
            }
        }
        
        return [];
    }

    /**
     * ============================================================
     * GET LINKED PRS FROM JIRA
     * ============================================================
     * Fetches PR links associated with the JIRA ticket
     * Checks both remote links and development information
     */
    async getLinkedPRs(jiraId) {
        try {
            console.log(`[JIRA] ========================================`);
            console.log(`[JIRA] Fetching PR links for ${jiraId}...`);
            console.log(`[JIRA] ========================================`);
            let prLinks = [];
            
            // Method 1: Try remote links API
            try {
                console.log('[JIRA] Method 1: Trying remote links API...');
                const remoteLinkResponse = await this.client.get(`/issue/${jiraId}/remotelink`);
                
                console.log(`[JIRA] Remote links response:`, JSON.stringify(remoteLinkResponse.data, null, 2));
                
                const remoteLinks = remoteLinkResponse.data
                    .filter(link => {
                        const url = link.object?.url || '';
                        const isPR = url.includes('pull-request') || 
                               url.includes('/pull/') ||
                               url.includes('/commits/');
                        if (isPR) {
                            console.log(`[JIRA] Found PR link: ${url}`);
                        }
                        return isPR;
                    })
                    .map(link => ({
                        url: link.object.url,
                        title: link.object.title,
                        status: link.object.status?.resolved ? 'merged' : 'open'
                    }));
                
                prLinks.push(...remoteLinks);
                console.log(`[JIRA] Found ${remoteLinks.length} PRs from remote links`);
            } catch (error) {
                console.warn(`[JIRA] Remote links API failed: ${error.response?.status} - ${error.message}`);
                if (error.response?.data) {
                    console.warn(`[JIRA] Remote links error details:`, error.response.data);
                }
            }
            
            // Method 2: Try development information API (multiple endpoints)
            const devEndpoints = [
                // JIRA Cloud dev-status API with issue key
                {
                    url: `${this.config.baseUrl}/rest/dev-status/1.0/issue/detail`,
                    params: { issueKey: jiraId, applicationType: 'bitbucket', dataType: 'pullrequest' }
                },
                // JIRA Cloud dev-status API with issue ID
                {
                    url: `${this.config.baseUrl}/rest/dev-status/1.0/issue/detail`,
                    params: { issueId: this.lastIssueId, applicationType: 'bitbucket', dataType: 'pullrequest' }
                },
                // Alternative: development information directly
                {
                    url: `${this.config.baseUrl}/rest/dev-status/latest/issue/detail`,
                    params: { issueId: this.lastIssueId, applicationType: 'bitbucket', dataType: 'pullrequest' }
                }
            ];
            
            for (const endpoint of devEndpoints) {
                try {
                    console.log(`[JIRA] Trying dev API: ${endpoint.url} with params:`, endpoint.params);
                    const devResponse = await axios.get(endpoint.url, {
                        params: endpoint.params,
                        auth: {
                            username: this.config.email,
                            password: this.config.apiToken
                        },
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    console.log(`[JIRA] Dev status response:`, JSON.stringify(devResponse.data, null, 2));
                    
                    if (devResponse.data && devResponse.data.detail) {
                        devResponse.data.detail.forEach(detail => {
                            if (detail.pullRequests) {
                                detail.pullRequests.forEach(pr => {
                                    prLinks.push({
                                        url: pr.url,
                                        title: pr.name || pr.title || 'Pull Request',
                                        status: pr.status === 'MERGED' ? 'merged' : 'open'
                                    });
                                });
                            }
                        });
                        console.log(`[JIRA] Found ${devResponse.data.detail[0]?.pullRequests?.length || 0} PRs from dev status`);
                        break; // Stop trying other endpoints if this one works
                    }
                } catch (error) {
                    console.warn(`[JIRA] Dev endpoint failed (${endpoint.url}): ${error.response?.status} - ${error.message}`);
                }
            }
            
            // Remove duplicates based on URL
            const uniquePRs = Array.from(
                new Map(prLinks.map(pr => [pr.url, pr])).values()
            );
            
            console.log(`[JIRA] Total unique PRs found: ${uniquePRs.length}`);
            
            // If still no PRs found, try to extract from HTML page
            if (uniquePRs.length === 0) {
                console.log(`[JIRA] ========================================`);
                console.log(`[JIRA] ⚠️  NO PR LINKS FOUND via API`);
                console.log(`[JIRA] ========================================`);
                console.log(`[JIRA] Possible reasons:`);
                console.log(`[JIRA] 1. The PR might be in Bitbucket Development panel but not linked via API`);
                console.log(`[JIRA] 2. You may need JIRA application link configuration for Bitbucket integration`);
                console.log(`[JIRA] 3. The PR might not have been linked to the JIRA ticket`);
                console.log(`[JIRA] 4. Your JIRA API token may not have permissions to access dev-status APIs`);
                console.log(`[JIRA] `);
                console.log(`[JIRA] Configuration steps:`);
                console.log(`[JIRA] - Verify Bitbucket is linked in JIRA Admin > Applications > Application Links`);
                console.log(`[JIRA] - Ensure the PR is properly linked in the JIRA ticket Development panel`);
                console.log(`[JIRA] - You can manually enter the PR URL as a workaround`);
                console.log(`[JIRA] ========================================`);
            } else {
                console.log(`[JIRA] ========================================`);
                console.log(`[JIRA] ✅ Successfully found ${uniquePRs.length} PR link(s):`);
                uniquePRs.forEach((pr, idx) => {
                    console.log(`[JIRA]   ${idx + 1}. ${pr.url} (${pr.status})`);
                });
                console.log(`[JIRA] ========================================`);
            }
            
            return uniquePRs;
        } catch (error) {
            console.warn(`[JIRA] Could not fetch PR links for ${jiraId}:`, error.message);
            return [];
        }
    }

    /**
     * ============================================================
     * SEARCH JIRA ISSUES
     * ============================================================
     * Search for JIRA issues using JQL
     */
    async searchIssues(jql, maxResults = 50) {
        try {
            const response = await this.client.get('/search', {
                params: {
                    jql,
                    maxResults,
                    fields: 'summary,key,status,priority'
                }
            });
            
            return response.data.issues;
        } catch (error) {
            console.error('[JIRA] Search error:', error.message);
            throw new Error(`JIRA search failed: ${error.message}`);
        }
    }
}

module.exports = JiraService;
