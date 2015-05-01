var encryptHelper = require('../helpers/encrypt.js'),
	TransactionTypes = require('../helpers/transaction-types.js'),
	RequestSanitizer = require('../helpers/request-sanitizer.js'),
	Router = require('../helpers/router.js'),
	constants = require('../helpers/constants.js'),
	errorCode = require('../helpers/errorCodes.js').error;

var modules, library, self, private = {};

function Contact() {
	this.create = function (data, trs) {
		trs.recipientId = null;
		trs.amount = 0;

		trs.asset.contact = {
			address: trs.contactAddress
		}

		return trs;
	}

	this.calculateFee = function (trs) {
		return 1 * constants.fixedPoint;
	}

	this.verify = function (trs, sender, cb) {
		if (!trs.asset.contact) {
			return setImmediate(cb, "Invalid asset: " + trs.id);
		}

		if (!trs.asset.contact.address) {
			return setImmediate(cb, "Invalid following: " + trs.id);
		}

		var isAddress = /^[0-9]+[C|c]$/g;
		if (!isAddress.test(trs.asset.contact.address.toLowerCase())) {
			return setImmediate(cb, "Invalid following: " + trs.id);
		}

		if (trs.amount != 0) {
			return setImmediate(cb, "Invalid amount: " + trs.id);
		}

		if (trs.recipientId != trs.senderId) {
			return setImmediate(cb, "Invalid recipientId: " + trs.id);
		}

		setImmediate(cb, null, trs);
	}

	this.process = function (dbLite, trs, sender, cb) {
		setImmediate(cb, null, trs);
	}

	this.getBytes = function (trs) {
		try {
			var contactAddress = new Buffer(trs.asset.contact.address, 'hex');

			var bb = new ByteBuffer(contactAddress.length, true);
			for (var i = 0; i < contactAddress.length; i++) {
				bb.writeByte(contactAddress[i]);
			}

			bb.flip();
		} catch (e) {
			throw Error(e.toString());
		}

		return bb.toBuffer()
	}

	this.apply = function (trs, sender) {
		return sender.applyContact(trs.asset.contact.address);
	}

	this.undo = function (trs, sender) {
		return sender.undoContact(trs.asset.contact.address);
	}

	this.applyUnconfirmed = function (trs, sender, cb) {
		var res = sender.applyUnconfirmedContact(trs.asset.contact.address);
		setImmediate(cb, !res ? "Can't apply contact: " + trs.id : null);
	}

	this.undoUnconfirmed = function (trs, sender) {
		return sender.undoUnconfirmedContact(trs.asset.contact.address);
	}

	this.objectNormalize = function (trs) {
		var report = RequestSanitizer.validate(trs.asset.contact, {
			object: true,
			properties: {
				address: "string!"
			}
		});

		if (!report.isValid) {
			throw Error(report.issues);
		}

		trs.asset.contact = report.value;

		return trs;
	}

	this.dbRead = function (raw) {
		if (!raw.c_address) {
			return null;
		} else {
			var contact = {
				transactionId: raw.t_id,
				address: raw.c_address
			}

			return {contact: contact};
		}
	}

	this.dbSave = function (dbLite, trs, cb) {
		dbLite.query("INSERT INTO contacts(address, transactionId) VALUES($address, $transactionId)", {
			address: trs.asset.contact.address,
			transactionId: trs.id
		}, cb);
	}

	this.ready = function (trs, sender) {
		if (sender.multisignatures) {
			return trs.signatures.length >= trs.asset.multisignature.min;
		} else {
			return true;
		}
	}
}

function attachApi() {
	var router = new Router();

	router.use(function (req, res, next) {
		if (modules) return next();
		res.status(500).send({success: false, error: errorCode('COMMON.LOADING')});
	});

	router.get("/", function (req, res) {
		req.sanitize("query", {
			secret: "string!",
			secondSecret: "string?",
			publicKey: "hex?"
		}, function (err, report, query) {
			if (err) return next(err);
			if (!report.isValid) return res.json({success: false, error: report.issues});

			var hash = crypto.createHash('sha256').update(query.secret, 'utf8').digest();
			var keypair = ed.MakeKeypair(hash);

			if (query.publicKey) {
				if (keypair.publicKey.toString('hex') != query.publicKey) {
					return res.json({success: false, error: errorCode("COMMON.INVALID_SECRET_KEY")});
				}
			}

			var account = modules.accounts.getAccountByPublicKey(keypair.publicKey.toString('hex'));

			if (!account || !account.publicKey) {
				return res.json({success: false, error: errorCode("COMMON.OPEN_ACCOUNT")});
			}

			res.json({success: true, following: account.following});
		});
	});

	router.put("/", function (req, res) {
		req.sanitize("body", {
			secret: "string!",
			secondSecret: "string?",
			publicKey: "hex?",
			following: "string!"
		}, function (err, report, body) {
			if (err) return next(err);
			if (!report.isValid) return res.json({success: false, error: report.issues});

			var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
			var keypair = ed.MakeKeypair(hash);

			if (body.publicKey) {
				if (keypair.publicKey.toString('hex') != body.publicKey) {
					return res.json({success: false, error: errorCode("COMMON.INVALID_SECRET_KEY")});
				}
			}

			var account = modules.accounts.getAccountByPublicKey(keypair.publicKey.toString('hex'));

			if (!account || !account.publicKey) {
				return res.json({success: false, error: errorCode("COMMON.OPEN_ACCOUNT")});
			}

			if (account.secondSignature && !body.secondSecret) {
				return res.json({success: false, error: errorCode("COMMON.SECOND_SECRET_KEY")});
			}

			if (account.secondSignature && body.secondSecret) {
				var secondHash = crypto.createHash('sha256').update(body.secondSecret, 'utf8').digest();
				var secondKeypair = ed.MakeKeypair(secondHash);
			}

			var followingAddress = null;
			var isAddress = /^[0-9]+[C|c]$/g;
			if (isAddress.test(body.following.toLowerCase())) {
				followingAddress = body.following;
			} else {
				var following = modules.accounts.getAccountByUsername(body.following);
				if (!following) {
					return res.json({success: false, error: errorCode("CONTACTS.USERNAME_DOESNT_FOUND", body)});
				}
				followingAddress = following.address;
			}

			var transaction = library.logic.transaction.create({
				type: TransactionTypes.FOLLOW,
				sender: account,
				keypair: keypair,
				secondKeypair: secondKeypair,
				contactAddress: followingAddress
			});

			library.sequence.add(function (cb) {
				modules.transactions.receiveTransactions([transaction], cb);
			}, function (err) {
				if (err) {
					return res.json({success: false, error: err});
				}

				res.json({success: true, transaction: transaction});
			});
		});
	});

	router.use(function (req, res) {
		res.status(500).send({success: false, error: errorCode('COMMON.INVALID_API')});
	});

	library.network.app.use('/api/contacts', router);
	library.network.app.use(function (err, req, res, next) {
		if (!err) return next();
		library.logger.error(req.url, err.toString());
		res.status(500).send({success: false, error: err.toString()});
	});
}

function Contacts(cb, scope) {
	library = scope;
	self = this;
	self.__private = private;
	attachApi();

	library.logic.transaction.attachAssetType(TransactionTypes.FOLLOW, new Contact());

	setImmediate(cb, null, self);
}

Contacts.prototype.onBind = function (scope) {
	modules = scope;
}

//export
module.exports = Contacts;