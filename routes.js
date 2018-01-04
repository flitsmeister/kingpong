'use strict';

const Sync = require('yield-yield');

const WebhookHandler = require('./handlers/webhook');

const handle = (f) => {
    return (request, h) => new Promise((resolve, reject) => {
        Sync.run(function *() {
            try {
                resolve(yield f(request, h));
            } catch (ex) {
                console.error(ex.stack);
                reject(ex);
            }
        });
    });
};

module.exports = ((service) => {

    service.route({
        method: 'POST', path: '/hooks',
        config: {
            handler: handle(WebhookHandler.parseSlackHook)
        }
    });

    service.route({
        method: 'POST', path: '/commands',
        config: {
            handler: handle(WebhookHandler.parseSlackCommand)
        }
    });

    service.route({
        method: '*', path: '/{p*}', handler: (request, h) => {
            // TODO: 404 Ivo.
            return h.response('not found').code(404);
        }
    });
});
