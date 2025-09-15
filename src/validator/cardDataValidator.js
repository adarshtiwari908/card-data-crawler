const { getRequiredFields, isFieldRequired } = require('../schema/cardSchema');
const { logInfo, logSuccess, logError, logWarn } = require('../utils/logger');

class CardDataValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate(cardData) {
    this.errors = [];
    this.warnings = [];

    logInfo('Starting card data validation...');

    this.validateRequiredFields(cardData);
    this.validateAmounts(cardData);
    this.validatePercentages(cardData);
    this.validateArrays(cardData);
    this.validateObjects(cardData);
    this.validateBusinessLogic(cardData);

    const result = {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      score: this.calculateValidationScore(cardData)
    };

    if (result.isValid) {
      logSuccess('Card data validation passed');
    } else {
      logError(`Card data validation failed with ${this.errors.length} errors`);
    }

    return result;
  }

  validateRequiredFields(cardData) {
    const requiredFields = getRequiredFields();
    requiredFields.forEach(field => {
      if (!cardData[field] || cardData[field] === null || cardData[field] === '') {
        this.errors.push(`Required field '${field}' is missing or empty`);
      }
    });
  }

  validateAmounts(cardData) {
    const amountFields = ['annualFee', 'joiningFee'];
    amountFields.forEach(field => {
      if (cardData[field] && cardData[field] !== null) {
        if (!this.isValidAmount(cardData[field])) {
          this.errors.push(`Invalid amount format for '${field}': ${cardData[field]}. Expected format: ₹X,XXX or Rs X,XXX`);
        }
      }
    });

    if (cardData.otherCharges && Array.isArray(cardData.otherCharges)) {
      cardData.otherCharges.forEach((charge, index) => {
        if (charge && !this.isValidAmount(charge) && !this.isValidChargeDescription(charge)) {
          this.warnings.push(`Other charge ${index + 1} may have invalid format: ${charge}`);
        }
      });
    }
  }

  validatePercentages(cardData) {
    if (cardData.interestRate && cardData.interestRate !== null) {
      if (!this.isValidPercentage(cardData.interestRate)) {
        this.errors.push(`Invalid interest rate format: ${cardData.interestRate}. Expected format: X.X% or X.X% per month`);
      }
    }

    if (cardData.foreignCurrencyMarkup && cardData.foreignCurrencyMarkup !== null) {
      if (!this.isValidPercentage(cardData.foreignCurrencyMarkup)) {
        this.warnings.push(`Invalid foreign currency markup format: ${cardData.foreignCurrencyMarkup}. Expected format: X.X%`);
      }
    }
  }

  validateArrays(cardData) {
    const arrayFields = ['rewards', 'benefits', 'eligibilityCriteria', 'documentsRequired', 'otherCharges', 'welcomeBenefits', 'milestoneBenefits', 'redemptionOptions'];
    arrayFields.forEach(field => {
      if (cardData[field] !== null && cardData[field] !== undefined) {
        if (!Array.isArray(cardData[field])) {
          this.errors.push(`Field '${field}' should be an array, got: ${typeof cardData[field]}`);
        } else {
          const emptyItems = cardData[field].filter(item => !item || item.trim() === '');
          if (emptyItems.length > 0) {
            this.warnings.push(`Field '${field}' contains ${emptyItems.length} empty items`);
          }
        }
      }
    });
  }

  validateObjects(cardData) {
    const objectFields = ['links', 'loungeAccess', 'insurance', 'contactInfo'];
    objectFields.forEach(field => {
      if (cardData[field] !== null && cardData[field] !== undefined) {
        if (typeof cardData[field] !== 'object' || Array.isArray(cardData[field])) {
          this.errors.push(`Field '${field}' should be an object, got: ${typeof cardData[field]}`);
        }
      }
    });

    if (cardData.links && typeof cardData.links === 'object') {
      if (cardData.links.termsAndConditions && !this.isValidUrl(cardData.links.termsAndConditions)) {
        this.warnings.push(`Invalid terms and conditions URL: ${cardData.links.termsAndConditions}`);
      }
      if (cardData.links.pdfs && Array.isArray(cardData.links.pdfs)) {
        cardData.links.pdfs.forEach((url, index) => {
          if (!this.isValidUrl(url)) {
            this.warnings.push(`Invalid PDF URL ${index + 1}: ${url}`);
          }
        });
      }
    }

    if (cardData.contactInfo && typeof cardData.contactInfo === 'object') {
      if (cardData.contactInfo.phone && !this.isValidPhone(cardData.contactInfo.phone)) {
        this.warnings.push(`Invalid phone number format: ${cardData.contactInfo.phone}`);
      }
      if (cardData.contactInfo.email && !this.isValidEmail(cardData.contactInfo.email)) {
        this.warnings.push(`Invalid email format: ${cardData.contactInfo.email}`);
      }
    }
  }

  validateBusinessLogic(cardData) {
    if (cardData.annualFee && cardData.joiningFee) {
      const annualFeeAmount = this.extractAmount(cardData.annualFee);
      const joiningFeeAmount = this.extractAmount(cardData.joiningFee);
      if (annualFeeAmount && joiningFeeAmount) {
        if (annualFeeAmount < 0 || joiningFeeAmount < 0) {
          this.errors.push('Fees cannot be negative');
        }
        if (annualFeeAmount > 100000) {
          this.warnings.push('Annual fee seems unusually high');
        }
        if (joiningFeeAmount > 50000) {
          this.warnings.push('Joining fee seems unusually high');
        }
      }
    }

    if (cardData.interestRate) {
      const rate = this.extractPercentage(cardData.interestRate);
      if (rate && (rate < 0 || rate > 100)) {
        this.warnings.push(`Interest rate seems unusual: ${cardData.interestRate}`);
      }
    }

    if (cardData.cardName) {
      const name = cardData.cardName.toLowerCase();
      if (!name.includes('regalia') || !name.includes('gold')) {
        this.warnings.push(`Card name may not match expected card: ${cardData.cardName}`);
      }
    }
  }

  isValidAmount(amount) {
    if (typeof amount !== 'string') return false;
    const patterns = [
      /^₹\s*[0-9,]+$/,
      /^Rs\s*[0-9,]+$/,
      /^[0-9,]+$/,
      /^₹\s*[0-9,]+\.?[0-9]*$/,
      /^Rs\s*[0-9,]+\.?[0-9]*$/
    ];
    return patterns.some(pattern => pattern.test(amount.trim()));
  }

  isValidPercentage(percentage) {
    if (typeof percentage !== 'string') return false;
    const patterns = [
      /^\d+(\.\d+)?\s*%$/,
      /^\d+(\.\d+)?\s*%\s*per\s*month$/,
      /^\d+(\.\d+)?\s*%\s*annually$/,
      /^\d+(\.\d+)?\s*%\s*p\.a\.$/
    ];
    return patterns.some(pattern => pattern.test(percentage.trim()));
  }

  isValidChargeDescription(charge) {
    if (typeof charge !== 'string') return false;
    const patterns = [
      /late\s*payment/i,
      /penalty/i,
      /overdue/i,
      /cash\s*advance/i,
      /balance\s*transfer/i
    ];
    return patterns.some(pattern => pattern.test(charge));
  }

  isValidUrl(url) {
    if (typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isValidPhone(phone) {
    if (typeof phone !== 'string') return false;
    const patterns = [
      /^\d{10}$/,
      /^\d{12}$/,
      /^\+91\s*\d{10}$/,
      /^1800\s*\d{4}$/,
      /^1860\s*\d{4}$/
    ];
    return patterns.some(pattern => pattern.test(phone.replace(/\s/g, '')));
  }

  isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
  }

  extractAmount(amount) {
    if (typeof amount !== 'string') return null;
    const match = amount.match(/([0-9,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return null;
  }

  extractPercentage(percentage) {
    if (typeof percentage !== 'string') return null;
    const match = percentage.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  calculateValidationScore(cardData) {
    const totalFields = Object.keys(cardData).length;
    const filledFields = Object.values(cardData).filter(value =>
      value !== null && value !== undefined && value !== '' &&
      (!Array.isArray(value) || value.length > 0) &&
      (typeof value !== 'object' || Object.keys(value).length > 0)
    ).length;
    const baseScore = (filledFields / totalFields) * 100;
    const errorPenalty = this.errors.length * 5;
    const warningPenalty = this.warnings.length * 1;
    return Math.max(0, Math.min(100, baseScore - errorPenalty - warningPenalty));
  }

  getValidationSummary(validationResult) {
    const { isValid, errors, warnings, score } = validationResult;
    let summary = `Validation ${isValid ? 'PASSED' : 'FAILED'} (Score: ${score.toFixed(1)}/100)\n`;
    summary += `Errors: ${errors.length}, Warnings: ${warnings.length}\n`;
    if (errors.length > 0) {
      summary += '\nErrors:\n';
      errors.forEach((error, index) => {
        summary += `  ${index + 1}. ${error}\n`;
      });
    }
    if (warnings.length > 0) {
      summary += '\nWarnings:\n';
      warnings.forEach((warning, index) => {
        summary += `  ${index + 1}. ${warning}\n`;
      });
    }
    return summary;
  }
}

module.exports = CardDataValidator;
