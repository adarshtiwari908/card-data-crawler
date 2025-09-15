const { URL } = require('url');
const path = require('path');
const fs = require('fs');

function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string' };
  }

  try {
    const urlObj = new URL(url);

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
    }

    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { isValid: false, error: 'Invalid hostname' };
    }

    const suspiciousPatterns = [
      /\{\{.*\}\}/,
      /%7B%7B.*%7D%7D/,
      /javascript:/i,
      /data:/i,
      /[<>]/,
      /\\x[0-9a-f]{2}/i,
      /%[0-9a-f]{2}/i,
      /&#x?[0-9a-f]+;/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        return { isValid: false, error: 'URL contains suspicious patterns' };
      }
    }

    if (url.length > 2000) {
      return { isValid: false, error: 'URL exceeds maximum length of 2000 characters' };
    }

    return {
      isValid: true,
      sanitized: urlObj.toString().replace(/\/+$/, '')
    };
  } catch (error) {
    return { isValid: false, error: `Invalid URL format: ${error.message}` };
  }
}

function validateFilePath(filePath, options = {}) {
  const {
    mustExist = false,
    allowedExtensions = null,
    maxPathLength = 255
  } = options;

  if (!filePath || typeof filePath !== 'string') {
    return { isValid: false, error: 'File path must be a non-empty string' };
  }

  try {
    const normalizedPath = path.normalize(filePath);

    if (normalizedPath.length > maxPathLength) {
      return { isValid: false, error: `Path exceeds maximum length of ${maxPathLength} characters` };
    }

    if (normalizedPath.includes('..')) {
      return { isValid: false, error: 'Directory traversal not allowed' };
    }

    if (allowedExtensions) {
      const ext = path.extname(normalizedPath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return { isValid: false, error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` };
      }
    }

    if (mustExist && !fs.existsSync(normalizedPath)) {
      return { isValid: false, error: 'File does not exist' };
    }

    return {
      isValid: true,
      sanitized: normalizedPath
    };
  } catch (error) {
    return { isValid: false, error: `Invalid file path: ${error.message}` };
  }
}

function validateSettings(settings) {
  const errors = [];

  if (!settings.cardUrl) {
    errors.push('cardUrl is required');
  }

  if (!settings.baseDomain) {
    errors.push('baseDomain is required');
  }

  if (settings.cardUrl) {
    const urlValidation = validateUrl(settings.cardUrl);
    if (!urlValidation.isValid) {
      errors.push(`Invalid cardUrl: ${urlValidation.error}`);
    }
  }

  if (settings.crawler) {
    if (typeof settings.crawler.maxDepth !== 'number' || settings.crawler.maxDepth < 1) {
      errors.push('crawler.maxDepth must be a positive number');
    }

    if (typeof settings.crawler.maxPages !== 'number' || settings.crawler.maxPages < 1) {
      errors.push('crawler.maxPages must be a positive number');
    }

    if (typeof settings.crawler.maxPDFs !== 'number' || settings.crawler.maxPDFs < 0) {
      errors.push('crawler.maxPDFs must be a non-negative number');
    }

    if (typeof settings.crawler.requestDelayMs !== 'number' || settings.crawler.requestDelayMs < 0) {
      errors.push('crawler.requestDelayMs must be a non-negative number');
    }
  }

  if (settings.paths) {
    for (const [key, value] of Object.entries(settings.paths)) {
      const pathValidation = validateFilePath(value);
      if (!pathValidation.isValid) {
        errors.push(`Invalid ${key} path: ${pathValidation.error}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateHtmlContent(html) {
  if (!html || typeof html !== 'string') {
    return { isValid: false, error: 'HTML content must be a non-empty string' };
  }

  if (html.length < 50) {
    return { isValid: false, error: 'HTML content too short' };
  }

  if (!html.includes('<') || !html.includes('>')) {
    return { isValid: false, error: 'Content does not appear to be HTML' };
  }

  return { isValid: true };
}

function validatePdfContent(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return { isValid: false, error: 'PDF content must be a buffer' };
  }

  if (!buffer.toString('ascii', 0, 5).startsWith('%PDF-')) {
    return { isValid: false, error: 'Not a valid PDF file' };
  }

  if (buffer.length < 100) {
    return { isValid: false, error: 'PDF content too small' };
  }

  return { isValid: true };
}

function validateExtractedText(text, options = {}) {
  const {
    minLength = 50,
    requiresCardInfo = true
  } = options;

  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Text must be a non-empty string' };
  }

  if (text.length < minLength) {
    return { isValid: false, error: `Text too short (minimum ${minLength} characters)` };
  }

  if (requiresCardInfo) {
    const cardTerms = ['credit card', 'annual fee', 'rewards', 'benefits'];
    const hasCardInfo = cardTerms.some(term => text.toLowerCase().includes(term));
    
    if (!hasCardInfo) {
      return { isValid: false, error: 'Text does not contain credit card related information' };
    }
  }

  return { isValid: true };
}

module.exports = {
  validateUrl,
  validateFilePath,
  validateSettings,
  validateHtmlContent,
  validatePdfContent,
  validateExtractedText
};