const { loggers } = require('@asymmetrik/node-fhir-server-core');
const mkFhir = require('fhir.js');
const config = require('config');
const { v4: uuidv4 } = require('uuid');
const db = require('../storage/DataAccess');
const hash = require('object-hash');
const { getAccessToken } = require('./client');
const { sendNotification } = require('./subscriptions');

const logger = loggers.get('default');
const SUBSCRIPTION = 'subscriptions';
const SUBSCRIPTION_TOPIC = 'subscriptiontopics';
const fhirClientConfig = config.fhirClientConfig;

const TOPIC_URL =
  'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-topic-canonical';

/**
 * @param {Object} resourceTrigger - the SubscriptionTopic.resourceTrigger this poll is for
 * @param {String} lastUpdated - date to query resources since they were last updated
 * @returns {Object} - returns a FHIR search query object
 */
function getSearchQuery(resourceTrigger, lastUpdated) {
  const query = {};
  if (lastUpdated) query._lastUpdated = `gt${lastUpdated}`;
  if (resourceTrigger.queryCriteria && resourceTrigger.queryCriteria.current) {
    const criteria = resourceTrigger.queryCriteria.current.split('&');
    criteria.forEach((c) => {
      const [key, value] = c.split('=');
      query[key] = value;
    });
  }

  return { type: resourceTrigger.resourceType, query };
}

/**
 * Adds poll to DB
 *
 * @param {string} hashKey - the hash key of the ResourceTrigger
 */
function addPollToDb(hashKey) {
  const poll = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    hash: hashKey,
  };
  db.upsert('polling', poll, (p) => p.hash === hashKey);
}

/**
 * Save the fetched resources to the database and determine which ones are new vs modified.
 *
 * @param {Object} data - fhirClient return data
 * @param {Object} resourceTrigger - the resource trigger which resulted in this poll
 * @returns JSON object containing newResources and modifiedResources lists
 */
function storeFetchedResources(data, resourceTrigger) {
  const newResources = [];
  const modifiedResources = [];

  logger.info(
    `Storing ${data.total} fetched ${resourceTrigger.resourceType} resource(s) for ${hash(
      resourceTrigger
    )} resourceTrigger into database.`
  );
  const resources = data.entry.map((entry) => entry.resource);

  resources.forEach((resource) => {
    const collection = `${resource.resourceType.toLowerCase()}s`;

    // Determine if resource is new before inserting
    const storedResource = db.select(collection, (r) => r.id === resource.id);
    if (storedResource.length === 0) newResources.push(resource);
    else modifiedResources.push(resource);

    db.upsert(collection, { id: resource.id }, (r) => r.id === resource.id);
  });

  return { newResources, modifiedResources };
}

/**
 * Get the topic the subscription is subscribed to
 *
 * @param {Subscription} subscription - the subscription to get the topic from
 * @returns {SubscriptionTopic | null} topic if found, otherwise null
 */
function getSubscriptionTopic(subscription) {
  const topicExtension = subscription.extension.find((e) => e.url === TOPIC_URL);
  if (!topicExtension) return null;
  const topicUrl = topicExtension.valueUri;
  const topic = db.select(SUBSCRIPTION_TOPIC, (t) => t.url === topicUrl);
  return topic.length ? topic[0] : null;
}

/**
 * Perform an initial poll if resource has not already been polled
 *
 * @param {Subscription} subscription - Subscription resource
 */
async function initialPoll(subscription) {
  const subscriptionTopic = getSubscriptionTopic(subscription);

  // Make the fhirClient
  const accessToken = await getAccessToken(fhirClientConfig);
  const options = {
    baseUrl: fhirClientConfig.baseUrl,
    auth: { bearer: accessToken },
  };
  const fhirClient = mkFhir(options);

  subscriptionTopic.resourceTrigger.forEach((resourceTrigger) => {
    // Don't poll if resource is already being polled for.
    const triggerHash = hash(resourceTrigger);
    const mostRecentPoll = db.select('polling', (p) => p.hash === triggerHash);
    if (mostRecentPoll.length > 0) {
      logger.info(`${triggerHash} trigger is already being polled.`);
      return;
    }

    fhirClient
      .search(getSearchQuery(resourceTrigger))
      .then((response) => {
        const { data } = response;
        addPollToDb(triggerHash);

        if (data.total > 0) storeFetchedResources(data, resourceTrigger);
      })
      .catch((err) => logger.error(err));
  });
}

