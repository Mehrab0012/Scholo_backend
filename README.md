Scholarship Stream - Backend

A robust backend system for managing scholarship applications, user authentication, and payment processing. Built with Node.js, Express, and MongoDB, this API powers the Scholarship Stream platform, allowing students to apply for scholarships, track application status, and process payments securely.

Features

User Authentication: Sign up, login, and update user profiles.

Scholarship Management: Create, read, update, and delete scholarships.

Application System: Students can submit applications for scholarships.

Payment Integration: Secure payment processing for application fees.

Duplicate Prevention: Ensures the same application is not submitted twice.

Admin Panel Support: Manage users, scholarships, and applications.

Image Upload: Supports uploading user profile pictures using Cloudinary.

Tech Stack

Backend Framework: Node.js + Express.js

Database: MongoDB (via Mongoose)

Authentication: Firebase Auth / JWT

Payments: Stripe API

File Storage: Cloudinary

Other Tools: Axios, Cors, dotenv, Nodemon

Getting Started
Prerequisites

Node.js >= 18

MongoDB (local or cloud instance)

Firebase project (for authentication)

Stripe account (for payment integration)

Installation

Clone the repository:

git clone https://github.com/Mehrab0012/Scholo_backend.git
cd scholarship-stream-backend


Install dependencies:

npm install


Create a .env file in the root directory with the following variables:

PORT=5000
MONGO_URI=your_mongodb_connection_string
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
STRIPE_SECRET_KEY=your_stripe_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret


Start the server:

npm run dev


The server should now be running at http://localhost:3000.

API Endpoints
Users

POST /users – Create or update user

GET /users/:email – Get user by email

Scholarships

GET /scholarships – Get all scholarships

GET /scholarships/:id – Get scholarship by ID

POST /scholarships – Create new scholarship

PUT /scholarships/:id – Update scholarship

DELETE /scholarships/:id – Delete scholarship

Applications

POST /applications – Submit scholarship application

GET /applications/:email – Get applications by user email

PUT /applications/:id/status – Update application status

Payments

POST /payments/create-session – Create Stripe payment session

POST /applications/payment-success – Record payment success

Folder Structure
scholarship-stream-backend/
│
├─ controllers/        # Request handlers for users, scholarships, applications, payments
├─ middlewares/        # Authentication and validation middlewares
├─ .env                # Environment variables
├─ index.js            # Entry point
└─ package.json

Contributing

Fork the repository

Create your feature branch (git checkout -b feature/YourFeature)

Commit your changes (git commit -m 'Add some feature')

Push to the branch (git push origin feature/YourFeature)

Open a Pull Request

License

This project is licensed under the MIT License.

Contact

Developer: Mehrab H

Email: mehrabhossainfr@gmail.com