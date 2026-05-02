const dns = require('dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);

require('./app');
