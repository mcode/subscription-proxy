# R5 Subscription Backport Proxy Server

Proxy server to support R5 Subscription Backport on EHR servers which do not implement Subscriptions. This server will proxy all requests, except for Subscriptions. On Subscriptions the server will begin polling the EHR and then send notifications back to the client when appropriate.

## Running the Server

The Subscription Proxy server is built on top of [Asymmetrik Node FHIR Sever](https://github.com/Asymmetrik/node-fhir-server-core). NodeJS/npm required to run the app.

```sh
git clone git@github.com:mcode/subscription-proxy.git
cd subscription-proxy
npm install
npm start
```

With default settings, the app will now be running at `http://localhost:8080`

The Subscription Proxy server can also be run using docker. Make sure you have docker installed and running, then build the image and run the server.

```./build-docker-image.bat
docker-compose up
```

The app will now be running at `http://localhost:8080`.

## Config

The default config can be found in `/config/default.js`. The important properties are:

```
fhirClientConfig.baseUrl: 'the actual EHR server full url'
fhirServerConfig.auth.resourceServer: 'this server URI'
fhirServerConfig.server.port: 'the port to run this server on'
fhirServerConfig.security.valueUri: 'SMART Backend Auth token uri'
```

# SubscriptionTopics

This server supports the R5 Subscription Backport IG which means it must have some notion of Subscription Topics. To keep this generalized there is minimal support for the R5 SubscriptionTopic resource.

## Subscription Topic Structure

Since this is an R4 server but SubscriptionTopics are defined in R5 the following schema is used. The schema below attempts to follow the R5 SubscriptionTopic resource as closely as possible, but the resource is subject to change while it is being balloted. The schema below includes only the triggers this server supports. As new triggers from the SubscriptionTopic resource are supported they should be added here.

```
{
    id: String // unique id
    url: String // The canonical url of the topic (becomes valueCanonical in $topiclist)
    title: String // The name of the topic (becomes name in $topiclist)
    resourceTrigger: [
        {
            resourceType: String // Resources to trigger on
            methodCriteria: ('create' | 'update' | 'delete')[] // Type of request to triger on
            queryCriteria: {
                current: String // Criteria the resource must current match on trigger
            }
        }
    ]
}
```

## Add or Update Topics

To add or update topics to this server POST a JSON list of topics to `{baseUrl}/SubscriptionTopics`. Note this does not include the `/4_0_0` route.

Example:
``
HTTP POST /SubscriptionTopics
[ 
    {
        "id": "1",
        "url": "http://example.org/medmorph/subscriptiontopic/demographic-change",
        "title": "demographic-change",
        "resourceTrigger": [
            {
                "resourceType": "Patient",
                "methodCriteria": [ "create", "update" ]
            }
        ]
    }
]
```

# License

Copyright 2020-2021 The MITRE Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
