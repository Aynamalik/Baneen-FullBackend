# OTP Verification Guide

## Verification Token Flow (Recommended)

The API supports **verification token** flow so the app does not need to send the phone number again on the Verify OTP screen.

### Registration Response (Driver & Passenger)

When OTP is sent, the API now returns a `verificationToken`:

```json
{
  "success": true,
  "data": {
    "message": "OTP sent to your phone. Please verify to complete registration.",
    "phone": "03251196878",
    "verificationToken": "a1b2c3d4e5f6..."
  }
}
```

Store `verificationToken` and pass it to the Verify OTP screen. Use `phone` for display only ("We sent a code to 03251196878").

**Cookie:** The token is also set in an HTTP-only cookie (`verificationToken`). For web apps using same-origin or configured CORS with `credentials: true`, the verify endpoint will automatically use the cookie if the token is not sent in the body. No need to pass the token manually when using cookies.

### Verify OTP Request (no phone needed)

**Endpoint:** `POST /api/v1/auth/verify-otp` or `POST /api/v1/auth/verify-driver-otp`

**Request Body:**
```json
{
  "verificationToken": "a1b2c3d4e5f6...",
  "otp": "123456"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "YOUR_TOKEN_FROM_REGISTRATION", "otp": "123456"}'
```

## Required Fields

- ✅ `verificationToken` - From registration response (OR `phone` for backward compatibility)
- ✅ `otp` - The 6-digit OTP code

## Common Errors

### Error: "Verification token or phone is required"
**Cause:** Missing `verificationToken` or `phone` in request body

**Solution:** Send either verificationToken (from registration) or phone:
```json
{"verificationToken": "xxx", "otp": "123456"}
```

### Error: "Invalid or expired OTP"
**Causes:**
- Wrong OTP code
- OTP expired (10 minutes)
- Too many attempts (max 5)

**Solution:**
- Check server logs for the correct OTP (for test numbers)
- Request a new OTP if expired
- Wait before retrying if max attempts reached

### Error: "No registration data found"
**Cause:** Registration data expired (15 minutes)

**Solution:** Register again to get a new OTP and verificationToken

## Testing

### For Test Numbers (`1234`, `1234567890`, `0000000000`):
1. Register first (get OTP from server logs)
2. Use any 6-digit code for verification
3. OTP is logged in server console

### For Real Phone Numbers:
1. Register first (SMS will be sent)
2. Enter the OTP code from SMS
3. OTP expires in 10 minutes

## Flutter App Example

```dart
// After registration - navigate to Verify OTP with token
final token = response.data['verificationToken'];
final phone = response.data['phone'];
Navigator.push(context, MaterialPageRoute(
  builder: (_) => VerifyOtpScreen(
    verificationToken: token,
    phone: phone,  // display only
    isDriver: false,
  ),
));

// Verify OTP - no phone sent
Future<void> verifyOTP(String verificationToken, String otpCode) async {
  final response = await dio.post(
    '/api/v1/auth/verify-otp',
    data: {
      'verificationToken': verificationToken,
      'otp': otpCode,
    },
  );
  if (response.data['success']) {
    final tokens = response.data['data'];
    // Save tokens and navigate to home
  }
}
```

## Request Format

- ✅ Content-Type: `application/json`
- ✅ `verificationToken` (from registration) + `otp`
- ✅ Or `phone` + `otp` for backward compatibility
- ✅ Or `otp` only (when using cookie) — include `credentials: 'include'` in fetch, or `withCredentials: true` in axios
