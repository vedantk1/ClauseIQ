# Forgot Password Functionality Setup Guide

## Overview

The ClauseIQ application now includes a complete forgot password functionality that allows users to reset their passwords via email. This feature includes:

1. **Forgot Password Request**: Users can request a password reset by providing their email
2. **Email Notification**: System sends a secure password reset link via email
3. **Password Reset**: Users can set a new password using the reset token

## 🔧 Setup Requirements

### 1. Install Dependencies

The following packages have been added to `requirements.txt`:

- `aiosmtplib==3.0.1` - For sending emails asynchronously
- `jinja2==3.1.4` - For email template rendering

Install them with:

```bash
cd backend
source legal_ai_env/bin/activate
pip install -r requirements.txt
```

### 2. Email Configuration

You need to configure SMTP settings in your `.env` file. Copy from `.env.example`:

```bash
# Email Configuration (Required for Forgot Password functionality)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=ClauseIQ

# Password Reset Configuration
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:3000
```

### 3. Gmail Setup (Recommended)

For Gmail, you'll need to:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this app password in `SMTP_PASSWORD`

### 4. Alternative Email Providers

You can also use other SMTP providers:

**SendGrid:**

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_sendgrid_api_key
```

**Outlook/Hotmail:**

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
```

## 🚀 API Endpoints

### 1. Forgot Password Request

**POST** `/auth/forgot-password`

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "If an account with this email exists, you will receive a password reset link."
}
```

**Security Features:**

- Always returns the same message regardless of whether email exists
- Prevents email enumeration attacks
- Only sends email if user actually exists

### 2. Reset Password

**POST** `/auth/reset-password`

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "new_password": "newpassword123"
}
```

**Response:**

```json
{
  "message": "Password reset successfully. You can now log in with your new password."
}
```

**Security Features:**

- Token expires in 30 minutes (configurable)
- Token can only be used once
- Password validation (minimum 8 characters, letters + numbers)
- Secure token verification

## 🧪 Testing

### 1. Basic Testing

Run the test script:

```bash
python test_forgot_password.py
```

This will test:

- Forgot password endpoint functionality
- Reset password endpoint (with invalid token)
- Complete registration + forgot password flow

### 2. Manual Testing

1. **Start the backend server:**

   ```bash
   cd backend
   source legal_ai_env/bin/activate
   uvicorn main:app --reload
   ```

2. **Test forgot password:**

   ```bash
   curl -X POST "http://localhost:8000/auth/forgot-password" \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

3. **Check email** for the reset link (if user exists and email is configured)

4. **Test reset password** (replace TOKEN with actual token from email):
   ```bash
   curl -X POST "http://localhost:8000/auth/reset-password" \
     -H "Content-Type: application/json" \
     -d '{"token": "TOKEN", "new_password": "newpassword123"}'
   ```

## 📧 Email Template

The password reset email includes:

- **Professional HTML template** with ClauseIQ branding
- **Security warnings** about token expiration and usage
- **Responsive design** that works on mobile and desktop
- **Plain text fallback** for email clients that don't support HTML
- **Clear call-to-action** button and backup link

## 🔒 Security Features

1. **Token-based Reset**: Uses JWT tokens with expiration
2. **Email Verification**: Only registered emails can request resets
3. **Rate Limiting Ready**: Endpoints designed to work with rate limiting
4. **No Information Disclosure**: Doesn't reveal if email exists or not
5. **Secure Token Storage**: Tokens are stateless and self-contained
6. **Password Validation**: Enforces strong password requirements

## 🔧 Configuration Options

All configuration is done via environment variables:

| Variable                              | Description                  | Default                 |
| ------------------------------------- | ---------------------------- | ----------------------- |
| `SMTP_HOST`                           | SMTP server hostname         | `smtp.gmail.com`        |
| `SMTP_PORT`                           | SMTP server port             | `587`                   |
| `SMTP_USERNAME`                       | SMTP username                | -                       |
| `SMTP_PASSWORD`                       | SMTP password/API key        | -                       |
| `EMAIL_FROM`                          | Sender email address         | `noreply@legalai.com`   |
| `EMAIL_FROM_NAME`                     | Sender display name          | `ClauseIQ`              |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | Token expiration time        | `30`                    |
| `FRONTEND_URL`                        | Frontend URL for reset links | `http://localhost:3000` |

## 🚨 Troubleshooting

### Common Issues:

1. **"Authentication failed" error:**

   - Check SMTP credentials
   - For Gmail, ensure you're using App Password, not regular password

2. **"Connection refused" error:**

   - Check SMTP host and port
   - Ensure firewall allows outbound connections on SMTP port

3. **Emails not being received:**

   - Check spam/junk folder
   - Verify email address is correct
   - Check SMTP logs for errors

4. **Token validation errors:**
   - Check JWT_SECRET_KEY is consistent
   - Verify token hasn't expired
   - Ensure token is passed correctly from email link

### Debug Mode:

Enable debug logging by setting log level to DEBUG in your environment to see detailed SMTP communication.

## 🎯 Frontend Integration

The frontend should implement:

1. **Forgot Password Form**: Collect email and call `/auth/forgot-password`
2. **Reset Password Page**: Handle reset token from URL and call `/auth/reset-password`
3. **Success/Error Messages**: Display appropriate user feedback
4. **Redirect Logic**: Redirect to login after successful reset

Example frontend flow:

```
Login Page → "Forgot Password?" → Email Form → Check Email Message
Reset Email → Reset Password Form → Success Message → Login Page
```

This completes the forgot password functionality setup. The system is now ready for production use with proper email configuration!
