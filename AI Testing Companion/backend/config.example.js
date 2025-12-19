/**
 * ================================================================
 * AI TESTING COMPANION - Configuration Template
 * ================================================================
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file and rename it to 'config.js'
 * 2. Fill in your actual API credentials below
 * 3. Never commit config.js to version control
 * 
 * ================================================================
 */

module.exports = {
    // ============================================================
    // SERVER CONFIGURATION
    // ============================================================
    port: parseInt(process.env.PORT) || 3002,

    // ============================================================
    // JIRA API CONFIGURATION
    // ============================================================
    // Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens
    jira: {
        baseUrl: process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net',
        email: process.env.JIRA_EMAIL || 'your-email@company.com',
        apiToken: process.env.JIRA_API_TOKEN || 'YOUR_JIRA_API_TOKEN_HERE'
    },

    // ============================================================
    // BITBUCKET API CONFIGURATION
    // ============================================================
    // For Bitbucket Cloud: Use App Password
    // For Bitbucket Server/Data Center: Use Personal Access Token
    // Create token at: https://bitbucket.org/account/settings/app-passwords/
    bitbucket: {
        baseUrl: process.env.BITBUCKET_BASE_URL || 'https://bitbucket.org',
        // For Bitbucket Cloud: Use username
        // For Bitbucket Server: Use email
        username: process.env.BITBUCKET_USERNAME || 'your-username',
        // For Bitbucket Cloud: Use App Password
        // For Bitbucket Server: Use Personal Access Token
        password: process.env.BITBUCKET_PASSWORD || 'YOUR_BITBUCKET_TOKEN_HERE'
    },

    // ============================================================
    // TESTRAIL API CONFIGURATION
    // ============================================================
    // Get your API key from: https://your-domain.testrail.com/index.php?/admin/users/view/YOUR_USER_ID
    testRail: {
        baseUrl: process.env.TESTRAIL_BASE_URL || 'https://your-domain.testrail.com',
        username: process.env.TESTRAIL_USERNAME || 'your-email@company.com',
        apiKey: process.env.TESTRAIL_API_KEY || 'YOUR_TESTRAIL_API_KEY_HERE',
        projectId: parseInt(process.env.TESTRAIL_PROJECT_ID) || 1,
        // Default suite ID for test case generation
        defaultSuiteId: parseInt(process.env.TESTRAIL_SUITE_ID) || 1
    },

    // ============================================================
    // COMPONENT MAPPING (For PR Analysis)
    // ============================================================
    // Maps file paths to TestRail component names
    // Used to identify impacted test cases based on changed files
    componentMapping: {
        'src/admin': 'Admin Dashboard',
        'src/reports': 'Reports',
        'src/api': 'API',
        'src/auth': 'Authentication',
        'src/user': 'User Management',
        'src/dashboard': 'Dashboard',
        // Add more mappings as needed
    },

    // ============================================================
    // TIME ESTIMATION SETTINGS
    // ============================================================
    // Default time estimates for test execution (in minutes)
    timeEstimation: {
        simple: 5,      // Tests with <= 5 steps
        medium: 10,     // Tests with 6-10 steps
        complex: 15     // Tests with > 10 steps
    },

    // ============================================================
    // RISK SCORE WEIGHTS (For PR Analysis)
    // ============================================================
    // Used to calculate risk scores for PRs
    riskWeights: {
        filesChanged: 1,
        sharedComponents: 2,
        linesChanged: 0.1,
        apiSchemaChange: 10,
        historicalBugs: 5
    },

    // ============================================================
    // REGRESSION TEST IDENTIFICATION
    // ============================================================
    // How to identify regression tests in TestRail
    regressionIdentification: {
        method: 'folder',  // Options: 'folder' or 'field'
        // If method is 'folder': looks for folders containing this keyword
        folderKeyword: 'Regression',
        // If method is 'field': looks for this custom field and value
        fieldName: 'Test Type',
        fieldValue: 'Regression'
    },

    // ============================================================
    // FEATURE FLAGS
    // ============================================================
    features: {
        enableCaching: false,
        cacheTimeout: 3600,
        enableDetailedLogs: true,
        maxConcurrentRequests: 5
    }
};
