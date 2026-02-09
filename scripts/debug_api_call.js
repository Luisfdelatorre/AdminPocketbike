
import service from '../server/services/megaRastreoServices1.js';

const test = async () => {
    try {
        console.log("Testing fetchDevices (Service Layer)...");
        const devices = await service.fetchDevices(10); // Use small page size to force pagination
        console.log("Total Fetched Devices:", devices.length);
        if (devices.length > 0) {
            console.log("First Device ID:", devices[0]._id);
        }
    } catch (error) {
        console.error("Request failed!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
            console.error("Headers:", error.response.headers);
        } else {
            console.error("Error:", error.message);
        }
    }
};

test();
