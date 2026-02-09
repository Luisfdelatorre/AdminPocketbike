
import api from '../server/api/megaRastreoApi1.js';

const test = async () => {
    try {
        console.log("Testing getDeviceList to check pagination keys...");
        const res = await api.getDeviceList({ $size: 1, $page: 1 });
        console.log("Response Keys:", Object.keys(res.data));
        console.log("Full Res (without objects contents):", JSON.stringify({ ...res.data, objects: '...' }, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
    }
};

test();
