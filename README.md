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
