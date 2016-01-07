'use strict';

var EventEmitter = require('events').EventEmitter,
    util = require("util"),
    protos = require("./helpers/protos"),
    protoMask = 0x80000000,
    bignumber = require("bignumber.js"),
    players = require("./lib/Players"),
    sharecodes = require("./lib/Sharecodes"),
    Messages = require("./protos/messages").Messages;

class CSGO {
  constructor(steamUser, steamGC, debug) {
    if (!steamUser || !steamGC) {
      console.error("SteamUser or SteamGC not provided. Cannot construct CSGO instance!");
      return;
    }

    this.steamUser = steamUser;
    this.gc = steamGC;
    this.debug = debug || false;
    this._gcReady = false;
    this._appid = 730;
    this._gcClientHelloIntervalId = null;
    this._handlers = {};

    //this.Matches = new require("./lib/Matches").Matches(this);
    this.Players = new players.Players(this);
    this.Sharecodes = sharecodes.Sharecodes;

    var self = this;

    this._gc.on('message', function(type, message, callback) {
      callback = callback || null;

      var kMsg = type.msg & ~protoMask;
      self.debug("CS:GO fromGC: " + kMsg);
      if (kMsg in self._handlers) {
        if (callback) {
          self._handlers[kMsg].call(self, message, callback);
        }
        else {
          self._handlers[kMsg].call(self, message);
        }
      }
      else {
        self.emit("unhandled", kMsg);
      }
    });

    this._gc._client.on('message', function(type, message, callback) {
      callback = callback || null;

      var kMsg = type.msg & ~protoMask;
      if (kMsg in self._handlers) {
        if (callback) {
          self._handlers[kMsg].call(self, message, callback);
        }
        else {
          self._handlers[kMsg].call(self, message);
        }
      }
      else {
        self.emit("unhandled_steam", kMsg);
      }
    });

    this.registerHandler(Messages.EGCBaseClientMsg.k_EMsgGCClientWelcome, function() {
      if (self._gcClientHelloIntervalId) {
        clearInterval(self._gcClientHelloIntervalId);
        self._gcClientHelloIntervalId = null;

        self.debug("Received client welcome.");
        self._gcReady = true;
        self.emit("ready");
      }
    });

    EventEmitter.call(this);
  }

  debug(msg) {
    if (this.debug)
      console.info(msg);
  }

  registerHandler(msgId, callback) {
    if (this.debug)
      console.info("Registered handler for ID: " + msgId);
    this._handlers[msgId] = callback;
  }

  get gcReady() {
    return this._gcReady;
  }

  _sendClientHello() {
    this.debug("Sending ClientHello");
    if (!this._gc) {
      this.debug("GC went missing");
    }
    else {
      this._gc.send({msg: Messages.EGCBaseClientMsg.k_EMsgGCClientHello, proto: {}},
          new protos.CMsgClientHello({}).toBuffer());
    }
  };
}
util.inherits(CSGO, EventEmitter);

var csgoTest = new CSGO(null, null, true);
console.log(csgoTest);
console.log(csgoTest.Sharecodes.decode("CSGO-U6MWi-hYFWJ-opPwD-JciHm-qOijD"));

// Methods
CSGOClient.prototype.launch = function() {
  /* Reports to Steam that we are running Counter-Strike: Global Offensive. Initiates communication with GC with EMsgGCClientHello */
  if (this.debug) {
    util.log("Launching CS:GO");
  }
  this._user.gamesPlayed({
    games_played: [{
      game_id: '730'
    }]
  });

  // Keep knocking on the GCs door until it accepts us.
  this._gcClientHelloIntervalId = setInterval(this._sendClientHello, 2500);
};

CSGOClient.prototype.exit = function() {
  /* Reports to Steam we are not running any apps. */
  if (this.debug) {
    util.log("Exiting CS:GO");
  }

  /* stop knocking if exit comes before ready event */
  if (this._gcClientHelloIntervalId) {
    clearInterval(this._gcClientHelloIntervalId);
    this._gcClientHelloIntervalId = null;
  }
  this._gcReady = false;
  this._user.gamesPlayed({
    games_played: [{}]
  });
};


// Handlers

var handlers = CSGOClient.prototype._handlers = {};

handlers[CSGO.EGCBaseClientMsg.k_EMsgGCClientWelcome] = function clientWelcomeHandler(message) {
  /* Response to our k_EMsgGCClientHello, now we can execute other GC commands. */

  // Only execute if _gcClientHelloIntervalID, otherwise it's already been handled (and we don't want to emit multiple 'ready');
  if (this._gcClientHelloIntervalId) {
    clearInterval(this._gcClientHelloIntervalId);
    this._gcClientHelloIntervalId = null;

    if (this.debug) {
      util.log("Received client welcome.");
    }
    this._gcReady = true;
    this.emit("ready");
  }
};

handlers[CSGO.EGCBaseClientMsg.k_EMsgGCClientConnectionStatus] = function gcClientConnectionStatus(message) {
  /* Catch and handle changes in connection status, cuz reasons u know. */

  var status = protos.CMsgConnectionStatus.decode(message).status;

  switch (status) {
    case CSGO.GCConnectionStatus.GCConnectionStatus_HAVE_SESSION:
      if (this.debug) {
        util.log("GC Connection Status regained.");
      }

      // Only execute if _gcClientHelloIntervalID, otherwise it's already been handled (and we don't want to emit multiple 'ready');
      if (this._gcClientHelloIntervalId) {
        clearInterval(this._gcClientHelloIntervalId);
        this._gcClientHelloIntervalId = null;

        this._gcReady = true;
        this.emit("ready");
      }
      break;

    default:
      if (this.debug) {
        util.log("GC Connection Status unreliable - " + status);
      }

      // Only execute if !_gcClientHelloIntervalID, otherwise it's already been handled (and we don't want to emit multiple 'unready');
      if (!this._gcClientHelloIntervalId) {
        this._gcClientHelloIntervalId = setInterval(this._sendClientHello, 2500); // Continually try regain GC session

        this._gcReady = false;
        this.emit("unready");
      }
      break;
  }
};

CSGO.CSGOClient = CSGOClient;

require("./handlers/match");
require("./handlers/player");
require("./handlers/rich_presence");
