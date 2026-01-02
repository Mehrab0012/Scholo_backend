const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.pvnuook.mongodb.net/?appName=Cluster0`;
const port = process.env.PORT || 3000;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware
app.use(express.json());
app.use(cors());

// Main async function
async function run() {
  try {
    await client.connect();

    const db = client.db('ScholarshipStream');
    const scholarshipsCollection = db.collection('scholarships');
    const usersCollection = db.collection('users');
    const applicationsCollection = db.collection('applications');

    // --- Scholarships routes ---
    app.get('/scholarships', async (req, res) => {
      const limit = Number(req.query.limit) || 6;
      const result = await scholarshipsCollection.find().limit(limit).toArray();
      res.send(result);
    });

    app.get('/scholarships/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

      const result = await scholarshipsCollection.findOne({ _id: new ObjectId(id) });
      if (!result) return res.status(404).send("Scholarship not found");
      res.send(result);
    });

    app.post('/scholarships', async (req, res) => {
      try {
        const newScholarship = req.body;
        const result = await scholarshipsCollection.insertOne(newScholarship);
        res.status(201).send({ message: "Scholarship added", data: result });
      } catch (err) {
        res.status(500).send({ message: 'Error adding scholarship', err });
      }
    });

    // --- Users routes ---
    app.get('/users', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      try {
        const userData = req.body;
        const result = await usersCollection.updateOne(
          { email: userData.email },
          {
            $set: {
              name: userData.name,
              photoURL: userData.photoURL || "",
              role: "student",
              lastLoggedIn: new Date()
            }
          },
          { upsert: true }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Something went wrong" });
      }
    });

    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role || "student" });
    });

    //application
    

    // --- Applications routes ---
    app.get('/applications/check', async (req, res) => {
      const { email, scholarshipId } = req.query;
      const result = await applicationsCollection.findOne({ email, scholarshipId });
      res.send(result);
    });
    

    app.post('/applications', async (req, res) => {
      const applicationData = req.body;

      // Check for duplicate application for the SAME scholarship
      const existing = await applicationsCollection.findOne({
        userEmail: applicationData.userEmail,
        scholarshipId: applicationData.scholarshipId
      });

      if (existing) {
        return res.status(400).send({ message: 'You have already applied for this scholarship' });
      }

      const result = await applicationsCollection.insertOne({
        ...applicationData,
        createdAt: new Date()
      });
      res.status(201).send(result);
    });

    // Update payment status after successful Stripe redirect
    app.patch('/applications/payment-confirm/:id', async (req, res) => {
      const { id } = req.params;
      const { transactionId } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          paymentStatus: 'paid',
          transactionId: transactionId,
        }
      };
      const result = await applicationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // --- Stripe checkout session ---
    app.post('/create-checkout-session', async (req, res) => {
      try {
        const info = req.body;
        const amount = Math.round(info.applicationFees * 100);

        const session = await stripe.checkout.sessions.create({
          line_items: [{
            price_data: {
              currency: 'usd',
              unit_amount: amount,
              product_data: { name: `Scholarship Application Fee - ${info.userName}` }
            },
            quantity: 1
          }],
          customer_email: info.senderEmail,
          mode: 'payment',
          metadata: {
            applicationId: info.applicationId, // VERY IMPORTANT: Pass DB ID
            scholarshipId: info.scholarshipId
          },
          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`
        });

        res.send({ url: session.url });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    app.post('/payment-success', async (req, res) => {
      const { sessionId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.send(session);
    });


    console.log("Backend routes are set up successfully.");

  } finally {
    // Optionally: keep client connected
  }
}

run().catch(console.dir);

// Test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});
