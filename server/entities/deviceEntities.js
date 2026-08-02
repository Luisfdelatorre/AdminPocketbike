/**
 * Represents a parsed GPS update from an adapter (e.g., Traccar).
 */
export class DeviceUpdate {
    constructor(p) {
        this.filter = { gpsId: p.deviceId };
        this.ignition = p.attributes?.ignition ?? false;
        this.lastUpdate = p.deviceTime ? new Date(p.deviceTime) : new Date();
        this.batteryLevel = p.attributes?.batteryLevel ?? null;

        const status = p.attributes?.status ?? null;
        const result = (p.attributes?.result || '').trim().toLowerCase();

        if (status !== null) {
            this.cutOff = ((status <= 255 && (status & 128) !== 0) || (status > 255 && ((status >> 27) & 1) == 0));
        }
        if (result.includes('cut off') && (result.includes('success') || result.includes('already'))) {
            this.cutOff = true;
        } else if ((result.includes('restore') || result.includes('resume')) && (result.includes('success') || result.includes('already'))) {
            this.cutOff = false;
        }
    }
}

/**
 * Represents the in-memory state of a device and handles diffing logic.
 */
export class DeviceState {
    constructor(data) {
        this._id = data._id;
        this.gpsId = data.gpsId;
        this.name = data.name;
        this.ignition = data.ignition;
        this.cutOff = data.cutOff;
        this.batteryLevel = data.batteryLevel;
        this.companyId = data.companyId;
        this.lastUpdate = data.lastUpdate;

        this._dirty = false;
        this._cutOffChanged = false;
        this._updateReasons = [];
    }

    applyUpdate(update) {
        const [newIgnition, newCutOff, newBattery] = [
            update.ignition ?? this.ignition,
            update.cutOff ?? this.cutOff,
            update.batteryLevel ?? this.batteryLevel
        ];

        const ignitionChanged = this.ignition !== newIgnition;
        const cutOffChanged = this.cutOff !== newCutOff;
        const batteryChanged = this.batteryLevel !== newBattery;

        const stateChanged = [
            ignitionChanged,
            cutOffChanged,
            batteryChanged
        ].some(Boolean);

        this.lastUpdate = update.lastUpdate;
        this._cutOffChanged = false;

        if (stateChanged) {
            this._updateReasons = [];
            if (ignitionChanged) this._updateReasons.push('ignition');
            if (cutOffChanged) {
                this._updateReasons.push('cutOff');
                this._cutOffChanged = true;
            }
            if (batteryChanged) this._updateReasons.push('battery');

            this.ignition = newIgnition;
            this.cutOff = newCutOff;
            this.batteryLevel = newBattery;
            this._dirty = true;
        }

        return stateChanged;
    }

    clearDirty() {
        this._dirty = false;
        this._updateReasons = [];
    }
}
