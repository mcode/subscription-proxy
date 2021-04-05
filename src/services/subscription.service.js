const { loggers } = require('@asymmetrik/node-fhir-server-core');
const { v4: uuidv4 } = require('uuid');
const db = require('../storage/DataAccess');
const topiclist = require('../../public/topiclist.json');

const logger = loggers.get('default');
const SUBSCRIPTION = 'subscriptions';

module.exports.topiclist = (_args, _context) => {
  logger.info('Running Subsription $topic-list operation');
  return new Promise((resolve, _reject) => {
    resolve(topiclist);
  });
};

module.exports.search = (_args, _context) => {
  return new Promise((resolve, _reject) => {
    logger.info('Subscription >>> search');
    resolve(db.select(SUBSCRIPTION, () => true));
  });
};

module.exports.searchById = (args, _context) => {
  return new Promise((resolve, reject) => {
    let { id } = args;
    logger.info(`Subscription >>> searchById(${id})`);
    const result = db.select(SUBSCRIPTION, (r) => r.id === id);
    if (result.length >= 1) resolve(result);
    else reject({ message: `Subscription/${id} does not exist` });
  });
};

module.exports.create = (_args, { req }) => {
  return new Promise((resolve, reject) => {
    const resource = req.body;
    logger.info(`Subscription >>> create(${resource.id})`);
    if (!resource) {
      reject({ message: 'Request must contain body.' });
      return;
    } else if (!Object.keys(resource).length) {
      reject({
        message: 'Empty body. Make sure Content-Type is set to application/fhir+json',
      });
      return;
    }
    if (!resource.id) resource.id = uuidv4();
    db.insert(SUBSCRIPTION, resource);

    resolve({ id: resource.id });
  });
};

module.exports.update = (args, { req }) => {
  return new Promise((resolve, reject) => {
    const { id } = args;
    logger.info(`Subscription >>> update(${id})`);
    const resource = req.body;
    if (!id) {
      reject({ message: 'Must include id' });
      return;
    } else if (!resource) {
      reject({ message: 'Request must contain body.' });
      return;
    } else if (!Object.keys(resource).length) {
      reject({
        message: 'Empty body. Make sure Content-Type is set to application/fhir+json',
      });
      return;
    } else if (resource.id !== id) {
      reject({ message: 'Query Param id and Subscription.id must match' });
      return;
    }
    db.upsert(SUBSCRIPTION, resource, (r) => r.id === id);
    resolve({ id: id });
  });
};

module.exports.remove = (args, _context) => {
  return new Promise((resolve, _reject) => {
    let { id } = args;
    logger.info(`Subscription >> remove(${id})`);
    db.delete(SUBSCRIPTION, (r) => r.id === id);
    const operationOutcome = {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'information',
          code: 'informational',
          diagnostics: `Successfully deleted Subscription/${id}`,
        },
      ],
    };
    resolve(operationOutcome);
  });
};
