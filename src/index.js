const path = require("path");
const settings = require("./config/settings");
const { crawlPage } = require("./crawler/htmlCrawler");
const { handleLinks } = require("./crawler/linkHandler");
const { parsePDF } = require("./crawler/pdfParser");
const { ensureDirectoryExists, saveJSON } = require("./utils/fileUtils");
const CardDataParser = require("./parser/cardDataParser");
const CardDataValidator = require("./validator/cardDataValidator");
const CardDataAggregator = require("./aggregator/cardDataAggregator");
const {
  logInfo,
  logSuccess,
  logError,
  logWarn,
  logSection,
  logStart,
  logComplete,
  logProgress,
  logTable,
} = require("./utils/logger");

async function extractCardData() {
  const startTime = Date.now();
  logStart("Structured Card Data Extraction");

  try {
    const parser = new CardDataParser();
    const validator = new CardDataValidator();
    const aggregator = new CardDataAggregator();

    logSection("Crawling Main Page");
    const mainPageData = await crawlPage(settings.cardUrl);

    if (!mainPageData || !mainPageData.links) {
      throw new Error("Failed to extract data from main page");
    }

    logInfo("Parsing main page data...");
    const mainPageCardData = parser.parsePDF(mainPageData.textContent.fullText, settings.cardUrl);
    aggregator.addSourceData(mainPageCardData, 'html', settings.cardUrl);
    logSuccess(`Main page parsed: ${Object.keys(mainPageCardData).filter(k => mainPageCardData[k] !== null).length} fields extracted`);

    logSection("Processing Links");
    const linkResults = handleLinks(
      mainPageData.links,
      settings.baseDomain,
      settings.ignorePatterns
    );

    if (!linkResults || (!linkResults.internalLinks && !linkResults.pdfLinks)) {
      logError("No valid links found to process");
      return;
    }

    const { internalLinks, pdfLinks } = linkResults;

    logTable("Link Processing Results", {
      "Total links found": mainPageData.links.length,
      "Internal pages": internalLinks.length,
      "PDF documents": pdfLinks.length,
      "Links processed": linkResults.stats?.validLinks || 0,
    });

    logSection("Crawling Internal Pages");
    
    if (internalLinks.length > 0) {
      const maxPages = Math.min(internalLinks.length, settings.crawler.maxPages);
      const pagesToCrawl = internalLinks.slice(0, maxPages);

      logInfo(`Processing ${pagesToCrawl.length} internal pages (limited from ${internalLinks.length})`);

      for (let i = 0; i < pagesToCrawl.length; i++) {
        const link = pagesToCrawl[i];
        try {
          logProgress("Crawling pages", i + 1, pagesToCrawl.length);
          
          const page = await crawlPage(link.href);
          if (!page) {
            logWarn(`Skipping irrelevant page: ${link.href}`);
            continue;
          }
          
          parser.reset();
          const pageCardData = parser.parsePDF(page.textContent.fullText, link.href);
          aggregator.addSourceData(pageCardData, 'html', link.href);
          
          logSuccess(`Page parsed: ${link.href} (${Object.keys(pageCardData).filter(k => pageCardData[k] !== null).length} fields)`);

          if (i < pagesToCrawl.length - 1) {
            await sleep(settings.crawler.requestDelayMs);
          }
        } catch (err) {
          logError(`Failed to crawl internal link: ${link.href}`, err);
        }
      }
    }

    logSection("Processing PDF Documents");
    
    if (pdfLinks.length > 0) {
      const maxPDFs = Math.min(pdfLinks.length, settings.crawler.maxPDFs);
      const pdfsToProcess = pdfLinks.slice(0, maxPDFs);

      logInfo(`Processing ${pdfsToProcess.length} PDF documents (limited from ${pdfLinks.length})`);

      for (let i = 0; i < pdfsToProcess.length; i++) {
        const pdfLink = pdfsToProcess[i];
        try {
          logProgress("Parsing PDFs", i + 1, pdfsToProcess.length);
          
          const text = await parsePDF(pdfLink.href, {
            maxPages: settings.pdf.maxPages || null,
          });
          
          if (text === null) {
            logWarn(`Skipped PDF: ${pdfLink.href} (not found or inaccessible)`);
            continue;
          }
          
          parser.reset();
          const pdfCardData = parser.parsePDF(text, pdfLink.href);
          aggregator.addSourceData(pdfCardData, 'pdf', pdfLink.href);
          
          logSuccess(`PDF parsed: ${pdfLink.href} (${Object.keys(pdfCardData).filter(k => pdfCardData[k] !== null).length} fields)`);

          if (i < pdfsToProcess.length - 1) {
            await sleep(settings.crawler.requestDelayMs);
          }
        } catch (err) {
          logError(`Failed to parse PDF: ${pdfLink.href}`, err);
        }
      }
    }

    logSection("Aggregating Data");
    aggregator.cleanData();
    const finalCardData = aggregator.getCardData();
    const completenessReport = aggregator.getCompletenessReport();
    
    logInfo(`Data aggregation completed: ${completenessReport.completenessPercentage.toFixed(1)}% complete`);
    logInfo(`Sources processed: ${aggregator.getSources().length}`);

    logSection("Validating Data");
    const validationResult = validator.validate(finalCardData);
    
    if (validationResult.isValid) {
      logSuccess(`Data validation passed (Score: ${validationResult.score.toFixed(1)}/100)`);
    } else {
      logWarn(`Data validation failed with ${validationResult.errors.length} errors`);
      logWarn(`Validation warnings: ${validationResult.warnings.length}`);
    }

    logSection("Compiling Results");
    const finalData = {
      cardUrl: settings.cardUrl,
      extractionMetadata: {
        extractedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        cardCrawlerVersion: "2.0.0",
        validation: {
          isValid: validationResult.isValid,
          score: validationResult.score,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length
        },
        completeness: completenessReport,
        settings: {
          baseDomain: settings.baseDomain,
          maxPages: settings.crawler.maxPages,
          maxPDFs: settings.crawler.maxPDFs,
        }
      },
      cardData: finalCardData,
      sources: aggregator.getSources(),
      validationDetails: {
        errors: validationResult.errors,
        warnings: validationResult.warnings
      }
    };

    logSection("Saving Results");
    const outputDir = path.join(__dirname, "../data/output");
    await ensureDirectoryExists(outputDir);

    const outputFilename = generateOutputFilename(settings.cardUrl);
    const outputPath = path.join(outputDir, outputFilename);
    
    await saveJSON(outputPath, finalData);

    const duration = Date.now() - startTime;
    logComplete("Structured Card Data Extraction", duration);
    
    logTable("Extraction Summary", {
      "Output file": outputPath,
      "Card name": finalCardData.cardName || "Not found",
      "Annual fee": finalCardData.annualFee || "Not found",
      "Joining fee": finalCardData.joiningFee || "Not found",
      "Data completeness": `${completenessReport.completenessPercentage.toFixed(1)}%`,
      "Validation score": `${validationResult.score.toFixed(1)}/100`,
      "Sources processed": aggregator.getSources().length,
      "Processing time": `${(duration / 1000).toFixed(2)} seconds`,
    });

    if (validationResult.errors.length > 0 || validationResult.warnings.length > 0) {
      logWarn(validator.getValidationSummary(validationResult));
    }

    logSuccess(`Structured data extraction completed successfully!`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("Fatal error during extraction", error);
    logError(`Extraction failed after ${(duration / 1000).toFixed(2)} seconds`);
    process.exit(1);
  }
}

function generateOutputFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const cardName = pathParts[pathParts.length - 1] || 'credit-card';
    const sanitizedName = cardName.replace(/[^a-zA-Z0-9-]/g, '-');
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${sanitizedName}-${timestamp}.json`;
  } catch {
    return `credit-card-data-${Date.now()}.json`;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at Promise', reason);
  process.exit(1);
});

if (require.main === module) {
  extractCardData().catch((error) => {
    logError('Failed to start extraction', error);
    process.exit(1);
  });
}

module.exports = { extractCardData };
