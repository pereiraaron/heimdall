# Social Authentication Implementation Guide

This guide provides instructions for implementing social authentication in your frontend application to work with the Heimdall authentication service.

## Overview

The backend already has endpoints set up for Google, Facebook, and Twitter authentication. To implement social login in your frontend application, you'll need to:

1. Create social login buttons
2. Handle the OAuth flow redirects
3. Capture and store the JWT token after successful authentication

## Frontend Implementation

### 1. Social Login Buttons

Create buttons that redirect users to the Heimdall authentication endpoints:

```jsx
// Example React component
function SocialLogin() {
  const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:7001";

  return (
    <div className="social-login">
      <h3>Login with:</h3>

      <button
        onClick={() => (window.location.href = `${backendUrl}/api/auth/google`)}
        className="google-btn"
      >
        Login with Google
      </button>

      <button
        onClick={() =>
          (window.location.href = `${backendUrl}/api/auth/facebook`)
        }
        className="facebook-btn"
      >
        Login with Facebook
      </button>

      <button
        onClick={() =>
          (window.location.href = `${backendUrl}/api/auth/twitter`)
        }
        className="twitter-btn"
      >
        Login with Twitter
      </button>
    </div>
  );
}
```

### 2. Handle Authentication Success

Create a component to handle the redirect after successful authentication:

```jsx
// Example React component (AuthSuccess.jsx)
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      // Store the token in localStorage or your state management solution
      localStorage.setItem("auth_token", token);

      // Redirect to the dashboard or protected page
      navigate("/dashboard");
    } else {
      // Handle error case
      navigate("/login?error=authentication_failed");
    }
  }, [searchParams, navigate]);

  return (
    <div className="auth-success">
      <p>Authentication successful. Redirecting...</p>
    </div>
  );
}
```

### 3. Set Up Routes

Make sure to set up a route to handle the authentication success:

```jsx
// Example React Router setup
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/auth/success" element={<AuthSuccess />} />
  <Route path="/dashboard" element={<Dashboard />} />
</Routes>
```

## OAuth Configuration

To set up OAuth applications for each provider:

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth client ID
5. Set the authorized redirect URI to `http://localhost:7001/api/auth/google/callback` (for development)
6. Copy the Client ID and Client Secret to your backend `.env` file

### Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add the Facebook Login product
4. Set the OAuth redirect URI to `http://localhost:7001/api/auth/facebook/callback` (for development)
5. Copy the App ID and App Secret to your backend `.env` file

### Twitter OAuth Setup

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new project and app
3. Set up authentication settings
4. Set the callback URL to `http://localhost:7001/api/auth/twitter/callback` (for development)
5. Copy the API Key and API Secret to your backend `.env` file

## Testing

For testing purposes, you can use the following flow:

1. Click a social login button on your frontend
2. You'll be redirected to the provider's authentication page
3. After authenticating, you'll be redirected back to your frontend application
4. The `/auth/success` route will capture the token and store it
5. You can then use the token for authenticated API requests

## Deployment Considerations

When deploying to production:

1. Update the callback URLs in each OAuth provider to use your production domain
2. Update the `FRONTEND_URL` in your backend `.env` file
3. Make sure all redirect URLs use HTTPS in production

## Troubleshooting

If you encounter issues:

- Check the browser console for errors
- Verify that all environment variables are set correctly
- Ensure the callback URLs exactly match what's configured in the OAuth providers
- Check the backend logs for authentication errors
