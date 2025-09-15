// src/crawler/htmlCrawler.js
const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");
const {
  logInfo,
  logSuccess,
  logError,
  logWarn,
} = require("../utils/logger");
const {
  cleanUrl,
  normalizeUrl,
} = require("./linkHandler");

function validateCrawlUrl(url) {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
    }
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { valid: false, error: 'Invalid hostname' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid URL format: ${error.message}` };
  }
}

class HTMLCrawler {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 30000,
      userAgent:
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 2000,
      followRedirects: options.followRedirects !== false,
      maxRedirects: options.maxRedirects || 5,
      maxContentLength: options.maxContentLength || 10 * 1024 * 1024,
      ...options,
    };
  }

  async crawlPage(url) {
    const validation = validateCrawlUrl(url);
    if (!validation.valid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }
    const normalizedUrl = normalizeUrl(url) || url;
    logInfo(`Fetching page: ${normalizedUrl}`);
    try {
      const html = await this.fetchHTML(normalizedUrl);
      if (!html || html.length === 0) {
        throw new Error("Empty HTML response received");
      }
      const $ = cheerio.load(html);
      const textContent = this.extractStructuredContent($);
      const relevanceScore = this.calculateContentRelevance(textContent, normalizedUrl);
      if (relevanceScore < 3) {
        logWarn(`Page has low credit card relevance (score: ${relevanceScore}): ${normalizedUrl}`);
        return null;
      }
      const links = this.extractLinks($, url);
      if (!textContent.fullText || textContent.fullText.length < 50) {
        logWarn(`Page may have minimal content: ${url}`);
      }
      logSuccess(`Successfully crawled page: ${url}`);
      logInfo(
        `Extracted ${textContent.fullText.length} characters of text and ${links.length} links`
      );
      return {
        url: normalizedUrl,
        textContent,
        links,
        timestamp: new Date().toISOString(),
        contentLength: textContent.fullText.length,
        linkCount: links.length,
        relevanceScore,
        status: 'success'
      };
    } catch (error) {
      logError(`Failed to crawl page: ${url}`, error);
      throw error;
    }
  }

  calculateContentRelevance(textContent, url) {
    let score = 0;
    const text = textContent.fullText.toLowerCase();
    const urlLower = url.toLowerCase();
    const highPriorityKeywords = [
      'regalia gold', 'credit card', 'fees', 'charges', 'benefits', 
      'rewards', 'cashback', 'points', 'eligibility', 'terms', 'conditions'
    ];
    const mediumPriorityKeywords = [
      'insurance', 'coverage', 'lounge', 'milestone', 'features', 
      'offers', 'annual', 'joining', 'waiver'
    ];
    if (urlLower.includes('credit') && urlLower.includes('card')) score += 5;
    if (urlLower.includes('regalia')) score += 8;
    if (urlLower.includes('gold')) score += 3;
    highPriorityKeywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'gi')) || []).length;
      score += matches * 2;
    });
    mediumPriorityKeywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'gi')) || []).length;
      score += matches * 1;
    });
    const irrelevantKeywords = [
      'money transfer', 'upi', 'donation', 'remittance', 'forex', 
      'bill pay', 'recharge', 'fastag', 'demat', 'mutual fund'
    ];
    irrelevantKeywords.forEach(keyword => {
      if (text.includes(keyword)) score -= 3;
    });
    if (text.includes('.pdf') || text.includes('download')) score += 2;
    return Math.max(0, score);
  }

  async fetchHTML(url) {
    const { withRateLimit } = require('../utils/rateLimiter');
    const { validateUrl } = require('../utils/validation');
    let lastError;
    const urlValidation = validateUrl(url);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid URL: ${urlValidation.error}`);
    }
    const domain = new URL(url).hostname;
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        logInfo(
          `Fetch attempt ${attempt}/${this.options.retryAttempts} for: ${url}`
        );
        const response = await withRateLimit(domain, async () => {
          return await axios.get(url, {
            timeout: this.options.timeout,
            maxContentLength: this.options.maxContentLength,
            headers: {
              "User-Agent": this.options.userAgent,
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Accept-Encoding": "gzip, deflate, br",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
            maxRedirects: this.options.maxRedirects,
            validateStatus: (status) => status >= 200 && status < 400,
          });
        });
        if (!response.data) {
          throw new Error("Empty response received");
        }
        const { validateHtmlContent } = require('../utils/validation');
        const contentValidation = validateHtmlContent(response.data);
        if (!contentValidation.isValid) {
          throw new Error(`Invalid HTML content: ${contentValidation.error}`);
        }
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          logWarn(`Unexpected content type: ${contentType} for ${url}`);
        }
        logSuccess(`Successfully fetched HTML (${response.data.length} chars)`);
        return response.data;
      } catch (error) {
        lastError = error;
        if (error.response) {
          const status = error.response.status;
          if (status === 404) {
            logWarn(`HTTP 404: Not Found for ${url} - skipping retries`);
            throw error;
          } else if (status === 429) {
            logWarn(`HTTP 429: Rate limited by server for ${url}`);
            await this.sleep(this.options.retryDelay * 2);
          } else if (status >= 400 && status < 500) {
            logWarn(`HTTP ${status}: ${error.response.statusText} for ${url} - client error, skipping retries`);
            throw error;
          } else {
            logWarn(`HTTP ${status}: ${error.response.statusText} for ${url}`);
          }
        } else if (error.code === 'ECONNABORTED') {
          logWarn(`Request timeout after ${this.options.timeout}ms for ${url}`);
        } else {
          logWarn(`Network error: ${error.message} for ${url}`);
        }
        if (attempt < this.options.retryAttempts) {
          const delay = error.response?.status === 429 
            ? this.options.retryDelay * 2 
            : this.options.retryDelay;
          logWarn(
            `Attempt ${attempt} failed, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        } else {
          logError(`All ${this.options.retryAttempts} attempts failed for ${url}`);
        }
      }
    }
    throw lastError;
  }

  extractStructuredContent($) {
    try {
      $("script, style, noscript, iframe, object, embed, form, nav, footer, aside, .advertisement, .ads").remove();
      $("*")
        .contents()
        .filter(function () {
          return this.nodeType === 8;
        })
        .remove();
      const bodyText =
        $("body").length > 0 ? $("body").text() : $.root().text();
      const fullText = this.cleanText(bodyText);
      const headings = $("h1,h2,h3,h4,h5,h6")
        .map((i, el) => this.cleanText($(el).text()))
        .get()
        .filter(text => text.length > 0);
      const paragraphs = $("p")
        .map((i, el) => this.cleanText($(el).text()))
        .get()
        .filter(text => text.length > 10);
      const lists = $("ul,ol")
        .map((i, el) =>
          $(el)
            .find("li")
            .map((j, li) => this.cleanText($(li).text()))
            .get()
            .filter(text => text.length > 0)
        )
        .get()
        .filter(list => list.length > 0);
      const tables = $("table")
        .map((i, el) => this.cleanText($(el).text()))
        .get()
        .filter(text => text.length > 10);
      return { fullText, headings, paragraphs, lists, tables };
    } catch (error) {
      logError("Error extracting structured content", error);
      return { fullText: "", headings: [], paragraphs: [], lists: [], tables: [] };
    }
  }

  extractLinks($, baseUrl) {
    const links = [];
    const baseUrlObj = new URL(baseUrl);
    $("a[href]").each((index, element) => {
      try {
        const $link = $(element);
        const href = $link.attr("href");
        const text = $link.text().trim();
        const title = $link.attr("title") || "";
        if (
          !href ||
          href.startsWith("javascript:") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("#") ||
          href === "/"
        ) {
          return;
        }
        const absoluteUrl = this.resolveUrl(href, baseUrlObj);
        if (absoluteUrl) {
          links.push({
            href: absoluteUrl,
            text,
            title,
            originalHref: href,
            isInternal: this.isInternalLink(
              absoluteUrl,
              baseUrlObj.hostname
            ),
            isPDF: this.isPDFLink(absoluteUrl),
            domain: new URL(absoluteUrl).hostname,
          });
        }
      } catch (error) {
        logWarn(`Skipping malformed link: ${$(element).attr("href")} - ${error.message}`);
      }
    });
    return this.removeDuplicateLinks(links);
  }

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/\s{2,}/g, " ");
  }

  resolveUrl(href, baseUrlObj) {
    try {
      if (href.startsWith("#")) return null;
      const cleanedHref = cleanUrl(href);
      if (!cleanedHref) {
        return null;
      }
      const resolvedUrl = new URL(cleanedHref, baseUrlObj.href).href;
      const normalizedUrl = normalizeUrl(resolvedUrl);
      if (!normalizedUrl) {
        return null;
      }
      const validation = validateCrawlUrl(normalizedUrl);
      if (!validation.valid) {
        return null;
      }
      return normalizedUrl;
    } catch (error) {
      logWarn(`Failed to resolve URL: ${href} - ${error.message}`);
      return null;
    }
  }

  isInternalLink(url, baseDomain) {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === baseDomain ||
        urlObj.hostname.endsWith(`.${baseDomain}`)
      );
    } catch {
      return false;
    }
  }

  isPDFLink(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.toLowerCase().endsWith(".pdf");
    } catch {
      return false;
    }
  }

  removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter((link) => {
      if (seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async crawlMultiplePages(urls, concurrency = 3) {
    if (!Array.isArray(urls) || urls.length === 0) {
      logWarn("No URLs provided for crawling");
      return { results: [], errors: [], successCount: 0, errorCount: 0 };
    }
    logInfo(
      `Starting concurrent crawl of ${urls.length} pages (concurrency: ${concurrency})`
    );
    const results = [];
    const errors = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      logInfo(`Processing batch ${Math.floor(i / concurrency) + 1} of ${Math.ceil(urls.length / concurrency)}`);
      const batchPromises = batch.map(async (url) => {
        try {
          return await this.crawlPage(url);
        } catch (error) {
          errors.push({ url, error: error.message });
          logWarn(`Failed to crawl ${url}: ${error.message}`);
          return null;
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r) => r !== null));
      if (i + concurrency < urls.length) {
        await this.sleep(1000);
      }
    }
    if (errors.length > 0) {
      logWarn(`${errors.length} pages failed to crawl`);
    }
    logSuccess(`Successfully crawled ${results.length}/${urls.length} pages`);
    return {
      results,
      errors,
      successCount: results.length,
      errorCount: errors.length,
      totalAttempted: urls.length,
    };
  }
}

async function crawlPage(url, options = {}) {
  const crawler = new HTMLCrawler(options);
  return await crawler.crawlPage(url);
}

module.exports = { 
  HTMLCrawler, 
  crawlPage,
  validateCrawlUrl 
};