/**
 * Sends notifications(if necessary) each subscription based on new and modified resources
 *
 * @param {Subscription[]} subscriptions List of Subscriptions
 * @param {String[]} methodCriteria the method criteria list from the resource trigger
 * @param {Resource[]} newResources List of new resources polled from EHR
 * @param {Resource[]} modifiedResources List of modified resources polled from EHR
 */
function sendSubscriptionNotifications(
  subscriptions,
  methodCriteria,
  newResources,
  modifiedResources
) {
  subscriptions.forEach((sub) => {
    const topic = getSubscriptionTopic(sub);
    const allResources = newResources.concat(modifiedResources);

    if (allResources.length && methodCriteria.includes('update')) {
      // Send notification with all resources
      logger.info(`Sending notification to Subscription/${sub.id} for topic ${topic.title}`);
      sendNotification(allResources, sub);
    } else if (newResources.length && methodCriteria.includes('create')) {
      // Send notification with only new resources
      logger.info(`Sending notification to Subscription/${sub.id} for topic ${topic.title}`);
      sendNotification(newResources, sub);
    } else if (methodCriteria.includes('delete')) {
      logger.error('Delete methodCriteria not implemented.');
    }
  });
}

/**
 * Poll resources from EHR based on subscription topics and sends notifications if necessary
 */
async function pollSubscriptionTopics() {
  logger.info('Polling Subscription topics');

  // Get Subscriptions with topics
  const subscriptions = db.select(
    SUBSCRIPTION,
    (s) => s.status === 'active' && s.extension && s.extension.some((e) => e.url === TOPIC_URL)
  );

  // Get the unique SubscriptionTopics from active Subscriptions
  const subscriptionTopicsToPoll = [
    ...new Set(subscriptions.flatMap((s) => getSubscriptionTopic(s))),
  ];

  // Get the unique ResourceTriggers from SubscriptionTopics
  const resourceTriggersToPoll = [
    ...new Set(subscriptionTopicsToPoll.flatMap((t) => t.resourceTrigger)),
  ];

  if (resourceTriggersToPoll.length === 0) {
    logger.info('No subscription topics to poll.');
    return;
  }

  // Create the fhirClient
  const accessToken = await getAccessToken(fhirClientConfig);
  const options = {
    baseUrl: fhirClientConfig.baseUrl,
    auth: { bearer: accessToken },
  };
  const fhirClient = mkFhir(options);

  resourceTriggersToPoll.forEach((resourceTrigger) => {
    const triggerHash = hash(resourceTrigger);
    const mostRecentPoll = db.select('polling', (p) => p.hash === triggerHash);
    const lastUpdated = mostRecentPoll.length === 0 ? null : mostRecentPoll[0].timestamp;
    logger.info(
      `Polling EHR for ${resourceTrigger.resourceType} resources for ${triggerHash} resourceTrigger last updated since ${lastUpdated}.`
    );
    fhirClient
      .search(getSearchQuery(resourceTrigger, lastUpdated))
      .then((response) => {
        const { data } = response;
        addPollToDb(triggerHash);

        if (data.total > 0) {
          const { newResources, modifiedResources } = storeFetchedResources(data, resourceTrigger);

          // Filter subscriptions that are looking for changes in the currently polled resource trigger
          const subscriptionsToNotify = subscriptions.filter((s) => {
            const topic = getSubscriptionTopic(s);
            const resourceTriggersHashKeys = topic.resourceTrigger.map((rt) => hash(rt));
            return resourceTriggersHashKeys.includes(triggerHash) ? true : false;
          });

          sendSubscriptionNotifications(
            subscriptionsToNotify,
            resourceTrigger.methodCriteria,
            newResources,
            modifiedResources
          );
        }
      })
      .catch((err) => logger.error(err.message));
  });
}

module.exports = { pollSubscriptionTopics, initialPoll };
