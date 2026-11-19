// errors.js - one error type used by BOTH the demo store and the live API.
// Because both throw the same ApiError, the UI has a single way to show problems.

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;   // HTTP status (0 = network problem)
    this.details = details; // raw error body from the server, if any
  }
}

// "roll_no" -> "Roll no"
export function humanizeField(key) {
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Django REST Framework returns errors like:
//   { "roll_no": ["student with this roll no already exists."] }
//   { "detail": "Invalid token." }
//   { "non_field_errors": ["Unable to log in with provided credentials."] }
// This turns any of those into one readable sentence.
export function extractMessage(data, fallback = "Something went wrong. Please try again.") {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  if (typeof data === "object") {
    const parts = Object.entries(data).map(([key, value]) => {
      const text = [].concat(value).join(" ");
      return key === "non_field_errors" ? text : `${humanizeField(key)}: ${text}`;
    });
    if (parts.length) return parts.join("  ");
  }
  return fallback;
}

// Used by the demo store to mimic what Django would answer.
export function fieldError(field, message) {
  return new ApiError(extractMessage({ [field]: [message] }), 400, { [field]: [message] });
}
