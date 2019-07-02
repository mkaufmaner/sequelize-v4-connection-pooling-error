# sequelize-v4-connection-pooling-error
Connection pooling error under heavy load with postgres.

## What are you doing?
<!-- Post a minimal, self-contained code sample that reproduces the issue, including models and associations -->

Replication pooling for postgres becomes saturated with error objects under heavy load when a connection reset occurs.  However, I believe this problem is systemic across all supported dialects using replication.

See https://github.com/mkaufmaner/sequelize-v4-connection-pooling-error for the test case.

```js
/* eslint no-console: 0 */
'use strict';

const Sequelize = require('sequelize');
const Promise = require('bluebird');
const util = require('util');
const debug = require('debug')('test');
const _ = require('lodash');

class Test {
	constructor(){
		return this.init().then(() => {
			// create a fake data set that will run for some time
			this.dust = _.fill(Array(this.options.pool.max * 10000), 1);

			return this.race();
		});
	}

	/**
     * Initialize the sequelize connection.
	 *
	 * @return {Promise.<Sequelize.prototype>} An instance of sequelize.
     */
	init(){
		this.options = {
			dialect: process.env.DIALECT,
			database: process.env.DATABASE,
			benchmark: process.env.BENCHMARK,
			replication: {
				write: {
					host: process.env.HOST,
					username: process.env.USERNAME,
					password: process.env.PASSWORD
				},
				read: [
					{
						host: process.env.HOST,
						username: process.env.USERNAME,
						password: process.env.PASSWORD
					}
				]
			},
			// set validation to true to prevent security flaws
			typeValidation: true,
			// set isolation level
			isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
			// retry logic
			retry: {
				match: [
					/SequelizeDatabaseError: terminating connection/,
					/SequelizeDatabaseError: read ECONNRESET/,
					/SequelizeConnectionError/,
					/SequelizeConnectionRefusedError/,
					/SequelizeHostNotFoundError/,
					/SequelizeHostNotReachableError/,
					/SequelizeInvalidConnectionError/,
					/SequelizeConnectionTimedOutError/
				],
				name: 'query',
				backoffBase: 100,
				backoffExponent: 1.1,
				timeout: 30000,
				max: 10
			},
			// pool options
			pool: {
				min: 0,
				max: 10
			}
		};

		debug('sequelize options %O', this.options);

		this.sequelize = new Sequelize(this.options);

		return this.sequelize.authenticate();
	}

	/**
	 * Races to infinity.
	 *
	 * @return {Promise}
	 */
	race(){
		return Promise.map(this.dust, () => {
			return this.sequelize.query('SELECT pg_sleep(1);', {
				type: this.sequelize.QueryTypes.SELECT
			});
		}, {
			concurrency: this.options.pool.max
		});
	}
}

module.exports = exports = new Test();
```

**To Reproduce**
Steps to reproduce the behavior:
1. Checkout https://github.com/mkaufmaner/sequelize-v4-connection-pooling-error
2. Install `npm install`
3. Copy `sample.env` to `.env` and modify your .env accordingly.
4. Run `source ./env && node ./index.js`
5. Restart the database.
6. The logs should begin to display `Unhandled rejection TimeoutError: ResourceRequest timed out` and never recover.

## What do you expect to happen?
I would like the pool to recover accordingly.

## What is actually happening?
The pool never recovers.  There is a race condition with validation upon acquisition and evicting errored connections when the replication options are set.

See https://github.com/sequelize/sequelize/blame/v4/lib/dialects/abstract/connection-manager.js#L162
```js
destroy: mayBeConnection => {
    if (mayBeConnection instanceof Error) {
        return Promise.resolve();
    }

    return this.pool[mayBeConnection.queryType].destroy(mayBeConnection)
        .tap(() => { debug('connection destroy'); });
}
```

Subsequently, acquired connections that are an instance of an error never get destroyed in their respective pool!

I ended up decoupling the request and process to diagnose this.  Where I had a client making several simultaneous request.  I set a break point accordingly in the generic pool when a connection is acquired and all of the pooled resources are `ALLOCATED` error objects.

![Errored Pool 1](https://github.com/mkaufmaner/sequelize-v4-connection-pooling-error/raw/master/misc/errored_pool_1.png "Errored Pool 1")

![Errored Pool 1](https://github.com/mkaufmaner/sequelize-v4-connection-pooling-error/raw/master/misc/errored_pool_2.png "Errored Pool 1")

## Fix

https://github.com/sequelize/sequelize/blame/v4/lib/dialects/abstract/connection-manager.js#L162
```js
destroy: mayBeConnection => {
    if(mayBeConnection.queryType === undefined){
        return Promise.all([
            this.pool.read.destroy(mayBeConnection).catch(/Resource not currently part of this pool/, () => {}),
            this.pool.write.destroy(mayBeConnection).catch(/Resource not currently part of this pool/, () => {})
        ]);
    }

    return this.pool[mayBeConnection.queryType].destroy(mayBeConnection);
},
```

https://github.com/sequelize/sequelize/blame/v4/lib/dialects/abstract/connection-manager.js#L191
https://github.com/sequelize/sequelize/blame/v4/lib/dialects/abstract/connection-manager.js#L213
```js
destroy: mayBeConnection => {
    if (mayBeConnection instanceof Error) {
        return Promise.resolve();
    }

    return this._disconnect(mayBeConnection)
        .tap(() => { debug('connection destroy'); });
},
```

## Environment
Dialect:
- [ ] mysql
- [x] postgres
- [ ] sqlite
- [ ] mssql
- [ ] any
Dialect **library** version: 7.8.0
Database version: 10
Sequelize version: v4.44.0
Node Version: 10
OS: macOS
If TypeScript related: TypeScript version: XXX
Tested with latest release:
- [ ] No
- [X] Yes, specify that version: 4.44.0
