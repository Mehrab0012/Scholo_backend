const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.pvnuook.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware
app.use(express.json());


// --- CORS setup for Netlify frontend ---
app.use(cors({
  origin: [
    'https://scholarshipstream.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());
//jwt verification

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];

  // ERROR CHECK: If ACCESS_TOKEN_SECRET is missing in .env, this throws a 500
  if (!process.env.ACCESS_TOKEN_SECRET) {
    console.error("JWT Secret is missing in .env file!");
    return res.status(500).send({ message: "Server configuration error" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};


// Main async function
async function run() {
  try {
  

    const db = client.db('ScholarshipStream');
    const scholarshipsCollection = db.collection('scholarships');
    const usersCollection = db.collection('users');
    const applicationsCollection = db.collection('applications');
    const reviewsCollection = db.collection('reviews');


    // --- AUTH API (Generate Token) ---
    app.post('/jwt', async (req, res) => {
      const user = req.body; // Expecting { email: '...' }
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // --- Scholarships routes ---
    app.get('/scholarships', async (req, res) => {
      const { search, category, degree, sort, limit } = req.query;

      let query = {};
      if (search) query.title = { $regex: search, $options: 'i' };
      if (category) query.category = { $in: category.split(',') };
      if (degree) query.degree = { $in: degree.split(',') };

      let sortOptions = {};
      if (sort === "Amount: High to Low") sortOptions.amount = -1;
      else sortOptions.createdAt = -1; // Newest Added

      const result = await scholarshipsCollection.find(query).sort(sortOptions).limit(Number(limit)).toArray();
      res.send(result);
    });



    app.get('/scholarships/bulk', verifyToken, async (req, res) => {
      try {
        const idsParam = req.query.ids;
        if (!idsParam) return res.status(400).send({ message: "IDs missing" });

        const ids = idsParam.split(',');
        const objectIds = ids
          .filter(id => id && id.length === 24) // Basic check for valid hex string length
          .map(id => new ObjectId(id));

        if (objectIds.length === 0) return res.status(400).send({ message: "No valid IDs" });

        const result = await scholarshipsCollection
          .find({ _id: { $in: objectIds } })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });
    // GET all applications for Admin
    app.get('/all-applications', verifyToken, async (req, res) => {
      // In a real app, verify admin role here
      const result = await applicationsCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    // GET single application details by ID
    app.get('/applications/single/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await applicationsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch('/applications/review/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status, internalNotes, feedback, awarded } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          applicationStatus: status,
          internalNotes: internalNotes,
          feedback: feedback,
          awarded: awarded
        }
      };
      const result = await applicationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    app.get('/scholarships/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

      const result = await scholarshipsCollection.findOne({ _id: new ObjectId(id) });
      if (!result) return res.status(404).send("Scholarship not found");
      res.send(result);
    });
    app.post('/scholarships', verifyToken, async (req, res) => {
      try {
        const newScholarship = req.body;
        const result = await scholarshipsCollection.insertOne(newScholarship);
        res.status(201).send({ message: "Scholarship added", data: result });
      } catch (err) {
        res.status(500).send({ message: 'Error adding scholarship', err });
      }
    });

    // --- Users routes ---
    app.get('/users', verifyToken, async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ message: 'Email is required' });

      const result = await usersCollection.findOne({ email });
      res.send(result);
    });
    app.get('/users/count', verifyToken, async (req, res) => {
      try {
        const count = await usersCollection.countDocuments();
        res.send({ totalUsers: count });
      } catch (error) {
        res.status(500).send({ message: 'Failed to get user count' });
      }
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

    app.get('/user/role/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role || "student" });
    });

    // 1. Fetch all users for the dashboard
    app.get('/users/manage/all', verifyToken, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch users" });
      }
    });

    // 2. Update user role specifically (won't conflict with your POST /users)
    app.patch('/users/manage/role/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: role } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to update role" });
      }
    });
    app.patch('/users/login-update', verifyToken, async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) return res.status(400).send({ message: "Email is required" });

        // Only allow user to update their own lastLoggedIn
        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const filter = { email: email };
        const updateDoc = {
          $set: {
            lastLoggedIn: new Date()
          }
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ message: "Login timestamp updated successfully", result });
      } catch (err) {
        console.error("Login update error:", err);
        res.status(500).send({ message: "Server error during login update" });
      }
    });
    // 3. Delete a user
    app.delete('/users/manage/delete/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to delete user" });
      }
    });

    //application
    app.get('/applications', verifyToken, async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).send({ message: 'Email query is required' });
        }

        const applications = await applicationsCollection
          .find({ email })
          .toArray();

        res.send(applications);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: err.message });
      }
    });

    // --- Applications routes ---
    app.get('/applications/check', verifyToken, async (req, res) => {
      const { email, scholarshipId } = req.query;
      const result = await applicationsCollection.findOne({ email, scholarshipId });
      res.send(result);
    });


    app.post('/applications', verifyToken, async (req, res) => {
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
    app.patch('/applications/payment-confirm/:id', verifyToken, async (req, res) => {
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
    app.post('/create-checkout-session', verifyToken, async (req, res) => {
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

    app.post('/payment-success', verifyToken, async (req, res) => {
      const { sessionId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.send(session);
    });
    app.get('/reviews/:scholarshipId', verifyToken, async (req, res) => {
      const { scholarshipId } = req.params;
      const result = await reviewsCollection
        .find({ scholarshipId })
        .sort({ date: -1 }) // Newest first
        .toArray();
      res.send(result);
    });

    // POST: Add a new review
    app.post('/reviews', verifyToken, async (req, res) => {
      const reviewData = req.body;
      const result = await reviewsCollection.insertOne({
        ...reviewData,
        date: new Date().toISOString()
      });
      res.status(201).send(result);
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});