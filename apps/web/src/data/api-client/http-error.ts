/** خطأ HTTP موحّد يعيده الـAPI Client. */
export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Request failed with status ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** يُرمى عند غياب VITE_API_BASE_URL — ويعني خطأ إعداد وليس خطأ شبكة. */
export class MissingApiBaseUrlError extends Error {
  constructor() {
    super('VITE_API_BASE_URL is not configured');
    this.name = 'MissingApiBaseUrlError';
  }
}
