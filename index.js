var request = require("request");
var fs = require("fs");
var Service, Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory("homebridge-httpdoor", "Httpdoor", DoorAccessory);
}

function DoorAccessory(log, config) {
	this.log = log;
	this.name = config["name"];
	this.accessToken = config["accessToken"];
	this.deviceID = config["deviceID"];
	this.url = config["url"];
	this.controlurl = config["controlURL"];
	this.statusurl = config["statusURL"];

	this.garageservice = new Service.GarageDoorOpener(this.name);

	this.garageservice
		.getCharacteristic(Characteristic.CurrentDoorState)
		.on('get', this.getState.bind(this));

	this.garageservice
		.getCharacteristic(Characteristic.TargetDoorState)
		.on('get', this.getState.bind(this))
		.on('set', this.setState.bind(this));

	this.garageservice
		.getCharacteristic(Characteristic.ObstructionDetected)
		.on('get', this.getState.bind(this));
}

DoorAccessory.prototype.getState = function(callback) {
	var stateUrl = this.url + this.deviceID + "/" + this.statusurl + "?access_token=" + this.accessToken;
	
	this.log("Getting current state...");

	request.get({
		url: stateUrl
	}, function(err, response, body) {
		if (!err && response.statusCode == 200) {
			var json = JSON.parse(body);
			var state = json.result; // "open" or "closed"
			this.log("Door state is %s", state);
			var closed = state == "closed"
			callback(null, closed); // success
		} else {
			this.log("Error getting state: %s", err);
			callback(err);
		}
	}.bind(this));
}

DoorAccessory.prototype.setState = function(state, callback) {
	var doorState = (state == Characteristic.TargetDoorState.CLOSED) ? "closenow" : "open";
	var controlUrl = this.url + this.deviceID + "/" + this.controlurl;

	this.log("Set state to %s", doorState);
	
	request.post({
		url: controlUrl,
		form: {
			arg: doorState,
			access_token: this.accessToken
		}
	}, function(err, response, body) {
		if (!err && response.statusCode == 200) {
			this.log("State change complete.");
			var currentState = (state == Characteristic.TargetDoorState.CLOSED) ? Characteristic.CurrentDoorState.CLOSED : Characteristic.CurrentDoorState.OPEN;

			this.garageservice
			.setCharacteristic(Characteristic.CurrentDoorState, currentState);

			callback(null); // success
		} else {
			this.log("Error '%s' setting door state. Response: %s", err, body);
			callback(err || new Error("Error setting door state."));
		}
	}.bind(this));
},

DoorAccessory.prototype.getServices = function() {
	return [this.garageservice];
}