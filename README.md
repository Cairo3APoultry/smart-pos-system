# Smart POS System

Arabic RTL point-of-sale prototype built as a single static HTML application.

## Run
Open `index.html` in a modern browser, or host it as a static website.

## Included in initial demo
- Responsive Arabic dashboard and navigation
- Products, barcode lookup and prices
- POS cart and local sales receipts
- Stock deductions, adjustments and movement history
- Purchase receiving, customer and supplier lists
- Expenses, simple reports, CSV and JSON exports
- Browser print preview for demo receipts

## Important limitations
**Not production ready.** All data is saved only in the current browser's localStorage. No authentication, backend, multi-user synchronization, authoritative accounting, tax integration, secure backup, offline conflict handling, or hardware printing bridge is implemented. Browser storage can be lost or cleared. Do not use with real customer information or financial operations.

This is an independently written prototype, not source code copied from Hisabak.

## Planned production architecture
- React/TypeScript frontend
- Server-side authentication and authorization
- PostgreSQL transactional database
- Server-validated sales and inventory ledger
- Purchasing, returns, shift closing and audit log
- Printer/device integration, tests, CI/CD and secure hosting

## Deployment
GitHub Pages can serve the static demo after repository Pages settings are enabled. Static hosting does not provide a secure backend.
