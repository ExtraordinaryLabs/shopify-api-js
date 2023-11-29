export type CustomFetchApi = (
  url: string,
  init?: {
    method?: string;
    headers?: HeadersInit;
    body?: string;
  },
) => Promise<Response>;

export type DataChunk = Buffer | Uint8Array;

interface OperationVariables {
  [key: string]: any;
}

export interface Headers {
  [key: string]: string;
}

export interface ResponseErrors {
  networkStatusCode?: number;
  message?: string;
  graphQLErrors?: any[];
  response?: Response;
}

export interface GQLExtensions {
  [key: string]: any;
}

export interface FetchResponseBody<TData = any> {
  data?: Partial<TData>;
  extensions?: GQLExtensions;
}

export interface ClientResponse<TData = any> extends FetchResponseBody<TData> {
  errors?: ResponseErrors;
}

export interface ClientStreamResponse<TData = unknown>
  extends ClientResponse<TData> {
  hasNext: boolean;
}

export interface ClientStreamIterator<TData = unknown> {
  [Symbol.asyncIterator](): AsyncIterator<ClientStreamResponse<TData>>;
}

export interface LogContent {
  type: string;
  content: any;
}

export interface HTTPResponseLog extends LogContent {
  type: "HTTP-Response";
  content: {
    requestParams: Parameters<CustomFetchApi>;
    response: Response;
  };
}

export interface HTTPRetryLog extends LogContent {
  type: "HTTP-Retry";
  content: {
    requestParams: Parameters<CustomFetchApi>;
    lastResponse?: Response;
    retryAttempt: number;
    maxRetries: number;
  };
}

export type LogContentTypes = HTTPResponseLog | HTTPRetryLog;

export type Logger<TLogContentTypes = LogContentTypes> = (
  logContent: TLogContentTypes,
) => void;

export interface ClientOptions {
  headers: Headers;
  url: string;
  fetchApi?: CustomFetchApi;
  retries?: number;
  logger?: Logger;
}

export interface ClientConfig {
  readonly headers: ClientOptions["headers"];
  readonly url: ClientOptions["url"];
  readonly retries: Required<ClientOptions>["retries"];
}

export interface RequestOptions {
  variables?: OperationVariables;
  url?: string;
  headers?: Headers;
  retries?: number;
}

export type RequestParams = [operation: string, options?: RequestOptions];

export interface GraphQLClient {
  readonly config: ClientConfig;
  fetch: (...props: RequestParams) => Promise<Response>;
  request: <TData = any>(
    ...props: RequestParams
  ) => Promise<ClientResponse<TData>>;
  requestStream: <TData = unknown>(
    ...props: RequestParams
  ) => Promise<ClientStreamIterator<TData>>;
}
