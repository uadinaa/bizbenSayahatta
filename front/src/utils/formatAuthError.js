export function formatAuthError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;

  if (Array.isArray(error)) {
    return error.map(formatAuthError).filter(Boolean).join(" ");
  }

  if (typeof error === "object") {
    if (typeof error.detail === "string") return error.detail;

    if (error.field_errors && typeof error.field_errors === "object") {
      return Object.entries(error.field_errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" ");
    }

    if (Array.isArray(error.messages)) {
      return error.messages
        .map((msg) => {
          if (typeof msg === "string") return msg;
          if (msg && typeof msg === "object") {
            return msg.message || msg.detail || Object.values(msg).join(" ");
          }
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }

    const fieldErrors = Object.entries(error)
      .map(([field, value]) => {
        if (typeof value === "string") return `${field}: ${value}`;
        if (Array.isArray(value)) return `${field}: ${value.join(", ")}`;
        return "";
      })
      .filter(Boolean);

    if (fieldErrors.length > 0) return fieldErrors.join(" ");
  }

  return "Something went wrong";
}