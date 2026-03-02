import { Link, useRouteError, useSearchParams } from "react-router-dom";

const TITLES = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  409: "Conflict",
  429: "Too Many Requests",
  500: "Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

function getStatus(routeError, searchParams) {
  const fromQuery = Number(searchParams.get("status"));
  if (Number.isInteger(fromQuery) && fromQuery >= 100 && fromQuery <= 599) return fromQuery;

  const routeStatus = Number(routeError?.status);
  if (Number.isInteger(routeStatus) && routeStatus >= 100 && routeStatus <= 599) return routeStatus;

  return 500;
}

export default function ErrorPage() {
  const routeError = useRouteError();
  const [searchParams] = useSearchParams();
  const status = getStatus(routeError, searchParams);
  const title = TITLES[status] || "Unexpected Error";

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 20, textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>{status} - {title}</h1>
      <p style={{ color: "#667085", marginBottom: 18 }}>
        Something went wrong. We logged the issue and sanitized technical details.
      </p>

      <img
        src={`https://http.cat/${status}`}
        alt={`HTTP ${status}`}
        style={{ width: "100%", maxWidth: 480, borderRadius: 12, border: "1px solid #eee" }}
      />

      <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 10 }}>
        <Link to="/" style={{ textDecoration: "none", padding: "8px 14px", borderRadius: 8, border: "1px solid #d0d5dd" }}>
          Go Home
        </Link>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    </div>
  );
}
