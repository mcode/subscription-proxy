const { Server, loggers } = require('@asymmetrik/node-fhir-server-core');
const logger = loggers.get('default');
const auth = require('./controllers/auth_controller');
const subscriptionTopicRouter = require('./controllers/subscriptiontopic_controller');
const { pollSubscriptionTopics } = require('./utils/polling');
const { runWhenDBReady } = require('./storage/postinit');
// the config object is immutable by default.  This causes a problem because hte
// FHIRServer initialize routine modifies the config structure and will fail to
// start if it cannot modify the structure
process.env.ALLOW_CONFIG_MUTATIONS = true;

const config = require('config');

const fhirServerConfig = config.get('fhirServerConfig');

const main = function () {
  const server = new Server(fhirServerConfig);
  const port = fhirServerConfig.server.port;
  // add the auth component to the server application
  server.app.use('/auth', auth(server));
  // add the SubscriptionTopic route
  server.app.use('/SubscriptionTopics', subscriptionTopicRouter(server));
  server
    .configureMiddleware()
    .configureSession()
    .configureHelmet()
    .configurePassport()
    .setPublicDirectory()
    .setProfileRoutes()
    .setErrorRoutes();
  logger.info('FHIR Server successfully validated.');
  // Start our server
  server.listen(port, () => logger.info('FHIR Server listening on localhost:' + port)); //

  runWhenDBReady(pollSubscriptionTopics);
  setInterval(pollSubscriptionTopics, fhirServerConfig.pollingInterval * 60 * 1000);

  return server.app;
};

module.exports = main();
