# BLOGGY  

BLOGGY is a full-featured, dynamic blogging platform designed for writers and readers. It provides a clean, intuitive interface for creating, sharing, and discovering content. Built with a robust Node.js backend, it features secure user authentication, rich text editing with Markdown, and social features like post liking.

## ✨ Features

- **Full CRUD Functionality**: Create, read, and delete posts with ease.
- **User Authentication**: Secure local (email/password) sign-up and sign-in, plus Google OAuth 2.0 integration.
- **Email Verification**: New users receive a verification link to activate their accounts, preventing spam and ensuring valid emails.
- **Markdown Editor**: Write posts using Markdown for rich text formatting. The platform automatically converts and sanitizes the HTML to prevent XSS attacks.
- **Post Liking System**: Engage with content by liking posts.
- **User Profiles**: View your own posts or visit the public profiles of other authors.
- **Post Search**: Quickly find articles by searching for keywords in post titles and content.
- **Trending Articles**: The homepage features a dynamic list of trending tech articles fetched from the DEV.to API to keep content fresh and engaging.
- **Admin Role**: An admin user has the authority to delete any post on the platform.
- **Responsive Design**: A clean and accessible UI that works well on various screen sizes.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose (ODM)
- **Templating Engine**: EJS (Embedded JavaScript)
- **Authentication**: Passport.js (Local, Google OAuth 2.0 Strategies)
- **Session Management**: express-session with connect-mongo for persistent sessions.
- **Security**: dompurify and marked for XSS prevention, dotenv for environment variable management.
- **Emailing**: Nodemailer for sending verification and contact form emails.
- **API Integration**: Axios for fetching data from external APIs.

## 🚀 Getting Started

Follow these instructions to get a local copy of BLOGGY up and running on your machine.

### Prerequisites

- Node.js (v16.x or later recommended)
- npm
- A running MongoDB instance (local or a cloud service like MongoDB Atlas)

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/your-repo-name.git
    ```

2.  **Navigate to the project directory:**
    ```sh
    cd BLOGGY
    ```

3.  **Install NPM packages:**
    ```sh
    npm install
    ```

4.  **Create an environment file:**
    Create a `.env` file in the root of the `BLOGGY` directory and add the following variables. Replace the placeholder values with your actual credentials.

    ```env
    # Server Port
    PORT=3000

    # MongoDB Connection String
    ATLAS_URI=mongodb+srv://<user>:<password>@<cluster-uri>/myBlogDB?retryWrites=true&w=majority

    # Session Secret
    SECRET=YourSuperSecretStringForSessions

    # Google OAuth Credentials
    CLIENT_ID=YourGoogleClientID
    CLIENT_SECRET=YourGoogleClientSecret

    # Nodemailer Credentials (for a Gmail account)
    # Note: You may need to generate an "App Password" for your Google Account
    EMAIL_USER=your-email@gmail.com
    EMAIL_PASS=your-gmail-app-password
    ```

5.  **Run the application:**
    - For development with auto-reloading (requires `nodemon`):
      ```sh
      npm run dev
      ```
    - For production:
      ```sh
      npm start
      ```

The application should now be running at `http://localhost:3000`.

## 📂 Project Structure

The project currently follows a monolithic structure with the core logic residing in `app.js`.

```
BLOGGY/
├── public/
│   ├── css/          # All CSS stylesheets
│   └── images/       # Static images
├── views/
│   ├── partials/     # EJS partials (header, footer)
│   └── *.ejs         # EJS view templates for each page
├── .env              # Environment variables (not committed)
├── .gitignore        # Files to be ignored by Git
├── app.js            # Main application file: server, routes, logic
├── package.json      # Project dependencies and scripts
└── README.md         # This file
```

## 🔐 Security

- **Cross-Site Scripting (XSS) Protection**: User-generated Markdown content is converted to HTML using `marked` and then sanitized with `dompurify` to strip out any potentially malicious code before it is rendered in the view.
- **Sensitive Data Management**: All sensitive credentials, API keys, and secrets are stored in a `.env` file, which is excluded from version control via `.gitignore`, preventing accidental exposure.
