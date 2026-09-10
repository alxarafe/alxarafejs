export interface ServiceResponse<T = null> {
  success: boolean;
  message: string;
  responseObject: T;
  statusCode: number;
}

export interface PaginationMeta {
  count: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number | null;
  nextLink: string | null;
  previousLink: string | null;
}

export interface PaginatedList<T> {
  data: T[];
  pagination: PaginationMeta;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}