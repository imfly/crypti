### Crypti coin ###

Version 0.2


### Install ###
First run:
```
npm install
```

Dependencies

* sqlite3
* grunt-cli

Install sqlite3 (Ubuntu/Debian)

```
apt-get install sqlite3
```

Install sqltie3 (Fedora/CentOS)

```
yum install sqlite
```

Install grunt-cli with global flag

```
npm install grunt-cli -g
```

### Build ###

Before start application static html interface stored in public folder should be built.
```
cd public
bower install
grunt
```

### Test ###

To run tests use standard npm test method:
```
npm test
```

or

```
test/test.sh
```

Crypti uses mocha so it possible to run test manually from cli:
```
mocha test/test.js
mocha test/transaction/index.js
```

#### Own tests ####

Main test file is test/test.sh is used for separate test suites and to run tests with settings. Each test should
return exit code on failure:

```
# Bash test
./run-some-test.sh || exit 1;
# JS test file
$NODE test-file.js || exit 1;
```

**Note**. Use $NODE variable instead of `node` to use npm-defined node.js version.

To add custom mocha test add test file into test dir and then require it in `test.js` file in the appropriate place:
```
// test.js
require('./helpers/transaction.js');
require('./ui/login.js');
```

Note to use semantic names to avoid mess of files. Try to name it similarly to testing module or functionality name.

### Start ###
Run:
```
crypti -p [port] -a [address] -c [config-path]
```