const cheerio = require('cheerio');

const extractionPatterns = {
  fees: {
    annualFee: {
      patterns: [
        /annual\s+fee:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i,
        /yearly\s+fee:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i,
        /membership\s+fee:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i
      ],
      selectors: [
        '.annual-fee',
        '[data-fee="annual"]',
        'th:contains("Annual") + td',
        'dt:contains("Annual") + dd'
      ]
    },
    joiningFee: {
      patterns: [
        /joining\s+fee:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i,
        /card\s+fee:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i,
        /one[- ]time\s+fee:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i
      ],
      selectors: [
        '.joining-fee',
        '[data-fee="joining"]',
        'th:contains("Joining") + td',
        'dt:contains("Joining") + dd'
      ]
    }
  },

  rewards: {
    rewardRate: {
      patterns: [
        /(\d+(?:\.\d+)?)\s*(?:reward\s+points?|points?)\s+(?:for\s+every|per)\s*(?:rs\.?|₹)?\s*(\d+)/i,
        /earn\s+(\d+(?:\.\d+)?)\s*(?:reward\s+points?|points?)\s+on\s+(?:every\s+)?(?:rs\.?|₹)?\s*(\d+)/i
      ],
      selectors: [
        '.reward-rate',
        '[data-reward="rate"]',
        'th:contains("Reward") + td',
        'dt:contains("Reward") + dd'
      ]
    },
    welcomeBonus: {
      patterns: [
        /welcome\s+bonus:?\s*(?:of\s+)?(\d+(?:[,\d]+)?)\s*(?:reward\s+points?|points?)/i,
        /joining\s+bonus:?\s*(?:of\s+)?(\d+(?:[,\d]+)?)\s*(?:reward\s+points?|points?)/i
      ],
      selectors: [
        '.welcome-bonus',
        '[data-reward="welcome"]',
        'th:contains("Welcome") + td',
        'dt:contains("Welcome") + dd'
      ]
    }
  },

  benefits: {
    airportLounge: {
      patterns: [
        /(\d+)\s+(?:complimentary|free)\s+airport\s+lounge\s+(?:visit|access)/i,
        /airport\s+lounge\s+access:?\s*(\d+)\s+(?:visit|time)/i
      ],
      selectors: [
        '.lounge-access',
        '[data-benefit="lounge"]',
        'th:contains("Lounge") + td',
        'dt:contains("Lounge") + dd'
      ]
    },
    insurance: {
      patterns: [
        /insurance\s+cover\s+(?:up\s+to\s+)?(?:rs\.?|₹)?\s*([\d,]+)/i,
        /(?:travel|accident)\s+insurance\s+(?:up\s+to\s+)?(?:rs\.?|₹)?\s*([\d,]+)/i
      ],
      selectors: [
        '.insurance-coverage',
        '[data-benefit="insurance"]',
        'th:contains("Insurance") + td',
        'dt:contains("Insurance") + dd'
      ]
    }
  },

  eligibility: {
    income: {
      patterns: [
        /minimum\s+annual\s+income:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i,
        /income\s+requirement:?\s*(?:rs\.?|₹)?\s*([\d,]+)/i
      ],
      selectors: [
        '.min-income',
        '[data-eligibility="income"]',
        'th:contains("Income") + td',
        'dt:contains("Income") + dd'
      ]
    },
    creditScore: {
      patterns: [
        /minimum\s+credit\s+score:?\s*(\d+)/i,
        /cibil\s+score:?\s*(\d+)/i
      ],
      selectors: [
        '.credit-score',
        '[data-eligibility="credit-score"]',
        'th:contains("Credit Score") + td',
        'dt:contains("Credit Score") + dd'
      ]
    }
  }
};

class ContentExtractor {
  extractCardInfo(html) {
    const $ = cheerio.load(html);
    
    return {
      fees: this.extractFees($),
      rewards: this.extractRewards($),
      benefits: this.extractBenefits($),
      eligibility: this.extractEligibility($),
      metadata: {
        extractedAt: new Date().toISOString(),
        confidenceScores: this.calculateConfidenceScores($)
      }
    };
  }

  extractFees($) {
    const fees = {};

    const annualFee = this.extractValue($, extractionPatterns.fees.annualFee);
    if (annualFee) fees.annualFee = annualFee;
    
    const joiningFee = this.extractValue($, extractionPatterns.fees.joiningFee);
    if (joiningFee) fees.joiningFee = joiningFee;
    
    return fees;
  }

  extractRewards($) {
    const rewards = {};

    const rewardRate = this.extractValue($, extractionPatterns.rewards.rewardRate);
    if (rewardRate) rewards.rewardRate = rewardRate;
    
    const welcomeBonus = this.extractValue($, extractionPatterns.rewards.welcomeBonus);
    if (welcomeBonus) rewards.welcomeBonus = welcomeBonus;
    
    return rewards;
  }

  extractBenefits($) {
    const benefits = {};

    const loungeAccess = this.extractValue($, extractionPatterns.benefits.airportLounge);
    if (loungeAccess) benefits.loungeAccess = loungeAccess;
    
    const insurance = this.extractValue($, extractionPatterns.benefits.insurance);
    if (insurance) benefits.insurance = insurance;
    
    return benefits;
  }

  extractEligibility($) {
    const eligibility = {};
    
    const income = this.extractValue($, extractionPatterns.eligibility.income);
    if (income) eligibility.minimumIncome = income;

    const creditScore = this.extractValue($, extractionPatterns.eligibility.creditScore);
    if (creditScore) eligibility.minimumCreditScore = creditScore;
    
    return eligibility;
  }

  extractValue($, config) {
    let value = null;
    let confidence = 0;

    for (const selector of config.selectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        for (const pattern of config.patterns) {
          const match = text.match(pattern);
          if (match) {
            value = this.normalizeValue(match[1]);
            confidence = 1.0;
            return { value, confidence };
          }
        }
        value = this.normalizeValue(text);
        confidence = 0.8;
        return { value, confidence };
      }
    }

    const fullText = $('body').text();
    for (const pattern of config.patterns) {
      const match = fullText.match(pattern);
      if (match) {
        value = this.normalizeValue(match[1]);
        confidence = 0.6;
        return { value, confidence };
      }
    }

    return null;
  }

  normalizeValue(value) {
    if (!value) return null;
    
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
    
    return value.trim();
  }

  calculateConfidenceScores($) {
    const scores = {
      fees: 0,
      rewards: 0,
      benefits: 0,
      eligibility: 0
    };

    if ($('body').text().match(/annual\s+fee|joining\s+fee/i)) {
      scores.fees += 0.5;
      if ($('.annual-fee, [data-fee]').length > 0) {
        scores.fees += 0.5;
      }
    }

    if ($('body').text().match(/reward\s+points?|welcome\s+bonus/i)) {
      scores.rewards += 0.5;
      if ($('.reward-rate, [data-reward]').length > 0) {
        scores.rewards += 0.5;
      }
    }

    if ($('body').text().match(/lounge\s+access|insurance\s+cover/i)) {
      scores.benefits += 0.5;
      if ($('.lounge-access, [data-benefit]').length > 0) {
        scores.benefits += 0.5;
      }
    }

    if ($('body').text().match(/minimum\s+income|credit\s+score/i)) {
      scores.eligibility += 0.5;
      if ($('.min-income, [data-eligibility]').length > 0) {
        scores.eligibility += 0.5;
      }
    }

    return scores;
  }
}

const globalExtractor = new ContentExtractor();

module.exports = {
  ContentExtractor,
  globalExtractor,
  extractionPatterns
};