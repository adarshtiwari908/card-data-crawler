// src/parser/cardDataParser.js
const cheerio = require('cheerio');
const { createEmptyCardData } = require('../schema/cardSchema');
const { logInfo, logSuccess, logError, logWarn } = require('../utils/logger');

class CardDataParser {
  constructor() {
    this.cardData = createEmptyCardData();
    this.rawText = '';
    this.html = '';
  }

  parseHTML(html, url) {
    this.html = html;
    const $ = cheerio.load(html);
    this.rawText = $.text();
    
    logInfo(`Parsing HTML content from: ${url}`);
    
    this.extractCardName($);
    this.extractFees($);
    this.extractRewards($);
    this.extractBenefits($);
    this.extractEligibility($);
    this.extractInterestRate($);
    this.extractOtherCharges($);
    this.extractLoungeAccess($);
    this.extractInsurance($);
    this.extractContactInfo($);
    this.extractLinks($, url);
    
    return this.cardData;
  }

  parsePDF(text, url) {
    this.rawText = text;
    
    logInfo(`Parsing PDF content from: ${url}`);
    
    this.extractCardNameFromText();
    this.extractFeesFromText();
    this.extractRewardsFromText();
    this.extractBenefitsFromText();
    this.extractEligibilityFromText();
    this.extractInterestRateFromText();
    this.extractOtherChargesFromText();
    this.extractLoungeAccessFromText();
    this.extractInsuranceFromText();
    this.extractContactInfoFromText();
    
    return this.cardData;
  }

