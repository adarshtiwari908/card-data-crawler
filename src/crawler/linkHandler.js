const { logInfo, logWarn, logError, logSuccess } = require("../utils/logger");
const settings = require("../config/settings");

function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];

    if (!validProtocols.includes(urlObj.protocol)) {
      return false;
    }
    
    const corruptionPatterns = [
      /creddit/i, /cardds/i, /traansfer/i, /milllennia/i, 
      /commmercial/i, /busiiness/i, /ccredit/i, /uusers/i
    ];
    
    for (const pattern of corruptionPatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }
    
    if (url.match(/^(javascript|data|vbscript|file):/i)) {
      return false;
    }

    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return false;
    }
    
    if (url.includes('{{') || url.includes('}}') || url.includes('%7B%7B') || url.includes('%7D%7D')) {
      return false;
    }
    
    if (url.match(/CCredit|immediiate|nationnal|remitnnow|ttime|Cardds|Creddit|ppay|donattions/i)) {
      return false;
    }
    
    if (urlObj.pathname.startsWith(`/${urlObj.hostname}/`)) {
      return false;
    }
    
    if (url.includes('%%20') || url.includes('%20%20')) {
      return false;
    }

    if (url.length > 2000) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

function cleanUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  if (url.includes('{{') || url.includes('%7B%7B') || url.includes('}}') || url.includes('%7D%7D')) {
    return null;
  }
  
  let cleaned = url.trim();

  if (cleaned.includes('CCredit')) cleaned = cleaned.replace(/CCredit/g, 'Credit');
  if (cleaned.includes('Carrds')) cleaned = cleaned.replace(/Carrds/g, 'Cards');
  if (cleaned.includes('Creditt')) cleaned = cleaned.replace(/Creditt/g, 'Credit');
  if (cleaned.includes('CCard')) cleaned = cleaned.replace(/CCard/g, 'Card');
  if (cleaned.includes('Supeer')) cleaned = cleaned.replace(/Supeer/g, 'Super');
  if (cleaned.includes('Preemium')) cleaned = cleaned.replace(/Preemium/g, 'Premium');
  if (cleaned.includes('immediiate')) cleaned = cleaned.replace(/immediiate/g, 'immediate');
  if (cleaned.includes('nationnal')) cleaned = cleaned.replace(/nationnal/g, 'national');
  if (cleaned.includes('remitnnow')) cleaned = cleaned.replace(/remitnnow/g, 'remitnow');
  if (cleaned.includes('ttime')) cleaned = cleaned.replace(/ttime/g, 'time');
  if (cleaned.includes('Cardds')) cleaned = cleaned.replace(/Cardds/g, 'Cards');
  if (cleaned.includes('Creddit')) cleaned = cleaned.replace(/Creddit/g, 'Credit');
  if (cleaned.includes('ppay')) cleaned = cleaned.replace(/ppay/g, 'pay');
  if (cleaned.includes('donattions')) cleaned = cleaned.replace(/donattions/g, 'donations');
  
  if (cleaned.includes('%%20')) cleaned = cleaned.replace(/%%20/g, '%20');
  if (cleaned.includes('%20%20')) cleaned = cleaned.replace(/%20%20/g, '%20');
  
  cleaned = cleaned.replace(/\s+/g, '%20');
  
  cleaned = cleaned.replace(/https:\/\/+/g, 'https://');
  cleaned = cleaned.replace(/http:\/\/+/g, 'http://');

  cleaned = cleaned.replace(/([^:]\/)\/+/g, '$1');
  
  cleaned = cleaned.replace(/\/$/, '');
  
  return cleaned;
}

