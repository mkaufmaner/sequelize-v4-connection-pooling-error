# sequelize-v4-connection-pooling-error
Connection pooling error under heavy load with postgres.

## What are you doing?
<!-- Post a minimal, self-contained code sample that reproduces the issue, including models and associations -->

Replication pooling for postgres becomes saturated with error objects under heavy load when a connection reset occurs.  However, I believe this problem is systemic across all supported dialects using replication.

```js

```
**To Reproduce**
Steps to reproduce the behavior:
1. Define models X, Y, ...
2. Run the following
3. See error

## What do you expect to happen?
_I wanted Foo!_

## What is actually happening?
_But the output was bar!_

_Output, either JSON or SQL_

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
