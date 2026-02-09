export class CommandBody {
  constructor(type, deviceId, id) {
    this.id = id;
    this.deviceId = deviceId;
    this.description = 'New…';
    this.type = type;
    this.attributes = {};
    this.textChannel = false;
  }
}
