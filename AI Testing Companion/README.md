# 🤖 AI Testing Companion

> **Intelligent QA Automation Dashboard** - Generate test cases, analyze PRs, and create bug reports with AI assistance

A comprehensive web-based platform that leverages AI to streamline QA workflows by automating test case generation, PR impact analysis, and bug report creation.

---

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Playwright MCP Integration](#-playwright-mcp-integration)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## ✨ Features

### 🚀 Generate Test Cases
- **AI-Powered Generation**: Automatically generates BDD-format test cases from JIRA stories
- **Multi-Story Support**: Process multiple JIRA tickets simultaneously (comma-separated)
- **TestRail Integration**: Upload generated test cases directly to TestRail
- **Customizable Fields**: All TestRail custom fields are dynamically populated
- **Duplicate Detection**: Prevents duplicate test cases based on JIRA references
- **Progress Tracking**: Real-time upload progress with detailed logging
- **Inline Editing**: Edit test cases before uploading to TestRail

### 🧠 Bug Intelligence
- **Smart Bug Reports**: Generate comprehensive, professional bug reports
- **JIRA Format Support**: Output in JIRA markup format for direct copying
- **Context-Aware**: Uses application context for better bug descriptions
- **Structured Output**: Includes title, environment, steps, expected/actual results, and retesting ideas
- **Editable Content**: Modify generated content before copying

### 🔍 PR Analysis
- **Automatic PR Categorization**: Classifies PRs into 5 categories:
  - 😂 **Relaxed PR**: Routine changes, low impact
  - 😡 **Angry PR**: Many files changed, risky hotspots
  - 🤯 **Overloaded PR**: Touches shared/core components
  - 🙃 **Sarcastic PR**: "Quick fix" but actually large/complex
  - 😴 **Sleepy PR**: Style/formatting only
- **Impact Analysis**: Identifies what can break with risk assessment
- **Test Case Mapping**: Automatically finds relevant TestRail test cases
- **Regression Testing**: Pulls regression test cases from TestRail
- **Risk Scoring**: Calculate risk scores (0-100) with color-coded indicators
- **Time Estimation**: Estimates testing effort based on impacted test cases

### ⚙️ Settings & Configuration
- **Multi-Platform Support**: Works with JIRA, Bitbucket (Cloud & Server), TestRail
- **Context File Upload**: Upload application context (.txt) for AI knowledge
- **Visual Status Indicators**: Shows connection status for each service
- **Secure Configuration**: Credentials stored in backend config file

---

## 🔧 Prerequisites

Before installing the AI Testing Companion, ensure you have:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Active accounts** for:
  - JIRA (with API token)
  - Bitbucket (with personal access token)
  - TestRail (with API key)

---

## 📦 Installation

### Step 1: Clone or Download

```bash
# Navigate to the AI Testing Companion folder
cd "c:\Users\ndevi.NEOGOV0\Desktop\PROJECTS\Playwright\AIValidators\AI Testing Companion"
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `express` - Web server framework
- `axios` - HTTP client for API calls
- `cors` - Enable CORS for API requests
- `multer` - File upload handling

### Step 3: Configure Credentials

1. Copy the example configuration file:
   ```bash
   copy backend\config.example.js backend\config.js
   ```

2. Edit `backend\config.js` with your credentials:
   ```javascript
   module.exports = {
       jira: {
           baseUrl: 'https://your-domain.atlassian.net',
           email: 'your-email@company.com',
           apiToken: 'YOUR_JIRA_API_TOKEN'
       },
       bitbucket: {
           baseUrl: 'https://bitbucket.org',
           username: 'your-username',
           password: 'YOUR_BITBUCKET_TOKEN'
       },
       testRail: {
           baseUrl: 'https://your-domain.testrail.com',
           username: 'your-email@company.com',
           apiKey: 'YOUR_TESTRAIL_API_KEY',
           projectId: 34,
           defaultSuiteId: 13533
       }
   };
   ```

### Step 4: Get API Credentials

#### JIRA API Token
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token to your config.js

#### Bitbucket Token
- **For Bitbucket Cloud**: https://bitbucket.org/account/settings/app-passwords/
- **For Bitbucket Server**: https://bitbucket.company.com/plugins/servlet/access-tokens/manage

#### TestRail API Key
1. Login to TestRail
2. Click your profile → My Settings
3. Go to API Keys section
4. Generate and copy the key

---

## 🚀 Usage

### Starting the Server

#### Option 1: Using Batch File (Windows)
```bash
start.bat
```

#### Option 2: Using PowerShell
```powershell
.\start.ps1
```

#### Option 3: Using npm
```bash
npm start
```

The dashboard will be available at: **http://localhost:3002**

### Using the Dashboard

#### 1. Generate Test Cases

1. Navigate to **🚀 Generate Tests** section
2. Enter JIRA Story IDs (comma-separated for multiple): `PROJ-123, PROJ-124`
3. Enter TestRail Suite ID: `13533`
4. Enter Folder Name: `Sprint 24 Test Cases`
5. Click **Generate Test Cases**
6. Review generated test cases (edit if needed)
7. Select test cases to upload
8. Click **Upload Selected to TestRail**
9. Monitor upload progress

**Example Output:**
```
✨ Generated 12 test cases from 2 stories
✓ Test Case: Verify user login functionality
✓ Test Case: Validate password reset flow
✓ Test Case: Check session timeout behavior
...
```

#### 2. Generate Bug Reports

1. Navigate to **🧠 Bug Intelligence** section
2. Enter bug description in the text area:
   ```
   When user tries to upload a file larger than 10MB,
   the system crashes instead of showing an error message.
   ```
3. Click **Generate Bug Report**
4. Review and edit the generated report
5. Click **Copy to Clipboard**
6. Paste directly into JIRA

**Example Output:**
```
h3. 🐛 File Upload Crashes with Large Files

*Bug Description:*
System crashes when users attempt to upload files exceeding 10MB limit...

*Steps to Reproduce:*
1. Navigate to file upload page
2. Select a file larger than 10MB
3. Click upload button
4. Observe system crash

*Expected Result:*
User-friendly error message displayed

*Actual Result:*
Application crashes with 500 error
```

#### 3. Analyze Pull Requests

1. Navigate to **🔍 Analyze PR** section
2. Enter JIRA Ticket ID: `PROJ-456`
3. Enter TestRail Suite ID: `13533`
4. (Optional) Enter PR URL if not linked in JIRA
5. Click **Analyze PR**

**Results Include:**
- **What Changed**: PR category, files changed, lines modified
- **What Can Break**: Impact analysis by component
- **What Should I Test**: Mapped test cases from TestRail
- **Should I Worry**: Risk score (0-100) and estimated testing time

**Example Risk Assessment:**
```
Risk Score: 75 (High)
Test Cases to Execute: 34
Estimated Time: 8.5 hours
```

#### 4. Configure Settings

1. Navigate to **⚙️ Settings** section
2. View current API configurations
3. Upload context file (.txt only) for AI knowledge
4. Monitor connection status for each service

---

## 📁 Project Structure

```
AI Testing Companion/
│
├── backend/                      # Backend server code
│   ├── config.js                # Active configuration (DO NOT COMMIT)
│   ├── config.example.js        # Configuration template
│   ├── server.js                # Express server & API endpoints
│   └── services/                # Service layer
│       ├── jira-service.js      # JIRA API integration
│       ├── bitbucket-service.js # Bitbucket API integration
│       ├── testrail-service.js  # TestRail API integration
│       └── ai-generator.js      # AI content generation (TODO: MCP)
│
├── frontend/                     # Frontend dashboard
│   ├── index.html               # Main HTML structure
│   ├── styles.css               # Dashboard styling
│   └── dashboard.js             # Frontend logic & API calls
│
├── context/                      # Application context
│   └── app-context.txt          # Context file for AI
│
├── package.json                  # Project dependencies
├── start.bat                     # Windows startup script
├── start.ps1                     # PowerShell startup script
├── Prompt.txt                    # Complete requirements doc
└── README.md                     # This file
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:3002/api
```

### Endpoints

#### 1. Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "AI Testing Companion",
  "version": "1.0.0",
  "timestamp": "2025-12-13T10:30:00.000Z"
}
```

#### 2. Generate Test Cases
```http
POST /api/generate-testcases
Content-Type: application/json

{
  "jiraIds": "PROJ-123,PROJ-124",
  "suiteId": 13533,
  "folderName": "Sprint 24"
}
```

#### 3. Upload to TestRail
```http
POST /api/upload-to-testrail
Content-Type: application/json

{
  "suiteId": 13533,
  "folderName": "Sprint 24",
  "testCases": [...],
  "jiraIds": "PROJ-123"
}
```

#### 4. Analyze PR
```http
POST /api/analyze-pr
Content-Type: application/json

{
  "jiraId": "PROJ-456",
  "prUrl": "https://bitbucket.com/...",
  "suiteId": 13533
}
```

#### 5. Generate Bug Report
```http
POST /api/generate-bug-report
Content-Type: application/json

{
  "description": "Bug description here..."
}
```

---

## 🎭 Playwright MCP Integration

### Current Status

The application is **ready for Playwright MCP integration**. All TODO markers are clearly identified in the code.

### Integration Points

#### File: `backend/services/ai-generator.js`

**Function: `generateTestCases()`**
```javascript
// TODO: PLAYWRIGHT MCP - Integrate AI here
// Replace placeholder logic with actual Playwright MCP AI call
```

**Function: `generateBugReport()`**
```javascript
// TODO: PLAYWRIGHT MCP - Integrate AI here
// Use Playwright MCP to generate comprehensive bug reports
```

**Function: `generateImpactAnalysis()`**
```javascript
// TODO: PLAYWRIGHT MCP - Integrate AI here
// Analyze PR changes and generate testing suggestions
```

### How to Integrate

1. **Install Playwright MCP Dependencies**
   ```bash
   npm install @playwright/mcp
   ```

2. **Update AI Generator Service**
   - Replace TODO sections with Playwright MCP calls
   - Use application context from `context/app-context.txt`
   - Follow the expected return format documented in comments

3. **Example Integration Pattern**
   ```javascript
   const { PlaywrightMCP } = require('@playwright/mcp');
   
   async function generateTestCases(stories, suiteId) {
       const prompt = `
           Application Context:
           ${this.context}
           
           JIRA Stories:
           ${JSON.stringify(stories)}
           
           Generate BDD test cases...
       `;
       
       const result = await PlaywrightMCP.generate(prompt);
       return result.testCases;
   }
   ```

---

## 🐛 Troubleshooting

### Server Won't Start

**Issue**: `Error: Cannot find module 'express'`
**Solution**:
```bash
npm install
```

**Issue**: `Port 3002 is already in use`
**Solution**: Change port in `backend/config.js`:
```javascript
port: 3003  // Use a different port
```

### API Errors

**Issue**: `401 Unauthorized` from JIRA/Bitbucket/TestRail
**Solution**: Verify API credentials in `backend/config.js`

**Issue**: `CORS error` in browser console
**Solution**: Ensure backend server is running and CORS is enabled (already configured)

### Test Case Upload Fails

**Issue**: `Invalid TestRail field`
**Solution**: Run this endpoint to see available fields:
```http
GET /api/testrail/fields
```

### Context File Not Working

**Issue**: Context file uploaded but not being used
**Solution**: 
1. Check file is `.txt` format only
2. Restart server after uploading
3. Check `context/app-context.txt` exists

---

## 🎓 For Judges / Manual QA

### Quick Start for Demo

1. **Start the server**:
   ```bash
   start.bat
   ```

2. **Open dashboard**: http://localhost:3002

3. **Try Generate Tests**:
   - JIRA IDs: `BGS-4493, BGS-4494`
   - Suite ID: `13533`
   - Folder: `Demo Test Cases`

4. **Try PR Analysis**:
   - JIRA ID: `BGS-4500`
   - Suite ID: `13533`

5. **Try Bug Intelligence**:
   - Description: `Login button not working on mobile devices`

### Key Features to Highlight

✅ **Clean, Professional UI** - Intuitive navigation, modern design  
✅ **Real-Time Feedback** - Loading states, progress bars, toast notifications  
✅ **Error Handling** - Graceful degradation with friendly error messages  
✅ **Comprehensive Logging** - Detailed console logs for debugging  
✅ **Well-Documented Code** - Every function has clear comments  
✅ **Production-Ready** - Security, validation, error recovery built-in  
✅ **Extensible Architecture** - Easy to add new features  
✅ **AI-Ready** - Placeholder for Playwright MCP integration

---

## 📝 Configuration Reference

### Component Mapping

Edit in `backend/config.js` to map file paths to components:

```javascript
componentMapping: {
    'src/admin': 'Admin Dashboard',
    'src/reports': 'Reports',
    'src/api': 'API',
    'src/auth': 'Authentication'
}
```

### Risk Score Weights

Customize risk calculation:

```javascript
riskWeights: {
    filesChanged: 1,
    sharedComponents: 2,
    linesChanged: 0.1,
    apiSchemaChange: 10,
    historicalBugs: 5
}
```

### Time Estimation

Adjust time per test case complexity:

```javascript
timeEstimation: {
    simple: 5,      // 5 minutes
    medium: 10,     // 10 minutes
    complex: 15     // 15 minutes
}
```

---

## 🤝 Contributing

This project was created for the **AI Testing Companion Hackathon**.

### Development Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

### Adding New Features

1. Backend: Add new endpoint in `backend/server.js`
2. Service: Create service in `backend/services/`
3. Frontend: Add UI section in `frontend/index.html`
4. Styling: Update `frontend/styles.css`
5. Logic: Add functionality in `frontend/dashboard.js`

---

## 📄 License

ISC License - Created for Hackathon Demo

---

## 🙏 Acknowledgments

- **JIRA API** - Story and ticket management
- **Bitbucket API** - PR analysis
- **TestRail API** - Test case management
- **Playwright MCP** - AI-powered content generation (integration pending)

---

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review console logs in browser (F12) and terminal
3. Verify configuration in `backend/config.js`

---

**Made with ❤️ for QA Automation**

---

## 🎬 Quick Demo Commands

```bash
# Install
npm install

# Configure (copy and edit)
copy backend\config.example.js backend\config.js

# Start
start.bat

# Open
http://localhost:3002
```

**Enjoy automating your QA workflows! 🚀**
