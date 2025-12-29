

const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config();

//stripe integration
// const stripe = require('stripe')(process.env.STRIPE_KEY)


//from mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//uri should be dynamic
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.pvnuook.mongodb.net/?appName=Cluster0`;

const port = process.env.PORT || 3000

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
//middleware
app.use(express.json());
app.use(cors());

async function run() {
  try {

    await client.connect();

    //connect database
    const db = client.db('ScholarshipStream')
    const scholershipsCollection = db.collection('scholarships')
    const usersCollection = db.collection('users')

    //scholership api
    app.get('/scholarships', async (req, res) => {
      const limit = Number(req.query.limit) ||6;
      const result = await scholershipsCollection.find().limit(limit).toArray();
      res.send(result);
    })

app.get("/scholarships/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // validate ObjectId
    if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

    const result = await scholershipsCollection.findOne({ _id: new ObjectId(id) });

    if (!result) return res.status(404).send("Scholarship not found");

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


//posting data
    app.post('/scholarships', async (req, res) => {
      try {
        const newScholarship = req.body;
        const result = await scholershipsCollection.insertOne(newScholarship)
        res.status(201).send({ message: "Scholership added: ", daata: result });

      } catch (err) {
        res.status(500).send({ message: 'Error adding scholarship', err })
      }
    })

    //save or update user
    app.post('/user', async (req, res) => {
      const userData = req.body;
      const result = await usersCollection.insertOne(userData);
      res.send(result);

    })


  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is running')
})
app.listen(port, () => {
  console.log(`Port is running at ${port}`)
})