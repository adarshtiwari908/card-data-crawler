const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const axios = require("axios");
const { downloadFile, ensureDirectoryExists } = require("../utils/fileUtils");
const {
  logInfo,
  logSuccess,
  logError,
  logWarn,
} = require("../utils/logger");

function cleanPDFUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  let cleaned = url.trim();

  cleaned = cleaned
    .replace(/Supeer/g, 'Super')
    .replace(/Premiuum/g, 'Premium')
    .replace(/%%20/g, '%20')
    .replace(/%20%20/g, '%20')
    .replace(/([^:])\/\/+/g, '$1/')
    .replace(/\/$/, '');
    
  return cleaned;
}

async function checkPDFExists(url) {
  try {
    await axios.head(url, { 
      timeout: 10000,
      validateStatus: (status) => status === 200
    });
    return true;
  } catch (error) {
    return false;
  }
}

function validatePDFUrl(url) {
  try {
    const urlObj = new URL(url);
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
    }
    
    if (!urlObj.pathname.toLowerCase().endsWith('.pdf')) {
      logWarn(`URL doesn't end with .pdf: ${url}`);
    }
    
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { valid: false, error: 'Invalid hostname' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid URL format: ${error.message}` };
  }
}

class PDFParser {
  constructor(options = {}) {
    this.pdfDirectory = options.pdfDirectory || path.resolve(__dirname, "../../data/pdfs");
    this.maxSizeBytes = options.maxSizeBytes || 10 * 1024 * 1024; // 10MB
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelayMs = options.retryDelayMs || 2000;
  }

  static async init(options = {}) {
    const parser = new PDFParser(options);
    await parser.ensurePdfDirectoryExists();
    return parser;
  }

  async ensurePdfDirectoryExists() {
    try {
      await ensureDirectoryExists(this.pdfDirectory);
      logInfo(`PDF directory ready: ${this.pdfDirectory}`);
    } catch (err) {
      logError(`Failed to ensure PDF directory: ${this.pdfDirectory}`, err);
      throw err;
    }
  }

  async parsePDF(pdfUrl, options = {}) {
    const cleanedUrl = cleanPDFUrl(pdfUrl);
    if (!cleanedUrl) {
      logWarn(`⚠️ Skipped PDF: ${pdfUrl} (invalid URL format)`);
      return null;
    }

    const validation = validatePDFUrl(cleanedUrl);
    if (!validation.valid) {
      logWarn(`⚠️ Skipped PDF: ${cleanedUrl} (${validation.error})`);
      return null;
    }

    const exists = await checkPDFExists(cleanedUrl);
    if (!exists) {
      logWarn(`⚠️ Skipped PDF: ${cleanedUrl} (file not found or inaccessible)`);
      return null;
    }

    const {
      filename = null,
      keepFile = false,
      maxPages = null,
    } = options;

    let filePath = null;

    try {
      logInfo(`Starting PDF download and parse: ${cleanedUrl}`);

      const finalFilename = filename || this.generateFilename(cleanedUrl);
      filePath = path.resolve(this.pdfDirectory, finalFilename);

      let downloadResult;
      try {
        downloadResult = await this.downloadWithRetry(cleanedUrl, filePath, pdfUrl);
        logSuccess(`PDF downloaded: ${filePath} (${this.formatFileSize(downloadResult.size)})`);
      } catch (downloadError) {
        if (downloadError.response && downloadError.response.status === 404) {
          logWarn(`⚠️ Skipped PDF: ${cleanedUrl} (file not found or inaccessible)`);
          return null;
        }
        throw downloadError;
      }

      const parseResult = await this.parsePDFFile(filePath, { maxPages });

      const result = {
        text: parseResult.text,
        metadata: {
          ...parseResult.metadata,
          sourceUrl: pdfUrl,
          cleanedUrl: cleanedUrl,
          downloadedAt: new Date().toISOString(),
          filePath: keepFile ? filePath : null,
          fileSize: downloadResult.size,
          filename: path.basename(filePath),
        },
      };

      logSuccess(
        `PDF parsed successfully. Pages: ${parseResult.metadata.pages}, Text length: ${result.text.length} characters`
      );

      if (!keepFile) {
        await this.deleteFile(filePath);
        logInfo(`Temporary PDF deleted: ${filePath}`);
      }
      return result;
    } catch (error) {
      logError(`Failed to process PDF: ${cleanedUrl}`, error);
      if (filePath) {
        await this.deleteFile(filePath);
      }
      logWarn(`⚠️ Skipped PDF: ${cleanedUrl} (processing failed)`);
      return null;
    }
  }

  async parsePDFFile(filePath, options = {}) {
    const { maxPages = null } = options;

    try {
      logInfo(`Parsing PDF file: ${filePath}`);

      await fs.access(filePath, fsSync.constants.R_OK);
      
      const pdfBuffer = await fs.readFile(filePath);
      
      if (pdfBuffer.length === 0) {
        throw new Error("PDF file is empty");
      }

      const parseOptions = {};
      if (maxPages && maxPages > 0) {
        parseOptions.max = maxPages;
      }

      const pdfData = await pdfParse(pdfBuffer, parseOptions);
      
      if (!pdfData || !pdfData.text) {
        throw new Error("Failed to extract text from PDF");
      }

      const cleanText = this.cleanExtractedText(pdfData.text);

      const result = {
        text: cleanText,
        metadata: {
          pages: pdfData.numpages || 0,
          version: pdfData.version || 'unknown',
          info: pdfData.info || {},
          textLength: cleanText.length,
          parsedAt: new Date().toISOString(),
          parseOptions,
        },
      };

      logSuccess(
        `PDF parsed. Pages: ${result.metadata.pages}, Text length: ${result.metadata.textLength} characters`
      );

      return result;
    } catch (error) {
      logError(`Failed to parse PDF ${filePath}`, error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  cleanExtractedText(text) {
    if (!text || typeof text !== 'string') return "";
    
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\f/g, "")
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim();
  }

  generateFilename(url) {
    try {
      const urlObj = new URL(url);
      let filename = path.basename(urlObj.pathname);
      
      if (!filename || filename === '/' || !filename.endsWith('.pdf')) {
        filename = `pdf_${Date.now()}.pdf`;
      }
      
      filename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      return filename;
    } catch {
      return `pdf_${Date.now()}.pdf`;
    }
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  async downloadWithRetry(normalizedUrl, filePath, originalUrl) {
    const urlsToTry = [];

    if (normalizedUrl) {
      urlsToTry.push(normalizedUrl);
    }
    if (originalUrl && originalUrl !== normalizedUrl) {
      const additionalCleaned = cleanPDFUrl(originalUrl);
      if (additionalCleaned && additionalCleaned !== normalizedUrl) {
        urlsToTry.push(additionalCleaned);
      }
      urlsToTry.push(originalUrl);
    }

    let lastError;
    let attemptCount = 0;
    
    for (const url of urlsToTry) {
      attemptCount++;
      try {
        logInfo(`PDF download attempt ${attemptCount}/${urlsToTry.length}: ${url}`);
        return await downloadFile(url, filePath, {
          timeout: this.timeout,
          maxSize: this.maxSizeBytes,
        });
      } catch (error) {
        lastError = error;
        if (error.response && error.response.status === 404) {
          logWarn(`PDF not found (404) at ${url}${attemptCount < urlsToTry.length ? ', trying next URL' : ''}`);
          continue;
        }
        logError(`PDF download failed with non-404 error: ${error.message}`);
        break;
      }
    }
    
    throw lastError;
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function for single PDF parsing (matches interface expected by index.js)
 * @param {string} pdfUrl - URL of the PDF to parse
 * @param {Object} options - Parsing options
 * @returns {Promise<string>} - Extracted text content
 */
async function parsePDF(pdfUrl, options = {}) {
  try {
    const parser = await PDFParser.init();
    const result = await parser.parsePDF(pdfUrl, {
      keepFile: false,
      ...options
    });
    
    if (result === null) {
      return null;
    }
    
    return result.text;
  } catch (error) {
    logError(`parsePDF function failed for ${pdfUrl}`, error);
    throw error;
  }
}

module.exports = { 
  PDFParser, 
  parsePDF,
  validatePDFUrl 
};