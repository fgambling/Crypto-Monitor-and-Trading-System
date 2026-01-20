import React, { useMemo, useState, useEffect } from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(React.createElement);

const API_BASE_URL = window.CRYPTO_MONITOR_CONFIG?.API_BASE_URL || "";
const POSTS_ENDPOINT = API_BASE_URL ? `${API_BASE_URL}posts` : null;

function readSeedData() {
  const node = document.getElementById("seed-data");
  if (!node) return [];
  try {
    return JSON.parse(node.textContent || "[]");
  } catch {
    return [];
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function App() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = async (token = null, append = false) => {
    if (!POSTS_ENDPOINT) return;

    const url = new URL(POSTS_ENDPOINT);
    url.searchParams.set("limit", "20");
    if (token) {
      url.searchParams.set("nextToken", token);
    }

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }
      const response = await res.json();
      
      const data = response.items || response.data || [];
      const pagination = response.pagination || {};

      if (append) {
        setItems(prev => [...prev, ...data]);
      } else {
        setItems(data);
      }

      setNextToken(pagination.nextToken || null);
      setHasMore(pagination.hasMore || false);
      setStatus("ready");
      setErrorMessage("");
      return response;
    } catch (err) {
      console.error("Failed to fetch from API:", err);
      throw err;
    }
  };

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;
    
    setLoadingMore(true);
    try {
      await fetchPosts(nextToken, true);
    } catch (err) {
      setErrorMessage("Failed to load more posts");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    
    // Try to fetch from API first
    if (POSTS_ENDPOINT) {
      fetchPosts()
        .catch((err) => {
          if (cancelled) return;
          // Fallback to seed data
          const seed = readSeedData();
          setItems(Array.isArray(seed) ? seed : []);
          setStatus(seed.length ? "ready" : "error");
          setErrorMessage(seed.length ? "Using demo data (API unavailable)" : "Failed to load data");
        });
    } else {
      // No API configured, use seed data
      const seed = readSeedData();
      setItems(Array.isArray(seed) ? seed : []);
      setStatus(seed.length ? "ready" : "error");
      setErrorMessage(seed.length ? "Using demo data (API not configured)" : "No data available");
    }
    
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.username, item.ticker, item.tweetContent, item.contractAddress]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [items, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filtered]);

  const totalTickers = new Set(items.map((item) => item.ticker)).size;

  return html`
    <div>
      <section className="hero">
        <h1>Dashboard</h1>
        ${errorMessage
          ? html`<p style=${{ color: "#d97706", fontSize: "0.85rem", marginTop: "0.4rem" }}>
              ${errorMessage}
            </p>`
          : null}
      </section>

      <section className="topbar">
        <div className="search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Search by ticker, user, or address..."
            value=${query}
            onChange=${(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="stats">
          <div className="stat">
            <span>Total Tickers</span>
            <strong>${totalTickers}</strong>
          </div>
        </div>
      </section>

      <section className="layout">
        <div className="card">
          <h2>Latest Tweets</h2>
          ${status === "loading" ? html`<p>Loading data...</p>` : null}
          ${status === "error" ? html`<p>Could not load data.</p>` : null}
          ${status === "ready" && sorted.length === 0 ? html`<p>No tweets found.</p>` : null}
          <div className="list">
            ${sorted.map(
              (item, index) => html`<article
                className="tweet"
                key=${`${item.tweetId}-${index}`}
                style=${{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="avatar">${String(item.username || "?").slice(0, 2).toUpperCase()}</div>
                <div>
                  <header>
                    <strong>@${item.username}</strong>
                    <span>${formatDate(item.createdAt)}</span>
                  </header>
                  <p>${item.tweetContent}</p>
                  <div className="token-info">
                    <span className="badge badge-ticker">$${item.ticker}</span>
                    ${item.pairUrl
                      ? html`<a href=${item.pairUrl} target="_blank" rel="noopener noreferrer" className="badge badge-address" title=${item.contractAddress}>
                          ${shortAddr(item.contractAddress)}
                          <span className="link-icon">↗</span>
                        </a>`
                      : html`<span className="badge badge-address">${shortAddr(item.contractAddress)}</span>`}
                  </div>
                </div>
              </article>`
            )}
          </div>
          ${status === "ready" && hasMore && !query
            ? html`<div style=${{ textAlign: "center", marginTop: "20px" }}>
                <button
                  onClick=${loadMore}
                  disabled=${loadingMore}
                  className="load-more-btn"
                >
                  ${loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>`
            : null}
        </div>

      </section>

      <div className="footer">
        ${POSTS_ENDPOINT
          ? html`<span>API: ${POSTS_ENDPOINT}</span>`
          : html`<span>API not configured.</span>`}
      </div>
    </div>
  `;
}

const root = createRoot(document.getElementById("app"));
root.render(html`<${App} />`);
