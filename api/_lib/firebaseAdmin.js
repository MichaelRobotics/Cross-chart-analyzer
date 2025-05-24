// api/_lib/firebaseAdmin.js
import admin from 'firebase-admin';

// Ensure Firebase Admin SDK is initialized only once.
// In a serverless environment, this check might seem redundant if each invocation
// is a new environment, but it's good practice and handles potential warm instances.
if (!admin.apps.length) {
  try {
    // Option 1: If using a service account JSON file path via GOOGLE_APPLICATION_CREDENTIALS
    // Ensure this environment variable is set in your Vercel deployment settings.
    // admin.initializeApp({
    //   credential: admin.credential.applicationDefault(),
    //   // Add your Firebase project's storageBucket URL if using Firebase Storage
    //   // storageBucket: 'YOUR_PROJECT_ID.appspot.com' // Replace with your actual storage bucket
    // });

    // Option 2: If storing the service account key JSON directly in an environment variable
    // (e.g., FIREBASE_SERVICE_ACCOUNT_KEY_JSON)
    const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
    const storageBucketUrl = process.env.FIREBASE_STORAGE_BUCKET_URL; // e.g., 'your-project-id.appspot.com'

    if (!serviceAccountKeyJson) {
      throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set.');
    }
    if (!storageBucketUrl) {
        console.warn('The FIREBASE_STORAGE_BUCKET_URL environment variable is not set. Firebase Storage operations might fail.');
    }

    const serviceAccount = JSON.parse(serviceAccountKeyJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucketUrl || undefined, // Only set if provided
    });

    console.log('Firebase Admin SDK initialized successfully.');

  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
    // Depending on your error handling strategy, you might want to re-throw the error
    // or handle it in a way that gracefully degrades functionality.
    // For now, we'll log it. Critical operations relying on Firebase will likely fail.
  }
}

// Export initialized Firebase services
const firestore = admin.firestore();
const storage = admin.storage(); // This initializes the default bucket
// If you have multiple storage buckets, you might need:
// const bucket = admin.storage().bucket('your-specific-bucket-name');

export { admin, firestore, storage };