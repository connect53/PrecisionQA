# PrecisionQA Project Constitution

This document contains the permanent architectural guidelines, performance standards, UI principles, and database rules for **PrecisionQA**. All future changes and modules must strictly comply with these rules.

---

## 1. Product Vision
PrecisionQA is an Enterprise Quality Management Platform designed to support:
- Voice Audits
- Chat Audits
- Email Audits
- Backoffice Audits
- Catalog QC
- Compliance, Healthcare, Finance, Insurance, Retail, Logistics, Manufacturing, and Custom Business Processes.
- The platform must adapt dynamically to customer data instead of forcing customers to adapt to the platform.

## 2. Configurable Architecture
- Every module must be configuration-driven (no hardcoded structures).
- Forms, Questions, Roles, Permissions, Assignment Rules, Reports, Dashboards, Notifications, Approval Flows, and Import Mappings must be fully configurable.

## 3. Database Rules
- Never create unnecessary tables or duplicate data; keep relationships normalized.
- Use PostgreSQL best practices.
- Store customer-specific columns as JSONB metadata (e.g., `metadata: { seller, brand, warehouse, custom_fields }`) rather than creating custom relational columns.

## 4. Master Data
- Master data should exist exactly once.
- Never duplicate: Users, Roles, Permissions, Teams, Clients, LOBs, Processes, Departments, Groups, Settings, Attendance, Reference Lists, Audit Templates, or Scorecards.

## 5. Import Engine
- Support Google Sheets, Excel, and CSV files.
- Never assume fixed columns. The only mandatory fields are `Case ID` and `Agent Email` (with optional `Agent Name` and `Audit Date`). All other columns are parsed as JSONB metadata.
- Support reusable Import Profiles.

## 6. Form Engine & Audit Workspace
- Scorecard forms must be fully generated dynamically. Never hardcode questions.
- Support unlimited forms, version history, Formula Fields, Lookup Fields, and Conditional Visibility.
- The Audit Workspace must render UI controls dynamically based on the active template.

## 7. Assignment Engine
- Support multiple assignment strategies: Random, Round Robin, Balanced, Header-Based, and Future AI Assignment.
- Never assume assignment is limited to Teams only.

## 8. Reporting & Performance (Free Tier Optimization)
- **Do NOT calculate dashboards live.** Always maintain summary/aggregation tables.
- Update summary tables asynchronously when an Import completes, Audit is submitted, Feedback is released, Dispute is closed, or Attendance is imported. Dashboard queries must only read from these cached/summary tables.
- **Pagination**: Default page size to `50` with infinite scrolling or lazy loading. Never load complete datasets.
- Support Search, Filters, Sorting, and Saved Filters in all large modules.
- Cache master data, dashboard summaries, user profiles, and permissions to minimize database reads/writes on free tiers.

## 9. Background Processing
- Heavy operations (Bulk Imports, Assignments, Notifications, Dashboard Refresh, Report Generation) must run asynchronously to avoid blocking the UI.
- Use event-driven, lightweight updates rather than expensive polling.

## 10. Security & Access Control
- Permissions must be configuration-driven (no hardcoded role checks).
- Every query must respect client boundaries and role permissions. No tenant should ever access another tenant's data.

## 11. UI & Design System
- One feature = One module. Do not create separate pages or navigation items for connected steps (e.g., Import, Header Detection, Mapping, Validation, QA Builder, Assignment, and Summary must reside within a single integrated Import Case workflow).
- Maintain absolute consistency in Buttons, Cards, Typography (Inter/Space Grotesk), Spacing, Icons, Tables, Dialogs, Colors, and Loading/Skeleton states.

---

*Note: These standards are permanent and must be referenced before implementing any future features or updates.*
