import { FormControl, FormGroup, Validators } from '@angular/forms';

import { FieldConfig } from './resource.types';

function fieldDefault(field: FieldConfig): string | number | boolean | null {
  switch (field.type) {
    case 'boolean':
      return false;
    case 'number':
      return null;
    default:
      return '';
  }
}

export function buildFormGroup(fields: FieldConfig[], values?: Record<string, unknown> | null): FormGroup {
  const controls: Record<string, FormControl<unknown>> = {};
  for (const field of fields) {
    let value: unknown = fieldDefault(field);
    if (values && values[field.name] !== undefined) {
      value = values[field.name];
    }
    controls[field.name] = new FormControl(value, field.required ? [Validators.required] : []);
  }
  return new FormGroup(controls);
}