import {
  CustomFetchApi,
  LogContentTypes,
  Logger,
  getCurrentSupportedApiVersions,
  validateApiVersion,
  validateDomainAndGetStoreUrl,
} from "@shopify/graphql-client";

import {
  validateRequiredAccessToken,
  validateServerSideUsage,
} from "../validations";
import {
  ACCESS_TOKEN_HEADER,
  CLIENT,
  DEFAULT_CLIENT_VERSION,
  DEFAULT_CONTENT_TYPE,
  DEFAULT_RETRY_WAIT_TIME,
  RETRIABLE_STATUS_CODES,
} from "../constants";

import {
  AdminRestApiClient,
  AdminRestApiClientOptions,
  DeleteRequestOptions,
  GetRequestOptions,
  Method,
  PostRequestOptions,
  PutRequestOptions,
  RequestOptions,
} from "./types";

export function createAdminRestApiClient({
  storeDomain,
  apiVersion,
  accessToken,
  userAgentPrefix,
  logger,
  headers: clientHeaders,
  customFetchApi = fetch,
  retries: clientRetries = 0,
  scheme = "https",
}: AdminRestApiClientOptions): AdminRestApiClient {
  const currentSupportedApiVersions = getCurrentSupportedApiVersions();

  const storeUrl = validateDomainAndGetStoreUrl({
    client: CLIENT,
    storeDomain,
  }).replace("https://", `${scheme}://`);

  const baseApiVersionValidationParams = {
    client: CLIENT,
    currentSupportedApiVersions,
    logger,
  };

  validateServerSideUsage();
  validateApiVersion({
    client: CLIENT,
    currentSupportedApiVersions,
    apiVersion,
    logger,
  });
  validateRequiredAccessToken(accessToken);

  const apiUrlFormatter = generateApiUrlFormatter(
    storeUrl,
    apiVersion,
    baseApiVersionValidationParams,
  );
  const clientLogger = generateClientLogger(logger);
  const httpFetch = generateHttpFetch(customFetchApi, clientLogger);

  const request = async (
    path: string,
    {
      method,
      data,
      headers: requestHeaders,
      searchParams,
      retries = 0,
    }: RequestOptions,
  ): Promise<ReturnType<CustomFetchApi>> => {
    const url = apiUrlFormatter(path, new URLSearchParams(searchParams));

    const body = typeof data === "string" ? data : JSON.stringify(data);

    const headers = new Headers({
      ...clientHeaders,
      ...requestHeaders,
      "Content-Type": DEFAULT_CONTENT_TYPE,
      Accept: DEFAULT_CONTENT_TYPE,
      [ACCESS_TOKEN_HEADER]: accessToken,
      "User-Agent": `${
        userAgentPrefix ? `${userAgentPrefix} | ` : ""
      }${CLIENT} v${DEFAULT_CLIENT_VERSION}`,
    });

    return httpFetch(
      [url, { method, body, headers }],
      1,
      (retries ?? clientRetries) + 1,
    );
  };

  return {
    get: (path: string, options?: GetRequestOptions) => {
      return request(path, { method: Method.Get, ...options });
    },
    put: (path: string, options?: PutRequestOptions) => {
      return request(path, { method: Method.Put, ...options });
    },
    post: (path: string, options?: PostRequestOptions) => {
      return request(path, { method: Method.Post, ...options });
    },
    delete: (path: string, options?: DeleteRequestOptions) => {
      return request(path, { method: Method.Delete, ...options });
    },
  };
}

function generateApiUrlFormatter(
  storeUrl: string,
  defaultApiVersion: string,
  baseApiVersionValidationParams: Omit<
    Parameters<typeof validateApiVersion>[0],
    "apiVersion"
  >,
) {
  return (path: string, searchParams: URLSearchParams, apiVersion?: string) => {
    if (apiVersion) {
      validateApiVersion({
        ...baseApiVersionValidationParams,
        apiVersion,
      });
    }

    const urlApiVersion = (apiVersion ?? defaultApiVersion).trim();
    const cleanPath = path.replace(/^\//, "");

    return `${storeUrl}/admin/api/${urlApiVersion}/${cleanPath}?${searchParams.toString()}`;
  };
}

function generateClientLogger(logger?: Logger): Logger {
  return (logContent: LogContentTypes) => {
    if (logger) {
      logger(logContent);
    }
  };
}

function generateHttpFetch(fetchApi: CustomFetchApi, clientLogger: Logger) {
  const httpFetch = async (
    requestParams: Parameters<CustomFetchApi>,
    count: number,
    maxRetries: number,
  ): ReturnType<CustomFetchApi> => {
    const nextCount = count + 1;
    const maxTries = maxRetries + 1;
    let response: Response | undefined;

    try {
      response = await fetchApi(...requestParams);

      clientLogger({
        type: "HTTP-Response",
        content: {
          requestParams,
          response,
        },
      });

      if (
        !response.ok &&
        RETRIABLE_STATUS_CODES.includes(response.status) &&
        nextCount <= maxTries
      ) {
        throw new Error();
      }

      return response;
    } catch (error) {
      if (nextCount <= maxTries) {
        const retryAfter = response?.headers.get("Retry-After");
        await sleep(
          retryAfter ? parseInt(retryAfter, 10) : DEFAULT_RETRY_WAIT_TIME,
        );

        clientLogger({
          type: "HTTP-Retry",
          content: {
            requestParams,
            lastResponse: response,
            retryAttempt: count,
            maxRetries,
          },
        });

        return httpFetch(requestParams, nextCount, maxRetries);
      }

      throw new Error(
        formatErrorMessage(
          `${
            maxRetries > 0
              ? `Attempted maximum number of ${maxRetries} network retries. Last message - `
              : ""
          }${getErrorMessage(error)}`,
        ),
      );
    }
  };

  return httpFetch;
}

function formatErrorMessage(message: string) {
  return message.startsWith(`${CLIENT}`) ? message : `${CLIENT}: ${message}`;
}

function getErrorMessage(error: any) {
  return error instanceof Error ? error.message : JSON.stringify(error);
}

async function sleep(waitTime: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, waitTime));
}
