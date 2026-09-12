import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiError, PaginationMeta } from '../../core/models/api';
import { Contact } from '../../core/models/contact';
import { CrudFormComponent } from '../../core/resources/crud-form.component';
import { CrudListComponent } from '../../core/resources/crud-list.component';
import { ResourceConfig } from '../../core/resources/resource.types';
import { ResourceService } from '../../core/resources/resource.service';
import { AuthService } from '../../core/services/auth.service';

const contactsResource: ResourceConfig = {
  path: '/api/contacts',
  title: 'Contactos',
  listFields: [
    { name: 'id', label: 'ID', type: 'number' },
    { name: 'name', label: 'Nombre', type: 'text' },
    { name: 'notes', label: 'Notas', type: 'text' },
    { name: 'createdAt', label: 'Creado', type: 'text' },
  ],
  formFields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Nombre completo' },
    { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Notas opcionales' },
  ],
};

@Component({
  selector: 'app-contacts',
  imports: [CrudListComponent, CrudFormComponent],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class ContactsPage implements OnInit {
  private readonly resources = inject(ResourceService);
  private readonly auth = inject(AuthService);

  readonly config = contactsResource;
  readonly rows = signal<Contact[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly editing = signal<Contact | null>(null);
  readonly showForm = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.auth.fetchCsrfToken().subscribe();
    this.loadPage(0);
  }

  loadPage(offset: number): void {
    const limit = this.pagination()?.limit ?? 10;
    this.loading.set(true);
    this.error.set(null);
    this.resources.list<Contact>(this.config, { top: limit, skip: offset, count: true }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.responseObject) {
          this.rows.set(res.responseObject.data);
          this.pagination.set(res.responseObject.pagination);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }

  newContact(): void {
    this.editing.set(null);
    this.showForm.set(true);
  }

  editContact(row: Record<string, unknown>): void {
    this.editing.set(row as Contact);
    this.showForm.set(true);
  }

  deleteContact(row: Record<string, unknown>): void {
    const id = String(row[this.config.idField ?? 'id']);
    if (!window.confirm('¿Eliminar este registro?')) {
      return;
    }
    this.resources.remove(this.config, id).subscribe({
      next: (res) => {
        if (!res.success) {
          this.error.set(res.message);
        }
        this.loadPage(this.pagination()?.offset ?? 0);
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  onSaved(values: Record<string, unknown>): void {
    const editing = this.editing();
    const request = editing
      ? this.resources.update<Contact>(this.config, String(editing.id), values)
      : this.resources.create<Contact>(this.config, values);
    request.subscribe({
      next: (res) => {
        this.showForm.set(false);
        this.editing.set(null);
        if (!res.success) {
          this.error.set(res.message);
        }
        this.loadPage(this.pagination()?.offset ?? 0);
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  onCancel(): void {
    this.showForm.set(false);
    this.editing.set(null);
  }
}