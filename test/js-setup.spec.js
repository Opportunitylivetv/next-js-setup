/*global require,describe,afterEach,xit,beforeEach,it,expect*/
'use strict';

var jsSetup = require('../main');
var JsSetup = require('../src/js-setup');
var sinon = require('sinon');
var flagsClient = require('next-feature-flags-client');
var Raven = require('../src/raven');
var myFtClient = require('next-myft-client');
var myFtUi = require('next-myft-ui');
var beacon = require('next-beacon-component');

var ravenCaptureException = Raven.captureException;

describe('js setup', function() {

	it('should polyfill fetch', function () {
		expect(window.fetch).to.be.a('function');
	});

	it('should have an init method', function () {
		expect(jsSetup.init).to.be.a('function');
	});

	it('should have an bootstrap method', function () {
		expect(jsSetup.bootstrap).to.be.a('function');
	});

	it('should stub console, if applicable', function () {
		expect(window.console).to.be.an('object');
	});

	describe('init with flags off', function () {
		var server;
		beforeEach(function () {
			Raven.captureException = ravenCaptureException;
			server = sinon.fakeServer.create();
			server.respondWith("GET", "/__flags.json", [200, { "Content-Type": "application/json" },'[]']);
		});

		afterEach(function () {
			server.restore();
		});

		it('should not configure raven', function (done) {
			var spy = sinon.stub(Raven, 'config');
			var promise = new JsSetup().init({__testmode: true});
			server.respond();
			promise.then(function () {
				expect(spy.called).not.to.be.true;
				spy.restore();
				done();
			});
		});

		it('should export raven instance with noop functions', function (done) {
			var setup = new JsSetup();
			var promise = setup.init({__testmode: true});
			server.respond();
			promise.then(function () {
				expect(setup.raven).to.be.an('object');
				expect(setup.raven.captureMessage).to.be.a('function');
				expect(setup.raven.captureMessage).to.equal(JsSetup.noop);
				expect(setup.raven.captureException).to.equal(JsSetup.noop);
				done();
			});
		});

		it('should not init myft', function (done) {
			var spy1 = sinon.stub(myFtClient, 'init');
			var spy2 = sinon.stub(myFtUi, 'init');
			var promise = new JsSetup().init({__testmode: true});
			server.respond();
			promise.then(function () {
				expect(spy1.called).not.to.be.true;
				expect(spy2.called).not.to.be.true;
				spy1.restore();
				spy2.restore();
				done();
			});

		});


		// beacon.init not defined yet
		xit('should not init beacon', function (done) {
			var spy = sinon.stub(beacon, 'init');
			var promise = new JsSetup().init({__testmode: true});
			server.respond();
			promise.then(function () {
				expect(spy.called).not.to.be.true;
				spy.restore();
				done();
			});

		});

		it('should return promise of flags', function (done) {
			var promise = new JsSetup().init({__testmode: true});
			server.respond();
			promise.then(function (result) {
				expect(result).to.be.an('object');
				expect(result.flags.getAll).to.be.a('function');
				done();
			});
		});
	});

	describe('init with flags on', function () {
		var server;
		var flagStub;
		beforeEach(function () {
			Raven.captureException = ravenCaptureException;
			server = sinon.fakeServer.create();
			server.respondWith("GET", "/__flags.json", [200, { "Content-Type": "application/json" }, JSON.stringify([])]);
			flagStub = sinon.stub(flagsClient, 'get', function (name) {
				return {
					isSwitchedOn: true,
					isSwitchedOff: false,
					isPastSellByDate: false,
				};
			});
		});

		afterEach(function () {
			server.restore();
			flagStub.restore();
		});

		it('should configure raven', function (done) {
			var spy = sinon.spy(Raven, 'config');
			var setup = new JsSetup();
			var promise = setup.init({__testmode: true});
			server.respond();
			promise.then(function () {
				expect(setup.raven).to.be.an('object');
				expect(spy.called).to.be.true;
				expect(setup.raven.captureMessage).to.be.a('function');
				expect(setup.raven.captureMessage).to.equal(setup.raven.captureMessage);
				expect(setup.raven.captureException).not.to.equal(JsSetup.noop);
				spy.restore();
				done();
			});
		});

		it('should init myft', function (done) {
			var ravenStub = sinon.stub(Raven, 'config', function () {
				return {install: function () {}};
			});
			var spy1 = sinon.stub(myFtClient, 'init');
			var spy2 = sinon.stub(myFtUi, 'init');
			var promise = new JsSetup().init({__testmode: true, userPreferences: {user: 'prefs'}});
			server.respond();
			promise.then(function () {
				expect(spy1.called).to.be.true;
				expect(spy2.called).to.be.true;
				spy1.restore();
				spy2.restore();
				ravenStub.restore();
				done();
			});

		});

		// beacon.init not defined yet
		xit('should init beacon', function (done) {
			var ravenStub = sinon.stub(Raven, 'config', function () {
				return {install: function () {}};
			});
			var spy = sinon.stub(beacon, 'init');
			var promise = new JsSetup().init({__testmode: true});
			server.respond();
			promise.then(function () {
				expect(spy.called).to.be.true;
				spy.restore();
				ravenStub.restore();
				done();
			});

		});

		it('should return promise of flags', function (done) {
			var ravenStub = sinon.stub(Raven, 'config', function () {
				return {install: function () {}};
			});
			var promise = new JsSetup().init({__testmode: true});
			server.respond();
			promise.then(function (result) {
				expect(result).to.be.an('object');
				expect(result.flags.getAll).to.be.a('function');
				ravenStub.restore();
				done();
			});
		});
	});

	describe('bootstrap', function () {
		var result = {};
		beforeEach(function () {
			sinon.stub(jsSetup, 'init', function () {
				return Promise.resolve(result);
			});
		});

		afterEach(function () {
			window.ftNextInitCalled = undefined;
			document.querySelector('html').classList.remove('js-success');
			jsSetup.init.restore();
		});

		it('should wait for polyfills to load if ftNextInit not called', function (done) {
			var callback = sinon.stub();
			// can't assume promises exist to do async stuff
			var p = window.Promise;
			window.Promise = undefined;
			jsSetup.bootstrap(callback);
			setTimeout(function () {
				expect(callback.calledOnce).to.be.false;
				// now we can assume Promise is polyfilled
				window.Promise = p;
				document.dispatchEvent(new Event('polyfillsLoaded'));
				setTimeout(function () {
					expect(callback.calledOnce).to.be.true;
					expect(callback.calledWith(result)).to.be.true;
					done();
				}, 0);
			}, 0);

		});

		it('should run a callback with result of init immediately if ftNextInit already called', function (done) {
			window.ftNextInitCalled = true;
			var callback = sinon.stub();
			jsSetup.bootstrap(callback);
			setTimeout(function () {
				expect(callback.calledOnce).to.be.true;
				expect(callback.calledWith(result)).to.be.true;
				done();
			}, 0);
		});

		it('should pass an options object to init', function (done) {
			window.ftNextInitCalled = true;
			var callback = sinon.stub();
			var options = {};
			jsSetup.bootstrap(callback, options);
			setTimeout(function () {
				expect(jsSetup.init.calledWith(options)).to.be.true;
				done();
			}, 0);
		});

		it('should add js-success class if callback executes ok', function (done) {
			window.ftNextInitCalled = true;
			jsSetup.bootstrap(function () {});
			setTimeout(function () {
				expect(document.querySelector('html').classList.contains('js-success')).to.be.true;
				done();
			}, 0);
		});

		it('should add js-success class if callback returns resolved promise', function (done) {
			window.ftNextInitCalled = true;
			jsSetup.bootstrap(function () {
				return Promise.resolve();
			});
			setTimeout(function () {
				jsSetup.bootstrapResult.then(function () {
					expect(document.querySelector('html').classList.contains('js-success')).to.be.true;
					done();
				});
			}, 0);
		});

		describe('Error handling', function () {

			beforeEach(function () {
				sinon.stub(jsSetup, '_throw');
			});

			afterEach(function () {
				jsSetup._throw.restore();
			});

			it('should not add js-success class and throw global error if callback fails', function (done) {
				window.ftNextInitCalled = true;
				jsSetup.bootstrap(function () {
					throw 'error';
				});
				setTimeout(function () {
					jsSetup.bootstrapResult.then(function () {
						expect(document.querySelector('html').classList.contains('js-success')).to.be.false;
						expect(jsSetup._throw.called).to.be.true;
						done();
					});
				}, 0);
			});

			it('should not add js-success class and throw global error if callback returns rejected promise', function (done) {
				window.ftNextInitCalled = true;
				jsSetup.bootstrap(function () {
					return Promise.reject();
				});
				setTimeout(function () {
					jsSetup.bootstrapResult.then(function () {
						expect(document.querySelector('html').classList.contains('js-success')).to.be.false;
						expect(jsSetup._throw.called).to.be.true;
						done();
					});
				}, 0);
			});

			it('should not add js-success class if callback returns hanging promise', function (done) {
				window.ftNextInitCalled = true;
				jsSetup.bootstrap(function () {
					return new Promise(function (){});
				});
				setTimeout(function () {
					setTimeout(function () {
						expect(document.querySelector('html').classList.contains('js-success')).to.be.false;
						expect(jsSetup._throw.called).to.be.false;
						done();
					}, 0);
				}, 0);
			});
		});
	});
});
