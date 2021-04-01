const axios = require('axios');
const config = require('config');
const { v4: uuidv4 } = require('uuid');
const db = require('../storage/DataAccess');
const fhirServerConfig = config.get('fhirServerConfig').resolve();

const SUBSCRIPTION = 'subscriptions';
const BACKPORT_TOPIC_EXTENSION =
  'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-topic-canonical';

/**
 * Create the BackportSubscriptionStatus Parameters resource
 *
 * @param {Subscription} subscription - the subscription to get the status of
 * @param {string} type - 'handshake', 'heartbeat', 'event-notification', or 'query-status'
 * @returns Parameters resource defining the status of the subscription
 */
function createSubscriptionStatus(subscription, type) {
  const topicExtension = subscription.extension.find((e) => e.url === BACKPORT_TOPIC_EXTENSION);

  return {
    resourceType: 'Parameters',
    id: uuidv4(),
    meta: {
      profile: [
        'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-subscriptionstatus',
      ],
    },
    parameter: [
      {
        name: 'subscription',
        valueReference: {
          reference: `${fhirServerConfig.auth.resourceServer}/Subscription/${subscription.id}`,
        },
      },
      {
        name: 'topic',
        valueCanonical: topicExtension.valueUri,
      },
      {
        name: 'type',
        valueCode: type,
      },
    ],
  };
}

/**
 * Send a notification with the triggering resources as defined in the subscription
 *
 * @param {Resource[]} resources - list of triggering resources to send in notification
 * @param {Subscription} subscription - the subscription resource to send notification
 * @returns axios post promise
 */
function sendNotification(resources, subscription) {
  const subscriptionStatus = createSubscriptionStatus(subscription);

  const notificationBundle = {
    resourceType: 'Bundle',
    id: uuidv4(),
    meta: {
      profile: [
        'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-subscription-notification',
      ],
    },
    type: 'history',
    entry: [
      {
        fullUrl: `${fhirServerConfig.auth.resourceServer}/Parameters/${subscriptionStatus.id}`,
        resource: subscriptionStatus,
      },
    ],
  };

  resources.forEach((resource) => {
    notificationBundle.entry.push({
      fullUrl: `${fhirServerConfig.auth.resourceServer}/${resource.resourceType}/${resource.id}`,
      resource: resource,
    });
  });

  if (subscription.channel.type !== 'rest-hook') {
    subscription.status = 'error';
    db.update(
      SUBSCRIPTION,
      (s) => s.id === subscription.id,
      (s) => Object.assign(s, subscription)
    );
    throw `Unsupported subscription channel: ${subscription.channel}`;
  }

  const headers = {};
  subscription.channel.header.forEach((header) => {
    const [name, value] = header.split(': ');
    headers[name] = value;
  });

  return axios.post(subscription.channel.endpoint, notificationBundle, { headers: headers });
}

module.exports = { sendNotification, createSubscriptionStatus };
