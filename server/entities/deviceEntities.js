/**
 * Represents a parsed GPS update from an adapter (e.g., Traccar).
 */
export class DeviceUpdate {
    constructor(p) {
        this.filter = { gpsId: p.deviceId };
        this.ignition = p.attributes?.ignition ?? false;
        this.lastUpdate = p.deviceTime ? new Date(p.deviceTime) : new Date();
        this.batteryLevel = p.attributes?.batteryLevel ?? null;
        const protocol = (p.protocol || p.attributes?.protocol || '').toLowerCase();
        // Battery disconnection & critical alarm detection
        const rawAlarm = (p.attributes?.alarm || '').toString().toLowerCase();

        if (protocol === 'gt06') {
            this.powerCut = rawAlarm.includes('powercut') || p.attributes?.charge === false;
            const status = p.attributes?.status ?? null;
            const result = (p.attributes?.result || '').trim().toLowerCase();
            // Protocol 'gt06' and others derive cutOff from command result text
            if ((result.includes('cut off') || result.includes('cutoff'))
                && (result.includes('success') || result.includes('already'))) {
                this.cutOff = true;
            } else if ((result.includes('restore') || result.includes('resume') || result.includes('fuel recovery'))
                && (result.includes('success') || result.includes('already'))) {
                this.cutOff = false;
            }

        }

        // Protocol 'h02' derives cutOff from status bitfield  
        if (protocol === 'h02') {
            const status = p.attributes?.status ?? null;
            if (status !== null && status > 255) {
                this.powerCut = ((status >>> 19) & 1) === 0;
                this.cutOff = (((status >> 27) & 1) == 0);
            }

            if (status !== null && status <= 255) {
                this.cutOff = (status & 128) !== 0;
            }
        }

        if (rawAlarm.includes('powercut') || rawAlarm.includes('poweroff') || rawAlarm.includes('cutpower')) {
            this.powerCut = true;
        }

        if (p.attributes?.motion !== undefined) {
            this.motion = Boolean(p.attributes.motion);
        }
    }
}

/**
 * Represents the in-memory state of a device and handles diffing logic.
 */
export class DeviceState {
    constructor(data) {
        const tel = data.telemetry || {};
        this._id = data._id;
        this.gpsId = data.gpsId;
        this.name = data.name;
        this.ignition = tel.ignition ?? false;
        this.cutOff = tel.cutOff ?? false;
        this.batteryLevel = tel.batteryLevel ?? null;
        this.companyId = data.companyId;
        this.lastUpdate = tel.lastUpdate ? new Date(tel.lastUpdate) : null;
        this.queued = Boolean(tel.queued);
        this.powerCut = Boolean(tel.powerCut);
        this.alarm = tel.alarm || null;
        this.motion = Boolean(tel.motion);

        this._lastDbPersistTime = this.lastUpdate ? this.lastUpdate.getTime() : 0;
        this._dirty = false;
        this._urgent = false;
        this._cutOffChanged = false;
        this._updateReasons = [];
    }

    applyUpdate(update) {
        const [newIgnition, newCutOff, newBattery] = [
            update.ignition ?? this.ignition,
            update.cutOff ?? this.cutOff,
            update.batteryLevel ?? this.batteryLevel
        ];
        const newPowerCut = update.powerCut !== undefined ? update.powerCut : this.powerCut;
        const newAlarm = update.alarm !== undefined ? update.alarm : this.alarm;
        const newMotion = update.motion !== undefined ? update.motion : this.motion;

        const ignitionChanged = this.ignition !== newIgnition;
        const cutOffChanged = this.cutOff !== newCutOff;
        const powerCutChanged = update.powerCut !== undefined && this.powerCut !== newPowerCut;
        const alarmChanged = update.alarm !== undefined && this.alarm !== newAlarm;
        const motionChanged = update.motion !== undefined && this.motion !== newMotion;

        // Battery change filter: meaningful delta (>= 5%) or dropping to critical (<= 20%)
        let batteryChanged = false;
        if (newBattery !== null && this.batteryLevel !== null) {
            const delta = Math.abs(newBattery - this.batteryLevel);
            batteryChanged = delta >= 5 || (newBattery <= 20 && this.batteryLevel > 20);
        } else if (newBattery !== this.batteryLevel) {
            batteryChanged = true;
        }

        // Heartbeat for DB persistence: 10 minutes interval if no operational state change
        const nowMs = update.lastUpdate ? new Date(update.lastUpdate).getTime() : Date.now();
        const dbHeartbeatDue = (nowMs - this._lastDbPersistTime) > 600000; // 10 minutes

        // Any state change that frontend needs to see via SSE
        const sseStateChanged = ignitionChanged || cutOffChanged || powerCutChanged || alarmChanged || batteryChanged || motionChanged;

        // DB state change: critical events OR significant state transitions OR 10-minute periodic refresh
        const dbStateChanged = sseStateChanged || dbHeartbeatDue;

        // Always keep in-memory telemetry fresh to the millisecond
        this.lastUpdate = update.lastUpdate;
        this.alarm = newAlarm;
        this.powerCut = newPowerCut;
        this.ignition = newIgnition;
        this.cutOff = newCutOff;
        this.batteryLevel = newBattery;
        this.motion = newMotion;

        if (dbStateChanged) {
            this._updateReasons = [];
            if (ignitionChanged) this._updateReasons.push('ignition');
            if (cutOffChanged) {
                this._updateReasons.push('cutOff');
                this._cutOffChanged = true;
                this.queued = false;
            }
            if (powerCutChanged) this._updateReasons.push('powerCut');
            if (alarmChanged) this._updateReasons.push('alarm');
            if (batteryChanged) this._updateReasons.push('battery');
            if (dbHeartbeatDue && !sseStateChanged) this._updateReasons.push('heartbeat');

            // Urgent flush flag: cutOff change OR powerCut (battery disconnected) OR ignition change
            if (cutOffChanged || powerCutChanged || ignitionChanged) {
                this._urgent = true;
            }

            this._dirty = true;
        }

        // Return true if frontend needs an SSE push OR DB needs a write
        return sseStateChanged || dbStateChanged;
    }

    clearDirty() {
        this._dirty = false;
        this._urgent = false;
        this._cutOffChanged = false;
        this._lastDbPersistTime = this.lastUpdate ? new Date(this.lastUpdate).getTime() : Date.now();
        this._updateReasons = [];
    }
}
