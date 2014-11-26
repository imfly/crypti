var crypto = require('crypto'),
	bignum = require('bignum');
var Router = require('../helpers/router.js');

//private
var modules, library;
var accounts;

//public
function Account(address, balance, unconfirmedBalance) {
	this.address = address;
	this.balance = balance || 0;
	this.unconfirmedBalance = unconfirmedBalance || 0;
}

Account.prototype.addToBalance = function (amount) {
	this.balance += amount;
}

Account.prototype.addToUnconfirmedBalance = function (amount) {
	this.unconfirmedBalance += amount;
}

Account.prototype.setBalance = function (balance) {
	this.balance = balance;
}

Account.prototype.setUnconfirmedBalance = function (unconfirmedBalance) {
	this.unconfirmedBalance = unconfirmedBalance;
}

function Accounts(cb, scope) {
	library = scope;
	accounts = {};

	var router = new Router();

	router.post('/open', function (req, res) {
		if (!req.body.secret || req.body.secret.length == 0) {
			return res.json({ success : false, error : "Provide secret key of account" });
		}

		var account = this.openAccount(req.body.secret);

		return res.json({ success : true, account : account });
	});

	router.get('/getBalance', function (req, res) {
		if (!req.query.address) {
			return res.json({ success : false, error : "Provide address in url" });
		}

		var account = this.getAccount(req.query.address);
		var balance = account? account.balance : 0;
		var unconfirmedBalance = account? account.unconfirmedBalance : 0;

		return res.json({ success : true, balance : balance, unconfirmedBalance : unconfirmedBalance });
	});

	library.app.use('/accounts', router);

	setImmediate(cb, null, this);
}

Accounts.prototype.addAccount = function (account) {
	if (!accounts[account.address]) {
		accounts[account.address] = account;
	}
}

Accounts.prototype.getAccount = function (id) {
	return accounts[id];
}

Accounts.prototype.getAccountByPublicKey = function (publicKey) {
	var address = this.getAddressByPublicKey(publicKey);
	return this.getAccount(address);
}

Accounts.prototype.getAddressByPublicKey = function (publicKey) {
	var publicKeyHash = crypto.createHash('sha256').update(publicKey).digest();
	var temp = new Buffer(8);
	for (var i = 0; i < 8; i++) {
		temp[i] = publicKeyHash[7 - i];
	}

	var address = bignum.fromBuffer(temp).toString() + "C";
	return address;
}

Accounts.prototype.getAccountOrCreate = function (addressOrPublicKey) {
	var account, address, publicKey;

	if (typeof(addressOrPublicKey) == 'string') {
		address = addressOrPublicKey;
		account = this.getAccount(address);
	} else {
		publicKey = addressOrPublicKey;
		address = this.getAddressByPublicKey(publicKey);
		account = this.getAccount(address);
	}

	if (!account) {
		account = new Account(address, publicKey);
		this.addAccount(account);

		return account;
	} else {
		return account;
	}
}

Accounts.prototype.getAllAccounts = function () {
	return accounts;
}

Accounts.prototype.openAccount = function (secret) {
	var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
	var keypair = ed.MakeKeypair(hash);

	return this.getAccountOrCreate(keypair.publicKey);
}

Accounts.prototype.run = function (scope) {
	modules = scope;
}

module.exports = Accounts;