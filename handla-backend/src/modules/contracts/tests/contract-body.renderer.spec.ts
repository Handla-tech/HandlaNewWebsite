import { renderContractBody } from '../contract-body.renderer';
import { ContractType, OwnershipType } from '../dto/contract-details.dto';

describe('renderContractBody()', () => {
  it('returns an empty string when details are completely empty', () => {
    expect(renderContractBody({})).toBe('');
  });

  it('renders only sections that have content (no empty headers)', () => {
    const out = renderContractBody({
      clientName: 'Acme Co',
    });
    expect(out).toContain('CLIENT INFORMATION');
    expect(out).toContain('Client Name: Acme Co');
    // No other section headers should be present
    expect(out).not.toContain('TIMELINE');
    expect(out).not.toContain('FINANCIAL DETAILS');
    expect(out).not.toContain('PROJECT DETAILS');
  });

  it('renders a comprehensive payload with all sections', () => {
    const out = renderContractBody({
      contractNumber: 'CN-001',
      contractType:   ContractType.FIXED_PRICE,
      projectName:    'Marketing Site',
      clientName:     'Acme',
      clientCompany:  'Acme Inc',
      clientEmail:    'c@acme.test',
      projectDescription: 'Build the site.',
      scopeOfWork:        'HTML/CSS + CMS',
      deliverables:       ['Homepage', 'About page'],
      excludedServices:   ['SEO'],
      startDate:          '2026-07-01',
      endDate:            '2026-09-30',
      estimatedDuration:  '3 months',
      currency:           'USD',
      totalValue:         10000,
      paymentMilestones:  [
        { name: 'Deposit', percentage: 30, amount: 3000, dueDate: '2026-07-01' },
        { name: 'Final',   percentage: 70, amount: 7000, dueDate: '2026-09-30' },
      ],
      freeRevisions:           2,
      additionalRevisionCost:  150,
      warrantyPeriod:          '30 days',
      supportPeriod:           '90 days',
      ownershipType:           OwnershipType.OWNERSHIP_TRANSFERS_AFTER_PAYMENT,
      ndaIncluded:             true,
      hostingIncluded:         true,
      domainIncluded:          false,
      sslIncluded:             true,
      deploymentIncluded:      true,
      latePaymentPenalty:      '1.5% per month',
      terminationTerms:        'Either party may terminate with 30 days notice.',
      acceptancePeriodDays:    7,
      termsAndConditions:      'Standard terms apply.',
    });

    expect(out).toContain('CONTRACT INFORMATION');
    expect(out).toContain('CN-001');
    expect(out).toContain('Fixed Price'); // ContractType formatted

    expect(out).toContain('CLIENT INFORMATION');
    expect(out).toContain('Acme');
    expect(out).toContain('c@acme.test');

    expect(out).toContain('PROJECT DETAILS');
    expect(out).toContain('• Homepage');
    expect(out).toContain('• About page');
    expect(out).toContain('• SEO');

    expect(out).toContain('TIMELINE');
    expect(out).toContain('2026-07-01');

    expect(out).toContain('FINANCIAL DETAILS');
    expect(out).toContain('USD 10,000.00');

    expect(out).toContain('PAYMENT SCHEDULE');
    expect(out).toContain('• Deposit');
    expect(out).toContain('30%');

    expect(out).toContain('REVISION POLICY');
    expect(out).toContain('USD 150.00');

    expect(out).toContain('WARRANTY & SUPPORT');
    expect(out).toContain('INTELLECTUAL PROPERTY');
    expect(out).toContain('Ownership Transfers After Full Payment');

    expect(out).toContain('CONFIDENTIALITY');
    expect(out).toContain('NDA Included: Yes');

    expect(out).toContain('HOSTING & DEPLOYMENT');
    expect(out).toContain('Domain Included: No');
    expect(out).toContain('SSL Included: Yes');

    expect(out).toContain('LATE PAYMENT TERMS');
    expect(out).toContain('TERMINATION CLAUSE');
    expect(out).toContain('30 days notice');

    expect(out).toContain('ACCEPTANCE TERMS');
    expect(out).toContain('Acceptance Period (Days): 7');

    expect(out).toContain('TERMS & CONDITIONS');
    expect(out).toContain('Standard terms apply.');
  });

  it('formats currency with thousand separators', () => {
    const out = renderContractBody({ currency: 'EUR', totalValue: 1234567.89 });
    expect(out).toContain('EUR 1,234,567.89');
  });

  it('defaults currency to USD when missing', () => {
    const out = renderContractBody({ totalValue: 500 });
    expect(out).toContain('USD 500.00');
  });

  it('filters out empty deliverable strings', () => {
    const out = renderContractBody({
      deliverables: ['Real item', '', '   ', 'Another'],
    });
    expect(out).toContain('• Real item');
    expect(out).toContain('• Another');
    // Should not include an empty bullet
    expect(out).not.toMatch(/• \n/);
  });

  it('renders NDA flag as "No" when set to false', () => {
    const out = renderContractBody({ ndaIncluded: false });
    expect(out).toContain('NDA Included: No');
  });
});
