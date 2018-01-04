'use strict';

require('dotenv').config({ path: process.env.dotenvConfigPath });

const Hapi = require('hapi');
const Sync = require('yield-yield');

const Mysql = require('./providers/mysql');

let service;

const start = function *() {

    service = new Hapi.Server({
        host: '0.0.0.0',
        port: parseInt(9999, 10)
    });

    require('./routes')(service);

    Mysql.connect({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    yield service.start();
    console.log(`${new Date()} Hapi service started at: ${service.info.uri}`);
};

const stop = Sync(function *() {
    console.log(`${new Date()} Stopping hapi`);
    yield service.stop({ timeout: 2 * 1000 }, yield);
    console.log(`${new Date()} Hapi stopped`);
    yield Mysql.close();
    console.log(`${new Date()} Mysql pool closed`);
});

if (require.main === module) {
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    Sync.run(start);
}
