# PR Analysis: Integrating JIRA, Bitbucket, and TestRail for Intelligent QA

## Problem Statement

Modern software development involves rapid changes, multiple teams, and complex codebases. Quality Assurance (QA) teams face significant challenges:
- Identifying which test cases are impacted by a given Pull Request (PR)
- Mapping code changes to requirements, test cases, and risk areas
- Reducing manual effort in regression selection and risk analysis
- Ensuring traceability between JIRA issues, code (Bitbucket), and test coverage (TestRail)

Manual processes are error-prone, slow, and do not scale with fast-moving projects. This leads to missed tests, redundant work, and increased risk of production defects.

## Solution: Automated PR Analysis with Deep Integration

We implemented a robust integration between JIRA, Bitbucket, and TestRail to automate PR analysis and test case selection. Our solution:

- **JIRA Integration**: Extracts issue keys, components, and context from PR titles, descriptions, and linked issues.
- **Bitbucket Integration**: Fetches PR details, changed files, and branch metadata, even across large repositories.
- **TestRail Integration**: Maps JIRA components and file keywords to TestRail test cases and sections, using a traceability matrix.
- **Intelligent Matching**: Handles complex component names (camelCase, hyphens, multi-word), and performs both exact and partial matching.
- **Risk & Effort Estimation**: Scores and groups test cases by relevance, functional area, and risk, providing QA with clear impact and time estimates.
- **UI Dashboard**: Presents results in a collapsible, user-friendly dashboard, highlighting impacted areas, risk factors, and recommended tests.

## Features & Highlights

- **Automated Traceability**: No more manual mapping—PRs are analyzed in real time, and relevant test cases are surfaced instantly.
- **Robust Component Matching**: Advanced logic splits and matches component names regardless of format, ensuring no test is missed.
- **Effort Reduction**: QA can focus on the most relevant tests, reducing regression effort by up to 70%.
- **Risk Visibility**: Clear risk and impact analysis helps prioritize testing and release decisions.
- **Scalable & Configurable**: Works across large codebases and test suites, with easy configuration for new projects.
- **Error Handling & Debugging**: Detailed logs and debug output make it easy to trace issues and continuously improve the process.

## Effort & Impact for QA

- **Time Savings**: Automated selection and grouping of test cases saves hours per PR.
- **Quality Improvement**: Reduces the risk of missing critical tests, leading to higher product quality.
- **Judge-Ready Innovation**: Demonstrates a practical, scalable solution to a real-world QA bottleneck, leveraging modern DevOps integrations.

## Summary

By deeply integrating JIRA, Bitbucket, and TestRail, we have transformed PR analysis from a manual, error-prone task into an intelligent, automated process. This empowers QA teams to deliver higher quality with less effort, and provides clear, actionable insights for every code change.

## Explaining PR Categories

To further streamline QA effort, our solution automatically classifies each PR into categories based on the number and type of files changed. Categories such as "Relaxed", "Sleepy", "Sarcastic", "Overloaded", and "Angry" indicate the expected risk and testing effort:

- **Relaxed**: Small, low-risk PRs (few files changed) – minimal regression needed.
- **Sleepy**: Moderate changes – targeted regression recommended.
- **Sarcastic**: Larger, more complex PRs – broader regression required.
    Appears small but modifies shared or sensitive logic, increasing hidden regression risk.
- **Overloaded**: High-impact PRs – extensive regression and risk review.
- **Angry**: Very large or risky PRs – full regression and deep analysis.

😂 Relaxed PR: Routine changes, low impact
😡 Angry PR: Many files changed, risky hotspots 
🤯 Overloaded PR: touches shared components
🙃 Sarcastic PR: quick fixes that aren’t actually quick
😴 Sleepy PR: repetitive style-only changes

This categorization helps QA quickly assess the scope of testing required, allocate resources efficiently, and communicate risk to stakeholders in a clear, standardized way.
