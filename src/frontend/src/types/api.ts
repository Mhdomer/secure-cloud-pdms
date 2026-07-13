/** Standard pagination metadata returned alongside any list endpoint. */
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Standard paginated list response shape used across all list endpoints. */
export interface Paginated<T> {
  data: T[]
  pagination: Pagination
}

/** Shape of an error response body from the API. */
export interface ApiError {
  message: string
  code?: string
  /** Field-level validation errors, keyed by field name, when applicable. */
  errors?: Record<string, string[]>
}
