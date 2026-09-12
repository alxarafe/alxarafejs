import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { buildFormGroup } from './resource-form';
import { ResourceConfig } from './resource.types';

@Component({
  selector: 'app-crud-form',
  imports: [ReactiveFormsModule],
  templateUrl: './crud-form.component.html',
  styleUrl: './crud-form.component.scss',
})
export class CrudFormComponent implements OnChanges {
  @Input({ required: true }) config!: ResourceConfig;
  @Input() model: Record<string, unknown> | null = null;

  @Output() saved = new EventEmitter<Record<string, unknown>>();
  @Output() cancel = new EventEmitter<void>();

  formGroup!: FormGroup;

  get isNew(): boolean {
    return this.model === null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['model']) {
      this.formGroup = buildFormGroup(this.config.formFields, this.model);
    }
  }

  submit(): void {
    if (this.formGroup.invalid) {
      return;
    }
    this.saved.emit(this.formGroup.getRawValue() as Record<string, unknown>);
  }
}