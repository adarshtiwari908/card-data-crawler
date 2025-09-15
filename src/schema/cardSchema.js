const cardSchema = {
  cardName: {
    type: 'string',
    required: true,
    description: 'Name of the credit card'
  },
  annualFee: {
    type: 'string',
    required: true,
    description: 'Annual fee amount (e.g., "₹2,500")'
  },
  joiningFee: {
    type: 'string',
    required: true,
    description: 'Joining fee amount (e.g., "₹2,500")'
  },
  rewards: {
    type: 'array',
    required: false,
    description: 'List of reward programs and benefits'
  },
  benefits: {
    type: 'array',
    required: false,
    description: 'List of card benefits and features'
  },
  eligibilityCriteria: {
    type: 'array',
    required: false,
    description: 'Eligibility requirements for the card'
  },
  documentsRequired: {
    type: 'array',
    required: false,
    description: 'Required documents for application'
  },
  interestRate: {
    type: 'string',
    required: false,
    description: 'Interest rate (e.g., "3.6% per month")'
  },
  otherCharges: {
    type: 'array',
    required: false,
    description: 'Other fees and charges'
  },
  links: {
    type: 'object',
    required: false,
    properties: {
      termsAndConditions: {
        type: 'string',
        description: 'URL to terms and conditions'
      },
      pdfs: {
        type: 'array',
        description: 'Array of PDF URLs'
      }
    }
  },
  cardType: {
    type: 'string',
    required: false,
    description: 'Type of card (e.g., "Premium", "Gold")'
  },
  creditLimit: {
    type: 'string',
    required: false,
    description: 'Credit limit information'
  },
  welcomeBenefits: {
    type: 'array',
    required: false,
    description: 'Welcome offers and benefits'
  },
  milestoneBenefits: {
    type: 'array',
    required: false,
    description: 'Milestone-based benefits'
  },
  loungeAccess: {
    type: 'object',
    required: false,
    properties: {
      domestic: {
        type: 'string',
        description: 'Domestic lounge access details'
      },
      international: {
        type: 'string',
        description: 'International lounge access details'
      }
    }
  },
  insurance: {
    type: 'object',
    required: false,
    properties: {
      travelInsurance: {
        type: 'string',
        description: 'Travel insurance coverage'
      },
      accidentalDeath: {
        type: 'string',
        description: 'Accidental death coverage'
      },
      liabilityCover: {
        type: 'string',
        description: 'Liability coverage'
      }
    }
  },
  redemptionOptions: {
    type: 'array',
    required: false,
    description: 'Reward points redemption options'
  },
  foreignCurrencyMarkup: {
    type: 'string',
    required: false,
    description: 'Foreign currency transaction markup'
  },
  contactInfo: {
    type: 'object',
    required: false,
    properties: {
      phone: {
        type: 'string',
        description: 'Customer service phone number'
      },
      email: {
        type: 'string',
        description: 'Customer service email'
      }
    }
  }
};

/**
 * Creates an empty card data object with all fields initialized to null
 * @returns {Object} Empty card data object
 */
function createEmptyCardData() {
  const cardData = {};

  Object.keys(cardSchema).forEach(field => {
    if (cardSchema[field].type === 'array') {
      cardData[field] = [];
    } else if (cardSchema[field].type === 'object') {
      cardData[field] = {};
    } else {
      cardData[field] = null;
    }
  });
  
  return cardData;
}

/**
 * Gets required fields from the schema
 * @returns {Array} Array of required field names
 */
function getRequiredFields() {
  return Object.keys(cardSchema).filter(field => cardSchema[field].required);
}

/**
 * Validates if a field is required
 * @param {string} fieldName - Name of the field to check
 * @returns {boolean} True if field is required
 */
function isFieldRequired(fieldName) {
  return cardSchema[fieldName] && cardSchema[fieldName].required;
}

module.exports = {
  cardSchema,
  createEmptyCardData,
  getRequiredFields,
  isFieldRequired
};
