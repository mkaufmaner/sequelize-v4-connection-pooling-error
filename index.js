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