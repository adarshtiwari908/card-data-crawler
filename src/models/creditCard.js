class CreditCard {
  constructor(data = {}) {
    this.name = data.name || '';
    this.type = data.type || '';
    this.issuer = data.issuer || '';
    this.network = data.network || '';
    this.cardUrl = data.cardUrl || '';
    this.metadata = this.initializeMetadata(data.metadata);
    this.fees = this.initializeFees(data.fees);
    this.rewards = this.initializeRewards(data.rewards);
    this.benefits = this.initializeBenefits(data.benefits);
    this.eligibility = this.initializeEligibility(data.eligibility);
    this.termsAndConditions = data.termsAndConditions || [];
    this.features = data.features || [];
  }

  initializeMetadata(data = {}) {
    return {
      extractedAt: data.extractedAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      version: data.version || '1.0.0',
      source: data.source || 'web-crawler',
      confidenceScores: data.confidenceScores || {},
      processingTime: data.processingTime || 0,
      status: data.status || 'draft'
    };
  }

  initializeFees(data = {}) {
    return {
      annual: {
        amount: data.annualFee || 0,
        currency: data.currency || 'INR',
        details: data.annualFeeDetails || ''
      },
      joining: {
        amount: data.joiningFee || 0,
        currency: data.currency || 'INR',
        details: data.joiningFeeDetails || ''
      },
      supplementaryCard: {
        amount: data.supplementaryFee || 0,
        currency: data.currency || 'INR',
        details: data.supplementaryDetails || ''
      },
      renewalFee: {
        amount: data.renewalFee || 0,
        currency: data.currency || 'INR',
        details: data.renewalDetails || ''
      },
      spendCriteria: data.spendCriteria || [],
      waiverConditions: data.waiverConditions || []
    };
  }

  initializeRewards(data = {}) {
    return {
      rewardRate: {
        regular: this.initializeRewardRate(data.regularRate),
        accelerated: data.acceleratedRates || []
      },
      welcomeBonus: {
        points: data.welcomePoints || 0,
        conditions: data.welcomeConditions || [],
        validity: data.welcomeValidity || ''
      },
      milestoneBonus: data.milestoneBonus || [],
      pointsValidity: data.pointsValidity || '',
      redemptionOptions: data.redemptionOptions || [],
      conversionRates: data.conversionRates || [],
      exclusions: data.exclusions || []
    };
  }

  initializeRewardRate(data = {}) {
    return {
      points: data.points || 0,
      spend: data.spend || 0,
      currency: data.currency || 'INR',
      categories: data.categories || [],
      exclusions: data.exclusions || []
    };
  }

  initializeBenefits(data = {}) {
    return {
      airportLounge: {
        domestic: {
          visits: data.domesticLoungeVisits || 0,
          details: data.domesticLoungeDetails || ''
        },
        international: {
          visits: data.internationalLoungeVisits || 0,
          details: data.internationalLoungeDetails || ''
        },
        conditions: data.loungeConditions || []
      },
      insurance: {
        travel: this.initializeInsurance(data.travelInsurance),
        accident: this.initializeInsurance(data.accidentInsurance),
        purchase: this.initializeInsurance(data.purchaseInsurance)
      },
      offers: {
        dining: data.diningOffers || [],
        shopping: data.shoppingOffers || [],
        travel: data.travelOffers || [],
        entertainment: data.entertainmentOffers || []
      },
      concierge: {
        available: data.hasConcierge || false,
        details: data.conciergeDetails || ''
      },
      golfProgram: {
        available: data.hasGolfProgram || false,
        details: data.golfDetails || ''
      },
      additionalBenefits: data.additionalBenefits || []
    };
  }

  initializeInsurance(data = {}) {
    return {
      amount: data.amount || 0,
      currency: data.currency || 'INR',
      details: data.details || '',
      conditions: data.conditions || []
    };
  }

  initializeEligibility(data = {}) {
    return {
      income: {
        minimum: data.minimumIncome || 0,
        currency: data.currency || 'INR',
        type: data.incomeType || 'annual'
      },
      creditScore: {
        minimum: data.minimumCreditScore || 0,
        recommended: data.recommendedCreditScore || 0
      },
      age: {
        minimum: data.minimumAge || 0,
        maximum: data.maximumAge || 0
      },
      employment: {
        status: data.employmentStatus || [],
        minimumExperience: data.minimumExperience || 0
      },
      documents: data.requiredDocuments || [],
      additionalCriteria: data.additionalCriteria || []
    };
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      issuer: this.issuer,
      network: this.network,
      cardUrl: this.cardUrl,
      metadata: this.metadata,
      fees: this.fees,
      rewards: this.rewards,
      benefits: this.benefits,
      eligibility: this.eligibility,
      termsAndConditions: this.termsAndConditions,
      features: this.features
    };
  }

  static fromRawData(rawData) {
    const mappedData = {
      name: rawData.name,
      type: rawData.type,
      issuer: rawData.issuer,
      network: rawData.network,
      cardUrl: rawData.cardUrl,
      fees: {
        annualFee: rawData.fees?.annualFee,
        joiningFee: rawData.fees?.joiningFee,
        currency: 'INR'
      },
      rewards: {
        regularRate: {
          points: rawData.rewards?.rewardRate?.points,
          spend: rawData.rewards?.rewardRate?.spend
        },
        welcomePoints: rawData.rewards?.welcomeBonus?.points
      },
      benefits: {
        domesticLoungeVisits: rawData.benefits?.loungeAccess?.domestic?.visits,
        internationalLoungeVisits: rawData.benefits?.loungeAccess?.international?.visits,
        travelInsurance: rawData.benefits?.insurance?.travel,
        accidentInsurance: rawData.benefits?.insurance?.accident
      },
      eligibility: {
        minimumIncome: rawData.eligibility?.minimumIncome,
        minimumCreditScore: rawData.eligibility?.minimumCreditScore
      }
    };

    return new CreditCard(mappedData);
  }
}

module.exports = CreditCard;