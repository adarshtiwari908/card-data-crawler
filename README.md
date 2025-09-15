### Card Crawler

A Node.js crawler that extracts structured credit card details from a bank’s website and PDFs, validates and aggregates the information, and saves the result as rich JSON for downstream use.

### Features
- **Multi-source extraction**: HTML pages and linked PDFs
- **Smart link handling**: ignores irrelevant routes, prioritizes relevant ones
- **Structured parsing**: converts raw content into a card schema
- **Validation + scoring**: quality checks with detailed errors/warnings
- **Aggregation**: merges fields from multiple sources with completeness report
- **Configurable**: via `src/config/settings.js` and environment variables
- **Robustness**: retries, rate limiting, and graceful error handling

### Tech Stack
- Node.js (CommonJS), Axios, Cheerio, pdf-parse, fs-extra, dotenv, Chalk

### Project Structure
```text
src/
  index.js                 # Orchestrates the full crawl → parse → validate → save pipeline
  config/settings.js       # All tunables: URL, crawler limits, priorities, output rules
  crawler/
    htmlCrawler.js         # Fetch + parse HTML into text + link set
    linkHandler.js         # Score, filter, and categorize internal/PDF links
    pdfParser.js           # Download and extract text from PDFs
  parser/cardDataParser.js # Extracts card fields from raw text
  validator/cardDataValidator.js # Validates fields, returns score + issues
  aggregator/cardDataAggregator.js # Merges sources, computes completeness
  schema/cardSchema.js     # Target schema and helpers
  utils/*                  # Logging, files, validation helpers, rate limiting, etc.
data/
  output/                  # Final JSON outputs
  pdfs/                    # Cached PDFs (optional)
```

### Prerequisites
- Node.js 18+ recommended

### Installation
```bash
git clone https://github.com/adarshtiwari908/card-data-crawler.git
cd card-crawler
npm install
```

### Quick Start
```bash
npm start
```
- Runs `node src/index.js`, crawls the configured `cardUrl`, and writes a timestamped JSON under `data/output/`, e.g.:
- `data/output/regalia-gold-credit-card-2025-09-15.json`

### Development
```bash
npm run dev
```
- Uses `nodemon` for auto-reload.

### Configuration
Primary config lives in `src/config/settings.js`. You can override many options via environment variables.

---

To crawl a different card page, change `cardUrl` and `baseDomain` in `src/config/settings.js`:
```javascript
cardUrl: 'https://www.examplebank.com/cards/some-card',
baseDomain: 'examplebank.com',
```

You can also tweak:
- `ignorePatterns`: regexes of routes/file types to skip
- `priorityPatterns`: regexes with weights to rank relevant links
- `categories`: grouping rules for link classification
- `crawler` limits: `maxPages`, `maxPDFs`, `requestDelayMs`, `concurrency`, etc.

### How It Works
1. Fetch the main `cardUrl` and extract text + links.
2. Score, filter, and split links into internal HTML pages and PDFs.
3. Crawl a limited number of internal pages and parse their content.
4. Download and parse a limited number of PDFs.
5. Aggregate parsed fields, deduplicate, and compute completeness.
6. Validate against the schema and produce a quality score.
7. Save a single JSON including:
   - `cardData` (final merged fields)
   - `extractionMetadata` (durations, completeness, validation stats)
   - `sources` (per-source data/uris)
   - `validationDetails` (errors/warnings)

### Example Output (truncated)
```json
{
  "cardUrl": "https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card",
  "extractionMetadata": {
    "extractedAt": "2025-09-15T09:12:34.567Z",
    "processingTimeMs": 12345,
    "cardCrawlerVersion": "2.0.0",
    "validation": { "isValid": true, "score": 92.5, "errors": 0, "warnings": 2 },
    "completeness": { "completenessPercentage": 88.0 }
  },
  "cardData": {
    "cardName": "Regalia Gold Credit Card",
    "annualFee": "₹2500",
    "joiningFee": "₹2500"
  },
  "sources": [
    { "type": "html", "url": "...", "fields": { } }
  ],
  "validationDetails": {
    "errors": [],
    "warnings": []
  }
}
```
