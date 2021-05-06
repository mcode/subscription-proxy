const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { StatusCodes } = require('http-status-codes');
const { loggers } = require('@asymmetrik/node-fhir-server-core');
const { v4: uuidv4 } = require('uuid');
const db = require('../storage/DataAccess');

const logger = loggers.get('default');
const SUBSCRIPTION_TOPIC = 'subscriptiontopics';

let build = function (server) {
  let router = new express.Router();
  const default_cors_options = Object.assign({}, server.config.server.corsOptions);
  router.use(bodyParser.json({ type: ['application/json', 'application/fhir+json'] }));
  router.post('/', cors(default_cors_options), function (req, res) {
    // Add all subscription topics to the database
    if (req.body.length) {
      req.body.forEach((subscriptionTopic) => {
        if (!subscriptionTopic.id) subscriptionTopic.id = uuidv4();
        db.upsert(SUBSCRIPTION_TOPIC, subscriptionTopic, (r) => r.id === subscriptionTopic.id);
        logger.info(`SubscriptionTopic >> create(${subscriptionTopic.title})`);
      });
    } else {
      res
        .status(StatusCodes.BAD_REQUEST)
        .send('Error: request body must be JSON list of SubscriptionTopics');
    }
    res.status(StatusCodes.CREATED).send();
  });

  return router;
};

module.exports = build;
