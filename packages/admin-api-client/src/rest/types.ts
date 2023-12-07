import { CustomFetchApi } from "@shopify/graphql-client";

import { AdminApiClientOptions } from "../types";

export enum Method {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}

interface HeaderOptions {
  [key: string]: string | number | string[];
}

export interface GetRequestOptions {
  headers?: HeaderOptions;
  data?: { [key: string]: any } | string;
  searchParams?: URLSearchParams;
  retries?: number;
}

export interface PostRequestOptions extends GetRequestOptions {
  data: Required<GetRequestOptions>["data"];
}

export interface PutRequestOptions extends PostRequestOptions {}

export interface DeleteRequestOptions extends GetRequestOptions {}

export interface AdminRestApiClientOptions extends AdminApiClientOptions {
  scheme: "https" | "http";
}

export type RequestOptions = (GetRequestOptions | PostRequestOptions) & {
  method: Method;
};

export interface AdminRestApiClient {
  get: (
    path: string,
    options?: GetRequestOptions,
  ) => Promise<ReturnType<CustomFetchApi>>;
  put: (
    path: string,
    options?: PutRequestOptions,
  ) => Promise<ReturnType<CustomFetchApi>>;
  post: (
    path: string,
    options?: PostRequestOptions,
  ) => Promise<ReturnType<CustomFetchApi>>;
  delete: (
    path: string,
    options?: DeleteRequestOptions,
  ) => Promise<ReturnType<CustomFetchApi>>;
}
