const { loggers } = require('@asymmetrik/node-fhir-server-core');
const { v4: uuidv4 } = require('uuid');
const db = require('../storage/DataAccess');
const topiclist = require('../../public/topiclist.json');
const { initialPoll } = require('../utils/polling');
const { createSubscriptionStatus, createStatusBundle } = require('../utils/subscriptions');

const logger = loggers.get('default');
const SUBSCRIPTION = 'subscriptions';

module.exports.topiclist = (_args, _context) => {
  logger.info('Running Subsription $topic-list operation');
  return new Promise((resolve, _reject) => {
    resolve(topiclist);
  });
};

module.exports.status = (_args, _context) => {
  // TODO: there is no way with our current access token to determine which
  //  subscriptions the user should have access to. If they have an access
  //  token they can see everything
  logger.info('Running Subscription $status operation');
  return new Promise((resolve, _reject) => {
    const parameters = [];
    const result = db.select(SUBSCRIPTION, () => true);
    for (const subscription of result) {
      parameters.push(createSubscriptionStatus(subscription, 'query-status'));
    }
    const bundle = createStatusBundle(parameters);
    resolve(bundle);
  });
};

module.exports.statusById = ({ id }, _context) => {
  // TODO: there is no way with our current access token to determine which
  //  subscriptions the user should have access to. If they have an access
  //  token they can see everything
  logger.info('Running Subscription $status by ID operation');
  return new Promise((resolve, reject) => {
    const result = db.select(SUBSCRIPTION, (r) => r.id === id);
    if (result.length >= 1) {
      const subscription = result[0];
      const parameters = [createSubscriptionStatus(subscription, 'query-status')];
      resolve(createStatusBundle(parameters));
    } else reject({ message: `Subscription/${id} does not exist` });
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
    resource.status = 'active';
    resource.numEventsSinceStart = 0;
    db.insert(SUBSCRIPTION, resource);

    // Initial poll for new subscription
    initialPoll(resource);

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
    resource.status = 'active';
    resource.numEventsSinceStart = 0;
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
