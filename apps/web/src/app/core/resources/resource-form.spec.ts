import { buildFormGroup } from './resource-form';
import { FieldConfig } from './resource.types';

const fields: FieldConfig[] = [
  { name: 'name', label: 'Nombre', type: 'text', required: true },
  { name: 'notes', label: 'Notas', type: 'textarea' },
  { name: 'active', label: 'Activo', type: 'boolean' },
  { name: 'quantity', label: 'Cantidad', type: 'number' },
  { name: 'kind', label: 'Tipo', type: 'select', options: [{ value: 'a', label: 'A' }] },
];

describe('buildFormGroup', () => {
  it('creates one control per field using the field name', () => {
    const form = buildFormGroup(fields);
    for (const field of fields) {
      expect(form.get(field.name)).not.toBeNull();
    }
  });

  it('marks the control as invalid when the field is required', () => {
    const form = buildFormGroup(fields);
    expect(form.get('name')?.valid).toBeFalse();
  });

  it('uses a typed default value per field type', () => {
    const form = buildFormGroup(fields);
    expect(form.get('active')?.value).toBe(false);
    expect(form.get('quantity')?.value).toBeNull();
    expect(form.get('name')?.value).toBe('');
  });

  it('seeds values from a model and keeps nulls', () => {
    const form = buildFormGroup(fields, { name: 'Ada', active: true, notes: null });
    expect(form.get('name')?.value).toBe('Ada');
    expect(form.get('active')?.value).toBe(true);
    expect(form.get('notes')?.value).toBeNull();
  });
});