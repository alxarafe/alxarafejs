import { Component, EventEmitter, Input, Output } from '@angular/core';

import { PaginationMeta } from '../models/api';
import { FieldConfig, ResourceConfig } from './resource.types';

@Component({
  selector: 'app-crud-list',
  imports: [],
  templateUrl: './crud-list.component.html',
  styleUrl: './crud-list.component.scss',
})
export class CrudListComponent {
  @Input({ required: true }) config!: ResourceConfig;
  @Input() rows: Record<string, unknown>[] = [];
  @Input() pagination: PaginationMeta | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Record<string, unknown>>();
  @Output() delete = new EventEmitter<Record<string, unknown>>();
  @Output() paged = new EventEmitter<number>();

  cellValue(row: Record<string, unknown>, field: FieldConfig): string {
    const value = row[field.name];
    if (value === null || value === undefined) {
      return '';
    }
    if (field.type === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    return String(value);
  }

  rowId(row: Record<string, unknown>): string | number {
    return String(row[this.config.idField ?? 'id']);
  }
}