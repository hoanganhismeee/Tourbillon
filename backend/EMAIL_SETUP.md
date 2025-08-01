# Email Setup Guide for Tourbillon

This guide explains how to configure email functionality for passwordless login and password reset features.

## Gmail SMTP Configuration

### 1. Enable 2-Factor Authentication
- Go to your Google Account settings
- Enable 2-Factor Authentication if not already enabled

### 2. Generate App Password
- Go to Google Account → Security → 2-Step Verification
- Scroll down to "App passwords"
- Generate a new app password for "Mail"
- Copy the 16-character password

### 3. Update Configuration
Edit `appsettings.json` and replace the email settings:

```json
{
  "EmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "Port": 587,
    "Username": "your-actual-email@gmail.com",
    "Password": "your-16-character-app-password",
    "FromEmail": "your-actual-email@gmail.com"
  }
}
```

### 4. Alternative Email Providers

#### Outlook/Hotmail
```json
{
  "EmailSettings": {
    "SmtpServer": "smtp-mail.outlook.com",
    "Port": 587,
    "Username": "your-email@outlook.com",
    "Password": "your-password",
    "FromEmail": "your-email@outlook.com"
  }
}
```

#### Custom SMTP Server
```json
{
  "EmailSettings": {
    "SmtpServer": "your-smtp-server.com",
    "Port": 587,
    "Username": "your-username",
    "Password": "your-password",
    "FromEmail": "noreply@yourdomain.com"
  }
}
```

## Features Enabled

1. **Passwordless Login**: Users can sign in by clicking a link sent to their email
2. **Forgot Password**: Users can reset their password via email link
3. **Smart Password Management**: Users who login via email can set a password later

## Security Notes

- Email links expire after 15 minutes
- Links are single-use only
- App passwords are more secure than regular passwords
- Never commit real credentials to version control 