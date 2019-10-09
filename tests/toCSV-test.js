const toCSV = require('../lib/toCSV');

describe('toCSV function', () => {
  it('returns an empty string if no transactions are supplied', () => {
    expect.assertions(1);
    const inputArgs = [];
    expect(toCSV(inputArgs)).toEqual('');
  });

  it('returns a csv string with a single line', () => {
    expect.assertions(1);
    const inputArgs = [
      {
        date: 1504271594569,
        amount: '$5.99',
        merchant: '"amazon.com"',
      },
    ];

    expect(toCSV(inputArgs)).toEqual('09/01/2017,$5.99,"amazon.com"\r\n');
  });

  it('returns a csv string with a multiple lines', () => {
    expect.assertions(1);
    const inputArgs = [
      {
        date: 1504271594569,
        amount: '$5.99',
        merchant: '"amazon.com"',
      },
      {
        date: 1504271594569,
        amount: '$6.99',
        merchant: '"amazon.ca"',
      },
    ];

    expect(toCSV(inputArgs)).toEqual('09/01/2017,$5.99,"amazon.com"\r\n09/01/2017,$6.99,"amazon.ca"\r\n');
  });

  it('strips out commas from the merchant field', () => {
    expect.assertions(1);
    const inputArgs = [
      {
        date: 1504271594569,
        amount: '$5.99',
        merchant: '"amazon,com"',
      },
    ];

    expect(toCSV(inputArgs)).toEqual('09/01/2017,$5.99,"amazoncom"\r\n');
  });

  it('strips out commas from the amount field', () => {
    expect.assertions(1);
    const inputArgs = [
      {
        date: 1504271594569,
        amount: '$1,500.99',
        merchant: '"amazon.com"',
      },
    ];

    expect(toCSV(inputArgs)).toEqual('09/01/2017,$1500.99,"amazon.com"\r\n');
  });

  it('includes ledger metadata comments when supplied via a plugin', () => {
    expect.assertions(1);
    const inputArgs = [
      {
        date: 1504271594569,
        amount: '$1,500.99',
        merchant: '"amazon.com"',
        comments: ['comment1: This is comment 1', 'comment2: This is comment 2'],
      },
    ];

    expect(toCSV(inputArgs)).toEqual(
      '09/01/2017,$1500.99,"amazon.com",comment1: This is comment 1,comment2: This is comment 2\r\n',
    );
  });
});
