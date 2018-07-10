const _ = require('lodash');

const toCSV = (transactionList) => {
  let csvTransactions = '';

  transactionList.forEach((transaction) => {
    const date = new Date(transaction.date);
    let dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    dateStr += `/${date.getDate().toString().padStart(2, '0')}`;
    dateStr += `/${date.getFullYear().toString()}`;

    const merchant = transaction.merchant.replace(/,/g, '');
    const amount = transaction.amount.replace(/,/g, '');

    // Collate all the "comment" entries
    const comments = _.get(transaction, 'comments', []);
    let commentStr = '';
    comments.forEach((comment) => {
      comment = comment.replace(/,/g, '');
      commentStr += `,${comment}`;
    });

    csvTransactions += `${dateStr},${amount},${merchant}`;
    if (commentStr) {
      csvTransactions += `${commentStr}`;
    }
    csvTransactions += '\r\n';
  });

  return csvTransactions;
};

module.exports = toCSV;
