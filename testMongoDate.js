const { MongoClient } = require('mongodb'); 
async function run() { 
  const client = new MongoClient('mongodb://localhost:27017'); 
  await client.connect(); 
  const db = client.db('test'); 
  const result = await db.collection('test_dates').aggregate([ 
    { $project: { original: '$date', shifted: { $subtract: ['$date', 18000000] } } } 
  ]).toArray(); 
  console.log(result); 
  await client.close(); 
} 
run().catch(console.dir);
