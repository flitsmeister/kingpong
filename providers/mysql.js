'use strict';

const MySQL = require('mysql');

let currentInstance;
const MAX_DEADLOCK_RETRIES = 3;

class Mysql {

    constructor(options = {}) {

        this.pool = MySQL.createPool({
            host: options.host,
            user: options.user,
            password: options.password,
            database: options.database,
            multipleStatements: true
        });
    }

    *healthCheck() {
        const connection = yield this.pool.getConnection(yield);
        try {
            yield connection.ping(yield);
        } finally {
            connection.release();
        }
    }

    *query(query, values = null) {
        let response;
        for (let i = 0; ; ++i) {
            try {
                response = yield this.pool.query(query, values, yield);
                break;
            } catch (e) {
                if (e.code === 'ER_LOCK_DEADLOCK' && i < MAX_DEADLOCK_RETRIES - 1)
                    continue;
                console.log(`Error for query ${query} with values ${JSON.stringify(values)}`);
                throw e;
            }
        }
        return response[0] || response;
    }

    *close() {
        yield this.pool.end(yield);
    }

    static get instance() {
        return currentInstance;
    }

    static connect(options) {
        currentInstance = new Mysql(options);
    }

    static *close() {
        yield currentInstance.close();
    }
}

module.exports = Mysql;
