require('dotenv').config();

module.exports = {
  cardUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card',

  baseDomain: 'hdfcbank.com',

  crawler: {
    maxDepth: 2,
    maxPages: parseInt(process.env.MAX_PAGES) || 10,
    maxPDFs: parseInt(process.env.MAX_PDFS) || 5,
    requestDelayMs: parseInt(process.env.REQUEST_DELAY) || 1500,
    retryAttempts: 3,
    retryDelayMs: 2000,
    concurrency: parseInt(process.env.CONCURRENCY) || 2,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },

  ignorePatterns: [
    /\/login/,
    /\/netbanking/,
    /\/mycards/,
    /\/careers/,
    /\/investor-relations/,
    /\/press-releases/,
    /\/money-transfer/,
    /\/upi/,
    /\/donation/,
    /\/remittance/,
    /\/forex/,
    /\/bill-pay/,
    /\/recharge/,
    /\/fastag/,
    /\/demat/,
    /\/mutual-fund/,
    /\/loan/,
    /\/deposit/,
    /\/savings/,
    /\/current-account/,
    /\/debit-card/,
    /\/business-card/,
    /\/commercial-card/,
    /\/tax/,
    /\/insurance(?!.*credit)/,
    /\/personal-loan/,
    /\/home-loan/,
    /javascript:/,
    /mailto:/,
    /tel:/,
    /\#$/,
    /\/search/,
    /\/sitemap/,
    /\/privacy-policy/,
    /\/cookie-policy/,
    /\/contact/,
    /\/about/,
    /\.css$/,
    /\.js$/,
    /\.jpg$/,
    /\.png$/,
    /\.gif$/,
    /\.svg$/,
    /\{\{.*\}\}/,
    /%7B%7B.*%7D%7D/,
    /CCredit/,
    /immediiate/,
    /nationnal/,
    /remitnnow/,
    /[^:]\/{3,}/,
  ],

  priorityPatterns: [
    { pattern: /regalia.*gold/i, weight: 25 },
    { pattern: /credit.*card/i, weight: 20 },
    { pattern: /fees.*charges/i, weight: 18 },
    { pattern: /terms.*conditions/i, weight: 15 },
    { pattern: /benefits/i, weight: 12 },
    { pattern: /rewards/i, weight: 10 },
    { pattern: /cashback/i, weight: 10 },
    { pattern: /points/i, weight: 9 },
    { pattern: /eligibility/i, weight: 8 },
    { pattern: /insurance/i, weight: 8 },
    { pattern: /coverage/i, weight: 8 },
    { pattern: /tnc/i, weight: 15 },
    { pattern: /\.pdf$/i, weight: 12 },
    { pattern: /pricing/i, weight: 8 },
    { pattern: /apply/i, weight: 7 },
    { pattern: /features/i, weight: 9 },
    { pattern: /offers/i, weight: 8 },
    { pattern: /lounge/i, weight: 7 },
    { pattern: /milestone/i, weight: 7 },
  ],

  categories: [
    { name: 'fees', pattern: /fees|charges|pricing/i },
    { name: 'terms', pattern: /terms|tnc|conditions/i },
    { name: 'benefits', pattern: /benefits|features|offers/i },
    { name: 'rewards', pattern: /rewards|cashback|points/i },
    { name: 'eligibility', pattern: /eligibility|requirements|criteria/i },
    { name: 'insurance', pattern: /insurance|coverage|protection/i },
    { name: 'pdf', pattern: /\.pdf$/i },
    { name: 'application', pattern: /apply|application/i },
  ],

  paths: {
    pdfs: 'data/pdfs',
    output: 'data/output',
    logs: 'logs',
    raw: 'data/raw'
  },

  browser: {
    headless: process.env.NODE_ENV === 'production',
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  },

  pdf: {
    maxSizeBytes: parseInt(process.env.MAX_PDF_SIZE) || 10 * 1024 * 1024,
    timeout: parseInt(process.env.PDF_TIMEOUT) || 30000,
    enableOCR: process.env.ENABLE_PDF_OCR === 'true' || false,
    ocrLanguage: process.env.OCR_LANGUAGE || 'eng',
    maxPages: parseInt(process.env.MAX_PDF_PAGES) || null,
    keepDownloaded: process.env.KEEP_PDF_FILES === 'true' || false,
  },

  output: {
    formats: (process.env.OUTPUT_FORMATS || 'json').split(','),
    prettyPrint: process.env.PRETTY_PRINT !== 'false',
    includeRawData: process.env.NODE_ENV === 'development',
    includeMetadata: process.env.INCLUDE_METADATA !== 'false',
    generateSummary: process.env.GENERATE_SUMMARY !== 'false',
    timestampFiles: process.env.TIMESTAMP_FILES !== 'false',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 5,
    maxLogSize: process.env.MAX_LOG_SIZE || '10m'
  },

  validation: {
    requiredFields: ['cardName', 'fees.annualFee', 'rewards', 'benefits'],
    minContentLength: parseInt(process.env.MIN_CONTENT_LENGTH) || 100,
    maxProcessingTime: parseInt(process.env.MAX_PROCESSING_TIME) || 5 * 60 * 1000,
    validateUrls: process.env.VALIDATE_URLS !== 'false',
  },

  errorHandling: {
    continueOnError: process.env.CONTINUE_ON_ERROR !== 'false',
    maxConsecutiveErrors: parseInt(process.env.MAX_CONSECUTIVE_ERRORS) || 3,
    emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    slackWebhook: process.env.SLACK_WEBHOOK || null,
    saveErrorLogs: process.env.SAVE_ERROR_LOGS !== 'false',
    exitOnFatalError: process.env.EXIT_ON_FATAL_ERROR !== 'false',
  },

  http: {
    timeout: parseInt(process.env.HTTP_TIMEOUT) || 30000,
    maxRedirects: parseInt(process.env.MAX_REDIRECTS) || 5,
    maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH) || 10 * 1024 * 1024,
    retryAttempts: parseInt(process.env.HTTP_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.HTTP_RETRY_DELAY) || 2000,
  }
};
