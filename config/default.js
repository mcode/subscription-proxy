const { constants } = require('@asymmetrik/node-fhir-server-core');
const raw = require('config/raw').raw;
const VERSIONS = constants.VERSIONS;

let fhirClientConfig = {
  baseUrl: 'http://pathways.mitre.org:8180/fhir',
  clientId: 'medmorph_backend',
  debug: true,
};

// note this has to be raw()-ified to prevent config from adding helper functions in config.profiles (has, get)
// since those helper functions cause errors in the fhir server configuration
// (ie, they get validated as if they were profiles, which they are not)
let fhirServerConfig = raw({
  auth: {
    // This servers URI
    resourceServer: 'http://localhost:8080',
    strategy: {
      name: 'bearer',
      useSession: false,
      service: './src/strategies/bearer.strategy.js',
    },
  },
  server: {
    // support various ENV that uses PORT vs SERVER_PORT
    port: 8080,
    // allow Access-Control-Allow-Origin
    corsOptions: {
      maxAge: 86400,
      origin: '*',
    },
  },
  logging: {
    level: 'debug',
  },
  // Interval(in minutes) to poll for subscription topics
  pollingInterval: 1,
  //
  // If you want to set up conformance statement with security enabled
  // Uncomment the following block
  //
  security: [
    {
      url: 'token',
      valueUri: 'http://moonshot-dev.mitre.org:8090/auth/realms/ehr/protocol/openid-connect/token',
    },
    // optional - registration
  ],

  //
  // Comment out any profiles you do not wish to support.  Each profile can support multiple versions
  // if supported by core.  We currently only have 3_0_1 profiles but will soon support DSTU2 and R4 versions.
  // Once available, to support multiple versions, just add the versions to the array.
  //
  // Example:
  // [RESOURCES.ACCOUNT]: {
  //		service: './src/services/account.service.js',
  //		versions: [ VERSIONS['3_0_1'], VERSIONS['1_0_2'] ]
  // },
  //
  // profiles: {
  //   patient: {
  //     service: new PassThroughService('Patient'),
  //     versions: [ VERSIONS['3_0_1'] ]
  //   }
  // }
  profiles: {
    Patient: {
      service: './src/services/patient.service',
      versions: [VERSIONS['4_0_0']],
    },

    Condition: {
      service: './src/services/condition.service',
      versions: [VERSIONS['4_0_0']],
    },

    Encounter: {
      service: './src/services/encounter.service',
      versions: [VERSIONS['4_0_0']],
    },

    Immunization: {
      service: './src/services/immunization.service',
      versions: [VERSIONS['4_0_0']],
    },

    MedicationDispense: {
      service: './src/services/medicationdispense.service',
      versions: [VERSIONS['4_0_0']],
    },

    MedicationAdministration: {
      service: './src/services/medicationadministration.service',
      versions: [VERSIONS['4_0_0']],
    },

    MedicationRequest: {
      service: './src/services/medicationrequest.service',
      versions: [VERSIONS['4_0_0']],
    },

    MedicationStatement: {
      service: './src/services/medicationstatement.service',
      versions: [VERSIONS['4_0_0']],
    },

    Observation: {
      service: './src/services/observation.service',
      versions: [VERSIONS['4_0_0']],
    },

    Practitioner: {
      service: './src/services/practitioner.service',
      versions: [VERSIONS['4_0_0']],
    },

    Procedure: {
      service: './src/services/procedure.service',
      versions: [VERSIONS['4_0_0']],
    },

    ServiceRequest: {
      service: './src/services/servicerequest.service',
      versions: [VERSIONS['4_0_0']],
    },

    Subscription: {
      service: './src/services/subscription.service',
      versions: [VERSIONS['4_0_0']],
      operation: [
        {
          name: 'topiclist',
          route: '/$topic-list',
          method: 'GET',
          reference:
            'http://hl7.org/fhir/uv/subscriptions-backport/OperationDefinition/Backport-subscriptiontopic-list',
        },
        {
          name: 'status',
          route: '/$status',
          method: 'GET',
          reference:
            'http://hl7.org/fhir/uv/subscriptions-backport/OperationDefinition/backport-subscription-status',
        },
        {
          name: 'status-by-id',
          route: '/:id/$status',
          method: 'GET',
          reference:
            'http://hl7.org/fhir/uv/subscriptions-backport/OperationDefinition/backport-subscription-status',
        },
      ],
    },
  },
});

module.exports = {
  fhirServerConfig,
  fhirClientConfig,
};
