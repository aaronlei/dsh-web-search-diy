/**
 * Browser-side JSON HTTP helpers shared by the configuration and observation
 * halves: one response-error shape and one place that builds request headers.
 *
 * @module dsh-web-search-diy/client/http
 */

/**
 * Parse a JSON response; a non-2xx response throws the server's `error` text
 * (or the status) instead of returning a failure body to the caller.
 *
 * @param response - one fetch response.
 * @returns the parsed body.
 */
export async function readJsonResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let detail = `HTTP ${response.status}`;
		try {
			const body = await response.json() as { error?: unknown };
			if (typeof body.error === "string" && body.error.length > 0) detail = body.error;
		} catch {
			// A non-JSON error body leaves the status as the message.
		}
		throw new Error(detail);
	}
	return await response.json() as T;
}

/**
 * GET one JSON endpoint.
 *
 * @param url - absolute or root-relative endpoint URL.
 * @param signal - optional cancellation signal.
 * @returns the parsed body.
 */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
	const response = await fetch(url, { headers: { accept: "application/json" }, ...(signal !== void 0 ? { signal } : {}) });
	return await readJsonResponse<T>(response);
}

/**
 * POST one JSON body and parse the JSON response.
 *
 * @param url - endpoint URL.
 * @param payload - JSON-serializable body.
 * @returns the parsed body.
 */
export async function postJson<T>(url: string, payload: unknown): Promise<T> {
	const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
	return await readJsonResponse<T>(response);
}