function normalizeUrl(url) {
  try {
    const cleanedUrl = cleanUrl(url);
    if (!cleanedUrl) {
      return null;
    }
    if (!isValidUrl(cleanedUrl)) {
      return null;
    }
    
    let u = new URL(cleanedUrl);

    if (u.pathname.startsWith(`/${u.hostname}/`)) {
      u.pathname = u.pathname.substring(u.hostname.length + 1);
    }
    
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isIgnored(url) {
  if (!url || typeof url !== 'string') {
    return true;
  }
  
  return settings.ignorePatterns.some((pattern) => {
    try {
      return pattern.test(url);
    } catch (error) {
      logWarn(`Invalid ignore pattern: ${pattern}`);
      return false;
    }
  });
}

function getPriorityScore(url) {
  let score = 0;
  for (const { pattern, weight } of settings.priorityPatterns) {
    try {
      if (pattern.test(url)) {
        score += weight;
      }
    } catch (error) {
      logWarn(`Invalid priority pattern: ${pattern}`);
    }
  }
  return score;
}

function categorizeLink(url) {
  for (const { name, pattern } of settings.categories) {
    try {
      if (pattern.test(url)) return name;
    } catch (error) {
      logWarn(`Invalid category pattern: ${pattern}`);
    }
  }
  return "general";
}

function isPDFLink(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

function isInternalLink(url, baseDomain) {
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

function processLinks(links, baseDomain, ignorePatterns = []) {
  if (!Array.isArray(links)) {
    logError("processLinks: links parameter must be an array");
    return { internalLinks: [], pdfLinks: [] };
  }

  const processedLinks = [];
  const errors = [];
  const baseUrl = `https://${baseDomain}`;

  logInfo(`Processing ${links.length} links for domain: ${baseDomain}`);

  if (links.length > 0) {
    logInfo(`Sample links: ${JSON.stringify(links.slice(0, 3))}`);
  }

  for (const link of links) {
    try {
      let href = typeof link === 'string' ? link : link.href;
      
      if (!href || typeof href !== 'string') {
        continue;
      }

      if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#' || href === '/') {
        continue;
      }

      let absoluteUrl;
      
      try {
        if (href.startsWith('/')) {
          absoluteUrl = baseUrl + href;
        } else if (href.startsWith('http://') || href.startsWith('https://')) {
          absoluteUrl = href;
        } else if (href.startsWith('./') || href.startsWith('../')) {
          absoluteUrl = new URL(href, baseUrl).href;
        } else if (!href.includes('://')) {
          absoluteUrl = baseUrl + '/' + href;
        } else {
          continue;
        }
      } catch (urlError) {
        logWarn(`Failed to resolve URL: ${href} - ${urlError.message}`);
        continue;
      }

      const cleanedUrl = cleanUrl(absoluteUrl);
      if (!cleanedUrl) {
        continue;
      }

      let finalUrl;
      try {
        const urlObj = new URL(cleanedUrl);
        urlObj.hash = '';
        finalUrl = urlObj.toString().replace(/\/$/, '');
        if (!urlObj.hostname.includes(baseDomain)) {
          continue;
        }
      } catch (parseError) {
        logWarn(`Invalid URL after cleaning: ${cleanedUrl}`);
        continue;
      }

      if (isIgnored(finalUrl)) {
        continue;
      }

      const priority = getPriorityScore(finalUrl);
      const category = categorizeLink(finalUrl);
      const isPDF = isPDFLink(finalUrl);

      if (processedLinks.length < 5) {
        logInfo(`Successfully processed link: ${finalUrl} (category: ${category}, isPDF: ${isPDF})`);
      }

      processedLinks.push({
        href: finalUrl,
        text: typeof link === 'object' ? (link.text || '') : '',
        title: typeof link === 'object' ? (link.title || '') : '',
        priority,
        category,
        isPDF,
        type: isPDF ? 'pdf' : 'page',
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      errors.push({ link, error: error.message });
      logWarn(`Error processing link: ${JSON.stringify(link)} - ${error.message}`);
    }
  }

  const uniqueLinks = Array.from(
    new Map(processedLinks.map(l => [l.href, l])).values()
  );

  const internalLinks = uniqueLinks.filter(l => !l.isPDF);
  const pdfLinks = uniqueLinks.filter(l => l.isPDF);

  logInfo(`Processed ${links.length} raw links → ${uniqueLinks.length} unique valid links`);
  logSuccess(
    `Categorized: ${internalLinks.length} internal pages, ${pdfLinks.length} PDFs`
  );

  if (errors.length > 0) {
    logWarn(`${errors.length} links had processing errors`);
  }

  const filteredCount = links.length - uniqueLinks.length;
  if (filteredCount > 0) {
    logInfo(`Filtered out ${filteredCount} invalid/malformed URLs`);
  }

  return {
    internalLinks,
    pdfLinks,
    allLinks: uniqueLinks,
    errors,
    stats: {
      totalProcessed: links.length,
      validLinks: uniqueLinks.length,
      internalPages: internalLinks.length,
      pdfFiles: pdfLinks.length,
      errors: errors.length,
    }
  };
}

function handleLinks(links, baseDomain, ignorePatterns = []) {
  try {
    if (!links || !Array.isArray(links)) {
      logError("handleLinks: Invalid links parameter");
      return { internalLinks: [], pdfLinks: [] };
    }

    if (!baseDomain || typeof baseDomain !== 'string') {
      logError("handleLinks: Invalid baseDomain parameter");
      return { internalLinks: [], pdfLinks: [] };
    }

    return processLinks(links, baseDomain, ignorePatterns);
  } catch (error) {
    logError(`handleLinks failed: ${error.message}`);
    return { 
      internalLinks: [], 
      pdfLinks: [], 
      allLinks: [],
      errors: [{ error: error.message }],
      stats: {
        totalProcessed: 0,
        validLinks: 0,
        internalPages: 0,
        pdfFiles: 0,
        errors: 1,
      }
    };
  }
}

function isUrlLikelyAccessible(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.startsWith(`/${urlObj.hostname}/`)) {
      return false;
    }
    const problematicPatterns = [
      /\{\{.*\}\}/,
      /%7B%7B.*%7D%7D/,
      /CCredit/,
      /immediiate/,
      /nationnal/,
      /remitnnow/,
      /ttime/,
      /Cardds/,
      /Creddit/,
      /ppay/,
      /donattions/,
      /%%20/,
      /%20%20/,
      /\/\/\//,
      /\.pdf.*\.pdf/,
    ];
    for (const pattern of problematicPatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }
    if (url.length > 2000) {
      return false;
    }
    if (urlObj.pathname.includes('//') || urlObj.pathname.includes('..')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = { 
  handleLinks, 
  processLinks, 
  isValidUrl, 
  normalizeUrl, 
  isInternalLink, 
  isPDFLink,
  categorizeLink,
  getPriorityScore,
  cleanUrl,
  isUrlLikelyAccessible
};
