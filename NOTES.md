# Project Notes

*This document was generated with AI assistance.*

## Key Decisions and Code Changes

*   **Report Processing:** Implemented a robust report processing system using database persistence. This allows for separate report requests based on ID and generates separate files for each request, preventing overrides. Replaced in-memory state with database persistence.
*   **Ticket System:**
    *   Introduced a "strike off" ticket type.
    *   Implemented transaction handling for resolving tickets and creating strike-off tickets to ensure data integrity.
    *   Moved "create ticket" business logic into a service.
    *   Added a backup user role to the ticket type mapping.
    *   Separated various logics and added error handling for duplicate `registrationAddressChange` creation.
    *   Implemented a ticket type rule mapping service.
*   **User Roles:** Added a "director" user role.
*   **Database:** Added `createdAt` and `updatedAt` fields to models, which were present in database migrations but missing in the model definitions.
*   **Testing:**
    *   Added tests for the reports service.
    *   Added tests for the reports controller.
    *   Added tests for the tickets controller, including coverage for the service.
*   **Async File System Operations:** Replaced synchronous file system (fs) calls with asynchronous versions to improve performance and avoid blocking I/O operations.
*   **Database Status Updates in `ReportsService`:**
    *   The `ReportsService` methods (`accounts`, `yearly`, `fs`) were updated to include  updating the report status in the database at various stages of processing. This ensures that the status of each report (e.g., pending, processing, completed, failed) is accurately tracked.
*   **API Asynchronicity:** The API related to report generation was made asynchronous, allowing for background processing of reports.
*   **Corporate Category Value:** Corrected the corporate category value.

## AI Usage

*   **Test Case Generation:** AI was utilized to assist in generating test cases, particularly for:
    *   `reports.controller.spec.ts`
    *   `reports.service.spec.ts`
    *   `tickets.controller.spec.ts`
    *   The AI helped in scaffolding test structures and suggesting relevant assertions based on the existing codebase.
*   **Refactoring Synchronous Calls:** AI assisted in identifying and refactoring synchronous `fs` (file system) calls to their asynchronous counterparts. This improves performance and prevents blocking operations.
*   **Boilerplate Code Generation:** AI was used for bulk boilerplate changes, such as:
    *   Updating the status in the database within each method of the `ReportsService`. This likely involved adding database update calls (e.g., `Report.update(...)`) at the beginning and end of methods like `accounts`, `yearly`, and `fs` in `src/reports/reports.service.ts` to reflect the processing status of a report.

## Potential Improvements & Ambiguities

*   **`src/tickets/tickets.service.ts`:** 
    *   A comment in the `createTicket` method notes an ambiguity: `// NOTE: There\'s ambiguity in the requirements about whether the strikeOff ticket itself // should also be resolved immediately. Currently I am keeping it open.` This suggests a potential area for clarification in the project requirements.
*   **`src/reports/reports.service.ts`:**
    *   A comment in the `onModuleInit` method mentions: `// choosing a reasonable interval to avoid overloading the system, ideally this should be a seperate job processing reports // in a queue system, but for simplicity, I choose a polling mechanism`. This indicates a potential future improvement to move to a more robust queue-based system for report processing.

This document provides a summary of key decisions and changes. For detailed information, refer to the specific commit messages and code diffs.
