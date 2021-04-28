const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const request = require('request');
const mkFhir = require('fhir.js');
const config = require('config');
const fhirClientConfig = config.fhirClientConfig;

/*
  Used to save the raw body of a response  as a variable on the response object
*/
var rawBodySaver = function (req, _res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

/* This funtion will pull the authorization uris out of a conformance statement and
   return them as a simple json structure
*/
var authUris = function (response) {
  for (var x in response.data.rest) {
    var entry = response.data.rest[x];
    if (entry.mode === 'server') {
      for (let i in entry.security.extension) {
        let ex = entry.security.extension[i];
        if (ex.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris') {
          var uris = {};
          for (let j in ex.extension) {
            let uri = ex.extension[j];
            uris[uri.url] = uri.valueUri;
          }
          return uris;
        }
      }
    }
  }
};

// Builds the express controller with auth mappings
let build = function (server) {
  let router = new express.Router();

  let default_cors_options = Object.assign({}, server.config.server.corsOptions);
  // this is the redirection for the
  router.use(bodyParser.json()); // for parsing application/json
  router.use(bodyParser.urlencoded({ verify: rawBodySaver, extended: true })); // for parsing application/x-www-form-urlencoded

  // adds the authroize method to the router
  // This will simply redirect to the configured baseurl of the fhirclient
  // router.get('/authorize', cors(default_cors_options), function (req, res) {
  //   console.log('AUTHORIZE CALLED');
  //   var fhirClient = mkFhir(options);
  //   fhirClient.conformance(fhirClientConfig).then((response) => {
  //     let uris = authUris(response);
  //     let params = req.query;
  //     params.aud = fhirClientConfig.baseUrl;
  //     console.log('sending redirect back to client');
  //     res.redirect(301, url.format({
  //          pathname: uris.authorize,
  //          query: params
  //        }));
  //   }).catch((error) => {
  //     console.log(error);
  //     throw error;});
  // });

  /*
  Adds the token url to the router.
  This method acts as a proxy where in it takes the parameters passed in the request
  and uses those to generate a new request to the Smart on FHIR server for the
  fhirClient.  The response from the proxied call is then used as the response for
  the initial request
  */
  router.post('/token', cors(default_cors_options), function (req, res) {
    var fhirClient = mkFhir({
      baseUrl: fhirClientConfig.baseUrl,
    });
    const fcc = { ...fhirClientConfig };
    fhirClient.conformance(fcc).then((response) => {
      let uris = authUris(response);
      request.post({ url: uris.token, form: req.body }, (err, httpResponse, body) => {
        if (err) {
          console.log(err);
        }
        res.status(httpResponse.statusCode).send(body);
      });
    });
  });
  return router;
};
module.exports = build;
