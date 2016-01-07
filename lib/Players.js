'use strict';

var BigNumber = require("bignumber.js");
BigNumber.config({
	DECIMAL_PLACES: 43,
	EXPONENTIAL_AT: 50
});

class Players {
	constructor(CSGO) {
		this.CSGO = CSGO;
	}

	requestProfile(accountId, reqLevel, callback) {
		callback = callback || null;

		if (!this.CSGO.gcReady) {
			this.CSGO.debug("Profile can not be requested when GC is not ready.");
			return -1;
		}

		this.CSGO.debug("Requesting player profile for accId: " + accountId);

		var payload = new this.CSGO.protos.CMsgGCCStrike15_v2_ClientRequestPlayersProfile({
		    account_id: accountId,
			request_level: req_level || 32
		});

		this.CSGO.gc.send({msg:CSGO.ECSGOCMsg.k_EMsgGCCStrike15_v2_ClientRequestPlayersProfile, proto: {}},
      		payload.toBuffer(), callback);
	}

	toAccountId(steamId) {
		return new BigNumber(steamId).minus("76561197960265728")-0;
	}

	toSteamId(accId) {
		return new BigNumber(accId).plus("76561197960265728")+"";
	}
}

exports.Players = Players