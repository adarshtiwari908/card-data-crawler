const { createEmptyCardData } = require('../schema/cardSchema');

class CardDataAggregator {
  constructor() {
    this.cardData = createEmptyCardData();
    this.sources = [];
  }

  addSourceData(data, sourceType, url) {
    this.sources.push({ data, sourceType, url });
    this.mergeData(data);
  }

  mergeData(sourceData) {
    const stringFields = ['cardName', 'annualFee', 'joiningFee', 'interestRate', 'foreignCurrencyMarkup'];
    stringFields.forEach(field => {
      if (sourceData[field] && sourceData[field] !== null && sourceData[field] !== '') {
        if (!this.cardData[field] || this.cardData[field] === null) {
          this.cardData[field] = sourceData[field];
        }
      }
    });

    const arrayFields = ['rewards', 'benefits', 'eligibilityCriteria', 'documentsRequired', 'otherCharges', 'welcomeBenefits', 'milestoneBenefits', 'redemptionOptions'];
    arrayFields.forEach(field => {
      if (sourceData[field] && Array.isArray(sourceData[field]) && sourceData[field].length > 0) {
        if (!this.cardData[field]) {
          this.cardData[field] = [];
        }
        sourceData[field].forEach(item => {
          if (item && item.trim() !== '' && !this.cardData[field].includes(item.trim())) {
            this.cardData[field].push(item.trim());
          }
        });
      }
    });

    this.mergeObjectField('links', sourceData.links);
    this.mergeObjectField('loungeAccess', sourceData.loungeAccess);
    this.mergeObjectField('insurance', sourceData.insurance);
    this.mergeObjectField('contactInfo', sourceData.contactInfo);
  }

  mergeObjectField(fieldName, sourceData) {
    if (!sourceData || typeof sourceData !== 'object') return;

    if (!this.cardData[fieldName]) {
      this.cardData[fieldName] = {};
    }

    Object.keys(sourceData).forEach(key => {
      if (sourceData[key] !== null && sourceData[key] !== undefined && sourceData[key] !== '') {
        if (Array.isArray(sourceData[key])) {
          if (!this.cardData[fieldName][key]) {
            this.cardData[fieldName][key] = [];
          }
          sourceData[key].forEach(item => {
            if (item && item.trim() !== '' && !this.cardData[fieldName][key].includes(item.trim())) {
              this.cardData[fieldName][key].push(item.trim());
            }
          });
        } else {
          if (!this.cardData[fieldName][key] || this.cardData[fieldName][key] === null) {
            this.cardData[fieldName][key] = sourceData[key];
          }
        }
      }
    });
  }

  getCardData() {
    return this.cardData;
  }

  getSources() {
    return this.sources;
  }

  getCompletenessReport() {
    const report = {
      totalFields: 0,
      filledFields: 0,
      emptyFields: 0,
      fieldDetails: {}
    };

    Object.keys(this.cardData).forEach(field => {
      report.totalFields++;
      const value = this.cardData[field];
      let isFilled = false;
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          isFilled = value.length > 0;
        } else if (typeof value === 'object') {
          isFilled = Object.keys(value).length > 0;
        } else {
          isFilled = true;
        }
      }
      if (isFilled) {
        report.filledFields++;
        report.fieldDetails[field] = 'filled';
      } else {
        report.emptyFields++;
        report.fieldDetails[field] = 'empty';
      }
    });

    report.completenessPercentage = (report.filledFields / report.totalFields) * 100;
    return report;
  }

  cleanData() {
    const arrayFields = ['rewards', 'benefits', 'eligibilityCriteria', 'documentsRequired', 'otherCharges', 'welcomeBenefits', 'milestoneBenefits', 'redemptionOptions'];
    arrayFields.forEach(field => {
      if (this.cardData[field] && Array.isArray(this.cardData[field])) {
        this.cardData[field] = this.cardData[field]
          .filter(item => item && item.trim() !== '')
          .map(item => item.trim())
          .filter((item, index, array) => array.indexOf(item) === index);
      }
    });

    const stringFields = ['cardName', 'annualFee', 'joiningFee', 'interestRate', 'foreignCurrencyMarkup'];
    stringFields.forEach(field => {
      if (this.cardData[field] && typeof this.cardData[field] === 'string') {
        this.cardData[field] = this.cardData[field].trim();
      }
    });

    if (this.cardData.links && this.cardData.links.pdfs && Array.isArray(this.cardData.links.pdfs)) {
      this.cardData.links.pdfs = [...new Set(this.cardData.links.pdfs)];
    }
  }

  reset() {
    this.cardData = createEmptyCardData();
    this.sources = [];
  }

  getSummary() {
    const report = this.getCompletenessReport();
    const sources = this.getSources();
    let summary = `Card Data Aggregation Summary\n`;
    summary += `============================\n`;
    summary += `Sources processed: ${sources.length}\n`;
    summary += `Data completeness: ${report.completenessPercentage.toFixed(1)}%\n`;
    summary += `Filled fields: ${report.filledFields}/${report.totalFields}\n`;
    summary += `Empty fields: ${report.emptyFields}\n\n`;
    summary += `Sources:\n`;
    sources.forEach((source, index) => {
      summary += `  ${index + 1}. ${source.sourceType.toUpperCase()}: ${source.url}\n`;
    });
    return summary;
  }
}

module.exports = CardDataAggregator;