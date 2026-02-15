const cron = require("./cron");
//const Storage = require("./storageMongo");
const axios = require("axios");
const config = require("../config");

const {generateDailyInvoicesJob}= require("../services/cronJobsServices");

(async () => {
 /* const now = new Date();
    now.setHours(0, 0, 1, 0);
    const start = new Date(now.getTime());
    now.setHours(23, 59, 59, 999);
    const end = new Date(now.getTime());
    const from = start.toISOString();
    const to = end.toISOString();
 const response = await axios.get(config.Url.Kms, {
        params: {
          groupId: 1,
          from: from,
          to: to,
        },
        headers: config.Header.POST,
      });
console.log(response.data);*/

 // try {
    const date = new Date();
    date.setDate(date.getDate() -0); // 25 days ago
    await generateDailyInvoicesJob(date);

    //console.log("🔹 Running syncSheets manually...");
    //await jobs.syncSheets();

    //console.log("✅ All manual tests done!");
 // } catch (err) {
   // console.error("❌ Error testing cron job:", err);
  //}
})();




/*
(async () => {
  await cron.init();
  console.log("✅ Cron jobs initialized");
})();*/