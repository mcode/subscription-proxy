const { loggers } = require('@asymmetrik/node-fhir-server-core');
const mkFhir = require('fhir.js');
const config = require('config');
const { v4: uuidv4 } = require('uuid');
const db = require('../storage/DataAccess');
const topiclist = require('../../public/topiclist.json');
const { getAccessToken } = require('./client');

const logger = loggers.get('default');
const SUBSCRIPTION = 'subscriptions';
const fhirClientConfig = config.fhirClientConfig;

const TOPIC_URL = 'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-topic-canonical';

/**
 * @param {String} resourceToPoll - resource to query for
 * @param {String} lastUpdated - date to query resources since they were last updated
 * @returns {Object} - returns a FHIR search query object
 */
function getSearchQuery(resourceToPoll, lastUpdated) {
  const query = {};
  if (lastUpdated) query._lastUpdated = `gt${lastUpdated}`;
  if (resourceToPoll === 'Observation') query.category = 'laboratory';

  return { type: resourceToPoll, query};
}

/**
 * Take a named event code and return the resource type the named event will subscribe to.
 * This is not quite the Subscription.criteria string but will be used to construct that.
 *
 * @param {string} namedEvent - the named event code
 * @returns the resource type which will trigger a notification for the named event
 */
function namedEventToResourceType(namedEvent) {
  const parts = namedEvent.split('-');

  let resource;
  if (parts[0] === 'new' || parts[0] === 'modified') resource = parts[1];
  else if (parts[1] === 'change' || parts[1] === 'start' || parts[1] === 'close')
    resource = parts[0];
  else return null;

  switch (resource) {
    case 'encounter':
      return 'Encounter';
    case 'diagnosis':
      return 'Condition';
    case 'medication':
      return 'Medication';
    case 'labresult':
      return 'Observation';
    case 'order':
      return 'ServiceRequest';
    case 'procedure':
      return 'Procedure';
    case 'immunization':
      return 'Immunization';
    case 'demographic':
      return 'Patient';
    default:
      return null;
  }
}

async function pollSubscriptionTopics() {
  logger.info('Polling Subscription topics');

  // Get subscriptions with topics
  const subscriptions = db.select(
    SUBSCRIPTION,
    (s) => s.extension && s.extension.some((e) => e.url === TOPIC_URL)
  );

  // Remove duplicates with Set so we don't poll twice for same topic
  const topicsToPoll = [
    ...new Set(
      subscriptions.map((s) => {
        const topicExtension = s.extension.find((e) => e.url === TOPIC_URL);

        return topiclist.parameter.find(p => p.valueCanonical === topicExtension.valueUri).name;
      })
    ),
  ];

  if (topicsToPoll.length === 0) {
    logger.info('No subscription topics to poll.');
    return;
  }

  const { baseUrl, clientId } = fhirClientConfig;
  const accessToken = await getAccessToken(baseUrl, clientId);
  topicsToPoll.forEach((topic) => {
    logger.info(`Polling EHR for ${topic}.`);
    const options = {
      baseUrl,
      auth: { bearer: accessToken },
    };

    const resourceToPoll = namedEventToResourceType(topic);
    const mostRecentPoll = db.select('polling', (p) => p.resource === resourceToPoll);
    const lastUpdated = mostRecentPoll.length === 0 ? null : mostRecentPoll[0].timestamp;
    const fhirClient = mkFhir(options);
    fhirClient
      .search(getSearchQuery(resourceToPoll, lastUpdated))
      .then((response) => {
        const { data } = response;

        // Add poll to DB
        const poll = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          resource: resourceToPoll
        };
        db.insert('polling', poll);

        // Store fetched resources in local database
        if (data.total > 0) {
          logger.info(`Storing ${data.total} fetched resources for ${topic} into database.`);
          const resources = data.entry.map(entry => entry.resource);

          resources.forEach((resource) => {
            const collection = `${resource.resourceType.toLowerCase()}s`;
            db.insert(collection, resource);
          });
        }
      })
      .catch((err) => logger.error(err));
  });
}

module.exports = { pollSubscriptionTopics };
