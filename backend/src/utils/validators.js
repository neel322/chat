// chat-backend/src/utils/validators.js

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validateAuthInput({ username, email, password, isRegistration = true }) {
  if (isRegistration) {
    if (!username || typeof username !== 'string') {
      return 'Username is required';
    }
    const cleanUsername = username.trim();
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return 'Username must be 3-20 characters long and contain only letters, numbers, underscores, or hyphens';
    }
  }

  if (!email || typeof email !== 'string') {
    return 'Email is required';
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return 'Please provide a valid email address';
  }

  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (isRegistration && !PASSWORD_REGEX.test(password)) {
    return 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number';
  }

  return null;
}

module.exports = {
  validateAuthInput,
  USERNAME_REGEX,
  EMAIL_REGEX,
  PASSWORD_REGEX
};