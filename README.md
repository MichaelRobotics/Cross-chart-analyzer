# Cross-chart-analyzer
# CSV Data Analyzer with AI

## � Overview

The CSV Data Analyzer is a web application designed to provide users with insightful analysis of their CSV data. Users can upload a CSV file, and the application, leveraging a powerful AI backend (intended to be Gemini), breaks down the data based on predefined topics such as bottlenecks, costs, quality, and more. 

For quick demonstrations or users without a CSV file, a "Demo Mode" is available, which uses sample CSV data and displays simulated analysis results, including an interactive (though simulated) chat feature for follow-up questions.

## ✨ Features

* **CSV File Upload:** Users can upload their own `.csv` files for analysis.
* **Topic-Based Analysis:** The application analyzes data based on a predefined set of key business/operational topics (e.g., "Bottlenecks," "Costs," "Quality").
* **AI-Powered Insights (Intended):** The core analysis is designed to be powered by Google's Gemini API (via a serverless backend function) to provide intelligent summaries for each topic.
* **Demo Mode:**
    * Uses pre-loaded sample CSV data.
    * Displays simulated analysis results for each topic.
    * Includes a simulated chat interface for asking follow-up questions about the demo data.
* **Responsive Design:** Styled with Tailwind CSS for a modern and responsive user interface.
* **Clear Results Display:** Analysis results are presented in a two-column layout, with topics on the left and detailed analysis on the right.
* **Client-Side Routing:** Uses React Router for a single-page application (SPA) experience.

## �️ Technologies Used

* **Frontend:**
    * React (v18+) with Hooks
    * React Router DOM for navigation
    * Tailwind CSS for styling
    * (No client-side CSV parsing library like PapaParse is strictly needed as the raw CSV string is sent to the backend)
* **Backend (Serverless Function - for Vercel):**
    * Node.js (as per the example `api/analyze.js` structure)
    * `fetch` API for making requests to the Gemini API.
* **AI (Intended):**
    * Google Gemini API (specifically `gemini-2.0-flash` in the example)
* **Development Environment:**
    * Vite (recommended for fast development and optimized builds)
    * Node.js and npm/yarn

## ⚙️ Project Structure

csv-analyzer-gemini/├── public/│   └── index.html├── src/│   ├── App.jsx         # Main application component with routing and core logic│   ├── index.css       # Tailwind CSS directives and global styles│   └── main.jsx        # Entry point for the React application├── api/│   └── analyze.js      # Serverless function for backend logic (CSV processing & Gemini API calls)├── .gitignore├── package.json├── tailwind.config.js├── postcss.config.js└── README.md           # This file
* **`src/App.jsx`**: Contains all React components (`LandingPage`, `ResultsPage`, `ChatInterface`, helpers, etc.) and the main application logic.
* **`api/analyze.js`**: This is the serverless function intended for Vercel. It receives the CSV data and topics, then calls the Gemini API for each topic to generate analysis.

## � Getting Started

### Prerequisites

* Node.js (v16 or later recommended)
* npm or yarn
* A Gemini API Key (if you want to run the full analysis feature)

### Local Development Setup

1.  **Clone the repository (if applicable) or set up the project files:**
    Ensure you have the `App.jsx` (containing all React components), and if testing the backend, the `api/analyze.js` file.

2.  **Install dependencies:**
    Navigate to your project directory in the terminal and run:
    ```bash
    npm install
    # or
    yarn install
    ```
    This will install React, React Router, Tailwind CSS, and other necessary development dependencies.

3.  **Set up Tailwind CSS:**
    If not already configured (the provided `App.jsx` assumes it is):
    ```bash
    npm install -D tailwindcss postcss autoprefixer @tailwindcss/typography
    npx tailwindcss init -p
    ```
    Ensure your `tailwind.config.js` is set up to scan your `src` files:
    ```javascript
    // tailwind.config.js
    /** @type {import('tailwindcss').Config} */
    export default {
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}", // Ensure this path is correct
      ],
      theme: {
        extend: {},
      },
      plugins: [
        require('@tailwindcss/typography'), // Useful for styling AI-generated content
      ],
    }
    ```
    And your main CSS file (`src/index.css` or similar) includes:
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    ```

4.  **Set up Environment Variables (for API functionality):**
    If you intend to use the actual API analysis (not just the demo mode), you need to provide your Gemini API Key. For local development with Vercel CLI, or when deploying to Vercel, you'll set this as an environment variable.
    * Create a `.env` file in the root of your project (ensure it's in `.gitignore`!).
    * Add your API key:
        ```
        VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE 
        ```
    * The serverless function `api/analyze.js` will access this via `process.env.GEMINI_API_KEY` when deployed or run with Vercel CLI.
        *(Note: The provided serverless function example directly uses `process.env.GEMINI_API_KEY`. If running locally without Vercel CLI's environment variable injection, you might need a package like `dotenv` for the backend function to read this, or pass it differently during local testing of the API endpoint.)*

5.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will typically start the application on `http://localhost:5173` (or another port if 5173 is busy).

### Using the Application

* **Landing Page:**
    * **Upload CSV:** Click "Wybierz plik CSV", select your file, then click "Analizuj Plik (Wymaga API)". This will send the data to the `/api/analyze` endpoint.
    * **Demo Mode:** Click "Uruchom Test z Danymi Demo" to see simulated analysis and chat functionality using built-in sample data.
* **Results Page:**
    * Displays analysis for each predefined topic.
    * Select topics from the left sidebar to view their details.
    * Engage with the simulated chat at the bottom to ask follow-up questions about the (demo) data.

## ☁️ Deployment

This application is structured for easy deployment to **Vercel**.

1.  Push your project to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import your Git repository into Vercel.
3.  **Configure Project Settings:**
    * **Framework Preset:** Vercel should auto-detect "Vite".
    * **Build Command:** `npm run build` or `vite build`
    * **Output Directory:** `dist`
    * **Install Command:** `npm install` or `yarn install`
4.  **Add Environment Variables:**
    In your Vercel project settings, add the `GEMINI_API_KEY` with your actual API key. The serverless function in the `api/` directory will automatically pick this up.
5.  Deploy! Vercel will build your frontend and deploy the `api/analyze.js` file as a serverless function.

## � Contributing
Contributions, issues, and feature requests are welcome. Please feel free to fork the repository, make changes, and open a pull request.

## � License

This project can be considered under the MIT License or any other open-source license you prefer to specify.
