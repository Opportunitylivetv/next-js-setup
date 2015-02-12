'use strict';

var flags = require('next-feature-flags-client');
var Raven = require('./client/raven');

flags.init().then(function() {

    if (flags.get('clientErrorReporting').isSwitchedOn) {
        Raven.config('https://edb56e86be2446eda092e69732d8654b@app.getsentry.com/32594').install();

        // normalise client and server side method names
        Raven.captureMessage = Raven.captureException;
    }

    if (flags.get('analytics').isSwitchedOn) {
         require('./client/tracking/main');
    }

});

module.exports.raven = Raven;