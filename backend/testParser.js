const { runParser } = require('./services/parserService');
const path = require('path');

runParser(path.join(__dirname, 'parser'))
  .then(res => {
     console.log('Success! Nodes:', res.nodes.length, 'Links:', res.links.length);
     process.exit(0);
  })
  .catch(err => {
     console.error('Error:', err);
     process.exit(1);
  });
