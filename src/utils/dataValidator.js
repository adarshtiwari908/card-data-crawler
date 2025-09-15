const { DataValidationError } = require('./errorHandler');

const validationRules = {
  fees: {
    annualFee: {
      type: 'number',
      required: true,
      min: 0,
      max: 50000
    },
    joiningFee: {
      type: 'number',
      required: true,
      min: 0,
      max: 50000
    }
  },
  rewards: {
    rewardRate: {
      type: 'object',
      required: true,
      properties: {
        points: { type: 'number', min: 0, max: 100 },
        spend: { type: 'number', min: 1, max: 1000 }
      }
    },
    welcomeBonus: {
      type: 'object',
      required: false,
      properties: {
        points: { type: 'number', min: 0, max: 100000 }
      }
    }
  },
  benefits: {
    loungeAccess: {
      type: 'object',
      required: false,
      properties: {
        visits: { type: 'number', min: 0, max: 100 },
        type: { type: 'string', enum: ['domestic', 'international', 'both'] }
      }
    },
    insurance: {
      type: 'object',
      required: false,
      properties: {
        amount: { type: 'number', min: 0, max: 10000000 },
        type: { type: 'string', enum: ['travel', 'accident', 'both'] }
      }
    }
  },
  eligibility: {
    minimumIncome: {
      type: 'number',
      required: true,
      min: 0,
      max: 10000000
    },
    minimumCreditScore: {
      type: 'number',
      required: false,
      min: 300,
      max: 900
    }
  }
};

const qualityThresholds = {
  minConfidenceScore: 0.6,
  requiredFields: ['fees.annualFee', 'fees.joiningFee', 'eligibility.minimumIncome'],
  minFieldsPresent: 5,
  maxFieldsEmpty: 3
};

class CardDataValidator {
  validateCardData(data, options = {}) {
    const errors = [];
    const warnings = [];
    if (!data) {
      throw new DataValidationError('No card data provided');
    }
    const requiredSections = ['fees', 'rewards', 'benefits', 'eligibility'];
    for (const section of requiredSections) {
      if (!data[section]) {
        errors.push(`Missing required section: ${section}`);
      }
    }
    if (errors.length > 0) {
      throw new DataValidationError('Invalid card data structure', { errors });
    }
    const validationResults = {
      fees: this.validateSection(data.fees, validationRules.fees),
      rewards: this.validateSection(data.rewards, validationRules.rewards),
      benefits: this.validateSection(data.benefits, validationRules.benefits),
      eligibility: this.validateSection(data.eligibility, validationRules.eligibility)
    };
    const allErrors = [];
    const allWarnings = [];

    for (const [section, result] of Object.entries(validationResults)) {
      if (result.errors.length > 0) {
        allErrors.push(`${section}: ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        allWarnings.push(`${section}: ${result.warnings.join(', ')}`);
      }
    }
    if (data.metadata?.confidenceScores) {
      const qualityResults = this.checkDataQuality(data);
      allWarnings.push(...qualityResults.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      details: validationResults
    };
  }
  validateSection(data, rules) {
    const errors = [];
    const warnings = [];

    if (!data) {
      return { errors: ['Section data is missing'], warnings: [] };
    }

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      if (rule.required && !value) {
        errors.push(`Missing required field: ${field}`);
        continue;
      }

      if (!value && !rule.required) {
        continue;
      }

      if (rule.type === 'number') {
        if (typeof value !== 'number') {
          errors.push(`${field} must be a number`);
        } else {
          if (rule.min !== undefined && value < rule.min) {
            errors.push(`${field} must be at least ${rule.min}`);
          }
          if (rule.max !== undefined && value > rule.max) {
            warnings.push(`${field} exceeds typical maximum of ${rule.max}`);
          }
        }
      } else if (rule.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        } else if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
        }
      } else if (rule.type === 'object') {
        if (typeof value !== 'object' || !value) {
          errors.push(`${field} must be an object`);
        } else {
          for (const [prop, propRule] of Object.entries(rule.properties)) {
            if (propRule.required && !value[prop]) {
              errors.push(`${field}.${prop} is required`);
            } else if (value[prop]) {
              if (propRule.type === 'number') {
                if (typeof value[prop] !== 'number') {
                  errors.push(`${field}.${prop} must be a number`);
                } else {
                  if (propRule.min !== undefined && value[prop] < propRule.min) {
                    errors.push(`${field}.${prop} must be at least ${propRule.min}`);
                  }
                  if (propRule.max !== undefined && value[prop] > propRule.max) {
                    warnings.push(`${field}.${prop} exceeds typical maximum of ${propRule.max}`);
                  }
                }
              }
              if (propRule.type === 'string' && propRule.enum) {
                if (!propRule.enum.includes(value[prop])) {
                  errors.push(`${field}.${prop} must be one of: ${propRule.enum.join(', ')}`);
                }
              }
            }
          }
        }
      }
    }

    return { errors, warnings };
  }

  checkDataQuality(data) {
    const warnings = [];
    const scores = data.metadata.confidenceScores;

    for (const [section, score] of Object.entries(scores)) {
      if (score < qualityThresholds.minConfidenceScore) {
        warnings.push(`Low confidence score (${score}) for ${section} section`);
      }
    }

    for (const field of qualityThresholds.requiredFields) {
      const [section, key] = field.split('.');
      if (!data[section] || data[section][key] === undefined) {
        warnings.push(`Missing important field: ${field}`);
      }
    }

    let presentFields = 0;
    let emptyFields = 0;
    let totalFields = 0;

    for (const section of Object.values(data)) {
      if (typeof section === 'object' && section !== null) {
        for (const value of Object.values(section)) {
          totalFields++;
          if (value === undefined || value === null) {
            emptyFields++;
          } else {
            presentFields++;
          }
        }
      }
    }

    if (presentFields < qualityThresholds.minFieldsPresent) {
      warnings.push(`Too few fields present (${presentFields}/${totalFields})`);
    }

    if (emptyFields > qualityThresholds.maxFieldsEmpty) {
      warnings.push(`Too many empty fields (${emptyFields}/${totalFields})`);
    }

    return { warnings };
  }

  compareCardData(data1, data2) {
    const differences = [];

    for (const section of ['fees', 'rewards', 'benefits', 'eligibility']) {
      if (!data1[section] || !data2[section]) continue;

      for (const field of Object.keys(validationRules[section])) {
        const value1 = data1[section][field];
        const value2 = data2[section][field];

        if (value1 !== value2) {
          differences.push({
            section,
            field,
            values: [value1, value2]
          });
        }
      }
    }

    return differences;
  }

  calculateCompleteness(data) {
    let totalFields = 0;
    let presentFields = 0;

    for (const section of Object.keys(validationRules)) {
      if (!data[section]) continue;

      for (const field of Object.keys(validationRules[section])) {
        totalFields++;
        if (data[section][field] !== undefined && data[section][field] !== null) {
          presentFields++;
        }
      }
    }

    return {
      score: totalFields > 0 ? presentFields / totalFields : 0,
      presentFields,
      totalFields
    };
  }
}

const globalValidator = new CardDataValidator();

module.exports = {
  CardDataValidator,
  globalValidator,
  validationRules,
  qualityThresholds
};