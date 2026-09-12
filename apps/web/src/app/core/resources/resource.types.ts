export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date';

export interface FieldOption {
  value: string | number;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
}

export interface ResourceConfig {
  /** Base API path, e.g. '/api/contacts'. */
  path: string;
  title: string;
  /** Primary key field, defaults to 'id'. */
  idField?: string;
  /** Columns rendered in the generic list. */
  listFields: FieldConfig[];
  /** Controls rendered in the generic form. */
  formFields: FieldConfig[];
}

export interface ListParams {
  top: number;
  skip: number;
  count?: boolean;
}