  extractCardName($) {
    const selectors = [
      'h1',
      'h2',
      '.card-title',
      '.product-title',
      '[class*="card-name"]',
      '[class*="product-name"]'
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        const text = element.text().trim();
        if (text.toLowerCase().includes('regalia') && text.toLowerCase().includes('gold')) {
          this.cardData.cardName = text;
          break;
        }
      }
    }
  }

  extractCardNameFromText() {
    const patterns = [
      /(?:HDFC\s+)?Regalia\s+Gold\s+Credit\s+Card/gi,
      /Regalia\s+Gold\s+Credit\s+Card/gi,
      /HDFC\s+Regalia\s+Gold/gi
    ];

    for (const pattern of patterns) {
      const match = this.rawText.match(pattern);
      if (match) {
        this.cardData.cardName = match[0].trim();
        break;
      }
    }
  }

  extractFees($) {
    const feeSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('fee') || text.includes('charge') || text.includes('annual') || text.includes('joining');
    });

    feeSections.each((i, element) => {
      const text = $(element).text();
      
      const annualFeeMatch = text.match(/(?:annual|yearly)\s*fee[:\s]*₹?\s*([0-9,]+)/i);
      if (annualFeeMatch && !this.cardData.annualFee) {
        this.cardData.annualFee = `₹${annualFeeMatch[1]}`;
      }

      const joiningFeeMatch = text.match(/(?:joining|membership)\s*fee[:\s]*₹?\s*([0-9,]+)/i);
      if (joiningFeeMatch && !this.cardData.joiningFee) {
        this.cardData.joiningFee = `₹${joiningFeeMatch[1]}`;
      }
    });
  }

  extractFeesFromText() {
    const annualFeePatterns = [
      /(?:annual|yearly)\s*fee[:\s]*₹?\s*([0-9,]+)/gi,
      /₹\s*([0-9,]+)\s*(?:annual|yearly)/gi,
      /fee[:\s]*₹?\s*([0-9,]+)/gi
    ];

    for (const pattern of annualFeePatterns) {
      const match = this.rawText.match(pattern);
      if (match && !this.cardData.annualFee) {
        const amount = match[0].match(/([0-9,]+)/);
        if (amount) {
          this.cardData.annualFee = `₹${amount[1]}`;
          break;
        }
      }
    }

    const joiningFeePatterns = [
      /(?:joining|membership)\s*fee[:\s]*₹?\s*([0-9,]+)/gi,
      /₹\s*([0-9,]+)\s*(?:joining|membership)/gi
    ];

    for (const pattern of joiningFeePatterns) {
      const match = this.rawText.match(pattern);
      if (match && !this.cardData.joiningFee) {
        const amount = match[0].match(/([0-9,]+)/);
        if (amount) {
          this.cardData.joiningFee = `₹${amount[1]}`;
          break;
        }
      }
    }
  }

  extractRewards($) {
    const rewards = [];
    
    const rewardSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('reward') || text.includes('point') || text.includes('cashback');
    });

    rewardSections.each((i, element) => {
      const text = $(element).text();
      
      const rewardPatterns = [
        /(\d+)\s*reward\s*points?\s*(?:on|per|for)\s*(?:every\s*)?₹?\s*([0-9,]+)/gi,
        /(\d+)\s*points?\s*(?:on|per|for)\s*(?:every\s*)?₹?\s*([0-9,]+)/gi,
        /earn\s*(\d+)\s*points?\s*(?:on|per|for)\s*(?:every\s*)?₹?\s*([0-9,]+)/gi
      ];

      for (const pattern of rewardPatterns) {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          if (match[1] && match[2]) {
            rewards.push(`${match[1]} Reward Points per ₹${match[2]} spent`);
          }
        });
      }
    });

    this.cardData.rewards = [...new Set(rewards)];
  }

  extractRewardsFromText() {
    const rewards = [];
    
    const rewardPatterns = [
      /(\d+)\s*reward\s*points?\s*(?:on|per|for)\s*(?:every\s*)?₹?\s*([0-9,]+)/gi,
      /(\d+)\s*points?\s*(?:on|per|for)\s*(?:every\s*)?₹?\s*([0-9,]+)/gi,
      /earn\s*(\d+)\s*points?\s*(?:on|per|for)\s*(?:every\s*)?₹?\s*([0-9,]+)/gi
    ];

    for (const pattern of rewardPatterns) {
      const matches = [...this.rawText.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1] && match[2]) {
          rewards.push(`${match[1]} Reward Points per ₹${match[2]} spent`);
        }
      });
    }

    this.cardData.rewards = [...new Set(rewards)];
  }

  extractBenefits($) {
    const benefits = [];
    
    const benefitSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('benefit') || text.includes('feature') || text.includes('offer');
    });

    benefitSections.each((i, element) => {
      const text = $(element).text();
      
      const benefitPatterns = [
        /lounge\s*access/gi,
        /travel\s*insurance/gi,
        /dining\s*discount/gi,
        /fuel\s*surcharge/gi,
        /concierge/gi,
        /priority\s*pass/gi,
        /contactless/gi,
        /smart\s*emi/gi
      ];

      for (const pattern of benefitPatterns) {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          benefits.push(match[0].trim());
        });
      }
    });

    this.cardData.benefits = [...new Set(benefits)];
  }

  extractBenefitsFromText() {
    const benefits = [];
    
    const benefitPatterns = [
      /lounge\s*access/gi,
      /travel\s*insurance/gi,
      /dining\s*discount/gi,
      /fuel\s*surcharge/gi,
      /concierge/gi,
      /priority\s*pass/gi,
      /contactless/gi,
      /smart\s*emi/gi
    ];

    for (const pattern of benefitPatterns) {
      const matches = [...this.rawText.matchAll(pattern)];
      matches.forEach(match => {
        benefits.push(match[0].trim());
      });
    }

    this.cardData.benefits = [...new Set(benefits)];
  }

  extractEligibility($) {
    const eligibility = [];
    
    const eligibilitySections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('eligibility') || text.includes('requirement') || text.includes('criteria');
    });

    eligibilitySections.each((i, element) => {
      const text = $(element).text();
      
      const eligibilityPatterns = [
        /(?:minimum|min)\s*age\s*(\d+)/gi,
        /(?:income|salary)\s*(?:above|minimum|min)\s*₹?\s*([0-9,]+)/gi,
        /(?:age|years?)\s*(\d+)/gi
      ];

      for (const pattern of eligibilityPatterns) {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          if (match[1]) {
            eligibility.push(match[0].trim());
          }
        });
      }
    });

    this.cardData.eligibilityCriteria = [...new Set(eligibility)];
  }

  extractEligibilityFromText() {
    const eligibility = [];
    
    const eligibilityPatterns = [
      /(?:minimum|min)\s*age\s*(\d+)/gi,
      /(?:income|salary)\s*(?:above|minimum|min)\s*₹?\s*([0-9,]+)/gi,
      /(?:age|years?)\s*(\d+)/gi
    ];

    for (const pattern of eligibilityPatterns) {
      const matches = [...this.rawText.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          eligibility.push(match[0].trim());
        }
      });
    }

    this.cardData.eligibilityCriteria = [...new Set(eligibility)];
  }

  extractInterestRate($) {
    const interestSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('interest') || text.includes('rate') || text.includes('apr');
    });

    interestSections.each((i, element) => {
      const text = $(element).text();
      
      const interestPatterns = [
        /(?:interest\s*rate|apr)[:\s]*(\d+(?:\.\d+)?)\s*%/gi,
        /(\d+(?:\.\d+)?)\s*%\s*(?:per\s*month|annually|p\.a\.)/gi
      ];

      for (const pattern of interestPatterns) {
        const match = text.match(pattern);
        if (match && !this.cardData.interestRate) {
          this.cardData.interestRate = match[0].trim();
          break;
        }
      }
    });
  }

  extractInterestRateFromText() {
    const interestPatterns = [
      /(?:interest\s*rate|apr)[:\s]*(\d+(?:\.\d+)?)\s*%/gi,
      /(\d+(?:\.\d+)?)\s*%\s*(?:per\s*month|annually|p\.a\.)/gi
    ];

    for (const pattern of interestPatterns) {
      const match = this.rawText.match(pattern);
      if (match && !this.cardData.interestRate) {
        this.cardData.interestRate = match[0].trim();
        break;
      }
    }
  }

  extractOtherCharges($) {
    const charges = [];
    
    const chargeSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('late') || text.includes('penalty') || text.includes('overdue');
    });

    chargeSections.each((i, element) => {
      const text = $(element).text();
      
      const chargePatterns = [
        /late\s*payment\s*fee[:\s]*₹?\s*([0-9,]+)/gi,
        /penalty[:\s]*₹?\s*([0-9,]+)/gi,
        /overdue[:\s]*₹?\s*([0-9,]+)/gi
      ];

      for (const pattern of chargePatterns) {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          if (match[1]) {
            charges.push(match[0].trim());
          }
        });
      }
    });

    this.cardData.otherCharges = [...new Set(charges)];
  }

  extractOtherChargesFromText() {
    const charges = [];
    
    const chargePatterns = [
      /late\s*payment\s*fee[:\s]*₹?\s*([0-9,]+)/gi,
      /penalty[:\s]*₹?\s*([0-9,]+)/gi,
      /overdue[:\s]*₹?\s*([0-9,]+)/gi
    ];

    for (const pattern of chargePatterns) {
      const matches = [...this.rawText.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          charges.push(match[0].trim());
        }
      });
    }

    this.cardData.otherCharges = [...new Set(charges)];
  }

  extractLoungeAccess($) {
    const loungeSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('lounge') || text.includes('airport');
    });

    loungeSections.each((i, element) => {
      const text = $(element).text();
      
      if (text.includes('domestic') && text.includes('lounge')) {
        this.cardData.loungeAccess = this.cardData.loungeAccess || {};
        this.cardData.loungeAccess.domestic = text.trim();
      }
      
      if (text.includes('international') && text.includes('lounge')) {
        this.cardData.loungeAccess = this.cardData.loungeAccess || {};
        this.cardData.loungeAccess.international = text.trim();
      }
    });
  }

  extractLoungeAccessFromText() {
    const loungePatterns = [
      /(?:domestic|india).*?lounge.*?(?=\n|$)/gi,
      /(?:international|overseas).*?lounge.*?(?=\n|$)/gi
    ];

    for (const pattern of loungePatterns) {
      const match = this.rawText.match(pattern);
      if (match) {
        this.cardData.loungeAccess = this.cardData.loungeAccess || {};
        if (pattern.source.includes('domestic')) {
          this.cardData.loungeAccess.domestic = match[0].trim();
        } else {
          this.cardData.loungeAccess.international = match[0].trim();
        }
      }
    }
  }

  extractInsurance($) {
    const insuranceSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('insurance') || text.includes('cover') || text.includes('protection');
    });

    insuranceSections.each((i, element) => {
      const text = $(element).text();
      
      if (text.includes('travel') && text.includes('insurance')) {
        this.cardData.insurance = this.cardData.insurance || {};
        this.cardData.insurance.travelInsurance = text.trim();
      }
      
      if (text.includes('accidental') && text.includes('death')) {
        this.cardData.insurance = this.cardData.insurance || {};
        this.cardData.insurance.accidentalDeath = text.trim();
      }
    });
  }

  extractInsuranceFromText() {
    const insurancePatterns = [
      /travel\s*insurance.*?(?=\n|$)/gi,
      /accidental\s*death.*?(?=\n|$)/gi,
      /liability\s*cover.*?(?=\n|$)/gi
    ];

    for (const pattern of insurancePatterns) {
      const match = this.rawText.match(pattern);
      if (match) {
        this.cardData.insurance = this.cardData.insurance || {};
        if (pattern.source.includes('travel')) {
          this.cardData.insurance.travelInsurance = match[0].trim();
        } else if (pattern.source.includes('accidental')) {
          this.cardData.insurance.accidentalDeath = match[0].trim();
        } else if (pattern.source.includes('liability')) {
          this.cardData.insurance.liabilityCover = match[0].trim();
        }
      }
    }
  }

  extractContactInfo($) {
    const contactSections = $('*').filter(function() {
      const text = $(this).text().toLowerCase();
      return text.includes('phone') || text.includes('call') || text.includes('email');
    });

    contactSections.each((i, element) => {
      const text = $(element).text();
      
      const phoneMatch = text.match(/(?:phone|call)[:\s]*(\d{10,})/gi);
      if (phoneMatch) {
        this.cardData.contactInfo = this.cardData.contactInfo || {};
        this.cardData.contactInfo.phone = phoneMatch[0].trim();
      }
      
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
      if (emailMatch) {
        this.cardData.contactInfo = this.cardData.contactInfo || {};
        this.cardData.contactInfo.email = emailMatch[0].trim();
      }
    });
  }

  extractContactInfoFromText() {
    const phoneMatch = this.rawText.match(/(?:phone|call)[:\s]*(\d{10,})/gi);
    if (phoneMatch) {
      this.cardData.contactInfo = this.cardData.contactInfo || {};
      this.cardData.contactInfo.phone = phoneMatch[0].trim();
    }
    
    const emailMatch = this.rawText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
    if (emailMatch) {
      this.cardData.contactInfo = this.cardData.contactInfo || {};
      this.cardData.contactInfo.email = emailMatch[0].trim();
    }
  }

  extractLinks($, baseUrl) {
    const links = {
      termsAndConditions: null,
      pdfs: []
    };

    const tncLinks = $('a[href*="terms"], a[href*="tnc"], a[href*="conditions"]');
    if (tncLinks.length > 0) {
      links.termsAndConditions = tncLinks.first().attr('href');
    }

    const pdfLinks = $('a[href$=".pdf"]');
    pdfLinks.each((i, element) => {
      const href = $(element).attr('href');
      if (href) {
        links.pdfs.push(href);
      }
    });

    this.cardData.links = links;
  }

  getCardData() {
    return this.cardData;
  }

  reset() {
    this.cardData = createEmptyCardData();
    this.rawText = '';
    this.html = '';
  }
}

module.exports = CardDataParser;