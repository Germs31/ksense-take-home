const BASE_URL = "https://assessment.ksensetech.com/api";
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 300;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetriableStatus = (status: number) => status === 429 || status === 500 || status === 503;

const getApiKey = () => {
  const key = process.env.DEMOMED_API_KEY;
  if (!key) {
    throw new Error("Missing DEMOMED_API_KEY environment variable");
  }
  return key;
};

const buildPatientsUrl = (page: number, limit: number) => {
  const url = new URL(`${BASE_URL}/patients`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  return url;
};

const fetchWithRetry = async (url: URL, apiKey: string) => {
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      const response = await fetch(url.toString(), {
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (response.ok) {
        return response;
      }

      if (isRetriableStatus(response.status) && attempt < MAX_ATTEMPTS) {
        const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), 4000);
        await wait(delay);
        continue;
      }

      const body = await response.text().catch(() => "");
      throw new Error(
        `Request failed with status ${response.status}${body ? `: ${body}` : ""}`,
      );
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), 4000);
      await wait(delay);
    }
  }

  throw new Error("Exceeded maximum retry attempts");
};

type PatientsResponse = {
  data?: unknown[];
  pagination?: {
    page?: number;
    totalPages?: number;
    hasNext?: boolean;
  };
};

type FetchPatientsOptions = {
  limit?: number;
  maxPages?: number;
};

export const fetchAllPatients = async ({
  limit = 5,
  maxPages = 10,
}: FetchPatientsOptions = {}) => {
  const apiKey = getApiKey();
  const patients: unknown[] = [];

  let page = 1;
  let pagesFetched = 0;
  let hasNext = true;
  let totalPages: number | undefined;

  while (hasNext && page <= maxPages) {
    const url = buildPatientsUrl(page, limit);
    const response = await fetchWithRetry(url, apiKey);
    const payload = (await response.json()) as PatientsResponse;

    const pageData = Array.isArray(payload.data) ? payload.data : [];
    patients.push(...pageData);

    totalPages = payload.pagination?.totalPages ?? totalPages;

    const pageNumber = payload.pagination?.page ?? page;
    const hasNextFlag = payload.pagination?.hasNext;
    const inferredHasNext =
      hasNextFlag !== undefined
        ? hasNextFlag
        : totalPages !== undefined
          ? pageNumber < totalPages
          : pageData.length > 0 && page < maxPages;

    hasNext = inferredHasNext;
    page += 1;
    pagesFetched += 1;
  }

  return {
    patients,
    pagesFetched,
    totalPages: totalPages ?? pagesFetched,
    limit,
  };
};
